import { Order, OrderAccessDeniedError, OrderRepository } from '@bime-bazar/order/domain';
import {
    ChargeInput,
    ChargeResult,
    InvalidPaymentRequestError,
    Payment,
    PaymentProvider,
    PaymentRepository,
    ProviderName,
} from '@bime-bazar/payment/domain';
import { DomainEventPublisher, TransactionRunner } from '@bime-bazar/shared/infra';
import { PayOrderCommand } from './pay-order.command';
import { PayOrderHandler } from './pay-order.handler';
import { PaymentProviderRegistry } from '../payment-provider.registry';

class InMemoryOrderRepo implements OrderRepository {
    private byId = new Map<string, Order>();
    seed(o: Order) {
        this.byId.set(o.id, o);
    }
    async save(o: Order) {
        this.byId.set(o.id, o);
    }
    async findById(id: string) {
        return this.byId.get(id) ?? null;
    }
    async findByIdOrFail(id: string) {
        const f = await this.findById(id);
        if (!f) throw new Error('not found');
        return f;
    }
    async findByCustomerId(customerId: string) {
        return [...this.byId.values()].filter((o) => o.customerId === customerId);
    }
}

class InMemoryPaymentRepo implements PaymentRepository {
    rows: Payment[] = [];
    async save(p: Payment) {
        const idx = this.rows.findIndex((r) => r.id === p.id);
        if (idx >= 0) this.rows[idx] = p;
        else this.rows.push(p);
    }
    async findById(id: string) {
        return this.rows.find((p) => p.id === id) ?? null;
    }
    async findByIdempotencyKey(key: string) {
        return this.rows.find((p) => p.idempotencyKey === key) ?? null;
    }
}

class ScriptedProvider implements PaymentProvider {
    public charges: ChargeInput[] = [];
    public refunds: number[] = [];
    constructor(
        public readonly name: ProviderName,
        private readonly script: ChargeResult[],
    ) {}
    async charge(input: ChargeInput): Promise<ChargeResult> {
        this.charges.push(input);
        const result = this.script.shift();
        if (!result) throw new Error(`${this.name}: no more scripted results`);
        return result;
    }
    async refund() {
        this.refunds.push(1);
        return { ok: true };
    }
}

function makeOrder(totalCents = 5000): Order {
    return Order.create({
        customerId: 'c1',
        items: [
            { productId: 'p1', productName: 'Widget', unitPriceCents: totalCents, quantity: 1 },
        ],
    });
}

function makeHandler(opts: { order: Order; providers: ScriptedProvider[]; chain?: string }) {
    const orderRepo = new InMemoryOrderRepo();
    orderRepo.seed(opts.order);
    const paymentRepo = new InMemoryPaymentRepo();
    const registry = new PaymentProviderRegistry(opts.providers as PaymentProvider[]);
    const publisher = { publishFromAggregate: jest.fn() } as unknown as DomainEventPublisher;
    const config = {
        get: (key: string, def?: string) =>
            key === 'PAYMENT_PROVIDER_CHAIN' ? (opts.chain ?? def ?? '') : def,
    } as unknown as { get: (k: string, d?: string) => string };
    // In-memory transaction runner: just runs the callback. The real one wraps
    // a TypeORM DataSource.transaction() and propagates the EntityManager via
    // AsyncLocalStorage; that machinery is irrelevant for the orchestration
    // logic exercised here.
    const tx = {
        run: async <T>(fn: () => Promise<T>): Promise<T> => fn(),
    } as TransactionRunner;
    const handler = new PayOrderHandler(
        orderRepo,
        paymentRepo,
        registry,
        publisher,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config as any,
        tx,
    );
    return { handler, orderRepo, paymentRepo, publisher };
}

