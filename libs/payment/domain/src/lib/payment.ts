import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@bime-bazar/shared/kernel';
import { ChargeFailureReason, ProviderName } from './payment-provider';
import { PaymentFailedEvent, PaymentInitiatedEvent, PaymentSucceededEvent } from './events';

export type PaymentStatus = 'initiated' | 'succeeded' | 'failed';
export type AttemptStatus = 'succeeded' | 'failed';

export interface PaymentAttemptProps {
    id: string;
    provider: ProviderName;
    amountCents: number;
    status: AttemptStatus;
    externalRef?: string;
    failureReason?: ChargeFailureReason;
    message?: string;
    createdAt: Date;
}

export class PaymentAttempt {
    constructor(public readonly props: PaymentAttemptProps) {}
    get isSuccess(): boolean {
        return this.props.status === 'succeeded';
    }
}

export interface PaymentProps {
    id: string;
    orderId: string;
    customerId: string;
    idempotencyKey: string;
    totalCents: number;
    status: PaymentStatus;
    attempts: PaymentAttemptProps[];
    createdAt: Date;
}

export class Payment extends AggregateRoot {
    private _status: PaymentStatus;
    private readonly _attempts: PaymentAttempt[];

    private constructor(
        id: string,
        public readonly orderId: string,
        public readonly customerId: string,
        public readonly idempotencyKey: string,
        public readonly totalCents: number,
        status: PaymentStatus,
        attempts: PaymentAttempt[],
        public readonly createdAt: Date,
    ) {
        super(id);
        this._status = status;
        this._attempts = attempts;
    }

    static initiate(input: {
        orderId: string;
        customerId: string;
        idempotencyKey: string;
        totalCents: number;
    }): Payment {
        const payment = new Payment(
            randomUUID(),
            input.orderId,
            input.customerId,
            input.idempotencyKey,
            input.totalCents,
            'initiated',
            [],
            new Date(),
        );
        payment.record(new PaymentInitiatedEvent(payment.id, payment.orderId, payment.totalCents));
        return payment;
    }

    static rehydrate(props: PaymentProps): Payment {
        const attempts = props.attempts.map((a) => new PaymentAttempt(a));
        return new Payment(
            props.id,
            props.orderId,
            props.customerId,
            props.idempotencyKey,
            props.totalCents,
            props.status,
            attempts,
            props.createdAt,
        );
    }

    get status(): PaymentStatus {
        return this._status;
    }

    get attempts(): readonly PaymentAttempt[] {
        return this._attempts;
    }

    get succeededAmountCents(): number {
        return this._attempts
            .filter((a) => a.isSuccess)
            .reduce((sum, a) => sum + a.props.amountCents, 0);
    }

    recordSuccessfulAttempt(
        provider: ProviderName,
        amountCents: number,
        externalRef: string,
    ): void {
        this._attempts.push(
            new PaymentAttempt({
                id: randomUUID(),
                provider,
                amountCents,
                status: 'succeeded',
                externalRef,
                createdAt: new Date(),
            }),
        );
    }

    recordFailedAttempt(
        provider: ProviderName,
        amountCents: number,
        reason: ChargeFailureReason,
        message?: string,
    ): void {
        this._attempts.push(
            new PaymentAttempt({
                id: randomUUID(),
                provider,
                amountCents,
                status: 'failed',
                failureReason: reason,
                message,
                createdAt: new Date(),
            }),
        );
    }

    markSucceeded(): void {
        if (this._status === 'succeeded') return;
        this._status = 'succeeded';
        this.record(new PaymentSucceededEvent(this.id, this.orderId, this.totalCents));
    }

    markFailed(reason: string): void {
        if (this._status === 'failed') return;
        this._status = 'failed';
        this.record(new PaymentFailedEvent(this.id, this.orderId, reason));
    }
}
