// One short film of a step of the way in, beside its photograph
// (WayStepPhoto.tsx). A film is not framed: it goes up as it was taken, held
// to the size the worker keeps (worker/src/wayFilm.ts).
import { useRef, useState } from 'react';
import { Film, Loader2 } from 'lucide-react';
import { mediaUrl } from '../../lib/mediaUrl';
import { Button } from '../shared/Button';

const MAX_FILM_BYTES = 25 * 1024 * 1024;

export function WayStepFilm({ step, filmUrl, upload, onChange }: {
  /** Step number, from 1, for the words read aloud. */
  step: number;
  filmUrl?: string;
  /** Uploads the film and answers with its address. */
  upload: (file: File) => Promise<string>;
  onChange: (url: string) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function picked(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILM_BYTES) { setError('Keep a film under 25 MB: about ten seconds from a phone.'); return; }
    setBusy(true);
    setError(null);
    try {
      onChange(await upload(file));
    } catch (failure) {
      setError(failure instanceof Error && failure.message ? failure.message : 'The film did not upload. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const shown = mediaUrl(filmUrl);
  return (
    <div className="space-y-2" data-way-step-film={step}>
      {shown && (
        <video src={shown} muted loop playsInline controls preload="metadata"
          className="aspect-[4/3] w-full rounded-md border border-tea-border bg-tea-surface object-cover" aria-label={`Film for step ${step}`} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" className="tap-target" disabled={busy}
          onClick={() => picker.current?.click()} aria-label={`${shown ? 'Change' : 'Add'} the film for step ${step}`}
          icon={busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Film size={14} aria-hidden />}>
          {busy ? 'Uploading…' : shown ? 'Change film' : 'Add a short film'}
        </Button>
        {shown && !busy && (
          <Button type="button" variant="quiet" size="sm" className="tap-target" onClick={() => onChange('')}
            aria-label={`Take out the film for step ${step}`}>
            Take out
          </Button>
        )}
      </div>
      {error && <p className="type-small text-tea-text-sec" role="alert">{error}</p>}
      <input ref={picker} type="file" accept="video/mp4,video/quicktime,video/webm" hidden data-testid={`way-step-film-picker-${step}`}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void picked(file); }} />
    </div>
  );
}
