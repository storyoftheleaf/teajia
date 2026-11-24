import React from 'react';
import { Link } from 'react-router-dom';
import type { PublicClaim } from '../../../wisdom/reference/claims';
import { entryLinkFor, entrySegments, type ComposedEntry, type ComposedParagraph } from '../../../wisdom/reference/composedEntry';
import { BODY, LABEL, LABEL_GAP, LINK } from '../../shared/typeRoles';

const Prose: React.FC<{ paragraph: ComposedParagraph; claims: readonly PublicClaim[]; className?: string }> = ({ paragraph, claims, className = '' }) => (
  <p className={`${BODY} m-0 [overflow-wrap:anywhere] ${className}`} data-entry-layer={paragraph.layer}>
    {entrySegments(paragraph.text).map((segment, index) => {
      const href = segment.claimId ? entryLinkFor(segment.claimId, claims) : null;
      return href
        ? <Link key={index} to={href} className={LINK} data-claim-id={segment.claimId}>{segment.text}</Link>
        : <React.Fragment key={index}>{segment.text}</React.Fragment>;
    })}
  </p>
);

/**
 * The tea's one written entry: its story first, then what people often notice about
 * the style, then brewing. Replaces the stacked Wisdom passages.
 */
export const AlcoveComposedEntry: React.FC<{ entry: ComposedEntry; claims: readonly PublicClaim[] }> = ({ entry, claims }) => (
  <section className="mx-4 mt-6 grid gap-4 border-t border-tea-border py-5" aria-label="About this tea" data-composed-entry={entry.productId}>
    {entry.paragraphs.map((paragraph, index) => (
      <Prose key={index} paragraph={paragraph} claims={claims} className="text-tea-text" />
    ))}
    {entry.notice && (
      <div className="mt-2 min-w-0">
        <h3 className={`${LABEL} ${LABEL_GAP} m-0 text-tea-text-dim`}>What people often notice in {entry.notice.styleName}</h3>
        <Prose paragraph={entry.notice} claims={claims} className="text-tea-text-sec" />
      </div>
    )}
    {entry.brewing && (
      <div className="mt-2 min-w-0">
        <h3 className={`${LABEL} ${LABEL_GAP} m-0 text-tea-text-dim`}>Brewing</h3>
        <Prose paragraph={entry.brewing} claims={claims} className="text-tea-text" />
      </div>
    )}
  </section>
);
