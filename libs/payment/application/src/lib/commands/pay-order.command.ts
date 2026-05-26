import { ICommand } from '@nestjs/cqrs';
import { ProviderName } from '@bime-bazar/payment/domain';

export interface PayOrderAllocationInput {
    provider?: ProviderName;
    amountCents: number;
}

export class PayOrderCommand implements ICommand {
    constructor(
        public readonly orderId: string,
        public readonly customerId: string,
        public readonly allocations: PayOrderAllocationInput[],
        public readonly idempotencyKey: string,
    ) {}
}
