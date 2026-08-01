import { useEffect, useState } from 'react';
import { Mail, RotateCcw, Save, Send, Webhook } from 'lucide-react';
import SectionHeader from '../components/ui/SectionHeader';
import { useAppStore } from '../store/useAppStore';
import { DEFAULT_WEIGHTS } from '../services/scoring';
import type { AlertChannelSettings, ScoreWeights } from '../types';

const WEIGHT_FIELDS: Array<{ key: keyof ScoreWeights; label: string; hint: string }> = [
  { key: 'totalCost', label: 'עלות כוללת', hint: 'מחיר + משלוח + מסים' },
  { key: 'trust', label: 'אמינות ספק', hint: 'אימות, ביקורות, ותק ודגלי סיכון' },
  { key: 'delivery', label: 'מהירות משלוח', hint: 'זמן אספקה משוער' },
  { key: 'warranty', label: 'איכות אחריות', hint: 'משך האחריות בחודשים' },
  { key: 'returns', label: 'מדיניות החזרות', hint: 'חלון החזרה ועלותה' },
];

export default function SettingsPage() {
  const weights = useAppStore((s) => s.weights);
  const setWeights = useAppStore((s) => s.setWeights);
  const alertChannels = useAppStore((s) => s.alertChannels);
  const setAlertChannels = useAppStore((s) => s.setAlertChannels);
  const resetDemoData = useAppStore((s) => s.resetDemoData);

  const [draftWeights, setDraftWeights] = useState<ScoreWeights>(weights);
  const [draftChannels, setDraftChannels] = useState<AlertChannelSettings>(alertChannels);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraftWeights(weights), [weights]);
  useEffect(() => setDraftChannels(alertChannels), [alertChannels]);

  const total =
    draftWeights.totalCost +
    draftWeights.trust +
    draftWeights.delivery +
    draftWeights.warranty +
    draftWeights.returns;

  function save() {
    setWeights(draftWeights);
    setAlertChannels(draftChannels);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="הגדרות"
        subtitle="משקולות מנוע הדירוג וערוצי ההתראות"
        actions={
          <>
            <button
              className="btn-ghost"
              onClick={() => {
                setDraftWeights(DEFAULT_WEIGHTS);
              }}
            >
              <RotateCcw className="h-4 w-4" /> ברירת מחדל
            </button>
            <button className="btn-primary" onClick={save} disabled={total !== 100}>
              <Save className="h-4 w-4" /> {saved ? 'נשמר ✓' : 'שמירת הגדרות'}
            </button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Score weights */}
        <div className="card p-5">
          <h2 className="font-semibold">משקולות מנוע הדירוג</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            קובעות איך מחושב ציון התמורה של כל הצעה. הסכום חייב להיות 100%.
          </p>

          <div className="mt-5 space-y-5">
            {WEIGHT_FIELDS.map(({ key, label, hint }) => (
              <div key={key}>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{label}</span>
                    <span className="mr-2 text-xs text-slate-400">{hint}</span>
                  </div>
                  <span className="font-bold text-brand-600 dark:text-brand-300">{draftWeights[key]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={draftWeights[key]}
                  onChange={(e) =>
                    setDraftWeights((w) => ({ ...w, [key]: Number(e.target.value) }))
                  }
                  className="mt-2 w-full accent-brand-600"
                />
              </div>
            ))}
          </div>

          <div
            className={`mt-5 rounded-xl px-4 py-2.5 text-sm font-medium ${
              total === 100
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
            }`}
          >
            סה"כ: {total}% {total !== 100 && '— יש לאזן ל‑100% לפני שמירה'}
          </div>
        </div>

        {/* Alert channels */}
        <div className="card p-5">
          <h2 className="font-semibold">ערוצי התראות</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            לאן לשלוח התראות על ירידת מחיר מתחת ליעד או שינוי בציון אמינות. החיבור בפועל מתבצע דרך מפתחות
            ה‑API בקובץ הסביבה (ראו .env.example).
          </p>

          <div className="mt-5 space-y-4">
            {/* Email */}
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <label className="flex cursor-pointer items-center justify-between">
                <span className="inline-flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4 text-brand-500" /> אימייל
                </span>
                <input
                  type="checkbox"
                  checked={draftChannels.email.enabled}
                  onChange={(e) =>
                    setDraftChannels((c) => ({ ...c, email: { ...c.email, enabled: e.target.checked } }))
                  }
                  className="h-4 w-4 accent-brand-600"
                />
              </label>
              {draftChannels.email.enabled && (
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  enterKeyHint="done"
                  aria-label="כתובת אימייל להתראות"
                  dir="ltr"
                  placeholder="you@example.com"
                  className="input mt-3"
                  value={draftChannels.email.address}
                  onChange={(e) =>
                    setDraftChannels((c) => ({ ...c, email: { ...c.email, address: e.target.value } }))
                  }
                />
              )}
            </div>

            {/* Telegram */}
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <label className="flex cursor-pointer items-center justify-between">
                <span className="inline-flex items-center gap-2 font-medium">
                  <Send className="h-4 w-4 text-brand-500" /> טלגרם
                </span>
                <input
                  type="checkbox"
                  checked={draftChannels.telegram.enabled}
                  onChange={(e) =>
                    setDraftChannels((c) => ({
                      ...c,
                      telegram: { ...c.telegram, enabled: e.target.checked },
                    }))
                  }
                  className="h-4 w-4 accent-brand-600"
                />
              </label>
              {draftChannels.telegram.enabled && (
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  enterKeyHint="done"
                  aria-label="מזהה צ׳אט בטלגרם"
                  dir="ltr"
                  placeholder="Chat ID (למשל 123456789)"
                  className="input mt-3"
                  value={draftChannels.telegram.chatId}
                  onChange={(e) =>
                    setDraftChannels((c) => ({ ...c, telegram: { ...c.telegram, chatId: e.target.value } }))
                  }
                />
              )}
            </div>

            {/* Webhook */}
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <label className="flex cursor-pointer items-center justify-between">
                <span className="inline-flex items-center gap-2 font-medium">
                  <Webhook className="h-4 w-4 text-brand-500" /> Webhook
                </span>
                <input
                  type="checkbox"
                  checked={draftChannels.webhook.enabled}
                  onChange={(e) =>
                    setDraftChannels((c) => ({ ...c, webhook: { ...c.webhook, enabled: e.target.checked } }))
                  }
                  className="h-4 w-4 accent-brand-600"
                />
              </label>
              {draftChannels.webhook.enabled && (
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  enterKeyHint="done"
                  aria-label="כתובת Webhook להתראות"
                  dir="ltr"
                  placeholder="https://example.com/webhooks/price-alerts"
                  className="input mt-3"
                  value={draftChannels.webhook.url}
                  onChange={(e) =>
                    setDraftChannels((c) => ({ ...c, webhook: { ...c.webhook, url: e.target.value } }))
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Demo data reset */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">נתוני דמו</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            איפוס רשימת המעקב, ההתראות, היומן ומאגר הספקים לנתוני ההדגמה המקוריים.
          </p>
        </div>
        <button className="btn-ghost" onClick={resetDemoData}>
          <RotateCcw className="h-4 w-4" /> איפוס נתוני דמו
        </button>
      </div>
    </div>
  );
}
