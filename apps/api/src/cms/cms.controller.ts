import { Body, Controller, Delete, Get, Param, ParseEnumPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BannerPlacement } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
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
  @RequirePermissions('content.manage')
  @Get('admin/pages')
  listPages() {
    return this.cms.listPages();
  }

  @ApiBearerAuth()
  @RequirePermissions('content.manage')
  @Post('admin/pages')
  createPage(@Body() dto: CreatePageDto) {
    return this.cms.createPage(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('content.manage')
  @Patch('admin/pages/:id')
  updatePage(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    return this.cms.updatePage(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('content.manage')
  @Delete('admin/pages/:id')
  deletePage(@Param('id') id: string) {
    return this.cms.deletePage(id);
  }

  @ApiBearerAuth()
  @RequirePermissions('content.manage')
  @Get('admin/banners')
  listBanners() {
    return this.cms.listBanners();
  }

  @ApiBearerAuth()
  @RequirePermissions('content.manage')
  @Post('admin/banners')
  createBanner(@Body() dto: CreateBannerDto) {
    return this.cms.createBanner(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('content.manage')
  @Patch('admin/banners/:id')
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.cms.updateBanner(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('content.manage')
  @Delete('admin/banners/:id')
  deleteBanner(@Param('id') id: string) {
    return this.cms.deleteBanner(id);
  }
}
