import { Inject, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ORDER_REPOSITORY, OrderRepository } from '@bime-bazar/order/domain';
import { PaymentSucceededEvent } from '@bime-bazar/payment/domain';

@EventsHandler(PaymentSucceededEvent)
export class PaymentSucceededOrderHandler implements IEventHandler<PaymentSucceededEvent> {
    private readonly logger = new Logger(PaymentSucceededOrderHandler.name);

    constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

    async handle(event: PaymentSucceededEvent): Promise<void> {
        const order = await this.orders.findById(event.orderId);
        if (!order) {
            this.logger.warn(`PaymentSucceeded for unknown order ${event.orderId}`);
            return;
        }
        order.markPaid();
        await this.orders.save(order);
        this.logger.log(`order ${order.id} marked paid (payment ${event.paymentId})`);
    }
}
