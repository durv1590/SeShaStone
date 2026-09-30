import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { Actor, CurrentActor } from '../common/decorators/actor.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SettingsService } from './settings.service';

class UpdateSettingsDto {
  @IsObject() values: Record<string, unknown>;
  @IsOptional() @IsBoolean() confirmFinancialChange?: boolean;
}

class RevealDto {
  @IsString() key: string;
}

class UploadQrDto {
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() confirm?: boolean;
}

class HistoryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
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
  @RequirePermissions('settings.view')
  @Get('admin/settings')
  adminView() {
    return this.settings.adminView();
  }

  /** Per-key permission checks and financial-change confirmation happen in the service. */
  @ApiBearerAuth()
  @RequirePermissions('settings.view')
  @Put('admin/settings')
  update(@CurrentActor() actor: Actor, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(actor, dto.values, dto.confirmFinancialChange);
  }

  @ApiBearerAuth()
  @RequirePermissions('settings.payment.edit')
  @Post('admin/settings/reveal')
  @HttpCode(200)
  reveal(@CurrentActor() actor: Actor, @Body() dto: RevealDto) {
    return this.settings.reveal(actor, dto.key);
  }

  @ApiBearerAuth()
  @RequirePermissions('settings.view')
  @Get('admin/settings/history')
  history(@Query() q: HistoryDto) {
    return this.settings.history(q.page ?? 1);
  }

  @ApiBearerAuth()
  @RequirePermissions('settings.view')
  @Get('admin/settings/upi-qr')
  upiQr() {
    return this.settings.upiQr();
  }

  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('settings.payment.edit')
  @Post('admin/settings/upi-qr')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 + 1, files: 1 } }))
  uploadUpiQr(
    @CurrentActor() actor: Actor,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadQrDto,
  ) {
    return this.settings.uploadUpiQr(actor, file, !!dto.confirm);
  }

  @ApiBearerAuth()
  @RequirePermissions('settings.payment.edit')
  @Delete('admin/settings/upi-qr')
  removeUpiQr(@CurrentActor() actor: Actor) {
    return this.settings.removeUpiQr(actor);
  }
}
