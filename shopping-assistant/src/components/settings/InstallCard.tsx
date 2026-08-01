import { useState } from 'react';
import { CheckCircle2, Download, Share } from 'lucide-react';
import { useInstallPrompt } from '../../pwa/install';

/**
 * Install affordance, deliberately parked in Settings rather than surfaced as
 * a pop-up. The button appears only once the browser has actually offered
 * installation; iOS gets instructions because it never makes that offer.
 */
export default function InstallCard() {
  const { state, install } = useInstallPrompt();
  const [result, setResult] = useState<string>('');

  async function onInstall() {
    const outcome = await install();
    if (outcome === 'dismissed') setResult('ההתקנה בוטלה — אפשר לנסות שוב בכל עת');
  }

  if (state === 'unavailable') return null;

  return (
    <div className="card p-5" data-testid="install-card">
      <h2 className="font-semibold">התקנת האפליקציה</h2>

      {state === 'installed' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span data-testid="install-status-installed">
            האפליקציה מותקנת ופועלת ממסך הבית
          </span>
        </div>
      )}

      {state === 'available' && (
        <>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            התקינו את האפליקציה כדי לפתוח אותה ישירות ממסך הבית, גם ללא חיבור לאינטרנט.
          </p>
          <button
            type="button"
            onClick={onInstall}
            className="btn-primary mt-4"
            data-testid="install-button"
          >
            <Download className="h-4 w-4" />
            התקנת האפליקציה
          </button>
          {result && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{result}</p>}
        </>
      )}

      {state === 'ios-manual' && (
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400" data-testid="install-ios">
          <p>באייפון ובאייפד ההתקנה מתבצעת ידנית דרך Safari:</p>
          {/* list-inside keeps the marker in the text flow; a flex <li> would
              detach it and the first step would render unnumbered. */}
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>
              לחצו על כפתור השיתוף
              <Share className="mx-1 inline h-4 w-4 align-text-bottom" aria-hidden />
              בסרגל התחתון
            </li>
            <li>בחרו „הוסף למסך הבית”</li>
            <li>אשרו את השם ולחצו „הוסף”</li>
          </ol>
        </div>
      )}
    </div>
  );
}
