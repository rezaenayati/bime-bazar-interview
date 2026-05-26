import { DomainError } from '@bime-bazar/shared/kernel';

export class ProductNotFoundError extends DomainError {
    readonly code = 'PRODUCT_NOT_FOUND';
    constructor(id: string) {
        super(`Product ${id} not found`);
    }
}
