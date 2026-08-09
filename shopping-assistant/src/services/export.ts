import type { ScoredOffer } from '../types';
import { formatDeliveryRange } from './format';

function downloadBlob(content: string, filename: string, mime: string) {
  // BOM so Excel opens Hebrew UTF-8 CSVs correctly
  const blob = new Blob(['﻿' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportComparisonCsv(offers: ScoredOffer[], query: string) {
  const header = [
    'מוצר',
    'ספק',
    'מחיר בסיס',
    'משלוח',
    'מס משוער',
    'סה"כ',
    'זמן אספקה',
    'אחריות (חודשים)',
    'ימי החזרה',
    'ציון אמינות',
    'ציון תמורה',
    'קישור',
  ];
  const rows = offers.map((o) => [
    o.productName,
    o.supplier.name,
    o.basePrice,
    o.shippingCost,
    o.taxEstimate,
    o.totalCost,
    formatDeliveryRange(o.deliveryDaysMin, o.deliveryDaysMax),
    o.warrantyMonths,
    o.returnDays,
    o.supplier.trustScore,
    o.valueScore,
    o.url,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  downloadBlob(csv, `comparison-${query.slice(0, 30)}.csv`, 'text/csv;charset=utf-8');
}

/**
 * PDF export placeholder — will be implemented with a proper PDF renderer
 * (or a backend endpoint) in a future iteration.
 */
export function exportComparisonPdf(): { ok: false; reason: string } {
  return { ok: false, reason: 'ייצוא PDF יתווסף בגרסה הבאה — בינתיים ניתן לייצא CSV' };
}
