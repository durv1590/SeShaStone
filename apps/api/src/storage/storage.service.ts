import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('s3.bucket')!;
    this.publicUrl = config.get<string>('s3.publicUrl')!;
    this.s3 = new S3Client({
      region: config.get<string>('s3.region'),
      endpoint: config.get<string>('s3.endpoint'),
      forcePathStyle: config.get<boolean>('s3.forcePathStyle'),
      credentials: {
        accessKeyId: config.get<string>('s3.accessKeyId')!,
        secretAccessKey: config.get<string>('s3.secretAccessKey')!,
      },
    });
  }

  /** Returns a short-lived URL the admin panel can PUT a file to directly. */
  async createUploadUrl(folder: string, filename: string, contentType: string) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${folder}/${randomUUID()}-${safeName}`;
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );
    return { key, uploadUrl, publicUrl: `${this.publicUrl}/${key}` };
  }

  async delete(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
