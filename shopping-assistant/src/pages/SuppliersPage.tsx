import { useMemo, useState } from 'react';
import { Ban, RefreshCw, ShieldCheck, Star, Store, Undo2 } from 'lucide-react';
import SectionHeader from '../components/ui/SectionHeader';
import Badge from '../components/ui/Badge';
import TrustBadge, { trustTone } from '../components/ui/TrustBadge';
import EmptyState from '../components/ui/EmptyState';
import { useAppStore } from '../store/useAppStore';
import { formatNumber } from '../services/format';
import type { RiskFlag, VerificationStatus } from '../types';

const RISK_LABEL: Record<RiskFlag, string> = {
  new_seller: 'מוכר חדש',
  price_anomaly: 'מחיר חריג',
  negative_reviews: 'ביקורות שליליות',
  slow_shipping: 'משלוחים איטיים',
  payment_disputes: 'מחלוקות תשלום',
  counterfeit_reports: 'דיווחי זיופים',
};

const VERIFICATION_LABEL: Record<VerificationStatus, { text: string; tone: 'emerald' | 'amber' | 'rose' }> = {
  verified: { text: 'מאומת', tone: 'emerald' },
  pending: { text: 'בבדיקה', tone: 'amber' },
  unverified: { text: 'לא מאומת', tone: 'rose' },
};

type ViewFilter = 'all' | 'active' | 'excluded';

export default function SuppliersPage() {
  const suppliers = useAppStore((s) => s.suppliers);
  const setSupplierExcluded = useAppStore((s) => s.setSupplierExcluded);
  const simulateTrustUpdate = useAppStore((s) => s.simulateTrustUpdate);
  const [view, setView] = useState<ViewFilter>('all');

  const filtered = useMemo(() => {
    const sorted = [...suppliers].sort((a, b) => b.trustScore - a.trustScore);
    if (view === 'active') return sorted.filter((s) => !s.excluded);
    if (view === 'excluded') return sorted.filter((s) => s.excluded);
    return sorted;
  }, [suppliers, view]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="ספקים מהימנים"
        subtitle="מאגר הספקים עם סטטוס אימות, ציוני אמינות, דגלי סיכון וכללי החרגה"
        actions={
          <button className="btn-ghost" onClick={simulateTrustUpdate} title="הדמיית רענון ציוני אמינות (דמו)">
            <RefreshCw className="h-4 w-4" /> רענון ציוני אמינות
          </button>
        }
      />

      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-100">
        <ShieldCheck className="ml-1.5 inline h-4 w-4" />
        כלל החרגה פעיל: ספקים לא מאומתים עם ציון אמינות מתחת ל‑40 או דיווחי הונאה נחסמים אוטומטית ואינם מופיעים
        בתוצאות ההשוואה.
      </div>

      <div className="flex gap-2">
        {(
          [
            { value: 'all', label: `הכול (${suppliers.length})` },
            { value: 'active', label: `פעילים (${suppliers.filter((s) => !s.excluded).length})` },
            { value: 'excluded', label: `מוחרגים (${suppliers.filter((s) => s.excluded).length})` },
          ] as Array<{ value: ViewFilter; label: string }>
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setView(value)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              view === value
                ? 'bg-brand-600 text-white'
                : 'border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Store} title="אין ספקים בתצוגה" description="שנו את הסינון כדי לראות ספקים." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((supplier) => {
            const verification = VERIFICATION_LABEL[supplier.verification];
            const tone = trustTone(supplier.trustScore);
            return (
              <div
                key={supplier.id}
                className={`card flex flex-col p-5 ${supplier.excluded ? 'opacity-75 ring-1 ring-rose-300 dark:ring-rose-800' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{supplier.name}</h3>
                    <div className="text-xs text-slate-400">{supplier.domain} · {supplier.country}</div>
                  </div>
                  <Badge tone={verification.tone}>{verification.text}</Badge>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                      tone === 'emerald'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : tone === 'amber'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                    }`}
                  >
                    {supplier.trustScore}
                  </div>
                  <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {supplier.rating} · {formatNumber(supplier.reviewCount)} ביקורות
                    </div>
                    <div>{supplier.yearsActive} שנות פעילות</div>
                    <TrustBadge supplier={supplier} />
                  </div>
                </div>

                {supplier.riskFlags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {supplier.riskFlags.map((flag) => (
                      <Badge key={flag} tone="rose">
                        {RISK_LABEL[flag]}
                      </Badge>
                    ))}
                  </div>
                )}

                {supplier.excluded && supplier.exclusionReason && (
                  <p className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                    {supplier.exclusionReason}
                  </p>
                )}

                <div className="mt-auto pt-4">
                  {supplier.excluded ? (
                    <button
                      className="btn-ghost w-full"
                      onClick={() => setSupplierExcluded(supplier.id, false)}
                    >
                      <Undo2 className="h-4 w-4" /> ביטול החרגה
                    </button>
                  ) : (
                    <button
                      className="btn-ghost w-full !text-rose-600 dark:!text-rose-400"
                      onClick={() => setSupplierExcluded(supplier.id, true, 'הוחרג ידנית על ידי המשתמש')}
                    >
                      <Ban className="h-4 w-4" /> החרגה מהתוצאות
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
