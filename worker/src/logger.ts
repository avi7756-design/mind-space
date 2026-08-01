import type { RecognitionErrorCode } from './errors';

/**
 * The allowlist below is the whole logging surface. Image bytes, base64, the API
 * key, full client IPs and raw provider payloads must never reach a log line.
 */
export interface RequestLog {
  requestId: string;
  route: string;
  status: number;
  processingMs: number;
  imageBytes?: number;
  mimeType?: string;
  confidenceLevel?: string;
  needsConfirmation?: boolean;
  errorCode?: RecognitionErrorCode;
  /** Short internal hint (e.g. "content-length") — never a message or stack. */
  detail?: string;
}

export type Logger = (entry: RequestLog) => void;

export const consoleLogger: Logger = (entry) => {
  console.log(JSON.stringify(entry));
};
