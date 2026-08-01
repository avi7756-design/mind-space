import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Moon, Search, Sun } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface Props {
  onOpenSidebar: () => void;
}

export default function Topbar({ onOpenSidebar }: Props) {
  const navigate = useNavigate();
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const [query, setQuery] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setQuery('');
  }

  return (
    <header className="topbar-safe sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 pb-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:px-6">
      <button className="lg:hidden" onClick={onOpenSidebar} aria-label="פתיחת תפריט">
        <Menu className="h-5 w-5" />
      </button>

      <form onSubmit={submit} className="relative flex-1 max-w-2xl">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חפשו כל מוצר — לדוגמה: אוזניות Sony, מכונת קפה, אייפון 15…"
          className="input pr-9"
          aria-label="חיפוש מוצר"
        />
      </form>

      <button
        onClick={toggleTheme}
        className="btn-ghost !px-2.5"
        aria-label={theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
        title={theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </header>
  );
}
