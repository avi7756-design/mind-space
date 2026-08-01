# TASK-007 — Isolated Shopping PWA · צילומים

צולם ב‑Chromium 141 דרך Playwright מהגרסה הבנויה, locale `he-IL`.
בסיס: `d733e9d`.

| # | קובץ | מה מוצג |
|---|---|---|
| 01 | `01-settings-install-available.png` | כרטיס ההתקנה בהגדרות אחרי ש‑`beforeinstallprompt` נורה. **הכפתור אינו קיים לפניו** — אין pop‑up ואין הבטחה ריקה |
| 02 | `02-settings-installed.png` | אחרי `appinstalled`: הכפתור נעלם ומוצג "האפליקציה מותקנת ופועלת ממסך הבית" |
| 03 | `03-settings-ios-instructions.png` | UA של iPhone: שלושה שלבים ממוספרים דרך Safari, עם אייקון השיתוף בשורה |
| 04 | `04-dashboard-standalone.png` | הדמיית `display-mode: standalone` — כך תיראה האפליקציה ממסך הבית |
| 05 | `05-dark-theme-color.png` | מצב כהה. `theme-color` נמדד בפועל: `#020617` |
| 06 | `06-offline-shell.png` | רענון במצב offline. כותרת הדף שנמדדה: **"עוזר הקניות החכם"** — לא mind‑space |
| 07 | `07-sw-registration-scope.png` | פלט `getRegistrations()` ו‑`caches.keys()` מתוך הדפדפן |

---

## מה הצילומים מוכיחים

* כפתור ההתקנה מופיע **רק** אחרי הצעה אמיתית מהדפדפן, ונעלם לאחר התקנה.
* iOS מקבל הוראות ולא כפתור — שם `beforeinstallprompt` לעולם אינו נורה.
* `theme-color` נגזר מה‑theme השמור, לא מהעדפת מערכת ההפעלה.
* רענון offline מחזיר את המעטפת של Shopping.
* המטמון היחיד שנוצר הוא `shopping-assistant-v1`.

## מה הצילומים **אינם** מוכיחים

צילום 07 צולם מול שרת התצוגה בבסיס `/`, ולכן ה‑scope שמופיע בו הוא של השורש.

**האימות תחת נתיב הפריסה האמיתי הוא `npm run test:pwa`** — הוא מגיש את הבנייה
מ‑`/mind-space/shopping/` ומאמת 15 בדיקות, בהן:

```text
✓ a registration exists with the Shopping scope
    http://localhost:4180/mind-space/shopping/
✓ its script lives under the Shopping path
    http://localhost:4180/mind-space/shopping/sw.js
✓ no registration claims the parent /mind-space/ scope
✓ the page is controlled by the Shopping worker
✓ every cache created carries the Shopping prefix — shopping-assistant-v1
✓ offline reload serves the Shopping shell
✓ offline reload does NOT serve the mind-space shell
```

**זו עדיין סימולציה מקומית ולא GitHub Pages.** ראו `PWA_AUDIT.md` §5 לרשימת
מה שנותר לאמת בפריסה אמיתית.

## טעון אימות ב‑iPhone אמיתי

הוספה למסך הבית ב‑Safari · צבע שורת הסטטוס במצב standalone · התנהגות
`black-translucent` מול ה‑Dynamic Island · שמירת המטמון לאורך זמן.
