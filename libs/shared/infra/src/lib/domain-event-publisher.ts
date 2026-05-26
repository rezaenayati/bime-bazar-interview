import { Injectable } from '@nestjs/common';
import { AggregateRoot, DomainEvent } from '@bime-bazar/shared/kernel';
import { OutboxStore } from './outbox/outbox.store';

@Injectable()
export class DomainEventPublisher {
    constructor(private readonly outbox: OutboxStore) {}

    async publishFromAggregate(aggregate: AggregateRoot): Promise<void> {
        const events = aggregate.pullDomainEvents();
        await this.publish(events);
    }

    async publish(events: readonly DomainEvent[]): Promise<void> {
        if (events.length === 0) return;
        await this.outbox.append(events);
    }
}
