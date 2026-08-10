import React, { useEffect, useMemo, useState } from 'react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { normalizeProduct } from '../../lib/storefrontApi';
import type { PublicProduct } from '../../types';
import type {
  PrivateReviewItem,
  PrivateReviewProductCandidate,
  WebsiteReceivingPrivateReview,
} from '../../wisdom/receiving/previewImporter';
import { buildInventoryBackedReferenceCandidates } from '../../wisdom/reference/catalogue';

export type TeaReferenceTriageDecision = 'ready' | 'needs-edit' | 'keep-held';
export type TeaReferenceTriage = Record<string, TeaReferenceTriageDecision>;

export function decideTeaReferenceReview(
  current: TeaReferenceTriage,
  resourceId: string,
  decision: TeaReferenceTriageDecision,
): TeaReferenceTriage {
  return { ...current, [resourceId]: decision };
}

export async function fetchTeaReferencePrivateReview(): Promise<WebsiteReceivingPrivateReview> {
  const response = await fetch('/__tea-reference-review', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Tea Reference private review could not be loaded.');
  const packet = await response.json() as WebsiteReceivingPrivateReview;
  if (
    packet?.manifest?.schemaVersion !== 1
    || packet.manifest.mode !== 'private-review'
    || !Array.isArray(packet.items)
  ) {
    throw new Error('Tea Reference private review returned an unsupported response.');
  }
  return packet;
}

type ResourceFilter = 'all' | 'entity' | 'fact';

interface TeaReferenceReviewViewProps {
  initialPacket?: WebsiteReceivingPrivateReview;
  initialProducts?: PublicProduct[];
}

const FILTERS: Array<{ id: ResourceFilter; label: string }> = [
  { id: 'all', label: 'All held work' },
  { id: 'entity', label: 'Held entities' },
  { id: 'fact', label: 'Held facts' },
];

const TRIAGE_OPTIONS: Array<{ id: TeaReferenceTriageDecision; label: string }> = [
  { id: 'ready', label: 'Ready' },
  { id: 'needs-edit', label: 'Needs edit' },
  { id: 'keep-held', label: 'Keep held' },
];

function readableToken(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function readableCandidate(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'No candidate value';
  if (!value || typeof value !== 'object') return String(value);
  const readerFacing = Object.fromEntries(
    Object.entries(value).filter(([key]) => !/id$/i.test(key)),
  );
  return Object.keys(readerFacing).length > 0
    ? JSON.stringify(readerFacing, null, 2)
    : 'No reader-facing candidate details';
}

function normalizedReviewText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function containsReviewTerm(value: string, term: string): boolean {
  const haystack = normalizedReviewText(value);
  const needle = normalizedReviewText(term);
  return Boolean(needle) && ` ${haystack} `.includes(` ${needle} `);
}

function isCurrentSellableTea(product: PublicProduct): boolean {
  return product.status === 'Active'
    && !product.isPersonal
    && product.stockGrams > 0
    && (Number(product.pricePerGramUSD) > 0 || Number(product.fixedRetailPriceUSD) > 0);
}

export function currentProductReviewFor(
  subject: string,
  products: readonly PublicProduct[],
): PrivateReviewProductCandidate[] {
  const fields = ['givenName', 'productName', 'type', 'originCountry', 'originRegion'] as const;
  return products
    .filter(isCurrentSellableTea)
    .flatMap(product => {
      const matchBasis = fields.filter(field => containsReviewTerm(product[field], subject));
      if (matchBasis.length === 0) return [];
      return [{
        productId: product.id,
        label: product.givenName || product.productName || product.id,
        type: product.type,
        ...(product.year === undefined ? {} : { year: product.year }),
        originCountry: product.originCountry,
        originRegion: product.originRegion,
        status: product.status,
        matchBasis: [...matchBasis],
      }];
    })
    .sort((left, right) => left.productId < right.productId ? -1 : left.productId > right.productId ? 1 : 0);
}

function ReviewCard({
  item,
  decision,
  onDecision,
  products,
}: {
  item: PrivateReviewItem;
  decision?: TeaReferenceTriageDecision;
  onDecision: (decision: TeaReferenceTriageDecision) => void;
  products: readonly PublicProduct[];
}) {
  const currentProductCandidates = currentProductReviewFor(item.subject, products);
  return (
    <article className="min-w-0 rounded-md border border-tea-border bg-tea-surface p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-gold`}>{item.resourceType}</span>
            <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>{readableToken(item.status)}</span>
          </div>
          <h2 className={`${TYPOGRAPHY_CLASSES.h3} break-words text-tea-text`}>{item.subject}</h2>
          <p className={`${TYPOGRAPHY_CLASSES.label} mt-1 break-words text-tea-text-dim`}>
            {readableToken(item.entityKind)} · {readableToken(item.websiteHolding)}
          </p>
        </div>
        <span className={`${TYPOGRAPHY_CLASSES.label} rounded-full border border-tea-border bg-tea-accent-sub px-2 py-1 text-tea-text-sec`}>
          {decision ? TRIAGE_OPTIONS.find(option => option.id === decision)?.label : 'No session decision'}
        </span>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-2">
        <section className="min-w-0 rounded-md border border-tea-border bg-tea-bg p-4">
          <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Held state</h3>
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 break-words text-tea-text-sec`}>{item.reviewReason}</p>
          <dl className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-4 grid gap-2 text-tea-text-sec`}>
            {item.scope && <div><dt className="inline text-tea-text-dim">Scope: </dt><dd className="inline">{readableToken(item.scope)}</dd></div>}
            {item.field && <div><dt className="inline text-tea-text-dim">Field: </dt><dd className="inline">{item.field}</dd></div>}
            <div><dt className="inline text-tea-text-dim">Candidate: </dt><dd className="whitespace-pre-wrap break-words">{readableCandidate(item.candidateValue)}</dd></div>
          </dl>
        </section>

        <section className="min-w-0 rounded-md border border-tea-border bg-tea-bg p-4">
          <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Proposed public wording</h3>
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 break-words text-tea-text`}>
            {item.proposedPublicWording ?? 'Entity resolution only. No public wording is proposed.'}
          </p>
        </section>

        <section className="min-w-0 rounded-md border border-tea-border bg-tea-bg p-4">
          <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Hierarchy context</h3>
          <dl className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 grid gap-2 text-tea-text-sec`}>
            {item.hierarchy.level && <div><dt className="inline text-tea-text-dim">Level: </dt><dd className="inline">{readableToken(item.hierarchy.level)}</dd></div>}
            <div>
              <dt className="inline text-tea-text-dim">Parent: </dt>
              <dd className="inline">{item.hierarchy.parent ? `${item.hierarchy.parent.label} (${readableToken(item.hierarchy.parent.entityKind)})` : 'No verified parent'}</dd>
            </div>
            <div>
              <dt className="inline text-tea-text-dim">Children: </dt>
              <dd className="inline">{item.hierarchy.children.length > 0
                ? item.hierarchy.children.map(child => `${child.label} (${readableToken(child.entityKind)})`).join(', ')
                : 'None in this handoff'}</dd>
            </div>
            {item.hierarchy.issue && <div><dt className="inline text-tea-text-dim">Issue: </dt><dd className="inline">{item.hierarchy.issue}</dd></div>}
          </dl>
        </section>

        <section className="min-w-0 rounded-md border border-tea-border bg-tea-bg p-4">
          <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Current shop context</h3>
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 break-words text-tea-text-sec`}>
            Live preview context only · Match terms: {item.productReview.matchTerms.join(', ') || 'None'}
          </p>
          {currentProductCandidates.length > 0 ? (
            <ul className="mt-3 grid gap-2">
              {currentProductCandidates.map(candidate => (
                <li key={candidate.productId} className="min-w-0 border-t border-tea-border pt-2">
                  <p className={`${TYPOGRAPHY_CLASSES.bodyLight} break-words text-tea-text`}>
                    {candidate.label}{candidate.year ? ` · ${candidate.year}` : ''} · {candidate.type}
                  </p>
                  <p className={`${TYPOGRAPHY_CLASSES.label} mt-1 break-words text-tea-text-dim`}>
                    {candidate.originRegion || candidate.originCountry} · {candidate.status} · Matched by {candidate.matchBasis.join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-3 text-tea-text-dim`}>No catalogue candidate matched.</p>
          )}
        </section>
      </div>

      <section className="mt-4 min-w-0 rounded-md border border-tea-border bg-tea-bg p-4">
        <h3 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Exact source evidence</h3>
        {item.evidence.length > 0 ? (
          <div className="mt-3 grid min-w-0 gap-4">
            {item.evidence.map(evidence => (
              <figure key={evidence.evidenceId} className="min-w-0 border-l-2 border-tea-border pl-3">
                <blockquote className={`${TYPOGRAPHY_CLASSES.bodyLight} whitespace-pre-wrap break-words text-tea-text`}>
                  {evidence.exact}
                </blockquote>
                {(evidence.prefix || evidence.suffix) && (
                  <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 whitespace-pre-wrap break-words text-tea-text-dim`}>
                    Context: {evidence.prefix}[evidence]{evidence.suffix}
                  </p>
                )}
                <figcaption className={`${TYPOGRAPHY_CLASSES.label} mt-3 break-words text-tea-text-dim`}>
                  {evidence.citation.publisher}, {evidence.citation.title}
                  {evidence.heading ? ` · ${evidence.heading}` : ''}
                  {evidence.section ? ` · ${evidence.section}` : ''}
                </figcaption>
                <a
                  href={evidence.citation.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${TYPOGRAPHY_CLASSES.link} mt-1 inline-flex min-h-11 items-center break-all text-tea-gold hover:text-tea-gold-lt`}
                >
                  Open source
                </a>
              </figure>
            ))}
          </div>
        ) : (
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 text-tea-text-dim`}>
            No claim evidence is attached to this entity. Review its held facts below.
          </p>
        )}
      </section>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={`Session triage for ${item.subject}`}>
        {TRIAGE_OPTIONS.map(option => (
          <button
            key={option.id}
            type="button"
            aria-pressed={decision === option.id}
            onClick={() => onDecision(option.id)}
            className={`${TYPOGRAPHY_CLASSES.link} min-h-11 rounded-md border px-3 transition-colors ${
              decision === option.id
                ? 'border-tea-gold bg-tea-gold/10 text-tea-gold'
                : 'border-tea-border text-tea-text-sec hover:border-tea-gold hover:text-tea-text'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </article>
  );
}

export const TeaReferenceReviewView: React.FC<TeaReferenceReviewViewProps> = ({ initialPacket, initialProducts }) => {
  const [packet, setPacket] = useState<WebsiteReceivingPrivateReview | null>(initialPacket ?? null);
  const [products, setProducts] = useState<PublicProduct[]>(initialProducts ?? []);
  const [productContextError, setProductContextError] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<ResourceFilter>('all');
  const [triage, setTriage] = useState<TeaReferenceTriage>({});

  useEffect(() => {
    if (initialPacket) return;
    let cancelled = false;
    fetchTeaReferencePrivateReview()
      .then(next => { if (!cancelled) setPacket(next); })
      .catch(() => { if (!cancelled) setError('Tea Reference private review could not be loaded.'); });
    return () => { cancelled = true; };
  }, [initialPacket]);

  useEffect(() => {
    if (initialProducts) return;
    let cancelled = false;
    fetch('/api/products/public', { method: 'GET', headers: { Accept: 'application/json' } })
      .then(async response => {
        if (!response.ok) throw new Error('catalogue unavailable');
        const raw = await response.json();
        if (!Array.isArray(raw)) throw new Error('catalogue unsupported');
        return raw.map(normalizeProduct);
      })
      .then(next => { if (!cancelled) setProducts(next); })
      .catch(() => { if (!cancelled) setProductContextError(true); });
    return () => { cancelled = true; };
  }, [initialProducts]);

  const items = useMemo(
    () => (packet?.items ?? []).filter(item => filter === 'all' || item.resourceType === filter),
    [filter, packet],
  );
  const inventoryCandidates = useMemo(
    () => buildInventoryBackedReferenceCandidates(products),
    [products],
  );

  if (error) {
    return (
      <section className="pb-nav-gap min-h-full bg-tea-bg p-4 text-tea-text md:p-6">
        <h1 className={TYPOGRAPHY_CLASSES.h2}>Tea Reference review</h1>
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-3 text-tea-text-sec`}>{error}</p>
      </section>
    );
  }

  if (!packet) {
    return (
      <section className="pb-nav-gap min-h-full bg-tea-bg p-4 text-tea-text md:p-6">
        <h1 className={TYPOGRAPHY_CLASSES.h2}>Tea Reference review</h1>
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-3 text-tea-text-sec`}>Loading private review packet.</p>
      </section>
    );
  }

  return (
    <section className="pb-nav-gap min-h-full bg-tea-bg p-4 text-tea-text md:p-6">
      <header className="max-w-4xl">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-gold`}>Local preview only</p>
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} mt-1`}>Tea Reference review</h1>
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 text-tea-text-sec`}>
          Review held research beside its exact evidence, proposed wording, hierarchy, and catalogue matches.
        </p>
        <p className={`${TYPOGRAPHY_CLASSES.label} mt-3 rounded-md border border-tea-border bg-tea-accent-sub px-3 py-2 text-tea-text-sec`}>
          Session only. Ready, Needs edit, and Keep held decisions are not saved and disappear when this screen closes.
        </p>
      </header>

      <section className="mt-5 max-w-5xl rounded-md border border-tea-border bg-tea-surface p-4 md:p-5">
        <h2 className={TYPOGRAPHY_CLASSES.h3}>Inventory-backed reference gaps</h2>
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 text-tea-text-sec`}>
          These controlled tea types have currently sellable lots, but no reviewed family/type entry or cited reference facts. They remain private candidates.
        </p>
        {productContextError ? (
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-3 text-tea-text-dim`}>Current shop context could not be loaded.</p>
        ) : inventoryCandidates.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {inventoryCandidates.map(candidate => (
              <article key={candidate.canonicalType} className="min-w-0 rounded-md border border-tea-border bg-tea-bg p-3">
                <h3 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{candidate.canonicalType}</h3>
                <p className={`${TYPOGRAPHY_CLASSES.label} mt-1 text-tea-text-dim`}>{candidate.lots.length} sellable {candidate.lots.length === 1 ? 'lot' : 'lots'}</p>
                <ul className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 grid gap-1 text-tea-text-sec`}>
                  {candidate.lots.map(lot => (
                    <li key={lot.productId} className="break-words">{lot.displayName}{lot.year ? ` · ${lot.year}` : ''}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-3 text-tea-text-dim`}>No additional sellable tea types need review.</p>
        )}
      </section>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Review item filter">
        {FILTERS.map(option => {
          const count = option.id === 'all'
            ? packet.items.length
            : packet.items.filter(item => item.resourceType === option.id).length;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
              className={`${TYPOGRAPHY_CLASSES.link} min-h-11 rounded-md border px-3 transition-colors ${
                filter === option.id
                  ? 'border-tea-gold bg-tea-gold/10 text-tea-gold'
                  : 'border-tea-border text-tea-text-sec hover:border-tea-gold hover:text-tea-text'
              }`}
            >
              {option.label} · {count}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid min-w-0 gap-4">
        {items.map(item => (
          <ReviewCard
            key={`${item.resourceType}:${item.resourceId}`}
            item={item}
            decision={triage[item.resourceId]}
            onDecision={decision => setTriage(current => decideTeaReferenceReview(current, item.resourceId, decision))}
            products={products}
          />
        ))}
      </div>
    </section>
  );
};

export default TeaReferenceReviewView;
