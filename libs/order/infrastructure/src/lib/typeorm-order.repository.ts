import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderNotFoundError, OrderRepository } from '@bime-bazar/order/domain';
import { currentTxManager } from '@bime-bazar/shared/infra';
import { OrderOrmEntity } from './order.orm-entity';

@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
    constructor(
        @InjectRepository(OrderOrmEntity)
        private readonly repo: Repository<OrderOrmEntity>,
    ) {}

    private scoped(): Repository<OrderOrmEntity> {
        const manager = currentTxManager();
        return manager ? manager.getRepository(OrderOrmEntity) : this.repo;
    }

    async save(order: Order): Promise<void> {
        const repo = this.scoped();
        const existing = await repo.findOne({
            where: { id: order.id },
            select: { id: true },
            relations: {},
        });

        if (!existing) {
            const row = repo.create({
                id: order.id,
                customerId: order.customerId,
                status: order.status,
                createdAt: order.createdAt,
                items: order.items.map((item) => ({
                    orderId: order.id,
                    productId: item.productId,
                    productName: item.productName,
                    unitPriceCents: item.unitPriceCents.toString(),
                    quantity: item.quantity,
                })),
            });
            await repo.save(row);
            return;
        }

        await repo.update({ id: order.id }, { status: order.status });
    }

    async findById(id: string): Promise<Order | null> {
        const row = await this.scoped().findOne({
            where: { id },
            relations: { items: true },
        });
        return row ? this.toDomain(row) : null;
    }

    async findByIdOrFail(id: string): Promise<Order> {
        const found = await this.findById(id);
        if (!found) throw new OrderNotFoundError(id);
        return found;
    }

    async findByCustomerId(customerId: string): Promise<Order[]> {
        const rows = await this.scoped().find({
            where: { customerId },
            relations: { items: true },
            order: { createdAt: 'DESC' },
        });
        return rows.map((r) => this.toDomain(r));
    }

    private toDomain(row: OrderOrmEntity): Order {
        return Order.rehydrate({
            id: row.id,
            customerId: row.customerId,
            status: row.status,
            createdAt: row.createdAt,
            items: row.items.map((i) => ({
                productId: i.productId,
                productName: i.productName,
                unitPriceCents: Number(i.unitPriceCents),
                quantity: i.quantity,
            })),
        });
    }
}
