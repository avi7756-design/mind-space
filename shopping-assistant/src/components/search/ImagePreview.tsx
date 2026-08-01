import { Trash2 } from 'lucide-react';
import type { ProcessedImage } from '../../types';

interface Props {
  image: ProcessedImage;
  onRemove: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImagePreview({ image, onRemove }: Props) {
  const savedPct =
    image.originalSize > 0
      ? Math.max(0, Math.round((1 - image.processedSize / image.originalSize) * 100))
      : 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row" data-testid="image-preview">
      <img
        src={image.previewUrl}
        alt={`תצוגה מקדימה של התמונה שנבחרה: ${image.originalFileName}`}
        className="h-40 w-full rounded-xl border border-slate-200 object-contain sm:h-32 sm:w-32 dark:border-slate-700"
      />

      <div className="flex flex-1 flex-col gap-2 text-sm">
        <div className="truncate font-medium" title={image.originalFileName}>
          {image.originalFileName}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-500 dark:text-slate-400">
          <dt>מימדים</dt>
          <dd className="text-slate-700 dark:text-slate-200" data-testid="image-dimensions">
            {image.width}×{image.height}
          </dd>
          <dt>גודל מקורי</dt>
          <dd className="text-slate-700 dark:text-slate-200">{formatBytes(image.originalSize)}</dd>
          <dt>לאחר דחיסה</dt>
          <dd className="text-slate-700 dark:text-slate-200" data-testid="image-processed-size">
            {formatBytes(image.processedSize)}
          </dd>
          {savedPct > 0 && (
            <>
              <dt>חיסכון בנפח</dt>
              <dd className="text-emerald-600 dark:text-emerald-400">{savedPct}%</dd>
            </>
          )}
        </dl>

        <div>
          <button type="button" className="btn-ghost" onClick={onRemove} aria-label="הסר את התמונה שנבחרה">
            <Trash2 className="h-4 w-4" /> הסר תמונה
          </button>
        </div>
      </div>
    </div>
  );
}
