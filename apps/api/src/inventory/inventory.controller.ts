import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AdjustStockDto, ListInventoryDto, UpdateThresholdDto } from './inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@RequirePermissions('inventory.manage')
@Controller('admin/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(@Query() query: ListInventoryDto) {
    return this.inventory.list(query);
  }

  @Get(':variantId/history')
  history(@Param('variantId') variantId: string) {
    return this.inventory.history(variantId);
  }

  @Post(':variantId/adjust')
  adjust(@Param('variantId') variantId: string, @Body() dto: AdjustStockDto) {
    return this.inventory.adjust(variantId, dto);
  }

  @Patch(':variantId/threshold')
  setThreshold(@Param('variantId') variantId: string, @Body() dto: UpdateThresholdDto) {
    return this.inventory.setThreshold(variantId, dto.lowStockThreshold);
  }
}
