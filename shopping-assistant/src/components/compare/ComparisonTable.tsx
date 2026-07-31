import { Crown, ExternalLink, Eye } from 'lucide-react';
import type { ScoredOffer } from '../../types';
import Badge from '../ui/Badge';
import TrustBadge from '../ui/TrustBadge';
import { formatCurrency, formatDeliveryRange } from '../../services/format';

const STOCK_LABEL: Record<ScoredOffer['stock'], { text: string; tone: 'emerald' | 'amber' | 'rose' | 'slate' }> = {
  in_stock: { text: 'במלאי', tone: 'emerald' },
  low_stock: { text: 'מלאי נמוך', tone: 'amber' },
  preorder: { text: 'הזמנה מוקדמת', tone: 'slate' },
  out_of_stock: { text: 'אזל מהמלאי', tone: 'rose' },
};

interface Props {
  offers: ScoredOffer[];
  bestOfferId?: string;
  onTrack?: (offer: ScoredOffer) => void;
}

export default function ComparisonTable({ offers, bestOfferId, onTrack }: Props) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-right text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <th className="px-4 py-3 font-medium">ספק</th>
            <th className="px-4 py-3 font-medium">מחיר בסיס</th>
            <th className="px-4 py-3 font-medium">משלוח</th>
            <th className="px-4 py-3 font-medium">מס משוער</th>
            <th className="px-4 py-3 font-medium">סה"כ לתשלום</th>
            <th className="px-4 py-3 font-medium">אספקה</th>
            <th className="px-4 py-3 font-medium">אחריות</th>
            <th className="px-4 py-3 font-medium">החזרה</th>
            <th className="px-4 py-3 font-medium">מלאי</th>
            <th className="px-4 py-3 font-medium">ציון תמורה</th>
            <th className="px-4 py-3 font-medium">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => {
            const stock = STOCK_LABEL[offer.stock];
            const isBest = offer.id === bestOfferId;
            return (
              <tr
                key={offer.id}
                className={`border-b border-slate-100 last:border-0 dark:border-slate-800/60 ${
                  isBest ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium">
                    {isBest && <Crown className="h-4 w-4 text-amber-500" />}
                    {offer.supplier.name}
                  </div>
                  <div className="mt-1">
                    <TrustBadge supplier={offer.supplier} />
                  </div>
                </td>
                <td className="px-4 py-3">{formatCurrency(offer.basePrice)}</td>
                <td className="px-4 py-3">
                  {offer.shippingCost === 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">חינם</span>
                  ) : (
                    formatCurrency(offer.shippingCost)
                  )}
                </td>
                <td className="px-4 py-3">{offer.taxEstimate === 0 ? '—' : formatCurrency(offer.taxEstimate)}</td>
                <td className="px-4 py-3 font-bold">{formatCurrency(offer.totalCost)}</td>
                <td className="px-4 py-3">{formatDeliveryRange(offer.deliveryDaysMin, offer.deliveryDaysMax)}</td>
                <td className="px-4 py-3">{offer.warrantyMonths} חוד'</td>
                <td className="px-4 py-3">
                  {offer.returnCost === 'none'
                    ? 'ללא'
                    : `${offer.returnDays} ימים${offer.returnCost === 'free' ? ' (חינם)' : ''}`}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={stock.tone}>{stock.text}</Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex min-w-[3rem] justify-center rounded-lg bg-slate-100 px-2 py-1 font-bold dark:bg-slate-800">
                    {offer.valueScore}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost !px-2 !py-1.5"
                      title="מעבר לעמוד המוצר אצל הספק"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    {onTrack && (
                      <button
                        onClick={() => onTrack(offer)}
                        className="btn-ghost !px-2 !py-1.5"
                        title="הוספה למעקב מחירים"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
