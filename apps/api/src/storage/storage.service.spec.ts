import { ConfigService } from '@nestjs/config';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StorageService } from './storage.service';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

describe('StorageService (local driver)', () => {
  let dir: string;
  let storage: StorageService;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'media-'));
    const values: Record<string, unknown> = {
      'storage.driver': 'local',
      'storage.mediaDir': dir,
      'storage.mediaUrl': 'https://www.example.com/media/',
      'storage.apiPublicUrl': 'https://api.example.com/api/v1',
      'jwt.secret': 'test-secret',
      's3.bucket': 'unused',
    };
    storage = new StorageService({ get: (k: string) => values[k] } as unknown as ConfigService);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const link = async (type = 'image/png') => {
    const res = await storage.createUploadUrl('products', 'ring.png', type);
    return { ...res, params: Object.fromEntries(new URL(res.uploadUrl).searchParams) };
  };

  it('issues a signed link on the API and a public URL under the media path', async () => {
    const { key, uploadUrl, publicUrl } = await link();
    expect(key).toMatch(/^products\/[0-9a-f-]{36}\.png$/);
    expect(uploadUrl.startsWith('https://api.example.com/api/v1/uploads/local?')).toBe(true);
    expect(publicUrl).toBe(`https://www.example.com/media/${key}`);
  });

  it('saves a valid upload to disk', async () => {
    const { key, params } = await link();
    await storage.saveLocal(params, 'image/png', PNG);
    expect(readFileSync(join(dir, key)).equals(PNG)).toBe(true);
  });

  it('rejects a tampered signature, a changed key and a path traversal key', async () => {
    const { params } = await link();
    const tampered = (params.sig[0] === 'A' ? 'B' : 'A') + params.sig.slice(1);
    await expect(storage.saveLocal({ ...params, sig: tampered }, 'image/png', PNG)).rejects.toThrow('Invalid upload link');
    await expect(storage.saveLocal({ ...params, key: params.key.replace('products', 'banners') }, 'image/png', PNG)).rejects.toThrow('Invalid upload link');
    await expect(storage.saveLocal({ ...params, key: '../../etc/passwd' }, 'image/png', PNG)).rejects.toThrow('Invalid upload link');
  });

  it('rejects an expired link', async () => {
    const { params } = await link();
    jest.spyOn(Date, 'now').mockReturnValue((Number(params.exp) + 1) * 1000);
    await expect(storage.saveLocal(params, 'image/png', PNG)).rejects.toThrow('expired');
    jest.restoreAllMocks();
  });

  it('rejects content that is not what the link was issued for', async () => {
    const { params } = await link();
    await expect(storage.saveLocal(params, 'image/png', Buffer.from('<script>alert(1)</script>'))).rejects.toThrow('does not match');
    await expect(storage.saveLocal(params, 'text/html', PNG)).rejects.toThrow('Content-Type must be image/png');
  });

  it('never lets a link be used twice', async () => {
    const { params } = await link();
    await storage.saveLocal(params, 'image/png', PNG);
    await expect(storage.saveLocal(params, 'image/png', PNG)).rejects.toThrow('already used');
  });
});
