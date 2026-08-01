import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertAcceptableFile,
  fitWithin,
  ImageProcessingError,
  imageErrorMessage,
  MAX_COMPRESSION_PASSES,
  MAX_EDGE,
  MAX_INPUT_BYTES,
  MIN_QUALITY,
  outputMimeType,
  processImage,
  releasePreview,
  swapProcessedImage,
  TARGET_BYTES,
  type DecodedImage,
  type ImageProcessingDeps,
} from './imageProcessing';

// The pipeline is exercised through the injected seam, so these tests need no DOM,
// no canvas and no real image bytes.

function makeFile(
  name = 'photo.jpg',
  type = 'image/jpeg',
  size = 4 * 1024 * 1024,
): File {
  const file = new File([new Uint8Array(8)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function decoded(width: number, height: number, hasAlpha = false): DecodedImage {
  return {
    width,
    height,
    source: {} as CanvasImageSource,
    hasAlpha,
    close: vi.fn(),
  };
}

interface StubOptions {
  image?: DecodedImage;
  /** Encoded size as a function of quality; defaults to a comfortably small blob. */
  sizeFor?: (quality: number) => number;
  decodeError?: Error;
  encodeResult?: null | (() => never);
}

function stubDeps(options: StubOptions = {}) {
  const image = options.image ?? decoded(4000, 3000);
  const encode = vi.fn(
    async (_image: DecodedImage, _width: number, _height: number, mimeType: string, _quality: number) => {
      if (options.encodeResult === null) return null;
      if (typeof options.encodeResult === 'function') options.encodeResult();
      return new Blob([new Uint8Array(1)], { type: mimeType });
    },
  );
  // Blob.size is derived from its parts, so the stub reports the intended size instead.
  const sizedEncode = vi.fn(async (...args: Parameters<typeof encode>) => {
    const blob = await encode(...args);
    if (!blob) return null;
    const size = options.sizeFor ? options.sizeFor(args[4]) : 120_000;
    Object.defineProperty(blob, 'size', { value: size });
    return blob;
  });

  const deps: ImageProcessingDeps = {
    decode: vi.fn(async () => {
      if (options.decodeError) throw options.decodeError;
      return image;
    }),
    encode: sizedEncode,
    createObjectURL: vi.fn(() => 'blob:preview-1'),
    revokeObjectURL: vi.fn(),
  };
  return { deps, image, encode: sizedEncode };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fitWithin', () => {
  it('leaves a small image untouched instead of upscaling it', () => {
    expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
    expect(fitWithin(MAX_EDGE, 700)).toEqual({ width: MAX_EDGE, height: 700 });
  });

  it('scales the long edge down to the maximum', () => {
    expect(fitWithin(4000, 3000).width).toBe(MAX_EDGE);
    expect(fitWithin(3000, 4000).height).toBe(MAX_EDGE);
  });

  it('preserves the aspect ratio', () => {
    const source = { width: 4032, height: 3024 };
    const result = fitWithin(source.width, source.height);
    expect(result.width / result.height).toBeCloseTo(source.width / source.height, 2);
  });
});

describe('input validation', () => {
  it('rejects a file that is not an image', () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    expect(() => assertAcceptableFile(file)).toThrow(ImageProcessingError);
    try {
      assertAcceptableFile(file);
    } catch (error) {
      expect((error as ImageProcessingError).code).toBe('not-an-image');
      expect(imageErrorMessage(error)).toContain('אינו תמונה');
    }
  });

  it('rejects a file above the 20MB limit before any decoding happens', async () => {
    const file = makeFile('huge.jpg', 'image/jpeg', MAX_INPUT_BYTES + 1);
    const { deps } = stubDeps();
    await expect(processImage(file, deps)).rejects.toMatchObject({ code: 'file-too-large' });
    expect(deps.decode).not.toHaveBeenCalled();
  });

  it('accepts a HEIC file that the browser reports without a MIME type', () => {
    const file = makeFile('IMG_0421.HEIC', '', 3_000_000);
    expect(() => assertAcceptableFile(file)).not.toThrow();
  });
});

describe('processImage', () => {
  it('returns a blob with the full metadata set', async () => {
    const { deps } = stubDeps({ image: decoded(4000, 3000) });
    const file = makeFile('camera.jpg', 'image/jpeg', 5_000_000);
    const result = await processImage(file, deps);

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.width).toBe(MAX_EDGE);
    expect(result.height).toBe(960);
    expect(result.originalFileName).toBe('camera.jpg');
    expect(result.originalSize).toBe(5_000_000);
    expect(result.processedSize).toBe(120_000);
    expect(result.previewUrl).toBe('blob:preview-1');
  });

  it('creates exactly one preview object URL', async () => {
    const { deps } = stubDeps();
    await processImage(makeFile(), deps);
    expect(deps.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('does not modify the original file', async () => {
    const { deps } = stubDeps();
    const file = makeFile('original.jpg', 'image/jpeg', 5_000_000);
    const before = { name: file.name, type: file.type, size: file.size };
    await processImage(file, deps);
    expect({ name: file.name, type: file.type, size: file.size }).toEqual(before);
  });

  it('never performs a network request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network'));
    const { deps } = stubDeps();
    await processImage(makeFile(), deps);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('releases the decoded bitmap even when encoding fails', async () => {
    const image = decoded(2000, 2000);
    const { deps } = stubDeps({ image, encodeResult: null });
    await expect(processImage(makeFile(), deps)).rejects.toMatchObject({ code: 'encode-failed' });
    expect(image.close).toHaveBeenCalledTimes(1);
  });

  it('reports a friendly error when the browser cannot decode the format', async () => {
    const { deps } = stubDeps({ decodeError: new Error('unsupported') });
    await expect(processImage(makeFile('IMG.HEIC', 'image/heic'), deps)).rejects.toMatchObject({
      code: 'decode-failed',
    });
    await processImage(makeFile(), stubDeps().deps).catch(() => undefined);
    const error = new ImageProcessingError('decode-failed');
    expect(error.message).toContain('HEIC');
    expect(error.message).not.toContain('Error');
  });

  it('treats a zero-dimension decode as a decode failure', async () => {
    const image = decoded(0, 0);
    const { deps } = stubDeps({ image });
    await expect(processImage(makeFile(), deps)).rejects.toMatchObject({ code: 'decode-failed' });
    expect(image.close).toHaveBeenCalled();
  });

  it('surfaces a thrown canvas.toBlob as an encode failure', async () => {
    const { deps } = stubDeps({
      encodeResult: () => {
        throw new Error('toBlob exploded');
      },
    });
    await expect(processImage(makeFile(), deps)).rejects.toMatchObject({ code: 'encode-failed' });
  });

  it('keeps the orientation-corrected dimensions the decoder reported', async () => {
    // A portrait iPhone photo decodes as 3024×4032 once EXIF orientation is applied.
    const { deps } = stubDeps({ image: decoded(3024, 4032) });
    const result = await processImage(makeFile(), deps);
    expect(result.height).toBe(MAX_EDGE);
    expect(result.width).toBe(960);
    expect(result.height).toBeGreaterThan(result.width);
  });
});

describe('compression loop', () => {
  const oversized = () => TARGET_BYTES * 3;

  it('lowers quality while the blob is above the size target', async () => {
    const { deps, encode } = stubDeps({ sizeFor: oversized });
    const result = await processImage(makeFile(), deps);
    const qualities = encode.mock.calls.map((call) => call[4]);
    expect(qualities[0]).toBeCloseTo(0.82, 2);
    expect(qualities.at(-1)).toBeLessThan(qualities[0]);
    expect(result.compressionPasses).toBeGreaterThan(1);
  });

  it('never drops below the minimum quality', async () => {
    const { deps, encode } = stubDeps({ sizeFor: oversized });
    const result = await processImage(makeFile(), deps);
    for (const call of encode.mock.calls) {
      expect(call[4]).toBeGreaterThanOrEqual(MIN_QUALITY);
    }
    expect(result.quality).toBeGreaterThanOrEqual(MIN_QUALITY);
  });

  it('stops after a bounded number of passes even if the target is unreachable', async () => {
    const { deps, encode } = stubDeps({ sizeFor: oversized });
    const result = await processImage(makeFile(), deps);
    expect(encode.mock.calls.length).toBeLessThanOrEqual(MAX_COMPRESSION_PASSES);
    expect(result.compressionPasses).toBeLessThanOrEqual(MAX_COMPRESSION_PASSES);
  });

  it('encodes only once when the first pass is already under the target', async () => {
    const { deps, encode } = stubDeps({ sizeFor: () => TARGET_BYTES - 1 });
    await processImage(makeFile(), deps);
    expect(encode).toHaveBeenCalledTimes(1);
  });
});

describe('output format', () => {
  it('converts opaque sources to JPEG', () => {
    expect(outputMimeType('image/png', false)).toBe('image/jpeg');
    expect(outputMimeType('image/webp', false)).toBe('image/jpeg');
    expect(outputMimeType('image/heic', true)).toBe('image/jpeg');
  });

  it('keeps PNG and WebP when the image actually uses transparency', () => {
    expect(outputMimeType('image/png', true)).toBe('image/png');
    expect(outputMimeType('image/webp', true)).toBe('image/webp');
  });

  it('does not re-encode a transparent PNG repeatedly — quality has no effect on it', async () => {
    const { deps, encode } = stubDeps({ image: decoded(4000, 3000, true), sizeFor: () => TARGET_BYTES * 3 });
    const result = await processImage(makeFile('logo.png', 'image/png', 6_000_000), deps);
    expect(result.mimeType).toBe('image/png');
    expect(encode).toHaveBeenCalledTimes(1);
  });
});

describe('preview lifecycle', () => {
  it('revokes the preview URL on release', () => {
    const revokeObjectURL = vi.fn();
    releasePreview({ previewUrl: 'blob:a' }, { revokeObjectURL });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:a');
  });

  it('ignores a release with no image held', () => {
    const revokeObjectURL = vi.fn();
    releasePreview(null, { revokeObjectURL });
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('revokes the outgoing URL when an image is replaced', () => {
    const revokeObjectURL = vi.fn();
    const previous = { previewUrl: 'blob:old' };
    const next = { previewUrl: 'blob:new' };
    expect(swapProcessedImage(previous, next, { revokeObjectURL })).toBe(next);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:old');
  });

  it('revokes the outgoing URL when an image is removed', () => {
    const revokeObjectURL = vi.fn();
    expect(swapProcessedImage({ previewUrl: 'blob:old' }, null, { revokeObjectURL })).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:old');
  });

  it('does not revoke when the same image is re-applied', () => {
    const revokeObjectURL = vi.fn();
    const held = { previewUrl: 'blob:same' };
    swapProcessedImage(held, held, { revokeObjectURL });
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
