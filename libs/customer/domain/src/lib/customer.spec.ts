import { Customer } from './customer';
import { InsufficientFundsError } from './errors';

describe('Customer', () => {
    it('starts with zero wallet balance', () => {
        const c = Customer.create('a@b.com');
        expect(c.walletBalanceCents).toBe(0);
        expect(c.email).toBe('a@b.com');
    });

    it('tops up and debits the wallet', () => {
        const c = Customer.create('a@b.com');
        c.topUp(5000);
        c.debit(2000);
        expect(c.walletBalanceCents).toBe(3000);
    });

    it('throws InsufficientFundsError when debit exceeds balance', () => {
        const c = Customer.create('a@b.com');
        c.topUp(100);
        expect(() => c.debit(200)).toThrow(InsufficientFundsError);
    });

    it('refund credits the wallet back', () => {
        const c = Customer.create('a@b.com');
        c.topUp(1000);
        c.debit(1000);
        expect(c.walletBalanceCents).toBe(0);
        c.refund(1000);
        expect(c.walletBalanceCents).toBe(1000);
    });

    it('rehydrates from props without emitting events', () => {
        const c = Customer.rehydrate({
            id: '00000000-0000-0000-0000-000000000001',
            email: 'a@b.com',
            walletBalanceCents: 4242,
        });
        expect(c.walletBalanceCents).toBe(4242);
        expect(c.pullDomainEvents()).toHaveLength(0);
    });
});
