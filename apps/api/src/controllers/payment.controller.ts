import { randomUUID } from 'node:crypto';
import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Headers,
    Param,
    ParseUUIDPipe,
    Post,
    UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiHeader, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { GetPaymentQuery, PayOrderCommand } from '@bime-bazar/payment/application';
import { CurrentCustomer, CustomerIdGuard } from '@bime-bazar/shared/infra';
import { PayOrderDto } from './dtos';

@ApiTags('payments')
@ApiSecurity('X-Api-Key')
@ApiSecurity('X-Customer-Id')
@UseGuards(CustomerIdGuard)
@Controller()
export class PaymentController {
    constructor(
        private readonly commands: CommandBus,
        private readonly queries: QueryBus,
    ) {}

    @Post('orders/:id/pay')
    @ApiOperation({
        summary: 'Pay an order via one or more provider allocations',
        description:
            'Allocations sum must match order total. Omit `provider` in an allocation to use the configured fallback chain. Pass an `Idempotency-Key` header to make retries safe — replaying the same key returns the original payment without re-charging.',
    })
    @ApiHeader({
        name: 'Idempotency-Key',
        required: false,
        description:
            'Optional client-supplied key for retry-safety. A new UUID is generated server-side if omitted.',
    })
    pay(
        @CurrentCustomer() customerId: string,
        @Param('id', ParseUUIDPipe) orderId: string,
        @Body() body: PayOrderDto,
        @Headers('idempotency-key') idempotencyKey: string | undefined,
    ) {
        if (!body.allocations?.length) {
            throw new BadRequestException('At least one allocation is required');
        }
        const key = idempotencyKey?.trim() || randomUUID();
        return this.commands.execute(
            new PayOrderCommand(orderId, customerId, body.allocations, key),
        );
    }

    @Get('payments/:id')
    @ApiOperation({ summary: 'Fetch a payment by id (includes all attempts)' })
    get(@Param('id') id: string) {
        return this.queries.execute(new GetPaymentQuery(id));
    }
}
