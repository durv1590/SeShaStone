import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsPhoneNumber, IsString, Matches } from 'class-validator';

export class CreateAddressDto {
  @IsOptional() @IsString() label?: string;
  @IsString() fullName: string;
  @IsPhoneNumber('IN') phone: string;
  @IsString() line1: string;
  @IsOptional() @IsString() line2?: string;
  @IsOptional() @IsString() landmark?: string;
  @IsString() city: string;
  @IsString() state: string;
  @Matches(/^[1-9][0-9]{5}$/, { message: 'pincode must be a valid 6-digit Indian PIN code' })
  pincode: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
