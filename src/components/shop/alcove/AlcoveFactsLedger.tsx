import React from 'react';
import { resolveTermLabel, LIQUOR_COLORS } from '../../../data/tastingTaxonomy';

interface AlcoveFactsLedgerProps {
  origin?: string;
  harvest?: string | number;
  /** First liquor-color term id from item.tasting — row renders only when present. */
  liquorTermId?: string;
}

interface LedgerRow {
  key: string;
  label: string;
  value: React.ReactNode;
}

/**
 * Boxless facts ledger — one grammar for facts: small tracked uppercase sans
 * label left, serif value right, hairline between rows. No enclosing boxes.
 * Rows render only when their data exists. Price is NOT here — the commerce
 * footer is price's single home.
 */
export const AlcoveFactsLedger: React.FC<AlcoveFactsLedgerProps> = ({
  origin,
  harvest,
  liquorTermId,
}) => {
  const rows: LedgerRow[] = [];

  if (origin) rows.push({ key: 'origin', label: 'Origin', value: origin });
  if (harvest) rows.push({ key: 'harvest', label: 'Harvest', value: String(harvest) });

  const liquorHex = liquorTermId ? LIQUOR_COLORS[liquorTermId] : undefined;
  if (liquorTermId && liquorHex) {
    rows.push({
      key: 'liquor',
      label: 'Liquor',
      value: (
        <>
          <span
            aria-hidden="true"
            className="relative top-px mr-2 inline-block h-[11px] w-[11px] rounded-full border border-tea-border"
            style={{ background: liquorHex }}
          />
          {resolveTermLabel(liquorTermId)}
        </>
      ),
    });
  }

  if (rows.length === 0) return null;

  return (
    <dl className="mx-6 my-0 border-t border-tea-border">
      {rows.map(row => (
        <div
          key={row.key}
          className="grid grid-cols-[92px_1fr] items-baseline border-b border-tea-border py-2.5"
        >
          <dt className="font-sans text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim">
            {row.label}
          </dt>
          <dd className="m-0 text-right font-body text-[14.5px] leading-[1.6] text-tea-text">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};
