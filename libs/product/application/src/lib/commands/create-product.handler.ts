import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PRODUCT_REPOSITORY, Product, ProductRepository } from '@bime-bazar/product/domain';
import { CreateProductCommand } from './create-product.command';
import { ProductDto } from '../dto';

@CommandHandler(CreateProductCommand)
export class CreateProductHandler implements ICommandHandler<CreateProductCommand, ProductDto> {
    constructor(
        @Inject(PRODUCT_REPOSITORY)
        private readonly products: ProductRepository,
    ) {}

    async execute(command: CreateProductCommand): Promise<ProductDto> {
        const product = Product.create({ name: command.name, priceCents: command.priceCents });
        await this.products.save(product);
        return { id: product.id, name: product.name, priceCents: product.priceCents };
    }
}
