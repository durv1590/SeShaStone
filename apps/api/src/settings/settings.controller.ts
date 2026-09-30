import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsObject } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SETTING_DEFAULTS, SettingsService } from './settings.service';

class UpdateSettingsDto {
  @IsObject() values: Record<string, unknown>;
}

@ApiTags('settings')
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('settings')
  publicSettings() {
    return this.settings.publicSettings();
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/settings')
  all() {
    return this.settings.all();
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Put('admin/settings')
  update(@Body() dto: UpdateSettingsDto) {
    const unknown = Object.keys(dto.values).filter((k) => !(k in SETTING_DEFAULTS));
    if (unknown.length) throw new BadRequestException(`Unknown setting(s): ${unknown.join(', ')}`);
    return this.settings.update(dto.values);
  }
}
