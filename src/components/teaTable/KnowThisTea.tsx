import { useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ImagePlus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useAuth } from '../../hooks/useAuth';
import { authPagePath } from '../../lib/authNavigation';
import { mediaUrl } from '../../lib/mediaUrl';
import { KNOW_THIS_TEA_HEADING, KNOW_THIS_TEA_LIMITS } from '../../lib/knowThisTea';
import { knowThisTeaApi } from '../../lib/knowThisTeaApi';
import type { KnowThisTeaNote, TeaTableQuestion } from '../../lib/knowThisTeaContract';
import { TEA_TABLE_MINE_KEY, useTeaTableMine } from '../../lib/teaTableApi';
import { Button } from '../shared/Button';
import { PhotographThumb, PhotographZoom, type ZoomPhotograph } from '../shared/Photographs';
import { usePhotoEditor } from '../shared/usePhotoEditor';
import { looksLikePhoto } from '../vendors/facePhotoFile';
import { TeaCard, TeaCardMeta, TeaCardTitle } from '../tea/TeaCard';

// "Does anyone know this tea?" on the Tea Table (Launch 5, M8; the switch is
// src/lib/knowThisTea.ts). A question sits in the table's time order like any
// piece. Whoever knows the tea tells the asker privately on the question's
// own page; the asker reads it there and nobody else does. Nothing on any of
// this counts, ranks or sends. There is no public reply.

const quietLink = 'tap-target text-tea-text underline decoration-tea-border underline-offset-4 hover:text-tea-gold-lt';
const fieldClass = 'input-field mt-1 min-h-tap w-full px-3 py-2 text-ui-16';
const questionKey = ['tea-table', 'question'] as const;

const errorText = (cause: unknown, fallback: string) => (cause instanceof Error && cause.message ? cause.message : fallback);

function toZoom(item: TeaTableQuestion): ZoomPhotograph {
  const photo = item.photograph;
  return {
    id: photo.id, smallSrc: mediaUrl(photo.small_url), fullSrc: mediaUrl(photo.full_url),
    width: photo.small_width, height: photo.small_height, shape: photo.shape, frame: photo.frame,
    alt: `A tea ${item.person.name} cannot name`,
  };
}

function QuestionPhotograph({ item }: { item: TeaTableQuestion }) {
  const [open, setOpen] = useState(false);
  const photo = toZoom(item);
  return (
    <>
      <div className="px-3 pt-3" data-testid="know-this-tea-photograph">
        <PhotographThumb photo={photo} size="page" onOpen={() => setOpen(true)} />
      </div>
      <PhotographZoom photo={open ? photo : null} onClose={() => setOpen(false)}>
        Photograph by {item.person.name}
      </PhotographZoom>
    </>
  );
}

/** The asker's own way off the table. The photograph goes with it, and what people wrote can no longer be read. */
function TakeOffQuestion({ item, onGone }: { item: TeaTableQuestion; onGone?: () => void }) {
  const client = useQueryClient();
  const takeOff = useMutation({
    mutationFn: () => knowThisTeaApi.takeOff(item.id),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['tea-table', 'page'] }),
        client.invalidateQueries({ queryKey: TEA_TABLE_MINE_KEY }),
        client.invalidateQueries({ queryKey: questionKey }),
      ]);
      onGone?.();
    },
  });
  return (
    <Button variant="quiet" size="sm" type="button" className="tap-target" disabled={takeOff.isPending}
      onClick={() => takeOff.mutate()} data-testid="know-this-tea-take-off">
      Take off the table
    </Button>
  );
}

