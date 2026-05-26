import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'domain_events_outbox' })
export class OutboxOrmEntity {
    @PrimaryColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 128, name: 'event_name' })
    eventName!: string;

    @Column({ type: 'jsonb' })
    payload!: Record<string, unknown>;

    @Column({ type: 'timestamptz', name: 'occurred_at' })
    occurredAt!: Date;

    @Column({ type: 'timestamptz', name: 'processed_at', nullable: true })
    processedAt!: Date | null;

    @Column({ type: 'int', name: 'attempt_count', default: 0 })
    attemptCount!: number;

    @Column({ type: 'text', name: 'last_error', nullable: true })
    lastError!: string | null;
}
