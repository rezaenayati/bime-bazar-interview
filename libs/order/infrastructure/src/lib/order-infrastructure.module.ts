import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ORDER_REPOSITORY } from '@bime-bazar/order/domain';
import { ORDER_HANDLERS, OrderApplicationModule } from '@bime-bazar/order/application';
import { CustomerInfrastructureModule } from '@bime-bazar/customer/infrastructure';
import { ProductInfrastructureModule } from '@bime-bazar/product/infrastructure';
import { OrderOrmEntity } from './order.orm-entity';
import { OrderItemOrmEntity } from './order-item.orm-entity';
import { TypeOrmOrderRepository } from './typeorm-order.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrderOrmEntity, OrderItemOrmEntity]),
        OrderApplicationModule,
        CustomerInfrastructureModule,
        ProductInfrastructureModule,
    ],
    providers: [
        {
            provide: ORDER_REPOSITORY,
            useClass: TypeOrmOrderRepository,
        },
        ...ORDER_HANDLERS,
    ],
    exports: [ORDER_REPOSITORY, OrderApplicationModule],
})
export class OrderInfrastructureModule {}
