export type OrderStatus = 'pending' | 'processing' | 'paid' | 'failed';

export const ORDER_STATUSES: readonly OrderStatus[] = ['pending', 'processing', 'paid', 'failed'];
