import { RecognitionError } from './errors';

export type RecognitionWarning =
  | 'MODEL_NUMBER_UNCERTAIN'
  | 'TEXT_PARTIALLY_READABLE'
  | 'MULTIPLE_PRODUCTS_VISIBLE'
  | 'IMAGE_BLURRY'
  | 'IMAGE_TOO_DARK'
  | 'PRODUCT_NOT_IDENTIFIED';

export const RECOGNITION_WARNINGS: readonly RecognitionWarning[] = [
  'MODEL_NUMBER_UNCERTAIN',
  'TEXT_PARTIALLY_READABLE',
  'MULTIPLE_PRODUCTS_VISIBLE',
  'IMAGE_BLURRY',
  'IMAGE_TOO_DARK',
  'PRODUCT_NOT_IDENTIFIED',
];

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface RecognitionResult {
  productName: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  variant: string | null;
  visibleText: string[];
  identifiers: {
    modelNumber: string | null;
    sku: string | null;
    barcode: string | null;
  };
  searchQuery: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  needsConfirmation: boolean;
  warnings: RecognitionWarning[];
}

/** What a provider returns before the worker derives the confirmation fields. */
export interface RawRecognition {
  productName?: string | null;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  variant?: string | null;
  visibleText?: unknown;
  identifiers?: {
    modelNumber?: string | null;
    sku?: string | null;
    barcode?: string | null;
  } | null;
  searchQuery?: string | null;
  confidence?: unknown;
  multipleProductsVisible?: boolean;
  warnings?: unknown;
}

export const RECOGNITION_TOOL_NAME = 'record_product_recognition';

/** Forced tool schema — the provider is never asked to emit free-form JSON. */
export const RECOGNITION_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    productName: { type: ['string', 'null'], description: 'Human product name, no invented marketing copy.' },
    brand: { type: ['string', 'null'] },
    model: {
      type: ['string', 'null'],
      description:
        'Model string exactly as printed. Null if any character is unreadable. Never guess digits.',
    },
    category: { type: ['string', 'null'], description: 'Short product category in the requested locale.' },
    variant: { type: ['string', 'null'], description: 'Colour or size variant if printed.' },
    visibleText: {
      type: 'array',
      items: { type: 'string' },
      description: 'Only text actually visible in the photo. No outside knowledge.',
    },
    identifiers: {
      type: 'object',
      properties: {
        modelNumber: { type: ['string', 'null'] },
        sku: { type: ['string', 'null'] },
        barcode: { type: ['string', 'null'] },
      },
      required: ['modelNumber', 'sku', 'barcode'],
    },
    searchQuery: {
      type: 'string',
      description: 'Non-empty search string built only from what was read. Never include a guessed model.',
    },
    confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Confidence in the whole identification.' },
    multipleProductsVisible: { type: 'boolean' },
    warnings: {
      type: 'array',
      items: { type: 'string', enum: RECOGNITION_WARNINGS as unknown as string[] },
    },
  },
  required: ['productName', 'brand', 'model', 'category', 'visibleText', 'identifiers', 'searchQuery', 'confidence'],
} as const;

export const RECOGNITION_SYSTEM_PROMPT = [
  'You identify a single retail product from one photo so a shopper can search for it.',
  'Read only what is visible. Never use outside knowledge to fill a field.',
  'Model numbers are the critical field: preserve "/", "-", dots and letter case exactly as printed.',
  'Distinguish 0/O, 1/I, 5/S and 8/B carefully. If any character is unclear, return model as null',
  'and add the MODEL_NUMBER_UNCERTAIN warning. Never complete a partially readable model by guessing.',
  'Never invent a barcode or SKU — return null unless the digits are legible.',
  'If more than one product is visible, add MULTIPLE_PRODUCTS_VISIBLE and describe the most prominent one.',
  'If the photo is blurry or dark, add the matching warning.',
  'Build searchQuery from brand + product name + exact model when the model is certain,',
  'otherwise brand + product name + category. Never put a guessed model in searchQuery.',
  'Always answer by calling the record_product_recognition tool.',
].join(' ');

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.toLowerCase() !== 'null' ? trimmed : null;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => cleanString(entry))
    .filter((entry): entry is string => entry !== null)
    .slice(0, 40);
}

function cleanWarnings(value: unknown): RecognitionWarning[] {
  const known = new Set<string>(RECOGNITION_WARNINGS);
  const seen = new Set<RecognitionWarning>();
  for (const entry of Array.isArray(value) ? value : []) {
    if (typeof entry === 'string' && known.has(entry)) seen.add(entry as RecognitionWarning);
  }
  return [...seen];
}

export function confidenceLevelFor(confidence: number, minConfidence: number): ConfidenceLevel {
  if (confidence >= minConfidence) return 'high';
  // Anything within 0.15 of the bar is worth showing behind a confirmation step.
  if (confidence >= Math.max(0, minConfidence - 0.15)) return 'medium';
  return 'low';
}

/**
 * Turns a provider payload into the response contract. Everything the client is
 * promised — clamped confidence, a non-empty searchQuery, the confirmation flag —
 * is decided here rather than trusted from the model.
 */
export function normalizeResult(raw: RawRecognition, minConfidence: number): RecognitionResult {
  const productName = cleanString(raw.productName);
  const brand = cleanString(raw.brand);
  const model = cleanString(raw.model);
  const category = cleanString(raw.category);

  const rawConfidence = Number(raw.confidence);
  const confidence = Number.isFinite(rawConfidence) ? Math.min(1, Math.max(0, rawConfidence)) : 0;

  const warnings = cleanWarnings(raw.warnings);
  if (model === null && !warnings.includes('MODEL_NUMBER_UNCERTAIN')) {
    warnings.push('MODEL_NUMBER_UNCERTAIN');
  }
  if (raw.multipleProductsVisible && !warnings.includes('MULTIPLE_PRODUCTS_VISIBLE')) {
    warnings.push('MULTIPLE_PRODUCTS_VISIBLE');
  }
  if (!productName && !brand && !warnings.includes('PRODUCT_NOT_IDENTIFIED')) {
    warnings.push('PRODUCT_NOT_IDENTIFIED');
  }

  // A guessed model must never reach the query, so it is rebuilt from confirmed
  // fields whenever the provider's own string mentions a model it flagged as unsure.
  const providedQuery = cleanString(raw.searchQuery);
  const fallbackQuery = [brand, productName, model ?? category].filter(Boolean).join(' ').trim();
  const searchQuery =
    model === null && providedQuery && fallbackQuery && providedQuery !== fallbackQuery
      ? fallbackQuery
      : (providedQuery ?? fallbackQuery);

  if (!searchQuery) {
    // Nothing usable was read — a guessed query would be worse than an error.
    throw new RecognitionError('LOW_CONFIDENCE', 'empty-search-query');
  }

  const identifiers = {
    modelNumber: cleanString(raw.identifiers?.modelNumber) ?? model,
    sku: cleanString(raw.identifiers?.sku),
    barcode: cleanString(raw.identifiers?.barcode),
  };

  const needsConfirmation =
    confidence < minConfidence ||
    model === null ||
    warnings.includes('MODEL_NUMBER_UNCERTAIN') ||
    warnings.includes('MULTIPLE_PRODUCTS_VISIBLE') ||
    productName === null ||
    brand === null;

  return {
    productName,
    brand,
    model,
    category,
    variant: cleanString(raw.variant),
    visibleText: cleanStringArray(raw.visibleText),
    identifiers,
    searchQuery,
    confidence,
    confidenceLevel: confidenceLevelFor(confidence, minConfidence),
    needsConfirmation,
    warnings,
  };
}
