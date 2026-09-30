import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';
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

/** Site-relative paths or https URLs only — blocks javascript:/data: links in campaign CTAs. */
const SAFE_LINK = /^(\/(?!\/)[\w\-./?=&%#]*|https:\/\/[\w.-]+(\/[\w\-./?=&%#]*)?)$/;

export class CreateBannerDto {
  @IsString() @MaxLength(120) title: string;
  @IsOptional() @IsString() @MaxLength(200) subtitle?: string;
  /** Desktop 1920×700. */
  @IsUrl({ require_tld: false }) imageUrl: string;
  /** Tablet 1280×700. */
  @IsOptional() @IsUrl({ require_tld: false }) tabletImageUrl?: string;
  /** Mobile 1080×1350. */
  @IsOptional() @IsUrl({ require_tld: false }) mobileImageUrl?: string;
  @IsOptional() @IsString() @MaxLength(40) ctaLabel?: string;
  @IsOptional() @Matches(SAFE_LINK, { message: 'link must be a site path like /gold or an https:// URL' }) linkUrl?: string;
  @IsOptional() @IsIn(['ivory', 'charcoal', 'emerald', 'burgundy', 'gold', 'silver', 'festive', 'diwali', 'bridal'])
  theme?: string;
  @IsOptional() @IsEnum(BannerPlacement) placement?: BannerPlacement;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Date) @IsDate() startsAt?: Date;
  @IsOptional() @Type(() => Date) @IsDate() endsAt?: Date;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}
