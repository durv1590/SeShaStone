import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
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
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/categories')
  listAll() {
    return this.categories.listAll();
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Post('admin/categories')
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('admin/categories/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('admin/categories/:id')
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
