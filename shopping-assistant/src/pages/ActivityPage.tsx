import { useMemo, useState } from 'react';
import { Activity as ActivityIcon } from 'lucide-react';
import SectionHeader from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime } from '../services/format';
import type { ActivityType } from '../types';

export const ACTIVITY_META: Record<ActivityType, { label: string; dot: string }> = {
  search: { label: 'חיפוש', dot: 'bg-brand-500' },
  compare: { label: 'השוואה', dot: 'bg-violet-500' },
  track: { label: 'מעקב', dot: 'bg-emerald-500' },
  alert: { label: 'התראה', dot: 'bg-rose-500' },
  supplier_update: { label: 'עדכון ספק', dot: 'bg-amber-500' },
  settings: { label: 'הגדרות', dot: 'bg-slate-400' },
};

const FILTERS: Array<{ value: ActivityType | 'all'; label: string }> = [
  { value: 'all', label: 'הכול' },
  { value: 'search', label: 'חיפושים' },
  { value: 'compare', label: 'השוואות' },
  { value: 'track', label: 'מעקבים' },
  { value: 'alert', label: 'התראות' },
  { value: 'supplier_update', label: 'עדכוני ספקים' },
  { value: 'settings', label: 'הגדרות' },
];

export default function ActivityPage() {
  const activity = useAppStore((s) => s.activity);
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? activity : activity.filter((a) => a.type === filter)),
    [activity, filter],
  );

  return (
    <div className="space-y-5">
      <SectionHeader
        title="יומן פעילות"
        subtitle="תיעוד מלא של כל חיפוש, השוואה, מעקב, התראה ועדכון סטטוס ספק"
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              filter === value
                ? 'bg-brand-600 text-white'
                : 'border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="אין רשומות ביומן"
          description="פעולות שתבצעו — חיפושים, השוואות, מעקבים והתראות — יתועדו כאן אוטומטית."
        />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.map((entry) => {
            const meta = ACTIVITY_META[entry.type];
            return (
              <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-200">{entry.message}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                    <span>{meta.label}</span>
                    <span>·</span>
                    <span>{formatDateTime(entry.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
