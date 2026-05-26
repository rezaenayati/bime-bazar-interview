import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import {
    ORDER_REPOSITORY,
    OrderAccessDeniedError,
    OrderNotFoundError,
    OrderNotPayableError,
    OrderRepository,
} from '@bime-bazar/order/domain';
import {
    ChargeResult,
    InvalidPaymentRequestError,
    PAYMENT_REPOSITORY,
    Payment,
    PaymentProvider,
    PaymentRepository,
    ProviderName,
} from '@bime-bazar/payment/domain';
import { DomainEventPublisher, TransactionRunner } from '@bime-bazar/shared/infra';
import { PayOrderAllocationInput, PayOrderCommand } from './pay-order.command';
import { PaymentDto } from '../dto';
import { toPaymentDto } from '../payment-mapper';
import { PaymentProviderRegistry } from '../payment-provider.registry';

interface SuccessfulCharge {
    provider: ProviderName;
    amountCents: number;
    externalRef: string;
}

@CommandHandler(PayOrderCommand)
export class PayOrderHandler implements ICommandHandler<PayOrderCommand, PaymentDto> {
    private readonly logger = new Logger(PayOrderHandler.name);

    constructor(
        @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
        @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
        private readonly registry: PaymentProviderRegistry,
        private readonly events: DomainEventPublisher,
        private readonly config: ConfigService,
        private readonly tx: TransactionRunner,
    ) {}

    async execute(command: PayOrderCommand): Promise<PaymentDto> {
        const existing = await this.payments.findByIdempotencyKey(command.idempotencyKey);
        if (existing) {
            if (
                existing.customerId !== command.customerId ||
                existing.orderId !== command.orderId
            ) {
                this.logger.warn(
                    `idempotency key collision: key ${command.idempotencyKey} originally bound to order ${existing.orderId} / customer ${existing.customerId}, replayed by order ${command.orderId} / customer ${command.customerId}`,
                );
                throw new InvalidPaymentRequestError(
                    'Idempotency-Key was previously used with different request parameters',
                );
            }
            this.logger.log(
                `idempotent replay: payment ${existing.id} for key ${command.idempotencyKey} (status=${existing.status})`,
            );
            return toPaymentDto(existing);
        }

        const order = await this.orders.findById(command.orderId);
        if (!order) throw new OrderNotFoundError(command.orderId);
        if (order.customerId !== command.customerId) {
            throw new OrderAccessDeniedError(order.id, command.customerId);
        }
        if (order.status !== 'pending') {
            throw new OrderNotPayableError(order.status);
        }

        const allocations = command.allocations.length
            ? command.allocations
            : [{ amountCents: order.totalCents }];
        const allocationSum = allocations.reduce((s, a) => s + a.amountCents, 0);
        if (allocationSum !== order.totalCents) {
            throw new InvalidPaymentRequestError(
                `Allocations sum (${allocationSum}) does not match order total (${order.totalCents})`,
            );
        }
        for (const a of allocations) {
            if (a.amountCents <= 0) {
                throw new InvalidPaymentRequestError('Allocation amount must be positive');
            }
            if (a.provider && !this.registry.has(a.provider)) {
                throw new InvalidPaymentRequestError(
                    `Unknown provider '${a.provider}'. Registered providers: ${this.registry
                        .names()
                        .join(', ')}`,
                );
            }
        }

        const payment = Payment.initiate({
            orderId: order.id,
            customerId: order.customerId,
            idempotencyKey: command.idempotencyKey,
            totalCents: order.totalCents,
        });
        await this.tx.run(async () => {
            order.markProcessing();
            await this.orders.save(order);
            await this.payments.save(payment);
            await this.events.publishFromAggregate(payment);
        });

        const successes: SuccessfulCharge[] = [];
        let failureReason: string | null = null;
        const chain = this.getFallbackChain();

        for (let i = 0; i < allocations.length; i++) {
            const allocation = allocations[i];
            const candidates = allocation.provider ? [allocation.provider] : chain;
            const outcome = await this.tryAllocation(payment, allocation, candidates, i);
            if (outcome.ok) {
                successes.push({
                    provider: outcome.provider,
                    amountCents: allocation.amountCents,
                    externalRef: outcome.externalRef,
                });
            } else {
                failureReason = `allocation ${i} (${allocation.amountCents}c) exhausted providers [${candidates.join(',')}]`;
                break;
            }
        }

        const allSucceeded = !failureReason && payment.succeededAmountCents === payment.totalCents;

        if (allSucceeded) {
            await this.tx.run(async () => {
                payment.markSucceeded();
                await this.payments.save(payment);
                await this.events.publishFromAggregate(payment);
            });
            this.logger.log(
                `payment ${payment.id} succeeded for order ${order.id} (${payment.totalCents}c)`,
            );
            return toPaymentDto(payment);
        }

        await this.tx.run(async () => {
            await this.compensate(successes, payment.id, payment.customerId);
            payment.markFailed(failureReason ?? 'partial payment');
            await this.payments.save(payment);
            await this.events.publishFromAggregate(payment);
        });
        this.logger.warn(`payment ${payment.id} failed for order ${order.id}: ${failureReason}`);
        return toPaymentDto(payment);
    }

