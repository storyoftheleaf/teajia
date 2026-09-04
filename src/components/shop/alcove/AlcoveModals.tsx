import React, { useEffect } from 'react';
import type { InventoryItem } from '../../../types';
import { X, Loader2 } from 'lucide-react';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { BODY, HEADING, LABEL, LABEL_NUMERAL, NUMERAL } from '../../shared/typeRoles';
import { minimumOrderGrams, snapToUnit } from '../../../lib/teaPricing';

/**
 * Escape closes, and the browser's own focus does not leak out of an open
 * dialog. `useFocusTrap` already does both, and `AlcoveModal` twenty lines away
 * in the same folder already used the same pattern by hand, so the three
 * dialogs here were the only modals in the shop a keyboard reader could open
 * and then be stranded inside.
 */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useFocusTrap<HTMLDivElement>(open);
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);
  return ref;
}

// ─── Sample Request Modal ─────────────────────────────────────────────────────

interface SampleModalProps {
  item: InventoryItem;
  open: boolean;
  onClose: () => void;
  sampleGrams: 5 | 10 | 15;
  setSampleGrams: (g: 5 | 10 | 15) => void;
  sampleNote: string;
  setSampleNote: (v: string) => void;
  sampleSubmitting: boolean;
  sampleDone: boolean;
  sampleError: string | null;
  onSubmit: () => void;
  isLoggedIn: boolean;
  pricePerGram: number;
  /** Formats a total in the currency the reader chose. */
  formatTotal: (usd: number) => string;
}

