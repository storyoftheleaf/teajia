import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AlcoveModal } from '../shop/AlcoveModal';
import { LinkTeaEntry, LinkTeaPhoto, linkTeaInventoryItem, linkTeaMetaLine, useLinkTeaWriting, type LinkTeaSource } from '../shop/linkTea';
import type { PayLinkTeaLine } from './types';

/**
 * The teas on an invoice, at the top of its pay page, drawn as the private
 * collection link draws them: the photo when there is one, the shop's one line
 * of type and place, the amount and its price, and the opening of the tea's
 * Tea Wisdom writing. A tea opens in the shop's own tea card, to read; paying
 * happens here, so the card carries no order footer. Shown only to a holder of
 * the invoice's own link; the worker decides that before it sends a line.
 */
export function PayInvoiceTeas({ lines }: { lines: readonly PayLinkTeaLine[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const cards = useMemo(() => lines.filter(line => line.product_id).map(line => linkTeaInventoryItem({
    ...sourceOf(line), ...line, chineseName: line.chinese_name, year: line.year, image: line.image_url,
  })), [lines]);
  const byProduct = useMemo(() => new Map(lines.map(line => [line.product_id, line])), [lines]);
  if (lines.length === 0) return null;
  return (
    <section aria-label="What this pays for" className="mt-5 border-t border-tea-border pt-4" data-testid="pay-invoice-teas">
      <p className="label-caps text-tea-text-dim mb-1">What this pays for</p>
      <ul className="flex flex-col divide-y divide-tea-border">
        {lines.map((line, index) => (
          <PayInvoiceTea key={`${line.product_id ?? line.name}-${index}`} line={line}
            onOpen={line.product_id ? () => setOpenId(line.product_id) : undefined} />
        ))}
      </ul>
      {openId && (
        <AlcoveModal
          item={cards.find(card => card.id === openId) ?? null}
          items={cards}
          onClose={() => setOpenId(null)}
          onItemChange={next => setOpenId(next.id)}
          linkFooter={() => null}
          linkAddition={card => {
            const line = byProduct.get(card.id);
            return line ? <PayTeaWriting line={line} /> : null;
          }}
        />
      )}
    </section>
  );
}

function sourceOf(line: PayLinkTeaLine): LinkTeaSource {
  return {
    productId: line.product_id,
    name: line.name,
    type: line.type,
    form: line.form,
    originRegion: line.origin_region,
    originCountry: line.origin_country,
  };
}

function money(n: number): string {
  return n === 0 ? 'Free' : `$${(Math.round(n * 100) / 100).toFixed(2)}`;
}

function PayTeaWriting({ line }: { line: PayLinkTeaLine }) {
  const writing = useLinkTeaWriting(sourceOf(line));
  return <LinkTeaEntry writing={writing} className="alcove-body-section mt-7" />;
}

function PayInvoiceTea({ line, onOpen }: { line: PayLinkTeaLine; onOpen?: () => void }) {
  const source = sourceOf(line);
  const writing = useLinkTeaWriting(source);
  const meta = linkTeaMetaLine({ ...source, year: line.year });
  const amount = line.unit === 'g' ? `${line.quantity}g` : `×${line.quantity}`;
  const body = (
    <>
      <LinkTeaPhoto src={line.image_url} className="h-16 w-16 shrink-0 rounded-md" />
      <span className="block min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 font-display text-ui-17 leading-tight text-tea-text">{line.name}</span>
          <span className="shrink-0 font-body text-ui-14 tabular-nums text-tea-text">{money(line.line_total_usd)}</span>
        </span>
        <span className="mt-1 block font-sans text-ui-12 text-tea-text-sec">
          <span className="tabular-nums">{amount}</span>
          {meta && <span className="uppercase tracking-[0.04em]"> · {meta}</span>}
        </span>
        {writing.lead && (
          <span className="mt-1.5 block font-body text-ui-13 leading-[1.55] text-tea-text-sec line-clamp-2">{writing.lead}</span>
        )}
        {onOpen && (
          <span className="mt-1 inline-flex items-center gap-1 font-sans text-ui-12 text-tea-text-sec">
            Open the tea <ArrowRight size={11} aria-hidden="true" />
          </span>
        )}
      </span>
    </>
  );
  return (
    <li>
      {onOpen ? (
        <button type="button" onClick={onOpen} aria-haspopup="dialog" className="flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-tea-text/5">
          {body}
        </button>
      ) : (
        <div className="flex items-start gap-3 py-3">{body}</div>
      )}
    </li>
  );
}
