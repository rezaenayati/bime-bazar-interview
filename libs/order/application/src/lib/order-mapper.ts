import { Order } from '@bime-bazar/order/domain';
import { OrderDto } from './dto';

export function toOrderDto(order: Order): OrderDto {
    return {
        id: order.id,
        customerId: order.customerId,
        status: order.status,
        items: order.items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            unitPriceCents: i.unitPriceCents,
            quantity: i.quantity,
            subtotalCents: i.subtotalCents,
        })),
        totalCents: order.totalCents,
        createdAt: order.createdAt.toISOString(),
    };
}
