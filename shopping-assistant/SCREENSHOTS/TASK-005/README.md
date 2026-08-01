# TASK-005 — Mobile Layout Foundation · צילומי לפני ואחרי

צולם ב‑Chromium 141 דרך Playwright, מהגרסה הבנויה (`npm run build` → `vite preview`),
locale `he-IL`, `fullPage` (למעט צילום הסרגל הנשלף).

**BEFORE** = commit `f7f3b88` (בסיס האינטגרציה) · **AFTER** = מצב סוף TASK-005.

| # | קובץ | מסך | Viewport | מה השתנה |
|---|---|---|---|---|
| 01 | `01-dashboard-portrait-{BEFORE,AFTER}.png` | דשבורד | 390×844 | ריפוד עליון בסרגל נגזר מ‑`--safe-top`; גובה המעטפת עבר ל‑`100dvh` |
| 02 | `02-dashboard-landscape-{BEFORE,AFTER}.png` | דשבורד | 844×390 | אין חיתוך אנכי; הכותרת נגישה; אין גלילה אופקית |
| 03 | `03-search-portrait-{BEFORE,AFTER}.png` | חיפוש | 390×844 | שדה החיפוש עבר ל‑16px (מונע זום אוטומטי ב‑iOS) |
| 04 | `04-settings-portrait-{BEFORE,AFTER}.png` | הגדרות | 390×844 | כל שדות הקלט והבחירה ב‑16px |
| 05 | `05-watchlist-portrait-dark-{BEFORE,AFTER}.png` | מעקב · מצב כהה | 390×844 | רקע `html` כהה — האזור מאחורי ה‑Safe Area לא מציג פס לבן |
| 06 | `06-sidebar-open-portrait-{BEFORE,AFTER}.png` | סרגל נשלף | 390×844 | הסרגל מרפד לפי `--safe-top` ו‑`--safe-bottom` |

---

## מה הצילומים כן מוכיחים

* אין גלישה אופקית באף מסך, בשתי האוריינטציות — נמדד ומודפס בכל צילום
  (`documentElement` ו‑`body`: `scrollWidth === clientWidth`).
* Landscape 844×390 אינו חותך תוכן ואינו מסתיר את הכותרת.
* גודל הטקסט בשדות במובייל הוא 16px, ובדסקטופ נשאר 14px.
* מצב כהה עקבי עד קצה המסך.

## מה הצילומים אינם יכולים להוכיח

**Chromium מדווח `0px` על כל `env(safe-area-inset-*)`.** אין notch בסימולציה, ולכן
בצילומים לא ייראה הפרש ויזואלי בריפוד ה‑Safe Area בין BEFORE ל‑AFTER.

מה שכן אומת אוטומטית הוא **החיווט**: `e2e/safe-area.spec.ts` דורס את משתני ה‑CSS
בערכי בדיקה (59/21/34/21) ומודד שהריפוד בפועל זז בהתאם. אילו כלל היה חסר, או אילו
utility של Tailwind היה גובר עליו — הבדיקה הייתה נופלת.

**טעון אימות ב‑iPhone אמיתי:** Dynamic Island בפועל, שינוי גובה ה‑viewport בזמן
תנועת סרגל הכתובת ב‑Safari, זום פוקוס של WebKit, והתנהגות Landscape ב‑Safari.

---

## שחזור

```bash
npm ci
npm run build
npm run preview -- --port 4173 --strictPort &
node <script>   # ראו הדוח של TASK-005
```

הבדיקות האוטומטיות המקבילות: `npm run test:e2e`
