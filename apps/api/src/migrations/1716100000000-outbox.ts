import { MigrationInterface, QueryRunner } from 'typeorm';

export class Outbox1716100000000 implements MigrationInterface {
    name = 'Outbox1716100000000';

    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            CREATE TABLE domain_events_outbox (
                id              UUID PRIMARY KEY,
                event_name      VARCHAR(128) NOT NULL,
                payload         JSONB NOT NULL,
                occurred_at     TIMESTAMPTZ NOT NULL,
                processed_at    TIMESTAMPTZ,
                attempt_count   INT NOT NULL DEFAULT 0,
                last_error      TEXT
            )
        `);
        await qr.query(
            `CREATE INDEX ix_outbox_unprocessed ON domain_events_outbox (occurred_at) WHERE processed_at IS NULL`,
        );
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`DROP TABLE IF EXISTS domain_events_outbox`);
    }
}
