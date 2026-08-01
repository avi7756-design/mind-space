import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TARGET_RATIO,
  baselinePrice,
  changePctSinceStart,
  hasReachedTarget,
  savingsSoFar,
  totalSavings,
  watchlistEntryFromOffer,
} from './watchlist';
import { offerTotalCost } from './scoring';
import type { Offer, WatchlistItem } from '../types';

// ---------- fixtures ----------

function makeOffer(overrides?: Partial<Offer>): Offer {
  return {
    id: 'o1',
    productName: 'מוצר בדיקה',
    supplierId: 'ksp',
    basePrice: 1000,
    shippingCost: 0,
    taxEstimate: 0,
    deliveryDaysMin: 2,
    deliveryDaysMax: 4,
    warrantyMonths: 12,
    returnDays: 14,
    returnCost: 'free',
    stock: 'in_stock',
    url: 'https://example.com/product',
    currency: 'ILS',
    ...overrides,
  };
}

function makeItem(overrides?: Partial<WatchlistItem>): WatchlistItem {
  return {
    id: 'w1',
    productName: 'מוצר בדיקה',
    query: 'מוצר בדיקה',
    supplierId: 'ksp',
    currentPrice: 1000,
    targetPrice: 900,
    history: [{ date: '2026-06-01', price: 1200 }],
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------- Offer → WatchlistItem ----------

describe('watchlistEntryFromOffer — עלות כוללת', () => {
  it('currentPrice הוא העלות הכוללת ולא מחיר הבסיס', () => {
    const offer = makeOffer({ basePrice: 1000, shippingCost: 100, taxEstimate: 50 });
    const entry = watchlistEntryFromOffer(offer, 'שאילתה');

    expect(entry.currentPrice).toBe(1150);
    expect(entry.currentPrice).not.toBe(offer.basePrice);
  });

  it('משלוח נכלל ב‑currentPrice', () => {
    const withShipping = watchlistEntryFromOffer(
      makeOffer({ basePrice: 6290, shippingCost: 99 }),
      'q',
    );
    const withoutShipping = watchlistEntryFromOffer(makeOffer({ basePrice: 6290 }), 'q');

    expect(withShipping.currentPrice - withoutShipping.currentPrice).toBe(99);
  });

  it('מס נכלל ב‑currentPrice', () => {
    const withTax = watchlistEntryFromOffer(
      makeOffer({ basePrice: 890, shippingCost: 45, taxEstimate: 150 }),
      'q',
    );

    expect(withTax.currentPrice).toBe(1085);
  });

  it('משתמש באותו חישוב כמו offerTotalCost — מקור אמת יחיד', () => {
    const offer = makeOffer({ basePrice: 1234, shippingCost: 56, taxEstimate: 78 });

    expect(watchlistEntryFromOffer(offer, 'q').currentPrice).toBe(offerTotalCost(offer));
  });

  it('מחיר היעד נגזר מהעלות הכוללת ולא ממחיר הבסיס', () => {
    const offer = makeOffer({ basePrice: 1000, shippingCost: 100, taxEstimate: 100 });
    const entry = watchlistEntryFromOffer(offer, 'q');

    // 1200 * 0.9 = 1080 — ולא 1000 * 0.9 = 900
    expect(entry.targetPrice).toBe(1080);
    expect(entry.targetPrice).toBe(Math.round(1200 * DEFAULT_TARGET_RATIO));
  });

  it('מאפשר יחס יעד מותאם', () => {
    const entry = watchlistEntryFromOffer(makeOffer({ basePrice: 1000 }), 'q', 0.8);

    expect(entry.targetPrice).toBe(800);
  });

  it('משמר את שם המוצר, הספק והשאילתה', () => {
    const offer = makeOffer({ productName: 'טלוויזיה LG', supplierId: 'payngo' });
    const entry = watchlistEntryFromOffer(offer, 'טלוויזיה LG OLED');

    expect(entry.productName).toBe('טלוויזיה LG');
    expect(entry.supplierId).toBe('payngo');
    expect(entry.query).toBe('טלוויזיה LG OLED');
  });

  it('אינו משנה את ההצעה שהועברה לו', () => {
    const offer = makeOffer({ basePrice: 1000, shippingCost: 100 });
    const snapshot = JSON.stringify(offer);
    watchlistEntryFromOffer(offer, 'q');

    expect(JSON.stringify(offer)).toBe(snapshot);
  });
});

// ---------- baseline & savings ----------

describe('baselinePrice', () => {
  it('מחזיר את המחיר הראשון בהיסטוריה', () => {
    expect(baselinePrice(makeItem({ history: [{ date: '2026-06-01', price: 1500 }] }))).toBe(1500);
  });

  it('נופל ל‑currentPrice כשההיסטוריה ריקה', () => {
    expect(baselinePrice(makeItem({ history: [], currentPrice: 990 }))).toBe(990);
  });
});

describe('savingsSoFar — חיסכון מבוסס עלות כוללת', () => {
  it('מחשב את ההפרש מול נקודת הפתיחה', () => {
    const item = makeItem({ currentPrice: 1000, history: [{ date: '2026-06-01', price: 1200 }] });

    expect(savingsSoFar(item)).toBe(200);
  });

  it('עליית מחיר אינה מייצרת חיסכון שלילי', () => {
    const item = makeItem({ currentPrice: 1400, history: [{ date: '2026-06-01', price: 1200 }] });

    expect(savingsSoFar(item)).toBe(0);
  });

  it('אינו מושפע ממחיר הבסיס — הוא כלל אינו חלק מפריט המעקב', () => {
    // WatchlistItem חסר basePrice מבחינה מבנית; הבדיקה מתעדת שהחיסכון
    // נגזר אך ורק מ-history ומ-currentPrice, שניהם בעלות כוללת
    const offer = makeOffer({ basePrice: 1000, shippingCost: 100, taxEstimate: 100 });
    const entry = watchlistEntryFromOffer(offer, 'q');
    const item = makeItem({
      currentPrice: entry.currentPrice,
      history: [{ date: '2026-06-01', price: 1500 }],
    });

    // 1500 - 1200 (עלות כוללת) = 300, ולא 1500 - 1000 (בסיס) = 500
    expect(savingsSoFar(item)).toBe(300);
    expect(savingsSoFar(item)).not.toBe(1500 - offer.basePrice);
  });

  it('totalSavings מסכם את כל הפריטים', () => {
    const items = [
      makeItem({ id: 'a', currentPrice: 1000, history: [{ date: '2026-06-01', price: 1200 }] }),
      makeItem({ id: 'b', currentPrice: 500, history: [{ date: '2026-06-01', price: 800 }] }),
      makeItem({ id: 'c', currentPrice: 900, history: [{ date: '2026-06-01', price: 700 }] }),
    ];

    expect(totalSavings(items)).toBe(200 + 300 + 0);
  });

  it('totalSavings של רשימה ריקה הוא אפס', () => {
    expect(totalSavings([])).toBe(0);
  });
});

describe('changePctSinceStart', () => {
  it('ירידה מיוצגת כאחוז שלילי', () => {
    const item = makeItem({ currentPrice: 900, history: [{ date: '2026-06-01', price: 1000 }] });

    expect(changePctSinceStart(item)).toBeCloseTo(-10, 5);
  });

  it('עלייה מיוצגת כאחוז חיובי', () => {
    const item = makeItem({ currentPrice: 1100, history: [{ date: '2026-06-01', price: 1000 }] });

    expect(changePctSinceStart(item)).toBeCloseTo(10, 5);
  });

  it('מחזיר אפס כשנקודת הפתיחה אינה חיובית — ללא חלוקה באפס', () => {
    const item = makeItem({ currentPrice: 0, history: [{ date: '2026-06-01', price: 0 }] });

    expect(changePctSinceStart(item)).toBe(0);
    expect(Number.isFinite(changePctSinceStart(item))).toBe(true);
  });
});

describe('hasReachedTarget', () => {
  it('נכון כשהמחיר מתחת ליעד', () => {
    expect(hasReachedTarget(makeItem({ currentPrice: 850, targetPrice: 900 }))).toBe(true);
  });

  it('נכון כשהמחיר שווה בדיוק ליעד', () => {
    expect(hasReachedTarget(makeItem({ currentPrice: 900, targetPrice: 900 }))).toBe(true);
  });

  it('שקרי כשהמחיר מעל היעד', () => {
    expect(hasReachedTarget(makeItem({ currentPrice: 950, targetPrice: 900 }))).toBe(false);
  });

  it('משווה עלות כוללת מול יעד — לא מחיר בסיס מול יעד', () => {
    // עלות כוללת 1150 מעל יעד 1000, אף שמחיר הבסיס (1000) היה עומד בו
    const entry = watchlistEntryFromOffer(
      makeOffer({ basePrice: 1000, shippingCost: 100, taxEstimate: 50 }),
      'q',
    );
    const item = makeItem({ currentPrice: entry.currentPrice, targetPrice: 1000 });

    expect(hasReachedTarget(item)).toBe(false);
  });
});
