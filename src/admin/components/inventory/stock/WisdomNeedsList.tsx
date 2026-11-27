import React, { useMemo } from 'react';
import { GENERATED_CLAIMS } from '../../../../wisdom/reference/generatedClaims';
import { GENERATED_TEA_REFERENCE_PAGES } from '../../../../wisdom/reference/generatedPages';
import { WHY, wisdomNeeds, type WisdomNeed } from '../../../../wisdom/reference/wisdomNeeds';
import type { Product } from '../../../types';

// What the Wisdom Base holds and still needs for this tea, read from its record
// with the composer's own rules (docs/TEA_WISDOM_BASE.md). The shop sees only
// published pages, so a page still waiting for approval reads as not written
// here; `node scripts/tea-wisdom-compose/needs.mjs` on the Mac also shows drafts.
// Loaded lazily by the tea page so the Wisdom pages never weigh on the panel.

const KIND: Record<WisdomNeed['kind'], string> = {
  style: 'Style', place: 'Place', grade: 'Grade or mark', process: 'Process', producer: 'Producer', named: 'Named tea',
};
const STATE: Record<WisdomNeed['state'], string> = {
  written: 'Written', drafted: 'Drafted, not approved', record: 'Record only', missing: 'Not written',
};

export default function WisdomNeedsList({ product }: { product: Product }) {
  const needs = useMemo(() => wisdomNeeds({
    id: product.id,
    type: product.type,
    form: product.form,
    product_name: product.productName,
    given_name: product.givenName,
    chinese_name: product.chineseName,
    origin_region: product.originRegion,
    origin_country: product.originCountry,
  }, { published: { pages: GENERATED_TEA_REFERENCE_PAGES, claims: GENERATED_CLAIMS } }),
  [product.id, product.type, product.form, product.productName, product.givenName, product.chineseName, product.originRegion, product.originCountry]);

  if (needs.length === 0) return null;
  const open = needs.filter(need => !need.covered).length;
  return <div data-testid="tea-wisdom-needs">
    <p className="text-ui-13 text-admin-text-sec leading-[1.5] pb-2">
      {open === 0 ? 'Everything this tea draws on is written.' : `${open} still to write before its entry is composed.`}
    </p>
    <ul className="divide-y divide-admin-border border-y border-admin-border">
      {needs.map(need => <li key={`${need.kind}:${need.label}`} className="flex items-baseline justify-between gap-3 py-2.5">
        <span className="min-w-0">
          <span className="block text-ui-13 text-admin-text">{need.label}</span>
          <span className="block text-ui-12 text-admin-text-sec">{KIND[need.kind]}{need.covered || need.why === WHY[need.state] ? '' : `. ${need.why}`}</span>
        </span>
        <span className={`shrink-0 text-ui-12 ${need.covered ? 'text-admin-text-sec' : 'text-admin-text'}`}>{STATE[need.state]}</span>
      </li>)}
    </ul>
  </div>;
}