/** One question as a piece on the table. `onOpen` is absent on its own page. */
export function QuestionPiece({ item, mine, onOpen, onGone }: {
  item: TeaTableQuestion; mine: boolean; onOpen?: () => void; onGone?: () => void;
}) {
  const openWords = mine ? 'What people told you' : item.named ? null : 'I know this tea';
  return (
    <TeaCard testId="tea-table-question"
      title={<TeaCardTitle as="h3"><span className="min-w-0 break-words">{KNOW_THIS_TEA_HEADING}</span></TeaCardTitle>}
      meta={<TeaCardMeta primary={<>Asked by {item.person.path
        ? <Link to={item.person.path} className={quietLink}>{item.person.name}</Link>
        : item.person.name}</>} />}
      actions={<div className="flex flex-wrap items-center gap-2">
        {onOpen && openWords && (
          <Button variant="secondary" size="sm" type="button" className="tap-target" onClick={onOpen} data-testid="know-this-tea-open">
            {openWords}
          </Button>
        )}
        {mine && <TakeOffQuestion item={item} onGone={onGone} />}
      </div>}>
      <QuestionPhotograph item={item} />
      <div className="space-y-2 px-3 py-3">
        <p className="whitespace-pre-line break-words font-body text-ui-15 leading-[1.65] text-tea-text" data-testid="know-this-tea-where">{item.where_from}</p>
        {item.named && (
          <p className="break-words text-ui-14 text-tea-text" data-testid="know-this-tea-named">
            Named: {item.named.path ? <Link to={item.named.path} className={quietLink}>{item.named.name}</Link> : item.named.name}
            {item.named.by && <span className="text-tea-text-sec"> · Named by {item.named.by}</span>}
          </p>
        )}
      </div>
    </TeaCard>
  );
}

/** "Ask about a tea": the way in from the table. Signed out, it leads to sign in and back. */
export function AskAboutATea({ onAsk }: { onAsk: () => void }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return (
      <Link to={authPagePath('signin', `${location.pathname}?ask=1`)} className="btn-secondary btn-sm tap-target" data-testid="know-this-tea-ask">
        Ask about a tea
      </Link>
    );
  }
  return (
    <Button variant="secondary" size="sm" type="button" className="tap-target" icon={<ImagePlus size={16} aria-hidden="true" />}
      onClick={onAsk} data-testid="know-this-tea-ask">
      Ask about a tea
    </Button>
  );
}

