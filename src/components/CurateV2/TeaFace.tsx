import React, { useMemo, useState } from 'react';
import { ChevronDown, Coffee, Loader2, Mic, PencilLine, Square } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useNotesStore } from '../../lib/notesStore';
import { useRates, useShopFreightDefault } from '../../admin/hooks/useAdminData';
import { curateShelfPreview } from './curatePricing';
import { quotedUnit, tastingLine } from './curateV2Model';
import { CURRENCY_LABELS } from './PricingRow';
import { DecisionControl } from './DecisionControl';
import type { TeaCompassEntry } from './types';

interface TeaFaceProps {
  entryId: string;
  /** Opens the full capture card with every field. */
  onEdit: () => void;
  onTaste: (entryId: string) => void;
  onFullTasting: (entryId: string) => void;
  canTalk: boolean;
  onTalk: (entryId: string) => void;
  talking: boolean;
  voiceState: string;
  /** Saves a tea still being captured; absent once it is saved. */
  onDone?: () => void;
}

const fmtPerGram = (v: number) => (v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : Math.round(v).toString());

/** Year, place, type and form, the way a person says them. */
export function fromLine(e: Pick<TeaCompassEntry, 'year' | 'originRegion' | 'originCountry' | 'type' | 'form'>): string {
  return [e.year, e.originRegion || e.originCountry, e.type, e.form].filter((x) => x != null && String(x).trim()).join(' · ');
}

const Row: React.FC<{ label: string; children: React.ReactNode; onClick?: () => void; testId?: string }> = ({ label, children, onClick, testId }) => {
  const body = (
    <>
      <span className="curate-v2-label w-[5.5rem] shrink-0">{label}</span>
      <span className="flex min-w-0 flex-1 items-baseline justify-end gap-1.5 truncate text-right text-ui-14 text-tea-text">{children}</span>
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} data-testid={testId} className="flex min-h-12 w-full items-center gap-2 border-b border-tea-border text-left">{body}</button>
    : <div data-testid={testId} className="flex min-h-12 items-center gap-2 border-b border-tea-border">{body}</div>;
};

const missing = (text: string) => <span className="text-ui-13 text-tea-text-dim">{text}</span>;

/**
 * One tea, read at a glance: the facts as one-line rows, three things to do
 * (taste, talk, note), and what was said about it folded at the bottom. A
 * photo leads only when there is one. Every other field is one tap away in
 * the full card, so nothing the old screen held is lost.
 */
