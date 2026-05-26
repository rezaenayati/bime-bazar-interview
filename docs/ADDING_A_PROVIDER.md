# Example — Adding a New Payment Provider

This document is the assignment's "example showing how to add a new payment provider" deliverable. It walks through adding a fully-working `BankTransferProvider` end-to-end, with every file change called out explicitly. Total time: about ten minutes.

The shape of the system is designed so this is genuinely a small change. If you're skeptical of that claim, this doc is the proof.

---

## The contract you're implementing

Every provider implements the `PaymentProvider` port in `payment/domain`:

```ts
export interface PaymentProvider {
    readonly name: ProviderName;
    charge(input: ChargeInput): Promise<ChargeResult>;
    refund?(input: RefundInput): Promise<{ ok: boolean }>;  // optional
}
```

`ChargeResult` is a typed discriminated union — either `{ ok: true, externalRef }` or `{ ok: false, reason, retryable, message? }`. Provider failures are *values*, not exceptions, so the orchestrator can inspect the reason and decide retry vs fallback without try/catch.

You return `ok: true` when the charge worked. You return `ok: false` with a reason when it didn't. You only `throw` for genuinely unexpected errors (the orchestrator will let those bubble up as 500s).

---

## Step 1 — Create the provider file

Drop this into `libs/payment/infrastructure/src/lib/providers/bank-transfer.provider.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    ChargeInput,
    ChargeResult,
    PaymentProvider,
    RefundInput,
} from '@bime-bazar/payment/domain';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class BankTransferProvider implements PaymentProvider {
    readonly name = 'bank_transfer';
    private readonly logger = new Logger(BankTransferProvider.name);

    constructor(private readonly config: ConfigService) {}

    async charge(input: ChargeInput): Promise<ChargeResult> {
        // Bank transfers settle slower than card charges.
        await sleep(200 + Math.random() * 300);

        const failureRate = Number(this.config.get<string>('BANK_TRANSFER_FAILURE_RATE', '0.1'));
        if (Math.random() < failureRate) {
            this.logger.warn(
                `bank transfer rejected for ${input.amountCents}c (key=${input.idempotencyKey})`,
            );
            return {
                ok: false,
                reason: 'provider_error',
                retryable: true,
                message: 'Bank transfer rejected by clearing house',
            };
        }

        const externalRef = `bt_${input.idempotencyKey}`;
        this.logger.log(`bank transfer ${input.amountCents}c (ref ${externalRef})`);
        return { ok: true, externalRef };
    }

    // Optional — real bank transfers can be reversed within a settlement window.
    async refund(input: RefundInput): Promise<{ ok: boolean }> {
        await sleep(100);
        this.logger.log(
            `bank transfer refund ${input.amountCents}c ref=${input.externalRef}`,
        );
        return { ok: true };
    }
}
```

A few things to notice:

- `@Injectable()` is required because Nest's DI container needs to instantiate it.
- `readonly name = 'bank_transfer'` is the key the registry will index by. Use snake_case for compound names; the existing providers use single words (`wallet`, `stripe`, `paypal`).
- The constructor injects `ConfigService` from `@nestjs/config` — used here for the failure-rate knob, the same pattern as `StripeMockProvider`.
- `refund` is `async` and returns `{ ok: boolean }` — implementing it is optional; provide it only if the underlying system supports reversals. The orchestrator's compensation flow calls `provider.refund` only when it exists.
- For a real adapter (not a mock), this whole file would call the provider's SDK instead of `setTimeout`. Nothing else would change.

---

## Step 2 — Register it in the module

Open `libs/payment/infrastructure/src/lib/payment-infrastructure.module.ts` and add the import + the array entry:

```diff
 import { WalletProvider } from './providers/wallet.provider';
 import { StripeMockProvider } from './providers/stripe-mock.provider';
 import { PayPalMockProvider } from './providers/paypal-mock.provider';
+import { BankTransferProvider } from './providers/bank-transfer.provider';

-const BUILTIN_PROVIDERS = [WalletProvider, StripeMockProvider, PayPalMockProvider];
+const BUILTIN_PROVIDERS = [
+    WalletProvider,
+    StripeMockProvider,
+    PayPalMockProvider,
+    BankTransferProvider,
+];
```

That's it — two changes, one of them a single-line array append.

