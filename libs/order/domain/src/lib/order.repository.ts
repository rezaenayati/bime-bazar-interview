import { Order } from './order';

export interface OrderRepository {
    save(order: Order): Promise<void>;
    findById(id: string): Promise<Order | null>;
    findByIdOrFail(id: string): Promise<Order>;
    findByCustomerId(customerId: string): Promise<Order[]>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
