import { DomainError } from '@bime-bazar/shared/kernel';

export class InvalidPaymentRequestError extends DomainError {
    readonly code = 'INVALID_PAYMENT_REQUEST';
    constructor(message: string) {
        super(message);
    }
}
