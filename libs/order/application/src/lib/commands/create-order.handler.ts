import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CUSTOMER_REPOSITORY, CustomerRepository } from '@bime-bazar/customer/domain';
import { Order, ORDER_REPOSITORY, OrderRepository } from '@bime-bazar/order/domain';
import {
    PRODUCT_REPOSITORY,
    ProductNotFoundError,
    ProductRepository,
} from '@bime-bazar/product/domain';
import { DomainEventPublisher, TransactionRunner } from '@bime-bazar/shared/infra';
import { CreateOrderCommand } from './create-order.command';
import { OrderDto } from '../dto';
import { toOrderDto } from '../order-mapper';

@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand, OrderDto> {
    private readonly logger = new Logger(CreateOrderHandler.name);

    constructor(
        @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
        @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
        @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
        private readonly events: DomainEventPublisher,
        private readonly tx: TransactionRunner,
    ) {}

    async execute(command: CreateOrderCommand): Promise<OrderDto> {
        await this.customers.findByIdOrFail(command.customerId);

        const productIds = command.items.map((i) => i.productId);
        const products = await this.products.findByIds(productIds);
        const productMap = new Map(products.map((p) => [p.id, p]));

        const items = command.items.map((line) => {
            const product = productMap.get(line.productId);
            if (!product) throw new ProductNotFoundError(line.productId);
            return {
                productId: product.id,
                productName: product.name,
                unitPriceCents: product.priceCents,
                quantity: line.quantity,
            };
        });

        const order = await this.tx.run(async () => {
            const o = Order.create({ customerId: command.customerId, items });
            await this.orders.save(o);
            await this.events.publishFromAggregate(o);
            return o;
        });

        this.logger.log(
            `order.created id=${order.id} customer=${order.customerId} total=${order.totalCents}`,
        );
        return toOrderDto(order);
    }
}
