import React, { useRef } from 'react';
import { Archive, BookOpen, Eye, FlaskConical, Layers, Receipt, Share2, Star } from 'lucide-react';
import type { Product } from '../../../types';
import { fmtNum } from '../../../../utils/formatNumber';
import { isLow, isTeaware, onHand } from './groupStock';

// Stage 2 of todo/plans/stock-phone-by-supplier.md: the top of the full tea
// page on a phone. Stock first (what is on the shelf, when it was last counted,
// what is on the way), then everything you can do to this one tea, then a row
// that jumps to each section of the long form below. Laptop keeps its layout:
// every part of this renders below md only.

export type TeaAction = 'collect' | 'publish' | 'invoice' | 'star' | 'sample' | 'share' | 'journal' | 'archive';

export const TEA_JUMP_SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ['tea-section-details', 'Details'],
  ['tea-section-photos', 'Photos'],
  ['tea-section-tasting', 'Tasting'],
  ['tea-section-story', 'Story'],
  ['tea-section-placement', 'Shop'],
];

export interface PhoneTeaHeaderProps {
  product: Product;
  incoming?: { quantity: number; eta?: string | null } | null;
  onChangeStock?: (product: Product, trigger: HTMLElement) => void;
  onRecount?: (product: Product, trigger: HTMLElement) => void;
  onAction?: (action: TeaAction, product: Product) => void;
}

function checked(at?: string | null): string {
  if (!at) return 'never';
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? 'never' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ACTIONS: ReadonlyArray<readonly [TeaAction, string, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>]> = [
  ['collect', 'Collection', Layers],
  ['publish', 'Publish', Eye],
  ['invoice', 'Invoice', Receipt],
  ['star', 'Star', Star],
  ['sample', 'Sample', FlaskConical],
  ['share', 'Share', Share2],
  ['journal', 'Journal', BookOpen],
  ['archive', 'Archive', Archive],
];

export const PhoneTeaHeader: React.FC<PhoneTeaHeaderProps> = ({ product, incoming, onChangeStock, onRecount, onAction }) => {
  const changeRef = useRef<HTMLButtonElement>(null);
  const countRef = useRef<HTMLButtonElement>(null);
  const ware = isTeaware(product);
  const qty = onHand(product);
  const bought = Number(product.quantityPurchased) || 0;
  const unit = ware ? 'pc' : 'g';
  const pct = bought > 0 ? Math.min(100, Math.round((qty / bought) * 100)) : null;
  const low = isLow(product);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="md:hidden" data-testid="phone-tea-header">
      <section aria-label="On the shelf" className="admin-card mx-3 mb-3 px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-ui-10 uppercase tracking-[0.08em] text-admin-text-sec">On the shelf</div>
            <div className={`font-display text-ui-28 leading-none mt-1 ${qty <= 0 ? 'text-tea-error' : low ? 'text-tea-gold' : 'text-admin-text'}`}>
              {ware && product.quantityUnits == null ? 'not counted' : `${qty.toLocaleString('en-US')} ${unit}`}
            </div>
          </div>
          <div className="text-right text-ui-12 text-admin-text-sec leading-snug">
            {bought > 0 && <div>of {bought.toLocaleString('en-US')} {unit} bought</div>}
            {!ware && <div>flags under {(Number(product.lowStockThreshold) || 0).toLocaleString('en-US')} g</div>}
          </div>
        </div>
        {pct !== null && (
          <div className="h-1 rounded-full bg-admin-elevated mt-2.5 overflow-hidden" aria-hidden="true">
            <div className={`h-full ${low ? 'bg-tea-gold' : 'bg-tea-gold-lt'}`} style={{ width: `${pct}%` }} />
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-3 mt-2.5">
          <div className="border-t border-admin-border py-1.5">
            <dt className="font-mono text-ui-10 uppercase tracking-[0.06em] text-admin-text-sec">Checked</dt>
            <dd className={`text-ui-13 ${product.stockVerifiedAt ? 'text-admin-text' : 'text-tea-gold'}`}>{checked(product.stockVerifiedAt)}</dd>
          </div>
          <div className="border-t border-admin-border py-1.5">
            <dt className="font-mono text-ui-10 uppercase tracking-[0.06em] text-admin-text-sec">In transit</dt>
            <dd className="text-ui-13 text-admin-text">
              {incoming && incoming.quantity > 0
                ? `+${fmtNum(incoming.quantity)} ${unit}${incoming.eta ? `, due ${checked(incoming.eta)}` : ''}`
                : 'nothing'}
            </dd>
          </div>
        </dl>
        <div className="grid grid-cols-[1.4fr_1fr] gap-2 mt-2">
          <button ref={changeRef} type="button" onClick={() => changeRef.current && onChangeStock?.(product, changeRef.current)} className="cta-solid h-11 rounded-md text-ui-14 font-semibold">Change stock</button>
          <button ref={countRef} type="button" onClick={() => countRef.current && onRecount?.(product, countRef.current)} className="h-11 rounded-md border border-admin-border text-ui-13 text-admin-text">Count it</button>
        </div>
      </section>

      {onAction && (
        <section aria-label="Do with this tea" className="mx-3 mb-3 grid grid-cols-4 gap-1.5">
          {ACTIONS.map(([kind, label, Icon]) => (
            <button
              key={kind}
              type="button"
              onClick={() => onAction(kind, product)}
              aria-label={kind === 'collect' ? 'Add this tea to a collection' : `${label} this tea`}
              className="admin-card flex flex-col items-center justify-center gap-1 h-14 text-ui-11 text-admin-text"
            >
              <span className="text-tea-gold"><Icon size={18} aria-hidden={true} /></span>
              {label}
            </button>
          ))}
        </section>
      )}

      <nav aria-label="Jump to a section" className="sticky top-0 z-sticky flex justify-between px-4 mb-3 border-y border-admin-border bg-admin-bg overflow-hidden">
        {TEA_JUMP_SECTIONS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => jump(id)} className="tap-target h-10 shrink-0 text-ui-13 text-admin-text-sec hover:text-admin-text">{label}</button>
        ))}
      </nav>
    </div>
  );
};
