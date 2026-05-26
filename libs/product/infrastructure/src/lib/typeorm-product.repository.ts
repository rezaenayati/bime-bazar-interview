import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product, ProductRepository } from '@bime-bazar/product/domain';
import { currentTxManager } from '@bime-bazar/shared/infra';
import { ProductOrmEntity } from './product.orm-entity';

@Injectable()
export class TypeOrmProductRepository implements ProductRepository {
    constructor(
        @InjectRepository(ProductOrmEntity)
        private readonly repo: Repository<ProductOrmEntity>,
    ) {}

    private scoped(): Repository<ProductOrmEntity> {
        const manager = currentTxManager();
        return manager ? manager.getRepository(ProductOrmEntity) : this.repo;
    }

    async save(product: Product): Promise<void> {
        await this.scoped().save({
            id: product.id,
            name: product.name,
            priceCents: product.priceCents.toString(),
        });
    }

    async findById(id: string): Promise<Product | null> {
        const row = await this.scoped().findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByIds(ids: string[]): Promise<Product[]> {
        if (ids.length === 0) return [];
        const rows = await this.scoped().find({ where: { id: In(ids) } });
        return rows.map((r) => this.toDomain(r));
    }

    async findAll(): Promise<Product[]> {
        const rows = await this.scoped().find();
        return rows.map((r) => this.toDomain(r));
    }

    private toDomain(row: ProductOrmEntity): Product {
        return Product.rehydrate({
            id: row.id,
            name: row.name,
            priceCents: Number(row.priceCents),
        });
    }
}
