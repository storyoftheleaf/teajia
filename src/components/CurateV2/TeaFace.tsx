import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Coffee, FileText, Loader2, Mic, Square } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useNotesStore } from '../../lib/notesStore';
import { useRates, useShopFreightDefault } from '../../admin/hooks/useAdminData';
import { curateShelfPreview } from './curatePricing';
import { quotedUnit, tastingLine } from './curateV2Model';
import { CURRENCY_LABELS } from './PricingRow';
import { DEFAULT_GRAMS } from './types';
import type { TeaCompassEntry } from './types';

interface TeaFaceProps {
  entryId: string;
  /** Opens the full capture card with every field. */
  onEdit: () => void;
  /** Back to the table rows, or wherever the tea was opened from. */
  onBack?: () => void;
  onTaste: (entryId: string) => void;
  onFullTasting: (entryId: string) => void;
  canTalk: boolean;
  onTalk: (entryId: string) => void;
  talking: boolean;
  voiceState: string;
  /** Opens the order part of the full card. */
  onBuy?: (entryId: string) => void;
  /** Opens what was said, filed part by part. */
  onOpenSaid?: (entryId: string) => void;
  /** Saves a tea still being captured; absent once it is saved. */
  onDone?: () => void;
}

const fmtPerGram = (v: number) => (v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : Math.round(v).toString());

/** "Sheng · 2019": what kind of tea, and when. */
export function kindLine(e: Pick<TeaCompassEntry, 'type' | 'year'>): string {
  return [e.type, e.year].filter((x) => x != null && String(x).trim()).join(' · ');
}

/** "Yiwu, Yunnan": where it is from. */
export function placeLine(e: Pick<TeaCompassEntry, 'originRegion' | 'originCountry'>): string {
  return [e.originRegion, e.originCountry].filter((x) => x && String(x).trim()).join(', ');
}

/** The weight a quoted price is for: as entered, or a cake's usual 357 g. */
export function quotedGrams(e: Pick<TeaCompassEntry, 'pricePerUnitGrams' | 'form'>): { grams: number; assumed: boolean } | null {
  if (e.pricePerUnitGrams) return { grams: e.pricePerUnitGrams, assumed: false };
  const usual = e.form ? DEFAULT_GRAMS[e.form] : undefined;
  return usual && ['Cake', 'Brick', 'Tuo'].includes(String(e.form)) ? { grams: usual, assumed: true } : null;
}

const Row: React.FC<{ label: string; children: React.ReactNode; onClick?: () => void; testId?: string }> = ({ label, children, onClick, testId }) => {
  const body = (
    <>
      <span className="curate-v2-label shrink-0">{label}</span>
      <span className="flex min-w-0 flex-1 items-baseline justify-end gap-1.5 truncate text-right text-ui-14 text-tea-text">{children}</span>
    </>
  );
  const cls = 'flex min-h-11 w-full items-center gap-3 border-b border-tea-border px-4 text-left';
  return onClick
    ? <button type="button" onClick={onClick} data-testid={testId} className={cls}>{body}</button>
    : <div data-testid={testId} className={cls}>{body}</div>;
};

const add = <span className="text-ui-13 text-tea-text-dim">add</span>;

type Choice = 'pass' | 'sample' | 'buy';

/**
 * One tea, as drawn: a photo leads when there is one, otherwise the name.
 * The facts follow one line each; a blank one says "add". Taste, Talk and Note
 * sit together, then Pass · Sample · Buy, and what was said is folded at the
 * bottom. Every other field is in the full card behind "Edit all fields".
 */
