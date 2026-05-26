import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateProductHandler } from './commands/create-product.handler';
import { ListProductsHandler } from './queries/list-products.handler';
import { GetProductHandler } from './queries/get-product.handler';

export const PRODUCT_HANDLERS = [CreateProductHandler, ListProductsHandler, GetProductHandler];

@Module({
    imports: [CqrsModule],
    exports: [CqrsModule],
})
export class ProductApplicationModule {}