export const SampleModal: React.FC<SampleModalProps> = ({
  item,
  open,
  onClose,
  sampleGrams,
  setSampleGrams,
  sampleNote,
  setSampleNote,
  sampleSubmitting,
  sampleDone,
  sampleError,
  onSubmit,
  isLoggedIn,
  pricePerGram,
  formatTotal,
}) => {
  const dialogRef = useDialog(open, () => { if (!sampleSubmitting) onClose(); });
  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Request a sample of ${item.name}`}
      onClick={() => { if (!sampleSubmitting) onClose(); }}
      className="alcove-modal-backdrop fixed inset-0 z-priority flex items-center justify-center p-4"
    >
      <div onClick={e => e.stopPropagation()} className="alcove-modal-panel max-w-[360px]">
        {/* Close X, top-right of a centred overlay modal, per the app's rule. */}
        <button
          type="button"
          onClick={onClose}
          className="alcove-modal-close tap-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
          aria-label="Close sample request"
        >
          <X size={16} />
        </button>

        {sampleDone ? (
          <div className="py-2 text-center">
            <p className={`${HEADING} mb-2 text-tea-text`}>Sample requested.</p>
            <p className={`${BODY} text-tea-text-sec`}>We'll be in touch to arrange delivery.</p>
            <button type="button" onClick={onClose} className={`alcove-modal-primary ${LABEL} mt-4 w-full`}>
              Done
            </button>
          </div>
        ) : !isLoggedIn ? (
          <div className="py-2 text-center">
            <p className={`${HEADING} mb-2 text-tea-text`}>Create an account to request samples</p>
            <p className={`${BODY} mb-4 text-tea-text-sec`}>
              Sign in or create a free account to request a sample of {item.name}.
            </p>
            <button
              type="button"
              onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openAccountPanel', { detail: { view: 'signup' } })); }}
              className={`alcove-modal-primary ${LABEL} w-full`}
            >
              Sign In / Create Account
            </button>
          </div>
        ) : (
          <div>
            {/* Product info */}
            <div className="mb-5 flex items-center gap-3">
              {item.image && (
                <img src={item.image} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
              )}
              <div className="min-w-0">
                <p className={`${BODY} m-0 font-display text-tea-text`}>{item.name}</p>
                {item.origin && <p className={`${BODY} mb-0 mt-0.5 text-tea-text-sec`}>{item.origin}</p>}
              </div>
            </div>

            {/* Size selector */}
            <div className="mb-4">
              <p className={`${LABEL} mb-2 text-tea-text-sec`}>Sample size</p>
              <div className="flex gap-1.5">
                {([5, 10, 15] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSampleGrams(g)}
                    aria-pressed={sampleGrams === g}
                    className="alcove-size-btn"
                    data-active={sampleGrams === g}
                  >
                    <span className={`${BODY} ${NUMERAL} block`}>{g}g</span>
                    <span className={`${LABEL_NUMERAL} mt-0.5 block text-tea-text-sec`}>
                      {formatTotal(pricePerGram * g)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div className="mb-4">
              <p className={`${LABEL} mb-1.5 text-tea-text-sec`}>Note (optional)</p>
              <textarea
                value={sampleNote}
                onChange={e => setSampleNote(e.target.value)}
                placeholder="Anything you'd like us to know?"
                rows={2}
                className={`alcove-note-input ${BODY}`}
              />
            </div>

            {sampleError && <p className={`${BODY} mb-3 text-tea-text-sec`}>{sampleError}</p>}

            <button
              type="button"
              onClick={onSubmit}
              disabled={sampleSubmitting}
              className={`alcove-modal-primary ${LABEL} w-full`}
            >
              {sampleSubmitting && <Loader2 size={13} className="animate-spin" />}
              Request sample
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Custom Amount Modal ──────────────────────────────────────────────────────

interface CustomAmountModalProps {
  open: boolean;
  onClose: () => void;
  sliderMax: number;
  customInput: string;
  setCustomInput: (v: string) => void;
  setGrams: (g: number) => void;
  /** Per-gram price in the base currency, for the live running total. */
  pricePerGram?: number;
  /** Formats a gram amount into the currency the reader chose. */
  formatTotal?: (grams: number) => string;
  /** The whole pressed piece, when the tea is one, so it reads "Cake" here too. */
  wholePiece?: { label: string; grams: number };
  /**
   * What one sealed unit weighs, when the tea is sold only in whole ones.
   * Set, this is both the floor and the step: the quick amounts become
   * multiples of it and anything typed rounds up to the next whole unit,
   * because a shop that cannot open the box cannot send 130 g of it.
   */
  unitGrams?: number;
}

/**
 * Custom amount. The strip carries the amounts most readers buy; everything
 * else, a 10 g taste included, is entered or picked here.
 */
export const CustomAmountModal: React.FC<CustomAmountModalProps> = ({
  open,
  onClose,
  sliderMax,
  customInput,
  setCustomInput,
  setGrams,
  pricePerGram = 0,
  formatTotal,
  wholePiece,
  unitGrams,
}) => {
  const dialogRef = useDialog(open, onClose);
  if (!open) return null;

  // Held as a local const so the narrowing survives into the callbacks below.
  const unit = unitGrams && unitGrams > 0 ? unitGrams : undefined;
  const floor = minimumOrderGrams(unit);

  // Plain weights, then the whole piece under its own name: 357 g of a cake is
  // a cake, and reads as one. A tea sold sealed skips that ladder entirely and
  // counts units instead, because none of those weights exist for it.
  const quickAmounts: { grams: number; label: string; sub?: string }[] = unit
    ? Array.from({ length: 6 }, (_, i) => (i + 1) * unit)
        .filter(g => g <= sliderMax)
        .map(g => ({
          grams: g,
          label: `${Math.round(g / unit)} × ${wholePiece?.label.toLowerCase() ?? 'unit'}`,
          sub: `${g}g`,
        }))
    : [
        ...[10, 25, 50, 100, 250]
          .filter(g => g <= sliderMax)
          .map(g => ({ grams: g, label: `${g}g` })),
        ...(wholePiece && wholePiece.grams <= sliderMax
          ? [{
              grams: wholePiece.grams,
              label: wholePiece.label,
              sub: `${wholePiece.grams}g`,
            }]
          : []),
      ];
  const entered = parseInt(customInput);
  const enteredValid = !isNaN(entered) && entered >= floor && entered <= sliderMax;
  const priceOf = (g: number) =>
    formatTotal ? formatTotal(g) : `$${Math.ceil(pricePerGram * g)}`;
  const commit = (g: number) => {
    // Round to something the shop can actually send BEFORE it is shown back,
    // so the reader never reads one number here and another on the button.
    const sendable = unit ? snapToUnit(g, unit, sliderMax) : Math.min(g, sliderMax);
    setCustomInput(String(sendable));
    setGrams(sendable);
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Custom amount"
      onClick={onClose}
      className="alcove-modal-backdrop fixed inset-0 z-priority flex items-center justify-center p-4"
    >
      <div onClick={e => e.stopPropagation()} className="alcove-modal-panel max-w-[320px]">
        <p className={`${HEADING} m-0 mb-4 text-tea-text`}>Custom amount</p>

        {/* Common amounts, each carrying its price, so the choice is made here
            rather than by typing a number and watching the button change. */}
        {quickAmounts.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {quickAmounts.map(a => (
              <button
                key={a.grams}
                type="button"
                onClick={() => commit(a.grams)}
                className="alcove-amount-chip"
                aria-label={`${a.label}, ${a.grams} grams${pricePerGram > 0 ? `, ${priceOf(a.grams)}` : ''}`}
              >
                <span className={NUMERAL}>{a.label}</span>
                {pricePerGram > 0 && (
                  <small className={NUMERAL}>
                    {a.sub ? `${a.sub} · ${priceOf(a.grams)}` : priceOf(a.grams)}
                  </small>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="mb-2 flex items-center gap-2">
          <input
            type="number"
            min={floor}
            max={sliderMax}
            step={unit ?? 5}
            value={customInput}
            onChange={e => {
              setCustomInput(e.target.value);
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 5) setGrams(Math.min(v, sliderMax));
            }}
            placeholder="e.g. 200"
            aria-label="Amount in grams"
            autoFocus
            className={`alcove-amount-input ${BODY} ${NUMERAL}`}
          />
          <span className={`${BODY} ${NUMERAL} text-tea-text-sec`}>g</span>
        </div>
        <p className={`${BODY} ${NUMERAL} m-0 mb-5 min-h-[18px] text-tea-text-sec`}>
          {enteredValid && pricePerGram > 0 ? priceOf(entered) : '\u00a0'}
        </p>

        {/* Cancel left, commit right. */}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={`alcove-modal-cancel ${LABEL}`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const v = parseInt(customInput);
              if (!isNaN(v) && v >= 5) {
                setGrams(Math.min(v, sliderMax));
                onClose();
              }
            }}
            className={`alcove-modal-primary ${LABEL} flex-1`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Image Overlay Modal ──────────────────────────────────────────────────────

interface ImageOverlayModalProps {
  open: boolean;
  expandedImageUrl: string | null;
  itemName: string;
  onClose: () => void;
}

export const ImageOverlayModal: React.FC<ImageOverlayModalProps> = ({
  open,
  expandedImageUrl,
  itemName,
  onClose,
}) => {
  const isOpen = open && Boolean(expandedImageUrl);
  const dialogRef = useDialog(isOpen, onClose);
  if (!isOpen || !expandedImageUrl) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Image of ${itemName}`}
      onClick={onClose}
      className="alcove-viewer fixed inset-0 z-priority flex items-center justify-center"
    >
      <img
        src={expandedImageUrl}
        alt={itemName}
        onClick={e => e.stopPropagation()}
        className="alcove-viewer-img"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image"
        className="alcove-viewer-close tap-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
      >
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  );
};
