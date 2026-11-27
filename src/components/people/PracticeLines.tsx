import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mic, Square } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useStepParam } from '../../hooks/useStepParam';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';
import { API_URL, authedFetch } from '../../lib/api';
import {
  hasPracticeLines, practiceLinesOpen, practiceSinceLatest,
  PRACTICE_DOINGS, PRACTICE_DRAWN_LIMIT, PRACTICE_SINCE_EARLIEST, PRACTICE_WORDS as W,
  type PracticeDoing, type PracticeLines as Lines, type PracticeLinesResponse, type PracticePatch,
} from '../../lib/practiceLines';
import { Button } from '../shared/Button';

// A person's page says their practice, not a title. The three lines from
// src/lib/practiceLines.ts (every word comes from there), shown to anyone on a
// published page and answered in place by the page's owner: one line at a
// time, one tap or one line each, never a form. Opening a line to answer it
// is a step in the address (?practice=since|drawn|doings).
//
// Closed (PRACTICE_LINES_OPEN), this renders nothing and asks the worker
// nothing.

type LineKey = 'since' | 'drawn' | 'doings';
const LINE_KEYS: LineKey[] = ['since', 'drawn', 'doings'];
const isLineKey = (value: string): value is LineKey => (LINE_KEYS as string[]).includes(value);
const field = 'input-field min-h-tap w-full min-w-0 px-3 py-2 text-ui-14';

function endpoint(slug: string) {
  return `${API_URL}/api/public/people/${encodeURIComponent(slug)}/practice`;
}

export function practiceLinesQueryKey(slug: string, viewer: string | null) {
  return ['person-practice-lines', slug, viewer] as const;
}

/**
 * `tone="page"` sits under the cover of /people/:slug; `tone="profile"` sits
 * on the person's own profile in Your Table, with its own heading.
 */
export function PracticeLines({ slug, tone = 'page' }: { slug: string; tone?: 'page' | 'profile' }) {
  if (!practiceLinesOpen()) return null;
  return <PracticeLinesOpen slug={slug} tone={tone} />;
}

