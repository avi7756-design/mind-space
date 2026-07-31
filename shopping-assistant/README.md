# עוזר הקניות החכם · Smart Shopping Assistant

אפליקציית עוזר קניות חכם בעברית (RTL): חיפוש מוצרים בשפה חופשית, מחקר שוק בין ספקים
מהימנים בלבד, חישוב עלות כוללת (מחיר + משלוח + מסים), דירוג לפי תמורה / מחיר / אמינות,
מעקב מחירים עם היסטוריה ויעדים, מנוע התראות ויומן פעילות מלא — בדשבורד ניהולי מלוטש
עם מצב כהה ותצוגה רספונסיבית.

> הגרסה הנוכחית רצה על **נתוני דמו מובנים** (mock). כל שכבת הנתונים עוברת דרך ממשק
> אחד (`SupplierDataProvider`) כך שחיבור Backend / סקרייפר / API אמיתי בעתיד אינו דורש
> שינויים ב‑UI.

## Features

| Module | Where |
| --- | --- |
| חיפוש בשפה טבעית + סרגל חיפוש עליון | `src/pages/SearchPage.tsx`, `Topbar` |
| שכבת איסוף ספקים (מחיר, משלוח, מס, אספקה, אחריות, החזרות, מלאי, קישור, אמינות) | `src/data/seed.ts`, `src/services/api.ts` |
| מנוע דירוג עם משקולות ניתנות להגדרה (עלות 40%, אמינות 25%, משלוח 15%, אחריות 10%, החזרות 10%) | `src/services/scoring.ts` |
| פאנל ספקים מהימנים: אימות, דגלי סיכון, כללי החרגה | `src/pages/SuppliersPage.tsx` |
| מעקב מחירים: ציר זמן היסטורי + מחיר יעד | `src/pages/WatchlistPage.tsx` |
| מנוע התראות: אימייל / טלגרם / Webhook | `src/services/alerts.ts`, `src/pages/AlertsPage.tsx` |
| יומן פעילות (חיפוש, השוואה, מעקב, התראה, עדכון ספק) | `src/pages/ActivityPage.tsx`, store |
| דשבורד ניהולי: KPI, גרף מגמה, טבלת השוואה, מעקב, התראות, פעילות | `src/pages/DashboardPage.tsx` |
| ייצוא CSV (פעיל) + PDF (placeholder) | `src/services/export.ts` |
| הגדרות משקולות + ערוצי התראות | `src/pages/SettingsPage.tsx` |
| מצב כהה, RTL מלא, רספונסיבי | Tailwind (`darkMode: 'class'`) |

## Tech stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** (RTL, dark mode)
- **Zustand** — state עם persistence ל‑localStorage (מעקבים, התראות, יומן, הגדרות)
- **Recharts** — גרפי מחיר ומגמות
- **React Router (HashRouter)** — עובד על כל אחסון סטטי ללא הגדרות שרת

## Getting started

```bash
cd shopping-assistant
npm install
npm run dev        # http://localhost:5173
```

Production build:

```bash
npm run build      # output in dist/
npm run preview    # local preview of the build
```

## Deployment

### Netlify

1. Import the repository in Netlify.
2. Set **Base directory** to `shopping-assistant`.
3. Build command `npm run build`, publish directory `dist` (already configured in `netlify.toml`).

### Vercel

1. Import the repository in Vercel.
2. Set **Root Directory** to `shopping-assistant` (framework preset: Vite).
3. `vercel.json` already configures the build output and SPA rewrites.

הבנייה משתמשת ב‑`base: './'`, כך שהאפליקציה עובדת גם מתת‑נתיב (למשל GitHub Pages).

## Environment variables

Copy `.env.example` to `.env`. All keys are **placeholders for future integrations** —
the app currently runs fully on mock data without any of them:

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Future supplier-aggregation backend |
| `VITE_MARKET_DATA_API_KEY` | Future price/market-data provider |
| `VITE_TELEGRAM_BOT_TOKEN` | Telegram alert delivery |
| `VITE_EMAIL_SERVICE_API_KEY` | Email alert delivery |
| `VITE_DEFAULT_WEBHOOK_URL` | Default outgoing webhook |

## Architecture & future integration

```
src/
├── types/        # Domain contracts shared with the future backend
├── data/         # Seed/mock data + deterministic offer generator
├── services/
│   ├── api.ts       # SupplierDataProvider interface + mock implementation ← swap here
│   ├── scoring.ts   # Weighted scoring & ranking engine
│   ├── alerts.ts    # Alert evaluation engine (price/trust rules)
│   ├── export.ts    # CSV export + PDF placeholder
│   └── format.ts    # he-IL formatting helpers
├── store/        # Zustand store (persisted app state + activity journal)
├── components/   # layout / ui / charts / compare
└── pages/        # Dashboard, Search, Suppliers, Watchlist, Alerts, Activity, Settings
```

To connect a real backend: implement `SupplierDataProvider` (see `src/services/api.ts`)
against your API, return it from `getSupplierDataProvider()` when `VITE_API_BASE_URL`
is set — no UI changes required. Alert dispatch (email/Telegram/webhook) is designed to
move server-side; the client only manages channel preferences.

## Demo controls

- **"בדיקת מחירים עכשיו"** (מעקב מחירים) — מדמה סבב polling: מעדכן מחירים, מפעיל את
  מנוע ההתראות ורושם ביומן.
- **"רענון ציוני אמינות"** (ספקים) — מדמה עדכון ציון אמינות ספק + התראת שינוי אמינות.
- **"איפוס נתוני דמו"** (הגדרות) — מחזיר את כל הנתונים למצב ההדגמה המקורי.
