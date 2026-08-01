export type RecognitionErrorCode =
  | 'INVALID_REQUEST'
  | 'MISSING_IMAGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_ORIGIN'
  | 'RATE_LIMITED'
  | 'DAILY_LIMIT_REACHED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'LOW_CONFIDENCE'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR';

export const ERROR_STATUS: Record<RecognitionErrorCode, number> = {
  INVALID_REQUEST: 400,
  MISSING_IMAGE: 400,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  INVALID_ORIGIN: 403,
  RATE_LIMITED: 429,
  DAILY_LIMIT_REACHED: 429,
  PROVIDER_UNAVAILABLE: 502,
  PROVIDER_TIMEOUT: 504,
  INVALID_PROVIDER_RESPONSE: 502,
  LOW_CONFIDENCE: 422,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_ERROR: 500,
};

/** Only transient conditions are worth a client retry. */
const RETRYABLE: ReadonlySet<RecognitionErrorCode> = new Set<RecognitionErrorCode>([
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_TIMEOUT',
  'INTERNAL_ERROR',
]);

/**
 * User-facing text. Deliberately generic: nothing here may leak the provider's
 * identity, an internal message, a stack trace or a secret.
 */
const ERROR_MESSAGES: Record<RecognitionErrorCode, string> = {
  INVALID_REQUEST: 'הבקשה אינה תקינה.',
  MISSING_IMAGE: 'לא נשלחה תמונה.',
  UNSUPPORTED_MEDIA_TYPE: 'סוג הקובץ אינו נתמך. נתמכים JPG, PNG ו-WebP.',
  PAYLOAD_TOO_LARGE: 'התמונה גדולה מדי.',
  INVALID_ORIGIN: 'הבקשה נדחתה.',
  RATE_LIMITED: 'יותר מדי בקשות. נסו שוב בעוד רגע.',
  DAILY_LIMIT_REACHED: 'הגעתם למכסת הזיהויים היומית.',
  PROVIDER_UNAVAILABLE: 'שירות הזיהוי אינו זמין כרגע.',
  PROVIDER_TIMEOUT: 'הזיהוי ארך זמן רב מדי. נסו שוב.',
  INVALID_PROVIDER_RESPONSE: 'שירות הזיהוי החזיר תשובה לא תקינה.',
  LOW_CONFIDENCE: 'לא הצלחנו לזהות את המוצר בתמונה. נסו לצלם מקרוב ובתאורה טובה.',
  NOT_FOUND: 'הנתיב אינו קיים.',
  METHOD_NOT_ALLOWED: 'שיטת הבקשה אינה נתמכת בנתיב זה.',
  INTERNAL_ERROR: 'אירעה שגיאה בלתי צפויה.',
};

export interface RecognitionErrorBody {
  requestId: string;
  error: {
    code: RecognitionErrorCode;
    message: string;
    retryable: boolean;
  };
}

/** The only error type the handler is allowed to translate into a response. */
export class RecognitionError extends Error {
  readonly code: RecognitionErrorCode;
  /** Never serialised — kept for structured logging only. */
  readonly detail?: string;

  constructor(code: RecognitionErrorCode, detail?: string) {
    super(ERROR_MESSAGES[code]);
    this.name = 'RecognitionError';
    this.code = code;
    this.detail = detail;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }

  toBody(requestId: string): RecognitionErrorBody {
    return {
      requestId,
      error: { code: this.code, message: this.message, retryable: this.retryable },
    };
  }
}

export function toRecognitionError(cause: unknown): RecognitionError {
  if (cause instanceof RecognitionError) return cause;
  // An unexpected throw must never surface its message to the caller.
  return new RecognitionError('INTERNAL_ERROR', cause instanceof Error ? cause.name : 'unknown');
}
