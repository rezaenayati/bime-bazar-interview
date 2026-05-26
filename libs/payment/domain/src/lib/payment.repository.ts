import { Payment } from './payment';

export interface PaymentRepository {
    save(payment: Payment): Promise<void>;
    findById(id: string): Promise<Payment | null>;
    findByIdempotencyKey(key: string): Promise<Payment | null>;
}

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');
