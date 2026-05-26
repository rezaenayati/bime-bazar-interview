import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@bime-bazar/shared/kernel';
import { OrderItem, OrderItemProps } from './order-item';
import { OrderStatus } from './order-status';
import { InvalidOrderError, OrderNotPayableError } from './errors';
import { OrderCreatedEvent } from './events';

export interface OrderProps {
    id: string;
    customerId: string;
    items: OrderItemProps[];
    status: OrderStatus;
    createdAt: Date;
}

export class Order extends AggregateRoot {
    private _status: OrderStatus;
    private readonly _items: OrderItem[];

    private constructor(
        id: string,
        public readonly customerId: string,
        items: OrderItem[],
        status: OrderStatus,
        public readonly createdAt: Date,
    ) {
        super(id);
        this._items = items;
        this._status = status;
    }

    static create(input: { customerId: string; items: OrderItemProps[] }): Order {
        if (input.items.length === 0) {
            throw new InvalidOrderError('Order must contain at least one item');
        }
        const items = input.items.map(
            (i) => new OrderItem(i.productId, i.productName, i.unitPriceCents, i.quantity),
        );
        const order = new Order(randomUUID(), input.customerId, items, 'pending', new Date());
        order.record(new OrderCreatedEvent(order.id, order.customerId, order.totalCents));
        return order;
    }

    static rehydrate(props: OrderProps): Order {
        const items = props.items.map(
            (i) => new OrderItem(i.productId, i.productName, i.unitPriceCents, i.quantity),
        );
        return new Order(props.id, props.customerId, items, props.status, props.createdAt);
    }

    get status(): OrderStatus {
        return this._status;
    }

    get items(): readonly OrderItem[] {
        return this._items;
    }

    get totalCents(): number {
        return this._items.reduce((sum, item) => sum + item.subtotalCents, 0);
    }

    markProcessing(): void {
        if (this._status !== 'pending') {
            throw new OrderNotPayableError(this._status);
        }
        this._status = 'processing';
    }

    markPaid(): void {
        if (this._status === 'paid') return;
        if (this._status !== 'processing') {
            throw new OrderNotPayableError(this._status);
        }
        this._status = 'paid';
    }

    markFailed(): void {
        if (this._status === 'paid') {
            throw new OrderNotPayableError(this._status);
        }
        this._status = 'failed';
    }
}
