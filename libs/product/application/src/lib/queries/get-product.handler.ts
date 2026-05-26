import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
    PRODUCT_REPOSITORY,
    ProductNotFoundError,
    ProductRepository,
} from '@bime-bazar/product/domain';
import { GetProductQuery } from './get-product.query';
import { ProductDto } from '../dto';

@QueryHandler(GetProductQuery)
export class GetProductHandler implements IQueryHandler<GetProductQuery, ProductDto> {
    constructor(
        @Inject(PRODUCT_REPOSITORY)
        private readonly products: ProductRepository,
    ) {}

    async execute(query: GetProductQuery): Promise<ProductDto> {
        const product = await this.products.findById(query.productId);
        if (!product) throw new ProductNotFoundError(query.productId);
        return { id: product.id, name: product.name, priceCents: product.priceCents };
    }
}
