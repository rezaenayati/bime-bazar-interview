import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'customers' })
export class CustomerOrmEntity {
    @PrimaryColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    email!: string;

    @Column({ type: 'bigint', name: 'wallet_balance_cents', default: 0 })
    walletBalanceCents!: string;
}
