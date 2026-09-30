import * as jpeg from 'jpeg-js';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { sniffFileType } from './file-type';

export interface UpiPayload {
  uri: string;
  upiId: string; // pa
  payeeName: string | null; // pn
  merchantCode: string | null; // mc (0000 = personal account)
}

/** Decodes the QR code in a PNG/JPEG image. Returns null if no QR can be read. */
export function decodeQrImage(buf: Buffer): string | null {
  const type = sniffFileType(buf);
  let width: number;
  let height: number;
  let data: Uint8Array;
  if (type === 'image/png') {
    const png = PNG.sync.read(buf);
    ({ width, height } = png);
    data = png.data;
  } else if (type === 'image/jpeg') {
    const img = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 256 });
    ({ width, height } = img);
    data = img.data;
  } else {
    return null;
  }
  const result = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width, height, {
    inversionAttempts: 'attemptBoth',
  });
  return result?.data ?? null;
}

/** Parses a `upi://pay?...` URI. Returns null for anything that is not a UPI payment URI. */
export function parseUpiUri(uri: string): UpiPayload | null {
  if (!/^upi:\/\/pay\?/i.test(uri)) return null;
  const params = new URLSearchParams(uri.slice(uri.indexOf('?') + 1));
  const upiId = params.get('pa')?.trim();
  if (!upiId || !/^[\w.\-]{2,256}@[a-zA-Z][\w.\-]{1,64}$/.test(upiId)) return null;
  const payeeName = params.get('pn')?.replace(/\s+/g, ' ').trim() || null;
  return { uri, upiId, payeeName, merchantCode: params.get('mc') };
}

/** UPI IDs are case-insensitive. */
export function sameUpiId(a: string | null | undefined, b: string | null | undefined) {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}
