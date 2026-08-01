import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Award,
  Coins,
  FileDown,
  FileText,
  Loader2,
  PackageSearch,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import SectionHeader from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import ComparisonTable from '../components/compare/ComparisonTable';
import ImageSearchInput from '../components/search/ImageSearchInput';
import ScoreBar from '../components/ui/ScoreBar';
import { getSupplierDataProvider } from '../services/api';
import { rankOffers, scoreOffers } from '../services/scoring';
import { exportComparisonCsv, exportComparisonPdf } from '../services/export';
import { watchlistEntryFromOffer } from '../services/watchlist';
import { useAppStore } from '../store/useAppStore';
import type { Offer, RankingMode, ScoredOffer } from '../types';
import { formatCurrency } from '../services/format';

const RANK_TABS: Array<{ mode: RankingMode; label: string; icon: typeof Award }> = [
  { mode: 'value', label: 'התמורה הטובה ביותר', icon: Award },
  { mode: 'price', label: 'המחיר הכולל הנמוך ביותר', icon: Coins },
  { mode: 'trust', label: 'הספק האמין ביותר', icon: ShieldCheck },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';

  const [input, setInput] = useState(urlQuery);
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [searched, setSearched] = useState('');
  const [rankMode, setRankMode] = useState<RankingMode>('value');
  const [maxDeliveryDays, setMaxDeliveryDays] = useState<number | null>(null);
  const [freeReturnsOnly, setFreeReturnsOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [toast, setToast] = useState('');

  const suppliers = useAppStore((s) => s.suppliers);
  const weights = useAppStore((s) => s.weights);
  const searchHistory = useAppStore((s) => s.searchHistory);
  const recordSearch = useAppStore((s) => s.recordSearch);
  const recordComparison = useAppStore((s) => s.recordComparison);
  const addToWatchlist = useAppStore((s) => s.addToWatchlist);

  const runSearch = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
      setLoading(true);
      setSearched(q);
      try {
        const results = await getSupplierDataProvider().searchOffers(q);
        setOffers(results);
        recordSearch(q, results.length, new Set(results.map((o) => o.supplierId)).size);
      } finally {
        setLoading(false);
      }
    },
    [recordSearch],
  );

  // React to searches submitted from the global top bar
  useEffect(() => {
    if (urlQuery && urlQuery !== searched) {
      setInput(urlQuery);
      void runSearch(urlQuery);
    }
  }, [urlQuery, searched, runSearch]);

  const scored = useMemo(() => scoreOffers(offers, suppliers, weights), [offers, suppliers, weights]);

  const filtered = useMemo(() => {
    let list = scored;
    if (maxDeliveryDays !== null) list = list.filter((o) => o.deliveryDaysMax <= maxDeliveryDays);
    if (freeReturnsOnly) list = list.filter((o) => o.returnCost === 'free');
    if (inStockOnly) list = list.filter((o) => o.stock === 'in_stock');
    return rankOffers(list, rankMode);
  }, [scored, rankMode, maxDeliveryDays, freeReturnsOnly, inStockOnly]);

  const best = filtered[0];

  useEffect(() => {
    if (searched && scored.length > 0) {
      const top = rankOffers(scored, 'value')[0];
      recordComparison(searched, top.supplier.name, scored.length);
    }
    // Log one comparison per completed search, not per re-filter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, offers.length]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setSearchParams({ q: input.trim() });
  }

  function trackOffer(offer: ScoredOffer) {
    addToWatchlist(watchlistEntryFromOffer(offer, searched));
    showToast(`"${offer.productName}" נוסף למעקב מחירים אצל ${offer.supplier.name}`);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  }

  function onExportPdf() {
    const result = exportComparisonPdf();
    showToast(result.reason);
  }

  const excludedCount = offers.length - scored.length;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="חיפוש והשוואת מחירים"
        subtitle="חיפוש חופשי בשפה טבעית — המערכת אוספת הצעות מספקים מהימנים בלבד ומדרגת אותן"
        actions={
          searched && filtered.length > 0 ? (
            <>
              <button className="btn-ghost" onClick={() => exportComparisonCsv(filtered, searched)}>
                <FileDown className="h-4 w-4" /> ייצוא CSV
              </button>
              <button className="btn-ghost" onClick={onExportPdf}>
                <FileText className="h-4 w-4" /> ייצוא PDF
              </button>
            </>
          ) : undefined
        }
      />

      {/* Search intake */}
      <form onSubmit={submit} className="card flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="חיפוש מוצר להשוואה"
            placeholder='תארו מה אתם מחפשים, לדוגמה: "אוזניות אלחוטיות עם סינון רעשים עד 1,500 ש״ח"'
            className="input pr-9"
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          חיפוש שוק
        </button>
      </form>

      <ImageSearchInput />

      {searchHistory.length > 0 && !searched && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">חיפושים אחרונים:</span>
          {searchHistory.map((q) => (
            <button
              key={q}
              onClick={() => setSearchParams({ q })}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="card flex flex-col items-center gap-3 py-14 text-slate-500 dark:text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <div>סורק ספקים מהימנים ומחשב עלות כוללת…</div>
        </div>
      )}

      {!loading && !searched && (
        <EmptyState
          icon={PackageSearch}
          title="התחילו חיפוש שוק"
          description="הקלידו שם מוצר או תיאור חופשי, והמערכת תאסוף הצעות מספקים מאומתים, תחשב עלות כוללת (כולל משלוח ומסים) ותדרג לפי תמורה, מחיר ואמינות."
        />
      )}

      {!loading && searched && filtered.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title="לא נמצאו הצעות מתאימות"
          description="נסו לרכך את הסינון (זמן אספקה, החזרות, מלאי) או לחפש בניסוח אחר."
        />
      )}

      {!loading && searched && scored.length > 0 && (
        <>
          {/* Ranking tabs + filters */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {RANK_TABS.map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => setRankMode(mode)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    rankMode === mode
                      ? 'bg-brand-600 text-white'
                      : 'border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <SlidersHorizontal className="h-4 w-4" /> סינון:
              </span>
              <select
                className="input !w-auto"
                value={maxDeliveryDays ?? ''}
                onChange={(e) => setMaxDeliveryDays(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">כל זמן אספקה</option>
                <option value="3">עד 3 ימים</option>
                <option value="7">עד שבוע</option>
                <option value="14">עד שבועיים</option>
              </select>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={freeReturnsOnly}
                  onChange={(e) => setFreeReturnsOnly(e.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
                החזרה חינם
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
                במלאי בלבד
              </label>
            </div>
          </div>

          {excludedCount > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              {excludedCount} הצעות סוננו אוטומטית כי הגיעו מספקים חסומים או לא מאומתים
            </div>
          )}

          {/* Best offer highlight */}
          {best && (
            <div className="card grid gap-4 p-5 lg:grid-cols-[1fr_320px]">
              <div>
                <div className="text-xs font-medium text-brand-600 dark:text-brand-300">
                  ההמלצה המובילה — {RANK_TABS.find((t) => t.mode === rankMode)?.label}
                </div>
                <h2 className="mt-1 text-lg font-bold">{best.productName}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {best.supplier.name} · סה"כ {formatCurrency(best.totalCost)} · ציון תמורה {best.valueScore}
                </p>
                <a href={best.url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4">
                  מעבר להצעה אצל הספק
                </a>
              </div>
              <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  פירוק ציון (משוקלל לפי ההגדרות שלכם)
                </div>
                <ScoreBar label="עלות" value={best.breakdown.totalCost} />
                <ScoreBar label="אמינות" value={best.breakdown.trust} />
                <ScoreBar label="משלוח" value={best.breakdown.delivery} />
                <ScoreBar label="אחריות" value={best.breakdown.warranty} />
                <ScoreBar label="החזרות" value={best.breakdown.returns} />
              </div>
            </div>
          )}

          <ComparisonTable offers={filtered} bestOfferId={best?.id} onTrack={trackOffer} />
        </>
      )}

      {toast && (
        <div className="toast-safe fixed left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
          {toast}
        </div>
      )}
    </div>
  );
}
