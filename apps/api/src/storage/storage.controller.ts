import { Body, Controller, Headers, HttpCode, PayloadTooLargeException, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import { Request } from 'express';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { MAX_UPLOAD_BYTES, StorageService, UPLOAD_FOLDERS } from './storage.service';

class CreateUploadDto {
  @IsIn(UPLOAD_FOLDERS)
  folder: string;

  @IsString()
  filename: string;

  @Matches(/^(image\/(jpeg|png|webp|avif)|application\/pdf)$/)
  contentType: string;
}

/** Reads a raw request body, refusing anything larger than MAX_UPLOAD_BYTES. */
function readBody(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) {
        req.destroy();
        reject(new PayloadTooLargeException('Files must be 10 MB or smaller'));
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

@ApiTags('storage')
@Controller()
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @ApiBearerAuth()
  @RequirePermissions('media.upload')
  @Post('admin/uploads')
  createUploadUrl(@Body() dto: CreateUploadDto) {
    return this.storage.createUploadUrl(dto.folder, dto.filename, dto.contentType);
  }

  /** Target of the signed links issued above when STORAGE_DRIVER=local. The signature is the authorisation. */
  @Public()
  @Put('uploads/local')
  @HttpCode(200)
  async uploadLocal(
    @Query() query: Record<string, string>,
    @Headers('content-type') contentType: string | undefined,
    @Req() req: Request,
  ) {
    return this.storage.saveLocal(query, contentType, await readBody(req));
  }
}
