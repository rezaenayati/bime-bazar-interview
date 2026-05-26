import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

const txStorage = new AsyncLocalStorage<EntityManager>();

export function currentTxManager(): EntityManager | undefined {
    return txStorage.getStore();
}

@Injectable()
export class TransactionRunner {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    async run<T>(fn: () => Promise<T>): Promise<T> {
        const existing = txStorage.getStore();
        if (existing) {
            return fn();
        }
        return this.dataSource.transaction((manager) => txStorage.run(manager, fn));
    }
}
