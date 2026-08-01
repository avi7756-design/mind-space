import type {
  ActivityEntry,
  AlertRecord,
  Offer,
  Supplier,
  WatchlistItem,
  PricePoint,
} from '../types';

// ---------- Supplier directory (mock — replaced by the aggregation backend later) ----------

export const SUPPLIERS: Supplier[] = [
  {
    id: 'ksp',
    name: 'KSP',
    domain: 'ksp.co.il',
    country: 'ישראל',
    verification: 'verified',
    trustScore: 92,
    rating: 4.5,
    reviewCount: 48200,
    yearsActive: 20,
    riskFlags: [],
    excluded: false,
  },
  {
    id: 'ivory',
    name: 'אייבורי',
    domain: 'ivory.co.il',
    country: 'ישראל',
    verification: 'verified',
    trustScore: 89,
    rating: 4.4,
    reviewCount: 31500,
    yearsActive: 18,
    riskFlags: [],
    excluded: false,
  },
  {
    id: 'bug',
    name: 'באג',
    domain: 'bug.co.il',
    country: 'ישראל',
    verification: 'verified',
    trustScore: 87,
    rating: 4.3,
    reviewCount: 27800,
    yearsActive: 22,
    riskFlags: [],
    excluded: false,
  },
  {
    id: 'amazon',
    name: 'Amazon',
    domain: 'amazon.com',
    country: 'ארה"ב',
    verification: 'verified',
    trustScore: 95,
    rating: 4.7,
    reviewCount: 1250000,
    yearsActive: 29,
    riskFlags: [],
    excluded: false,
  },
  {
    id: 'lastprice',
    name: 'לאסט פרייס',
    domain: 'lastprice.co.il',
    country: 'ישראל',
    verification: 'verified',
    trustScore: 81,
    rating: 4.1,
    reviewCount: 9600,
    yearsActive: 14,
    riskFlags: [],
    excluded: false,
  },
  {
    id: 'ebay-top',
    name: 'eBay (מוכר מדורג)',
    domain: 'ebay.com',
    country: 'ארה"ב',
    verification: 'verified',
    trustScore: 78,
    rating: 4.2,
    reviewCount: 88000,
    yearsActive: 12,
    riskFlags: ['slow_shipping'],
    excluded: false,
  },
  {
    id: 'aliexpress',
    name: 'AliExpress (חנות רשמית)',
    domain: 'aliexpress.com',
    country: 'סין',
    verification: 'pending',
    trustScore: 64,
    rating: 3.9,
    reviewCount: 152000,
    yearsActive: 10,
    riskFlags: ['slow_shipping', 'negative_reviews'],
    excluded: false,
  },
  {
    id: 'payngo',
    name: 'מחסני חשמל Pay&Go',
    domain: 'payngo.co.il',
    country: 'ישראל',
    verification: 'verified',
    trustScore: 84,
    rating: 4.2,
    reviewCount: 15400,
    yearsActive: 16,
    riskFlags: [],
    excluded: false,
  },
  {
    id: 'gadget4u',
    name: 'GadgetDeal4U',
    domain: 'gadgetdeal4u.shop',
    country: 'לא ידוע',
    verification: 'unverified',
    trustScore: 22,
    rating: 2.1,
    reviewCount: 87,
    yearsActive: 1,
    riskFlags: ['new_seller', 'price_anomaly', 'payment_disputes', 'counterfeit_reports'],
    excluded: true,
    exclusionReason: 'מוכר לא מאומת עם דיווחי הונאה וזיופים — נחסם אוטומטית לפי כללי האמינות',
  },
  {
    id: 'techstore-il',
    name: 'TechStore IL',
    domain: 'techstore-il.com',
    country: 'ישראל',
    verification: 'pending',
    trustScore: 58,
    rating: 3.7,
    reviewCount: 1240,
    yearsActive: 3,
    riskFlags: ['new_seller'],
    excluded: false,
  },
];

// ---------- Curated offer catalogs for common demo queries ----------

