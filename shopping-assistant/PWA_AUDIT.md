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

🔴 **זהו הממצא החמור ביותר בבדיקה.**

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
| **ה‑SW הראשי מוחק את המטמון שלנו** | ⚠️ **פתוח** | דורש שינוי ב‑`sw.js` — אסור במשימה זו |

**חומרת ההשפעה:** בינונית ולא קריטית.
בכל פריסה של mind‑space, המטמון של Shopping יימחק. התוצאה: **הביקור המקוון
הבא ייטען כרגיל ויאכלס את המטמון מחדש.** הפגיעה מוגבלת לחלון שבין המחיקה
לביקור המקוון הבא — בו האפליקציה לא תיפתח offline.

**התיקון המומלץ בעתיד** (ל‑Task נפרד, מחוץ להיקף TASK-007):
שינוי שורה אחת ב‑`sw.js` הראשי, מהשוואת שוויון לבדיקת prefix:

```js
// לפני
k.filter(x => x !== C)
// אחרי
k.filter(x => x.startsWith("mindspace-") && x !== C)
```

זהו שינוי בטוח: הוא מצמצם את מה שה‑SW הראשי מוחק, ואינו נוגע בהתנהגות
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
