import { Inject, Injectable, Logger } from '@nestjs/common';
import { PAYMENT_PROVIDERS, PaymentProvider, ProviderName } from '@bime-bazar/payment/domain';

@Injectable()
export class PaymentProviderRegistry {
    private readonly logger = new Logger(PaymentProviderRegistry.name);
    private readonly byName: Map<ProviderName, PaymentProvider>;

    constructor(
        @Inject(PAYMENT_PROVIDERS)
        private readonly providers: PaymentProvider[],
    ) {
        this.byName = new Map(providers.map((p) => [p.name, p]));
        this.logger.log(`registered providers: ${[...this.byName.keys()].join(', ')}`);
    }

    has(name: ProviderName): boolean {
        return this.byName.has(name);
    }

    get(name: ProviderName): PaymentProvider {
        const provider = this.byName.get(name);
        if (!provider) {
            throw new Error(
                `Unknown payment provider '${name}'. Registered: ${[...this.byName.keys()].join(', ')}`,
            );
        }
        return provider;
    }

    list(): readonly PaymentProvider[] {
        return this.providers;
    }

    names(): readonly ProviderName[] {
        return [...this.byName.keys()];
    }
}