    private async tryAllocation(
        payment: Payment,
        allocation: PayOrderAllocationInput,
        candidates: ProviderName[],
        index: number,
    ): Promise<{ ok: true; provider: ProviderName; externalRef: string } | { ok: false }> {
        for (const name of candidates) {
            if (!this.registry.has(name)) {
                this.logger.warn(`skipping unknown provider '${name}'`);
                continue;
            }
            const provider: PaymentProvider = this.registry.get(name);
            const idempotencyKey = `${payment.id}:${index}:${name}`;

            let result: ChargeResult | undefined;
            await this.tx.run(async () => {
                result = await provider.charge({
                    customerId: payment.customerId,
                    orderId: payment.orderId,
                    amountCents: allocation.amountCents,
                    idempotencyKey,
                });
                if (result.ok) {
                    payment.recordSuccessfulAttempt(
                        name,
                        allocation.amountCents,
                        result.externalRef,
                    );
                } else {
                    payment.recordFailedAttempt(
                        name,
                        allocation.amountCents,
                        result.reason,
                        result.message,
                    );
                }
                await this.payments.save(payment);
            });

            if (result && result.ok) {
                return { ok: true, provider: name, externalRef: result.externalRef };
            }

            this.logger.warn(
                `provider '${name}' failed for payment ${payment.id} alloc ${index}: ${
                    result ? result.reason : 'unknown'
                }`,
            );
            if (result && !result.retryable && candidates.length > 1) {
                this.logger.warn(
                    `non-retryable failure on '${name}', continuing fallback chain anyway`,
                );
            }
        }
        return { ok: false };
    }

    private async compensate(
        successes: SuccessfulCharge[],
        paymentId: string,
        customerId: string,
    ): Promise<void> {
        for (const s of successes) {
            const provider = this.registry.get(s.provider);
            if (!provider.refund) continue;
            try {
                await provider.refund({
                    customerId,
                    amountCents: s.amountCents,
                    externalRef: s.externalRef,
                    idempotencyKey: `refund:${paymentId}:${s.provider}:${s.externalRef}`,
                });
                this.logger.log(
                    `refunded ${s.amountCents}c via ${s.provider} (ref ${s.externalRef})`,
                );
            } catch (err) {
                this.logger.error(
                    `refund failed via ${s.provider} for payment ${paymentId}: ${
                        (err as Error).message
                    }`,
                );
            }
        }
    }

    private getFallbackChain(): ProviderName[] {
        const raw = this.config.get<string>('PAYMENT_PROVIDER_CHAIN', 'wallet,stripe,paypal');
        return raw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
}
