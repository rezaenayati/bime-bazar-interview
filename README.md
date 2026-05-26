# Bime Bazar — Mini E-Commerce Backend

A NestJS + Nx monorepo: customers create orders, pay through pluggable providers (Stripe-mock, PayPal-mock, internal Wallet), and orders reach their terminal state asynchronously via domain events. The brief grades **architecture and decision-making**, not feature surface.

---

## Architecture

Four bounded contexts (`customer`, `product`, `order`, `payment`), each split into three Nx libs:

- **`domain/`** — pure TypeScript aggregates, value objects, repository ports, domain events. No Nest, no TypeORM.
- **`application/`** — CQRS command/query handlers and DTOs. Depends only on `domain`.
- **`infrastructure/`** — TypeORM entities + adapters, third-party provider adapters.

```
api ──► *_infrastructure ──► *_application ──► *_domain ──► shared/kernel
```

- **CQRS** (`@nestjs/cqrs`) everywhere for consistency.
- **Hexagonal payment.** `PaymentProvider` port lives in `payment/domain`; three adapters live in `payment/infrastructure`, registered via a multi-token (`PAYMENT_PROVIDERS`) and discovered by `PaymentProviderRegistry`.
- **Domain events** are written to a transactional outbox table inside the same transaction as the state change, then dispatched to the in-process `EventBus` by a polling relay. Payment publishes `payment.initiated/succeeded/failed`; the **order** context owns the handlers that react.
- **PostgreSQL + TypeORM** with migrations and a UNIQUE index on `payments.idempotency_key`.

---

## Payment flow

`POST /orders/:id/pay` with an optional `Idempotency-Key` header:

```json
{ "allocations": [{ "provider": "wallet", "amountCents": 2000 }, { "amountCents": 3000 }] }
```

`PayOrderHandler`:

1. **Idempotency check** — same key returns the original payment, no re-charge.
2. **Validate** — order exists, belongs to caller, status `pending`, allocations sum to total.
3. **Claim (tx)** — `order.markProcessing()` + insert `Payment(initiated)` + outbox event, one commit.
4. **Per attempt (tx)** — for each allocation, walk the configured fallback chain (or the named provider). Every attempt — success or failure — is recorded. For wallet, the customer debit and the attempt row commit together.
5. **Finalize (tx)** — mark `succeeded` and emit `PaymentSucceeded`; the order handler marks the order `paid`. On failure, **refund** every successful prior charge (compensation) and emit `PaymentFailed`.

Provider ↔ order communication is fully event-driven. Payment never reaches into the order aggregate.

### Transactional boundaries

A single `TransactionRunner` wraps `DataSource.transaction()` and propagates the active `EntityManager` via `AsyncLocalStorage`. Repos check for that manager on every call — so the domain-facing repository ports stay transaction-unaware.

| Boundary | What's atomic |
| --- | --- |
| Claim | `order.markProcessing()` + payment insert + outbox event |
| Per attempt | `provider.charge()` (incl. wallet debit) + attempt row + payment save |
| Finalize | terminal-status save + outbox event (+ refunds on the failure path) |

### Transactional outbox

The naive `await save(); bus.publish()` loses events when the process dies between the two calls. Instead:

- `DomainEventPublisher` writes events to `domain_events_outbox` **inside** the surrounding transaction.
- `OutboxRelay` polls the table (default 500ms), claims a batch via `SELECT ... FOR UPDATE SKIP LOCKED` (multi-instance safe), dispatches each row through `EventBus.publish()`, and marks `processed_at`. It drains once on bootstrap to recover anything left behind.
- Delivery is **at-least-once** — handlers are idempotent (`markPaid`/`markFailed` no-op when already in the target state).

Env knobs: `OUTBOX_POLL_INTERVAL_MS` (500), `OUTBOX_BATCH_SIZE` (50), `OUTBOX_MAX_ATTEMPTS` (10).

### Provider switching

| Goal | Allocations |
| --- | --- |
| Whole order through the fallback chain | `[{ amountCents: total }]` |
| Force a specific provider | `[{ provider: 'stripe', amountCents: total }]` |
| Split wallet + external | `[{ provider: 'wallet', amountCents: 2000 }, { amountCents: 3000 }]` |

Set `STRIPE_FAILURE_RATE` / `PAYPAL_FAILURE_RATE` (0–1) to force failures and exercise the fallback chain.

