import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ORDER_REPOSITORY, OrderRepository } from '@bime-bazar/order/domain';
import { GetMyOrdersQuery } from './get-my-orders.query';
import { OrderDto } from '../dto';
import { toOrderDto } from '../order-mapper';

@QueryHandler(GetMyOrdersQuery)
export class GetMyOrdersHandler implements IQueryHandler<GetMyOrdersQuery, OrderDto[]> {
    constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

    async execute(query: GetMyOrdersQuery): Promise<OrderDto[]> {
        const list = await this.orders.findByCustomerId(query.customerId);
        return list.map(toOrderDto);
    }
}
