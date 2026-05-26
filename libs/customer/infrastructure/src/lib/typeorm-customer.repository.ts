import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
    Customer,
    CustomerEmailAlreadyExistsError,
    CustomerNotFoundError,
    CustomerRepository,
} from '@bime-bazar/customer/domain';
import { currentTxManager } from '@bime-bazar/shared/infra';
import { CustomerOrmEntity } from './customer.orm-entity';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class TypeOrmCustomerRepository implements CustomerRepository {
    constructor(
        @InjectRepository(CustomerOrmEntity)
        private readonly repo: Repository<CustomerOrmEntity>,
    ) {}

    private scoped(): Repository<CustomerOrmEntity> {
        const manager = currentTxManager();
        return manager ? manager.getRepository(CustomerOrmEntity) : this.repo;
    }

    async save(customer: Customer): Promise<void> {
        const row: CustomerOrmEntity = {
            id: customer.id,
            email: customer.email,
            walletBalanceCents: customer.walletBalanceCents.toString(),
        };
        try {
            await this.scoped().save(row);
        } catch (err) {
            if (isUniqueViolation(err)) {
                throw new CustomerEmailAlreadyExistsError(customer.email);
            }
            throw err;
        }
    }

    async findById(id: string): Promise<Customer | null> {
        const row = await this.scoped().findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByIdOrFail(id: string): Promise<Customer> {
        const found = await this.findById(id);
        if (!found) throw new CustomerNotFoundError(id);
        return found;
    }

    private toDomain(row: CustomerOrmEntity): Customer {
        return Customer.rehydrate({
            id: row.id,
            email: row.email,
            walletBalanceCents: Number(row.walletBalanceCents),
        });
    }
}

function isUniqueViolation(err: unknown): boolean {
    return (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
            PG_UNIQUE_VIOLATION
    );
}
