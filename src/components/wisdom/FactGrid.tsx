import React from 'react';
import { Link } from 'react-router-dom';
import { BODY, FIELD_GAP, LABEL, LINK } from '../shared/typeRoles';

/** One label/value pair. */
export interface Fact {
  label: string;
  value: string;
  /**
   * The value's own public page, when the base holds one. A fact that can be
   * followed is a doorway; a fact that cannot is a plain string and stays one.
   */
  to?: string;
}

/**
 * Values at or under this length share a row on a wide screen; longer ones take
 * the full width so a bred-from sentence never sets itself in a 190px gutter.
 */
export const SHORT_FACT_CHARS = 32;

/**
 * Short values before long ones, so the two-column grid pairs cleanly instead
 * of leaving a hole beside a spanning sentence. The sort is stable, so
 * declaration order (which is importance order) survives inside each group.
 */
export function orderFacts(facts: Fact[]): Fact[] {
  const isLong = (fact: Fact) => Number(fact.value.length > SHORT_FACT_CHARS);
  return [...facts].sort((left, right) => isLong(left) - isLong(right));
}

/**
 * The one way this page states a set of facts.
 *
 * Used by the lineage block, by the provenance block and by the brewing guide,
 * so the three read as the same kind of thing: a short column of labelled
 * values, one column at 390px and two from 640px up. Nothing here is a card, a
 * surface or a border, since a fact does not need chrome to be legible.
 *
 * A value carrying a `to` is set as a link at the page's one link setting and
 * given a 44px hit box, which is why a linked row is taller than a plain one.
 */
export const FactGrid: React.FC<{ facts: Fact[] }> = ({ facts }) => {
  if (!facts.length) return null;
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {facts.map(fact => (
        <div
          key={fact.label}
          className={fact.value.length > SHORT_FACT_CHARS ? 'sm:col-span-2' : undefined}
        >
          <dt className={`${LABEL} ${FIELD_GAP} text-tea-text-dim`}>{fact.label}</dt>
          <dd className={`${BODY} text-tea-text-sec`}>
            {fact.to ? (
              <Link to={fact.to} className={`${LINK} inline-flex min-h-[44px] items-center`}>
                {fact.value}
              </Link>
            ) : (
              fact.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
};

export default FactGrid;
