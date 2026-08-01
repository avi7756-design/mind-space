import { useState } from 'react';
import { Eye, RefreshCw, Target, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import SectionHeader from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import PriceHistoryChart from '../components/charts/PriceHistoryChart';
import { useAppStore } from '../store/useAppStore';
import { formatCurrency, formatDate } from '../services/format';
import { changePctSinceStart, hasReachedTarget } from '../services/watchlist';

export default function WatchlistPage() {
  const watchlist = useAppStore((s) => s.watchlist);
  const suppliers = useAppStore((s) => s.suppliers);
  const removeFromWatchlist = useAppStore((s) => s.removeFromWatchlist);
  const setTargetPrice = useAppStore((s) => s.setTargetPrice);
  const simulatePriceUpdates = useAppStore((s) => s.simulatePriceUpdates);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  function saveTarget(id: string) {
    const value = Number(editValue);
    if (Number.isFinite(value) && value > 0) setTargetPrice(id, Math.round(value));
    setEditingId(null);
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="מעקב מחירים"
        subtitle="ציר זמן היסטורי, מחירי יעד והתראות אוטומטיות כשמחיר יורד מתחת לסף"
        actions={
          <button className="btn-ghost" onClick={simulatePriceUpdates} title="הדמיית סבב עדכון מחירים (דמו)">
            <RefreshCw className="h-4 w-4" /> בדיקת מחירים עכשיו
          </button>
        }
      />

      {watchlist.length === 0 ? (
        <EmptyState
          icon={Eye}
          title="רשימת המעקב ריקה"
          description="חפשו מוצר והוסיפו הצעות למעקב — נעדכן אתכם כשהמחיר יורד מתחת ליעד שהגדרתם."
          action={
            <Link to="/search" className="btn-primary">
              לחיפוש מוצר
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {watchlist.map((item) => {
            const supplier = suppliers.find((s) => s.id === item.supplierId);
            const reached = hasReachedTarget(item);
            const changePct = changePctSinceStart(item).toFixed(1);
            return (
              <div key={item.id} className="card min-w-0 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{item.productName}</h3>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {supplier?.name ?? 'ספק לא ידוע'} · במעקב מאז {formatDate(item.createdAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromWatchlist(item.id)}
                    className="flex items-center justify-center text-slate-400 transition hover:text-rose-500"
                    title="הסרה מהמעקב"
                    aria-label={`הסרת ${item.productName} ממעקב המחירים`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div>
                    <div className="text-xs text-slate-400">מחיר נוכחי</div>
                    <div className="text-xl font-bold">{formatCurrency(item.currentPrice)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">מחיר יעד</div>
                    {editingId === item.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          type="number"
                          inputMode="decimal"
                          enterKeyHint="done"
                          min={1}
                          step={1}
                          aria-label="מחיר יעד חדש"
                          className="input !w-28 !py-1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveTarget(item.id)}
                        />
                        <button className="btn-primary !px-2.5 !py-1 text-xs" onClick={() => saveTarget(item.id)}>
                          שמירה
                        </button>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1.5 text-xl font-bold text-brand-600 hover:underline dark:text-brand-300"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditValue(String(item.targetPrice));
                        }}
                        title="עריכת מחיר יעד"
                      >
                        <Target className="h-4 w-4" />
                        {formatCurrency(item.targetPrice)}
                      </button>
                    )}
                  </div>
                  <div className="mr-auto flex flex-col items-end gap-1">
                    <Badge tone={reached ? 'emerald' : 'slate'}>{reached ? 'מתחת ליעד ✓' : 'מעל היעד'}</Badge>
                    <span
                      className={`text-xs font-medium ${
                        Number(changePct) <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {Number(changePct) <= 0 ? '' : '+'}
                      {changePct}% מאז תחילת המעקב
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <PriceHistoryChart history={item.history} targetPrice={item.targetPrice} height={180} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
