import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { sniffFileType } from '../common/utils/file-type';

export const UPLOAD_FOLDERS = ['products', 'categories', 'collections', 'banners', 'cms', 'certificates'] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'application/pdf': '.pdf',
};
/** Keys are always generated here: a known folder, a UUID and an extension derived from the type. */
const KEY_PATTERN = new RegExp(`^(${UPLOAD_FOLDERS.join('|')})/[0-9a-f-]{36}\\.(jpg|png|webp|avif|pdf)$`);
const UPLOAD_TTL_SECONDS = 300;

/** Real type of an uploaded file from its bytes, including AVIF (an ISO-BMFF "ftyp avif" box). */
export function detectUploadType(buf: Buffer) {
  const sniffed = sniffFileType(buf);
  if (sniffed) return sniffed;
  const brand = buf.length >= 12 ? buf.toString('ascii', 4, 12) : '';
  return brand === 'ftypavif' || brand === 'ftypavis' ? 'image/avif' : null;
}

@Injectable()
export class StorageService {
  private readonly driver: 'local' | 's3';
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly mediaDir: string;
  private readonly apiPublicUrl: string;
  private readonly signingKey: string;

  constructor(config: ConfigService) {
    this.driver = config.get<'local' | 's3'>('storage.driver') ?? 's3';
    this.bucket = config.get<string>('s3.bucket')!;
    this.mediaDir = config.get<string>('storage.mediaDir')!;
    this.apiPublicUrl = config.get<string>('storage.apiPublicUrl')!.replace(/\/$/, '');
    this.signingKey = `upload:${config.get<string>('jwt.secret')}`;
    this.publicUrl = (this.driver === 'local' ? config.get<string>('storage.mediaUrl') : config.get<string>('s3.publicUrl'))!.replace(/\/$/, '');
    this.s3 =
      this.driver === 's3'
        ? new S3Client({
            region: config.get<string>('s3.region'),
            endpoint: config.get<string>('s3.endpoint'),
            forcePathStyle: config.get<boolean>('s3.forcePathStyle'),
            credentials: {
              accessKeyId: config.get<string>('s3.accessKeyId')!,
              secretAccessKey: config.get<string>('s3.secretAccessKey')!,
            },
          })
        : null;
  }

  /** Returns a short-lived URL the admin panel can PUT a file to directly. */
  async createUploadUrl(folder: string, _filename: string, contentType: string) {
    const key = `${folder}/${randomUUID()}${EXTENSIONS[contentType] ?? ''}`;
    const publicUrl = `${this.publicUrl}/${key}`;
    if (this.driver === 'local') {
      const exp = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS;
      const query = new URLSearchParams({ key, type: contentType, exp: String(exp), sig: this.sign(key, contentType, exp) });
      return { key, uploadUrl: `${this.apiPublicUrl}/uploads/local?${query}`, publicUrl };
    }
    const uploadUrl = await getSignedUrl(
      this.s3!,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: UPLOAD_TTL_SECONDS },
    );
    return { key, uploadUrl, publicUrl };
  }

  /** Stores a file sent to a signed local upload link, after checking the signature, expiry and real file type. */
  async saveLocal(params: { key?: string; type?: string; exp?: string; sig?: string }, contentType: string | undefined, body: Buffer) {
    const { key = '', type = '', exp = '', sig = '' } = params;
    if (this.driver !== 'local') throw new ForbiddenException('Local uploads are disabled');
    if (!KEY_PATTERN.test(key) || !EXTENSIONS[type] || !/^\d+$/.test(exp)) throw new BadRequestException('Invalid upload link');
    if (!this.validSignature(sig, this.sign(key, type, Number(exp)))) throw new ForbiddenException('Invalid upload link');
    if (Number(exp) < Date.now() / 1000) throw new ForbiddenException('Upload link expired; try again');
    if (contentType?.split(';')[0].trim() !== type) throw new BadRequestException(`Content-Type must be ${type}`);
    if (!body.length) throw new BadRequestException('Empty file');
    if (detectUploadType(body) !== type) throw new BadRequestException('The file content does not match its type');

    const path = join(this.mediaDir, key);
    await mkdir(dirname(path), { recursive: true });
    // "wx" never overwrites: every key is used once.
    await writeFile(path, body, { flag: 'wx' }).catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'EEXIST') throw new ForbiddenException('Upload link already used');
      throw err;
    });
    return { key };
  }

  async delete(key: string) {
    if (this.driver === 'local') {
      if (!KEY_PATTERN.test(key)) throw new BadRequestException('Invalid key');
      await unlink(join(this.mediaDir, key)).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== 'ENOENT') throw err;
      });
      return;
    }
    await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private sign(key: string, type: string, exp: number) {
    return createHmac('sha256', this.signingKey).update(`${key}\n${type}\n${exp}`).digest('base64url');
  }

  private validSignature(given: string, expected: string) {
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
