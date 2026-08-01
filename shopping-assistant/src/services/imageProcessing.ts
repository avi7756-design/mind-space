import type { ProcessedImage } from '../types';

// Client-side image intake: validate, decode with the correct orientation, resize
// and compress. Nothing leaves the device here — the result is simply a Blob that
// a future recognition backend can receive as-is.

export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const MAX_EDGE = 1280;
export const TARGET_BYTES = Math.round(1.5 * 1024 * 1024);
export const INITIAL_QUALITY = 0.82;
export const MIN_QUALITY = 0.6;
export const QUALITY_STEP = 0.08;
export const MAX_COMPRESSION_PASSES = 4;

export type ImageErrorCode = 'not-an-image' | 'file-too-large' | 'decode-failed' | 'encode-failed';

const ERROR_MESSAGES: Record<ImageErrorCode, string> = {
  'not-an-image': 'הקובץ שנבחר אינו תמונה. בחרו קובץ JPG, PNG או WebP.',
  'file-too-large': 'הקובץ גדול מ‑20MB. בחרו תמונה קטנה יותר או צלמו מחדש באיכות נמוכה יותר.',
  'decode-failed':
    'הדפדפן לא הצליח לפתוח את התמונה. ייתכן שהפורמט (למשל HEIC) אינו נתמך במכשיר הזה — נסו לצלם או לשמור כ‑JPG.',
  'encode-failed': 'עיבוד התמונה נכשל. נסו שוב או בחרו תמונה אחרת.',
};

/** Carries a stable code plus a message that is safe to show the user as-is. */
export class ImageProcessingError extends Error {
  readonly code: ImageErrorCode;

  constructor(code: ImageErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'ImageProcessingError';
    this.code = code;
  }
}

export function imageErrorMessage(error: unknown): string {
  return error instanceof ImageProcessingError ? error.message : ERROR_MESSAGES['encode-failed'];
}

/** A decoded bitmap plus the facts the pipeline needs about it. */
export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly source: CanvasImageSource;
  readonly hasAlpha: boolean;
  close(): void;
}

/**
 * Every browser-only capability sits behind this seam, so the pipeline itself is
 * testable without a DOM and the encoder can be swapped later.
 */
