import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, ScanSearch } from 'lucide-react';
import ImagePreview from './ImagePreview';
import {
  imageErrorMessage,
  processImage,
  releasePreview,
  swapProcessedImage,
} from '../../services/imageProcessing';
import type { ProcessedImage } from '../../types';

type Status = 'idle' | 'processing' | 'ready' | 'error';

/**
 * Image intake for the search screen. Everything here is local to the device:
 * the file is decoded, resized and compressed in the browser, and the resulting
 * Blob is held in component state only — never persisted, never uploaded. The
 * recognition step lands in a later task and plugs into the "המשך לזיהוי" button.
 */
export default function ImageSearchInput() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [image, setImage] = useState<ProcessedImage | null>(null);
  const [error, setError] = useState('');

  const albumInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Mirrors `image` so the unmount cleanup can reach the latest value without
  // re-registering the effect on every change.
  const heldImage = useRef<ProcessedImage | null>(null);

  useEffect(() => {
    heldImage.current = image;
  }, [image]);

  useEffect(
    () => () => {
      releasePreview(heldImage.current);
      heldImage.current = null;
    },
    [],
  );

  const replaceImage = useCallback((next: ProcessedImage | null) => {
    setImage((previous) => swapProcessedImage(previous, next));
  }, []);

  const onFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Clearing the value lets the same file be picked twice in a row.
      event.target.value = '';
      if (!file) return;

      setStatus('processing');
      setError('');
      try {
        replaceImage(await processImage(file));
        setStatus('ready');
      } catch (cause) {
        replaceImage(null);
        setError(imageErrorMessage(cause));
        setStatus('error');
      }
    },
    [replaceImage],
  );

  function removeImage() {
    replaceImage(null);
    setError('');
    setStatus('idle');
  }

  function toggle() {
    setOpen((wasOpen) => {
      if (wasOpen) {
        replaceImage(null);
        setError('');
        setStatus('idle');
      }
      return !wasOpen;
    });
  }

  const busy = status === 'processing';

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="btn-ghost"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="image-search-panel"
        aria-label="חיפוש מוצר לפי תמונה"
      >
        <Camera className="h-4 w-4" /> חיפוש לפי תמונה
      </button>

      {open && (
        <section
          id="image-search-panel"
          className="card space-y-4 p-4"
          aria-label="חיפוש מוצר לפי תמונה"
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => albumInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" /> בחר מהאלבום
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" /> צלם מוצר
            </button>
          </div>

          {/*
            Plain file inputs on purpose — getUserMedia would add a permission
            flow and breaks inside an installed iOS PWA. `capture` asks iOS and
            Android to open the rear camera directly.
          */}
          <input
            ref={albumInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="בחירת תמונת מוצר מהאלבום"
            data-testid="album-input"
            onChange={onFileSelected}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label="צילום תמונת מוצר במצלמה"
            data-testid="camera-input"
            onChange={onFileSelected}
          />

          <div aria-live="polite" className="space-y-3">
            {status === 'idle' && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                צלמו מוצר או בחרו תמונה מהאלבום. התמונה מעובדת במכשיר בלבד ואינה נשלחת לשום שרת.
              </p>
            )}

            {busy && (
              <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                מעבד את התמונה…
              </p>
            )}

            {status === 'ready' && image && <ImagePreview image={image} onRemove={removeImage} />}
          </div>

          {status === 'error' && error && (
            <p
              role="alert"
              className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled data-testid="continue-to-recognition">
              <ScanSearch className="h-4 w-4" /> המשך לזיהוי
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              זיהוי המוצר יחובר בשלב הבא
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
