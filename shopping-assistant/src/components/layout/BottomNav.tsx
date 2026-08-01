import { NavLink } from 'react-router-dom';
import { Bell, Eye, Home, MoreHorizontal, Search } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

/**
 * Phone-only quick navigation.
 *
 * Deliberately four destinations plus "more": cramming all seven routes in
 * would shrink every target below the 44px minimum and turn the bar into a
 * second, competing navigation. "More" reuses the existing sidebar rather than
 * introducing a third menu system.
 *
 * Visibility and height come from `--bottom-nav-h` / `.bottom-nav` in
 * index.css, so the content padding and this bar can never disagree.
 */

const ITEMS = [
  { to: '/', label: 'בית', icon: Home, end: true },
  { to: '/search', label: 'חיפוש', icon: Search, end: false },
  { to: '/watchlist', label: 'מעקב', icon: Eye, end: false },
  { to: '/alerts', label: 'התראות', icon: Bell, end: false },
] as const;

interface Props {
  onOpenMore: () => void;
  moreRef?: React.Ref<HTMLButtonElement>;
}

export default function BottomNav({ onOpenMore, moreRef }: Props) {
  const alertCount = useAppStore((s) => s.alerts.length);

  return (
    <nav
      aria-label="ניווט מהיר"
      className="bottom-nav safe-pb fixed inset-x-0 bottom-0 z-30 items-stretch border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
    >
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          // aria-current is set by NavLink itself; the class callback only styles.
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition ${
              isActive
                ? 'text-brand-600 dark:text-brand-300'
                : 'text-slate-500 dark:text-slate-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {/* A filled pill behind the icon marks the active tab without
                  relying on colour alone. */}
              <span
                className={`relative flex h-7 w-12 items-center justify-center rounded-full transition ${
                  isActive ? 'bg-brand-100 dark:bg-brand-900/50' : ''
                }`}
              >
                <Icon className="h-5 w-5" />
                {to === '/alerts' && alertCount > 0 && (
                  <span className="absolute -top-0.5 left-1.5 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
                    {alertCount}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}

      <button
        ref={moreRef}
        type="button"
        onClick={onOpenMore}
        aria-label="עוד — פתיחת תפריט מלא"
        aria-haspopup="menu"
        className="flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-slate-500 transition dark:text-slate-400"
      >
        <span className="flex h-7 w-12 items-center justify-center rounded-full">
          <MoreHorizontal className="h-5 w-5" />
        </span>
        <span>עוד</span>
      </button>
    </nav>
  );
}
