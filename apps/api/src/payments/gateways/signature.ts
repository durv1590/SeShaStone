import { createHmac, timingSafeEqual } from 'node:crypto';

export function hmacSha256(secret: string, data: string | Buffer, encoding: 'hex' | 'base64') {
  return createHmac('sha256', secret).update(data).digest(encoding);
}

export function safeEqual(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
