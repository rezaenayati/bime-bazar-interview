import { ICommand } from '@nestjs/cqrs';

export class TopUpWalletCommand implements ICommand {
    constructor(
        public readonly customerId: string,
        public readonly amountCents: number,
    ) {}
}
