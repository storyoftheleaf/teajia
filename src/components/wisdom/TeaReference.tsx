import React from 'react';
import { type NamedTea, type TeaResolution } from '../../wisdom';
import {
  resolveRecord,
  type TeaReferenceProduct,
} from '../../wisdom/productIdentity';
import { FactGrid, type Fact } from './FactGrid';
import { TeaLineage, resolveLineage } from './TeaLineage';
import { BODY, LABEL, LABEL_GAP, SECTION } from '../shared/typeRoles';

/**
 * Everything the wisdom base can say about a product, in one band.
 *
 * The page used to show the plant and nothing else the base knows, while
 * `resolveTea` was already resolving the producer, the style, the mark and
 * whether the tea is one that arrived already named. "Made by Menghai Tea
 * Factory" is a stronger fact than half of what the shop writes itself, and
 * each of these now has a public page, so the fact is a doorway rather than a
 * dead end.
 *
 * Three rules hold here:
 *   surface what is known, link what is held, show nothing where nothing resolves.
 *
 * Nothing in this band is the shop's voice. It is written once in the wisdom
 * base and improves on every product page the day it is corrected, which is why
 * one hairline opens the whole band and separates it from Adrian's own words.
 */
export { resolveRecord } from '../../wisdom/productIdentity';
export type { TeaReferenceProduct } from '../../wisdom/productIdentity';

export const producerPath = (id: string) => `/wisdom/producer/${id}`;
export const stylePath = (id: string) => `/wisdom/style/${id}`;
export const markPath = (id: string) => `/wisdom/mark/${id}`;
export const namedTeaPath = (id: string) => `/wisdom/named/${id}`;

/** One read of the base, from a product's own fields. */
/**
 * Who made it, how it was made, which line it belongs to, and the name it
 * arrived under. Declaration order is importance order: the maker is the
 * strongest of the four, and a given name is the identity of the record rather
 * than one more attribute of it, so it closes the list and the sentence that
 * explains it follows directly beneath.
 *
 * Every entry here resolved to something the reference holds a page for, so
 * every one of them is a link. A fact the base cannot resolve is absent, never
 * an empty row.
 */
export function recordFacts(resolution: TeaResolution): Fact[] {
  const facts: Fact[] = [];
  if (resolution.producer) {
    facts.push({ label: 'Made by', value: resolution.producer.name, to: producerPath(resolution.producer.id) });
  }
  if (resolution.mark) {
    facts.push({ label: 'Mark', value: resolution.mark.name, to: markPath(resolution.mark.id) });
  }
  if (resolution.style) {
    facts.push({ label: 'Style', value: resolution.style.name, to: stylePath(resolution.style.id) });
  }
  if (resolution.namedTea) {
    facts.push({ label: 'Given name', value: resolution.namedTea.name, to: namedTeaPath(resolution.namedTea.id) });
  }
  return facts;
}

/**
 * What a given name means, said plainly.
 *
 * These teas arrive already named, usually out of Chinese private collections
 * where naming a stored tea is ordinary practice. Without this line a customer
 * reads an ordinary product page with thin facts and no explanation, and thin
 * facts with no explanation read as a gap. They are not a gap. They are the
 * nature of the record, and the honest thing is to say so on the page rather
 * than let the blanks speak.
 */
export function namedTeaLine(tea: NamedTea): string {
  switch (tea.provenance) {
    case 'undisclosed':
      return 'This tea arrived already named. Its composition was never disclosed: the mountain, the village and usually the vintage went unrecorded, and the name is the identity it carries forward.';
    case 'partial':
      return 'This tea arrived already named. Part of its origin is recorded, the rest was never written down, and the name is the identity it carries forward.';
    case 'stated':
    default:
      return 'This tea arrived already named, with its origin recorded in full. The name is the identity it carries forward.';
  }
}

/**
 * The maker, the style, the mark and the given name. Renders nothing when the
 * base resolves none of them, which is the common case for a garden tea sold
 * under a shop's own name and is correct.
 */
const TeaRecord: React.FC<{ product: TeaReferenceProduct }> = ({ product }) => {
  const resolution = resolveRecord(product);
  const facts = recordFacts(resolution);
  if (!facts.length) return null;

  return (
    <section aria-labelledby="tea-record-heading" className={SECTION}>
      <h2 id="tea-record-heading" className={`${LABEL} ${LABEL_GAP} text-tea-text-dim`}>
        Provenance
      </h2>
      <FactGrid facts={facts} />
      {resolution.namedTea && (
        <p className={`${BODY} mt-3 text-tea-text-sec`}>{namedTeaLine(resolution.namedTea)}</p>
      )}
    </section>
  );
};

/**
 * One band, one hairline, whichever parts resolve.
 *
 * The plant and the provenance are the same register and sit next to each
 * other, so giving each its own rule fenced off two four-line blocks sixty
 * pixels apart. The rule marks the change from the shop's voice to the shared
 * record, and there is only one such change on the page.
 */
export const TeaReference: React.FC<{ product: TeaReferenceProduct }> = ({ product }) => {
  // Decided here rather than left to an empty wrapper, so a tea the base does
  // not recognise gets no hairline announcing a band that is not there.
  const { cultivar } = resolveLineage(product);
  const hasRecord = recordFacts(resolveRecord(product)).length > 0;
  if (!cultivar && !hasRecord) return null;

  return (
    <div className="border-t border-tea-border pt-6">
      <TeaLineage product={product} />
      <TeaRecord product={product} />
    </div>
  );
};

export default TeaReference;
