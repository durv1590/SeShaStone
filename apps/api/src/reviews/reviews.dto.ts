import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ReviewStatus } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

export class CreateReviewDto {
  @IsString() productId: string;
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(4000) body?: string;
}

export class ModerateReviewDto {
  @IsEnum(ReviewStatus) status: ReviewStatus;
}

export class ListReviewsDto extends PaginationDto {
  @IsOptional() @IsEnum(ReviewStatus) status?: ReviewStatus;
}
