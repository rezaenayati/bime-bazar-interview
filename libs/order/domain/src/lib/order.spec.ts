import { Order } from './order';
import { InvalidOrderError, OrderNotPayableError } from './errors';
import { OrderCreatedEvent } from './events';

const items = [
    { productId: 'p1', productName: 'Widget', unitPriceCents: 1000, quantity: 2 },
    { productId: 'p2', productName: 'Gizmo', unitPriceCents: 500, quantity: 3 },
];

describe('Order', () => {
    it('creates with status=pending and emits OrderCreatedEvent', () => {
        const order = Order.create({ customerId: 'c1', items });
        expect(order.status).toBe('pending');
        expect(order.totalCents).toBe(1000 * 2 + 500 * 3);
        const events = order.pullDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(OrderCreatedEvent);
    });

    it('rejects empty item list', () => {
        expect(() => Order.create({ customerId: 'c1', items: [] })).toThrow(InvalidOrderError);
    });

    it('transitions pending -> processing -> paid', () => {
        const order = Order.create({ customerId: 'c1', items });
        order.markProcessing();
        expect(order.status).toBe('processing');
        order.markPaid();
        expect(order.status).toBe('paid');
    });

    it('cannot mark processing twice', () => {
        const order = Order.create({ customerId: 'c1', items });
        order.markProcessing();
        expect(() => order.markProcessing()).toThrow(OrderNotPayableError);
    });

    it('rejects markPaid directly from pending (must go through processing first)', () => {
        const order = Order.create({ customerId: 'c1', items });
        expect(order.status).toBe('pending');
        expect(() => order.markPaid()).toThrow(OrderNotPayableError);
        expect(order.status).toBe('pending'); // state unchanged on rejection
    });

    it('rejects markPaid from failed', () => {
        const order = Order.create({ customerId: 'c1', items });
        order.markProcessing();
        order.markFailed();
        expect(() => order.markPaid()).toThrow(OrderNotPayableError);
        expect(order.status).toBe('failed');
    });

    it('markPaid is idempotent', () => {
        const order = Order.create({ customerId: 'c1', items });
        order.markProcessing();
        order.markPaid();
        expect(() => order.markPaid()).not.toThrow();
    });

    it('cannot mark failed after paid', () => {
        const order = Order.create({ customerId: 'c1', items });
        order.markProcessing();
        order.markPaid();
        expect(() => order.markFailed()).toThrow(OrderNotPayableError);
    });
});
