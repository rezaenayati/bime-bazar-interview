import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainEvent } from '@bime-bazar/shared/kernel';
import { currentTxManager } from '../transaction-runner';
import { OutboxOrmEntity } from './outbox.orm-entity';

@Injectable()
export class OutboxStore {
    constructor(
        @InjectRepository(OutboxOrmEntity)
        private readonly repo: Repository<OutboxOrmEntity>,
    ) {}

    private scoped(): Repository<OutboxOrmEntity> {
        const manager = currentTxManager();
        return manager ? manager.getRepository(OutboxOrmEntity) : this.repo;
    }

    async append(events: readonly DomainEvent[]): Promise<void> {
        if (events.length === 0) return;
        const rows = events.map((e) => this.toRow(e));
        await this.scoped().save(rows);
    }

    private toRow(event: DomainEvent): OutboxOrmEntity {
        const row = new OutboxOrmEntity();
        row.id = event.eventId;
        row.eventName = event.eventName;
        row.occurredAt = event.occurredAt;
        row.payload = this.toPayload(event);
        row.processedAt = null;
        row.attemptCount = 0;
        row.lastError = null;
        return row;
    }

    private toPayload(event: DomainEvent): Record<string, unknown> {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(event)) {
            if (key === 'eventId' || key === 'occurredAt' || key === 'eventName') continue;
            out[key] = (event as unknown as Record<string, unknown>)[key];
        }
        return out;
    }
}