interface CatalogEntry {
  keywords: string[];
  productName: string;
  offers: Array<Omit<Offer, 'id' | 'productName' | 'currency' | 'url'>>;
}

const CATALOG: CatalogEntry[] = [
  {
    keywords: ['אוזניות', 'sony', 'wh-1000', 'headphones'],
    productName: 'אוזניות Sony WH-1000XM5',
    offers: [
      { supplierId: 'ksp', basePrice: 1190, shippingCost: 0, taxEstimate: 0, deliveryDaysMin: 1, deliveryDaysMax: 3, warrantyMonths: 12, returnDays: 14, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'ivory', basePrice: 1249, shippingCost: 29, taxEstimate: 0, deliveryDaysMin: 2, deliveryDaysMax: 4, warrantyMonths: 24, returnDays: 14, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'bug', basePrice: 1229, shippingCost: 0, taxEstimate: 0, deliveryDaysMin: 2, deliveryDaysMax: 5, warrantyMonths: 12, returnDays: 14, returnCost: 'free', stock: 'low_stock' },
      { supplierId: 'amazon', basePrice: 999, shippingCost: 85, taxEstimate: 178, deliveryDaysMin: 7, deliveryDaysMax: 14, warrantyMonths: 12, returnDays: 30, returnCost: 'paid', stock: 'in_stock' },
      { supplierId: 'ebay-top', basePrice: 940, shippingCost: 110, taxEstimate: 168, deliveryDaysMin: 12, deliveryDaysMax: 21, warrantyMonths: 6, returnDays: 30, returnCost: 'paid', stock: 'in_stock' },
      { supplierId: 'aliexpress', basePrice: 890, shippingCost: 45, taxEstimate: 150, deliveryDaysMin: 15, deliveryDaysMax: 30, warrantyMonths: 3, returnDays: 15, returnCost: 'paid', stock: 'in_stock' },
      { supplierId: 'payngo', basePrice: 1270, shippingCost: 0, taxEstimate: 0, deliveryDaysMin: 3, deliveryDaysMax: 6, warrantyMonths: 24, returnDays: 14, returnCost: 'free', stock: 'in_stock' },
    ],
  },
  {
    keywords: ['iphone', 'אייפון'],
    productName: 'Apple iPhone 15 128GB',
    offers: [
      { supplierId: 'ksp', basePrice: 3390, shippingCost: 0, taxEstimate: 0, deliveryDaysMin: 1, deliveryDaysMax: 3, warrantyMonths: 12, returnDays: 14, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'ivory', basePrice: 3450, shippingCost: 0, taxEstimate: 0, deliveryDaysMin: 1, deliveryDaysMax: 4, warrantyMonths: 12, returnDays: 14, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'bug', basePrice: 3499, shippingCost: 0, taxEstimate: 0, deliveryDaysMin: 2, deliveryDaysMax: 5, warrantyMonths: 12, returnDays: 14, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'amazon', basePrice: 3120, shippingCost: 120, taxEstimate: 551, deliveryDaysMin: 6, deliveryDaysMax: 12, warrantyMonths: 12, returnDays: 30, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'lastprice', basePrice: 3350, shippingCost: 39, taxEstimate: 0, deliveryDaysMin: 3, deliveryDaysMax: 7, warrantyMonths: 12, returnDays: 14, returnCost: 'free', stock: 'low_stock' },
      { supplierId: 'techstore-il', basePrice: 3190, shippingCost: 49, taxEstimate: 0, deliveryDaysMin: 4, deliveryDaysMax: 9, warrantyMonths: 6, returnDays: 7, returnCost: 'paid', stock: 'in_stock' },
    ],
  },
  {
    keywords: ['מכונת קפה', 'קפה', 'delonghi', 'espresso'],
    productName: 'מכונת קפה DeLonghi Magnifica S',
    offers: [
      { supplierId: 'payngo', basePrice: 1590, shippingCost: 0, taxEstimate: 0, deliveryDaysMin: 2, deliveryDaysMax: 5, warrantyMonths: 24, returnDays: 14, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'ksp', basePrice: 1640, shippingCost: 0, taxEstimate: 0, deliveryDaysMin: 1, deliveryDaysMax: 3, warrantyMonths: 12, returnDays: 14, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'ivory', basePrice: 1699, shippingCost: 29, taxEstimate: 0, deliveryDaysMin: 2, deliveryDaysMax: 4, warrantyMonths: 24, returnDays: 30, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'amazon', basePrice: 1420, shippingCost: 180, taxEstimate: 272, deliveryDaysMin: 8, deliveryDaysMax: 16, warrantyMonths: 12, returnDays: 30, returnCost: 'paid', stock: 'in_stock' },
      { supplierId: 'lastprice', basePrice: 1570, shippingCost: 45, taxEstimate: 0, deliveryDaysMin: 3, deliveryDaysMax: 8, warrantyMonths: 12, returnDays: 14, returnCost: 'free', stock: 'preorder' },
    ],
  },
  {
    keywords: ['טלוויזיה', 'lg', 'oled', 'tv'],
    productName: 'טלוויזיה LG OLED C3 65"',
    offers: [
      { supplierId: 'ksp', basePrice: 6490, shippingCost: 0, taxEstimate: 0, deliveryDaysMin: 2, deliveryDaysMax: 6, warrantyMonths: 36, returnDays: 14, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'payngo', basePrice: 6290, shippingCost: 99, taxEstimate: 0, deliveryDaysMin: 3, deliveryDaysMax: 8, warrantyMonths: 36, returnDays: 14, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'bug', basePrice: 6590, shippingCost: 0, taxEstimate: 0, deliveryDaysMin: 2, deliveryDaysMax: 7, warrantyMonths: 24, returnDays: 14, returnCost: 'free', stock: 'low_stock' },
      { supplierId: 'ivory', basePrice: 6450, shippingCost: 0, taxEstimate: 0, deliveryDaysMin: 3, deliveryDaysMax: 7, warrantyMonths: 36, returnDays: 30, returnCost: 'free', stock: 'in_stock' },
    ],
  },
  {
    keywords: ['שואב', 'roborock', 'רובוט', 'vacuum'],
    productName: 'שואב רובוטי Roborock S8',
    offers: [
      { supplierId: 'ksp', basePrice: 2290, shippingCost: 0, taxEstimate: 0, deliveryDaysMin: 1, deliveryDaysMax: 4, warrantyMonths: 12, returnDays: 14, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'amazon', basePrice: 1980, shippingCost: 140, taxEstimate: 360, deliveryDaysMin: 7, deliveryDaysMax: 14, warrantyMonths: 12, returnDays: 30, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'aliexpress', basePrice: 1750, shippingCost: 60, taxEstimate: 308, deliveryDaysMin: 14, deliveryDaysMax: 28, warrantyMonths: 6, returnDays: 15, returnCost: 'paid', stock: 'in_stock' },
      { supplierId: 'ivory', basePrice: 2390, shippingCost: 0, taxEstimate: 0, deliveryDaysMin: 2, deliveryDaysMax: 5, warrantyMonths: 24, returnDays: 14, returnCost: 'free', stock: 'in_stock' },
      { supplierId: 'ebay-top', basePrice: 1890, shippingCost: 120, taxEstimate: 342, deliveryDaysMin: 10, deliveryDaysMax: 20, warrantyMonths: 6, returnDays: 30, returnCost: 'paid', stock: 'low_stock' },
    ],
  },
];

