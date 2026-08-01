# PWA_AUDIT.md — בדיקת ה‑Service Worker הקיים לפני הוספת PWA ל‑Shopping

> נערך במסגרת **TASK-007**, לפני כתיבת שורת קוד אחת של PWA.
> מקור: ענף `main`, קבצים `sw.js`, `index.html`, `manifest.webmanifest`, `shopping/index.html`.
> **כל הממצאים נקראו מהקוד. אין כאן השערה.**

---

## 1. מבנה הפריסה

הריפו מתפרסם כ‑**GitHub Pages Project Site**, ולכן שורש המאגר מוגש תחת תת‑נתיב:

| קובץ במאגר | כתובת בפועל |
|---|---|
| `sw.js` | `https://avi7756-design.github.io/mind-space/sw.js` |
| `index.html` | `https://avi7756-design.github.io/mind-space/` |
| `shopping/index.html` | `https://avi7756-design.github.io/mind-space/shopping/` |

**ה‑SW הקיים אינו בשורש הדומיין.** ה‑scope המרבי הטבעי שלו הוא `/mind-space/`,
לא `/`.

---

## 2. עשרת הממצאים

### 2.1 היכן נרשם ה‑SW הראשי

`index.html` בשורש המאגר, השורה האחרונה לפני `</body>`:

```js
if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
```

### 2.2 כתובת הסקריפט

`./sw.js` יחסית ל‑`/mind-space/index.html` ⟵ **`/mind-space/sw.js`**

### 2.3 האם מוגדר `scope` מפורש

❌ **לא.** אין פרמטר שני ל‑`register()`.

### 2.4 ה‑scope האפקטיבי הצפוי

ללא `scope` מפורש, ברירת המחדל היא ספריית הסקריפט ⟵ **`/mind-space/`**.

**המשמעות:** ה‑SW הראשי הוא ה‑scope האב של `/mind-space/shopping/`.
רישום SW ספציפי יותר תחת `/mind-space/shopping/` מותר, וה‑SW הספציפי הוא
שישלוט בעמודי Shopping **לאחר** שיקבל שליטה.

### 2.5 אילו URLs נכנסים למטמון

**Precache באירוע install:**

```js
["./", "./index.html", "./manifest.webmanifest",
 "./icon-180.png", "./icon-192.png", "./icon-512.png"]
```

כולם יחסיים ל‑`/mind-space/` — אף אחד מהם אינו של Shopping.

**Runtime:** כל בקשת GET בתוך ה‑scope נכנסת למטמון, כולל נכסי Shopping.

### 2.6 fallback ה‑HTML

```js
.catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
```

`"./index.html"` נפתר יחסית למיקום ה‑SW ⟵ **`/mind-space/index.html`**.

⚠️ ניווט offline אל `/mind-space/shopping/` שמטופל על ידי ה‑SW הראשי יקבל את
ה‑HTML של **mind‑space**, לא של Shopping.

### 2.7 האם מאזין לכל `fetch`

✅ **כן.** `self.addEventListener("fetch", ...)` ללא סינון כלשהו.

### 2.8 האם מסנן לפי pathname

❌ **לא.** אין בדיקת `pathname`, אין בדיקת `method`, אין בדיקת origin.
כל בקשה בתוך ה‑scope מטופלת — כולל בקשות ל‑`/mind-space/shopping/*`.

### 2.9 שמות ה‑caches

מטמון יחיד: **`mindspace-v12`** (הקבוע `C`).
המספר עולה בכל גרסה — הוא הופיע כ‑`SW v8` … `SW v12` בהיסטוריית ה‑commits.

### 2.10 לוגיקת מחיקת cache ישן ב‑activate

```js
caches.keys().then(k =>
  Promise.all(k.filter(x => x !== C).map(x => caches.delete(x))))
```

🔴 **זהו הממצא החמור ביותר בבדיקה.** ✅ **תוקן ב‑TASK-008 — ראו §6.**

התנאי הוא `x !== "mindspace-v12"` — **לא** prefix של mind‑space.
כלומר ה‑SW הראשי מוחק **כל מטמון בדומיין** שאינו שלו.

