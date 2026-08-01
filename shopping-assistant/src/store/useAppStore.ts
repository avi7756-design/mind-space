import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ActivityEntry,
  ActivityType,
  AlertChannelSettings,
  AlertRecord,
  ScoreWeights,
  Supplier,
  WatchlistItem,
} from '../types';
import { DEFAULT_WEIGHTS } from '../services/scoring';
import { SEED_ACTIVITY, SEED_ALERTS, SEED_WATCHLIST, SUPPLIERS } from '../data/seed';
import { evaluatePriceChange, trustChangeAlert } from '../services/alerts';
import { newId } from '../services/format';
import { PERSIST_NAME, PERSIST_VERSION, migratePersistedState } from './migrations';

const DEFAULT_CHANNELS: AlertChannelSettings = {
  email: { enabled: true, address: 'user@example.com' },
  telegram: { enabled: true, chatId: '' },
  webhook: { enabled: false, url: '' },
};

interface AppState {
  theme: 'light' | 'dark';
  weights: ScoreWeights;
  alertChannels: AlertChannelSettings;
  suppliers: Supplier[];
  watchlist: WatchlistItem[];
  alerts: AlertRecord[];
  activity: ActivityEntry[];
  searchHistory: string[];

  toggleTheme: () => void;
  setWeights: (weights: ScoreWeights) => void;
  setAlertChannels: (channels: AlertChannelSettings) => void;
  logActivity: (type: ActivityType, message: string) => void;
  recordSearch: (query: string, offerCount: number, supplierCount: number) => void;
  recordComparison: (query: string, topSupplier: string, offerCount: number) => void;
  addToWatchlist: (item: Omit<WatchlistItem, 'id' | 'createdAt' | 'history'>) => void;
  removeFromWatchlist: (id: string) => void;
  setTargetPrice: (id: string, target: number) => void;
  setSupplierExcluded: (id: string, excluded: boolean, reason?: string) => void;
  simulatePriceUpdates: () => void;
  simulateTrustUpdate: () => void;
  resetDemoData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      weights: DEFAULT_WEIGHTS,
      alertChannels: DEFAULT_CHANNELS,
      suppliers: SUPPLIERS,
      watchlist: SEED_WATCHLIST,
      alerts: SEED_ALERTS,
      activity: SEED_ACTIVITY,
      searchHistory: [],

      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),

      setWeights: (weights) => {
        set({ weights });
        get().logActivity(
          'settings',
          `עודכנו משקולות הדירוג: עלות ${weights.totalCost}%, אמינות ${weights.trust}%, משלוח ${weights.delivery}%, אחריות ${weights.warranty}%, החזרות ${weights.returns}%`,
        );
      },

      setAlertChannels: (alertChannels) => {
        set({ alertChannels });
        get().logActivity('settings', 'עודכנו ערוצי ההתראות');
      },

      logActivity: (type, message) =>
        set((s) => ({
          activity: [
            { id: newId('act'), type, message, createdAt: new Date().toISOString() },
            ...s.activity,
          ].slice(0, 200),
        })),

      recordSearch: (query, offerCount, supplierCount) => {
        set((s) => ({
          searchHistory: [query, ...s.searchHistory.filter((q) => q !== query)].slice(0, 10),
        }));
        get().logActivity(
          'search',
          `בוצע חיפוש: "${query}" — נמצאו ${offerCount} הצעות מ‑${supplierCount} ספקים`,
        );
      },

      recordComparison: (query, topSupplier, offerCount) => {
        get().logActivity(
          'compare',
          `הושוו ${offerCount} הצעות עבור "${query}" — ${topSupplier} דורגה ראשונה בתמורה למחיר`,
        );
      },

      addToWatchlist: (item) => {
        const entry: WatchlistItem = {
          ...item,
          id: newId('watch'),
          createdAt: new Date().toISOString(),
          history: [{ date: new Date().toISOString().slice(0, 10), price: item.currentPrice }],
        };
        set((s) => ({ watchlist: [entry, ...s.watchlist] }));
        get().logActivity(
          'track',
          `נוסף מוצר למעקב: ${item.productName} עם יעד ${item.targetPrice.toLocaleString('he-IL')} ₪`,
        );
      },

      removeFromWatchlist: (id) => {
        const item = get().watchlist.find((w) => w.id === id);
        set((s) => ({ watchlist: s.watchlist.filter((w) => w.id !== id) }));
        if (item) get().logActivity('track', `הוסר מהמעקב: ${item.productName}`);
      },

      setTargetPrice: (id, target) =>
        set((s) => ({
          watchlist: s.watchlist.map((w) => (w.id === id ? { ...w, targetPrice: target } : w)),
        })),

      setSupplierExcluded: (id, excluded, reason) => {
        set((s) => ({
          suppliers: s.suppliers.map((sup) =>
            sup.id === id ? { ...sup, excluded, exclusionReason: excluded ? reason : undefined } : sup,
          ),
        }));
        const sup = get().suppliers.find((x) => x.id === id);
        if (sup) {
          get().logActivity(
            'supplier_update',
            excluded ? `הספק ${sup.name} הוחרג מהתוצאות${reason ? ` — ${reason}` : ''}` : `הוסרה החרגת הספק ${sup.name}`,
          );
        }
      },

      // Demo-only: simulates the periodic price-polling job of the future backend
      simulatePriceUpdates: () => {
        const { watchlist, alertChannels } = get();
        const newAlerts: AlertRecord[] = [];
        const updated = watchlist.map((item) => {
          const drift = 1 + (Math.random() - 0.62) * 0.08; // slight downward bias
          const newPrice = Math.max(50, Math.round(item.currentPrice * drift));
          newAlerts.push(...evaluatePriceChange(item, item.currentPrice, newPrice, alertChannels));
          return {
            ...item,
            currentPrice: newPrice,
            history: [...item.history, { date: new Date().toISOString().slice(0, 10), price: newPrice }],
          };
        });
        set((s) => ({ watchlist: updated, alerts: [...newAlerts, ...s.alerts] }));
        get().logActivity('track', `בוצע עדכון מחירים ל‑${updated.length} מוצרים במעקב`);
        newAlerts.forEach((a) =>
          get().logActivity('alert', `נשלחה התראה: ${a.title} — ${a.productName ?? a.supplierName ?? ''} (${a.channels.length} ערוצים)`),
        );
      },

      // Demo-only: simulates a supplier trust-score refresh
      simulateTrustUpdate: () => {
        const { suppliers, alertChannels } = get();
        const candidates = suppliers.filter((s) => !s.excluded);
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        if (!target) return;
        const delta = Math.round((Math.random() - 0.5) * 8);
        if (delta === 0) return;
        const newScore = Math.min(100, Math.max(5, target.trustScore + delta));
        set((s) => ({
          suppliers: s.suppliers.map((sup) => (sup.id === target.id ? { ...sup, trustScore: newScore } : sup)),
          alerts: [trustChangeAlert(target.name, target.trustScore, newScore, alertChannels), ...s.alerts],
        }));
        get().logActivity('supplier_update', `עודכן ציון אמינות: ${target.name} ${target.trustScore} → ${newScore}`);
      },

      resetDemoData: () => {
        set({
          weights: DEFAULT_WEIGHTS,
          suppliers: SUPPLIERS,
          watchlist: SEED_WATCHLIST,
          alerts: SEED_ALERTS,
          activity: SEED_ACTIVITY,
          searchHistory: [],
        });
      },
    }),
    {
      name: PERSIST_NAME,
      version: PERSIST_VERSION,
      // The migration returns a partial state; zustand shallow-merges it over
      // the initial state, so anything it omits falls back to the seed defaults.
      migrate: (persistedState, version) =>
        migratePersistedState(persistedState, version) as unknown as AppState,
    },
  ),
);
