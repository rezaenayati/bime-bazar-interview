import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DomainExceptionFilter } from '@bime-bazar/shared/infra';
import { CustomerOrmEntity } from '@bime-bazar/customer/infrastructure';
import { ProductOrmEntity } from '@bime-bazar/product/infrastructure';
import { OrderItemOrmEntity, OrderOrmEntity } from '@bime-bazar/order/infrastructure';
import { PaymentAttemptOrmEntity, PaymentOrmEntity } from '@bime-bazar/payment/infrastructure';
import { OutboxOrmEntity } from '@bime-bazar/shared/infra';
import { AppModule } from '../src/app.module';

export const TEST_API_KEY = 'test-api-key';

const TEST_DB_NAME = process.env['TEST_DATABASE_NAME'] ?? 'bime_bazar_test';
const DB_HOST = process.env['DATABASE_HOST'] ?? 'localhost';
const DB_PORT = Number(process.env['DATABASE_PORT'] ?? '5434');
const DB_USER = process.env['DATABASE_USER'] ?? 'bime';
const DB_PASSWORD = process.env['DATABASE_PASSWORD'] ?? 'bime';

const ENTITIES = [
    CustomerOrmEntity,
    ProductOrmEntity,
    OrderOrmEntity,
    OrderItemOrmEntity,
    PaymentOrmEntity,
    PaymentAttemptOrmEntity,
    OutboxOrmEntity,
];

const TABLES_IN_TRUNCATE_ORDER = [
    'payment_attempts',
    'payments',
    'order_items',
    'orders',
    'customers',
    'products',
    'domain_events_outbox',
];

async function ensureTestDatabase(): Promise<void> {
    const admin = new DataSource({
        type: 'postgres',
        host: DB_HOST,
        port: DB_PORT,
        username: DB_USER,
        password: DB_PASSWORD,
        database: 'postgres',
    });
    await admin.initialize();
    try {
        const existing = (await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [
            TEST_DB_NAME,
        ])) as Array<{ '?column?': number }>;
        if (existing.length === 0) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(TEST_DB_NAME)) {
                throw new Error(
                    `Refusing to CREATE DATABASE with suspicious name '${TEST_DB_NAME}'`,
                );
            }
            await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
        }
    } finally {
        await admin.destroy();
    }
}

async function runMigrations(): Promise<void> {
    const ds = new DataSource({
        type: 'postgres',
        host: DB_HOST,
        port: DB_PORT,
        username: DB_USER,
        password: DB_PASSWORD,
        database: TEST_DB_NAME,
        entities: ENTITIES,
        migrations: [`${__dirname}/../src/migrations/*.{ts,js}`],
    });
    await ds.initialize();
    try {
        await ds.runMigrations();
    } finally {
        await ds.destroy();
    }
}

export interface TestApp {
    app: INestApplication;
    httpServer: ReturnType<INestApplication['getHttpServer']>;
    ds: DataSource;
}

export async function bootstrapTestApp(): Promise<TestApp> {
    process.env['NODE_ENV'] = 'test';
    process.env['DATABASE_HOST'] = DB_HOST;
    process.env['DATABASE_PORT'] = String(DB_PORT);
    process.env['DATABASE_USER'] = DB_USER;
    process.env['DATABASE_PASSWORD'] = DB_PASSWORD;
    process.env['DATABASE_NAME'] = TEST_DB_NAME;
    process.env['DATABASE_LOGGING'] = 'false';
    process.env['API_KEYS'] = TEST_API_KEY;

    process.env['PAYMENT_PROVIDER_CHAIN'] = 'wallet';
    process.env['STRIPE_FAILURE_RATE'] = '0';
    process.env['PAYPAL_FAILURE_RATE'] = '0';

    process.env['OUTBOX_POLL_INTERVAL_MS'] = '50';
    process.env['OUTBOX_BATCH_SIZE'] = '50';

    await ensureTestDatabase();
    await runMigrations();

    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    const ds = app.get(DataSource);
    return { app, httpServer: app.getHttpServer(), ds };
}

export async function truncateAll(ds: DataSource): Promise<void> {
    await ds.query(
        `TRUNCATE TABLE ${TABLES_IN_TRUNCATE_ORDER.join(', ')} RESTART IDENTITY CASCADE`,
    );
}

export async function waitFor(
    predicate: () => Promise<boolean>,
    { timeoutMs = 2000, intervalMs = 25 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await predicate()) return;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
}
