import { describe, expect, it } from 'vitest';
import { SEED_WATCHLIST, SUPPLIERS, generateOffersForQuery } from './seed';
import { offerTotalCost } from '../services/scoring';

/**
 * Guards the total-cost invariant of the demo data.
 *
 * These tests are the reason `seed.ts` does not need to import from the
 * services layer (which would invert the documented layering): the invariant
 * is enforced here instead. A future catalog edit that changes a price or a
 * shipping cost without updating the watchlist fails the suite rather than
 * silently skewing every savings figure in the dashboard.
 */

function catalogOfferFor(query: string, supplierId: string) {
  const offer = generateOffersForQuery(query).find((o) => o.supplierId === supplierId);
  if (!offer) throw new Error(`no catalog offer for "${query}" @ ${supplierId}`);
  return offer;
}

describe('SEED_WATCHLIST — אינוריאנט העלות הכוללת', () => {
  it('אינו ריק (אחרת הבדיקות שלהלן ריקות מתוכן)', () => {
    expect(SEED_WATCHLIST.length).toBeGreaterThan(0);
  });

  it.each(SEED_WATCHLIST.map((item) => [item.id, item] as const))(
    '%s — currentPrice שווה לעלות הכוללת של הצעת הקטלוג',
    (_id, item) => {
      const offer = catalogOfferFor(item.query, item.supplierId);

      expect(item.currentPrice).toBe(offerTotalCost(offer));
    },
  );

  it.each(SEED_WATCHLIST.map((item) => [item.id, item] as const))(
    '%s — נקודת המחיר האחרונה בהיסטוריה שווה ל‑currentPrice',
    (_id, item) => {
      const last = item.history[item.history.length - 1];

      expect(last.price).toBe(item.currentPrice);
    },
  );

  it.each(SEED_WATCHLIST.map((item) => [item.id, item] as const))(
    '%s — currentPrice גדול ממחיר הבסיס כשיש משלוח או מס',
    (_id, item) => {
      const offer = catalogOfferFor(item.query, item.supplierId);
      const extras = offer.shippingCost + offer.taxEstimate;

      if (extras > 0) {
        expect(item.currentPrice).toBeGreaterThan(offer.basePrice);
        expect(item.currentPrice - offer.basePrice).toBe(extras);
      } else {
        expect(item.currentPrice).toBe(offer.basePrice);
      }
    },
  );

  it('כל פריט מפנה לספק שקיים במאגר ואינו חסום', () => {
    for (const item of SEED_WATCHLIST) {
      const supplier = SUPPLIERS.find((s) => s.id === item.supplierId);

      expect(supplier, `supplier ${item.supplierId} missing`).toBeDefined();
      expect(supplier!.excluded).toBe(false);
    }
  });

  it('היסטוריית המחירים אינה ריקה ומכילה מחירים חיוביים בלבד', () => {
    for (const item of SEED_WATCHLIST) {
      expect(item.history.length).toBeGreaterThan(0);
      expect(item.history.every((p) => p.price > 0)).toBe(true);
    }
  });

  it('לפחות פריט אחד כולל משלוח — כך שהאינוריאנט נבדק בפועל ולא באופן ריק', () => {
    const withExtras = SEED_WATCHLIST.filter((item) => {
      const offer = catalogOfferFor(item.query, item.supplierId);
      return offer.shippingCost + offer.taxEstimate > 0;
    });

    expect(withExtras.length).toBeGreaterThan(0);
  });
});
