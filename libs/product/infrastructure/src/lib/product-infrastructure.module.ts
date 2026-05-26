import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PRODUCT_REPOSITORY } from '@bime-bazar/product/domain';
import {
    PRODUCT_HANDLERS,
    ProductApplicationModule,
} from '@bime-bazar/product/application';
import { ProductOrmEntity } from './product.orm-entity';
import { TypeOrmProductRepository } from './typeorm-product.repository';

@Module({
    imports: [TypeOrmModule.forFeature([ProductOrmEntity]), ProductApplicationModule],
    providers: [
        {
            provide: PRODUCT_REPOSITORY,
            useClass: TypeOrmProductRepository,
        },
        ...PRODUCT_HANDLERS,
    ],
    exports: [PRODUCT_REPOSITORY, ProductApplicationModule],
})
export class ProductInfrastructureModule {}
