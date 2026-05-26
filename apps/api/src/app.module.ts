import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedInfraModule, LoggerModule, OutboxOrmEntity } from '@bime-bazar/shared/infra';
import { CustomerInfrastructureModule } from '@bime-bazar/customer/infrastructure';
import { ProductInfrastructureModule } from '@bime-bazar/product/infrastructure';
import { OrderInfrastructureModule } from '@bime-bazar/order/infrastructure';
import { PaymentInfrastructureModule } from '@bime-bazar/payment/infrastructure';
import { CustomerOrmEntity } from '@bime-bazar/customer/infrastructure';
import { ProductOrmEntity } from '@bime-bazar/product/infrastructure';
import { OrderOrmEntity, OrderItemOrmEntity } from '@bime-bazar/order/infrastructure';
import { PaymentOrmEntity, PaymentAttemptOrmEntity } from '@bime-bazar/payment/infrastructure';
import { DomainEventBootstrap } from './domain-event-bootstrap';

import { CustomerController } from './controllers/customer.controller';
import { ProductController } from './controllers/product.controller';
import { OrderController } from './controllers/order.controller';
import { PaymentController } from './controllers/payment.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule,
        SharedInfraModule,
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (cfg: ConfigService) => ({
                type: 'postgres',
                host: cfg.get<string>('DATABASE_HOST', 'localhost'),
                port: Number(cfg.get<string>('DATABASE_PORT', '5432')),
                username: cfg.get<string>('DATABASE_USER', 'bime'),
                password: cfg.get<string>('DATABASE_PASSWORD', 'bime'),
                database: cfg.get<string>('DATABASE_NAME', 'bime_bazar'),
                entities: [
                    CustomerOrmEntity,
                    ProductOrmEntity,
                    OrderOrmEntity,
                    OrderItemOrmEntity,
                    PaymentOrmEntity,
                    PaymentAttemptOrmEntity,
                    OutboxOrmEntity,
                ],
                synchronize: false,
                logging: cfg.get<string>('DATABASE_LOGGING') === 'true',
            }),
        }),
        CustomerInfrastructureModule,
        ProductInfrastructureModule,
        OrderInfrastructureModule,
        PaymentInfrastructureModule,
    ],
    controllers: [CustomerController, ProductController, OrderController, PaymentController],
    providers: [DomainEventBootstrap],
})
export class AppModule {}