export const TeaFace: React.FC<TeaFaceProps> = ({ entryId, onEdit, onTaste, onFullTasting, canTalk, onTalk, talking, voiceState, onDone }) => {
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
      .filter((n) => n.compassEntryId === entry.id && !n.deleted && n.text?.trim())
      .map((n) => ({ key: n.id, text: n.text.trim(), at: n.createdAt, voice: n.sourceType === 'voice' }));
    const fromClips = (entry.audioClips ?? [])
      .filter((c) => c.transcript?.trim())
      .map((c, i) => ({ key: `clip-${i}`, text: c.transcript!.trim(), at: c.timestamp, voice: true }));
    return [...fromNotes, ...fromClips].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  }, [allNotes, entry]);

  if (!entry) return null;

  const sym = CURRENCY_LABELS[entry.priceCurrency] ?? '';
  const unit = quotedUnit(entry);
  const preview = entry.priceAmount != null && entry.pricePerUnitGrams
    ? curateShelfPreview({ costAmount: entry.priceAmount, grams: entry.pricePerUnitGrams, currency: entry.priceCurrency, rates, shopFreightPerKgUsd: shopFreight.perKgUsd })
    : null;
  const tasting = tastingLine(entry.tasting);
  const from = fromLine(entry);
  const isTeaware = entry.category === 'teaware';


  return (
    <article className="grid gap-4 pb-nav-gap" data-testid="curate-tea-face">
      {entry.photos?.[0] && (
        <img src={entry.photos[0]} alt="" className="max-h-64 w-full rounded-md border border-tea-border object-cover" />
      )}

      <header className="grid gap-0.5">
        <h2 className="font-display text-[30px] leading-[1.05] text-tea-text">{entry.name?.trim() || 'Untitled tea'}</h2>
        {entry.chineseName && <span className="text-ui-15 text-tea-text-sec">{entry.chineseName}</span>}
      </header>

      <div className="border-t border-tea-border">
        <Row label="Cost" onClick={onEdit} testId="tea-face-cost">
          {entry.priceAmount != null ? (
            <>
              <span className="font-medium tabular-nums">{sym}{entry.priceAmount.toLocaleString()}</span>
              {unit && <span className="text-ui-12 text-tea-text-dim">{unit}</span>}
              {preview && <span className="text-ui-12 text-tea-text-dim tabular-nums">· {sym}{fmtPerGram(preview.costPerGramSource)}/g</span>}
            </>
          ) : missing('add cost')}
        </Row>
        {!isTeaware && (
          <Row label="Shelf" testId="tea-face-shelf" onClick={preview ? undefined : onEdit}>
            {preview
              ? <><span className="font-medium tabular-nums text-tea-gold">≈ ${preview.retailPerGramUsd.toFixed(2)}/g</span><span className="text-ui-12 text-tea-text-dim tabular-nums">with {sym}{fmtPerGram(preview.freightPerKgSource)}/kg freight</span></>
              : entry.priceAmount != null && entry.pricePerUnitGrams
                ? missing(`no rate for ${sym || entry.priceCurrency} yet`)
                : entry.priceAmount != null
                  ? missing(`add the ${unit && unit !== 'each' ? unit : 'tea'}'s weight`)
                  : missing('after the cost')}
          </Row>
        )}
        <Row label="From" onClick={onEdit}>{from || missing('year, place, type')}</Row>
        <Row label="Vendor" onClick={onEdit}>{entry.vendorName?.trim() || missing('no vendor yet')}</Row>
        {!isTeaware && (
          <Row label="Tasting" onClick={() => onTaste(entry.id)} testId="tea-face-tasting">
            {tasting ? <span className="truncate text-tea-gold tabular-nums">{tasting}</span> : missing('not tasted')}
          </Row>
        )}
      </div>

      <div className={`grid gap-2 ${canTalk ? 'grid-cols-3' : 'grid-cols-2'}`} role="group" aria-label="Do with this tea">
        {!isTeaware && (
          <button type="button" onClick={() => onTaste(entry.id)} className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-tea-border text-ui-13 font-medium text-tea-text hover:border-tea-gold">
            <Coffee size={15} strokeWidth={1.6} /> Taste
          </button>
        )}
        {canTalk && (
          <button
            type="button"
            onClick={() => onTalk(entry.id)}
            aria-label={talking ? 'Stop recording' : 'Talk about this tea'}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-md border text-ui-13 font-medium ${talking ? 'border-tea-gold bg-tea-gold/10 text-tea-gold' : 'border-tea-border text-tea-text hover:border-tea-gold'}`}
          >
            {talking && voiceState === 'transcribing' ? <Loader2 size={15} className="animate-spin" />
              : talking ? <Square size={12} fill="currentColor" strokeWidth={0} />
              : <Mic size={15} strokeWidth={1.6} />}
            {talking ? (voiceState === 'transcribing' ? 'Writing' : 'Stop') : 'Talk'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          aria-expanded={noteOpen}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-md border text-ui-13 font-medium hover:border-tea-gold ${noteOpen ? 'border-tea-gold text-tea-gold' : 'border-tea-border text-tea-text'}`}
        >
          <PencilLine size={15} strokeWidth={1.6} /> Note
        </button>
      </div>

      {(noteOpen || entry.notes?.trim()) && (
        <label className="grid gap-1.5">
          <span className="curate-v2-label">Note</span>
          <textarea
            value={entry.notes ?? ''}
            onChange={(e) => updateEntry(entry.id, { notes: e.target.value })}
            rows={3}
            autoFocus={noteOpen && !entry.notes}
            placeholder="Anything worth remembering about this tea"
            className="w-full rounded-md border border-tea-border bg-tea-surface p-3 text-ui-14 leading-relaxed text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold"
          />
        </label>
      )}

      <div className="grid gap-1.5">
        <span className="curate-v2-label">Decision</span>
        <DecisionControl value={entry.decision} onChange={(decision) => updateEntry(entry.id, { decision })} />
      </div>

      {said.length > 0 && (
        <section className="border-t border-tea-border pt-1">
          <button type="button" onClick={() => setSaidOpen((v) => !v)} aria-expanded={saidOpen} className="flex min-h-11 w-full items-center gap-2 text-left">
            <span className="curate-v2-label flex-1">What you said · {said.length}</span>
            <ChevronDown size={15} className={`text-tea-text-sec transition-transform ${saidOpen ? 'rotate-180' : ''}`} />
          </button>
          {saidOpen && (
            <ul className="grid gap-3 pb-2">
              {said.map((s) => (
                <li key={s.key} className="grid gap-0.5">
                  <span className="text-ui-11 text-tea-text-dim tabular-nums">
                    {s.voice ? 'Said' : 'Wrote'}{s.at ? ` · ${new Date(s.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                  </span>
                  <p className="whitespace-pre-wrap text-ui-14 leading-relaxed text-tea-text-sec">{s.text}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-tea-border pt-3">
        {!isTeaware && (
          <button type="button" onClick={() => onFullTasting(entry.id)} className="min-h-11 text-ui-13 text-tea-text-sec hover:text-tea-text">
            Full tasting
          </button>
        )}
        <button type="button" onClick={onEdit} className="ml-auto min-h-11 text-ui-13 font-medium text-tea-gold" data-testid="tea-face-edit">
          Edit all fields
        </button>
      </div>
      {onDone && (
        <button type="button" onClick={onDone} className="cta-solid min-h-12 rounded-md text-ui-14 font-semibold" data-testid="tea-face-done">
          Done
        </button>
      )}
    </article>
  );
};
