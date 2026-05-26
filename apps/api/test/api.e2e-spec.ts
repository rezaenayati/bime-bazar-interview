import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { bootstrapTestApp, truncateAll, waitFor, TEST_API_KEY } from './setup';

describe('API (e2e)', () => {
    let app: INestApplication;
    let httpServer: ReturnType<INestApplication['getHttpServer']>;
    let ds: DataSource;

    beforeAll(async () => {
        const ctx = await bootstrapTestApp();
        app = ctx.app;
        httpServer = ctx.httpServer;
        ds = ctx.ds;
    });

    afterAll(async () => {
        if (app) await app.close();
    });

    beforeEach(async () => {
        await truncateAll(ds);
    });

    // ─── helpers ──────────────────────────────────────────────────────────

    const auth = (customerId?: string) => {
        const headers: Record<string, string> = { 'X-Api-Key': TEST_API_KEY };
        if (customerId) headers['X-Customer-Id'] = customerId;
        return headers;
    };

    async function createCustomer(email = `u-${randomUUID()}@test.local`): Promise<{
        id: string;
        email: string;
        walletBalanceCents: number;
    }> {
        const res = await request(httpServer)
            .post('/customers')
            .set(auth())
            .send({ email })
            .expect(201);
        return res.body;
    }

    async function topUp(customerId: string, amountCents: number): Promise<void> {
        await request(httpServer)
            .post(`/customers/${customerId}/wallet/top-up`)
            .set(auth())
            .send({ amountCents })
            .expect(201);
    }

    async function createProduct(
        name = 'Widget',
        priceCents = 2500,
    ): Promise<{ id: string; name: string; priceCents: number }> {
        const res = await request(httpServer)
            .post('/products')
            .set(auth())
            .send({ name, priceCents })
            .expect(201);
        return res.body;
    }

    async function createOrder(
        customerId: string,
        items: Array<{ productId: string; quantity: number }>,
    ): Promise<{ id: string; status: string; totalCents: number }> {
        const res = await request(httpServer)
            .post('/orders')
            .set(auth(customerId))
            .send({ items })
            .expect(201);
        return res.body;
    }

    async function fetchOrder(
        customerId: string,
        orderId: string,
    ): Promise<{
        id: string;
        status: string;
        totalCents: number;
    }> {
        const res = await request(httpServer)
            .get(`/orders/${orderId}`)
            .set(auth(customerId))
            .expect(200);
        return res.body;
    }

    async function fetchCustomer(id: string): Promise<{
        id: string;
        email: string;
        walletBalanceCents: number;
    }> {
        const res = await request(httpServer).get(`/customers/${id}`).set(auth()).expect(200);
        return res.body;
    }

    // ─── auth ─────────────────────────────────────────────────────────────

    describe('authentication', () => {
        it('rejects requests with no X-Api-Key (401)', async () => {
            await request(httpServer).get('/products').expect(401);
        });

        it('rejects requests with a wrong X-Api-Key (401)', async () => {
            await request(httpServer).get('/products').set('X-Api-Key', 'wrong').expect(401);
        });

        it('rejects customer-scoped requests with no X-Customer-Id (401)', async () => {
            await request(httpServer)
                .post('/orders')
                .set('X-Api-Key', TEST_API_KEY)
                .send({ items: [] })
                .expect(401);
        });

        it('rejects customer-scoped requests with a non-UUID X-Customer-Id (400)', async () => {
            await request(httpServer)
                .post('/orders')
                .set({ 'X-Api-Key': TEST_API_KEY, 'X-Customer-Id': 'not-a-uuid' })
                .send({ items: [{ productId: randomUUID(), quantity: 1 }] })
                .expect(400);
        });
    });

    // ─── customers ────────────────────────────────────────────────────────

    describe('customers', () => {
        it('creates a customer and reads it back', async () => {
            const created = await createCustomer('alice@test.local');
            expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
            expect(created.email).toBe('alice@test.local');
            expect(created.walletBalanceCents).toBe(0);

            const fetched = await fetchCustomer(created.id);
            expect(fetched).toEqual(created);
        });

        it('tops up a wallet and reflects the new balance', async () => {
            const c = await createCustomer();
            await topUp(c.id, 7500);
            await topUp(c.id, 2500);
            const fresh = await fetchCustomer(c.id);
            expect(fresh.walletBalanceCents).toBe(10000);
        });

        it('returns 404 for an unknown customer', async () => {
            await request(httpServer).get(`/customers/${randomUUID()}`).set(auth()).expect(404);
        });

        it('rejects an invalid email with 400', async () => {
            await request(httpServer)
                .post('/customers')
                .set(auth())
                .send({ email: 'not-an-email' })
                .expect(400);
        });
    });

    // ─── products ─────────────────────────────────────────────────────────

    describe('products', () => {
        it('creates, lists, and fetches a product', async () => {
            const a = await createProduct('Widget', 1500);
            const b = await createProduct('Gadget', 3000);

            const list = await request(httpServer).get('/products').set(auth()).expect(200);
            const ids = (list.body as Array<{ id: string }>).map((p) => p.id);
            expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));

            const fetched = await request(httpServer)
                .get(`/products/${a.id}`)
                .set(auth())
                .expect(200);
            expect(fetched.body.name).toBe('Widget');
            expect(fetched.body.priceCents).toBe(1500);
        });

        it('rejects negative prices with 400', async () => {
            await request(httpServer)
                .post('/products')
                .set(auth())
                .send({ name: 'Bad', priceCents: -1 })
                .expect(400);
        });
    });

    // ─── orders ───────────────────────────────────────────────────────────

    describe('orders', () => {
        it('creates an order with status=pending and the right total', async () => {
            const customer = await createCustomer();
            const widget = await createProduct('Widget', 1500);
            const gadget = await createProduct('Gadget', 1000);

            const order = await createOrder(customer.id, [
                { productId: widget.id, quantity: 2 }, // 3000
                { productId: gadget.id, quantity: 1 }, // 1000
            ]);

            expect(order.status).toBe('pending');
            expect(order.totalCents).toBe(4000);
        });

        it('lists only the caller’s own orders', async () => {
            const alice = await createCustomer('alice@test.local');
            const bob = await createCustomer('bob@test.local');
            const product = await createProduct();
            await createOrder(alice.id, [{ productId: product.id, quantity: 1 }]);
            await createOrder(alice.id, [{ productId: product.id, quantity: 2 }]);
            await createOrder(bob.id, [{ productId: product.id, quantity: 1 }]);

            const aliceList = await request(httpServer)
                .get('/orders')
                .set(auth(alice.id))
                .expect(200);
            const bobList = await request(httpServer).get('/orders').set(auth(bob.id)).expect(200);
            expect((aliceList.body as unknown[]).length).toBe(2);
            expect((bobList.body as unknown[]).length).toBe(1);
        });

        it('returns 403 when a customer reads someone else’s order', async () => {
            const alice = await createCustomer('alice@test.local');
            const bob = await createCustomer('bob@test.local');
            const product = await createProduct();
            const order = await createOrder(alice.id, [{ productId: product.id, quantity: 1 }]);

            const res = await request(httpServer)
                .get(`/orders/${order.id}`)
                .set(auth(bob.id))
                .expect(403);
            expect(res.body.code).toBe('ORDER_ACCESS_DENIED');
        });

        it('returns 404 when ordering an unknown product', async () => {
            const customer = await createCustomer();
            const res = await request(httpServer)
                .post('/orders')
                .set(auth(customer.id))
                .send({ items: [{ productId: randomUUID(), quantity: 1 }] })
                .expect(404);
            expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
        });

        it('rejects an empty items list with 400', async () => {
            const customer = await createCustomer();
            await request(httpServer)
                .post('/orders')
                .set(auth(customer.id))
                .send({ items: [] })
                .expect(400);
        });
    });

    // ─── payments ─────────────────────────────────────────────────────────

    describe('payments', () => {
        async function setupPayableOrder(walletCents = 10_000, orderTotalCents = 5000) {
            const customer = await createCustomer();
            await topUp(customer.id, walletCents);
            const product = await createProduct('Bundle', orderTotalCents);
            const order = await createOrder(customer.id, [{ productId: product.id, quantity: 1 }]);
            return { customer, product, order };
        }

        it('happy path: wallet fully covers the order, order eventually transitions to paid', async () => {
            const { customer, order } = await setupPayableOrder(10_000, 5000);

            const payRes = await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({
                    ...auth(customer.id),
                    'Idempotency-Key': `e2e-${randomUUID()}`,
                })
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(201);

            expect(payRes.body.status).toBe('succeeded');
            expect(payRes.body.totalCents).toBe(5000);
            const paymentId = payRes.body.id as string;

            // Wallet was debited synchronously inside the per-attempt tx.
            const cust = await fetchCustomer(customer.id);
            expect(cust.walletBalanceCents).toBe(5000);

            // OrderPaid is driven asynchronously: outbox → relay → bus → handler.
            await waitFor(async () => {
                const o = await fetchOrder(customer.id, order.id);
                return o.status === 'paid';
            });

            // Payment + attempt audit row reachable via GET /payments/:id.
            // PaymentController has CustomerIdGuard at the class level so this
            // endpoint also requires X-Customer-Id, same as /orders/*.
            const paymentFetch = await request(httpServer)
                .get(`/payments/${paymentId}`)
                .set(auth(customer.id))
                .expect(200);
            expect(paymentFetch.body.status).toBe('succeeded');
            expect(paymentFetch.body.attempts).toHaveLength(1);
            expect(paymentFetch.body.attempts[0].provider).toBe('wallet');
            expect(paymentFetch.body.attempts[0].status).toBe('succeeded');
        });

        it('idempotent replay returns the same payment without re-charging the wallet', async () => {
            const { customer, order } = await setupPayableOrder(10_000, 5000);
            const key = `e2e-idem-${randomUUID()}`;

            const first = await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({ ...auth(customer.id), 'Idempotency-Key': key })
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(201);

            expect(first.body.status).toBe('succeeded');
            const balanceAfterFirst = (await fetchCustomer(customer.id)).walletBalanceCents;
            expect(balanceAfterFirst).toBe(5000);

            // Replay with the same key — should be a no-op except for returning
            // the original payment as-is.
            const replay = await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({ ...auth(customer.id), 'Idempotency-Key': key })
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(201);

            expect(replay.body.id).toBe(first.body.id);
            expect(replay.body.status).toBe('succeeded');
            const balanceAfterReplay = (await fetchCustomer(customer.id)).walletBalanceCents;
            expect(balanceAfterReplay).toBe(5000); // not 0 — the second call did not debit again
        });

        it('rejects an idempotency-key collision (same key, different params) with 400', async () => {
            const { customer: c1, order: o1 } = await setupPayableOrder(10_000, 5000);
            const c2 = await createCustomer('other@test.local');
            await topUp(c2.id, 10_000);
            // Re-use the SAME product / same total in the second order so the
            // request shape itself is valid — only the customer + order differ.
            const product2 = await createProduct('Bundle2', 5000);
            const o2 = await createOrder(c2.id, [{ productId: product2.id, quantity: 1 }]);

            const key = `e2e-collide-${randomUUID()}`;

            await request(httpServer)
                .post(`/orders/${o1.id}/pay`)
                .set({ ...auth(c1.id), 'Idempotency-Key': key })
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(201);

            const res = await request(httpServer)
                .post(`/orders/${o2.id}/pay`)
                .set({ ...auth(c2.id), 'Idempotency-Key': key })
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(400);
            expect(res.body.code).toBe('INVALID_PAYMENT_REQUEST');
        });

        it('insufficient wallet funds marks payment failed and the order eventually transitions to failed', async () => {
            // 1000 in wallet, paying 5000 → wallet rejects, no fallback provider
            // (chain is wallet-only in the test config) → whole payment fails.
            const { customer, order } = await setupPayableOrder(1000, 5000);

            const payRes = await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({
                    ...auth(customer.id),
                    'Idempotency-Key': `e2e-${randomUUID()}`,
                })
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(201);

            expect(payRes.body.status).toBe('failed');

            await waitFor(async () => {
                const o = await fetchOrder(customer.id, order.id);
                return o.status === 'failed';
            });

            // Wallet untouched — the wallet provider rejects before debiting.
            const cust = await fetchCustomer(customer.id);
            expect(cust.walletBalanceCents).toBe(1000);
        });

        it('returns 403 when one customer tries to pay another customer’s order', async () => {
            const { order } = await setupPayableOrder(10_000, 5000);
            const intruder = await createCustomer('intruder@test.local');
            await topUp(intruder.id, 10_000);

            const res = await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({
                    ...auth(intruder.id),
                    'Idempotency-Key': `e2e-${randomUUID()}`,
                })
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(403);
            expect(res.body.code).toBe('ORDER_ACCESS_DENIED');
        });

        it('rejects allocations whose sum doesn’t match the order total with 400', async () => {
            const { customer, order } = await setupPayableOrder(10_000, 5000);

            const res = await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({
                    ...auth(customer.id),
                    'Idempotency-Key': `e2e-${randomUUID()}`,
                })
                .send({ allocations: [{ amountCents: 4000 }] })
                .expect(400);
            expect(res.body.code).toBe('INVALID_PAYMENT_REQUEST');
            expect(res.body.message).toMatch(/does not match order total/i);
        });

        it('rejects an unknown provider name with 400 that names the live providers', async () => {
            const { customer, order } = await setupPayableOrder(10_000, 5000);

            const res = await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({
                    ...auth(customer.id),
                    'Idempotency-Key': `e2e-${randomUUID()}`,
                })
                .send({ allocations: [{ provider: 'bitcoin', amountCents: 5000 }] })
                .expect(400);
            expect(res.body.code).toBe('INVALID_PAYMENT_REQUEST');
            expect(res.body.message).toMatch(/wallet/);
        });

        it('rejects paying an order that is not in pending status with 409', async () => {
            const { customer, order } = await setupPayableOrder(10_000, 5000);

            // First payment moves the order through processing → paid.
            await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({
                    ...auth(customer.id),
                    'Idempotency-Key': `e2e-${randomUUID()}`,
                })
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(201);

            await waitFor(async () => {
                const o = await fetchOrder(customer.id, order.id);
                return o.status === 'paid';
            });

            // Second pay request — new idempotency key, so the handler runs all
            // its preconditions. The order is no longer pending → 409.
            const res = await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({
                    ...auth(customer.id),
                    'Idempotency-Key': `e2e-${randomUUID()}`,
                })
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(409);
            expect(res.body.code).toBe('ORDER_NOT_PAYABLE');
        });

        it('returns 404 when paying an order that does not exist', async () => {
            const customer = await createCustomer();
            await topUp(customer.id, 10_000);
            const res = await request(httpServer)
                .post(`/orders/${randomUUID()}/pay`)
                .set({
                    ...auth(customer.id),
                    'Idempotency-Key': `e2e-${randomUUID()}`,
                })
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(404);
            expect(res.body.code).toBe('ORDER_NOT_FOUND');
        });

        // ─── additional scenarios ──────────────────────────────────────────

        it('split allocation: two wallet allocations summing to total both succeed', async () => {
            const { customer, order } = await setupPayableOrder(10_000, 5000);

            const payRes = await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({
                    ...auth(customer.id),
                    'Idempotency-Key': `e2e-${randomUUID()}`,
                })
                .send({
                    allocations: [
                        { provider: 'wallet', amountCents: 2000 },
                        { amountCents: 3000 },
                    ],
                })
                .expect(201);

            expect(payRes.body.status).toBe('succeeded');
            const attempts = payRes.body.attempts as Array<{
                provider: string;
                amountCents: number;
                status: string;
            }>;
            expect(attempts).toHaveLength(2);
            expect(attempts.every((a) => a.provider === 'wallet' && a.status === 'succeeded')).toBe(
                true,
            );
            expect(attempts.reduce((s, a) => s + a.amountCents, 0)).toBe(5000);

            const cust = await fetchCustomer(customer.id);
            expect(cust.walletBalanceCents).toBe(5000);
        });

        it('honours an explicit provider override that is not in the configured chain', async () => {
            // Test config: PAYMENT_PROVIDER_CHAIN=wallet. Stripe is registered
            // but not in the chain — an explicit allocation forces it anyway.
            const { customer, order } = await setupPayableOrder(10_000, 5000);

            const payRes = await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({
                    ...auth(customer.id),
                    'Idempotency-Key': `e2e-${randomUUID()}`,
                })
                .send({ allocations: [{ provider: 'stripe', amountCents: 5000 }] })
                .expect(201);

            expect(payRes.body.status).toBe('succeeded');
            expect(payRes.body.attempts).toHaveLength(1);
            expect(payRes.body.attempts[0].provider).toBe('stripe');
            expect(payRes.body.attempts[0].status).toBe('succeeded');
            expect(payRes.body.attempts[0].externalRef).toMatch(/^stripe_ch_/);

            const cust = await fetchCustomer(customer.id);
            expect(cust.walletBalanceCents).toBe(10_000);
        });

        it('generates an Idempotency-Key server-side when the header is omitted', async () => {
            const { customer, order } = await setupPayableOrder(10_000, 5000);

            const payRes = await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set(auth(customer.id))
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(201);

            expect(payRes.body.status).toBe('succeeded');
            expect(payRes.body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
        });

        it('treats a whitespace-only Idempotency-Key as missing and generates one', async () => {
            const { customer, order } = await setupPayableOrder(10_000, 5000);

            const payRes = await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({ ...auth(customer.id), 'Idempotency-Key': '   ' })
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(201);

            expect(payRes.body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
            expect(payRes.body.idempotencyKey.trim().length).toBeGreaterThan(0);
        });

        it('records a failed attempt audit row with insufficient_funds reason', async () => {
            const { customer, order } = await setupPayableOrder(1000, 5000);

            const payRes = await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({
                    ...auth(customer.id),
                    'Idempotency-Key': `e2e-${randomUUID()}`,
                })
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(201);

            const paymentId = payRes.body.id as string;
            const paymentFetch = await request(httpServer)
                .get(`/payments/${paymentId}`)
                .set(auth(customer.id))
                .expect(200);

            expect(paymentFetch.body.status).toBe('failed');
            expect(paymentFetch.body.attempts).toHaveLength(1);
            expect(paymentFetch.body.attempts[0]).toMatchObject({
                provider: 'wallet',
                status: 'failed',
                failureReason: 'insufficient_funds',
            });
        });

        it('outbox: every event for a paid payment is drained by the relay', async () => {
            const { customer, order } = await setupPayableOrder(10_000, 5000);

            await request(httpServer)
                .post(`/orders/${order.id}/pay`)
                .set({
                    ...auth(customer.id),
                    'Idempotency-Key': `e2e-${randomUUID()}`,
                })
                .send({ allocations: [{ amountCents: 5000 }] })
                .expect(201);

            await waitFor(async () => {
                const o = await fetchOrder(customer.id, order.id);
                return o.status === 'paid';
            });

            await waitFor(async () => {
                const rows = (await ds.query(
                    `SELECT COUNT(*)::int AS pending FROM domain_events_outbox WHERE processed_at IS NULL`,
                )) as Array<{ pending: number }>;
                return rows[0].pending === 0;
            });

            const all = (await ds.query(
                `SELECT event_name FROM domain_events_outbox ORDER BY occurred_at`,
            )) as Array<{ event_name: string }>;
            expect(all.map((r) => r.event_name)).toEqual(
                expect.arrayContaining(['payment.initiated', 'payment.succeeded']),
            );
        });

        // ─── GET /payments/:id ─────────────────────────────────────────────

        describe('GET /payments/:id', () => {
            it('returns 404 for an unknown payment id', async () => {
                const customer = await createCustomer();
                await request(httpServer)
                    .get(`/payments/${randomUUID()}`)
                    .set(auth(customer.id))
                    .expect(404);
            });

            it('rejects requests with no X-Customer-Id with 401', async () => {
                await request(httpServer)
                    .get(`/payments/${randomUUID()}`)
                    .set('X-Api-Key', TEST_API_KEY)
                    .expect(401);
            });

            it('rejects requests with no X-Api-Key with 401', async () => {
                await request(httpServer).get(`/payments/${randomUUID()}`).expect(401);
            });
        });

        // ─── request validation ────────────────────────────────────────────

        describe('request validation', () => {
            let customer: { id: string };
            let order: { id: string };

            beforeEach(async () => {
                const setup = await setupPayableOrder(10_000, 5000);
                customer = setup.customer;
                order = setup.order;
            });

            const payBody = (body: unknown) =>
                request(httpServer)
                    .post(`/orders/${order.id}/pay`)
                    .set({
                        ...auth(customer.id),
                        'Idempotency-Key': `e2e-${randomUUID()}`,
                    })
                    .send(body as object);

            it('rejects an empty allocations array with 400', async () => {
                await payBody({ allocations: [] }).expect(400);
            });

            it('rejects a missing allocations field with 400', async () => {
                await payBody({}).expect(400);
            });

            it('rejects a negative amountCents with 400', async () => {
                await payBody({ allocations: [{ amountCents: -100 }] }).expect(400);
            });

            it('rejects a zero amountCents with 400', async () => {
                await payBody({ allocations: [{ amountCents: 0 }] }).expect(400);
            });

            it('rejects a non-integer amountCents with 400', async () => {
                await payBody({ allocations: [{ amountCents: 12.5 }] }).expect(400);
            });

            it('rejects an uppercase provider name with 400', async () => {
                await payBody({
                    allocations: [{ provider: 'Wallet', amountCents: 5000 }],
                }).expect(400);
            });

            it('rejects a provider name longer than 64 chars with 400', async () => {
                await payBody({
                    allocations: [{ provider: 'a'.repeat(65), amountCents: 5000 }],
                }).expect(400);
            });

            it('rejects unknown properties on an allocation with 400 (forbidNonWhitelisted)', async () => {
                await payBody({
                    allocations: [{ amountCents: 5000, somethingExtra: 'nope' }],
                }).expect(400);
            });

            it('rejects a non-UUID order id with 400', async () => {
                await request(httpServer)
                    .post(`/orders/not-a-uuid/pay`)
                    .set({
                        ...auth(customer.id),
                        'Idempotency-Key': `e2e-${randomUUID()}`,
                    })
                    .send({ allocations: [{ amountCents: 5000 }] })
                    .expect(400);
            });
        });
    });
});
