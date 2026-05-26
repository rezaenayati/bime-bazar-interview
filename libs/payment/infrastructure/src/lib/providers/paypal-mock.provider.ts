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
export class PayPalMockProvider implements PaymentProvider {
    readonly name = 'paypal';
    private readonly logger = new Logger(PayPalMockProvider.name);

    constructor(private readonly config: ConfigService) {}

    async charge(input: ChargeInput): Promise<ChargeResult> {
        await sleep(80 + Math.random() * 180);

        const failureRate = Number(this.config.get<string>('PAYPAL_FAILURE_RATE', '0.2'));
        if (Math.random() < failureRate) {
            const isTimeout = Math.random() < 0.4;
            const reason = isTimeout ? 'timeout' : 'provider_error';
            this.logger.warn(
                `paypal mock ${reason} for ${input.amountCents}c (key=${input.idempotencyKey})`,
            );
            return {
                ok: false,
                reason,
                retryable: true,
                message: `PayPal mock returned ${reason}`,
            };
        }

        const externalRef = `paypal_${input.idempotencyKey}`;
        this.logger.log(`paypal mock charged ${input.amountCents}c (ref ${externalRef})`);
        return { ok: true, externalRef };
    }

    async refund(input: RefundInput): Promise<{ ok: boolean }> {
        await sleep(40);
        this.logger.log(`paypal mock refund ${input.amountCents}c ref=${input.externalRef}`);
        return { ok: true };
    }
}
