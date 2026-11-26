// One step photograph of the way in (Launch 2, slice H8). The one control for
// it, used by the host's editor (src/components/host/WalkthroughEditor.tsx)
// and the shop's event form (VenueGuideSection): the picked photograph opens
// in the shared photo editor first (usePhotoEditor, freeShape), and only the
// framed photograph is uploaded, by the caller's own `upload`.
import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { usePhotoEditor } from '../shared/usePhotoEditor';
import { mediaUrl } from '../../lib/mediaUrl';
import { Button } from '../shared/Button';

export interface WayStepPhotoProps {
  /** Step number, from 1, for the words read aloud. */
  step: number;
  imageUrl?: string;
  /** Uploads the framed photograph and answers with its address. */
  upload: (file: File) => Promise<string>;
  onChange: (url: string) => void;
  /** Shown when an upload fails. Defaults to a line under the control. */
  onError?: (message: string) => void;
  compact?: boolean;
}

export function WayStepPhoto({ step, imageUrl, upload, onChange, onError, compact = false }: WayStepPhotoProps) {
  const picker = useRef<HTMLInputElement>(null);
  const { editPhoto, photoEditor } = usePhotoEditor({ freeShape: true, title: `Photograph for step ${step}`, confirmLabel: 'Use photograph' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function picked(file: File | undefined) {
    if (!file) return;
    const framed = await editPhoto(file);
    if (!framed) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await upload(framed));
    } catch (failure) {
      const message = failure instanceof Error && failure.message ? failure.message : 'The photograph did not upload. Try again.';
      if (onError) onError(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  }

  const shown = mediaUrl(imageUrl);
  return (
    <div className="space-y-2" data-way-step-photo={step}>
      {shown && (
        <div className={`overflow-hidden rounded-md border border-tea-border bg-tea-surface ${compact ? 'h-24' : 'aspect-[4/3]'}`}>
          <img src={shown} alt={`Step ${step}`} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" className="tap-target" disabled={busy}
          onClick={() => picker.current?.click()} aria-label={`${shown ? 'Change' : 'Add'} the photograph for step ${step}`}
          icon={busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <ImagePlus size={14} aria-hidden />}>
          {busy ? 'Uploading…' : shown ? 'Change photograph' : 'Add a photograph'}
        </Button>
        {shown && !busy && (
          <Button type="button" variant="quiet" size="sm" className="tap-target" onClick={() => onChange('')}
            aria-label={`Take out the photograph for step ${step}`}>
            Take out
          </Button>
        )}
      </div>
      {error && <p className="type-small text-tea-text-sec" role="alert">{error}</p>}
      {/* Picked here, framed in the shared editor, uploaded only after. */}
      <input ref={picker} type="file" accept="image/*" hidden data-testid={`way-step-photo-picker-${step}`}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void picked(file); }} />
      {photoEditor}
    </div>
  );
}
