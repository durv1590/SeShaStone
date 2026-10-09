import { IsBoolean, IsEnum, IsOptional, IsPhoneNumber, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

export class UpdateProfileDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsPhoneNumber('IN') phone?: string;
  @IsOptional() @IsBoolean() marketingOptIn?: boolean;
}

export class AdminUpdateCustomerDto extends UpdateProfileDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsEnum(Role) role?: Role;
}

export class ListCustomersDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
}
