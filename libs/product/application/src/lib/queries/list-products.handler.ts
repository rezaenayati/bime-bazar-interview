import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PRODUCT_REPOSITORY, ProductRepository } from '@bime-bazar/product/domain';
import { ListProductsQuery } from './list-products.query';
import { ProductDto } from '../dto';

@QueryHandler(ListProductsQuery)
export class ListProductsHandler implements IQueryHandler<ListProductsQuery, ProductDto[]> {
    constructor(
        @Inject(PRODUCT_REPOSITORY)
        private readonly products: ProductRepository,
    ) {}

    async execute(): Promise<ProductDto[]> {
        const all = await this.products.findAll();
        return all.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents }));
    }
}
