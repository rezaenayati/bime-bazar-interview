import { Injectable } from '@nestjs/common';
import { DomainEvent } from '@bime-bazar/shared/kernel';

export interface DomainEventDescriptor<T extends DomainEvent = DomainEvent> {
    eventName: string;
    factory: (payload: Record<string, unknown>) => T;
}

@Injectable()
export class DomainEventRegistry {
    private readonly byName = new Map<string, DomainEventDescriptor>();

    register<T extends DomainEvent>(descriptor: DomainEventDescriptor<T>): this {
        this.byName.set(descriptor.eventName, descriptor as DomainEventDescriptor);
        return this;
    }

    registerAll(descriptors: readonly DomainEventDescriptor[]): this {
        for (const d of descriptors) this.register(d);
        return this;
    }

    deserialize(eventName: string, payload: Record<string, unknown>): DomainEvent {
        const descriptor = this.byName.get(eventName);
        if (!descriptor) {
            throw new Error(
                `No deserializer registered for event '${eventName}'. ` +
                    `Registered: ${[...this.byName.keys()].join(', ') || '(none)'}`,
            );
        }
        return descriptor.factory(payload);
    }

    knows(eventName: string): boolean {
        return this.byName.has(eventName);
    }

    names(): readonly string[] {
        return [...this.byName.keys()];
    }
}
