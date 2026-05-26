import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrderOrmEntity } from './order.orm-entity';

@Entity({ name: 'order_items' })
export class OrderItemOrmEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => OrderOrmEntity, (o) => o.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'order_id' })
    order!: OrderOrmEntity;

    @Column({ type: 'uuid', name: 'order_id' })
    orderId!: string;

    @Column({ type: 'uuid', name: 'product_id' })
    productId!: string;

    @Column({ type: 'varchar', length: 255, name: 'product_name' })
    productName!: string;

    @Column({ type: 'bigint', name: 'unit_price_cents' })
    unitPriceCents!: string;

    @Column({ type: 'int' })
    quantity!: number;
}
