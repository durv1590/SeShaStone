import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, NotEquals } from 'class-validator';
import { PaginationDto } from '../common/dto/pagination.dto';

export class AdjustStockDto {
  /** Positive to add stock, negative to remove. */
  @IsInt() @NotEquals(0) delta: number;
  @IsIn(['RESTOCK', 'ADJUSTMENT', 'RETURN']) type: 'RESTOCK' | 'ADJUSTMENT' | 'RETURN';
  @IsOptional() @IsString() reason?: string;
}

export class UpdateThresholdDto {
  @IsInt() @Min(0) lowStockThreshold: number;
}

export class ListInventoryDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()
  lowStock?: boolean;
}
