import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateOrderHandler } from './commands/create-order.handler';
import { GetMyOrdersHandler } from './queries/get-my-orders.handler';
import { GetOrderHandler } from './queries/get-order.handler';
import { PaymentSucceededOrderHandler } from './events/payment-succeeded.handler';
import { PaymentFailedOrderHandler } from './events/payment-failed.handler';

export const ORDER_HANDLERS = [
    CreateOrderHandler,
    GetMyOrdersHandler,
    GetOrderHandler,
    PaymentSucceededOrderHandler,
    PaymentFailedOrderHandler,
];

@Module({
    imports: [CqrsModule],
    exports: [CqrsModule],
})
export class OrderApplicationModule {}
