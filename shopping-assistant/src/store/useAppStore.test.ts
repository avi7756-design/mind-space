import { describe, expect, it, vi } from 'vitest';
import { PERSIST_NAME, PERSIST_VERSION } from './migrations';

/**
 * Verifies that the persist middleware is actually wired to the migration —
 * the pure function being correct is worthless if the store never calls it.
 *
 * A tiny in-memory storage stub stands in for localStorage so the middleware
 * can initialise under Node. No DOM is involved.
 */
const memory = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
  key: () => null,
  get length() {
    return memory.size;
  },
});

const { useAppStore } = await import('./useAppStore');

const persistOptions = useAppStore.persist.getOptions();

function storedV1State() {
  return {
    theme: 'dark',
    watchlist: [
      {
        id: 'w3',
        productName: 'טלוויזיה LG OLED C3 65"',
        query: 'טלוויזיה LG OLED C3',
        supplierId: 'payngo',
        currentPrice: 6290,
        targetPrice: 5800,
        history: [{ date: '2026-08-01', price: 6290 }],
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ],
  };
}

describe('תצורת ה‑persist של ה‑store', () => {
  it('מוגדרת גרסה מפורשת התואמת ל‑PERSIST_VERSION', () => {
    expect(persistOptions.version).toBe(PERSIST_VERSION);
    expect(persistOptions.version).toBe(2);
  });

  it('מוגדרת פונקציית migrate', () => {
    expect(persistOptions.migrate).toBeTypeOf('function');
  });

  it('שם המפתח ב‑storage תואם ל‑PERSIST_NAME', () => {
    expect(persistOptions.name).toBe(PERSIST_NAME);
  });

  it('לא הוגדר partialize מותאם — נשמר כל ה‑state', () => {
    // zustand מספק partialize ברירת מחדל (זהות). הבדיקה מאמתת התנהגות ולא
    // נוכחות: אם מישהו יוסיף partialize מותאם בעתיד, השדה יסונן והבדיקה תיפול —
    // תזכורת לעדכן גם את המיגרציה וגם את ARCHITECTURE.md
    const sample = { theme: 'dark', watchlist: [], searchHistory: ['x'] } as never;

    expect(persistOptions.partialize!(sample)).toEqual(sample);
  });
});

describe('חיווט המיגרציה בפועל', () => {
  it('ה‑migrate המחובר מתקן state מגרסה 1', () => {
    const migrated = persistOptions.migrate!(storedV1State(), 1) as {
      watchlist: Array<{ currentPrice: number; history: Array<{ price: number }> }>;
    };

    expect(migrated.watchlist[0].currentPrice).toBe(6389);
    expect(migrated.watchlist[0].history[0].price).toBe(6389);
  });

  it('ה‑migrate המחובר משמר שדות שאינם קשורים', () => {
    const migrated = persistOptions.migrate!(storedV1State(), 1) as { theme: string };

    expect(migrated.theme).toBe('dark');
  });

  it('ה‑migrate המחובר אינו קורס על state ריק', () => {
    expect(() => persistOptions.migrate!(undefined, 0)).not.toThrow();
    expect(() => persistOptions.migrate!(null, 1)).not.toThrow();
  });
});

describe('מצב התחלתי של משתמש חדש', () => {
  it('ה‑store נטען עם נתוני ה‑seed המתוקנים', () => {
    const w3 = useAppStore.getState().watchlist.find((w) => w.id === 'w3');

    expect(w3?.currentPrice).toBe(6389);
  });
});
