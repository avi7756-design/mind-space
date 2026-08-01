# TASK-006 — Mobile Interaction and Bottom Navigation · צילומים

צולם ב‑Chromium 141 דרך Playwright מהגרסה הבנויה, locale `he-IL`.
מצב סוף TASK-006 (בסיס: `b1c6b8b`).

| # | קובץ | מה מוצג |
|---|---|---|
| 01 | `01-dashboard-bottomnav-light.png` | דשבורד 390×844 עם הניווט התחתון. "בית" פעיל — גלולה מלאה מאחורי האייקון, לא רק צבע |
| 02 | `02-dashboard-bottomnav-dark.png` | אותו מסך במצב כהה — הניווט והרקע מאחורי ה‑Safe Area כהים |
| 03 | `03-search-field-focused.png` | שדה חיפוש בפוקוס: `type=search`, 16px, `enterKeyHint=search` |
| 04 | `04-watchlist-enlarged-actions.png` | כרטיסי מעקב — כפתור המחיקה ועריכת היעד הוגדלו ל‑44×44 |
| 05 | `05-sidebar-via-more.png` | "עוד" פותח את הסרגל הקיים עם שבעת היעדים המלאים |
| 06 | `06-landscape-bottomnav.png` | 844×390 — הניווט נשאר קומפקטי (3.25rem) ואינו חונק את התוכן |
| 07 | `07-settings-updated-fields.png` | הגדרות — כל השדות עם `inputMode`/`autoComplete` מתאימים |
| 08 | `08-activity-bottom-clearance.png` | גלילה לתחתית יומן הפעילות — הפריט האחרון מסתיים מעל הניווט |

---

## סדר ה‑RTL בניווט

מימין לשמאל: **בית · חיפוש · מעקב · התראות · עוד**

הסדר זהה ב‑DOM, בסדר הטאב ובסדר החזותי — לא נשען על היפוך מקרי של Flex.
מאומת ב‑`e2e/bottom-nav.spec.ts` שמודד את מיקום ה‑`left` של כל פריט.

## למה חמישה ולא שבעה

דחיסת שבעת היעדים לרוחב 390px הייתה מקטינה כל יעד מתחת ל‑44px ויוצרת מערכת
ניווט שנייה שמתחרה בסרגל. "עוד" פותח את הסרגל הקיים — ספקים, פעילות והגדרות
נשארים שם.

## מה אומת אוטומטית

66 בדיקות Playwright: יעדי מגע ≥44×44 בשבעת המסכים, ניווט ומצב פעיל,
`aria-current`, היעדר גלישה אופקית, מרווח תחתון, סדר RTL, שכבות z‑index,
מאפייני מקלדת, ו‑Enter שמפעיל חיפוש פעם אחת ללא reload.

## מה טעון אימות ב‑iPhone אמיתי

הופעת המקלדת והסתרתה, שינוי גובה ה‑viewport בזמן תנועת סרגל Safari,
זום פוקוס של WebKit, אזור ה‑Home Indicator בפועל, והחזרת פוקוס עם VoiceOver.

**Chromium מדווח `0px` על כל `env(safe-area-inset-*)`.** לא נבדק Safari אמיתי.
