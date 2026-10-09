/** Longest edge kept for product photos: sharp on large screens and zoom, without multi-megabyte files. */
export const MAX_EDGE = 2000;
/** Below this shortest edge a photo looks soft in the product gallery. */
export const MIN_GOOD_EDGE = 1000;

export interface PreparedImage {
  blob: Blob;
  type: string;
  width: number;
  height: number;
  originalBytes: number;
  lowResolution: boolean;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Prepares a photo for upload in the browser: applies the camera's rotation, scales it so the
 * longest edge is at most MAX_EDGE px and re-encodes it as WebP (JPEG where WebP encoding is not
 * supported). Phone photos of 4–12 MB typically become 200–600 KB. If re-encoding would not make
 * the file smaller, the original is kept.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const heic = /\.(heic|heif)$/i.test(file.name) || /hei[cf]/.test(file.type);
    throw new Error(
      heic
        ? `${file.name}: this browser cannot open HEIC photos. Export it as JPEG, or set the iPhone camera to "Most Compatible".`
        : `${file.name}: this file could not be read as an image`,
    );
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const lowResolution = Math.min(bitmap.width, bitmap.height) < MIN_GOOD_EDGE;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process images');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob = await canvasToBlob(canvas, 'image/webp', 0.86);
  if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', 0.88);
  if (!blob) throw new Error(`${file.name}: the image could not be converted`);

  if (scale === 1 && blob.size >= file.size && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { blob: file, type: file.type, width, height, originalBytes: file.size, lowResolution };
  }
  return { blob, type: blob.type, width, height, originalBytes: file.size, lowResolution };
}

export const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
