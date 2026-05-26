export interface OrderItemProps {
    productId: string;
    productName: string;
    unitPriceCents: number;
    quantity: number;
}

export class OrderItem {
    constructor(
        public readonly productId: string,
        public readonly productName: string,
        public readonly unitPriceCents: number,
        public readonly quantity: number,
    ) {
        if (quantity <= 0) throw new Error('OrderItem quantity must be > 0');
        if (unitPriceCents <= 0) throw new Error('OrderItem unitPriceCents must be > 0');
    }

    get subtotalCents(): number {
        return this.unitPriceCents * this.quantity;
    }
}
