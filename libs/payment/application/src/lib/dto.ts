import {
    AttemptStatus,
    ChargeFailureReason,
    PaymentStatus,
    ProviderName,
} from '@bime-bazar/payment/domain';

export interface PaymentAttemptDto {
    provider: ProviderName;
    amountCents: number;
    status: AttemptStatus;
    externalRef?: string;
    failureReason?: ChargeFailureReason;
    message?: string;
}

export interface PaymentDto {
    id: string;
    orderId: string;
    customerId: string;
    idempotencyKey: string;
    totalCents: number;
    status: PaymentStatus;
    attempts: PaymentAttemptDto[];
}
