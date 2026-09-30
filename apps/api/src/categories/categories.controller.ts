import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller()
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get('categories')
  tree() {
    return this.categories.tree();
  }

  @Public()
  @Get('categories/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.categories.findBySlug(slug);
  }

  @ApiBearerAuth()
  @RequirePermissions('products.view')
  @Get('admin/categories')
  listAll() {
    return this.categories.listAll();
  }

  @ApiBearerAuth()
  @RequirePermissions('products.manage')
  @Post('admin/categories')
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('products.manage')
  @Patch('admin/categories/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('products.manage')
  @Delete('admin/categories/:id')
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
