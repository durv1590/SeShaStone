import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { StorageService } from './storage.service';

class CreateUploadDto {
  @IsIn(['products', 'categories', 'banners', 'cms', 'certificates'])
  folder: string;

  @IsString()
  filename: string;

  @Matches(/^(image\/(jpeg|png|webp|avif)|application\/pdf)$/)
  contentType: string;
}

@ApiTags('storage')
@ApiBearerAuth()
@Controller('admin/uploads')
@Roles(Role.ADMIN, Role.STAFF)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  createUploadUrl(@Body() dto: CreateUploadDto) {
    return this.storage.createUploadUrl(dto.folder, dto.filename, dto.contentType);
  }
}
