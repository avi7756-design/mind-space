import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  Bell,
  CircleDollarSign,
  Eye,
  PiggyBank,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import KpiCard from '../components/ui/KpiCard';
import SectionHeader from '../components/ui/SectionHeader';
import PriceHistoryChart from '../components/charts/PriceHistoryChart';
import Badge from '../components/ui/Badge';
import { useAppStore } from '../store/useAppStore';
import { formatCurrency, formatDateTime } from '../services/format';
import { ACTIVITY_META } from './ActivityPage';

export default function DashboardPage() {
  const watchlist = useAppStore((s) => s.watchlist);
  const alerts = useAppStore((s) => s.alerts);
  const activity = useAppStore((s) => s.activity);
  const suppliers = useAppStore((s) => s.suppliers);
  const [featuredId, setFeaturedId] = useState<string | undefined>(watchlist[0]?.id);

  const stats = useMemo(() => {
    const totalSaving = watchlist.reduce((sum, item) => {
      const firstPrice = item.history[0]?.price ?? item.currentPrice;
      return sum + Math.max(0, firstPrice - item.currentPrice);
    }, 0);
    const belowTarget = watchlist.filter((item) => item.currentPrice <= item.targetPrice).length;
    const verifiedSuppliers = suppliers.filter((supplier) => supplier.verification === 'verified' && !supplier.excluded);
    const searches = activity.filter((entry) => entry.type === 'search').length;
    const targetGap = watchlist.reduce((sum, item) => sum + Math.max(0, item.currentPrice - item.targetPrice), 0);
    const averageTrust = verifiedSuppliers.length
      ? Math.round(verifiedSuppliers.reduce((sum, supplier) => sum + supplier.trustScore, 0) / verifiedSuppliers.length)
      : 0;

    return {
      totalSaving,
      belowTarget,
      verified: verifiedSuppliers.length,
      searches,
      targetGap,
      averageTrust,
    };
  }, [watchlist, suppliers, activity]);

  const opportunities = useMemo(
    () =>
      watchlist
        .map((item) => {
          const firstPrice = item.history[0]?.price ?? item.currentPrice;
          const saving = Math.max(0, firstPrice - item.currentPrice);
          const gap = item.currentPrice - item.targetPrice;
          const reached = gap <= 0;
          const gapPercent = item.targetPrice > 0 ? Math.max(0, (gap / item.targetPrice) * 100) : 0;
          const supplier = suppliers.find((candidate) => candidate.id === item.supplierId);

          return { item, saving, gapPercent, reached, supplier };
        })
        .sort((a, b) => {
          if (a.reached !== b.reached) return a.reached ? -1 : 1;
          if (a.reached && b.reached) return b.saving - a.saving;
          return a.gapPercent - b.gapPercent;
        })
        .slice(0, 3),
    [watchlist, suppliers],
  );

  const riskySuppliers = suppliers.filter(
    (supplier) => !supplier.excluded && (supplier.verification !== 'verified' || supplier.riskFlags.length > 0),
  );
  const pendingAlerts = alerts.filter((alert) => alert.status === 'pending').length;
  const featured = watchlist.find((item) => item.id === featuredId) ?? watchlist[0];

  const actionItems = [
    stats.belowTarget > 0
      ? {
          title: `${stats.belowTarget} יעדי מחיר הושגו`,
          description: 'כדאי לבדוק עכשיו את ההצעות לפני שינוי מחיר או מלאי.',
          to: '/watchlist',
          label: 'בדיקת רכישה',
          tone: 'emerald' as const,
        }
      : null,
    riskySuppliers.length > 0
      ? {
          title: `${riskySuppliers.length} ספקים דורשים תשומת לב`,
          description: 'נמצאו ספקים לא מאומתים או עם דגלי סיכון פעילים.',
          to: '/suppliers',
          label: 'בדיקת ספקים',
          tone: 'amber' as const,
        }
      : null,
    pendingAlerts > 0
      ? {
          title: `${pendingAlerts} התראות ממתינות`,
          description: 'יש אירועים שטרם הושלמה שליחתם בערוצי ההתראה.',
          to: '/alerts',
          label: 'טיפול בהתראות',
          tone: 'rose' as const,
        }
      : null,
    stats.searches === 0
      ? {
          title: 'עדיין לא בוצע חיפוש חדש',
          description: 'התחילו מחיפוש מוצר כדי לקבל השוואה ודירוג Value.',
          to: '/search',
          label: 'חיפוש ראשון',
          tone: 'brand' as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    description: string;
    to: string;
    label: string;
    tone: 'brand' | 'emerald' | 'amber' | 'rose';
  }>;

  const actionToneClasses = {
    brand: 'border-brand-200 bg-brand-50/70 dark:border-brand-900/60 dark:bg-brand-950/20',
    emerald: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20',
    amber: 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20',
    rose: 'border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/20',
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="ValueTrack — מרכז החלטות"
        subtitle="לא רק מה השתנה במחיר — אלא מה כדאי לעשות עכשיו"
        actions={
          <Link to="/search" className="btn-primary">
            <Search className="h-4 w-4" /> חיפוש מוצר חדש
          </Link>
        }
      />

      <div className="card flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
            <Sparkles className="h-4 w-4" /> תמונת החלטה
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {stats.belowTarget > 0
              ? `יש ${stats.belowTarget} מוצרים במחיר היעד או מתחתיו. מומלץ להתחיל מהם.`
              : watchlist.length > 0
                ? `עדיין אין מוצר שהגיע ליעד. הפער המצטבר הוא ${formatCurrency(stats.targetGap)}.`
                : 'רשימת המעקב ריקה. חיפוש ראשון יאפשר ל-ValueTrack להתחיל למדוד הזדמנויות.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {alerts.length} התראות
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {stats.searches} חיפושים
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            אמינות ממוצעת {stats.averageTrust}/100
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="חיסכון מצטבר במעקב"
          value={formatCurrency(stats.totalSaving)}
          subtitle="ירידת מחיר מאז תחילת המעקב"
          icon={PiggyBank}
          accent="emerald"
          trend={{ value: stats.totalSaving > 0 ? 'נוצר חיסכון מדיד' : 'ממתין לירידת מחיר', positive: stats.totalSaving > 0 }}
        />
        <KpiCard
          title="יעדי מחיר שהושגו"
          value={`${stats.belowTarget}/${watchlist.length}`}
          subtitle={watchlist.length ? 'מוצרים במחיר היעד או מתחתיו' : 'אין מוצרים במעקב'}
          icon={Target}
          accent="brand"
        />
        <KpiCard
          title="ספקים מאומתים"
          value={String(stats.verified)}
          subtitle={`מתוך ${suppliers.length} במאגר · אמינות ${stats.averageTrust}/100`}
          icon={ShieldCheck}
          accent="amber"
        />
        <KpiCard
          title="פער מצטבר ליעד"
          value={formatCurrency(stats.targetGap)}
          subtitle={`${Math.max(0, watchlist.length - stats.belowTarget)} מוצרים עדיין מעל היעד`}
          icon={CircleDollarSign}
          accent="rose"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="card min-w-0 p-5 xl:col-span-2">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold">מגמת מחיר</h2>
              {featured && (
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {featured.productName} · נוכחי {formatCurrency(featured.currentPrice)} · יעד {formatCurrency(featured.targetPrice)}
                </p>
              )}
            </div>
            {watchlist.length > 1 && (
              <label className="text-xs text-slate-500 dark:text-slate-400">
                מוצר להצגה
                <select
                  value={featured?.id ?? ''}
                  onChange={(event) => setFeaturedId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:w-56"
                >
                  {watchlist.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.productName}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {featured ? (
            <PriceHistoryChart history={featured.history} targetPrice={featured.targetPrice} height={280} />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">
              הוסיפו מוצר למעקב כדי לראות מגמת מחירים
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <Link to="/watchlist" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
              לכל המעקבים
            </Link>
          </div>
        </div>

        <div className="card min-w-0 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">הזדמנויות לרכישה</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">מדורג לפי יעד מחיר וחיסכון בפועל</p>
            </div>
            <ArrowDownRight className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="space-y-3">
            {opportunities.map(({ item, saving, gapPercent, reached, supplier }) => (
              <div key={item.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.productName}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {supplier?.name ?? 'ספק לא ידוע'} · {formatCurrency(item.currentPrice)}
                    </p>
                  </div>
                  <Badge tone={reached ? 'emerald' : 'slate'}>
                    {reached ? 'קנייה אפשרית ✓' : `${gapPercent.toFixed(1)}% ליעד`}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">יעד: {formatCurrency(item.targetPrice)}</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    חיסכון {formatCurrency(saving)}
                  </span>
                </div>
              </div>
            ))}
            {opportunities.length === 0 && <p className="py-8 text-center text-sm text-slate-400">אין הזדמנויות להצגה</p>}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">מרכז פעולה</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">הצעדים בעלי העדיפות הגבוהה ביותר כרגע</p>
          </div>
          <Bell className="h-5 w-5 text-brand-500" />
        </div>
        {actionItems.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {actionItems.slice(0, 3).map((action) => (
              <div key={action.title} className={`rounded-xl border p-4 ${actionToneClasses[action.tone]}`}>
                <h3 className="text-sm font-semibold">{action.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">{action.description}</p>
                <Link to={action.to} className="mt-3 inline-flex text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
                  {action.label} ←
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
            אין כרגע חריגות לטיפול. אפשר להמשיך במעקב או לבצע חיפוש חדש.
          </div>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="card min-w-0 p-5 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">רשימת מעקב</h2>
            <Link to="/watchlist" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
              ניהול מעקבים
            </Link>
          </div>

          <div className="space-y-3 md:hidden">
            {watchlist.slice(0, 5).map((item) => {
              const reached = item.currentPrice <= item.targetPrice;
              return (
                <div key={item.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.productName}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatCurrency(item.currentPrice)} · יעד {formatCurrency(item.targetPrice)}
                      </p>
                    </div>
                    <Badge tone={reached ? 'emerald' : 'slate'}>{reached ? 'הושג ✓' : 'ממתין'}</Badge>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
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
                  const reached = item.currentPrice <= item.targetPrice;
                  return (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                      <td className="py-2.5 pl-4 font-medium">{item.productName}</td>
                      <td className="py-2.5 pl-4">{formatCurrency(item.currentPrice)}</td>
                      <td className="py-2.5 pl-4">{formatCurrency(item.targetPrice)}</td>
                      <td className="py-2.5">
                        <Badge tone={reached ? 'emerald' : 'slate'}>{reached ? 'מתחת ליעד ✓' : 'מעל היעד'}</Badge>
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

          {watchlist.length === 0 && (
            <div className="py-8 text-center md:hidden">
              <Eye className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-2 text-sm text-slate-400">אין מוצרים במעקב — הוסיפו מתוך תוצאות חיפוש</p>
            </div>
          )}
        </div>

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
            {activity.length === 0 && <li className="py-6 text-center text-sm text-slate-400">אין פעילות עדיין</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
