import { IQuery } from '@nestjs/cqrs';

export class GetPaymentQuery implements IQuery {
    constructor(public readonly paymentId: string) {}
}