`CacheStorage` משויך ל‑**origin**, לא ל‑scope של SW. לכן ה‑SW הראשי יכול
למחוק — ובפועל ימחק — גם את המטמון של Shopping, על אף שאינו שולט בעמודיה.

בשילוב עם `skipWaiting()` באירוע install, המחיקה מתרחשת **בכל פריסה של
mind‑space שמעלה את מספר הגרסה**.

---

## 3. מסקנה

> **רישום Service Worker ייעודי ל‑Shopping עם scope `/mind-space/shopping/` הוא
> הצעד הנכון, והוא פותר את הניווט ואת הנכסים. הוא אינו פותר — ואינו יכול לפתור
> ללא שינוי ב‑`sw.js` הראשי — את מחיקת המטמון.**

### מה ה‑SW הייעודי כן פותר

| בעיה | נפתר? | איך |
|---|---|---|
| ניווט offline מחזיר את mind‑space | ✅ | ה‑SW הספציפי שולט בעמודי Shopping ומחזיר fallback משלו |
| נכסי Shopping מטופלים על ידי SW זר | ✅ | ה‑SW הספציפי מיירט אותם ראשון |
| ערבוב מטמונים | ✅ | prefix ייעודי `shopping-assistant-` |

### מה נשאר פתוח

| בעיה | סטטוס | הסבר |
|---|---|---|
| **ה‑SW הראשי מוחק את המטמון שלנו** | ✅ **נסגר ב‑TASK-008** | ראו §6 |

> **הפסקאות הבאות תיארו את המצב בזמן TASK-007 ונשמרות כתיעוד היסטורי.
> הממצא נסגר ב‑TASK-008 — ראו §6.**

**חומרת ההשפעה שהייתה:** בינונית ולא קריטית.
בכל פריסה של mind‑space, המטמון של Shopping היה נמחק. התוצאה: הביקור המקוון
הבא נטען כרגיל ומאכלס את המטמון מחדש. הפגיעה הוגבלה לחלון שבין המחיקה
לביקור המקוון הבא — בו האפליקציה לא נפתחה offline.

**התיקון שהומלץ אז, ובוצע ב‑TASK-008:**
שינוי ב‑`sw.js` הראשי, מהשוואת שוויון לבדיקת prefix:

```js
// לפני
k.filter(x => x !== C)
// אחרי
k.filter(x => x.startsWith("mindspace-") && x !== C)
```

שינוי בטוח: הוא מצמצם את מה שה‑SW הראשי מוחק, ואינו נוגע בהתנהגות
ה‑offline או ב‑caching של mind‑space עצמה.

---

## 4. מה בוצע בפועל ב‑TASK-007

בהתאם להמלצה שאושרה — **חלופה 2**, SW ייעודי עם scope מוגבל:

* Script URL: `<base>sw.js` ⟵ בפריסה `/mind-space/shopping/sw.js`
* Scope: `<base>` ⟵ בפריסה `/mind-space/shopping/`
* Cache prefix ייעודי: `shopping-assistant-`
* ב‑`activate` נמחקים **רק** מטמונים עם ה‑prefix הזה שאינם הגרסה הנוכחית
* `fetch` מטפל אך ורק ב‑GET, same‑origin, ותחת ה‑base של Shopping
* ניווט: network‑first עם fallback ל‑`index.html` **של Shopping**, מתוך
  המטמון הייעודי בלבד (`caches.open(CACHE).match(...)` ולא `caches.match(...)`
  שסורק את כל מטמוני ה‑origin)

**מה לא בוצע, במכוון:**

* ❌ אין `unregister` ל‑SW הראשי
* ❌ אין מחיקת מטמונים זרים
* ❌ אין שינוי ב‑`sw.js` הראשי
* ❌ אין רישום עם scope של `/mind-space/`
* ❌ אין שימוש ב‑`Service-Worker-Allowed`

---

## 5. מה לא ניתן היה לאמת מקומית

הבדיקות המקומיות רצו מול שרת שמדמה את נתיב הבסיס `/mind-space/shopping/`.
**זו אינה בדיקת GitHub Pages אמיתית.**

טעון אימות בפריסה אמיתית, לפני מיזוג ל‑`main`:

```js
await navigator.serviceWorker.getRegistrations()
// לכל registration: active.scriptURL + scope
navigator.serviceWorker.controller?.scriptURL   // מתוך עמוד Shopping
```

