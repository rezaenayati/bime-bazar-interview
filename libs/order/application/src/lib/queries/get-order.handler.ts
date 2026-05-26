import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
    ORDER_REPOSITORY,
    OrderAccessDeniedError,
    OrderNotFoundError,
    OrderRepository,
} from '@bime-bazar/order/domain';
import { GetOrderQuery } from './get-order.query';
import { OrderDto } from '../dto';
import { toOrderDto } from '../order-mapper';

@QueryHandler(GetOrderQuery)
export class GetOrderHandler implements IQueryHandler<GetOrderQuery, OrderDto> {
    constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

    async execute(query: GetOrderQuery): Promise<OrderDto> {
        const order = await this.orders.findById(query.orderId);
        if (!order) throw new OrderNotFoundError(query.orderId);
        if (order.customerId !== query.customerId) {
            throw new OrderAccessDeniedError(order.id, query.customerId);
        }
        return toOrderDto(order);
    }
}
