import { DomainEvent } from './domain-event';

export abstract class AggregateRoot<TId extends string = string> {
    private readonly _events: DomainEvent[] = [];

    constructor(public readonly id: TId) {}

    protected record(event: DomainEvent): void {
        this._events.push(event);
    }

    pullDomainEvents(): DomainEvent[] {
        const out = [...this._events];
        this._events.length = 0;
        return out;
    }

    peekDomainEvents(): readonly DomainEvent[] {
        return this._events;
    }
}
