import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CUSTOMER_REPOSITORY, Customer, CustomerRepository } from '@bime-bazar/customer/domain';
import { CreateCustomerCommand } from './create-customer.command';
import { CustomerDto } from '../dto';

@CommandHandler(CreateCustomerCommand)
export class CreateCustomerHandler implements ICommandHandler<CreateCustomerCommand, CustomerDto> {
    constructor(
        @Inject(CUSTOMER_REPOSITORY)
        private readonly customers: CustomerRepository,
    ) {}

    async execute(command: CreateCustomerCommand): Promise<CustomerDto> {
        const customer = Customer.create(command.email);
        await this.customers.save(customer);
        return {
            id: customer.id,
            email: customer.email,
            walletBalanceCents: customer.walletBalanceCents,
        };
    }
}
