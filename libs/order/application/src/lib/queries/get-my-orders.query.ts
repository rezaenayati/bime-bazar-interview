import { IQuery } from '@nestjs/cqrs';

export class GetMyOrdersQuery implements IQuery {
    constructor(public readonly customerId: string) {}
}