The `PAYMENT_PROVIDERS` multi-token factory automatically picks up the new entry. The `PaymentProviderRegistry` indexes it by name on boot and logs the full registered list (you'll see `bank_transfer` appear in the startup output). `PayOrderHandler` will find it when an allocation specifies `provider: 'bank_transfer'`, or when `bank_transfer` is in the configured fallback chain.

**No other files need to change** for the provider to be functional. Notably:

- **The DTO does not need updating.** `PaymentAllocationDto` validates the `provider` field by shape only (lowercase alphanum + `_`/`-`, max 64 chars). The actual "is this a known provider?" check happens against the live `PaymentProviderRegistry` inside `PayOrderHandler`. Send `{ "provider": "bank_transfer", ... }` from a client and it will route to the new adapter immediately — no whitelist to update.
- **The handler / registry / orchestration logic does not change.** Everything works through the `PaymentProvider` contract.

---

## Step 3 — (Optional) Add it to the default fallback chain

In `.env`:

```diff
-PAYMENT_PROVIDER_CHAIN=wallet,stripe,paypal
+PAYMENT_PROVIDER_CHAIN=wallet,stripe,paypal,bank_transfer

+BANK_TRANSFER_FAILURE_RATE=0.1
```

Now allocations that don't name a provider explicitly will fall through to Bank Transfer if Wallet, Stripe, and PayPal all fail. Order matters in the chain.

Skip this step if Bank Transfer should only be reachable via explicit per-request selection (`{ provider: 'bank_transfer', amountCents: ... }`).

---

## Step 4 — Verify

The test suite already covers the orchestration logic against scripted providers, so no new tests are strictly required. But for an interview demo it's worth showing the new provider actually works:

**Unit test (recommended)** — create `libs/payment/infrastructure/src/lib/providers/bank-transfer.provider.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { BankTransferProvider } from './bank-transfer.provider';

describe('BankTransferProvider', () => {
    const makeConfig = (failureRate: string) =>
        ({ get: (_: string, def: string) => failureRate ?? def }) as unknown as ConfigService;

    it('returns ok on success', async () => {
        const provider = new BankTransferProvider(makeConfig('0'));
        const result = await provider.charge({
            customerId: 'c1',
            orderId: 'o1',
            amountCents: 5000,
            idempotencyKey: 'k1',
        });
        expect(result.ok).toBe(true);
    });

    it('returns retryable failure when the clearing house rejects', async () => {
        const provider = new BankTransferProvider(makeConfig('1'));
        const result = await provider.charge({
            customerId: 'c1',
            orderId: 'o1',
            amountCents: 5000,
            idempotencyKey: 'k1',
        });
        expect(result).toMatchObject({ ok: false, reason: 'provider_error', retryable: true });
    });
});
```

Run it with `npx jest --config libs/payment/infrastructure/jest.config.js`.

**End-to-end check** — restart `npm run serve` and call the pay endpoint:

```bash
curl -X POST http://localhost:3000/orders/$ORDER/pay \
  -H 'Content-Type: application/json' \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Customer-Id: $CUSTOMER" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"allocations":[{"provider":"bank_transfer","amountCents":5000}]}'
```

The api logs will show `BankTransferProvider` registered at startup and a `bank transfer Xc (ref bt_...)` line on a successful charge.

---

## The end-state diff in one place

```
libs/payment/infrastructure/src/lib/providers/bank-transfer.provider.ts  [new file]
libs/payment/infrastructure/src/lib/payment-infrastructure.module.ts     [+5 lines]
.env                                                                     [+1 line for chain, +1 for failure rate]   (optional)
```

One new file, an array entry, and an optional env tweak. **No controller code, DTO, handler, registry, or test changes.** Clients can immediately pick the new provider by name in `POST /orders/:id/pay` — the DTO checks shape only, the handler resolves the name against the live registry.

That's the full footprint. The registry, the orchestrator, the fallback chain, the compensation flow, and the idempotency model all absorb the new provider with zero source changes — because they were written to depend on the `PaymentProvider` contract and nothing else.

---

## What this demonstrates

The same code shape works for any provider you'd plausibly want to add: Klarna, Apple Pay, a corporate-card system, an internal credit ledger, a crypto on-ramp. Every one of them maps onto a `charge(input) -> ChargeResult` function. Differences in protocol, latency, retry semantics, refund support — those all live inside the adapter and don't leak.

The architectural property the brief was asking us to demonstrate isn't "the system can be configured to use new providers." It's "the system was designed so the abstraction boundary holds when extended." This walkthrough is the proof: every file you touch is right next to the thing you're adding. Nothing in the core has to be re-read or re-understood.
