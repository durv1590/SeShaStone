import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import {
  AdminListProductsDto,
  CreateProductDto,
  ListProductsDto,
  ProductVariantDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './products.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get('products')
  list(@Query() query: ListProductsDto) {
    return this.products.list(query);
  }

  @Public()
  @Get('products/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.products.findBySlug(slug);
  }

  @ApiBearerAuth()
  @RequirePermissions('products.view')
  @Get('admin/products')
  adminList(@Query() query: AdminListProductsDto) {
    return this.products.adminList(query);
  }

  @ApiBearerAuth()
  @RequirePermissions('products.manage')
  @Post('admin/products/reindex')
  reindex() {
    return this.products.reindexAll();
  }

  @ApiBearerAuth()
  @RequirePermissions('products.view')
  @Get('admin/products/:id')
  adminGet(@Param('id') id: string) {
    return this.products.adminGet(id);
  }

  @ApiBearerAuth()
  @RequirePermissions('products.manage')
  @Post('admin/products')
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('products.manage')
  @Patch('admin/products/:id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('products.manage')
  @Delete('admin/products/:id')
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }

  @ApiBearerAuth()
  @RequirePermissions('products.manage')
  @Post('admin/products/:id/variants')
  addVariant(@Param('id') id: string, @Body() dto: ProductVariantDto) {
    return this.products.addVariant(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('products.manage')
  @Patch('admin/variants/:variantId')
  updateVariant(@Param('variantId') variantId: string, @Body() dto: UpdateVariantDto) {
    return this.products.updateVariant(variantId, dto);
  }
}
