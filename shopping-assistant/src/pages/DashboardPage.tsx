import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Eye, PiggyBank, Search, ShieldCheck } from 'lucide-react';
import KpiCard from '../components/ui/KpiCard';
import SectionHeader from '../components/ui/SectionHeader';
import PriceHistoryChart from '../components/charts/PriceHistoryChart';
import Badge from '../components/ui/Badge';
import { useAppStore } from '../store/useAppStore';
import { formatCurrency, formatDateTime } from '../services/format';
import { hasReachedTarget, totalSavings } from '../services/watchlist';
import { ACTIVITY_META } from './ActivityPage';

export default function DashboardPage() {
  const watchlist = useAppStore((s) => s.watchlist);
  const alerts = useAppStore((s) => s.alerts);
  const activity = useAppStore((s) => s.activity);
  const suppliers = useAppStore((s) => s.suppliers);

  const stats = useMemo(() => {
    const totalSaving = totalSavings(watchlist);
    const belowTarget = watchlist.filter(hasReachedTarget).length;
    const verified = suppliers.filter((s) => s.verification === 'verified' && !s.excluded).length;
    const searches = activity.filter((a) => a.type === 'search').length;
    return { totalSaving, belowTarget, verified, searches };
  }, [watchlist, suppliers, activity]);

  const featured = watchlist[0];

  return (
    <div className="space-y-5">
      <SectionHeader
        title="דשבורד ניהולי"
        subtitle="תמונת מצב של החיפושים, המעקבים וההתראות שלכם"
        actions={
          <Link to="/search" className="btn-primary">
            <Search className="h-4 w-4" /> חיפוש מוצר חדש
          </Link>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="חיסכון מצטבר במעקב"
          value={formatCurrency(stats.totalSaving)}
          subtitle="ירידת מחיר מאז תחילת המעקב"
          icon={PiggyBank}
          accent="emerald"
          trend={{ value: 'המחירים במגמת ירידה', positive: true }}
        />
        <KpiCard
          title="מוצרים במעקב"
          value={String(watchlist.length)}
          subtitle={`${stats.belowTarget} מתחת למחיר היעד`}
          icon={Eye}
          accent="brand"
        />
        <KpiCard
          title="ספקים מאומתים"
          value={String(stats.verified)}
          subtitle={`מתוך ${suppliers.length} במאגר`}
          icon={ShieldCheck}
          accent="amber"
        />
        <KpiCard
          title="התראות שנשלחו"
          value={String(alerts.length)}
          subtitle={`${stats.searches} חיפושים ביומן`}
          icon={Bell}
          accent="rose"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Price trend chart */}
        <div className="card min-w-0 p-5 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">מגמת מחיר — {featured ? featured.productName : 'אין מוצרים במעקב'}</h2>
              {featured && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  נוכחי: {formatCurrency(featured.currentPrice)} · יעד: {formatCurrency(featured.targetPrice)}
                </p>
              )}
            </div>
            <Link to="/watchlist" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
              לכל המעקבים
            </Link>
          </div>
          {featured ? (
            <PriceHistoryChart history={featured.history} targetPrice={featured.targetPrice} height={260} />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">
              הוסיפו מוצר למעקב כדי לראות מגמת מחירים
            </div>
          )}
        </div>

        {/* Recent alerts */}
        <div className="card min-w-0 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">התראות אחרונות</h2>
            <Link to="/alerts" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
              לכל ההתראות
            </Link>
          </div>
          <div className="space-y-3">
            {alerts.slice(0, 4).map((alert) => (
              <div key={alert.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{alert.title}</span>
                  <Badge tone={alert.type === 'price_drop' ? 'emerald' : 'amber'}>
                    {alert.type === 'price_drop' ? 'מחיר' : alert.type === 'trust_change' ? 'אמינות' : 'מלאי'}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{alert.message}</p>
                <div className="mt-1.5 text-[11px] text-slate-400">{formatDateTime(alert.createdAt)}</div>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">אין התראות עדיין</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Watchlist snapshot */}
        <div className="card min-w-0 p-5 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">רשימת מעקב</h2>
            <Link to="/watchlist" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
              ניהול מעקבים
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-right text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2 pl-4 font-medium">מוצר</th>
                  <th className="py-2 pl-4 font-medium">מחיר נוכחי</th>
                  <th className="py-2 pl-4 font-medium">מחיר יעד</th>
                  <th className="py-2 font-medium">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.slice(0, 5).map((item) => {
                  const reached = hasReachedTarget(item);
                  return (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                      <td className="py-2.5 pl-4 font-medium">{item.productName}</td>
                      <td className="py-2.5 pl-4">{formatCurrency(item.currentPrice)}</td>
                      <td className="py-2.5 pl-4">{formatCurrency(item.targetPrice)}</td>
                      <td className="py-2.5">
                        <Badge tone={reached ? 'emerald' : 'slate'}>
                          {reached ? 'מתחת ליעד ✓' : 'מעל היעד'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {watchlist.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      אין מוצרים במעקב — הוסיפו מתוך תוצאות חיפוש
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent activity */}
        <div className="card min-w-0 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">פעילות אחרונה</h2>
            <Link to="/activity" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
              ליומן המלא
            </Link>
          </div>
          <ul className="space-y-3">
            {activity.slice(0, 6).map((entry) => {
              const meta = ACTIVITY_META[entry.type];
              return (
                <li key={entry.id} className="flex items-start gap-2.5 text-sm">
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-slate-700 dark:text-slate-300">{entry.message}</p>
                    <span className="text-[11px] text-slate-400">{formatDateTime(entry.createdAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