function PracticeLinesOpen({ slug, tone }: { slug: string; tone: 'page' | 'profile' }) {
  const { user, isAuthenticated } = useAuth();
  const viewer = isAuthenticated ? user?.email ?? 'signed-in' : null;
  const queryKey = practiceLinesQueryKey(slug, viewer);
  const queryClient = useQueryClient();
  const [step, setStep] = useStepParam('practice');
  const url = endpoint(slug);
  const practice = useQuery<PracticeLinesResponse | null>({
    queryKey,
    queryFn: async ({ signal }) => {
      if (isAuthenticated) return authedFetch(url, {}, signal);
      const response = await fetch(url, { signal });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Could not load the practice lines.');
      return response.json();
    },
    staleTime: 0,
    retry: false,
  });

  const data = practice.data;
  // An answer without its lines (an error body, say) shows nothing rather than breaking the page.
  if (!data?.lines) return null;
  const { lines, can_edit: canEdit } = data;
  if (!canEdit && !hasPracticeLines(lines)) return null;
  const open = canEdit && isLineKey(step) ? step : null;

  async function save(patch: PracticePatch): Promise<boolean> {
    try {
      const saved = await authedFetch(url, { method: 'PUT', body: JSON.stringify(patch) }) as PracticeLinesResponse;
      queryClient.setQueryData(queryKey, saved);
      return true;
    } catch {
      return false;
    }
  }
  const close = () => setStep(null);
  const unanswered = LINE_KEYS.some(key => !answered(lines, key));

  return (
    <section
      aria-label={tone === 'profile' ? W.profileHeading : W.sectionLabel}
      data-testid="practice-lines"
      className={tone === 'profile' ? 'mt-8 max-w-3xl rounded-md border border-tea-border bg-tea-surface p-4 md:p-5' : 'mt-5'}
    >
      {tone === 'profile' && (
        <>
          <h2 className="text-ui-16 font-medium text-tea-text">{W.profileHeading}</h2>
          <p className="mt-1 text-ui-13 text-tea-text-sec">{W.profileIntro}</p>
        </>
      )}
      <dl className={tone === 'profile' ? 'mt-3' : ''}>
        {LINE_KEYS.map(key => {
          if (open === key) {
            return (
              <div key={key} className="border-b border-tea-border py-3" data-testid={`practice-${key}-answer`}>
                <dt className="text-ui-12 text-tea-text-sec">{W[key].heading}</dt>
                <dd className="mt-2">
                  {key === 'since' && <SinceAnswer lines={lines} onSave={save} onClose={close} />}
                  {key === 'drawn' && <DrawnAnswer lines={lines} onSave={save} onClose={close} />}
                  {key === 'doings' && <DoingsAnswer lines={lines} onSave={save} onClose={close} />}
                </dd>
              </div>
            );
          }
          if (answered(lines, key)) {
            return (
              <div key={key} className="flex flex-wrap items-start justify-between gap-x-3 border-b border-tea-border py-3" data-testid={`practice-${key}`}>
                <div className="min-w-0 flex-1">
                  <dt className="text-ui-12 text-tea-text-sec">{W[key].heading}</dt>
                  <dd className={`mt-0.5 break-words text-ui-15 text-tea-text ${key === 'drawn' ? 'font-body italic' : ''}`}>{shown(lines, key)}</dd>
                </div>
                {canEdit && (
                  <Button variant="quiet" size="sm" className="tap-target" onClick={() => setStep(key)} aria-label={`${W.change}: ${W[key].heading}`}>
                    {W.change}
                  </Button>
                )}
              </div>
            );
          }
          if (!canEdit) return null;
          return (
            <div key={key} className="border-b border-tea-border py-2" data-testid={`practice-${key}-ask`}>
              <dt className="sr-only">{W[key].heading}</dt>
              <dd>
                <Button variant="quiet" size="sm" className="tap-target -ml-2 text-left" onClick={() => setStep(key)}>{W[key].ask}</Button>
              </dd>
            </div>
          );
        })}
      </dl>
      {canEdit && unanswered && !open && <p className="mt-2 text-ui-12 text-tea-text-sec">{W.ownNote}</p>}
    </section>
  );
}

function answered(lines: Lines, key: LineKey): boolean {
  if (key === 'since') return lines.since != null;
  if (key === 'drawn') return Boolean(lines.drawn);
  return lines.doings.length > 0;
}

function shown(lines: Lines, key: LineKey): string {
  if (key === 'since') return String(lines.since);
  if (key === 'drawn') return lines.drawn ?? '';
  return W.doings.shown(lines.doings);
}

interface AnswerProps {
  lines: Lines;
  onSave: (patch: PracticePatch) => Promise<boolean>;
  onClose: () => void;
}

function Actions({ saving, failed, canTakeOff, onTakeOff, onClose }: {
  saving: boolean; failed: boolean; canTakeOff: boolean; onTakeOff: () => void; onClose: () => void;
}) {
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="quiet" size="sm" type="button" onClick={onClose}>{W.cancel}</Button>
          {canTakeOff && <Button variant="quiet" size="sm" type="button" onClick={onTakeOff} disabled={saving}>{W.takeOff}</Button>}
        </div>
        <Button variant="primary" size="sm" type="submit" loading={saving}>{W.save}</Button>
      </div>
      {failed && <p role="alert" className="mt-2 text-ui-12 text-tea-text-sec">{W.failed}</p>}
    </>
  );
}

function useSaving(onSave: AnswerProps['onSave'], onClose: () => void) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  async function run(patch: PracticePatch) {
    setSaving(true);
    setFailed(false);
    const ok = await onSave(patch);
    setSaving(false);
    if (ok) onClose();
    else setFailed(true);
  }
  return { saving, failed, run };
}

