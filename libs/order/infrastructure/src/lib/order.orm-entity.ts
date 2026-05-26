import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { OrderItemOrmEntity } from './order-item.orm-entity';

@Entity({ name: 'orders' })
export class OrderOrmEntity {
    @PrimaryColumn('uuid')
    id!: string;

    @Column({ type: 'uuid', name: 'customer_id' })
    customerId!: string;

    @Column({ type: 'varchar', length: 32 })
    status!: 'pending' | 'processing' | 'paid' | 'failed';

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;

    @OneToMany(() => OrderItemOrmEntity, (i) => i.order, {
        cascade: ['insert', 'update'],
        eager: true,
    })
    items!: OrderItemOrmEntity[];
}
