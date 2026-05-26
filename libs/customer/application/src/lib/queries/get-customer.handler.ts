import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CUSTOMER_REPOSITORY, CustomerRepository } from '@bime-bazar/customer/domain';
import { GetCustomerQuery } from './get-customer.query';
import { CustomerDto } from '../dto';

@QueryHandler(GetCustomerQuery)
export class GetCustomerHandler implements IQueryHandler<GetCustomerQuery, CustomerDto> {
    constructor(
        @Inject(CUSTOMER_REPOSITORY)
        private readonly customers: CustomerRepository,
    ) {}

    async execute(query: GetCustomerQuery): Promise<CustomerDto> {
        const customer = await this.customers.findByIdOrFail(query.customerId);
        return {
            id: customer.id,
            email: customer.email,
            walletBalanceCents: customer.walletBalanceCents,
        };
    }
}
