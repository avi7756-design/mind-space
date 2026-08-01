import type { Offer, WatchlistItem } from '../types';
import { offerTotalCost } from './scoring';

/**
 * Watchlist semantics live here so that every consumer agrees on what a
 * tracked price means.
 *
 * INVARIANT: `currentPrice`, `targetPrice` and every point in `history` are
 * expressed in TOTAL purchase cost (base + shipping + tax) — never a base
 * price. See `WatchlistItem` in types/index.ts.
 */

/** Default target when a user starts tracking an offer: 10% below current total cost. */
export const DEFAULT_TARGET_RATIO = 0.9;

export type NewWatchlistEntry = Omit<WatchlistItem, 'id' | 'createdAt' | 'history'>;

/**
 * The single Offer → WatchlistItem conversion in the app.
 * Routing every caller through here is what keeps the total-cost invariant true.
 */
export function watchlistEntryFromOffer(
  offer: Offer,
  query: string,
  targetRatio: number = DEFAULT_TARGET_RATIO,
): NewWatchlistEntry {
  const totalCost = offerTotalCost(offer);
  return {
    productName: offer.productName,
    query,
    supplierId: offer.supplierId,
    currentPrice: totalCost,
    targetPrice: Math.round(totalCost * targetRatio),
  };
}

/** The price the item was first tracked at — the baseline every saving is measured against. */
export function baselinePrice(item: WatchlistItem): number {
  return item.history[0]?.price ?? item.currentPrice;
}

/** Total cost saved since tracking began. Never negative — a price rise is not a loss. */
export function savingsSoFar(item: WatchlistItem): number {
  return Math.max(0, baselinePrice(item) - item.currentPrice);
}

export function totalSavings(items: WatchlistItem[]): number {
  return items.reduce((sum, item) => sum + savingsSoFar(item), 0);
}

/** Signed percentage change since tracking began; negative means the price dropped. */
export function changePctSinceStart(item: WatchlistItem): number {
  const baseline = baselinePrice(item);
  if (baseline <= 0) return 0;
  return ((item.currentPrice - baseline) / baseline) * 100;
}

export function hasReachedTarget(item: WatchlistItem): boolean {
  return item.currentPrice <= item.targetPrice;
}
