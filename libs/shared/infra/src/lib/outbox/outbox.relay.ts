import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DomainEventRegistry } from './domain-event-registry';
import { OutboxOrmEntity } from './outbox.orm-entity';

interface OutboxRow {
    id: string;
    event_name: string;
    payload: Record<string, unknown>;
    occurred_at: Date;
    attempt_count: number;
}

@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(OutboxRelay.name);
    private timer?: NodeJS.Timeout;
    private inFlight = false;
    private shuttingDown = false;
    private readonly pollIntervalMs: number;
    private readonly batchSize: number;
    private readonly maxAttempts: number;

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly registry: DomainEventRegistry,
        private readonly bus: EventBus,
        config: ConfigService,
    ) {
        this.pollIntervalMs = Number(config.get<string>('OUTBOX_POLL_INTERVAL_MS', '500'));
        this.batchSize = Number(config.get<string>('OUTBOX_BATCH_SIZE', '50'));
        this.maxAttempts = Number(config.get<string>('OUTBOX_MAX_ATTEMPTS', '10'));
    }

    async onApplicationBootstrap(): Promise<void> {
        this.logger.log(
            `outbox relay starting — poll=${this.pollIntervalMs}ms batch=${this.batchSize} maxAttempts=${this.maxAttempts} ` +
                `registered=[${this.registry.names().join(', ') || 'none'}]`,
        );
        await this.drainUntilEmpty();
        this.timer = setInterval(() => {
            void this.tick();
        }, this.pollIntervalMs);
        this.timer.unref?.();
    }

    async onApplicationShutdown(): Promise<void> {
        this.shuttingDown = true;
        if (this.timer) clearInterval(this.timer);
        await this.drainUntilEmpty();
    }

    async runOnce(): Promise<number> {
        return await this.tick();
    }

    private async drainUntilEmpty(): Promise<void> {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const n = await this.tick();
            if (n === 0) break;
        }
    }

    private async tick(): Promise<number> {
        if (this.inFlight) return 0;
        this.inFlight = true;
        try {
            return await this.processBatch();
        } catch (err) {
            this.logger.error(`outbox tick failed: ${(err as Error).message}`);
            return 0;
        } finally {
            this.inFlight = false;
        }
    }

    private async processBatch(): Promise<number> {
        const claimed = await this.dataSource.transaction(async (manager) => {
            const rows = (await manager.query(
                `
                SELECT id, event_name, payload, occurred_at, attempt_count
                FROM domain_events_outbox
                WHERE processed_at IS NULL
                  AND attempt_count < $1
                ORDER BY occurred_at
                LIMIT $2
                FOR UPDATE SKIP LOCKED
                `,
                [this.maxAttempts, this.batchSize],
            )) as OutboxRow[];
            return rows;
        });

        if (claimed.length === 0) return 0;

        for (const row of claimed) {
            await this.dispatchOne(row);
        }
        return claimed.length;
    }

    private async dispatchOne(row: OutboxRow): Promise<void> {
        const repo = this.dataSource.getRepository(OutboxOrmEntity);
        try {
            if (!this.registry.knows(row.event_name)) {
                this.logger.warn(
                    `outbox: no deserializer for event '${row.event_name}' (id=${row.id}) — skipping`,
                );
                await repo.update(
                    { id: row.id },
                    {
                        attemptCount: row.attempt_count + 1,
                        lastError: `unknown event type '${row.event_name}'`,
                    },
                );
                return;
            }

            const event = this.registry.deserialize(row.event_name, row.payload);
            Object.assign(event, { eventId: row.id, occurredAt: row.occurred_at });

            this.bus.publish(event);

            await repo.update(
                { id: row.id },
                {
                    processedAt: new Date(),
                    attemptCount: row.attempt_count + 1,
                    lastError: null,
                },
            );
            this.logger.debug?.(
                `outbox dispatched ${row.event_name} (id=${row.id}, attempt=${row.attempt_count + 1})`,
            );
        } catch (err) {
            const message = (err as Error).message;
            this.logger.error(
                `outbox dispatch failed for ${row.event_name} (id=${row.id}): ${message}`,
            );
            await repo
                .update(
                    { id: row.id },
                    {
                        attemptCount: row.attempt_count + 1,
                        lastError: message,
                    },
                )
                .catch((updateErr) => {
                    this.logger.error(
                        `outbox failure-record update failed for id=${row.id}: ${(updateErr as Error).message}`,
                    );
                });
        }
    }
}
