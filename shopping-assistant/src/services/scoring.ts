import type { Offer, RankingMode, ScoreWeights, ScoredOffer, Supplier } from '../types';

export const DEFAULT_WEIGHTS: ScoreWeights = {
  totalCost: 40,
  trust: 25,
  delivery: 15,
  warranty: 10,
  returns: 10,
};

export function offerTotalCost(offer: Offer): number {
  return offer.basePrice + offer.shippingCost + offer.taxEstimate;
}

/**
 * Score given to a relative dimension that cannot discriminate — every offer in
 * the set shares the same value, so no offer is better than another on it.
 *
 * A perfect 100 would be a lie: it claims superiority where there is no
 * comparison at all. The clearest case is a single offer, where every
 * relative dimension used to read 100 and inflated the composite score.
 * A neutral midpoint keeps the dimension present without asserting an
 * advantage, and — because it applies equally to every offer in the set — it
 * never changes the ranking.
 */
export const NEUTRAL_SCORE = 50;

/** Normalize a value to 0–100 where the LOWEST value in the set gets 100. */
function lowerIsBetter(value: number, min: number, max: number): number {
  if (max === min) return NEUTRAL_SCORE;
  return ((max - value) / (max - min)) * 100;
}

/** Normalize a value to 0–100 where the HIGHEST value in the set gets 100. */
function higherIsBetter(value: number, min: number, max: number): number {
  if (max === min) return NEUTRAL_SCORE;
  return ((value - min) / (max - min)) * 100;
}

function returnPolicyQuality(offer: Offer): number {
  if (offer.returnCost === 'none') return 0;
  const daysScore = Math.min(offer.returnDays / 30, 1);
  const costFactor = offer.returnCost === 'free' ? 1 : 0.55;
  return daysScore * costFactor * 100;
}

/**
 * The scoring engine: computes total cost and a weighted composite value
 * score for each offer, normalized within the compared set.
 * Excluded suppliers are filtered out before scoring.
 */
export function scoreOffers(
  offers: Offer[],
  suppliers: Supplier[],
  weights: ScoreWeights,
): ScoredOffer[] {
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const eligible = offers.filter((o) => {
    const s = supplierById.get(o.supplierId);
    return s && !s.excluded;
  });
  if (eligible.length === 0) return [];

  const costs = eligible.map(offerTotalCost);
  const deliveries = eligible.map((o) => (o.deliveryDaysMin + o.deliveryDaysMax) / 2);
  const warranties = eligible.map((o) => o.warrantyMonths);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minDel = Math.min(...deliveries);
  const maxDel = Math.max(...deliveries);
  const minWar = Math.min(...warranties);
  const maxWar = Math.max(...warranties);

  const weightSum =
    weights.totalCost + weights.trust + weights.delivery + weights.warranty + weights.returns;

  return eligible.map((offer) => {
    const supplier = supplierById.get(offer.supplierId)!;
    const totalCost = offerTotalCost(offer);
    const breakdown = {
      totalCost: lowerIsBetter(totalCost, minCost, maxCost),
      trust: supplier.trustScore,
      delivery: lowerIsBetter((offer.deliveryDaysMin + offer.deliveryDaysMax) / 2, minDel, maxDel),
      warranty: higherIsBetter(offer.warrantyMonths, minWar, maxWar),
      returns: returnPolicyQuality(offer),
    };
    const valueScore =
      (breakdown.totalCost * weights.totalCost +
        breakdown.trust * weights.trust +
        breakdown.delivery * weights.delivery +
        breakdown.warranty * weights.warranty +
        breakdown.returns * weights.returns) /
      (weightSum || 100);

    return { ...offer, supplier, totalCost, breakdown, valueScore: Math.round(valueScore * 10) / 10 };
  });
}

export function rankOffers(offers: ScoredOffer[], mode: RankingMode): ScoredOffer[] {
  const sorted = [...offers];
  switch (mode) {
    case 'value':
      sorted.sort((a, b) => b.valueScore - a.valueScore);
      break;
    case 'price':
      sorted.sort((a, b) => a.totalCost - b.totalCost);
      break;
    case 'trust':
      sorted.sort((a, b) => b.supplier.trustScore - a.supplier.trustScore);
      break;
  }
  return sorted;
}
