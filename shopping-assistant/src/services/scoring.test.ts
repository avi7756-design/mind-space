import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS, NEUTRAL_SCORE, offerTotalCost, rankOffers, scoreOffers } from './scoring';
import type { Offer, Supplier } from '../types';

// ---------- fixtures ----------

function makeSupplier(overrides: Partial<Supplier> & Pick<Supplier, 'id'>): Supplier {
  return {
    name: `ספק ${overrides.id}`,
    domain: `${overrides.id}.example.com`,
    country: 'ישראל',
    verification: 'verified',
    trustScore: 80,
    rating: 4.2,
    reviewCount: 1000,
    yearsActive: 5,
    riskFlags: [],
    excluded: false,
    ...overrides,
  };
}

function makeOffer(overrides: Partial<Offer> & Pick<Offer, 'id' | 'supplierId'>): Offer {
  return {
    productName: 'מוצר בדיקה',
    basePrice: 1000,
    shippingCost: 0,
    taxEstimate: 0,
    deliveryDaysMin: 3,
    deliveryDaysMax: 5,
    warrantyMonths: 12,
    returnDays: 14,
    returnCost: 'free',
    stock: 'in_stock',
    url: 'https://example.com/product',
    currency: 'ILS',
    ...overrides,
  };
}

/**
 * A deliberately discriminating fixture set: the three ranking modes each
 * produce a DIFFERENT order, so a bug that swapped one comparator for
 * another could not pass all three ranking tests.
 *
 *   price ascending   → cheap, mid, premium
 *   trust descending  → premium, mid, cheap
 *   value descending  → mid, premium, cheap
 */
const SUPPLIER_PREMIUM = makeSupplier({ id: 'premium', trustScore: 95 });
const SUPPLIER_MID = makeSupplier({ id: 'mid', trustScore: 75 });
const SUPPLIER_CHEAP = makeSupplier({ id: 'cheap', trustScore: 55 });
const SUPPLIER_BLOCKED = makeSupplier({
  id: 'blocked',
  trustScore: 20,
  verification: 'unverified',
  excluded: true,
  exclusionReason: 'ספק חסום לצורך הבדיקה',
});

const SUPPLIERS = [SUPPLIER_PREMIUM, SUPPLIER_MID, SUPPLIER_CHEAP, SUPPLIER_BLOCKED];

const OFFER_PREMIUM = makeOffer({
  id: 'o-premium',
  supplierId: 'premium',
  basePrice: 1500,
  deliveryDaysMin: 1,
  deliveryDaysMax: 1,
  warrantyMonths: 24,
  returnDays: 30,
  returnCost: 'free',
});

const OFFER_MID = makeOffer({
  id: 'o-mid',
  supplierId: 'mid',
  basePrice: 1000,
  shippingCost: 100,
  deliveryDaysMin: 5,
  deliveryDaysMax: 9,
  warrantyMonths: 12,
  returnDays: 30,
  returnCost: 'free',
});

const OFFER_CHEAP = makeOffer({
  id: 'o-cheap',
  supplierId: 'cheap',
  basePrice: 800,
  deliveryDaysMin: 20,
  deliveryDaysMax: 30,
  warrantyMonths: 6,
  returnDays: 14,
  returnCost: 'paid',
});

const OFFER_BLOCKED = makeOffer({
  id: 'o-blocked',
  supplierId: 'blocked',
  basePrice: 500,
});

const OFFERS = [OFFER_PREMIUM, OFFER_MID, OFFER_CHEAP];

const idsOf = (offers: Array<{ id: string }>) => offers.map((o) => o.id);

// ---------- 1. total cost ----------

describe('offerTotalCost', () => {
  it('מחבר מחיר בסיס, משלוח ומס', () => {
    const offer = makeOffer({
      id: 'o1',
      supplierId: 'mid',
      basePrice: 890,
      shippingCost: 45,
      taxEstimate: 150,
    });
    expect(offerTotalCost(offer)).toBe(1085);
  });

  it('מחזיר את מחיר הבסיס כשאין משלוח ומס', () => {
    expect(offerTotalCost(makeOffer({ id: 'o2', supplierId: 'mid', basePrice: 1190 }))).toBe(1190);
  });
});

// ---------- 2. excluded suppliers ----------

describe('scoreOffers — סינון ספקים חסומים', () => {
  it('הצעה מספק שסומן excluded אינה נכנסת לתוצאות', () => {
    const scored = scoreOffers([...OFFERS, OFFER_BLOCKED], SUPPLIERS, DEFAULT_WEIGHTS);

    expect(scored).toHaveLength(3);
    expect(idsOf(scored)).not.toContain('o-blocked');
    expect(scored.every((o) => !o.supplier.excluded)).toBe(true);
  });

  it('הצעה של ספק שאינו במאגר נופלת גם היא', () => {
    const orphan = makeOffer({ id: 'o-orphan', supplierId: 'does-not-exist' });
    const scored = scoreOffers([...OFFERS, orphan], SUPPLIERS, DEFAULT_WEIGHTS);

    expect(idsOf(scored)).not.toContain('o-orphan');
  });

  it('מחזיר מערך ריק כשכל ההצעות נפסלות', () => {
    expect(scoreOffers([OFFER_BLOCKED], SUPPLIERS, DEFAULT_WEIGHTS)).toEqual([]);
  });

  it('מחזיר מערך ריק כשאין הצעות כלל', () => {
    expect(scoreOffers([], SUPPLIERS, DEFAULT_WEIGHTS)).toEqual([]);
  });
});

