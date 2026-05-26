import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CreateOrderCommand, GetMyOrdersQuery, GetOrderQuery } from '@bime-bazar/order/application';
import { CurrentCustomer, CustomerIdGuard } from '@bime-bazar/shared/infra';
import { CreateOrderDto } from './dtos';

@ApiTags('orders')
@ApiSecurity('X-Api-Key')
@ApiSecurity('X-Customer-Id')
@UseGuards(CustomerIdGuard)
@Controller('orders')
export class OrderController {
    constructor(
        private readonly commands: CommandBus,
        private readonly queries: QueryBus,
    ) {}

    @Post()
    @ApiOperation({ summary: 'Create a new order for the current customer (status=pending)' })
    create(@CurrentCustomer() customerId: string, @Body() body: CreateOrderDto) {
        return this.commands.execute(new CreateOrderCommand(customerId, body.items));
    }

    @Get()
    @ApiOperation({ summary: "List the current customer's orders" })
    list(@CurrentCustomer() customerId: string) {
        return this.queries.execute(new GetMyOrdersQuery(customerId));
    }

    @Get(':id')
    @ApiOperation({ summary: 'Fetch a specific order belonging to the current customer' })
    get(@CurrentCustomer() customerId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.queries.execute(new GetOrderQuery(id, customerId));
    }
}
