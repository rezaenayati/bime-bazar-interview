import { ICommand } from '@nestjs/cqrs';

export class CreateProductCommand implements ICommand {
    constructor(
        public readonly name: string,
        public readonly priceCents: number,
    ) {}
}
