# ARCHITECTURE.md — ארכיטקטורת המערכת

> מסמך טכני מעמיק. משלים את `PROJECT_HANDOFF.md` ומתמקד ב**איך** המערכת בנויה
> ו**למה** נבחרו הפתרונות האלה.
>
> **גרסה:** 1.0.0 · **עדכון אחרון:** 1 באוגוסט 2026

---

## תוכן עניינים

1. [עקרונות יסוד](#1-עקרונות-יסוד)
2. [מודל השכבות](#2-מודל-השכבות)
3. [מודל הנתונים](#3-מודל-הנתונים)
4. [מנוע הדירוג — פירוט מלא](#4-מנוע-הדירוג--פירוט-מלא)
5. [מנוע ההתראות — פירוט מלא](#5-מנוע-ההתראות--פירוט-מלא)
6. [ניהול State](#6-ניהול-state)
7. [שכבת הנתונים ונקודת האינטגרציה](#7-שכבת-הנתונים-ונקודת-האינטגרציה)
8. [ניתוב ופריסה](#8-ניתוב-ופריסה)
9. [ארכיטקטורת העיצוב](#9-ארכיטקטורת-העיצוב)
10. [ארכיטקטורת היעד עם Backend](#10-ארכיטקטורת-היעד-עם-backend)
11. [חוב טכני](#11-חוב-טכני)

---

## 1. עקרונות יסוד

חמישה עקרונות שמנחים כל החלטה בקוד:

### עיקרון 1 — הפרדת לוגיקה עסקית מ‑UI

`services/` הוא JavaScript טהור. **אפס ייבוא של React.**

```
services/scoring.ts   →  0 imports מ-react
services/alerts.ts    →  0 imports מ-react
services/format.ts    →  0 imports מ-react
services/export.ts    →  משתמש ב-DOM API בלבד (Blob, createElement)
services/api.ts       →  0 imports מ-react
```

**התועלת:** אפשר לבדוק את מנוע הדירוג ב‑Node ללא DOM. אפשר להעביר את `scoring.ts`
לשרת כמו שהוא. אפשר להחליף את React בלי לגעת בלוגיקה.

### עיקרון 2 — נתונים נגזרים לעולם לא נשמרים

ציוני התמורה, הסינון והמיון **אינם ב‑state**. הם מחושבים מחדש בכל רינדור דרך `useMemo`.

```tsx
const scored   = useMemo(() => scoreOffers(offers, suppliers, weights), [offers, suppliers, weights]);
const filtered = useMemo(() => rankOffers(applyFilters(scored), rankMode), [scored, rankMode, ...]);
```

**למה:** אילו שמרנו ציונים, כל שינוי במשקולות היה מחייב חישוב מחדש ידני של כל
התוצאות. שכחה אחת = משתמש רואה ציונים ישנים. נגזרת = **בלתי אפשרי להיות לא מסונכרן.**

### עיקרון 3 — נקודת אינטגרציה יחידה

**בכל הקוד קיימת בדיוק קריאת נתונים חיצונית אחת:**

```tsx
const results = await getSupplierDataProvider().searchOffers(q);
```

זה הכול. אין `fetch` פזור, אין קריאות ישירות מרכיבים. החלפת ה‑mock ב‑Backend =
שינוי פונקציית מפעל אחת.

### עיקרון 4 — טיפוסים כחוזה

`types/index.ts` אינו קובץ עזר — **הוא המפרט של המערכת**. כשייבנה Backend, הוא יחזיר
בדיוק את `Offer` ו‑`Supplier` המוגדרים שם. הטיפוסים נכתבו מראש כחוזה API.

### עיקרון 5 — כשל בטוח בכיוון האמינות

כשהמערכת לא בטוחה — היא **מחמירה**:
* ספק חסום → **לא מוצג כלל** (לא "מוצג עם אזהרה")
* אין ערוץ התראה פעיל → סטטוס `pending` (לא `sent`)
* `returnCost === 'none'` → ציון החזרות **0** (לא "חלקי")

---

## 2. מודל השכבות

### דיאגרמת תלויות

```
┌────────────────────────────────────────────────────────────────────┐
│                          PAGES  (7)                                │
│  Dashboard · Search · Suppliers · Watchlist · Alerts · Activity ·  │
│  Settings                                                           │
└───────────┬──────────────────────┬─────────────────────┬───────────┘
            │                      │                     │
            ▼                      ▼                     ▼
┌───────────────────┐   ┌───────────────────┐  ┌──────────────────┐
│    COMPONENTS     │   │      STORE        │  │    SERVICES      │
│  layout · ui ·    │◄──┤  useAppStore      │─►│  scoring         │
│  charts · compare │   │  (Zustand+persist)│  │  alerts          │
└─────────┬─────────┘   └─────────┬─────────┘  │  export · format │
          │                       │             │  api             │
          │                       │             └────────┬─────────┘
          │                       │                      │
          ▼                       ▼                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                      TYPES  +  DATA (seed)                         │
│              המקור היחיד לאמת של הדומיין ושל נתוני הדמו             │
└────────────────────────────────────────────────────────────────────┘
```

### כללי תלות

| מותר | אסור |
|---|---|
| Page → Component | Component → Page ⚠️ |
| Page → Store | Service → Store |
| Page → Service | Service → Component |
| Component → Service | Type → כל דבר |
| Store → Service | Service → React |
| הכול → Types | |

⚠️ **הפרה קיימת:** `DashboardPage` מייבא את `ACTIVITY_META` מ‑`ActivityPage`.
תיקון: להעביר ל‑`src/constants/activity.ts`.

---

## 3. מודל הנתונים

### דיאגרמת ישויות

```
        Supplier                          Offer
     ┌──────────────┐               ┌─────────────────┐
     │ id           │◄──────────────┤ supplierId      │
     │ name         │   1        N  │ productName     │
     │ domain       │               │ basePrice       │
     │ country      │               │ shippingCost    │
     │ verification │               │ taxEstimate     │
     │ trustScore   │               │ deliveryDays±   │
     │ rating       │               │ warrantyMonths  │
     │ reviewCount  │               │ returnDays/Cost │
     │ yearsActive  │               │ stock           │
     │ riskFlags[]  │               │ url             │
     │ excluded     │               │ currency: 'ILS' │
     └──────────────┘               └────────┬────────┘
             ▲                               │
             │                    scoreOffers(offers, suppliers, weights)
             │                               ▼
             │                      ┌─────────────────┐
             │                      │  ScoredOffer    │
             │                      │  extends Offer  │
             │                      ├─────────────────┤
             └──────────────────────┤ supplier        │
                                    │ totalCost       │
                                    │ breakdown{5}    │
                                    │ valueScore      │
                                    └─────────────────┘

     WatchlistItem                    AlertRecord              ActivityEntry
   ┌─────────────────┐            ┌────────────────┐        ┌──────────────┐
   │ id              │            │ id             │        │ id           │
   │ productName     │            │ type (3)       │        │ type (6)     │
   │ query           │            │ title/message  │        │ message      │
   │ supplierId ─────┼──► Supplier│ channels[]     │        │ createdAt    │
   │ currentPrice    │            │ status (3)     │        └──────────────┘
   │ targetPrice     │            │ createdAt      │
   │ history[] ──────┼──► PricePoint{date, price}  │
   │ createdAt       │            └────────────────┘
   └─────────────────┘
```

### טבלת האיחודים (Union Types)

| טיפוס | ערכים | הערה |
|---|---|---|
| `StockStatus` | `in_stock` · `low_stock` · `preorder` · `out_of_stock` | ⚠️ `out_of_stock` ללא נתונים |
| `VerificationStatus` | `verified` · `pending` · `unverified` | |
| `RiskFlag` | `new_seller` · `price_anomaly` · `negative_reviews` · `slow_shipping` · `payment_disputes` · `counterfeit_reports` | 6 סוגים |
| `ReturnCost` | `free` · `paid` · `none` | משפיע ישירות על הציון |
| `RankingMode` | `value` · `price` · `trust` | 3 טאבים |
| `AlertChannel` | `email` · `telegram` · `webhook` | |
| `AlertType` | `price_drop` · `trust_change` · `back_in_stock` | ⚠️ השלישי לא מיוצר |
| `ActivityType` | `search` · `compare` · `track` · `alert` · `supplier_update` · `settings` | |

### הערה על המטבע

```ts
currency: 'ILS';   // ← literal type, לא string
```

זו החלטה מכוונת: **המערכת חד‑מטבעית כיום.** ה‑literal מונע הכנסת מטבע אחר בטעות
ומאלץ עדכון מודע כשתתווסף תמיכה רב‑מטבעית.

---

## 4. מנוע הדירוג — פירוט מלא

### שלב 1: סינון ספקים חסומים

```ts
const eligible = offers.filter(o => {
  const s = supplierById.get(o.supplierId);
  return s && !s.excluded;
});
if (eligible.length === 0) return [];
```

הצעה מספק חסום **או** מספק לא מוכר יוצאת מהמשחק לפני כל חישוב.

### שלב 2: חישוב עלות כוללת

```
totalCost = basePrice + shippingCost + taxEstimate
```

**זה המספר שהמערכת מדרגת לפיו** — לא `basePrice`. הטבלה מציגה את שניהם כדי
שהמשתמש יראה את הפער.

### שלב 3: מציאת קצוות בסט

```ts
minCost, maxCost      // מתוך כל ההצעות הכשירות
minDel,  maxDel       // ממוצע (deliveryDaysMin + deliveryDaysMax) / 2
minWar,  maxWar       // warrantyMonths
```

### שלב 4: נרמול ל‑0..100

| ממד | נוסחה | כיוון |
|---|---|---|
| **עלות** | `(max - v) / (max - min) × 100` | הנמוך ביותר → 100 |
| **אמינות** | `supplier.trustScore` | ⚠️ **מוחלט, לא מנורמל** |
| **משלוח** | `(max - v) / (max - min) × 100` | המהיר ביותר → 100 |
| **אחריות** | `(v - min) / (max - min) × 100` | הארוכה ביותר → 100 |
| **החזרות** | `min(days/30, 1) × costFactor × 100` | ⚠️ **סקאלה מוחלטת** |

**מקדם עלות ההחזרה:** `free` → 1.0 · `paid` → 0.55 · `none` → הציון 0

### שלב 5: שקלול

```ts
valueScore = ( cost×W.totalCost + trust×W.trust + delivery×W.delivery
             + warranty×W.warranty + returns×W.returns ) / Σ(W)
```

החלוקה ב‑`Σ(W)` (ולא ב‑100 קבוע) מבטיחה שהציון נשאר בטווח 0..100 גם אם סכום
המשקולות אינו 100 — הגנה מפני מצב שה‑UI לא אמור לאפשר.

### נקודות עדינות שחייבים להכיר

| # | הנקודה | ההשלכה |
|---|---|---|
| 1 | **אמינות היא מוחלטת** | ספק עם 64 מקבל 64 גם אם הוא הכי אמין בתוצאות. **החלטה מכוונת** — אמינות היא תכונה של הספק, לא של ההשוואה. |
| 2 | **החזרות בסקאלה מוחלטת** | 30 יום = 100 תמיד. הצעה עם 60 יום לא תקבל יותר מ‑100. |
| 3 | **הצעה בודדת מנפחת ציון** | `min === max` → כל הממדים היחסיים = 100 (באג B14). |
| 4 | **נרמול תלוי־סט** | אותה הצעה תקבל ציונים שונים בחיפושים שונים. זו התנהגות תקינה: הציון עונה על "כמה זה טוב **מבין האפשרויות**". |

### דוגמה מספרית מלאה

חיפוש "אוזניות Sony WH-1000XM5", משקולות ברירת מחדל (40/25/15/10/10):

| ספק | בסיס | משלוח | מס | **סה״כ** | אספקה | אחריות | החזרה | אמינות |
|---|---|---|---|---|---|---|---|---|
| KSP | 1,190 | 0 | 0 | **1,190** | 1–3 | 12 | 14 חינם | 92 |
| AliExpress | 890 | 45 | 150 | **1,085** | 15–30 | 3 | 15 בתשלום | 64 |

**נרמול (טווח בסט: עלות 1,085–1,278 · אספקה 2–22.5 · אחריות 3–24):**

| ממד | KSP | AliExpress |
|---|---|---|
| עלות | 46 | **100** |
| אמינות | **92** | 64 |
| משלוח | **100** | 0 |
| אחריות | 43 | 0 |
| החזרות | 47 | 28 |

**ציון סופי:**
```
KSP        = (46×40 + 92×25 + 100×15 + 43×10 + 47×10) / 100 = 65.2  ← מנצח
AliExpress = (100×40 + 64×25 + 0×15 + 0×10 + 28×10) / 100 = 58.8
```

**הפרשנות:** AliExpress זולה ב‑105 ₪, אבל 15–30 יום המתנה, 3 חודשי אחריות והחזרה
בתשלום מבטלים את היתרון. **בדיוק ההחלטה שהמוצר נועד לקבל עבור המשתמש.**

---

## 5. מנוע ההתראות — פירוט מלא

### עץ ההחלטה

```
evaluatePriceChange(item, prev, next, channels)
│
├─ crossedTarget = prev > target && next <= target
│  └─ TRUE  →  התראה "ירידת מחיר מתחת ליעד"          [עדיפות 1]
│
├─ bigDrop = next < prev && (prev-next)/prev >= 0.05
│  └─ TRUE  →  התראה "ירידת מחיר משמעותית"           [עדיפות 2]
│
└─ אחרת  →  אין התראה
```

**`else if` ולא שני `if`:** חצייה של היעד היא כבר האירוע החשוב. שתי התראות על
אותה ירידה = רעש.

### קביעת הסטטוס

```ts
status: channels.length > 0 ? 'sent' : 'pending'
```

⚠️ **`'sent'` כאן משמעו "היה לאן לשלוח", לא "נשלח בפועל".** אין קוד ששולח.
הסטטוס `'failed'` מוגדר בטיפוס אך **לעולם אינו נוצר** — הוא שמור לעתיד.

### מה נדרש לשליחה אמיתית

```
┌──────────┐   POST /alerts   ┌──────────┐   ┌─────────────────┐
│  Client  │─────────────────►│ Backend  │──►│ SendGrid / SES  │
└──────────┘                  │          │   ├─────────────────┤
                              │ מחזיק את │──►│ Telegram Bot API│
                              │ הסודות!  │   ├─────────────────┤
                              └──────────┘──►│ Outgoing Webhook│
                                             └─────────────────┘
```

**הלקוח לעולם לא מחזיק טוקנים.** ראו S1 ב‑`PROJECT_HANDOFF.md`.

---

## 6. ניהול State

### מבנה ה‑Store

```ts
create<AppState>()(
  persist(
    (set, get) => ({ /* 8 שדות + 13 actions */ }),
    { name: 'shopping-assistant-store', version: 1 }
  )
)
```

### דפוס הקומפוזיציה

`get()` מאפשר ל‑action לקרוא ל‑action אחר — כך נשמרת עקביות היומן:

```ts
addToWatchlist: (item) => {
  const entry = { ...item, id: newId('watch'), createdAt: ..., history: [...] };
  set(s => ({ watchlist: [entry, ...s.watchlist] }));
  get().logActivity('track', `נוסף מוצר למעקב: ${item.productName}...`);
}
```

### דפוס הסלקטור

```tsx
const watchlist = useAppStore(s => s.watchlist);   // ✅ מרנדר רק כשהמעקב משתנה
const store     = useAppStore();                   // ❌ מרנדר בכל שינוי — לא בשימוש
```

### שכבת ה‑Persist

| | |
|---|---|
| **מפתח** | `shopping-assistant-store` |
| **מנגנון** | `localStorage` (סינכרוני) |
| **גרסה** | 1 |
| **מיגרציה** | ❌ **אין** — באג B2 |

**⚠️ הבעיה הקריטית:** משתמש עם state שמור **לא יקבל** שינויים ב‑`seed.ts`.
הוספת ספק חדש למאגר לא תגיע אליו לעולם. הפתרון:

```ts
{
  name: 'shopping-assistant-store',
  version: 2,
  migrate: (persisted, fromVersion) => {
    if (fromVersion < 2) {
      // מיזוג ספקים חדשים תוך שמירת החרגות המשתמש
      return { ...persisted, suppliers: mergeSuppliers(persisted.suppliers, SUPPLIERS) };
    }
    return persisted;
  },
}
```

---

## 7. שכבת הנתונים ונקודת האינטגרציה

### הגנרטור הדטרמיניסטי

```
query "מקרר סמסונג"
   │
   ├─ findCatalogEntry()  →  לא נמצא
   │
   ├─ hashString(q)       →  FNV-1a  →  seed מספרי יציב
   ├─ mulberry32(seed)    →  PRNG    →  רצף אקראי יציב
   │
   └─ בניית 4–6 הצעות: מחיר בסיס, מקדם לכל ספק,
      משלוח/מס לפי מדינה, אספקה/אחריות/החזרה/מלאי
```

**למה זה חשוב:** בלי דטרמיניזם, כל רענון היה מציג מחירים אחרים — הדמו היה נראה שבור.
עם דטרמיניזם, "מקרר סמסונג" מחזיר תמיד את אותן 5 הצעות.

**⚠️ אל תשנו את `hashString` או `mulberry32`** — זה ישנה את כל הדמו.

### לוגיקת המס בגנרטור

```ts
const isAbroad     = s.country !== 'ישראל';
const taxEstimate  = isAbroad && basePrice > 280 ? Math.round(basePrice * 0.17) : 0;
```

משקף את מדיניות פטור המע״מ הישראלית ליבוא אישי מתחת לסף. **פישוט מכוון** —
בייצור זה חייב להגיע ממקור אמיתי.

### מדריך החלפה ל‑Backend

```ts
// src/services/api.ts

class HttpSupplierDataProvider implements SupplierDataProvider {
  constructor(private baseUrl: string) {}

  async searchOffers(query: string): Promise<Offer[]> {
    const res = await fetch(`${this.baseUrl}/offers?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const data = await res.json();
    return data.offers;          // ← כאן חובה ולידציית סכמה (Zod)
  }

  async listSuppliers(): Promise<Supplier[]> { /* ... */ }
  async fetchCurrentPrice(query: string, supplierId: string) { /* ... */ }
}

export function getSupplierDataProvider(): SupplierDataProvider {
  if (!provider) {
    provider = API_BASE_URL
      ? new HttpSupplierDataProvider(API_BASE_URL)
      : new MockSupplierDataProvider();
  }
  return provider;
}
```

**נדרש בנוסף:**
1. ולידציית סכמה על התגובה (אל תבטחו ב‑API)
2. ולידציית `url` — `https:` בלבד (S3)
3. `try/catch` ב‑`runSearch` + מצב שגיאה ב‑UI (B1)
4. timeout ו‑retry
5. ביטול בקשה קודמת (`AbortController`) בחיפוש חדש

---

## 8. ניתוב ופריסה

### HashRouter — ההחלטה והמחיר

| | BrowserRouter | **HashRouter** ✅ |
|---|---|---|
| כתובת | `/shopping/search` | `/shopping/#/search` |
| כניסה ישירה בשרת סטטי | ❌ 404 | ✅ עובד |
| נדרשת תצורת שרת | ✅ כן | ❌ לא |
| SEO | טוב יותר | חלש יותר |

**ההחלטה:** האפליקציה היא כלי פרטי, לא דף שיווקי. SEO אינו רלוונטי. אמינות
פריסה — כן.

### `base: './'` — למה זה קריטי

```
base: '/'   →  <script src="/assets/index.js">
               ב-GitHub Pages תחת /mind-space/shopping/  →  404 💥

base: './'  →  <script src="./assets/index.js">
               עובד בשורש, בתת-נתיב, ומקובץ מקומי  →  ✅
```

### פיצול ה‑Chunks

```js
manualChunks: {
  react:  ['react', 'react-dom', 'react-router-dom'],   // 165KB
  charts: ['recharts'],                                  // 383KB
}
```

**התועלת:** שינוי בקוד האפליקציה (87KB) לא מבטל את המטמון של React ו‑Recharts.

**המגבלה:** אין `React.lazy` לנתיבים — כל שבעת העמודים ב‑chunk האפליקציה.

---

## 9. ארכיטקטורת העיצוב

### שכבות Tailwind

```
@layer base        →  html, body (רקע, צבע טקסט, dark:)
@layer components  →  .card  .input  .btn-primary  .btn-ghost
utilities          →  שאר הקוד — מחלקות ישירות ב-JSX
```

**הכלל:** דפוס שחוזר 3+ פעמים עולה ל‑`@layer components`. אחרת — inline.

### אסטרטגיית מצב כהה

```js
darkMode: 'class'   // לא 'media'
```

```tsx
useEffect(() => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}, [theme]);
```

**כל צבע חייב וריאנט `dark:`.** אין fallback אוטומטי — זה מכוון: המצב הכהה עוצב
ידנית ולא נגזר בהיפוך.

### RTL — שלוש שכבות

| שכבה | מימוש |
|---|---|
| מסמך | `<html dir="rtl" lang="he">` |
| פריסה | Flexbox/Grid — מתהפכים אוטומטית |
| חריגה מכוונת | `<div dir="ltr">` סביב הגרף בלבד |

**החריגה:** ציר זמן חייב להתקדם משמאל לימין. גרף מחירים "הפוך" מבלבל אפילו
בממשק עברי. זו החלטה מודעת המתועדת בהערה בקוד.

---

## 10. ארכיטקטורת היעד עם Backend

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                          │
│   ללא סודות · ללא מפתחות · מדבר רק עם ה-Backend שלנו            │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS + JWT
┌────────────────────────────▼────────────────────────────────────┐
│                        API GATEWAY                              │
│   Auth · Rate limiting · ולידציית קלט                           │
└──┬──────────────┬──────────────┬──────────────┬─────────────────┘
   │              │              │              │
   ▼              ▼              ▼              ▼
┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
│ Search │  │ Watchlist│  │  Alerts  │  │  Suppliers   │
│Service │  │ Service  │  │ Service  │  │   Service    │
└───┬────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘
    │            │             │                │
    ▼            ▼             ▼                ▼
┌────────┐  ┌──────────────────────────┐  ┌──────────────┐
│Scraper │  │      PostgreSQL          │  │ Trust Engine │
│  Pool  │  │  users · offers ·        │  │  (ניקוד)     │
│  +     │  │  watchlist · price_hist  │  └──────────────┘
│ Cache  │  │  alerts · activity       │
└────────┘  └──────────────────────────┘
                        │
              ┌─────────▼──────────┐
              │  Scheduled Jobs    │
              │  • בדיקת מחירים    │
              │  • רענון אמינות     │
              │  • שליחת התראות    │
              └────────────────────┘
```

### מה עובר לשרת

| רכיב | היום | ביעד | הערה |
|---|---|---|---|
| `scoring.ts` | לקוח | **שניהם** | לקוח לתצוגה מיידית, שרת לעקביות. **אותו קוד בדיוק.** |
| `alerts.ts` | לקוח | **שרת בלבד** | חייב לרוץ ברקע |
| `seed.ts` | לקוח | **מוחלף ב‑DB** | |
| `api.ts` mock | לקוח | **מוחלף ב‑HTTP** | הממשק נשאר |
| `format.ts` | לקוח | **נשאר בלקוח** | תצוגה בלבד |
| `export.ts` | לקוח | **מתפצל** | CSV בלקוח, PDF בשרת |

### סכמת DB מוצעת

```sql
users            (id, email, created_at, settings_json)
suppliers        (id, name, domain, country, verification,
                  trust_score, rating, review_count, years_active)
supplier_flags   (supplier_id, flag, detected_at)
user_exclusions  (user_id, supplier_id, reason, created_at)
products         (id, canonical_name, category, embedding vector)  -- לשלב 2 ב-AI
offers           (id, product_id, supplier_id, base_price, shipping,
                  tax, delivery_min, delivery_max, warranty_months,
                  return_days, return_cost, stock, url, scraped_at)
watchlist        (id, user_id, product_id, supplier_id,
                  target_price, created_at)
price_history    (watchlist_id, price, recorded_at)   -- time-series
alerts           (id, user_id, type, title, message,
                  channels[], status, created_at, sent_at)
activity         (id, user_id, type, message, created_at)
```

---

## 11. חוב טכני

| # | החוב | חומרה | עלות תיקון | סיכון בהמתנה |
|---|---|---|---|---|
| 1 | **אפס בדיקות** | 🔴 | בינונית | כל שינוי ב‑`scoring` עלול לשבור בשקט |
| 2 | **אין מיגרציה ל‑persist** | 🔴 | נמוכה | משתמשים קיימים תקועים על נתונים ישנים |
| 3 | **אין טיפול בשגיאות** | 🔴 | נמוכה | קריטי ברגע שיש API |
| 4 | **תלות Dashboard↔ActivityPage** | 🟡 | נמוכה מאוד | מפר שכבות, מקשה על refactor |
| 5 | **אין ESLint** | 🟠 | נמוכה | סטיות סגנון מצטברות |
| 6 | **`fetchCurrentPrice`/`listSuppliers` לא בשימוש** | 🟡 | נמוכה | קוד מת מבלבל |
| 7 | **סמנטיקת `currentPrice` לא עקבית** | 🟠 | בינונית | חישובי חיסכון שגויים |
| 8 | **אין code splitting** | 🟡 | נמוכה | טעינה ראשונית איטית |
| 9 | **Google Fonts חיצוני** | 🟡 | נמוכה | תלות ברשת + FOUT |
| 10 | **`localStorage` ללא גבול** | 🟢 | נמוכה | יתמלא אחרי חודשים |

### סדר תיקון מומלץ

```
1. Vitest + בדיקות ל-scoring/alerts      ← מאפשר לתקן את השאר בביטחון
2. try/catch + Error Boundary            ← חוסם אינטגרציה
3. מיגרציה ל-persist                     ← חוסם עדכוני נתונים
4. העברת ACTIVITY_META ל-constants/      ← 5 דקות
5. ESLint + Prettier                     ← מונע הצטברות
6. איחוד סמנטיקת currentPrice            ← דורש החלטת מוצר
7. code splitting + גופן מקומי           ← ביצועים
```

---

*מסמך זה מתאר את המצב **בפועל** נכון ל‑1 באוגוסט 2026.
כל סטייה בין המסמך לקוד — **הקוד הוא האמת**, והמסמך טעון עדכון.*