describe('PayOrderHandler', () => {
    it('succeeds when first provider charges the full allocation', async () => {
        const order = makeOrder(5000);
        const wallet = new ScriptedProvider('wallet', [{ ok: true, externalRef: 'w1' }]);
        const stripe = new ScriptedProvider('stripe', []);
        const { handler, paymentRepo } = makeHandler({
            order,
            providers: [wallet, stripe],
            chain: 'wallet,stripe',
        });

        const result = await handler.execute(
            new PayOrderCommand(order.id, 'c1', [{ amountCents: 5000 }], 'idem-1'),
        );

        expect(result.status).toBe('succeeded');
        expect(wallet.charges).toHaveLength(1);
        expect(stripe.charges).toHaveLength(0);
        expect(paymentRepo.rows[0]?.status).toBe('succeeded');
    });

    it('falls back to next provider when first one fails', async () => {
        const order = makeOrder(5000);
        const wallet = new ScriptedProvider('wallet', [
            { ok: false, reason: 'insufficient_funds', retryable: false },
        ]);
        const stripe = new ScriptedProvider('stripe', [{ ok: true, externalRef: 's1' }]);
        const { handler, paymentRepo } = makeHandler({
            order,
            providers: [wallet, stripe],
            chain: 'wallet,stripe',
        });

        const result = await handler.execute(
            new PayOrderCommand(order.id, 'c1', [{ amountCents: 5000 }], 'idem-2'),
        );

        expect(result.status).toBe('succeeded');
        expect(result.attempts).toHaveLength(2);
        expect(result.attempts[0]).toMatchObject({ provider: 'wallet', status: 'failed' });
        expect(result.attempts[1]).toMatchObject({ provider: 'stripe', status: 'succeeded' });
        expect(paymentRepo.rows[0]?.status).toBe('succeeded');
    });

    it('split payment: wallet covers part, stripe covers the rest', async () => {
        const order = makeOrder(5000);
        const wallet = new ScriptedProvider('wallet', [{ ok: true, externalRef: 'w1' }]);
        const stripe = new ScriptedProvider('stripe', [{ ok: true, externalRef: 's1' }]);
        const { handler } = makeHandler({ order, providers: [wallet, stripe] });

        const result = await handler.execute(
            new PayOrderCommand(
                order.id,
                'c1',
                [
                    { provider: 'wallet', amountCents: 2000 },
                    { provider: 'stripe', amountCents: 3000 },
                ],
                'idem-split',
            ),
        );

        expect(result.status).toBe('succeeded');
        expect(wallet.charges[0]?.amountCents).toBe(2000);
        expect(stripe.charges[0]?.amountCents).toBe(3000);
    });

    it('idempotent replay returns the same payment without re-charging', async () => {
        const order = makeOrder(5000);
        const wallet = new ScriptedProvider('wallet', [{ ok: true, externalRef: 'w1' }]);
        const { handler } = makeHandler({
            order,
            providers: [wallet],
            chain: 'wallet',
        });

        const first = await handler.execute(
            new PayOrderCommand(order.id, 'c1', [{ amountCents: 5000 }], 'idem-key'),
        );
        const second = await handler.execute(
            new PayOrderCommand(order.id, 'c1', [{ amountCents: 5000 }], 'idem-key'),
        );

        expect(second.id).toBe(first.id);
        expect(wallet.charges).toHaveLength(1);
    });

    it('marks payment failed and refunds wallet when later provider exhausts chain', async () => {
        const order = makeOrder(5000);
        const wallet = new ScriptedProvider('wallet', [{ ok: true, externalRef: 'w1' }]);
        const stripe = new ScriptedProvider('stripe', [
            { ok: false, reason: 'provider_error', retryable: true },
        ]);
        const paypal = new ScriptedProvider('paypal', [
            { ok: false, reason: 'timeout', retryable: true },
        ]);
        const { handler, paymentRepo } = makeHandler({
            order,
            providers: [wallet, stripe, paypal],
            chain: 'stripe,paypal',
        });

        const result = await handler.execute(
            new PayOrderCommand(
                order.id,
                'c1',
                [{ provider: 'wallet', amountCents: 2000 }, { amountCents: 3000 }],
                'idem-failed',
            ),
        );

        expect(result.status).toBe('failed');
        expect(wallet.refunds).toHaveLength(1); // compensation kicked in
        expect(paymentRepo.rows[0]?.status).toBe('failed');
    });

    it('rejects allocations whose sum does not equal order total', async () => {
        const order = makeOrder(5000);
        const wallet = new ScriptedProvider('wallet', []);
        const { handler } = makeHandler({ order, providers: [wallet] });

        await expect(
            handler.execute(
                new PayOrderCommand(
                    order.id,
                    'c1',
                    [{ provider: 'wallet', amountCents: 1234 }],
                    'idem-bad',
                ),
            ),
        ).rejects.toThrow(/match order total/);
    });

    it('rejects unknown provider name with a 400 that lists the registered providers', async () => {
        // The DTO no longer hard-codes the provider list (no @IsIn). Instead the
        // handler asks the live registry. This test pins that the check runs and
        // that the error message tells the caller which names *are* valid.
        const order = makeOrder(5000);
        const wallet = new ScriptedProvider('wallet', []);
        const { handler, paymentRepo } = makeHandler({
            order,
            providers: [wallet],
            chain: 'wallet',
        });

        await expect(
            handler.execute(
                new PayOrderCommand(
                    order.id,
                    'c1',
                    [{ provider: 'crypto', amountCents: 5000 }],
                    'idem-unknown-provider',
                ),
            ),
        ).rejects.toThrow(InvalidPaymentRequestError);

        await expect(
            handler.execute(
                new PayOrderCommand(
                    order.id,
                    'c1',
                    [{ provider: 'crypto', amountCents: 5000 }],
                    'idem-unknown-provider-2',
                ),
            ),
        ).rejects.toThrow(/Registered providers: wallet/);

        // Nothing should have been claimed/persisted — the check runs before the
        // claim transaction.
        expect(paymentRepo.rows).toHaveLength(0);
        expect(wallet.charges).toHaveLength(0);
    });

    it("rejects when a different customer tries to pay someone else's order", async () => {
        const order = makeOrder(5000); // belongs to customer 'c1'
        const wallet = new ScriptedProvider('wallet', [{ ok: true, externalRef: 'w1' }]);
        const { handler } = makeHandler({
            order,
            providers: [wallet],
            chain: 'wallet',
        });

        // Pins both the error type (so the global filter maps it to 403) and
        // the message — guards against a future refactor accidentally downgrading
        // this to a generic 400.
        await expect(
            handler.execute(
                // c2 tries to pay c1's order, with a fresh idempotency key
                new PayOrderCommand(
                    order.id,
                    'c2',
                    [{ amountCents: 5000 }],
                    'idem-cross-customer',
                ),
            ),
        ).rejects.toThrow(OrderAccessDeniedError);

        expect(wallet.charges).toHaveLength(0);
    });

    it('rejects when an idempotency key is reused with different customer or order', async () => {
        const order = makeOrder(5000);
        const wallet = new ScriptedProvider('wallet', [{ ok: true, externalRef: 'w1' }]);
        const { handler } = makeHandler({
            order,
            providers: [wallet],
            chain: 'wallet',
        });

        // c1 makes a successful payment with key 'shared-key'
        await handler.execute(
            new PayOrderCommand(order.id, 'c1', [{ amountCents: 5000 }], 'shared-key'),
        );

        // c2 reuses the same key. Even though they're targeting a different order id,
        // the lookup hits c1's record. The handler must NOT leak it.
        await expect(
            handler.execute(
                new PayOrderCommand('other-order-id', 'c2', [{ amountCents: 5000 }], 'shared-key'),
            ),
        ).rejects.toThrow(/previously used with different request parameters/);
    });
});
