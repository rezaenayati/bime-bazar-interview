export class Money {
    private constructor(public readonly cents: number) {}

    static fromCents(cents: number): Money {
        if (!Number.isInteger(cents)) {
            throw new Error(`Money.fromCents requires an integer, got ${cents}`);
        }
        if (cents < 0) {
            throw new Error(`Money cannot be negative (got ${cents})`);
        }
        return new Money(cents);
    }

    static zero(): Money {
        return new Money(0);
    }

    add(other: Money): Money {
        return new Money(this.cents + other.cents);
    }

    subtract(other: Money): Money {
        if (other.cents > this.cents) {
            throw new Error(`Money subtract would produce negative balance`);
        }
        return new Money(this.cents - other.cents);
    }

    equals(other: Money): boolean {
        return this.cents === other.cents;
    }

    isZero(): boolean {
        return this.cents === 0;
    }
}
