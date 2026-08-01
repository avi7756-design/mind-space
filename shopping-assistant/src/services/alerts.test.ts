import { describe, expect, it } from 'vitest';
import { enabledChannels, evaluatePriceChange, trustChangeAlert } from './alerts';
import type { AlertChannelSettings, WatchlistItem } from '../types';

// ---------- fixtures ----------

function makeChannels(overrides?: Partial<{
  email: boolean;
  telegram: boolean;
  webhook: boolean;
}>): AlertChannelSettings {
  const on = { email: true, telegram: true, webhook: true, ...overrides };
  return {
    email: { enabled: on.email, address: 'user@example.com' },
    telegram: { enabled: on.telegram, chatId: '123456789' },
    webhook: { enabled: on.webhook, url: 'https://example.com/hook' },
  };
}

const NO_CHANNELS = makeChannels({ email: false, telegram: false, webhook: false });
const ALL_CHANNELS = makeChannels();

function makeItem(overrides?: Partial<WatchlistItem>): WatchlistItem {
  return {
    id: 'w1',
    productName: 'מוצר בדיקה',
    query: 'מוצר בדיקה',
    supplierId: 'mid',
    currentPrice: 1000,
    targetPrice: 900,
    history: [{ date: '2026-07-01', price: 1000 }],
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------- enabledChannels ----------

describe('enabledChannels', () => {
  it('מחזיר את הערוצים הפעילים בסדר קבוע: אימייל, טלגרם, webhook', () => {
    expect(enabledChannels(ALL_CHANNELS)).toEqual(['email', 'telegram', 'webhook']);
  });

  it('מחזיר מערך ריק כשאין ערוץ פעיל', () => {
    expect(enabledChannels(NO_CHANNELS)).toEqual([]);
  });

  it('מדלג על ערוץ מכובה גם אם פרטיו מלאים', () => {
    expect(enabledChannels(makeChannels({ telegram: false }))).toEqual(['email', 'webhook']);
  });
});

// ---------- evaluatePriceChange: חציית מחיר היעד ----------

describe('evaluatePriceChange — חציית מחיר היעד', () => {
  it('ירידה שחוצה את היעד מייצרת התראה', () => {
    const alerts = evaluatePriceChange(makeItem({ targetPrice: 900 }), 1000, 880, ALL_CHANNELS);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('price_drop');
    expect(alerts[0].title).toBe('ירידת מחיר מתחת ליעד');
    expect(alerts[0].productName).toBe('מוצר בדיקה');
  });

  it('ירידה בדיוק אל היעד נחשבת חצייה', () => {
    const alerts = evaluatePriceChange(makeItem({ targetPrice: 900 }), 1000, 900, ALL_CHANNELS);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toBe('ירידת מחיר מתחת ליעד');
  });

  it('אינו מתריע כשהמחיר כבר היה מתחת ליעד לפני השינוי', () => {
    // previousPrice > targetPrice הוא תנאי מפורש — מונע התראה חוזרת בכל סבב
    const alerts = evaluatePriceChange(makeItem({ targetPrice: 900 }), 880, 870, ALL_CHANNELS);

    expect(alerts).toEqual([]);
  });

  it('מחיר קודם ששווה בדיוק ליעד אינו נחשב חצייה', () => {
    // התנאי הוא previousPrice > targetPrice (חד-משמעי), ולכן שוויון אינו חצייה.
    // ירידה קטנה כאן אינה מייצרת דבר.
    const alerts = evaluatePriceChange(makeItem({ targetPrice: 900 }), 900, 890, ALL_CHANNELS);

    expect(alerts).toEqual([]);
  });

  it('מחיר קודם ששווה ליעד אינו מייצר גם התראת ירידה משמעותית (Regression: באג 3)', () => {
    // לפני התיקון: prev===target לא נחשב חצייה, אך הירידה של 5.6% נפלה
    // לכלל ה-5% והפיקה "ירידת מחיר משמעותית" — התראה על פריט שכבר עמד ביעד.
    // אחרי התיקון: שני הכללים דורשים previousPrice > targetPrice.
    const alerts = evaluatePriceChange(makeItem({ targetPrice: 900 }), 900, 850, ALL_CHANNELS);

    expect(alerts).toEqual([]);
  });

  it('פריט שכבר מתחת ליעד אינו מייצר התראת ירידה משמעותית', () => {
    const alerts = evaluatePriceChange(makeItem({ targetPrice: 900 }), 880, 800, ALL_CHANNELS);

    expect(alerts).toEqual([]);
  });

  it('פריט מעל היעד עדיין מייצר התראת ירידה משמעותית כרגיל', () => {
    const alerts = evaluatePriceChange(makeItem({ targetPrice: 500 }), 1000, 900, ALL_CHANNELS);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toBe('ירידת מחיר משמעותית');
  });
});

// ---------- evaluatePriceChange: ירידה משמעותית ----------

describe('evaluatePriceChange — ירידה משמעותית (סף 5%)', () => {
  it('ירידה של יותר מ‑5% מעל היעד מייצרת התראה משמעותית', () => {
    const alerts = evaluatePriceChange(makeItem({ targetPrice: 500 }), 1000, 900, ALL_CHANNELS);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toBe('ירידת מחיר משמעותית');
    expect(alerts[0].message).toContain('10.0%');
  });

  it('ירידה של בדיוק 5% חוצה את הסף', () => {
    const alerts = evaluatePriceChange(makeItem({ targetPrice: 500 }), 1000, 950, ALL_CHANNELS);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toBe('ירידת מחיר משמעותית');
  });

  it('ירידה של פחות מ‑5% אינה מייצרת התראה', () => {
    expect(evaluatePriceChange(makeItem({ targetPrice: 500 }), 1000, 951, ALL_CHANNELS)).toEqual([]);
  });
});

// ---------- evaluatePriceChange: מקרים ללא התראה ----------

describe('evaluatePriceChange — מקרים שאינם מייצרים התראה', () => {
  it('עליית מחיר', () => {
    expect(evaluatePriceChange(makeItem(), 1000, 1200, ALL_CHANNELS)).toEqual([]);
  });

  it('מחיר ללא שינוי', () => {
    expect(evaluatePriceChange(makeItem(), 1000, 1000, ALL_CHANNELS)).toEqual([]);
  });

  it('מחיר קודם אפס — נתון קצה שאינו מייצר התראה או חלוקה באפס', () => {
    const alerts = evaluatePriceChange(makeItem({ targetPrice: 900 }), 0, 0, ALL_CHANNELS);

    expect(alerts).toEqual([]);
  });
});

// ---------- evaluatePriceChange: עדיפות בין הכללים ----------

describe('evaluatePriceChange — עדיפות בין הכללים', () => {
  it('ירידה שגם חוצה את היעד וגם עולה על 5% מייצרת התראה אחת בלבד', () => {
    // המימוש משתמש ב-else if: חציית היעד גוברת, כדי לא לשלוח שתי התראות
    // על אותה ירידה
    const alerts = evaluatePriceChange(makeItem({ targetPrice: 900 }), 1000, 700, ALL_CHANNELS);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toBe('ירידת מחיר מתחת ליעד');
  });
});

// ---------- סטטוס וערוצים ----------

describe('evaluatePriceChange — סטטוס וערוצים', () => {
  it('עם ערוצים פעילים הסטטוס הוא sent והערוצים מצורפים', () => {
    const [alert] = evaluatePriceChange(makeItem({ targetPrice: 900 }), 1000, 880, ALL_CHANNELS);

    expect(alert.status).toBe('sent');
    expect(alert.channels).toEqual(['email', 'telegram', 'webhook']);
  });

  it('ללא ערוצים פעילים הסטטוס הוא pending ורשימת הערוצים ריקה', () => {
    const [alert] = evaluatePriceChange(makeItem({ targetPrice: 900 }), 1000, 880, NO_CHANNELS);

    expect(alert.status).toBe('pending');
    expect(alert.channels).toEqual([]);
  });

  it('הסטטוס נגזר מהגדרות הערוצים בלבד ואינו מעיד על שליחה בפועל', () => {
    // תיעוד מפורש: המנוע אינו שולח דבר. status==='sent' משמעו
    // "היה לאן לשלוח". שליחה אמיתית תתווסף רק עם ה-Backend.
    const [withChannel] = evaluatePriceChange(
      makeItem({ targetPrice: 900 }),
      1000,
      880,
      makeChannels({ telegram: false, webhook: false }),
    );

    expect(withChannel.status).toBe('sent');
    expect(withChannel.channels).toEqual(['email']);
  });

  it('גם התראת ירידה משמעותית מקבלת pending כשאין ערוצים', () => {
    const [alert] = evaluatePriceChange(makeItem({ targetPrice: 500 }), 1000, 900, NO_CHANNELS);

    expect(alert.title).toBe('ירידת מחיר משמעותית');
    expect(alert.status).toBe('pending');
    expect(alert.channels).toEqual([]);
  });

  it('מייצר מזהה ייחודי וחותמת זמן תקינה לכל התראה', () => {
    const [first] = evaluatePriceChange(makeItem({ targetPrice: 900 }), 1000, 880, ALL_CHANNELS);
    const [second] = evaluatePriceChange(makeItem({ targetPrice: 900 }), 1000, 880, ALL_CHANNELS);

    expect(first.id).toMatch(/^alert-/);
    expect(first.id).not.toBe(second.id);
    expect(Number.isNaN(Date.parse(first.createdAt))).toBe(false);
  });
});

// ---------- טוהר הפונקציה ----------

describe('evaluatePriceChange — טוהר ועצמאות מ‑Backend', () => {
  it('פועל סינכרונית ואינו מחזיר Promise', () => {
    const result = evaluatePriceChange(makeItem({ targetPrice: 900 }), 1000, 880, ALL_CHANNELS);

    expect(Array.isArray(result)).toBe(true);
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('אינו משנה את פריט המעקב שהועבר לו', () => {
    const item = makeItem({ targetPrice: 900 });
    const snapshot = JSON.stringify(item);
    evaluatePriceChange(item, 1000, 880, ALL_CHANNELS);

    expect(JSON.stringify(item)).toBe(snapshot);
  });
});

// ---------- trustChangeAlert ----------

describe('trustChangeAlert', () => {
  it('ירידה בציון מנוסחת כ"ירד"', () => {
    const alert = trustChangeAlert('AliExpress', 71, 64, ALL_CHANNELS);

    expect(alert.type).toBe('trust_change');
    expect(alert.message).toContain('ירד');
    expect(alert.message).toContain('71');
    expect(alert.message).toContain('64');
    expect(alert.supplierName).toBe('AliExpress');
  });

  it('עלייה בציון מנוסחת כ"עלה"', () => {
    expect(trustChangeAlert('KSP', 88, 92, ALL_CHANNELS).message).toContain('עלה');
  });

  it('ציון זהה מנוסח כ"ללא שינוי" (Regression: באג 2)', () => {
    // לפני התיקון: המימוש בדק רק newScore < previousScore, ולכן שוויון
    // נפל לענף "עלה" ודיווח על עלייה שלא קרתה.
    const alert = trustChangeAlert('KSP', 90, 90, ALL_CHANNELS);

    expect(alert.message).toContain('ללא שינוי');
    expect(alert.message).not.toContain('עלה');
    expect(alert.message).not.toContain('ירד');
    expect(alert.message).toContain('90');
  });

  it('ללא ערוצים פעילים הסטטוס הוא pending', () => {
    const alert = trustChangeAlert('KSP', 92, 85, NO_CHANNELS);

    expect(alert.status).toBe('pending');
    expect(alert.channels).toEqual([]);
  });
});
