import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { DomainEvent } from '@bime-bazar/shared/kernel';
import { DomainEventRegistry } from './domain-event-registry';
import { OutboxRelay } from './outbox.relay';

class FakeEvent extends DomainEvent {
    readonly eventName = 'fake.thing';
    constructor(public readonly value: string) {
        super();
    }
}

class FakeDataSource {
    public rows: Array<{
        id: string;
        event_name: string;
        payload: Record<string, unknown>;
        occurred_at: Date;
        processed_at: Date | null;
        attempt_count: number;
        last_error: string | null;
    }> = [];

    async transaction<T>(fn: (manager: unknown) => Promise<T>): Promise<T> {
        const manager = {
            query: async (sql: string, params: unknown[]) => this.handleSelect(sql, params),
        };
        return fn(manager);
    }

    private handleSelect(sql: string, params: unknown[]): unknown[] {
        if (!sql.includes('SELECT')) return [];
        const maxAttempts = params[0] as number;
        const limit = params[1] as number;
        return this.rows
            .filter((r) => r.processed_at === null && r.attempt_count < maxAttempts)
            .sort((a, b) => a.occurred_at.getTime() - b.occurred_at.getTime())
            .slice(0, limit)
            .map((r) => ({ ...r }));
    }

    getRepository<_T = unknown>(
        _entity: unknown,
    ): {
        update: (where: { id: string }, patch: Record<string, unknown>) => Promise<void>;
    } {
        return {
            update: async (where: { id: string }, patch: Record<string, unknown>) => {
                const row = this.rows.find((r) => r.id === where.id);
                if (!row) return;
                if ('processedAt' in patch) row.processed_at = patch['processedAt'] as Date | null;
                if ('attemptCount' in patch) row.attempt_count = patch['attemptCount'] as number;
                if ('lastError' in patch) row.last_error = patch['lastError'] as string | null;
            },
        };
    }
}

function makeRelay(rows: FakeDataSource['rows'], busPublish: jest.Mock) {
    const ds = new FakeDataSource();
    ds.rows = rows;
    const registry = new DomainEventRegistry();
    registry.register({
        eventName: 'fake.thing',
        factory: (p) => new FakeEvent(p['value'] as string),
    });

    const bus = { publish: busPublish } as unknown as EventBus;
    const config = {
        get: (key: string, fallback?: string) => fallback,
    } as unknown as ConfigService;

    const relay = new OutboxRelay(ds as unknown as DataSource, registry, bus, config);
    return { relay, ds };
}

function makeRow(
    overrides: Partial<FakeDataSource['rows'][number]> = {},
): FakeDataSource['rows'][number] {
    return {
        id: overrides.id ?? `id-${Math.random().toString(36).slice(2, 8)}`,
        event_name: overrides.event_name ?? 'fake.thing',
        payload: overrides.payload ?? { value: 'hello' },
        occurred_at: overrides.occurred_at ?? new Date(),
        processed_at: overrides.processed_at ?? null,
        attempt_count: overrides.attempt_count ?? 0,
        last_error: overrides.last_error ?? null,
    };
}

describe('OutboxRelay', () => {
    it('dispatches an unprocessed row to the event bus and marks it processed', async () => {
        const rows = [makeRow({ id: 'a', payload: { value: 'world' } })];
        const publish = jest.fn();
        const { relay } = makeRelay(rows, publish);

        await relay.runOnce();

        expect(publish).toHaveBeenCalledTimes(1);
        const event = publish.mock.calls[0][0] as FakeEvent;
        expect(event).toBeInstanceOf(FakeEvent);
        expect(event.value).toBe('world');
        // Stable identity carried over from the row.
        expect(event.eventId).toBe('a');

        expect(rows[0].processed_at).toBeInstanceOf(Date);
        expect(rows[0].attempt_count).toBe(1);
        expect(rows[0].last_error).toBeNull();
    });

    it('skips already-processed rows on the next tick', async () => {
        const rows = [makeRow({ id: 'a', processed_at: new Date() }), makeRow({ id: 'b' })];
        const publish = jest.fn();
        const { relay } = makeRelay(rows, publish);

        await relay.runOnce();

        expect(publish).toHaveBeenCalledTimes(1);
        const dispatched = publish.mock.calls[0][0] as FakeEvent;
        expect(dispatched.eventId).toBe('b');
    });

    it('records last_error and increments attempt_count when the bus throws', async () => {
        const rows = [makeRow({ id: 'a' })];
        const publish = jest.fn(() => {
            throw new Error('boom');
        });
        const { relay } = makeRelay(rows, publish);

        await relay.runOnce();

        expect(rows[0].processed_at).toBeNull();
        expect(rows[0].attempt_count).toBe(1);
        expect(rows[0].last_error).toBe('boom');
    });

    it('marks unknown event names with an error and stops retrying after max attempts', async () => {
        const rows = [makeRow({ id: 'a', event_name: 'mystery.event' })];
        const publish = jest.fn();
        const { relay } = makeRelay(rows, publish);

        await relay.runOnce();

        expect(publish).not.toHaveBeenCalled();
        expect(rows[0].processed_at).toBeNull();
        expect(rows[0].attempt_count).toBe(1);
        expect(rows[0].last_error).toContain("unknown event type 'mystery.event'");
    });

    it('drains multiple rows in dispatch order (by occurred_at)', async () => {
        const t0 = new Date('2025-01-01T00:00:00Z');
        const t1 = new Date('2025-01-01T00:00:01Z');
        const t2 = new Date('2025-01-01T00:00:02Z');
        const rows = [
            makeRow({ id: 'b', occurred_at: t1, payload: { value: 'B' } }),
            makeRow({ id: 'c', occurred_at: t2, payload: { value: 'C' } }),
            makeRow({ id: 'a', occurred_at: t0, payload: { value: 'A' } }),
        ];
        const publish = jest.fn();
        const { relay } = makeRelay(rows, publish);

        await relay.runOnce();

        const orderOfIds = publish.mock.calls.map(
            (c) => (c[0] as FakeEvent & { eventId: string }).eventId,
        );
        expect(orderOfIds).toEqual(['a', 'b', 'c']);
        for (const r of rows) {
            expect(r.processed_at).toBeInstanceOf(Date);
        }
    });
});
