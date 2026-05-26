import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CustomerOrmEntity } from '@bime-bazar/customer/infrastructure';
import { ProductOrmEntity } from '@bime-bazar/product/infrastructure';
import { OrderOrmEntity, OrderItemOrmEntity } from '@bime-bazar/order/infrastructure';
import { PaymentOrmEntity, PaymentAttemptOrmEntity } from '@bime-bazar/payment/infrastructure';
import { OutboxOrmEntity } from '@bime-bazar/shared/infra';

import { config as dotenv } from 'dotenv';
dotenv();

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env['DATABASE_HOST'] ?? 'localhost',
    port: Number(process.env['DATABASE_PORT'] ?? '5432'),
    username: process.env['DATABASE_USER'] ?? 'bime',
    password: process.env['DATABASE_PASSWORD'] ?? 'bime',
    database: process.env['DATABASE_NAME'] ?? 'bime_bazar',
    entities: [
        CustomerOrmEntity,
        ProductOrmEntity,
        OrderOrmEntity,
        OrderItemOrmEntity,
        PaymentOrmEntity,
        PaymentAttemptOrmEntity,
        OutboxOrmEntity,
    ],
    migrations: [__dirname + '/migrations/*.{ts,js}'],
    synchronize: false,
    logging: process.env['DATABASE_LOGGING'] === 'true',
});
