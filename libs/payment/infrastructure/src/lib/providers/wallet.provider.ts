import { Inject, Injectable, Logger } from '@nestjs/common';
import {
    CUSTOMER_REPOSITORY,
    CustomerNotFoundError,
    CustomerRepository,
    InsufficientFundsError,
} from '@bime-bazar/customer/domain';
import {
    ChargeInput,
    ChargeResult,
    PaymentProvider,
    RefundInput,
} from '@bime-bazar/payment/domain';

@Injectable()
export class WalletProvider implements PaymentProvider {
    readonly name = 'wallet';
    private readonly logger = new Logger(WalletProvider.name);

    constructor(
        @Inject(CUSTOMER_REPOSITORY)
        private readonly customers: CustomerRepository,
    ) {}

    async charge(input: ChargeInput): Promise<ChargeResult> {
        try {
            const customer = await this.customers.findByIdOrFail(input.customerId);
            customer.debit(input.amountCents);
            await this.customers.save(customer);
            const externalRef = `wallet:${input.idempotencyKey}`;
            this.logger.log(
                `wallet charged ${input.amountCents}c for customer ${input.customerId} -> ${externalRef}`,
            );
            return { ok: true, externalRef };
        } catch (err) {
            if (err instanceof InsufficientFundsError) {
                return {
                    ok: false,
                    reason: 'insufficient_funds',
                    retryable: false,
                    message: err.message,
                };
            }
            if (err instanceof CustomerNotFoundError) {
                return {
                    ok: false,
                    reason: 'provider_error',
                    retryable: false,
                    message: err.message,
                };
            }
            throw err;
        }
    }

    async refund(input: RefundInput): Promise<{ ok: boolean }> {
        const customer = await this.customers.findByIdOrFail(input.customerId);
        customer.refund(input.amountCents);
        await this.customers.save(customer);
        this.logger.log(
            `wallet refunded ${input.amountCents}c to customer ${input.customerId} (ref ${input.externalRef})`,
        );
        return { ok: true };
    }
}
