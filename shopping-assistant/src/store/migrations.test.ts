import { describe, expect, it } from 'vitest';
import {
  PERSIST_NAME,
  PERSIST_VERSION,
  SEED_PRICE_CORRECTIONS,
  migratePersistedState,
} from './migrations';
import { SEED_WATCHLIST } from '../data/seed';

// ---------- fixtures ----------

/** A stored watchlist item as it looked in persist v1. */
function storedItem(overrides?: Record<string, unknown>) {
  return {
    id: 'w3',
    productName: 'טלוויזיה LG OLED C3 65"',
    query: 'טלוויזיה LG OLED C3',
    supplierId: 'payngo',
    currentPrice: 6290,
    targetPrice: 5800,
    history: [
      { date: '2026-04-01', price: 7490 },
      { date: '2026-07-01', price: 6800 },
      { date: '2026-08-01', price: 6290 },
    ],
    createdAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A full v1 payload, including the fields the migration must not touch. */
function storedState(overrides?: Record<string, unknown>) {
  return {
    theme: 'dark',
    weights: { totalCost: 50, trust: 20, delivery: 10, warranty: 10, returns: 10 },
    alertChannels: {
      email: { enabled: true, address: 'avi@example.com' },
      telegram: { enabled: false, chatId: '' },
      webhook: { enabled: true, url: 'https://example.com/hook' },
    },
    suppliers: [{ id: 'ksp', excluded: true, exclusionReason: 'החרגה של המשתמש' }],
    watchlist: [storedItem()],
    alerts: [{ id: 'a1', type: 'price_drop' }],
    activity: [{ id: 'ac1', type: 'search' }],
    searchHistory: ['מקרר', 'תנור'],
    ...overrides,
  };
}

const watchlistOf = (state: Record<string, unknown>) =>
  state.watchlist as Array<Record<string, unknown>>;

// ---------- 1–3. the v1 → v2 price correction ----------

describe('migratePersistedState — תיקון מחיר w3', () => {
  it('currentPrice של w3 עולה מ‑6290 ל‑6389', () => {
    const migrated = migratePersistedState(storedState(), 1);

    expect(watchlistOf(migrated)[0].currentPrice).toBe(6389);
  });

  it('נקודת ההיסטוריה האחרונה שהייתה 6290 מתעדכנת ל‑6389', () => {
    const migrated = migratePersistedState(storedState(), 1);
    const history = watchlistOf(migrated)[0].history as Array<{ price: number }>;

    expect(history[history.length - 1].price).toBe(6389);
  });

  it('נקודות היסטוריה קודמות אינן משתנות', () => {
    const migrated = migratePersistedState(storedState(), 1);
    const history = watchlistOf(migrated)[0].history as Array<{ price: number }>;

    expect(history[0].price).toBe(7490);
    expect(history[1].price).toBe(6800);
  });

  it('targetPrice של המשתמש נשמר ללא שינוי', () => {
    const migrated = migratePersistedState(
      storedState({ watchlist: [storedItem({ targetPrice: 5250 })] }),
      1,
    );

    expect(watchlistOf(migrated)[0].targetPrice).toBe(5250);
  });

  it('נקודת היסטוריה אחרונה בערך אחר אינה נדרסת', () => {
    const migrated = migratePersistedState(
      storedState({
        watchlist: [storedItem({ history: [{ date: '2026-08-01', price: 6100 }] })],
      }),
      1,
    );
    const history = watchlistOf(migrated)[0].history as Array<{ price: number }>;

    expect(watchlistOf(migrated)[0].currentPrice).toBe(6389);
    expect(history[0].price).toBe(6100);
  });
});

// ---------- 4–6. narrow matching: user data wins ----------

describe('migratePersistedState — התאמה צרה ושמירה על נתוני משתמש', () => {
  it('פריט שאינו w3 אינו משתנה', () => {
    const userItem = storedItem({ id: 'watch-user-1', currentPrice: 6290 });
    const migrated = migratePersistedState(storedState({ watchlist: [userItem] }), 1);

    expect(watchlistOf(migrated)[0]).toEqual(userItem);
  });

  it('w3 אצל ספק אחר אינו משתנה', () => {
    const other = storedItem({ supplierId: 'ksp' });
    const migrated = migratePersistedState(storedState({ watchlist: [other] }), 1);

    expect(watchlistOf(migrated)[0].currentPrice).toBe(6290);
  });

  it('w3 שכבר עומד על 6389 אינו משתנה', () => {
    const already = storedItem({ currentPrice: 6389 });
    const migrated = migratePersistedState(storedState({ watchlist: [already] }), 1);

    expect(watchlistOf(migrated)[0]).toEqual(already);
  });

  it('w3 שהמשתמש שינה ביודעין למחיר אחר אינו נדרס', () => {
    const edited = storedItem({ currentPrice: 6100 });
    const migrated = migratePersistedState(storedState({ watchlist: [edited] }), 1);

    expect(watchlistOf(migrated)[0].currentPrice).toBe(6100);
  });

  it('מתקן רק את הפריט התואם ומשאיר את השאר כמות שהם', () => {
    const userItem = storedItem({ id: 'watch-user-1', currentPrice: 999 });
    const migrated = migratePersistedState(
      storedState({ watchlist: [userItem, storedItem()] }),
      1,
    );

    expect(watchlistOf(migrated)[0]).toEqual(userItem);
    expect(watchlistOf(migrated)[1].currentPrice).toBe(6389);
  });
});

// ---------- 7–8. malformed / partial state ----------

describe('migratePersistedState — state חלקי או פגום', () => {
  it('undefined אינו גורם לקריסה ומחזיר אובייקט ריק', () => {
    expect(migratePersistedState(undefined, 1)).toEqual({});
  });

  it('null אינו גורם לקריסה', () => {
    expect(migratePersistedState(null, 1)).toEqual({});
  });

  it('אובייקט ריק נשאר ריק', () => {
    expect(migratePersistedState({}, 1)).toEqual({});
  });

  it('מערך או ערך פרימיטיבי אינם גורמים לקריסה', () => {
    expect(migratePersistedState([1, 2, 3], 1)).toEqual({});
    expect(migratePersistedState('broken', 1)).toEqual({});
    expect(migratePersistedState(42, 1)).toEqual({});
  });

  it('watchlist חסר אינו גורם לקריסה ושאר השדות נשמרים', () => {
    const state = storedState();
    delete (state as Record<string, unknown>).watchlist;
    const migrated = migratePersistedState(state, 1);

    expect(migrated.watchlist).toBeUndefined();
    expect(migrated.theme).toBe('dark');
    expect(migrated.searchHistory).toEqual(['מקרר', 'תנור']);
  });

  it('watchlist שאינו מערך נשמר כמות שהוא ואינו מפיל את המיגרציה', () => {
    const migrated = migratePersistedState(storedState({ watchlist: 'corrupt' }), 1);

    expect(migrated.watchlist).toBe('corrupt');
  });

  it('פריטים חסרי שדות או שאינם אובייקטים עוברים ללא שינוי', () => {
    const migrated = migratePersistedState(
      storedState({ watchlist: [null, 7, { id: 'w3' }, { id: 'w3', supplierId: 'payngo' }] }),
      1,
    );

    expect(watchlistOf(migrated)).toEqual([null, 7, { id: 'w3' }, { id: 'w3', supplierId: 'payngo' }]);
  });

  it('פריט w3 ללא היסטוריה מתוקן במחיר בלבד', () => {
    const noHistory = storedItem();
    delete (noHistory as Record<string, unknown>).history;
    const migrated = migratePersistedState(storedState({ watchlist: [noHistory] }), 1);

    expect(watchlistOf(migrated)[0].currentPrice).toBe(6389);
    expect(watchlistOf(migrated)[0].history).toBeUndefined();
  });

  it('היסטוריה ריקה אינה גורמת לקריסה', () => {
    const migrated = migratePersistedState(
      storedState({ watchlist: [storedItem({ history: [] })] }),
      1,
    );

    expect(watchlistOf(migrated)[0].currentPrice).toBe(6389);
    expect(watchlistOf(migrated)[0].history).toEqual([]);
  });
});

// ---------- 9. unrelated fields survive ----------

describe('migratePersistedState — שדות אחרים נשמרים', () => {
  it('theme, weights, alertChannels, suppliers, alerts, activity ו‑searchHistory אינם משתנים', () => {
    const original = storedState();
    const migrated = migratePersistedState(original, 1);

    expect(migrated.theme).toBe('dark');
    expect(migrated.weights).toEqual(original.weights);
    expect(migrated.alertChannels).toEqual(original.alertChannels);
    expect(migrated.suppliers).toEqual(original.suppliers);
    expect(migrated.alerts).toEqual(original.alerts);
    expect(migrated.activity).toEqual(original.activity);
    expect(migrated.searchHistory).toEqual(original.searchHistory);
  });

  it('החרגות ספקים שהמשתמש ביצע נשמרות', () => {
    const migrated = migratePersistedState(storedState(), 1);
    const suppliers = migrated.suppliers as Array<Record<string, unknown>>;

    expect(suppliers[0].excluded).toBe(true);
    expect(suppliers[0].exclusionReason).toBe('החרגה של המשתמש');
  });

  it('שדות עתידיים שאינם מוכרים עוברים ללא שינוי', () => {
    const migrated = migratePersistedState(
      storedState({ futureFeatureFlag: { enabled: true, tier: 'pro' } }),
      1,
    );

    expect(migrated.futureFeatureFlag).toEqual({ enabled: true, tier: 'pro' });
  });

  it('אינו משנה את האובייקט המקורי', () => {
    const original = storedState();
    const snapshot = JSON.stringify(original);
    migratePersistedState(original, 1);

    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

// ---------- 10. idempotency & version handling ----------

describe('migratePersistedState — אידמפוטנטיות וטיפול בגרסאות', () => {
  it('הפעלה פעמיים נותנת אותה תוצאה', () => {
    const once = migratePersistedState(storedState(), 1);
    const twice = migratePersistedState(once, 1);

    expect(twice).toEqual(once);
  });

  it('הפעלה על state שכבר בגרסה הנוכחית אינה משנה דבר', () => {
    const state = storedState();
    const migrated = migratePersistedState(state, PERSIST_VERSION);

    expect(migrated).toEqual(state);
  });

  it('גרסה 0 מטופלת כמו גרסה ישנה', () => {
    const migrated = migratePersistedState(storedState(), 0);

    expect(watchlistOf(migrated)[0].currentPrice).toBe(6389);
  });

  it('גרסה עתידית לא מוכרת עוברת ללא שינוי במקום ניחוש', () => {
    const state = storedState();
    const migrated = migratePersistedState(state, PERSIST_VERSION + 5);

    expect(migrated).toEqual(state);
    expect(watchlistOf(migrated)[0].currentPrice).toBe(6290);
  });
});

// ---------- 11. new user still gets fresh seed ----------

describe('משתמש חדש', () => {
  it('ללא state שמור מתקבל אובייקט ריק, כך ש‑zustand נופל ל‑seed הנוכחי', () => {
    expect(migratePersistedState(undefined, 0)).toEqual({});
  });

  it('ה‑seed הנוכחי כבר מכיל את המחיר המתוקן', () => {
    const w3 = SEED_WATCHLIST.find((w) => w.id === 'w3')!;

    expect(w3.currentPrice).toBe(6389);
    expect(w3.history[w3.history.length - 1].price).toBe(6389);
  });
});

// ---------- constants ----------

describe('קבועי ה‑persist', () => {
  it('גרסת ה‑persist היא 2', () => {
    expect(PERSIST_VERSION).toBe(2);
  });

  it('שם המפתח ב‑storage לא השתנה — אחרת state קיים היה נעלם', () => {
    expect(PERSIST_NAME).toBe('shopping-assistant-store');
  });

  it('כלל התיקון מתאר את המעבר מ‑6290 ל‑6389', () => {
    expect(SEED_PRICE_CORRECTIONS).toEqual([
      { id: 'w3', supplierId: 'payngo', fromPrice: 6290, toPrice: 6389 },
    ]);
  });
});
