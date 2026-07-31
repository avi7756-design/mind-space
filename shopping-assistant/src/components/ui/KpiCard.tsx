import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  accent?: 'brand' | 'emerald' | 'amber' | 'rose';
}

const ACCENTS = {
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

export default function KpiCard({ title, value, subtitle, icon: Icon, trend, accent = 'brand' }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-sm text-slate-500 dark:text-slate-400">{title}</div>
          <div className="mt-1 truncate text-2xl font-bold">{value}</div>
          {subtitle && <div className="mt-1 text-xs text-slate-400">{subtitle}</div>}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ACCENTS[accent]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {trend && (
        <div
          className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${
            trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {trend.positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {trend.value}
        </div>
      )}
    </div>
  );
}