/** The asking step: one photograph through the shared photo editor, and where the tea came from. */
export function AskForm({ onCancel, onAsked }: { onCancel: () => void; onAsked: (question: TeaTableQuestion) => void }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const client = useQueryClient();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [whereFrom, setWhereFrom] = useState('');
  const [framing, setFraming] = useState(false);
  const [error, setError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const { editPhoto, photoEditor } = usePhotoEditor({ freeShape: true, title: 'Frame the tea', confirmLabel: 'Use photo' });
  const ask = useMutation({
    mutationFn: () => knowThisTeaApi.ask(photo!, whereFrom.trim()),
    onSuccess: async ({ question }) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['tea-table', 'page'] }),
        client.invalidateQueries({ queryKey: TEA_TABLE_MINE_KEY }),
      ]);
      onAsked(question);
    },
    onError: cause => setError(errorText(cause, 'Could not put it on the table. Try again.')),
  });

  if (!isAuthenticated) {
    return (
      <section className="mt-6" data-testid="know-this-tea-ask-form">
        <h2 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>{KNOW_THIS_TEA_HEADING}</h2>
        <p className={`${TYPOGRAPHY_CLASSES.body} mt-2 text-tea-text-sec`}>
          <Link to={authPagePath('signin', `${location.pathname}${location.search}`)} className={quietLink}>Sign in</Link> to ask about a tea.
        </p>
      </section>
    );
  }

  async function frame(source: File | Blob) {
    setError('');
    if (source instanceof File && !looksLikePhoto(source)) { setError('Choose an image file.'); return; }
    setFraming(true);
    try {
      const file = await editPhoto(source);
      if (!file) return;
      setPhoto(file);
      setPreview(current => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(file); });
    } catch {
      setError('Could not open that photo. Choose another file.');
    } finally {
      setFraming(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!photo) { setError('Add a photograph of the tea.'); return; }
    if (!whereFrom.trim()) { setError('Say where you got the tea.'); return; }
    ask.mutate();
  }

  const busy = framing || ask.isPending;
  return (
    <section className="mt-6" aria-labelledby="know-this-tea-ask-heading" data-testid="know-this-tea-ask-form">
      <h2 id="know-this-tea-ask-heading" className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>{KNOW_THIS_TEA_HEADING}</h2>
      <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 text-tea-text-sec`}>
        Put a photograph of a tea you cannot name on the table, and say where you got it. Anyone who knows it can tell you. Only you will read what they write.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {preview && <img src={preview} alt="The tea you are asking about" className="h-24 w-24 rounded-md border border-tea-border object-cover" data-testid="know-this-tea-preview" />}
          <Button type="button" variant="secondary" className="tap-target" disabled={busy}
            icon={<ImagePlus size={16} aria-hidden="true" />} onClick={() => picker.current?.click()} data-testid="know-this-tea-add-photo">
            {photo ? 'Change photo' : 'Add photo'}
          </Button>
          {photo && (
            <Button type="button" variant="quiet" size="sm" className="tap-target" disabled={busy} onClick={() => void frame(photo)}>
              Reframe
            </Button>
          )}
        </div>
        <input ref={picker} type="file" accept="image/*,.heic,.heif" hidden data-testid="know-this-tea-file"
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void frame(file);
          }} />
        <label className="block text-ui-14 text-tea-text-sec">
          Where you got it
          <textarea className={`${fieldClass} resize-y`} rows={3} maxLength={KNOW_THIS_TEA_LIMITS.whereFrom} value={whereFrom}
            onChange={event => setWhereFrom(event.target.value)} disabled={busy} data-testid="know-this-tea-where-from" />
        </label>
        {error && <p role="alert" className="text-ui-13 text-tea-text-sec">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="quiet" className="tap-target" onClick={onCancel} disabled={ask.isPending}>Cancel</Button>
          <Button type="submit" variant="primary" className="tap-target" loading={ask.isPending} disabled={busy} data-testid="know-this-tea-put">
            Put it on the table
          </Button>
        </div>
      </form>
      {photoEditor}
    </section>
  );
}

/** Someone who knows the tea tells the asker. It goes to the asker alone. */
function TellForm({ item }: { item: TeaTableQuestion }) {
  const [words, setWords] = useState('');
  const [tea, setTea] = useState('');
  const [nameShown, setNameShown] = useState(false);
  const [error, setError] = useState('');
  const tell = useMutation({
    mutationFn: () => knowThisTeaApi.tell(item.id, { words: words.trim(), tea: tea.trim() || undefined, name_shown: nameShown }),
    onError: cause => setError(errorText(cause, 'That did not go through. Try again.')),
  });
  if (tell.isSuccess) {
    return (
      <p role="status" className={`${TYPOGRAPHY_CLASSES.body} mt-6 text-tea-text-sec`} data-testid="know-this-tea-told">
        Thank you. {item.person.name} will read it on their question. Nobody else will.
      </p>
    );
  }
  return (
    <section className="mt-6" aria-labelledby="know-this-tea-tell-heading" data-testid="know-this-tea-tell">
      <h2 id="know-this-tea-tell-heading" className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Tell {item.person.name} what it is</h2>
      <p className="mt-1 text-ui-13 text-tea-text-sec">Only {item.person.name} will read this. It is not shown on the table.</p>
      <form className="mt-3 space-y-4" onSubmit={event => {
        event.preventDefault();
        setError('');
        if (!words.trim()) { setError('Say what you know about the tea.'); return; }
        tell.mutate();
      }}>
        <label className="block text-ui-14 text-tea-text-sec">
          What you know about it
          <textarea className={`${fieldClass} resize-y`} rows={4} maxLength={KNOW_THIS_TEA_LIMITS.words} value={words}
            onChange={event => setWords(event.target.value)} disabled={tell.isPending} data-testid="know-this-tea-words" />
        </label>
        <label className="block text-ui-14 text-tea-text-sec">
          Link to the tea in the shop, if it is there
          <input className={fieldClass} type="text" inputMode="url" value={tea} onChange={event => setTea(event.target.value)}
            disabled={tell.isPending} data-testid="know-this-tea-tea-link" />
        </label>
        <label className="tap-target flex items-center gap-3 text-ui-13 text-tea-text-sec">
          <input type="checkbox" className="h-4 w-4 accent-tea-gold" checked={nameShown} onChange={event => setNameShown(event.target.checked)}
            disabled={tell.isPending} data-testid="know-this-tea-name-shown" />
          If {item.person.name} thanks me, my first name may show on the question
        </label>
        {error && <p role="alert" className="text-ui-13 text-tea-text-sec">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="submit" variant="primary" className="tap-target" loading={tell.isPending} data-testid="know-this-tea-send">
            Tell {item.person.name}
          </Button>
        </div>
      </form>
    </section>
  );
}

function NoteRow({ item, note, onUse }: { item: TeaTableQuestion; note: KnowThisTeaNote; onUse: (note: KnowThisTeaNote) => void }) {
  const client = useQueryClient();
  const [error, setError] = useState('');
  const thank = useMutation({
    mutationFn: (on: boolean) => knowThisTeaApi.thank(item.id, on ? note.id : null),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: questionKey }),
      client.invalidateQueries({ queryKey: ['tea-table', 'page'] }),
    ]),
    onError: cause => setError(errorText(cause, 'Could not change that.')),
  });
  return (
    <li className="border-b border-tea-border py-3 last:border-b-0" data-testid="know-this-tea-note">
      <p className="text-ui-12 font-medium text-tea-text-sec">{note.by}</p>
      <p className="mt-1 whitespace-pre-line break-words font-body text-ui-15 leading-[1.65] text-tea-text">{note.words}</p>
      {note.tea && <p className="mt-1 text-ui-13 text-tea-text">In the shop: <Link to={note.tea.path} className={quietLink}>{note.tea.name}</Link></p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!item.named && (
          <Button variant="quiet" size="sm" type="button" className="tap-target" onClick={() => onUse(note)}>That is it</Button>
        )}
        {item.named && note.name_shown && (note.thanked
          ? <>
            <span className="text-ui-13 text-tea-text-sec">You thanked {note.by}. Their first name shows on the question.</span>
            <Button variant="quiet" size="sm" type="button" className="tap-target" disabled={thank.isPending} onClick={() => thank.mutate(false)}>
              Take the thanks back
            </Button>
          </>
          : <Button variant="secondary" size="sm" type="button" className="tap-target" disabled={thank.isPending}
            onClick={() => thank.mutate(true)} data-testid="know-this-tea-thank">
            Thank {note.by}
          </Button>)}
        {item.named && !note.name_shown && <span className="text-ui-12 text-tea-text-dim">{note.by} asked for their name not to show.</span>}
      </div>
      {error && <p role="alert" className="mt-1 text-ui-12 text-tea-text-sec">{error}</p>}
    </li>
  );
}

/** The asker's side of their own question: what people told them, naming it, and the thanks. */
function AskerPanel({ item }: { item: TeaTableQuestion }) {
  const client = useQueryClient();
  const asked = useQuery({ queryKey: [...questionKey, item.id, 'asked'], queryFn: () => knowThisTeaApi.asked(item.id), staleTime: 0, retry: false });
  const [teaName, setTeaName] = useState('');
  const [tea, setTea] = useState('');
  const [error, setError] = useState('');
  const settled = () => Promise.all([
    client.invalidateQueries({ queryKey: questionKey }),
    client.invalidateQueries({ queryKey: ['tea-table', 'page'] }),
  ]);
  const name = useMutation({
    mutationFn: () => knowThisTeaApi.name(item.id, { name: teaName.trim() || undefined, tea: tea.trim() || undefined }),
    onSuccess: settled,
    onError: cause => setError(errorText(cause, 'Could not mark it named.')),
  });
  const unname = useMutation({ mutationFn: () => knowThisTeaApi.unname(item.id), onSuccess: settled });
  const notes = asked.data?.notes ?? [];
  return (
    <section className="mt-6 space-y-6" data-testid="know-this-tea-asker">
      <div>
        <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>What people told you</h2>
        <p className="mt-1 text-ui-13 text-tea-text-sec">Only you see this.</p>
        {asked.isPending && <p role="status" className="mt-3 text-ui-14 text-tea-text-sec">Opening…</p>}
        {asked.isError && <p role="alert" className="mt-3 text-ui-14 text-tea-text-sec">Could not open what people told you.</p>}
        {asked.isSuccess && (notes.length
          ? <ul className="mt-2">{notes.map(note => <NoteRow key={note.id} item={item} note={note}
            onUse={chosen => { setTea(chosen.tea?.path ?? ''); setTeaName(chosen.tea?.name ?? ''); }} />)}</ul>
          : <p className="mt-3 text-ui-14 text-tea-text-sec" data-testid="know-this-tea-nothing-yet">Nothing yet. What people write will be here, for you alone.</p>)}
      </div>
      {item.named ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="quiet" size="sm" type="button" className="tap-target" disabled={unname.isPending} onClick={() => unname.mutate()}>
            Not named after all
          </Button>
        </div>
      ) : (
        <form className="space-y-4" data-testid="know-this-tea-name-form" onSubmit={event => {
          event.preventDefault();
          setError('');
          if (!teaName.trim() && !tea.trim()) { setError('Say what the tea is.'); return; }
          name.mutate();
        }}>
          <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Do you know it now?</h2>
          <label className="block text-ui-14 text-tea-text-sec">
            What the tea is
            <input className={fieldClass} value={teaName} maxLength={KNOW_THIS_TEA_LIMITS.teaName} onChange={event => setTeaName(event.target.value)}
              disabled={name.isPending} data-testid="know-this-tea-name" />
          </label>
          <label className="block text-ui-14 text-tea-text-sec">
            Link to the tea in the shop, if it is there
            <input className={fieldClass} type="text" inputMode="url" value={tea} onChange={event => setTea(event.target.value)}
              disabled={name.isPending} data-testid="know-this-tea-name-link" />
          </label>
          {error && <p role="alert" className="text-ui-13 text-tea-text-sec">{error}</p>}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="submit" variant="primary" className="tap-target" loading={name.isPending} data-testid="know-this-tea-mark-named">Mark it named</Button>
          </div>
        </form>
      )}
    </section>
  );
}

/** A question's own page: a step on the Tea Table (?question=<id>). */
export function QuestionPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const question = useQuery({
    queryKey: [...questionKey, id],
    queryFn: ({ signal }) => knowThisTeaApi.one(id, signal),
    staleTime: 0,
    retry: false,
  });
  const mineQuery = useTeaTableMine();
  const item = question.data?.question;
  const mine = Boolean(item && mineQuery.data?.mine.includes(`question:${item.id}`));
  return (
    <div data-testid="know-this-tea-page">
      <Button variant="quiet" size="sm" type="button" className="tap-target mt-4" icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={onBack}>
        The Tea Table
      </Button>
      {question.isPending && <p role="status" className="mt-8 text-ui-14 text-tea-text-sec">Opening the question…</p>}
      {question.isError && (
        <p className={`${TYPOGRAPHY_CLASSES.body} mt-8 text-tea-text-sec`} data-testid="know-this-tea-gone">This question is no longer on the table.</p>
      )}
      {item && (
        <div className="mt-4">
          <QuestionPiece item={item} mine={mine} onGone={onBack} />
          {mine && <AskerPanel item={item} />}
          {!mine && !item.named && (isAuthenticated
            ? (mineQuery.isFetched ? <TellForm item={item} /> : null)
            : (
              <p className={`${TYPOGRAPHY_CLASSES.body} mt-6 text-tea-text-sec`}>
                <Link to={authPagePath('signin', `${location.pathname}${location.search}`)} className={quietLink}>Sign in</Link> to tell {item.person.name} what it is.
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