// ---------- 3–5. ranking modes ----------

describe('rankOffers', () => {
  const scored = scoreOffers(OFFERS, SUPPLIERS, DEFAULT_WEIGHTS);

  it('price — מסדר מהעלות הכוללת הנמוכה לגבוהה', () => {
    const ranked = rankOffers(scored, 'price');

    expect(idsOf(ranked)).toEqual(['o-cheap', 'o-mid', 'o-premium']);
    expect(ranked.map((o) => o.totalCost)).toEqual([800, 1100, 1500]);
  });

  it('trust — מסדר מהאמינות הגבוהה לנמוכה', () => {
    const ranked = rankOffers(scored, 'trust');

    expect(idsOf(ranked)).toEqual(['o-premium', 'o-mid', 'o-cheap']);
    expect(ranked.map((o) => o.supplier.trustScore)).toEqual([95, 75, 55]);
  });

  it('value — מסדר מציון התמורה הגבוה לנמוך', () => {
    const ranked = rankOffers(scored, 'value');
    const scores = ranked.map((o) => o.valueScore);

    expect(idsOf(ranked)).toEqual(['o-mid', 'o-premium', 'o-cheap']);
    expect(scores[0]).toBeGreaterThan(scores[1]);
    expect(scores[1]).toBeGreaterThan(scores[2]);
  });

  it('אינו משנה את המערך המקורי', () => {
    const original = idsOf(scored);
    rankOffers(scored, 'price');
    rankOffers(scored, 'trust');

    expect(idsOf(scored)).toEqual(original);
  });
});

// ---------- 6. default weights ----------

describe('DEFAULT_WEIGHTS', () => {
  it('מסתכמות ב‑100', () => {
    const { totalCost, trust, delivery, warranty, returns } = DEFAULT_WEIGHTS;

    expect(totalCost + trust + delivery + warranty + returns).toBe(100);
  });

  it('שומרות על החלוקה המוצרית שנקבעה: 40/25/15/10/10', () => {
    expect(DEFAULT_WEIGHTS).toEqual({
      totalCost: 40,
      trust: 25,
      delivery: 15,
      warranty: 10,
      returns: 10,
    });
  });

  it('סכום משקולות אפס נופל למכנה 100 ואינו מייצר חלוקה באפס', () => {
    // מגן על ה-fallback `weightSum || 100` — מצב שה-UI אינו אמור לאפשר,
    // אך הפונקציה מוגנת מפניו
    const zeroWeights = { totalCost: 0, trust: 0, delivery: 0, warranty: 0, returns: 0 };
    const scored = scoreOffers(OFFERS, SUPPLIERS, zeroWeights);

    expect(scored).toHaveLength(3);
    expect(scored.every((o) => o.valueScore === 0)).toBe(true);
    expect(scored.every((o) => Number.isFinite(o.valueScore))).toBe(true);
  });
});

// ---------- 7. cost normalization ----------

describe('scoreOffers — נרמול העלות', () => {
  it('ההצעה הזולה מקבלת ציון עלות גבוה מזה של היקרה', () => {
    const scored = scoreOffers(OFFERS, SUPPLIERS, DEFAULT_WEIGHTS);
    const cheap = scored.find((o) => o.id === 'o-cheap')!;
    const premium = scored.find((o) => o.id === 'o-premium')!;

    expect(cheap.breakdown.totalCost).toBeGreaterThan(premium.breakdown.totalCost);
    expect(cheap.breakdown.totalCost).toBe(100);
    expect(premium.breakdown.totalCost).toBe(0);
  });

  it('מנרמל ביחס לסט: אותה הצעה מקבלת ציון עלות שונה בסט אחר', () => {
    const inFullSet = scoreOffers(OFFERS, SUPPLIERS, DEFAULT_WEIGHTS).find(
      (o) => o.id === 'o-mid',
    )!;
    const inPairSet = scoreOffers([OFFER_MID, OFFER_PREMIUM], SUPPLIERS, DEFAULT_WEIGHTS).find(
      (o) => o.id === 'o-mid',
    )!;

    expect(inFullSet.breakdown.totalCost).toBeCloseTo(57.14, 1);
    expect(inPairSet.breakdown.totalCost).toBe(100);
  });

  it('מפרק את הציון לחמישה ממדים עם ערכים מספריים צפויים', () => {
    const premium = scoreOffers(OFFERS, SUPPLIERS, DEFAULT_WEIGHTS).find(
      (o) => o.id === 'o-premium',
    )!;

    expect(premium.totalCost).toBe(1500);
    expect(premium.breakdown.totalCost).toBe(0); // היקרה בסט
    expect(premium.breakdown.trust).toBe(95); // מוחלט, לא מנורמל
    expect(premium.breakdown.delivery).toBe(100); // המהירה בסט
    expect(premium.breakdown.warranty).toBe(100); // הארוכה בסט
    expect(premium.breakdown.returns).toBe(100); // 30 יום, חינם
    expect(premium.valueScore).toBeCloseTo(58.8, 1);
  });

  it('החזרה בתשלום מקבלת ציון נמוך מהחזרה חינם באותו מספר ימים', () => {
    const free = makeOffer({ id: 'o-free', supplierId: 'mid', returnDays: 14, returnCost: 'free' });
    const paid = makeOffer({ id: 'o-paid', supplierId: 'mid', returnDays: 14, returnCost: 'paid' });
    const none = makeOffer({ id: 'o-none', supplierId: 'mid', returnDays: 14, returnCost: 'none' });
    const scored = scoreOffers([free, paid, none], SUPPLIERS, DEFAULT_WEIGHTS);
    const returnsOf = (id: string) => scored.find((o) => o.id === id)!.breakdown.returns;

    expect(returnsOf('o-free')).toBeGreaterThan(returnsOf('o-paid'));
    expect(returnsOf('o-none')).toBe(0);
  });
});

