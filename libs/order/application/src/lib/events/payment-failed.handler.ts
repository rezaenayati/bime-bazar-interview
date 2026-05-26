import { Inject, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ORDER_REPOSITORY, OrderRepository } from '@bime-bazar/order/domain';
import { PaymentFailedEvent } from '@bime-bazar/payment/domain';

@EventsHandler(PaymentFailedEvent)
export class PaymentFailedOrderHandler implements IEventHandler<PaymentFailedEvent> {
    private readonly logger = new Logger(PaymentFailedOrderHandler.name);

    constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

    async handle(event: PaymentFailedEvent): Promise<void> {
        const order = await this.orders.findById(event.orderId);
        if (!order) {
            this.logger.warn(`PaymentFailed for unknown order ${event.orderId}`);
            return;
        }
        if (order.status === 'paid') {
            this.logger.warn(`Ignoring PaymentFailed for order ${order.id} already in paid state`);
            return;
        }
        order.markFailed();
        await this.orders.save(order);
        this.logger.log(`order ${order.id} marked failed: ${event.reason}`);
    }
}
