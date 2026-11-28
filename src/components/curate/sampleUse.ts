import { create } from 'zustand';
import { api } from '../../lib/api';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { DEFAULT_TASTE_GRAMS } from '../../admin/components/inventory/phone/groupStock';
import { plainFailure } from './plainFailure';

/**
 * A tasting uses up some of the sample. Stock's samples sheet records that
 * through Curate's correction door (`taste_sample`), and so does this: one
 * request per tasting, for the grams, and nothing else. The score and the
 * answers already reach the tea through the entry sync, so they are never sent
 * a second time here.
 *
 * "A tasting" is one opening: the fast sheet, or the full tasting when it is
 * opened on its own. Going from the fast sheet to the full tasting ("More") is
 * the same opening, so the grams are used up once, when the last of them closes.
 */

export interface SamplePortion { id: string; name?: string; grams: number | null; status: string }

interface Opening {
  entryId: string;
  /** The portion this tasting draws on; null while it loads or when none is in hand. */
  portion: SamplePortion | null;
  loaded: Promise<SamplePortion | null>;
  /** What was typed in the grams field. Empty means "the usual", never zero. */
  typed: string;
  answered: boolean;
}

export interface SampleUseFailure {
  entryId: string;
  teaName: string;
  portionId: string;
  grams: number;
  message: string;
}

interface SampleUseState {
  opening: Opening | null;
  failure: SampleUseFailure | null;
  sending: boolean;
  begin: (entryId: string) => void;
  setTyped: (typed: string) => void;
  markAnswered: (entryId: string) => void;
  finish: (entryId: string) => Promise<void>;
  retry: () => Promise<void>;
  dismissFailure: () => void;
}

/** A portion that can be tasted from: received, and weighed with something left. */
export function tastablePortion(samples: SamplePortion[] | undefined | null): SamplePortion | null {
  const usable = (samples ?? []).filter((s) => s.status !== 'requested' && typeof s.grams === 'number' && Number.isFinite(s.grams) && s.grams > 0);
  if (!usable.length) return null;
  return usable.reduce((best, s) => ((s.grams as number) > (best.grams as number) ? s : best));
}

export const whole = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
const round = (n: number): number => Math.round(n * 100) / 100;

/** The grams this tasting will use: what was typed, else the usual 5 g, never more than is left. */
export function gramsToUse(portion: SamplePortion | null, typed: string): number {
  const left = portion?.grams ?? 0;
  const text = typed.trim();
  const entered = text === '' ? NaN : Number(text);
  const wanted = Number.isFinite(entered) && entered >= 0 ? entered : DEFAULT_TASTE_GRAMS;
  return round(Math.min(wanted, left));
}

async function sendUse(portionId: string, grams: number): Promise<void> {
  // Exactly what Stock's sheet sends for a tasting with no words and no score.
  const command = { action: 'taste_sample', entity: 'sample', id: portionId, consumed_grams: grams };
  const preview = await api.curateWorkspace.correct(command);
  if (preview?.error || !preview?.confirmation_token) throw new Error(preview?.message || 'The shop would not take that.');
  const done = await api.curateWorkspace.correct(command, preview.confirmation_token);
  if (done?.error) throw new Error(done.message || 'The shop would not take that.');
}

const teaName = (entryId: string): string => useTeaCompassStore.getState().getEntry(entryId)?.name?.trim() || 'this tea';

export const useSampleUse = create<SampleUseState>((set, get) => ({
  opening: null,
  failure: null,
  sending: false,

  begin: (entryId) => {
    if (get().opening?.entryId === entryId) return;
    const opening: Opening = { entryId, portion: null, loaded: Promise.resolve(null), typed: '', answered: false };
    opening.loaded = (async (): Promise<SamplePortion | null> => {
      try {
        const holdings = await api.curateWorkspace.holdings(false, entryId);
        const holding = Array.isArray(holdings) ? holdings.find((h: any) => h?.entry?.id === entryId) ?? holdings[0] : null;
        const portion = tastablePortion(holding?.samples);
        const current = get().opening;
        // Keep the typed grams and the answers if the tasting went on while this loaded.
        if (current && current.entryId === entryId) set({ opening: { ...current, portion } });
        return portion;
      } catch {
        // No portion known is the same as none in hand: the tasting works as it always did.
        return null;
      }
    })();
    set({ opening });
  },

  setTyped: (typed) => {
    const current = get().opening;
    if (current) set({ opening: { ...current, typed } });
  },

  markAnswered: (entryId) => {
    const current = get().opening;
    if (current && current.entryId === entryId && !current.answered) set({ opening: { ...current, answered: true } });
  },

  finish: async (entryId) => {
    const first = get().opening;
    if (!first || first.entryId !== entryId) return;
    // One opening closes once: take it out before anything is awaited.
    set({ opening: null });
    if (!first.answered) return;
    const portion = first.portion ?? await first.loaded;
    if (!portion) return;
    const grams = gramsToUse(portion, first.typed);
    try {
      await sendUse(portion.id, grams);
    } catch (error) {
      set({ failure: { entryId, teaName: teaName(entryId), portionId: portion.id, grams, message: plainFailure(error, `Using up ${whole(grams)} g of the sample`) } });
    }
  },

  retry: async () => {
    const failure = get().failure;
    if (!failure || get().sending) return;
    const grams = failure.grams;
    set({ sending: true });
    try {
      await sendUse(failure.portionId, failure.grams);
      set({ failure: null, sending: false });
    } catch (error) {
      set({ failure: { ...failure, message: plainFailure(error, `Using up ${whole(grams)} g of the sample`) }, sending: false });
    }
  },

  dismissFailure: () => set({ failure: null }),
}));
