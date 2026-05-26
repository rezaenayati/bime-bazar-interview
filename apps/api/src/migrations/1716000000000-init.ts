import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1716000000000 implements MigrationInterface {
    name = 'Init1716000000000';

    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            CREATE TABLE customers (
                id              UUID PRIMARY KEY,
                email           VARCHAR(255) NOT NULL UNIQUE,
                wallet_balance_cents BIGINT NOT NULL DEFAULT 0
            )
        `);
        await qr.query(`
            CREATE TABLE products (
                id          UUID PRIMARY KEY,
                name        VARCHAR(255) NOT NULL,
                price_cents BIGINT NOT NULL
            )
        `);
        await qr.query(`
            CREATE TABLE orders (
                id          UUID PRIMARY KEY,
                customer_id UUID NOT NULL REFERENCES customers(id),
                status      VARCHAR(32) NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await qr.query(`CREATE INDEX ix_orders_customer_id ON orders(customer_id)`);

        await qr.query(`
            CREATE TABLE order_items (
                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                product_id       UUID NOT NULL,
                product_name     VARCHAR(255) NOT NULL,
                unit_price_cents BIGINT NOT NULL,
                quantity         INT NOT NULL
            )
        `);
        await qr.query(`CREATE INDEX ix_order_items_order_id ON order_items(order_id)`);

        await qr.query(`
            CREATE TABLE payments (
                id              UUID PRIMARY KEY,
                order_id        UUID NOT NULL REFERENCES orders(id),
                customer_id     UUID NOT NULL REFERENCES customers(id),
                idempotency_key VARCHAR(191) NOT NULL,
                total_cents     BIGINT NOT NULL,
                status          VARCHAR(32) NOT NULL,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_payments_idempotency_key UNIQUE (idempotency_key)
            )
        `);
        await qr.query(`CREATE INDEX ix_payments_order_id ON payments(order_id)`);

        await qr.query(`
            CREATE TABLE payment_attempts (
                id              UUID PRIMARY KEY,
                payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
                provider        VARCHAR(64) NOT NULL,
                amount_cents    BIGINT NOT NULL,
                status          VARCHAR(32) NOT NULL,
                external_ref    VARCHAR(191),
                failure_reason  VARCHAR(64),
                message         TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await qr.query(
            `CREATE INDEX ix_payment_attempts_payment_id ON payment_attempts(payment_id)`,
        );
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`DROP TABLE IF EXISTS payment_attempts`);
        await qr.query(`DROP TABLE IF EXISTS payments`);
        await qr.query(`DROP TABLE IF EXISTS order_items`);
        await qr.query(`DROP TABLE IF EXISTS orders`);
        await qr.query(`DROP TABLE IF EXISTS products`);
        await qr.query(`DROP TABLE IF EXISTS customers`);
    }
}