### Adding a provider

1. Implement `PaymentProvider` in `libs/payment/infrastructure/src/lib/providers/<name>.provider.ts`.
2. Add it to `BUILTIN_PROVIDERS` in `payment-infrastructure.module.ts`.
3. (Optional) include the name in `PAYMENT_PROVIDER_CHAIN`.

No handler, controller, registry, or DTO change. Full walkthrough in [docs/ADDING_A_PROVIDER.md](docs/ADDING_A_PROVIDER.md).

---

## Running locally

```bash
npm install
docker compose up -d postgres
cp .env.example .env
npm run db:migrate
npm run serve            # → http://localhost:3000 (Swagger at /docs)
```

Full stack via Docker: `docker compose --profile app up --build`.

Scripts: `build`, `test`, `test:e2e`, `lint`, `db:migrate`, `db:migrate:gen`.

---

## Auth

| Header | Required | Purpose |
| --- | --- | --- |
| `X-Api-Key` | every request | Client credential, checked against `API_KEYS` env via `timingSafeEqual`. Multiple keys allowed for zero-downtime rotation. |
| `X-Customer-Id` | order/payment endpoints | Identifies the customer the request acts on behalf of. |

## API surface

All endpoints require `X-Api-Key`. Order/payment endpoints additionally require `X-Customer-Id`.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/customers` | Create a customer (seed). |
| GET | `/customers/:id` | Customer + wallet balance. |
| POST | `/customers/:id/wallet/top-up` | Top up wallet. |
| POST/GET | `/products[/:id]` | Create/list/fetch products. |
| POST | `/orders` | Create order (`status=pending`). |
| GET | `/orders[/:id]` | List/fetch caller's orders. |
| POST | `/orders/:id/pay` | Body `{ allocations: [...] }`, optional `Idempotency-Key` header. |
| GET | `/payments/:id` | Payment + all attempts. |

Use [`postman_collection.json`](postman_collection.json) for ready-to-fire requests.

---

## Testing

Unit tests next to their code (`*.spec.ts`); the headline one is [`pay-order.handler.spec.ts`](libs/payment/application/src/lib/commands/pay-order.handler.spec.ts) — happy paths, fallback, split allocation, idempotent replay, compensation, validation.

```bash
npx nx run-many -t test
```

**Integration tests** at [`apps/api/test/api.e2e-spec.ts`](apps/api/test/api.e2e-spec.ts) hit the real Nest app + Postgres via Supertest. They cover the full guard/filter pipeline, CQRS handlers, repos, the wallet provider, and the outbox → relay → handler chain (two tests poll until the order status flips).

```bash
docker compose up -d postgres
npm run test:e2e
```

Auto-creates `bime_bazar_test`, runs migrations, truncates between cases. ~5s end-to-end.

---

## Design decisions

- **Events as the seam between Order and Payment.** Order has no `payOrder` method or import of the Payment module — it only reacts to events.
- **Provider port lives in `payment/domain`.** Classical hexagonal: adapters depend inward. The registry sits in `application` because it's orchestration, not a domain rule.
- **Idempotency via `payments.idempotency_key UNIQUE`** — DB-enforced single-write semantics.
- **Transactional outbox** for events — at-least-once delivery, crash recovery, idempotent handlers.
- **Compensation, not rollback, across providers.** Once Stripe is charged no `ROLLBACK` can undo it; the orchestrator calls `refund` on every prior success.
- **Fallback chain IS the retry strategy** — no in-provider backoff. Different providers fail differently; swapping is far more likely to recover than hammering one. Per-attempt idempotency keys (`${paymentId}:${index}:${name}`) make outer-key replays safe.
- **`X-Customer-Id` instead of JWT auth** — the brief wants architecture, not auth boilerplate.

## Out of scope

- Real auth, inventory reservation, provider webhooks.
- Real message broker — the outbox runs in-process via `OutboxRelay`; swapping in Kafka/SQS would be a different relay implementation.
- Recovery sweep for the one non-transactional window (external provider charged but attempt row didn't commit). Different problem from the outbox — it'd need a provider-status query, not a redispatch.
- Background job runners — the order's `pending → processing → paid/failed` lifecycle and the outbox-driven event flow cover the "async thinking" requirement.
