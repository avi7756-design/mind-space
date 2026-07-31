import { useMemo, useState } from 'react';
import { Bell, BellOff, Mail, Send, Webhook } from 'lucide-react';
import { Link } from 'react-router-dom';
import SectionHeader from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime } from '../services/format';
import type { AlertChannel, AlertType } from '../types';

const TYPE_LABEL: Record<AlertType, { text: string; tone: 'emerald' | 'amber' | 'brand' }> = {
  price_drop: { text: 'ירידת מחיר', tone: 'emerald' },
  trust_change: { text: 'שינוי אמינות', tone: 'amber' },
  back_in_stock: { text: 'חזרה למלאי', tone: 'brand' },
};

const CHANNEL_META: Record<AlertChannel, { label: string; icon: typeof Mail }> = {
  email: { label: 'אימייל', icon: Mail },
  telegram: { label: 'טלגרם', icon: Send },
  webhook: { label: 'Webhook', icon: Webhook },
};

export default function AlertsPage() {
  const alerts = useAppStore((s) => s.alerts);
  const channels = useAppStore((s) => s.alertChannels);
  const [typeFilter, setTypeFilter] = useState<AlertType | 'all'>('all');

  const filtered = useMemo(
    () => (typeFilter === 'all' ? alerts : alerts.filter((a) => a.type === typeFilter)),
    [alerts, typeFilter],
  );

  const activeChannels = (Object.keys(CHANNEL_META) as AlertChannel[]).filter(
    (c) => channels[c].enabled,
  );

  return (
    <div className="space-y-5">
      <SectionHeader
        title="מרכז התראות"
        subtitle="כל ההתראות שנשלחו על ירידות מחיר, שינויי אמינות וחזרה למלאי"
        actions={
          <Link to="/settings" className="btn-ghost">
            הגדרת ערוצים
          </Link>
        }
      />

      {/* Active channels summary */}
      <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="font-medium">ערוצים פעילים:</span>
        {activeChannels.length === 0 && (
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <BellOff className="h-4 w-4" /> אין ערוצים פעילים — התראות יסומנו כממתינות
          </span>
        )}
        {activeChannels.map((c) => {
          const Meta = CHANNEL_META[c];
          return (
            <Badge key={c} tone="brand">
              <Meta.icon className="h-3.5 w-3.5" />
              {Meta.label}
            </Badge>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: 'all', label: 'הכול' },
            { value: 'price_drop', label: 'ירידות מחיר' },
            { value: 'trust_change', label: 'שינויי אמינות' },
            { value: 'back_in_stock', label: 'חזרה למלאי' },
          ] as Array<{ value: AlertType | 'all'; label: string }>
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTypeFilter(value)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              typeFilter === value
                ? 'bg-brand-600 text-white'
                : 'border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="אין התראות"
          description="כשמחיר של מוצר במעקב יירד מתחת ליעד או שציון אמינות של ספק ישתנה — ההתראה תופיע כאן ותישלח בערוצים שהגדרתם."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => {
            const type = TYPE_LABEL[alert.type];
            return (
              <div key={alert.id} className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{alert.title}</span>
                    <Badge tone={type.tone}>{type.text}</Badge>
                    <Badge tone={alert.status === 'sent' ? 'emerald' : alert.status === 'pending' ? 'amber' : 'rose'}>
                      {alert.status === 'sent' ? 'נשלחה' : alert.status === 'pending' ? 'ממתינה' : 'נכשלה'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{alert.message}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>{formatDateTime(alert.createdAt)}</span>
                    {alert.channels.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1.5">
                          {alert.channels.map((c) => {
                            const Meta = CHANNEL_META[c];
                            return (
                              <span key={c} className="inline-flex items-center gap-0.5">
                                <Meta.icon className="h-3 w-3" />
                                {Meta.label}
                              </span>
                            );
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
