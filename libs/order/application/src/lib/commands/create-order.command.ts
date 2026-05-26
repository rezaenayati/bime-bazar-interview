import { ICommand } from '@nestjs/cqrs';

export interface CreateOrderItemInput {
    productId: string;
    quantity: number;
}

export class CreateOrderCommand implements ICommand {
    constructor(
        public readonly customerId: string,
        public readonly items: CreateOrderItemInput[],
    ) {}
}
