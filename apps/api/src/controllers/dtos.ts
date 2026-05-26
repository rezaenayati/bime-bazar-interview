import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsEmail,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerDto {
    @ApiProperty({ example: 'alice@example.com' })
    @IsEmail()
    email!: string;
}

export class TopUpWalletDto {
    @ApiProperty({ example: 5000, description: 'Amount in cents' })
    @IsInt()
    @Min(1)
    amountCents!: number;
}

export class CreateProductDto {
    @ApiProperty({ example: 'Widget' })
    @IsString()
    name!: string;

    @ApiProperty({ example: 1999, description: 'Price in cents' })
    @IsInt()
    @Min(1)
    priceCents!: number;
}

export class OrderItemRequestDto {
    @ApiProperty()
    @IsString()
    productId!: string;

    @ApiProperty({ example: 2 })
    @IsInt()
    @Min(1)
    quantity!: number;
}

export class CreateOrderDto {
    @ApiProperty({ type: [OrderItemRequestDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => OrderItemRequestDto)
    items!: OrderItemRequestDto[];
}

export class PaymentAllocationDto {
    @ApiProperty({
        description:
            'Provider name (e.g. `wallet`, `stripe`, `paypal`). Omit to fall through the configured `PAYMENT_PROVIDER_CHAIN`. The set of accepted values is determined at runtime by which providers are registered — see `GET /docs` for current state or the startup log line "registered providers: ...". Unknown values are rejected by the handler with a 400 that includes the live list.',
        required: false,
        example: 'wallet',
    })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    @Matches(/^[a-z0-9_-]+$/, {
        message: 'provider must be lowercase alphanumeric with underscores or hyphens',
    })
    provider?: string;

    @ApiProperty({ example: 1999, description: 'Amount in cents to charge via this allocation' })
    @IsInt()
    @Min(1)
    amountCents!: number;
}

export class PayOrderDto {
    @ApiProperty({
        type: [PaymentAllocationDto],
        description:
            'List of allocations. Sum of amountCents must equal order total. Pass a single entry without `provider` to use the full fallback chain.',
    })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => PaymentAllocationDto)
    allocations!: PaymentAllocationDto[];
}
