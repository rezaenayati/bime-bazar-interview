import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CUSTOMER_REPOSITORY } from '@bime-bazar/customer/domain';
import {
    CUSTOMER_HANDLERS,
    CustomerApplicationModule,
} from '@bime-bazar/customer/application';
import { CustomerOrmEntity } from './customer.orm-entity';
import { TypeOrmCustomerRepository } from './typeorm-customer.repository';

@Module({
    imports: [TypeOrmModule.forFeature([CustomerOrmEntity]), CustomerApplicationModule],
    providers: [
        {
            provide: CUSTOMER_REPOSITORY,
            useClass: TypeOrmCustomerRepository,
        },
        ...CUSTOMER_HANDLERS,
    ],
    exports: [CUSTOMER_REPOSITORY, CustomerApplicationModule],
})
export class CustomerInfrastructureModule {}
