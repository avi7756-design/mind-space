import { NavLink } from 'react-router-dom';
import {
  Activity,
  Bell,
  Eye,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const NAV_ITEMS = [
  { to: '/', label: 'דשבורד', icon: LayoutDashboard },
  { to: '/search', label: 'חיפוש והשוואה', icon: Search },
  { to: '/suppliers', label: 'ספקים מהימנים', icon: ShieldCheck },
  { to: '/watchlist', label: 'מעקב מחירים', icon: Eye },
  { to: '/alerts', label: 'התראות', icon: Bell },
  { to: '/activity', label: 'יומן פעילות', icon: Activity },
  { to: '/settings', label: 'הגדרות', icon: Settings },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  const alertCount = useAppStore((s) => s.alerts.length);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-72 flex-col border-l border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div>
              <div className="text-base font-bold">עוזר הקניות החכם</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">מחקר שוק והשוואת ספקים</div>
            </div>
          </div>
          <button className="lg:hidden" onClick={onClose} aria-label="סגירת תפריט">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span className="flex-1">{label}</span>
              {to === '/alerts' && alertCount > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                  {alertCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4 text-xs text-slate-400 dark:border-slate-800">
          גרסת דמו — נתוני שוק מדומים · v1.0
        </div>
      </aside>
    </>
  );
}