/** Find a curated catalog entry matching the free-text query, if any. */
export function findCatalogEntry(query: string): CatalogEntry | undefined {
  const q = query.toLowerCase();
  return CATALOG.find((entry) => entry.keywords.some((k) => q.includes(k)));
}

/**
 * Deterministic pseudo-random generator seeded by the query, so that any
 * free-text product search returns stable, realistic-looking mock offers.
 */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateOffersForQuery(query: string): Offer[] {
  const entry = findCatalogEntry(query);
  if (entry) {
    return entry.offers.map((o, i) => ({
      ...o,
      id: `${entry.productName}-${o.supplierId}-${i}`,
      productName: entry.productName,
      currency: 'ILS',
      url: `https://${SUPPLIERS.find((s) => s.id === o.supplierId)?.domain ?? 'example.com'}/product`,
    }));
  }

  // Fallback: synthesize a stable offer set for an arbitrary query
  const rand = mulberry32(hashString(query.trim().toLowerCase()));
  const base = 200 + Math.round(rand() * 4800);
  const supplierPool = SUPPLIERS.filter((s) => !s.excluded);
  const count = 4 + Math.floor(rand() * 3);
  const picked = [...supplierPool].sort(() => rand() - 0.5).slice(0, count);

  return picked.map((s, i) => {
    const isAbroad = s.country !== 'ישראל';
    const priceFactor = 0.85 + rand() * 0.3;
    const basePrice = Math.round(base * priceFactor * (isAbroad ? 0.88 : 1));
    const shippingCost = isAbroad ? 40 + Math.round(rand() * 140) : rand() > 0.5 ? 0 : 29;
    const taxEstimate = isAbroad && basePrice > 280 ? Math.round(basePrice * 0.17) : 0;
    const stockRoll = rand();
    return {
      id: `${query}-${s.id}-${i}`,
      productName: query.trim(),
      supplierId: s.id,
      basePrice,
      shippingCost,
      taxEstimate,
      deliveryDaysMin: isAbroad ? 6 + Math.floor(rand() * 8) : 1 + Math.floor(rand() * 3),
      deliveryDaysMax: isAbroad ? 14 + Math.floor(rand() * 16) : 3 + Math.floor(rand() * 5),
      warrantyMonths: [3, 6, 12, 12, 24, 36][Math.floor(rand() * 6)],
      returnDays: [7, 14, 14, 30][Math.floor(rand() * 4)],
      returnCost: (['free', 'free', 'paid', 'none'] as const)[Math.floor(rand() * 4)],
      stock: stockRoll > 0.85 ? 'low_stock' : stockRoll > 0.78 ? 'preorder' : 'in_stock',
      url: `https://${s.domain}/product`,
      currency: 'ILS',
    };
  });
}

