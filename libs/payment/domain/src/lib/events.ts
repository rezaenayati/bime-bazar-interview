import { DomainEvent } from '@bime-bazar/shared/kernel';

export class PaymentInitiatedEvent extends DomainEvent {
    readonly eventName = 'payment.initiated';
    constructor(
        public readonly paymentId: string,
        public readonly orderId: string,
        public readonly totalCents: number,
    ) {
        super();
    }
}

export class PaymentSucceededEvent extends DomainEvent {
    readonly eventName = 'payment.succeeded';
    constructor(
        public readonly paymentId: string,
        public readonly orderId: string,
        public readonly totalCents: number,
    ) {
        super();
    }
}

export class PaymentFailedEvent extends DomainEvent {
    readonly eventName = 'payment.failed';
    constructor(
        public readonly paymentId: string,
        public readonly orderId: string,
        public readonly reason: string,
    ) {
        super();
    }
}

export const PAYMENT_DOMAIN_EVENT_DESCRIPTORS = [
    {
        eventName: 'payment.initiated',
        factory: (p: Record<string, unknown>): PaymentInitiatedEvent =>
            new PaymentInitiatedEvent(
                p['paymentId'] as string,
                p['orderId'] as string,
                p['totalCents'] as number,
            ),
    },
    {
        eventName: 'payment.succeeded',
        factory: (p: Record<string, unknown>): PaymentSucceededEvent =>
            new PaymentSucceededEvent(
                p['paymentId'] as string,
                p['orderId'] as string,
                p['totalCents'] as number,
            ),
    },
    {
        eventName: 'payment.failed',
        factory: (p: Record<string, unknown>): PaymentFailedEvent =>
            new PaymentFailedEvent(
                p['paymentId'] as string,
                p['orderId'] as string,
                p['reason'] as string,
            ),
    },
] as const;
