import { ICommand } from '@nestjs/cqrs';

export class CreateCustomerCommand implements ICommand {
    constructor(public readonly email: string) {}
}