// ---------- Demo state: watchlist with price history, alerts, activity ----------

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function buildHistory(days: number, start: number, end: number, wobble: number): PricePoint[] {
  const rand = mulberry32(hashString(`${start}-${end}`));
  const points: PricePoint[] = [];
  for (let i = days; i >= 0; i -= 3) {
    const t = 1 - i / days;
    const price = Math.round(start + (end - start) * t + (rand() - 0.5) * wobble);
    points.push({ date: daysAgo(i).slice(0, 10), price });
  }
  points[points.length - 1].price = end;
  return points;
}

/**
 * Every price below is a TOTAL purchase cost (base + shipping + tax) matching
 * the catalog offer for that supplier — see `WatchlistItem` in types/index.ts.
 * `seed.test.ts` enforces this against the catalog, so a future catalog edit
 * that breaks the invariant fails the suite instead of silently skewing the
 * savings figures.
 */
export const SEED_WATCHLIST: WatchlistItem[] = [
  {
    id: 'w1',
    productName: 'אוזניות Sony WH-1000XM5',
    query: 'אוזניות Sony WH-1000XM5',
    supplierId: 'ksp',
    // KSP: 1190 + 0 shipping + 0 tax
    currentPrice: 1190,
    targetPrice: 1050,
    history: buildHistory(90, 1420, 1190, 60),
    createdAt: daysAgo(90),
  },
  {
    id: 'w2',
    productName: 'מכונת קפה DeLonghi Magnifica S',
    query: 'מכונת קפה DeLonghi',
    supplierId: 'payngo',
    // Pay&Go: 1590 + 0 shipping + 0 tax
    currentPrice: 1590,
    targetPrice: 1600,
    history: buildHistory(60, 1780, 1590, 50),
    createdAt: daysAgo(60),
  },
  {
    id: 'w3',
    productName: 'טלוויזיה LG OLED C3 65"',
    query: 'טלוויזיה LG OLED C3',
    supplierId: 'payngo',
    // Pay&Go: 6290 + 99 shipping + 0 tax
    currentPrice: 6389,
    targetPrice: 5800,
    history: buildHistory(120, 7490, 6389, 180),
    createdAt: daysAgo(120),
  },
];

