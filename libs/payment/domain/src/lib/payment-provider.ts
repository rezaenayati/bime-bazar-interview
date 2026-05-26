// eslint-disable-next-line @typescript-eslint/ban-types
export type ProviderName = 'wallet' | 'stripe' | 'paypal' | (string & {});

export interface ChargeInput {
    customerId: string;
    orderId: string;
    amountCents: number;
    idempotencyKey: string;
}

export type ChargeFailureReason = 'declined' | 'timeout' | 'provider_error' | 'insufficient_funds';

export type ChargeResult =
    | { ok: true; externalRef: string }
    | { ok: false; reason: ChargeFailureReason; retryable: boolean; message?: string };

export interface RefundInput {
    customerId: string;
    amountCents: number;
    externalRef: string;
    idempotencyKey: string;
}

export interface PaymentProvider {
    readonly name: ProviderName;
    charge(input: ChargeInput): Promise<ChargeResult>;
    refund?(input: RefundInput): Promise<{ ok: boolean }>;
}

export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');
