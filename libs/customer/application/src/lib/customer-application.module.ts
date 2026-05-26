import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateCustomerHandler } from './commands/create-customer.handler';
import { TopUpWalletHandler } from './commands/top-up-wallet.handler';
import { GetCustomerHandler } from './queries/get-customer.handler';

export const CUSTOMER_HANDLERS = [CreateCustomerHandler, TopUpWalletHandler, GetCustomerHandler];

@Module({
    imports: [CqrsModule],
    exports: [CqrsModule],
})
export class CustomerApplicationModule {}
