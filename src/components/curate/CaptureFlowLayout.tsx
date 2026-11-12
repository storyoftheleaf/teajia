import React from 'react';
import { getStockTypeFinish } from '../../admin/themeUtils';
import { mediaUrl } from '../../lib/mediaUrl';

/**
 * The 'flow' order of the Source form, the default (`?form=classic` shows the
 * earlier form in TeaCompass/CaptureCard.tsx). It is drawn like the Library it
 * feeds: a supplier header (the vendor, with Run and Journey / visit under
 * it), then small cards in the Library card's own classes, tinted by the tea's
 * type the way the Library tints them (getStockTypeFinish; neutral grey before
 * a type is chosen):
 *
 *   tea card      name (first photo at its left, Scan at its right);
 *                 the band; the price
 *   capture card  Photo and Taste, the photos, the quality and the tasting
 *                 words (once tasted),
 *                 the note box
 *   decide card   status, then Buy, Sample, Done; the Buy panel under it
 *   growing card  the saved notes: everything that grows
 *                 sits below the decision, so it never pushes it down
 *   details       Tea details & sourcing, then Storage
 *
 * A card is one quiet surface with one hairline border. Inside it, rows run
 * edge to edge and are parted by hairlines only (curate-flow-row); fields sit
 * straight on the card with their own word as the placeholder. The only tinted
 * row is the band, in the tea type's colour. Every control is the form's own
 * element, passed in: this file only places them. The look is set once in
 * card-utilities.css under [data-form-layout='flow'].
 */
export interface CaptureFlowLayoutProps {
  /** data-testid of the supplier section and of the band row. */
  contextTestId: string;
  bandTestId: string;
  typeName: string;
  firstPhoto?: string;
  setScanSlot: (el: HTMLElement | null) => void;
  setStripSlot: (el: HTMLElement | null) => void;
  backToLibrary?: React.ReactNode;
  supplierHeader: React.ReactNode;
  vendorStrip: React.ReactNode;
  nameInput: React.ReactNode;
  band: React.ReactNode;
  /** A second row of fields under the band (teaware: origin and capacity). */
  subBand?: React.ReactNode;
  subBandTestId?: string;
  purchase: React.ReactNode;
  sheets: React.ReactNode;
  afterIdentity?: React.ReactNode;
  photo: React.ReactNode;
  taste?: React.ReactNode;
  /** The 1 to 10 quality row and the tasting words, once a tasting exists. */
  quality?: React.ReactNode;
  /** The note box with its microphone, and the saved notes. */
  composer: React.ReactNode;
  list: React.ReactNode;
  intent: React.ReactNode;
  tasting?: React.ReactNode;
  details?: React.ReactNode;
  recordTools: React.ReactNode;
  decision: React.ReactNode;
  actions: React.ReactNode;
  buyPanel: React.ReactNode;
  outside?: React.ReactNode;
}

// The Library card clips its corners; the form's suggestion lists must not be clipped.
const CARD = 'library-tea-card curate-flow-card !overflow-visible';
const ROW = 'curate-flow-row';

export function CaptureFlowLayout(props: CaptureFlowLayoutProps) {
  const finish = getStockTypeFinish(props.typeName);
  const cardStyle = {
    '--library-accent': finish.text,
    '--library-metal-hue': finish.tint,
    '--library-metal-l': finish.lightness,
  } as React.CSSProperties;

  return (
    <div className="relative mx-auto w-full max-w-3xl pb-1.5 lg:py-3" data-curate-source data-visual-layout="cards" data-form-layout="flow">
      {props.backToLibrary}

      <section className="library-supplier-group" data-testid={props.contextTestId} data-zone="context">
        {props.supplierHeader}
        {props.vendorStrip}
        <div data-testid="curate-primary-workflow" className="grid gap-1.5">
          <article className={CARD} style={cardStyle} data-testid="curate-cluster-identity" data-zone="identity">
            <div className="library-card-title-row curate-flow-name">
              {props.firstPhoto && (
                <img src={mediaUrl(props.firstPhoto)} alt="" className="h-9 w-9 shrink-0 rounded-md border border-tea-border object-cover" data-testid="curate-name-photo" />
              )}
              <div className="min-w-0 flex-1">{props.nameInput}</div>
              <div ref={props.setScanSlot} className="-mr-1.5 flex shrink-0 items-center" data-testid="curate-scan-slot" />
            </div>
            <div className="library-card-subrow curate-flow-band" data-testid={props.bandTestId}>
              {props.band}
            </div>
            {props.subBand && (
              <div className={`${ROW} curate-flow-cells`} data-testid={props.subBandTestId}>
                {props.subBand}
              </div>
            )}
            <div className={`${ROW} curate-flow-purchase`} data-testid="curate-cluster-buying" data-zone="purchase">
              {props.purchase}
            </div>
            {props.sheets}
          </article>

          {props.afterIdentity}

          <article className={CARD} style={cardStyle} data-testid="curate-cluster-capture" data-zone="capture">
            <div className={`${ROW} curate-flow-buttons grid gap-2 ${props.taste ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div className="min-w-0">{props.photo}</div>
              {props.taste}
            </div>
            <div ref={props.setStripSlot} className={`${ROW} curate-flow-strip empty:hidden`} />
            {props.quality && <div className={ROW}>{props.quality}</div>}
            <div className={`${ROW} curate-flow-notes`} data-testid="curate-notes-band" data-zone="notes">
              {props.composer}
              <div className="curate-intent-inline empty:hidden">
                {props.intent}
              </div>
            </div>
          </article>

          {props.recordTools}

          <article className={CARD} style={cardStyle} data-testid="curate-cluster-decide" data-zone="decide">
            <div className={`${ROW} curate-flow-buttons`}>{props.decision}</div>
            <div className={`${ROW} curate-flow-buttons`}>{props.actions}</div>
          </article>

          {props.buyPanel}

          {/* Everything that grows: the saved notes. */}
          <article className={`${CARD} curate-flow-record empty:hidden`} style={cardStyle} data-testid="curate-cluster-record" data-zone="record">
            {props.list}
            {props.tasting}
          </article>

          {props.details && <div className="curate-flow-details">{props.details}</div>}
        </div>
      </section>

      {props.outside}
    </div>
  );
}
