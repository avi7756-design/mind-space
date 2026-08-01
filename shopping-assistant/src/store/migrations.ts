/**
 * Persisted-state migrations for the Zustand store.
 *
 * Kept in its own module — free of React, of zustand and of any storage API —
 * so the whole thing is testable as a pure function.
 *
 * RULES THIS FILE OBEYS:
 *  1. Never wipe user data. An unusable payload falls back to the store's
 *     initial state; a usable one is corrected field by field.
 *  2. Only touch what a rule explicitly matches. Anything unrecognised —
 *     including fields added by a future version — is passed through as-is.
 *  3. Every rule is idempotent: it matches on the old value, so re-running it
 *     over already-migrated state is a no-op.
 */

/** Bump by one whenever a new migration rule is added below. */
export const PERSIST_VERSION = 2;

export const PERSIST_NAME = 'shopping-assistant-store';

/**
 * A one-time correction for a seed record that shipped with a wrong price.
 *
 * The match is deliberately narrow (id + supplier + exact old price) so that a
 * user who edited the same record keeps their own value.
 */
interface SeedPriceCorrection {
  id: string;
  supplierId: string;
  fromPrice: number;
  toPrice: number;
}

/**
 * v1 → v2: `currentPrice` became the TOTAL purchase cost (base + shipping + tax).
 * The LG TV seed record was missing Pay&Go's 99 ILS shipping.
 */
export const SEED_PRICE_CORRECTIONS: SeedPriceCorrection[] = [
  { id: 'w3', supplierId: 'payngo', fromPrice: 6290, toPrice: 6389 },
];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Applies one correction to a single stored watchlist item, if it matches exactly. */
function correctWatchlistItem(item: unknown): unknown {
  if (!isRecord(item)) return item;

  const rule = SEED_PRICE_CORRECTIONS.find(
    (r) =>
      item.id === r.id && item.supplierId === r.supplierId && item.currentPrice === r.fromPrice,
  );
  if (!rule) return item;

  const corrected: UnknownRecord = { ...item, currentPrice: rule.toPrice };

  // The timeline must end at the current price. Only the trailing point is
  // rewritten, and only when it still holds the stale value.
  if (Array.isArray(item.history) && item.history.length > 0) {
    const history = [...item.history];
    const lastIndex = history.length - 1;
    const last = history[lastIndex];
    if (isRecord(last) && last.price === rule.fromPrice) {
      history[lastIndex] = { ...last, price: rule.toPrice };
      corrected.history = history;
    }
  }

  // targetPrice is the user's own choice and is never rewritten.
  return corrected;
}

function applySeedPriceCorrections(state: UnknownRecord): UnknownRecord {
  // A missing or malformed watchlist is left untouched rather than replaced —
  // dropping it would destroy data we cannot interpret.
  if (!Array.isArray(state.watchlist)) return state;

  return { ...state, watchlist: state.watchlist.map(correctWatchlistItem) };
}

/**
 * Zustand `migrate` handler.
 *
 * Returns a partial state that zustand shallow-merges over the store's initial
 * state, so any key we omit falls back to the current seed defaults.
 */
export function migratePersistedState(persistedState: unknown, version: number): UnknownRecord {
  // null / undefined / array / primitive → nothing to preserve; a new user
  // (or an unreadable payload) simply gets the current seed data.
  if (!isRecord(persistedState)) return {};

  let state: UnknownRecord = { ...persistedState };

  // A state written by a NEWER build than this one is passed through untouched:
  // we cannot know its rules, and guessing would corrupt it.
  if (version >= PERSIST_VERSION) return state;

  if (version < 2) {
    state = applySeedPriceCorrections(state);
  }

  return state;
}
