import { Payment } from './payment';
import { PaymentFailedEvent, PaymentInitiatedEvent, PaymentSucceededEvent } from './events';

describe('Payment', () => {
    const initInput = {
        orderId: 'o1',
        customerId: 'c1',
        idempotencyKey: 'k-1',
        totalCents: 5000,
    };

    it('initiates with status=initiated and emits PaymentInitiatedEvent', () => {
        const payment = Payment.initiate(initInput);
        expect(payment.status).toBe('initiated');
        const events = payment.pullDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(PaymentInitiatedEvent);
    });

    it('tracks succeeded amount across attempts', () => {
        const payment = Payment.initiate(initInput);
        payment.pullDomainEvents();
        payment.recordSuccessfulAttempt('wallet', 2000, 'wallet:1');
        payment.recordFailedAttempt('stripe', 3000, 'declined');
        payment.recordSuccessfulAttempt('paypal', 3000, 'paypal:1');
        expect(payment.succeededAmountCents).toBe(5000);
        expect(payment.attempts).toHaveLength(3);
    });

    it('markSucceeded emits PaymentSucceededEvent and is idempotent', () => {
        const payment = Payment.initiate(initInput);
        payment.pullDomainEvents();
        payment.markSucceeded();
        const events = payment.pullDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(PaymentSucceededEvent);
        payment.markSucceeded();
        expect(payment.pullDomainEvents()).toHaveLength(0);
    });

    it('markFailed emits PaymentFailedEvent with reason', () => {
        const payment = Payment.initiate(initInput);
        payment.pullDomainEvents();
        payment.markFailed('out of providers');
        const events = payment.pullDomainEvents();
        expect(events).toHaveLength(1);
        const event = events[0] as PaymentFailedEvent;
        expect(event).toBeInstanceOf(PaymentFailedEvent);
        expect(event.reason).toBe('out of providers');
    });
});
