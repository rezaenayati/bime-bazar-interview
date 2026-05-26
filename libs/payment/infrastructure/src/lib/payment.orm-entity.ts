import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { PaymentAttemptOrmEntity } from './payment-attempt.orm-entity';

@Entity({ name: 'payments' })
export class PaymentOrmEntity {
    @PrimaryColumn('uuid')
    id!: string;

    @Column({ type: 'uuid', name: 'order_id' })
    orderId!: string;

    @Column({ type: 'uuid', name: 'customer_id' })
    customerId!: string;

    @Index('uq_payments_idempotency_key', { unique: true })
    @Column({ type: 'varchar', length: 191, name: 'idempotency_key' })
    idempotencyKey!: string;

    @Column({ type: 'bigint', name: 'total_cents' })
    totalCents!: string;

    @Column({ type: 'varchar', length: 32 })
    status!: 'initiated' | 'succeeded' | 'failed';

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;

    @OneToMany(() => PaymentAttemptOrmEntity, (a) => a.payment, {
        cascade: ['insert', 'update'],
        eager: true,
    })
    attempts!: PaymentAttemptOrmEntity[];
}
