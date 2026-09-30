import { Body, Controller, Delete, Get, Param, ParseEnumPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BannerPlacement, Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateBannerDto, CreatePageDto, UpdateBannerDto, UpdatePageDto } from './cms.dto';
import { CmsService } from './cms.service';

@ApiTags('cms')
@Controller()
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  @Public()
  @Get('pages/:slug')
  page(@Param('slug') slug: string) {
    return this.cms.publishedPage(slug);
  }

  @Public()
  @Get('banners')
  banners(
    @Query('placement', new ParseEnumPipe(BannerPlacement, { optional: true }))
    placement?: BannerPlacement,
  ) {
    return this.cms.activeBanners(placement ?? BannerPlacement.HOME_HERO);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/pages')
  listPages() {
    return this.cms.listPages();
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Post('admin/pages')
  createPage(@Body() dto: CreatePageDto) {
    return this.cms.createPage(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('admin/pages/:id')
  updatePage(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    return this.cms.updatePage(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('admin/pages/:id')
  deletePage(@Param('id') id: string) {
    return this.cms.deletePage(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/banners')
  listBanners() {
    return this.cms.listBanners();
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Post('admin/banners')
  createBanner(@Body() dto: CreateBannerDto) {
    return this.cms.createBanner(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('admin/banners/:id')
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.cms.updateBanner(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('admin/banners/:id')
  deleteBanner(@Param('id') id: string) {
    return this.cms.deleteBanner(id);
  }
}
