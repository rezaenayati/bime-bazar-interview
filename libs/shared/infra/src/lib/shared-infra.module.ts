import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ApiKeyGuard } from './api-key.guard';
import { DomainEventPublisher } from './domain-event-publisher';
import { OutboxModule } from './outbox/outbox.module';
import { TransactionRunner } from './transaction-runner';

@Global()
@Module({
    imports: [ConfigModule, CqrsModule, OutboxModule],
    providers: [
        DomainEventPublisher,
        TransactionRunner,
        {
            provide: APP_GUARD,
            useClass: ApiKeyGuard,
        },
    ],
    exports: [DomainEventPublisher, TransactionRunner, OutboxModule, CqrsModule],
})
export class SharedInfraModule {}
