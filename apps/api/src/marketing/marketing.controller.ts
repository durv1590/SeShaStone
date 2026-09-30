import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CreateCampaignDto, SubscribeDto, UpdateCampaignDto } from './marketing.dto';
import { MarketingService } from './marketing.service';

@ApiTags('marketing')
@Controller()
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Public()
  @Post('newsletter/subscribe')
  @HttpCode(200)
  subscribe(@Body() dto: SubscribeDto) {
    return this.marketing.subscribe(dto);
  }

  @Public()
  @Post('newsletter/unsubscribe')
  @HttpCode(200)
  unsubscribe(@Body() dto: SubscribeDto) {
    return this.marketing.unsubscribe(dto.email);
  }

  @ApiBearerAuth()
  @RequirePermissions('marketing.manage')
  @Get('admin/marketing/subscribers')
  subscribers(@Query() query: PaginationDto) {
    return this.marketing.subscribers(query);
  }

  @ApiBearerAuth()
  @RequirePermissions('marketing.manage')
  @Get('admin/marketing/campaigns')
  campaigns() {
    return this.marketing.campaigns();
  }

  @ApiBearerAuth()
  @RequirePermissions('marketing.manage')
  @Post('admin/marketing/campaigns')
  createCampaign(@Body() dto: CreateCampaignDto) {
    return this.marketing.createCampaign(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('marketing.manage')
  @Patch('admin/marketing/campaigns/:id')
  updateCampaign(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.marketing.updateCampaign(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('marketing.manage')
  @Post('admin/marketing/campaigns/:id/cancel')
  @HttpCode(200)
  cancelCampaign(@Param('id') id: string) {
    return this.marketing.cancelCampaign(id);
  }
}
