import { randomUUID } from 'node:crypto';
import { AggregateRoot, Money } from '@bime-bazar/shared/kernel';
import { InsufficientFundsError } from './errors';

export interface CustomerProps {
    id: string;
    email: string;
    walletBalanceCents: number;
}

export class Customer extends AggregateRoot {
    private _email: string;
    private _wallet: Money;

    private constructor(props: CustomerProps) {
        super(props.id);
        this._email = props.email;
        this._wallet = Money.fromCents(props.walletBalanceCents);
    }

    static create(email: string): Customer {
        return new Customer({ id: randomUUID(), email, walletBalanceCents: 0 });
    }

    static rehydrate(props: CustomerProps): Customer {
        return new Customer(props);
    }

    get email(): string {
        return this._email;
    }

    get walletBalanceCents(): number {
        return this._wallet.cents;
    }

    topUp(amountCents: number): void {
        this._wallet = this._wallet.add(Money.fromCents(amountCents));
    }

    debit(amountCents: number): void {
        const amount = Money.fromCents(amountCents);
        if (amount.cents > this._wallet.cents) {
            throw new InsufficientFundsError(this._wallet.cents, amount.cents);
        }
        this._wallet = this._wallet.subtract(amount);
    }

    refund(amountCents: number): void {
        this._wallet = this._wallet.add(Money.fromCents(amountCents));
    }
}