function SinceAnswer({ lines, onSave, onClose }: AnswerProps) {
  const [value, setValue] = useState(lines.since != null ? String(lines.since) : '');
  const { saving, failed, run } = useSaving(onSave, onClose);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run({ since: value.trim() ? Number(value.trim()) : null });
  };
  return (
    <form onSubmit={submit}>
      <input
        className={`${field} max-w-[10rem]`}
        type="number" inputMode="numeric" autoFocus
        min={PRACTICE_SINCE_EARLIEST} max={practiceSinceLatest()} step={1}
        value={value} onChange={event => setValue(event.target.value.slice(0, 4))}
        aria-label={W.since.field}
      />
      <p className="mt-1 text-ui-12 text-tea-text-sec">{W.since.hint}</p>
      <Actions saving={saving} failed={failed} canTakeOff={lines.since != null} onTakeOff={() => void run({ since: null })} onClose={onClose} />
    </form>
  );
}

function DrawnAnswer({ lines, onSave, onClose }: AnswerProps) {
  const [value, setValue] = useState(lines.drawn ?? '');
  const [spokenFailed, setSpokenFailed] = useState(false);
  const { saving, failed, run } = useSaving(onSave, onClose);
  // The site's one transcription path (POST /api/transcribe), as the journal's voice notes use it.
  const voice = useVoiceCapture({
    onTranscribed: text => setValue(current => [current.trim(), text].filter(Boolean).join(' ').slice(0, PRACTICE_DRAWN_LIMIT)),
    onError: () => setSpokenFailed(true),
  });
  const recording = voice.state === 'recording';
  const writing = voice.state === 'transcribing';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run({ drawn: value.trim() || null });
  };
  return (
    <form onSubmit={submit}>
      <input
        className={field}
        type="text" autoFocus maxLength={PRACTICE_DRAWN_LIMIT}
        value={value} onChange={event => setValue(event.target.value)}
        aria-label={W.drawn.field}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary" size="sm" type="button"
          onClick={() => { setSpokenFailed(false); void (recording ? voice.stop() : voice.start()); }}
          disabled={writing}
          icon={recording ? <Square size={12} fill="currentColor" /> : writing ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
        >
          {recording ? W.stop : writing ? W.writing : W.speak}
        </Button>
        <p className="text-ui-12 text-tea-text-sec">{W.drawn.hint}</p>
      </div>
      {spokenFailed && <p role="status" className="mt-1 text-ui-12 text-tea-text-sec">{W.spokenFailed}</p>}
      <Actions saving={saving} failed={failed} canTakeOff={Boolean(lines.drawn)} onTakeOff={() => void run({ drawn: null })} onClose={onClose} />
    </form>
  );
}

function DoingsAnswer({ lines, onSave, onClose }: AnswerProps) {
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<PracticeDoing | null>(null);
  // Each tap is the answer: it saves at once, and tapping again takes it off.
  async function toggle(key: PracticeDoing) {
    const next = lines.doings.includes(key) ? lines.doings.filter(item => item !== key) : [...lines.doings, key];
    setBusy(key);
    setFailed(false);
    const ok = await onSave({ doings: next });
    setBusy(null);
    if (!ok) setFailed(true);
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={W.doings.field}>
        {PRACTICE_DOINGS.map(item => (
          <Button
            key={item.key} variant="chip" type="button"
            aria-pressed={lines.doings.includes(item.key)}
            disabled={busy !== null}
            onClick={() => void toggle(item.key)}
          >
            {item.words}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-ui-12 text-tea-text-sec">{W.doings.hint}</p>
      {failed && <p role="alert" className="mt-2 text-ui-12 text-tea-text-sec">{W.failed}</p>}
      <div className="mt-3 flex justify-end">
        <Button variant="primary" size="sm" type="button" onClick={onClose}>{W.done}</Button>
      </div>
    </div>
  );
}
