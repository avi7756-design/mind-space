import { normalizeResult, type RawRecognition, type RecognitionResult } from '../schema';
import type { RecognitionInput, RecognitionProvider } from './RecognitionProvider';

/** Deterministic payloads so tests never touch a real API. */
export const FAKE_SCENARIOS = {
  confident: {
    productName: 'OneBlade',
    brand: 'Philips',
    model: 'QP2724/10',
    category: 'מכונת גילוח',
    variant: null,
    visibleText: ['PHILIPS', 'OneBlade', 'QP2724/10'],
    identifiers: { modelNumber: 'QP2724/10', sku: null, barcode: null },
    searchQuery: 'Philips OneBlade QP2724/10',
    confidence: 0.94,
    warnings: [],
  },
  uncertainModel: {
    productName: 'OneBlade',
    brand: 'Philips',
    model: null,
    category: 'מכונת גילוח',
    variant: null,
    visibleText: ['PHILIPS', 'OneBlade'],
    identifiers: { modelNumber: null, sku: null, barcode: null },
    searchQuery: 'Philips OneBlade מכונת גילוח',
    confidence: 0.66,
    warnings: ['MODEL_NUMBER_UNCERTAIN'],
  },
  unidentifiable: {
    productName: null,
    brand: null,
    model: null,
    category: null,
    variant: null,
    visibleText: [],
    identifiers: { modelNumber: null, sku: null, barcode: null },
    searchQuery: '',
    confidence: 0.1,
    warnings: ['PRODUCT_NOT_IDENTIFIED', 'IMAGE_BLURRY'],
  },
} satisfies Record<string, RawRecognition>;

export type FakeScenario = keyof typeof FAKE_SCENARIOS;

export class FakeRecognitionProvider implements RecognitionProvider {
  readonly name = 'anthropic';
  readonly model = 'fake-model';
  /** Lets tests assert the handler calls the provider exactly once — or not at all. */
  calls: RecognitionInput[] = [];

  constructor(
    private readonly payload: RawRecognition = FAKE_SCENARIOS.confident,
    private readonly minConfidence = 0.8,
    private readonly failWith?: Error,
  ) {}

  static scenario(scenario: FakeScenario, minConfidence = 0.8): FakeRecognitionProvider {
    return new FakeRecognitionProvider(FAKE_SCENARIOS[scenario], minConfidence);
  }

  static failing(error: Error): FakeRecognitionProvider {
    return new FakeRecognitionProvider(FAKE_SCENARIOS.confident, 0.8, error);
  }

  async recognize(input: RecognitionInput): Promise<RecognitionResult> {
    this.calls.push(input);
    if (this.failWith) throw this.failWith;
    return normalizeResult(this.payload, this.minConfidence);
  }
}
