import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsInt, IsOptional, IsString, IsUrl, Matches } from 'class-validator';
import { BannerPlacement } from '@prisma/client';

export class CreatePageDto {
  @Matches(/^[a-z0-9-]+$/) slug: string;
  @IsString() title: string;
  @IsString() content: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
}

export class UpdatePageDto extends PartialType(CreatePageDto) {}

export class CreateBannerDto {
  @IsString() title: string;
  @IsOptional() @IsString() subtitle?: string;
  @IsUrl({ require_tld: false }) imageUrl: string;
  @IsOptional() @IsString() linkUrl?: string;
  @IsOptional() @IsEnum(BannerPlacement) placement?: BannerPlacement;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Date) @IsDate() startsAt?: Date;
  @IsOptional() @Type(() => Date) @IsDate() endsAt?: Date;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}
