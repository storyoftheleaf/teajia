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
 *   capture card  Photo and Taste, the photos, the note box
 *   decide card   status, then Buy, Sample, Done; the Buy panel under it
 *   growing card  saved notes and the tasting summary: everything that grows
 *                 sits below the decision, so it never pushes it down
 *   details       Tea details & sourcing, then Storage
 *
 * Every control is the form's own element, passed in: this file only places
 * them. Slim controls and labels are styled once for the whole form in
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
  purchaseLead?: React.ReactNode;
  purchase: React.ReactNode;
  sheets: React.ReactNode;
  afterIdentity?: React.ReactNode;
  photo: React.ReactNode;
  taste?: React.ReactNode;
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
const CARD = 'library-tea-card !overflow-visible';
// One inside padding for every card body, matching the Library card's 10px rows.
const BODY = 'space-y-2 px-2.5 py-2';

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
        <div data-testid="curate-primary-workflow" className="grid gap-2">
          <article className={CARD} style={cardStyle} data-testid="curate-cluster-identity" data-zone="identity">
            {/* The name field draws no underline of its own: the band below draws the line. */}
            <div className="library-card-title-row [&_input]:!border-b-transparent [&_input:focus]:!border-b-tea-gold">
              {props.firstPhoto && (
                <img src={mediaUrl(props.firstPhoto)} alt="" className="h-9 w-9 shrink-0 rounded-md border border-tea-border object-cover" data-testid="curate-name-photo" />
              )}
              <div className="min-w-0 flex-1">{props.nameInput}</div>
              <div ref={props.setScanSlot} className="-mr-1.5 flex shrink-0 items-center" data-testid="curate-scan-slot" />
            </div>
            <div className="library-card-subrow !gap-2 !px-2.5 !py-1" data-testid={props.bandTestId}>
              {props.band}
            </div>
            <div className={BODY} data-testid="curate-cluster-buying" data-zone="purchase">
              {props.purchaseLead}
              <div className="space-y-1">{props.purchase}</div>
            </div>
            {props.sheets}
          </article>

          {props.afterIdentity}

          <article className={CARD} style={cardStyle} data-testid="curate-cluster-capture" data-zone="capture">
            <div className={BODY}>
              {props.taste ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">{props.photo}</div>
                  {props.taste}
                </div>
              ) : <div className="min-w-0">{props.photo}</div>}
              <div ref={props.setStripSlot} className="empty:hidden" />
              <div className="space-y-1" data-testid="curate-notes-band" data-zone="notes">
                {props.composer}
                <div className="curate-intent-inline empty:hidden">
                  {props.intent}
                </div>
              </div>
            </div>
          </article>

          {props.recordTools}

          <article className={CARD} style={cardStyle} data-testid="curate-cluster-decide" data-zone="decide">
            <div className={BODY}>
              {props.decision}
              {props.actions}
            </div>
          </article>

          {props.buyPanel}

          {/* Everything that grows: the saved notes and the tasting summary. */}
          <article className={`${CARD} space-y-2 !px-2.5 !py-2 empty:hidden`} style={cardStyle} data-testid="curate-cluster-record" data-zone="record">
            {props.list}
            {props.tasting}
          </article>

          {props.details && <div className="px-2.5">{props.details}</div>}
        </div>
      </section>

      {props.outside}
    </div>
  );
}
