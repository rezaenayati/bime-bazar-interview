import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerInfrastructureModule } from '@bime-bazar/customer/infrastructure';
import { OrderInfrastructureModule } from '@bime-bazar/order/infrastructure';
import {
    PAYMENT_HANDLERS,
    PaymentApplicationModule,
    PaymentProviderRegistry,
} from '@bime-bazar/payment/application';
import { PAYMENT_PROVIDERS, PAYMENT_REPOSITORY } from '@bime-bazar/payment/domain';
import { PaymentOrmEntity } from './payment.orm-entity';
import { PaymentAttemptOrmEntity } from './payment-attempt.orm-entity';
import { TypeOrmPaymentRepository } from './typeorm-payment.repository';
import { WalletProvider } from './providers/wallet.provider';
import { StripeMockProvider } from './providers/stripe-mock.provider';
import { PayPalMockProvider } from './providers/paypal-mock.provider';

const BUILTIN_PROVIDERS = [WalletProvider, StripeMockProvider, PayPalMockProvider];

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([PaymentOrmEntity, PaymentAttemptOrmEntity]),
        CustomerInfrastructureModule,
        OrderInfrastructureModule,
        PaymentApplicationModule,
    ],
    providers: [
        ...BUILTIN_PROVIDERS,
        {
            provide: PAYMENT_PROVIDERS,
            useFactory: (...providers) => providers,
            inject: BUILTIN_PROVIDERS,
        },
        {
            provide: PAYMENT_REPOSITORY,
            useClass: TypeOrmPaymentRepository,
        },
        PaymentProviderRegistry,
        ...PAYMENT_HANDLERS,
    ],
    exports: [PAYMENT_PROVIDERS, PAYMENT_REPOSITORY, PaymentApplicationModule],
})
export class PaymentInfrastructureModule {}