// ---------- 8. characterization: single offer ----------

describe('scoreOffers — ממד שאינו מבחין (Regression: באג B14)', () => {
  /**
   * לפני התיקון: כשכל ההצעות חלקו ערך זהה בממד כלשהו (המקרה הקיצוני —
   * הצעה יחידה), `min === max` והממד קיבל 100. זו הייתה טענת עליונות
   * במקום שבו אין השוואה כלל, והיא ניפחה את ציון התמורה.
   *
   * אחרי התיקון: ממד שאינו מבחין מקבל NEUTRAL_SCORE.
   */
  it('הצעה יחידה מקבלת ציון נייטרלי בממדים היחסיים, לא 100', () => {
    const [only] = scoreOffers([OFFER_CHEAP], SUPPLIERS, DEFAULT_WEIGHTS);

    expect(only.breakdown.totalCost).toBe(NEUTRAL_SCORE);
    expect(only.breakdown.delivery).toBe(NEUTRAL_SCORE);
    expect(only.breakdown.warranty).toBe(NEUTRAL_SCORE);
    expect(only.breakdown.totalCost).not.toBe(100);
  });

  it('הממדים המוחלטים אינם מושפעים ממספר ההצעות', () => {
    const [only] = scoreOffers([OFFER_CHEAP], SUPPLIERS, DEFAULT_WEIGHTS);

    expect(only.breakdown.trust).toBe(SUPPLIER_CHEAP.trustScore);
    expect(only.breakdown.returns).toBeCloseTo(25.67, 1);
  });

  it('ציון התמורה של הצעה יחידה אינו מנופח עוד', () => {
    const [alone] = scoreOffers([OFFER_CHEAP], SUPPLIERS, DEFAULT_WEIGHTS);

    // לפני התיקון: (100*40 + 55*25 + 100*15 + 100*10 + 25.67*10)/100 = 79.1
    // אחרי:        (50*40  + 55*25 + 50*15  + 50*10  + 25.67*10)/100 = 48.8
    expect(alone.valueScore).toBeCloseTo(48.8, 1);
    expect(alone.valueScore).toBeLessThan(79);
  });

  it('גם בסט מרובה הצעות, ממד אחיד מקבל נייטרלי במקום 100', () => {
    // שתי הצעות עם אותה אחריות בדיוק — הממד אינו מבחין ביניהן
    const a = makeOffer({ id: 'a', supplierId: 'mid', basePrice: 1000, warrantyMonths: 12 });
    const b = makeOffer({ id: 'b', supplierId: 'premium', basePrice: 1200, warrantyMonths: 12 });
    const scored = scoreOffers([a, b], SUPPLIERS, DEFAULT_WEIGHTS);

    expect(scored.every((o) => o.breakdown.warranty === NEUTRAL_SCORE)).toBe(true);
    // ובממד שכן מבחין הדירוג נשמר
    expect(scored.find((o) => o.id === 'a')!.breakdown.totalCost).toBe(100);
    expect(scored.find((o) => o.id === 'b')!.breakdown.totalCost).toBe(0);
  });

  it('ממד שאינו מבחין אינו משנה את סדר הדירוג', () => {
    // כל ההצעות חולקות אחריות וזמן אספקה זהים; רק העלות מבחינה
    const shared = { warrantyMonths: 12, deliveryDaysMin: 3, deliveryDaysMax: 3 } as const;
    const cheap = makeOffer({ id: 'c', supplierId: 'mid', basePrice: 800, ...shared });
    const mid = makeOffer({ id: 'm', supplierId: 'mid', basePrice: 1000, ...shared });
    const dear = makeOffer({ id: 'd', supplierId: 'mid', basePrice: 1200, ...shared });
    const ranked = rankOffers(scoreOffers([dear, cheap, mid], SUPPLIERS, DEFAULT_WEIGHTS), 'value');

    expect(idsOf(ranked)).toEqual(['c', 'm', 'd']);
  });
});
