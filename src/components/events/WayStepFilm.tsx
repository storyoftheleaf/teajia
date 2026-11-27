// One short film of a step of the way in, beside its photograph
// (WayStepPhoto.tsx). A film is not framed. It is made smaller on the device
// first (src/lib/compressFilm.ts), then held to the size the worker keeps
// (worker/src/wayFilm.ts).
import { useRef, useState } from 'react';
import { Film, Loader2 } from 'lucide-react';
import { compressFilm, FilmTooLong, recordableMp4 } from '../../lib/compressFilm';
import { mediaUrl } from '../../lib/mediaUrl';
import { Button } from '../shared/Button';

const MAX_FILM_BYTES = 25 * 1024 * 1024;
/** The largest film taken in to be made smaller: a minute and a half from a phone. */
const MAX_RAW_FILM_BYTES = 600 * 1024 * 1024;
const TOO_LARGE = 'Keep a film under 25 MB: about ten seconds from a phone.';

export function WayStepFilm({ step, filmUrl, upload, onChange }: {
  /** Step number, from 1, for the words read aloud. */
  step: number;
  filmUrl?: string;
  /** Uploads the film and answers with its address. */
  upload: (file: File) => Promise<string>;
  onChange: (url: string) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'' | 'smaller' | 'upload'>('');
  const [error, setError] = useState<string | null>(null);

  async function picked(file: File | undefined) {
    if (!file) return;
    if (file.size > (recordableMp4() ? MAX_RAW_FILM_BYTES : MAX_FILM_BYTES)) { setError(TOO_LARGE); return; }
    setBusy('smaller');
    setError(null);
    try {
      const film = await compressFilm(file);
      if (film.size > MAX_FILM_BYTES) { setError(TOO_LARGE); return; }
      setBusy('upload');
      onChange(await upload(film));
    } catch (failure) {
      setError(failure instanceof FilmTooLong || (failure instanceof Error && failure.message) ? (failure as Error).message : 'The film did not upload. Try again.');
    } finally {
      setBusy('');
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
        <Button type="button" variant="secondary" size="sm" className="tap-target" disabled={Boolean(busy)}
          onClick={() => picker.current?.click()} aria-label={`${shown ? 'Change' : 'Add'} the film for step ${step}`}
          icon={busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Film size={14} aria-hidden />}>
          {busy === 'smaller' ? 'Making it smaller…' : busy ? 'Uploading…' : shown ? 'Change film' : 'Add a short film'}
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
