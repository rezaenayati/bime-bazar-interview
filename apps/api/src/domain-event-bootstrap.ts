import { Injectable, OnModuleInit } from '@nestjs/common';
import { ORDER_DOMAIN_EVENT_DESCRIPTORS } from '@bime-bazar/order/domain';
import { PAYMENT_DOMAIN_EVENT_DESCRIPTORS } from '@bime-bazar/payment/domain';
import { DomainEventRegistry } from '@bime-bazar/shared/infra';

@Injectable()
export class DomainEventBootstrap implements OnModuleInit {
    constructor(private readonly registry: DomainEventRegistry) {}

    onModuleInit(): void {
        this.registry.registerAll(ORDER_DOMAIN_EVENT_DESCRIPTORS);
        this.registry.registerAll(PAYMENT_DOMAIN_EVENT_DESCRIPTORS);
    }
}
