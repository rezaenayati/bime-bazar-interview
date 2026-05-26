import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@bime-bazar/shared/kernel';

export interface ProductProps {
    id: string;
    name: string;
    priceCents: number;
}

export class Product extends AggregateRoot {
    private constructor(
        id: string,
        public readonly name: string,
        public readonly priceCents: number,
    ) {
        super(id);
    }

    static create(input: { name: string; priceCents: number }): Product {
        if (input.priceCents <= 0) throw new Error('Product price must be positive');
        if (!input.name.trim()) throw new Error('Product name cannot be empty');
        return new Product(randomUUID(), input.name, input.priceCents);
    }

    static rehydrate(props: ProductProps): Product {
        return new Product(props.id, props.name, props.priceCents);
    }
}
