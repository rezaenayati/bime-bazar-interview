import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PayOrderHandler } from './commands/pay-order.handler';
import { GetPaymentHandler } from './queries/get-payment.handler';

export const PAYMENT_HANDLERS = [PayOrderHandler, GetPaymentHandler];

@Module({
    imports: [CqrsModule],
    exports: [CqrsModule],
})
export class PaymentApplicationModule {}