export const TeaFace: React.FC<TeaFaceProps> = ({ entryId, onEdit, onBack, onTaste, onFullTasting, canTalk, onTalk, talking, voiceState, onBuy, onOpenSaid, onDone }) => {
  const entry = useTeaCompassStore((s) => s.pendingEntries.find((e) => e.id === entryId) ?? s.entries.find((e) => e.id === entryId));
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const allNotes = useNotesStore((s) => s.notes);
  const { data: rates } = useRates();
  const shopFreight = useShopFreightDefault();
  const [noteOpen, setNoteOpen] = useState(false);
  const [saidOpen, setSaidOpen] = useState(false);

  const said = useMemo(() => {
    if (!entry) return [];
    const fromNotes = allNotes
      .filter((n) => n.compassEntryId === entry.id && !n.deleted && n.text?.trim() && n.sourceType === 'voice')
      .map((n) => ({ key: n.id, text: n.text.trim(), at: n.createdAt }));
    const fromClips = (entry.audioClips ?? [])
      .filter((c) => c.transcript?.trim())
      .map((c, i) => ({ key: `clip-${i}`, text: c.transcript!.trim(), at: c.timestamp }));
    return [...fromNotes, ...fromClips].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  }, [allNotes, entry]);

  if (!entry) return null;

  const isTeaware = entry.category === 'teaware';
  const sym = CURRENCY_LABELS[entry.priceCurrency] ?? '';
  const unit = quotedUnit(entry);
  const weight = isTeaware ? null : quotedGrams(entry);
  const preview = entry.priceAmount != null && weight
    ? curateShelfPreview({ costAmount: entry.priceAmount, grams: weight.grams, currency: entry.priceCurrency, rates, shopFreightPerKgUsd: shopFreight.perKgUsd })
    : null;
  const tasting = tastingLine(entry.tasting);
  const kind = kindLine(entry);
  const place = placeLine(entry);
  const photo = entry.photos?.find((p) => /^https?:\/\//.test(p));

  const choice: Choice | null = entry.decision === 'passed_on' ? 'pass'
    : entry.decision === 'selected' ? 'buy'
    : entry.sampleState ? 'sample' : null;
  const choose = (c: Choice) => {
    if (c === 'pass') updateEntry(entry.id, { decision: choice === 'pass' ? null : 'passed_on' });
    if (c === 'sample') updateEntry(entry.id, choice === 'sample'
      ? { sampleState: null, decision: null }
      : { sampleState: 'requested', isSample: true, decision: 'considering' });
    if (c === 'buy') {
      updateEntry(entry.id, { decision: 'selected' });
      onBuy?.(entry.id);
    }
  };
  // The one thing still missing is the gold button: tasting first, then a word about it.
  const next: 'taste' | 'talk' | 'note' = !tasting && !isTeaware ? 'taste' : canTalk ? 'talk' : 'note';
  const act = (k: typeof next) => `flex min-h-12 items-center justify-center gap-2 rounded-md border text-ui-13 font-medium ${
    next === k ? 'border-tea-gold bg-tea-gold/10 text-tea-gold' : 'border-tea-border text-tea-text-sec hover:text-tea-text'
  }`;

  const back = onBack && (
    <button type="button" onClick={onBack} aria-label="Back" className="tap-target flex h-11 w-11 items-center justify-center rounded-full text-tea-text lg:hidden">
      <ArrowLeft size={18} strokeWidth={1.75} />
    </button>
  );

  return (
    <article className="curate-v2 -mx-4 grid pb-nav-gap lg:mx-0" data-testid="curate-tea-face">
      {photo ? (
        <div className="relative h-56 bg-cover bg-center" style={{ backgroundImage: `url(${photo})` }}>
          <div className="absolute inset-0 bg-gradient-to-t from-tea-bg via-tea-bg/10 to-transparent" aria-hidden />
          <div className="absolute left-2 top-2">{back}</div>
          <div className="absolute inset-x-4 bottom-2 flex items-baseline justify-between gap-3">
            <h2 className="min-w-0 truncate font-display text-[31px] leading-none text-tea-text">{entry.name?.trim() || 'Untitled tea'}</h2>
            {kind && <span className="shrink-0 text-ui-12 text-tea-text-sec tabular-nums">{kind}</span>}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 border-b border-tea-border px-2 pb-2.5 pt-2 lg:px-4">
          {back}
          <h2 className="min-w-0 flex-1 truncate font-display text-[31px] leading-none text-tea-text">{entry.name?.trim() || 'Untitled tea'}</h2>
          {kind && <span className="shrink-0 pr-2 text-ui-12 text-tea-text-sec tabular-nums">{kind}</span>}
        </div>
      )}

      <Row label="Cost" onClick={onEdit} testId="tea-face-cost">
        {entry.priceAmount != null ? (
          <>
            <span className="font-medium tabular-nums">{sym}{entry.priceAmount.toLocaleString()}</span>
            {unit && <span className="text-ui-12 text-tea-text-dim">per {unit}</span>}
          </>
        ) : add}
      </Row>
      {!isTeaware && (
        <Row label="Shelf" testId="tea-face-shelf" onClick={preview ? undefined : onEdit}>
          {preview
            ? <><span className="font-medium tabular-nums text-tea-gold">${preview.retailPerGramUsd.toFixed(2)} / g</span>{weight?.assumed && <span className="text-ui-12 text-tea-text-dim tabular-nums">at {weight.grams} g</span>}</>
            : entry.priceAmount != null && weight ? <span className="text-ui-13 text-tea-text-dim">no rate for {sym || entry.priceCurrency} yet</span>
            : entry.priceAmount != null ? <span className="text-ui-13 text-tea-text-dim">add the weight</span>
            : <span className="text-ui-13 text-tea-text-dim">after the cost</span>}
        </Row>
      )}
      <Row label="From" onClick={onEdit}>{place ? <span className="font-display text-ui-17">{place}</span> : add}</Row>
      <Row label="Vendor" onClick={onEdit}>{entry.vendorName?.trim() ? <span className="font-display text-ui-17">{entry.vendorName}</span> : add}</Row>
      <Row label="Chinese" onClick={onEdit}>{entry.chineseName ? <span style={{ fontFamily: "'Noto Serif SC', serif" }}>{entry.chineseName}</span> : add}</Row>
      {!isTeaware && (
        <Row label="Tasting" onClick={() => onTaste(entry.id)} testId="tea-face-tasting">
          {tasting ? <span className="truncate tabular-nums">{tasting}</span> : add}
        </Row>
      )}
      {!photo && <Row label="Photo" onClick={onEdit}>{add}</Row>}

      <div className={`grid gap-2 px-4 pt-3 ${canTalk ? 'grid-cols-3' : 'grid-cols-2'}`} role="group" aria-label="Do with this tea">
        {!isTeaware && (
          <button type="button" onClick={() => onTaste(entry.id)} className={act('taste')}>
            <Coffee size={15} strokeWidth={1.6} /> Taste
          </button>
        )}
        {canTalk && (
          <button
            type="button"
            onClick={() => onTalk(entry.id)}
            aria-label={talking ? 'Stop recording' : 'Talk about this tea'}
            className={talking ? 'flex min-h-12 items-center justify-center gap-2 rounded-md border border-tea-gold bg-tea-gold/15 text-ui-13 font-medium text-tea-gold' : act('talk')}
          >
            {talking && voiceState === 'transcribing' ? <Loader2 size={15} className="animate-spin" />
              : talking ? <Square size={12} fill="currentColor" strokeWidth={0} />
              : <Mic size={15} strokeWidth={1.6} />}
            {talking ? (voiceState === 'transcribing' ? 'Writing' : 'Stop') : 'Talk'}
          </button>
        )}
        <button type="button" onClick={() => setNoteOpen((v) => !v)} aria-expanded={noteOpen} className={noteOpen ? 'flex min-h-12 items-center justify-center gap-2 rounded-md border border-tea-gold text-ui-13 font-medium text-tea-gold' : act('note')}>
          <FileText size={15} strokeWidth={1.6} /> Note
        </button>
      </div>

      {(noteOpen || entry.notes?.trim()) && (
        <div className="px-4 pt-3">
          <textarea
            value={entry.notes ?? ''}
            onChange={(e) => updateEntry(entry.id, { notes: e.target.value })}
            rows={3}
            autoFocus={noteOpen && !entry.notes}
            aria-label="Note"
            placeholder="Anything worth remembering about this tea"
            className="w-full rounded-md border border-tea-border bg-tea-surface p-3 text-ui-14 leading-relaxed text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold"
          />
        </div>
      )}

      <div className="mx-4 mt-3 grid grid-cols-3 overflow-hidden rounded-md border border-tea-border" role="radiogroup" aria-label="Decision" data-testid="tea-face-decision">
        {(['pass', 'sample', 'buy'] as const).map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={choice === c}
            onClick={() => choose(c)}
            className={`min-h-11 text-ui-11 font-semibold uppercase tracking-[0.1em] ${i ? 'border-l border-tea-border' : ''} ${
              choice === c ? 'bg-tea-gold/15 text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
            }`}
          >
            {c === 'pass' ? 'Pass' : c === 'sample' ? 'Sample' : 'Buy'}
          </button>
        ))}
      </div>

      <section className="mt-3 border-t border-tea-border">
        <button
          type="button"
          onClick={() => (onOpenSaid ? onOpenSaid(entry.id) : setSaidOpen((v) => !v))}
          disabled={!said.length}
          aria-expanded={saidOpen}
          className="flex min-h-11 w-full items-center gap-2 px-4 text-left"
          data-testid="tea-face-said"
        >
          <span className="flex-1 text-ui-13 text-tea-text-sec">
            <span className="font-medium text-tea-text">What you said</span>
            {' · '}{said.length ? `${said.length} recording${said.length === 1 ? '' : 's'}` : 'nothing yet'}
          </span>
          {said.length > 0 && <span className="flex items-center gap-1 text-ui-13 text-tea-gold">Open <ChevronDown size={14} className={saidOpen ? 'rotate-180' : ''} /></span>}
        </button>
        {saidOpen && !onOpenSaid && (
          <ul className="grid gap-3 px-4 pb-3">
            {said.map((s) => (
              <li key={s.key} className="border-l border-tea-gold pl-3 text-ui-14 italic leading-relaxed text-tea-text-sec">{s.text}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center justify-between gap-3 px-4 pt-1">
        {!isTeaware ? (
          <button type="button" onClick={() => onFullTasting(entry.id)} className="min-h-11 text-ui-12 text-tea-text-dim hover:text-tea-text">Full tasting</button>
        ) : <span />}
        <button type="button" onClick={onEdit} className="min-h-11 text-ui-12 text-tea-text-dim hover:text-tea-text" data-testid="tea-face-edit">Edit all fields</button>
      </div>
      {onDone && (
        <div className="px-4 pt-2">
          <button type="button" onClick={onDone} className="cta-solid min-h-12 w-full rounded-md text-ui-14 font-semibold" data-testid="tea-face-done">Done</button>
        </div>
      )}
    </article>
  );
};