export interface ImageProcessingDeps {
  decode(file: File): Promise<DecodedImage>;
  encode(
    image: DecodedImage,
    width: number,
    height: number,
    mimeType: string,
    quality: number,
  ): Promise<Blob | null>;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

const HEIF_EXTENSION = /\.(heic|heif)$/i;
const ALPHA_CAPABLE_TYPES = new Set(['image/png', 'image/webp']);

/** Scales down to fit inside `maxEdge` while keeping the aspect ratio. Never upscales. */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** JPEG unless the source can carry transparency and actually uses it. */
export function outputMimeType(sourceType: string, hasAlpha: boolean): string {
  const type = (sourceType || '').toLowerCase();
  return hasAlpha && ALPHA_CAPABLE_TYPES.has(type) ? type : 'image/jpeg';
}

export function assertAcceptableFile(file: File): void {
  const type = (file.type || '').toLowerCase();
  // An empty type with a HEIF extension is common on iOS; let the decoder decide.
  const looksLikeImage = type.startsWith('image/') || (type === '' && HEIF_EXTENSION.test(file.name));
  if (!looksLikeImage) throw new ImageProcessingError('not-an-image');
  if (file.size > MAX_INPUT_BYTES) throw new ImageProcessingError('file-too-large');
}

export async function processImage(
  file: File,
  deps: ImageProcessingDeps = browserImageDeps(),
): Promise<ProcessedImage> {
  assertAcceptableFile(file);

  let decoded: DecodedImage;
  try {
    decoded = await deps.decode(file);
  } catch {
    throw new ImageProcessingError('decode-failed');
  }
  if (!decoded || !decoded.width || !decoded.height) {
    decoded?.close();
    throw new ImageProcessingError('decode-failed');
  }

  try {
    const { width, height } = fitWithin(decoded.width, decoded.height);
    const mimeType = outputMimeType(file.type, decoded.hasAlpha);
    // PNG ignores the quality argument, so re-encoding it repeatedly is pointless.
    const lossless = mimeType === 'image/png';

    let quality = lossless ? 1 : INITIAL_QUALITY;
    let passes = 0;
    let blob: Blob;

    for (;;) {
      passes += 1;
      let encoded: Blob | null;
      try {
        encoded = await deps.encode(decoded, width, height, mimeType, quality);
      } catch {
        throw new ImageProcessingError('encode-failed');
      }
      if (!encoded) throw new ImageProcessingError('encode-failed');
      blob = encoded;

      if (lossless || blob.size <= TARGET_BYTES || passes >= MAX_COMPRESSION_PASSES) break;
      const next = Number((quality - QUALITY_STEP).toFixed(2));
      if (next < MIN_QUALITY) break;
      quality = next;
    }

    return {
      blob,
      previewUrl: deps.createObjectURL(blob),
      width,
      height,
      mimeType,
      originalFileName: file.name,
      originalSize: file.size,
      processedSize: blob.size,
      quality,
      compressionPasses: passes,
    };
  } finally {
    decoded.close();
  }
}

/** Frees the preview URL. Call on replace, on remove and on unmount. */
export function releasePreview(
  image: Pick<ProcessedImage, 'previewUrl'> | null | undefined,
  deps: Pick<ImageProcessingDeps, 'revokeObjectURL'> = browserImageDeps(),
): void {
  if (image?.previewUrl) deps.revokeObjectURL(image.previewUrl);
}

/** Replaces the held image, revoking the outgoing preview URL first. */
export function swapProcessedImage<T extends Pick<ProcessedImage, 'previewUrl'>>(
  previous: T | null | undefined,
  next: T | null,
  deps: Pick<ImageProcessingDeps, 'revokeObjectURL'> = browserImageDeps(),
): T | null {
  if (previous && previous !== next) releasePreview(previous, deps);
  return next;
}

// ---------- Browser implementation ----------

function canvasFor(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Samples the decoded bitmap at low resolution — enough to tell whether the image
 * really uses its alpha channel without reading megapixels of data.
 */
function detectAlpha(source: CanvasImageSource, width: number, height: number): boolean {
  const { width: w, height: h } = fitWithin(width, height, 64);
  const canvas = canvasFor(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(source, 0, 0, w, h);
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true;
    }
  } catch {
    // A tainted canvas cannot be read; assume opaque rather than failing the upload.
    return false;
  }
  return false;
}

async function decodeViaImageElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function browserImageDeps(): ImageProcessingDeps {
  return {
    async decode(file) {
      const alphaCapable = ALPHA_CAPABLE_TYPES.has((file.type || '').toLowerCase());

      // `imageOrientation: 'from-image'` is what keeps iPhone photos upright.
      if (typeof createImageBitmap === 'function') {
        try {
          const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
          return {
            width: bitmap.width,
            height: bitmap.height,
            source: bitmap,
            hasAlpha: alphaCapable ? detectAlpha(bitmap, bitmap.width, bitmap.height) : false,
            close: () => bitmap.close(),
          };
        } catch {
          // Falls through to the <img> path below (older Safari, unsupported options).
        }
      }

      // Modern browsers apply EXIF orientation to <img> by default, so this stays upright too.
      const img = await decodeViaImageElement(file);
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      return {
        width,
        height,
        source: img,
        hasAlpha: alphaCapable ? detectAlpha(img, width, height) : false,
        close: () => {
          img.src = '';
        },
      };
    },

    encode(image, width, height, mimeType, quality) {
      const canvas = canvasFor(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return Promise.resolve(null);
      if (mimeType === 'image/jpeg') {
        // JPEG has no alpha; without this, transparent areas would render black.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(image.source, 0, 0, width, height);
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), mimeType, quality);
      });
    },

    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  };
}
