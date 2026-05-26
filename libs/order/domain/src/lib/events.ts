import { DomainEvent } from '@bime-bazar/shared/kernel';

export class OrderCreatedEvent extends DomainEvent {
    readonly eventName = 'order.created';
    constructor(
        public readonly orderId: string,
        public readonly customerId: string,
        public readonly totalCents: number,
    ) {
        super();
    }
}

export const ORDER_DOMAIN_EVENT_DESCRIPTORS = [
    {
        eventName: 'order.created',
        factory: (p: Record<string, unknown>): OrderCreatedEvent =>
            new OrderCreatedEvent(
                p['orderId'] as string,
                p['customerId'] as string,
                p['totalCents'] as number,
            ),
    },
] as const;
