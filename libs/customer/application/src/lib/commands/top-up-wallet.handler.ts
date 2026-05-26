import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CUSTOMER_REPOSITORY, CustomerRepository } from '@bime-bazar/customer/domain';
import { TopUpWalletCommand } from './top-up-wallet.command';
import { CustomerDto } from '../dto';

@CommandHandler(TopUpWalletCommand)
export class TopUpWalletHandler implements ICommandHandler<TopUpWalletCommand, CustomerDto> {
    constructor(
        @Inject(CUSTOMER_REPOSITORY)
        private readonly customers: CustomerRepository,
    ) {}

    async execute(command: TopUpWalletCommand): Promise<CustomerDto> {
        const customer = await this.customers.findByIdOrFail(command.customerId);
        customer.topUp(command.amountCents);
        await this.customers.save(customer);
        return {
            id: customer.id,
            email: customer.email,
            walletBalanceCents: customer.walletBalanceCents,
        };
    }
}