/** Referenced by the demo alert below so its figures stay tied to the tracked record. */
const LG_TV_WATCH = SEED_WATCHLIST.find((w) => w.id === 'w3')!;

export const SEED_ALERTS: AlertRecord[] = [
  {
    id: 'a1',
    type: 'price_drop',
    title: 'ירידת מחיר מתחת ליעד',
    message: 'מכונת קפה DeLonghi Magnifica S ירדה ל‑1,590 ₪ — מתחת למחיר היעד (1,600 ₪)',
    channels: ['email', 'telegram'],
    status: 'sent',
    createdAt: daysAgo(1),
    productName: 'מכונת קפה DeLonghi Magnifica S',
    supplierName: 'מחסני חשמל Pay&Go',
  },
  {
    id: 'a2',
    type: 'trust_change',
    title: 'ירידה בציון אמינות ספק',
    message: 'ציון האמינות של AliExpress ירד מ‑71 ל‑64 בעקבות עלייה בתלונות על משלוחים',
    channels: ['email'],
    status: 'sent',
    createdAt: daysAgo(3),
    supplierName: 'AliExpress (חנות רשמית)',
  },
  {
    id: 'a3',
    type: 'price_drop',
    title: 'עדכון מחיר כולל',
    // Derived from the watchlist record itself so the demo text can never drift
    // away from the data again. No percentage is quoted: the alert is dated five
    // days ago while the synthetic history has no matching data point, so any
    // figure here would be invented rather than computed.
    message: `${LG_TV_WATCH.productName} — המחיר הכולל המעודכן הוא ${LG_TV_WATCH.currentPrice.toLocaleString('he-IL')} ₪ (כולל משלוח), עדיין מעל מחיר היעד ${LG_TV_WATCH.targetPrice.toLocaleString('he-IL')} ₪`,
    channels: ['webhook'],
    status: 'sent',
    createdAt: daysAgo(5),
    productName: LG_TV_WATCH.productName,
    supplierName: 'מחסני חשמל Pay&Go',
  },
];

export const SEED_ACTIVITY: ActivityEntry[] = [
  { id: 'ac1', type: 'alert', message: 'נשלחה התראת ירידת מחיר: מכונת קפה DeLonghi (אימייל + טלגרם)', createdAt: daysAgo(1) },
  { id: 'ac2', type: 'search', message: 'בוצע חיפוש: "אוזניות Sony WH-1000XM5" — נמצאו 7 הצעות מ‑7 ספקים', createdAt: daysAgo(2) },
  { id: 'ac3', type: 'compare', message: 'הושוו 7 הצעות עבור "אוזניות Sony WH-1000XM5" — KSP דורגה ראשונה בתמורה למחיר', createdAt: daysAgo(2) },
  { id: 'ac4', type: 'supplier_update', message: 'עדכון סטטוס ספק: GadgetDeal4U נחסם אוטומטית (דיווחי הונאה)', createdAt: daysAgo(4) },
  { id: 'ac5', type: 'track', message: 'נוסף מוצר למעקב: טלוויזיה LG OLED C3 65" עם יעד 5,800 ₪', createdAt: daysAgo(5) },
  { id: 'ac6', type: 'settings', message: 'עודכנו משקולות הדירוג: עלות 40%, אמינות 25%, משלוח 15%, אחריות 10%, החזרות 10%', createdAt: daysAgo(7) },
];
