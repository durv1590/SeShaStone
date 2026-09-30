import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreateCouponDto {
  @Matches(/^[A-Z0-9_-]{3,32}$/, { message: 'code must be 3-32 uppercase letters, digits, _ or -' })
  code: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(DiscountType) type: DiscountType;
  /** Percentage (1-100) for PERCENTAGE, paise for FIXED. */
  @IsInt() @Min(1) value: number;
  @IsOptional() @IsInt() @Min(0) minOrderValue?: number;
  @IsOptional() @IsInt() @Min(0) maxDiscount?: number;
  @IsOptional() @IsInt() @Min(1) usageLimit?: number;
  @IsOptional() @IsInt() @Min(1) perCustomerLimit?: number;
  @IsOptional() @Type(() => Date) @IsDate() startsAt?: Date;
  @IsOptional() @Type(() => Date) @IsDate() endsAt?: Date;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class ValidateCouponDto {
  @IsString() code: string;
  /** Cart subtotal in paise. */
  @IsInt() @Min(0) subtotal: number;
}
