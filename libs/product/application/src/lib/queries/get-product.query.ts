import { IQuery } from '@nestjs/cqrs';

export class GetProductQuery implements IQuery {
    constructor(public readonly productId: string) {}
}
