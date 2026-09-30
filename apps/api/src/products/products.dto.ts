import { OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MetalType, ProductStatus } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

export class ProductImageDto {
  @IsUrl({ require_tld: false }) url: string;
  @IsOptional() @IsString() alt?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class ProductVariantDto {
  @IsString() sku: string;
  @IsString() title: string;
  @IsOptional() @IsString() size?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) weightGrams?: number;
  /** Price in paise. */
  @IsInt() @Min(0) price: number;
  @IsOptional() @IsInt() @Min(0) compareAtPrice?: number;
  @IsOptional() @IsInt() @Min(0) makingCharges?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(28) gstRate?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Initial on-hand stock (create only). */
  @IsOptional() @IsInt() @Min(0) stock?: number;
}

export class CreateProductDto {
  @IsString() name: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsEnum(MetalType) metal?: MetalType;
  @IsOptional() @IsString() purity?: string;
  @IsOptional() @IsString() gemstone?: string;
  @IsOptional() @IsBoolean() isCertified?: boolean;
  @IsOptional() @IsUrl({ require_tld: false }) certificateUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(30) tags?: string[];
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsBoolean() isFeatured?: boolean;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => ProductVariantDto)
  variants: ProductVariantDto[];
}

/** Variants are managed through their own endpoints once a product exists. */
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['variants'])) {}

export class UpdateVariantDto extends PartialType(OmitType(ProductVariantDto, ['stock'])) {}

export class ListProductsDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() category?: string; // category slug
  @IsOptional() @IsEnum(MetalType) metal?: MetalType;
  @IsOptional() @IsString() gemstone?: string;
  @IsOptional() @Type(() => Number) @IsInt() minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() maxPrice?: number;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()
  featured?: boolean;
  @IsOptional() @IsIn(['newest', 'price_asc', 'price_desc']) sort?: 'newest' | 'price_asc' | 'price_desc';
}

export class AdminListProductsDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
}
