// ---------- Domain types shared by the UI, the scoring engine and the future backend ----------

export type StockStatus = 'in_stock' | 'low_stock' | 'preorder' | 'out_of_stock';

export type VerificationStatus = 'verified' | 'pending' | 'unverified';

export type RiskFlag =
  | 'new_seller'
  | 'price_anomaly'
  | 'negative_reviews'
  | 'slow_shipping'
  | 'payment_disputes'
  | 'counterfeit_reports';

export interface Supplier {
  id: string;
  name: string;
  domain: string;
  country: string;
  verification: VerificationStatus;
  /** 0–100, computed from reviews, dispute rate and seniority */
  trustScore: number;
  rating: number;
  reviewCount: number;
  yearsActive: number;
  riskFlags: RiskFlag[];
  excluded: boolean;
  exclusionReason?: string;
}

export type ReturnCost = 'free' | 'paid' | 'none';

export interface Offer {
  id: string;
  productName: string;
  supplierId: string;
  basePrice: number;
  shippingCost: number;
  taxEstimate: number;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  warrantyMonths: number;
  returnDays: number;
  returnCost: ReturnCost;
  stock: StockStatus;
  url: string;
  currency: 'ILS';
}

export interface ScoreWeights {
  totalCost: number;
  trust: number;
  delivery: number;
  warranty: number;
  returns: number;
}

export interface OfferScoreBreakdown {
  totalCost: number;
  trust: number;
  delivery: number;
  warranty: number;
  returns: number;
}

export interface ScoredOffer extends Offer {
  supplier: Supplier;
  /** base + shipping + tax */
  totalCost: number;
  /** each dimension normalized to 0–100 within the compared set */
  breakdown: OfferScoreBreakdown;
  /** weighted composite, 0–100 */
  valueScore: number;
}

export type RankingMode = 'value' | 'price' | 'trust';

export interface PricePoint {
  date: string; // ISO date
  price: number;
}

export interface WatchlistItem {
  id: string;
  productName: string;
  query: string;
  supplierId: string;
  /**
   * The latest TOTAL purchase cost of the tracked offer —
   * `basePrice + shippingCost + taxEstimate`, i.e. what the buyer actually pays.
   * Never a base price alone. Always derive it via `offerTotalCost(offer)`.
   */
  currentPrice: number;
  /** Target expressed in the same total-cost units as `currentPrice`. */
  targetPrice: number;
  /** Price timeline in the same total-cost units; the last point equals `currentPrice`. */
  history: PricePoint[];
  createdAt: string;
}

export type AlertChannel = 'email' | 'telegram' | 'webhook';

export type AlertType = 'price_drop' | 'trust_change' | 'back_in_stock';

export interface AlertRecord {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  channels: AlertChannel[];
  status: 'sent' | 'pending' | 'failed';
  createdAt: string;
  productName?: string;
  supplierName?: string;
}

export interface AlertChannelSettings {
  email: { enabled: boolean; address: string };
  telegram: { enabled: boolean; chatId: string };
  webhook: { enabled: boolean; url: string };
}

export type ActivityType =
  | 'search'
  | 'compare'
  | 'track'
  | 'alert'
  | 'supplier_update'
  | 'settings';

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  message: string;
  createdAt: string;
}

// ---------- Image input (client-side only; the recognition backend lands in a later task) ----------

/**
 * A user-supplied photo after local resizing and compression. The `blob` is the
 * payload a future recognition endpoint will receive; nothing here is persisted.
 */
export interface ProcessedImage {
  blob: Blob;
  /** Object URL for on-screen preview — must be revoked when replaced or unmounted. */
  previewUrl: string;
  width: number;
  height: number;
  mimeType: string;
  originalFileName: string;
  originalSize: number;
  processedSize: number;
  /** Encoder quality actually used (1 for lossless output). */
  quality: number;
  /** How many encode passes ran before the size target was met or the loop stopped. */
  compressionPasses: number;
}
