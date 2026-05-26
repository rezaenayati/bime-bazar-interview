import { DomainError } from '@bime-bazar/shared/kernel';

export class CustomerNotFoundError extends DomainError {
    readonly code = 'CUSTOMER_NOT_FOUND';
    constructor(id: string) {
        super(`Customer ${id} not found`);
    }
}

export class CustomerEmailAlreadyExistsError extends DomainError {
    readonly code = 'CUSTOMER_EMAIL_TAKEN';
    constructor(public readonly email: string) {
        super(`A customer with email '${email}' already exists`);
    }
}

export class InsufficientFundsError extends DomainError {
    readonly code = 'INSUFFICIENT_FUNDS';
    constructor(
        public readonly availableCents: number,
        public readonly requestedCents: number,
    ) {
        super(
            `Insufficient wallet funds: requested ${requestedCents}, available ${availableCents}`,
        );
    }
}
