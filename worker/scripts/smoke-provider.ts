#!/usr/bin/env node
// Manual provider smoke test. NOT part of `npm test` and never run in CI —
// it performs one real, billable call against the configured vision provider.
//
//   ANTHROPIC_API_KEY=... npm run smoke:provider -- ./some-product.jpg
//
// The image path is required and is never committed: point it at a local file.

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
// Imported from source so the smoke test exercises the same prompt and schema
// the worker ships — drift here would make the check meaningless.
import { AnthropicRecognitionProvider } from '../src/providers/AnthropicRecognitionProvider';
import type { SupportedMimeType } from '../src/config';

const MIME_BY_EXTENSION: Record<string, SupportedMimeType> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const apiKey = process.env.ANTHROPIC_API_KEY;
const imagePath = process.argv[2];

if (!apiKey) {
  console.error('ANTHROPIC_API_KEY is required.');
  process.exit(1);
}
if (!imagePath) {
  console.error('Usage: npm run smoke:provider -- <path-to-image>');
  process.exit(1);
}

const mimeType = MIME_BY_EXTENSION[extname(imagePath).toLowerCase()];
if (!mimeType) {
  console.error(`Unsupported extension. Supported: ${Object.keys(MIME_BY_EXTENSION).join(', ')}`);
  process.exit(1);
}

const bytes = await readFile(imagePath);
const MAX_BYTES = Number(process.env.MAX_IMAGE_BYTES ?? 2 * 1024 * 1024);
if (bytes.byteLength > MAX_BYTES) {
  console.error(`Image is ${bytes.byteLength} bytes; the worker rejects anything over ${MAX_BYTES}.`);
  process.exit(1);
}


const provider = new AnthropicRecognitionProvider(apiKey, {
  model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
  minConfidence: Number(process.env.MIN_CONFIDENCE ?? 0.8),
  providerTimeoutMs: 30_000,
  allowedOrigins: [],
  dailyRequestLimit: 0,
  maxImageBytes: MAX_BYTES,
});

const startedAt = Date.now();
const result = await provider.recognize({
  bytes: new Uint8Array(bytes),
  mimeType,
  locale: process.env.LOCALE ?? 'he-IL',
  requestId: crypto.randomUUID(),
});

// Prints the structured result only — never the image, the key or the raw response.
console.log(JSON.stringify({ processingMs: Date.now() - startedAt, result }, null, 2));
