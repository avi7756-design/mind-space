import type { SupportedMimeType } from '../config';
import type { RecognitionResult } from '../schema';

export interface RecognitionInput {
  bytes: Uint8Array;
  mimeType: SupportedMimeType;
  locale: string;
  requestId: string;
}

/**
 * The only seam through which the worker talks to a vision model. The request
 * handler must never call a provider API directly, so swapping vendors later
 * touches one file.
 */
export interface RecognitionProvider {
  readonly name: string;
  readonly model: string;
  recognize(input: RecognitionInput): Promise<RecognitionResult>;
}
