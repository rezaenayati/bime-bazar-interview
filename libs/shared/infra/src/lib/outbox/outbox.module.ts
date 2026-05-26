import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainEventRegistry } from './domain-event-registry';
import { OutboxOrmEntity } from './outbox.orm-entity';
import { OutboxRelay } from './outbox.relay';
import { OutboxStore } from './outbox.store';

@Global()
@Module({
    imports: [TypeOrmModule.forFeature([OutboxOrmEntity]), ConfigModule, CqrsModule],
    providers: [DomainEventRegistry, OutboxStore, OutboxRelay],
    exports: [DomainEventRegistry, OutboxStore, OutboxRelay],
})
export class OutboxModule {}
