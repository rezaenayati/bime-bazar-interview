import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
    CreateCustomerCommand,
    GetCustomerQuery,
    TopUpWalletCommand,
} from '@bime-bazar/customer/application';
import { CreateCustomerDto, TopUpWalletDto } from './dtos';

@ApiTags('customers')
@ApiSecurity('X-Api-Key')
@Controller('customers')
export class CustomerController {
    constructor(
        private readonly commands: CommandBus,
        private readonly queries: QueryBus,
    ) {}

    @Post()
    @ApiOperation({ summary: 'Create a customer (seed)' })
    create(@Body() body: CreateCustomerDto) {
        return this.commands.execute(new CreateCustomerCommand(body.email));
    }

    @Get(':id')
    @ApiOperation({ summary: 'Fetch a customer by id (includes wallet balance)' })
    get(@Param('id', ParseUUIDPipe) id: string) {
        return this.queries.execute(new GetCustomerQuery(id));
    }

    @Post(':id/wallet/top-up')
    @ApiOperation({ summary: 'Top up customer wallet (mock funds)' })
    topUp(@Param('id', ParseUUIDPipe) id: string, @Body() body: TopUpWalletDto) {
        return this.commands.execute(new TopUpWalletCommand(id, body.amountCents));
    }
}
