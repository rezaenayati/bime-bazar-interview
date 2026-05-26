import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    ChargeInput,
    ChargeResult,
    PaymentProvider,
    RefundInput,
} from '@bime-bazar/payment/domain';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class StripeMockProvider implements PaymentProvider {
    readonly name = 'stripe';
    private readonly logger = new Logger(StripeMockProvider.name);

    constructor(private readonly config: ConfigService) {}

    async charge(input: ChargeInput): Promise<ChargeResult> {
        await sleep(50 + Math.random() * 150);

        const failureRate = Number(this.config.get<string>('STRIPE_FAILURE_RATE', '0.2'));
        if (Math.random() < failureRate) {
            const isTimeout = Math.random() < 0.5;
            const reason = isTimeout ? 'timeout' : 'declined';
            this.logger.warn(
                `stripe mock ${reason} for ${input.amountCents}c (key=${input.idempotencyKey})`,
            );
            return {
                ok: false,
                reason,
                retryable: isTimeout,
                message: `Stripe mock returned ${reason}`,
            };
        }

        const externalRef = `stripe_ch_${input.idempotencyKey}`;
        this.logger.log(`stripe mock charged ${input.amountCents}c (ref ${externalRef})`);
        return { ok: true, externalRef };
    }

    async refund(input: RefundInput): Promise<{ ok: boolean }> {
        await sleep(30);
        this.logger.log(`stripe mock refund ${input.amountCents}c ref=${input.externalRef}`);
        return { ok: true };
    }
}
