interface Props {
  label: string;
  value: number; // 0–100
}

export default function ScoreBar({ label, value }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-slate-500 dark:text-slate-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-8 shrink-0 text-left font-medium">{Math.round(clamped)}</span>
    </div>
  );
}
