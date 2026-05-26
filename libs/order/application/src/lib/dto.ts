import { OrderStatus } from '@bime-bazar/order/domain';

export interface OrderItemDto {
    productId: string;
    productName: string;
    unitPriceCents: number;
    quantity: number;
    subtotalCents: number;
}

export interface OrderDto {
    id: string;
    customerId: string;
    status: OrderStatus;
    items: OrderItemDto[];
    totalCents: number;
    createdAt: string;
}
