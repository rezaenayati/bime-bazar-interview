import { DomainError } from '@bime-bazar/shared/kernel';
import { OrderStatus } from './order-status';

export class OrderNotFoundError extends DomainError {
    readonly code = 'ORDER_NOT_FOUND';
    constructor(id: string) {
        super(`Order ${id} not found`);
    }
}

export class OrderNotPayableError extends DomainError {
    readonly code = 'ORDER_NOT_PAYABLE';
    constructor(currentStatus: OrderStatus) {
        super(`Order cannot be paid in status '${currentStatus}'`);
    }
}

export class InvalidOrderError extends DomainError {
    readonly code = 'INVALID_ORDER';
    constructor(message: string) {
        super(message);
    }
}

export class OrderAccessDeniedError extends DomainError {
    readonly code = 'ORDER_ACCESS_DENIED';
    constructor(orderId: string, customerId: string) {
        super(`Order ${orderId} does not belong to customer ${customerId}`);
    }
}
