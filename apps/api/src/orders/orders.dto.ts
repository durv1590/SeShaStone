import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderStatus, PaymentProvider } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

export class CheckoutItemDto {
  @IsString() variantId: string;
  @IsInt() @Min(1) @Max(10) quantity: number;
}

export class CheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];

  @IsString() addressId: string;
  @IsOptional() @IsString() couponCode?: string;
  @IsEnum(PaymentProvider) paymentProvider: PaymentProvider;
  @IsOptional() @IsString() notes?: string;
}

export class QuoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];

  @IsOptional() @IsString() couponCode?: string;
}

export class ListOrdersDto extends PaginationDto {
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsString() q?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus) status: OrderStatus;
  @IsOptional() @IsString() trackingNumber?: string;
}
