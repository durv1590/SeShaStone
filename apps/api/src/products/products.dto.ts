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
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { JewelleryLine, MetalType, ProductStatus } from '@prisma/client';
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
  /** Gross weight in grams. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) weightGrams?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) netWeightGrams?: number;
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
  /** Gold / Silver / Diamond / Artificial — required to publish a product. */
  @IsOptional() @IsEnum(JewelleryLine) line?: JewelleryLine;
  @IsOptional() @IsEnum(MetalType) metal?: MetalType;
  @IsOptional() @IsString() purity?: string;
  @IsOptional() @IsString() gemstone?: string;
  @IsOptional() @IsBoolean() isCertified?: boolean;
  @IsOptional() @IsUrl({ require_tld: false }) certificateUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(30) tags?: string[];
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsBoolean() isFeatured?: boolean;

  // Line-specific attributes — enter only verified information.
  @IsOptional() @IsString() @MaxLength(20) hallmarkId?: string;
  @IsOptional() @IsString() @MaxLength(80) finish?: string;
  @IsOptional() @IsString() @MaxLength(80) baseMaterial?: string;
  @IsOptional() @IsString() @MaxLength(80) plating?: string;
  @IsOptional() @IsString() @MaxLength(80) stoneType?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) diamondCarat?: number;
  @IsOptional() @IsString() @MaxLength(40) diamondCut?: string;
  @IsOptional() @IsString() @MaxLength(20) diamondColour?: string;
  @IsOptional() @IsString() @MaxLength(20) diamondClarity?: string;
  @IsOptional() @IsString() @MaxLength(60) certificateNumber?: string;
  @IsOptional() @IsString() @MaxLength(120) dimensions?: string;
  @IsOptional() @IsString() @MaxLength(2000) careInstructions?: string;
  @IsOptional() @IsString() @MaxLength(2000) shippingInfo?: string;
  @IsOptional() @IsBoolean() isReturnEligible?: boolean;
  @IsOptional() @IsUrl({ require_tld: false }) videoUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20) collectionIds?: string[];

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
  @IsOptional() @IsString() category?: string; // subcategory slug, e.g. rings
  @IsOptional() @IsEnum(JewelleryLine) line?: JewelleryLine;
  @IsOptional() @IsString() collection?: string; // collection slug
  @IsOptional() @IsString() size?: string;
  @IsOptional() @IsString() tag?: string; // occasion / style tag
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() inStock?: boolean;
  @IsOptional() @IsEnum(MetalType) metal?: MetalType;
  @IsOptional() @IsString() gemstone?: string;
  @IsOptional() @Type(() => Number) @IsInt() minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() maxPrice?: number;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()
  featured?: boolean;
  @IsOptional() @IsIn(['newest', 'price_asc', 'price_desc', 'bestselling'])
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'bestselling';
}

export class AdminListProductsDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(JewelleryLine) line?: JewelleryLine;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
}
