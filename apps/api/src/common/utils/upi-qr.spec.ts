import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sniffFileType } from './file-type';
import { maskTail } from './mask';
import { decodeQrImage, parseUpiUri, sameUpiId } from './upi-qr';

const QR_PATH = join(__dirname, '../../../../../public/payment/upi-qr/current-upi-qr.png');

describe('UPI QR utilities', () => {
  it('decodes the stored original QR into a UPI payment URI', () => {
    const uri = decodeQrImage(readFileSync(QR_PATH));
    expect(uri).toMatch(/^upi:\/\/pay\?/);
    const parsed = parseUpiUri(uri!);
    expect(parsed?.upiId).toMatch(/@/);
  });

  it('rejects non-UPI URIs and malformed payee addresses', () => {
    expect(parseUpiUri('https://example.com')).toBeNull();
    expect(parseUpiUri('upi://pay?pn=NoAddress')).toBeNull();
    expect(parseUpiUri('upi://pay?pa=not-a-vpa')).toBeNull();
  });

  it('parses payee name and merchant code', () => {
    const p = parseUpiUri('upi://pay?pa=shop@ybl&pn=A%20%20B&mc=0000');
    expect(p).toMatchObject({ upiId: 'shop@ybl', payeeName: 'A B', merchantCode: '0000' });
  });

  it('compares UPI IDs case-insensitively', () => {
    expect(sameUpiId('Shop@YBL', 'shop@ybl')).toBe(true);
    expect(sameUpiId('shop@ibl', 'shop@ybl')).toBe(false);
  });

  it('sniffs file types from magic bytes, not names', () => {
    expect(sniffFileType(readFileSync(QR_PATH))).toBe('image/png');
    expect(sniffFileType(Buffer.from('%PDF-1.7 ...'))).toBe('application/pdf');
    expect(sniffFileType(Buffer.from('<script>alert(1)</script>'))).toBeNull();
  });

  it('masks account numbers', () => {
    expect(maskTail('12345678901')).toBe('•••••••8901');
    expect(maskTail('')).toBe('');
  });
});