הציפייה:

```text
scriptURL: https://avi7756-design.github.io/mind-space/shopping/sw.js
scope:     https://avi7756-design.github.io/mind-space/shopping/
```

ובנוסף: שה‑registration של mind‑space (`/mind-space/sw.js`, scope `/mind-space/`)
**עדיין קיים ופעיל**.

---

## 6. TASK-008 — סגירת הממצא

הממצא מ‑§2.10 תוקן. השינוי ב‑`sw.js` בשורש המאגר הוא בן שתי שורות:

```js
// נוסף
const P = "mindspace-";

// לפני
k.filter(x => x !== C)
// אחרי
k.filter(x => x.startsWith(P) && x !== C)
```

### מה מוגן כעת

| מטמון | לפני | אחרי |
|---|---|---|
| `mindspace-v10`, `mindspace-v11` (ישנים) | נמחק | נמחק |
| `mindspace-v12` (נוכחי) | נשמר | נשמר |
| `shopping-assistant-v1` | 🔴 **נמחק** | ✅ **נשמר** |
| מטמון של אפליקציה אחרת ב‑origin | 🔴 **נמחק** | ✅ **נשמר** |
| שם שמכיל `mindspace` באמצע (`x-mindspace-v1`) | 🔴 **נמחק** | ✅ **נשמר** |

### מה לא שונה

שם המטמון נשאר `mindspace-v12` — **לא הועלתה גרסה**. אין בכך צורך טכני:
הדפדפן מזהה עדכון של Service Worker לפי **בייטים של הסקריפט**, לא לפי שם
המטמון. הסקריפט השתנה, ולכן worker חדש יותקן, יפעיל `skipWaiting()` ויריץ את
הניקוי המתוקן. העלאת גרסה הייתה מאלצת הורדה מחדש של מעטפת mind‑space ללא
תועלת.

כמו כן לא שונו: אסטרטגיית הרשת (network‑first לניווט, cache‑first לנכסים),
ה‑fallback (`./index.html` של mind‑space), ה‑scope, וה‑`skipWaiting`/`clientsClaim`.

### כיצד זה נאכף

`src/pwa/rootSw.test.ts` טוען את **שני קובצי ה‑SW האמיתיים** לתוך sandbox של
`node:vm` עם `CacheStorage` מדומה משותף, ומריץ את אירועי מחזור החיים שלהם.
הבדיקות אינן משכפלות את הלוגיקה — הן מריצות את הקבצים שנפרסים בפועל.

השער המרכזי: מטמון אחד של כל אפליקציה על אותו origin, הפעלת `activate` של שתיהן
בשני הסדרים, ואימות ששניהם שרדו. אומת גם שהבדיקות תופסות את הבאג — החזרת
המסנן המקורי מפילה 8 בדיקות.

### מה עדיין טעון בדיקת GitHub Pages אמיתית

* ש‑`/mind-space/sw.js` המעודכן אכן נפרס והופעל אצל משתמשים קיימים.
* שהמטמון `shopping-assistant-v1` שורד פריסה אמיתית של mind‑space.
* שני ה‑registrations וה‑scopes בפועל (ראו §5).

**חלון סיכון שנותר:** עד שה‑`sw.js` המתוקן ייפרס ל‑`main`, ה‑worker הישן עדיין
פעיל אצל משתמשים קיימים וימשיך למחוק את מטמון Shopping. לכן יש לפרוס את התיקון
הזה **לפני או יחד עם** גרסת ה‑PWA של Shopping, ולא אחריה.

### ממצא נוסף, בחומרה נמוכה — לא טופל

שורות ה‑`fetch` ב‑`sw.js` הראשי משתמשות ב‑`caches.match(req)` ללא שם מטמון,
כלומר סורקות את כל מטמוני ה‑origin. בפועל זה שפיר: ההתאמה היא לפי URL, ושתי
האפליקציות מאחסנות קבוצות URL זרות זו לזו. המקרה היחיד שבו אותו URL קיים בשתי
הקבוצות הוא `/mind-space/shopping/index.html`, ושם התוכן זהה ממילא.
לא שונה — המפרט אוסר במפורש שינוי אסטרטגיית ה‑fetch.
