import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
    CreateProductCommand,
    GetProductQuery,
    ListProductsQuery,
} from '@bime-bazar/product/application';
import { CreateProductDto } from './dtos';

@ApiTags('products')
@ApiSecurity('X-Api-Key')
@Controller('products')
export class ProductController {
    constructor(
        private readonly commands: CommandBus,
        private readonly queries: QueryBus,
    ) {}

    @Post()
    @ApiOperation({ summary: 'Create a product (seed)' })
    create(@Body() body: CreateProductDto) {
        return this.commands.execute(new CreateProductCommand(body.name, body.priceCents));
    }

    @Get()
    @ApiOperation({ summary: 'List all products' })
    list() {
        return this.queries.execute(new ListProductsQuery());
    }

    @Get(':id')
    @ApiOperation({ summary: 'Fetch one product' })
    get(@Param('id', ParseUUIDPipe) id: string) {
        return this.queries.execute(new GetProductQuery(id));
    }
}
