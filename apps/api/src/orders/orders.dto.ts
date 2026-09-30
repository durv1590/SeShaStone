import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsEmail,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
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
  /** Omit when billing address is the same as delivery. */
  @IsOptional() @IsString() billingAddressId?: string;
  @IsOptional() @IsString() couponCode?: string;
  @IsEnum(PaymentProvider) paymentProvider: PaymentProvider;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  /** Client-generated UUID per checkout attempt; resubmitting returns the same order. */
  @IsOptional() @IsUUID() idempotencyKey?: string;
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
  @IsOptional() @IsString() @MaxLength(60) trackingNumber?: string;
  @IsOptional() @IsString() @MaxLength(60) courier?: string;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class ReturnRequestDto {
  @IsString() @MinLength(5) @MaxLength(1000) reason: string;
}

export class TrackOrderDto {
  @IsString() @MaxLength(40) orderNumber: string;
  @IsEmail() email: string;
}
