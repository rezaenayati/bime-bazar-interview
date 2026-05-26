import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    AttemptStatus,
    ChargeFailureReason,
    Payment,
    PaymentRepository,
} from '@bime-bazar/payment/domain';
import { currentTxManager } from '@bime-bazar/shared/infra';
import { PaymentOrmEntity } from './payment.orm-entity';
import { PaymentAttemptOrmEntity } from './payment-attempt.orm-entity';

@Injectable()
export class TypeOrmPaymentRepository implements PaymentRepository {
    constructor(
        @InjectRepository(PaymentOrmEntity)
        private readonly repo: Repository<PaymentOrmEntity>,
    ) {}

    private scoped(): Repository<PaymentOrmEntity> {
        const manager = currentTxManager();
        return manager ? manager.getRepository(PaymentOrmEntity) : this.repo;
    }

    async save(payment: Payment): Promise<void> {
        const row: PaymentOrmEntity = {
            id: payment.id,
            orderId: payment.orderId,
            customerId: payment.customerId,
            idempotencyKey: payment.idempotencyKey,
            totalCents: payment.totalCents.toString(),
            status: payment.status,
            createdAt: payment.createdAt,
            attempts: payment.attempts.map((a) => {
                const row = new PaymentAttemptOrmEntity();
                row.id = a.props.id;
                row.paymentId = payment.id;
                row.provider = a.props.provider;
                row.amountCents = a.props.amountCents.toString();
                row.status = a.props.status;
                row.externalRef = a.props.externalRef ?? null;
                row.failureReason = a.props.failureReason ?? null;
                row.message = a.props.message ?? null;
                row.createdAt = a.props.createdAt;
                return row;
            }),
        };
        await this.scoped().save(row);
    }

    async findById(id: string): Promise<Payment | null> {
        const row = await this.scoped().findOne({
            where: { id },
            relations: { attempts: true },
        });
        return row ? this.toDomain(row) : null;
    }

    async findByIdempotencyKey(key: string): Promise<Payment | null> {
        const row = await this.scoped().findOne({
            where: { idempotencyKey: key },
            relations: { attempts: true },
        });
        return row ? this.toDomain(row) : null;
    }

    private toDomain(row: PaymentOrmEntity): Payment {
        return Payment.rehydrate({
            id: row.id,
            orderId: row.orderId,
            customerId: row.customerId,
            idempotencyKey: row.idempotencyKey,
            totalCents: Number(row.totalCents),
            status: row.status,
            createdAt: row.createdAt,
            attempts: row.attempts.map((a) => ({
                id: a.id,
                provider: a.provider,
                amountCents: Number(a.amountCents),
                status: a.status as AttemptStatus,
                externalRef: a.externalRef ?? undefined,
                failureReason: (a.failureReason ?? undefined) as ChargeFailureReason | undefined,
                message: a.message ?? undefined,
                createdAt: a.createdAt,
            })),
        });
    }
}
