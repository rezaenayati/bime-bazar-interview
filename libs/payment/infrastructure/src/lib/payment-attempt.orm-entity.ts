import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { PaymentOrmEntity } from './payment.orm-entity';

@Entity({ name: 'payment_attempts' })
export class PaymentAttemptOrmEntity {
    @PrimaryColumn('uuid')
    id!: string;

    @ManyToOne(() => PaymentOrmEntity, (p) => p.attempts, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'payment_id' })
    payment!: PaymentOrmEntity;

    @Column({ type: 'uuid', name: 'payment_id' })
    paymentId!: string;

    @Column({ type: 'varchar', length: 64 })
    provider!: string;

    @Column({ type: 'bigint', name: 'amount_cents' })
    amountCents!: string;

    @Column({ type: 'varchar', length: 32 })
    status!: 'succeeded' | 'failed';

    @Column({ type: 'varchar', length: 191, name: 'external_ref', nullable: true })
    externalRef!: string | null;

    @Column({ type: 'varchar', length: 64, name: 'failure_reason', nullable: true })
    failureReason!: string | null;

    @Column({ type: 'text', nullable: true })
    message!: string | null;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;
}
