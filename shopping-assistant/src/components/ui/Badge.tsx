import type { ReactNode } from 'react';

type Tone = 'slate' | 'brand' | 'emerald' | 'amber' | 'rose';

const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

export default function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
