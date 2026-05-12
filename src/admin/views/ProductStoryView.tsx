/**
 * ProductStoryView — /admin/products/:id/story
 *
 * A read-only, top-to-bottom editorial view of a single product's life:
 *   1. Origin — compass entry / sourcing data
 *   2. Arrival — stock ledger timeline
 *   3. First session — earliest event this tea was served at
 *   4. Guest reactions — tasting notes + key flavor words
 *   5. Available now — current stock status + add-to-invoice action
 *
 * This is not an edit form.  It should read like an essay.
 */

import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';
import { useAppStore } from '../store';
import type { Product } from '../types';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

interface LedgerEntry {
  id: string;
  product_id: string;
  change_g: number;
  reason?: string;
  reference?: string;
  created_at: string;
}

interface EventRef {
  id: string;
  title: string;
  eventDate: string;
  slug?: string;
}

interface TastingNote {
  id: string;
  impression?: string;
  rating?: number;
  attendeeName?: string;
  teaName?: string;
  createdAt?: string;
  created_at?: string;
}

interface CompassEntry {
  id: string;
  name?: string;
  origin?: string;
  vendor?: string;
  vendorId?: string;
  fieldQuality?: number;
  sourcingNotes?: string;
  notes?: string;
  createdAt?: string;
  created_at?: string;
  status?: string;
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/** Pull the most frequent flavor/impression words from tasting notes. */
function extractFlavorWords(notes: TastingNote[]): string[] {
  const stop = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'it', 'is', 'was', 'very', 'quite', 'this', 'that',
    'nice', 'good', 'great', 'really', 'bit', 'tea', 'felt', 'feel',
  ]);
  const freq: Record<string, number> = {};
  for (const n of notes) {
    if (!n.impression) continue;
    n.impression
      .toLowerCase()
      .replace(/[^a-z\s'-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stop.has(w))
      .forEach(w => { freq[w] = (freq[w] ?? 0) + 1; });
  }
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([w]) => w);
}

function stockStatusLabel(g: number): { label: string; color: string } {
  if (g <= 0) return { label: 'Out of stock', color: 'text-tea-error' };
  if (g < 100) return { label: 'Low stock', color: 'text-tea-gold' };
  return { label: 'In stock', color: 'text-tea-text' };
}

// ────────────────────────────────────────────────────────
// Narrative prose generator
// ────────────────────────────────────────────────────────

function buildNarrative(params: {
  product: Product;
  compass: CompassEntry | null;
  firstLedger: LedgerEntry | null;
  firstEvent: EventRef | null;
  noteCount: number;
  flavorWords: string[];
}): string {
  const { product, compass, firstLedger, firstEvent, noteCount, flavorWords } = params;
  const parts: string[] = [];

  // Origin
  if (compass) {
    const origin = compass.origin || [product.originRegion, product.originCountry].filter(Boolean).join(', ');
    const when = compass.createdAt || compass.created_at;
    const whenStr = when ? ` in ${formatMonthYear(when)}` : '';
    parts.push(`This tea was first encountered in ${origin}${whenStr}.`);
    if (compass.sourcingNotes || compass.notes) {
      parts.push(compass.sourcingNotes || compass.notes || '');
    }
  } else {
    const origin = [product.originRegion, product.originCountry].filter(Boolean).join(', ');
    if (origin) parts.push(`Sourced from ${origin}.`);
  }

  // Arrival
  if (firstLedger) {
    const kg = (firstLedger.change_g / 1000).toFixed(2);
    parts.push(`It arrived in ${formatMonthYear(firstLedger.created_at)} — ${kg} kg in the first delivery.`);
  }

  // First session
  if (firstEvent) {
    parts.push(
      `This tea was first served at ${firstEvent.title} on ${formatDate(firstEvent.eventDate)}.`
    );
  }

  // Guest reactions
  if (noteCount > 0 && flavorWords.length > 0) {
    const topWords = flavorWords.slice(0, 5).join(', ');
    parts.push(
      `${noteCount} guest${noteCount !== 1 ? 's' : ''} shared their impressions. ` +
      `The words that came up most often: ${topWords}.`
    );
  }

  return parts.filter(Boolean).join(' ');
}

// ────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────

const Divider: React.FC = () => (
  <div className="border-t border-tea-border my-12" />
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="label-caps text-tea-text-sec mb-4">
    {children}
  </p>
);

const TimelineEntry: React.FC<{
  date: string;
  label: string;
  note?: string;
  isFirst?: boolean;
  index: number;
}> = ({ date, label, note, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -6 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
    className="flex gap-4"
  >
    <div className="flex flex-col items-center">
      <div className="w-2 h-2 rounded-full bg-tea-gold mt-1.5 shrink-0" />
      <div className="w-[1px] bg-tea-border flex-1 mt-1" />
    </div>
    <div className="pb-6 min-w-0 flex-1">
      <p className="label-caps text-tea-text-dim mb-0.5">
        {date}
      </p>
      <p className="text-ui-14 text-tea-text">{label}</p>
      {note && (
        <p className="text-ui-12 text-tea-text-sec mt-1 italic">{note}</p>
      )}
    </div>
  </motion.div>
);

const FlavorCloud: React.FC<{ words: string[] }> = ({ words }) => (
  <div className="flex flex-wrap gap-2">
    {words.map((w, i) => (
      <motion.span
        key={w}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: i * 0.04 }}
        className={`px-3 py-1.5 text-ui-12 font-serif italic rounded-md ${
          i === 0
            ? 'bg-tea-gold/10 text-tea-text ring-1 ring-tea-gold/40'
            : i < 4
            ? 'bg-tea-surface text-tea-text'
            : 'bg-tea-bg text-tea-text-sec border border-tea-border'
        }`}
      >
        {w}
      </motion.span>
    ))}
  </div>
);

// ────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────

export const ProductStoryView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openPurchaseOrder } = useAppStore();

  // ── Product ───────────────────────────────────────────
  const { data: productsRaw } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.products.list(),
    staleTime: 60_000,
  });
  const products: Product[] = Array.isArray(productsRaw) ? productsRaw : [];
  const product = products.find(p => p.id === id);

  // ── Stock ledger ──────────────────────────────────────
  const { data: ledgerRaw } = useQuery({
    queryKey: ['stock-ledger', id],
    queryFn: () => api.stockLedger.list(id, 50, 0),
    enabled: !!id,
    staleTime: 60_000,
  });
  const ledger: LedgerEntry[] = Array.isArray(ledgerRaw)
    ? ledgerRaw
    : (ledgerRaw as any)?.entries ?? [];

  // ── Events this tea was served at ────────────────────
  const { data: eventsRaw = [] } = useQuery({
    queryKey: ['product-events', id],
    queryFn: () => api.products.getEvents(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
  const events: EventRef[] = Array.isArray(eventsRaw) ? eventsRaw : [];

  // ── Compass entry (sourcing origin) ──────────────────
  const { data: compassRaw = [] } = useQuery({
    queryKey: ['compass-entries'],
    queryFn: () => api.compass.list(),
    staleTime: 60_000,
  });
  const compassEntries: CompassEntry[] = Array.isArray(compassRaw) ? compassRaw : [];
  const compass: CompassEntry | null = product?.sourceCompassEntryId
    ? (compassEntries.find(e => e.id === product.sourceCompassEntryId) ?? null)
    : null;

  // ── Tasting notes across all events ──────────────────
  // We'll collect notes from the first event's admin endpoint as a proxy
  const { data: tastingNotesRaw = [] } = useQuery({
    queryKey: ['product-tasting-notes', events[0]?.id],
    queryFn: () => api.events.getTastingNotes(events[0]!.id),
    enabled: events.length > 0,
    staleTime: 60_000,
  });
  const allTastingNotes: TastingNote[] = useMemo(() => {
    const raw = Array.isArray(tastingNotesRaw) ? tastingNotesRaw : [];
    // Keep notes where teaName matches product name (rough filter)
    if (!product) return raw;
    const name = (product.givenName || product.productName || '').toLowerCase();
    return raw.filter((n: TastingNote) =>
      !n.teaName || n.teaName.toLowerCase().includes(name) || name.includes(n.teaName?.toLowerCase() ?? '')
    );
  }, [tastingNotesRaw, product]);

  // ── Derived data ──────────────────────────────────────
  const firstLedger = useMemo(() => {
    if (ledger.length === 0) return null;
    return [...ledger].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0];
  }, [ledger]);

  const firstEvent = useMemo(() => {
    if (events.length === 0) return null;
    return [...events].sort(
      (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    )[0];
  }, [events]);

  const flavorWords = useMemo(() => extractFlavorWords(allTastingNotes), [allTastingNotes]);

  const narrative = useMemo(() => {
    if (!product) return '';
    return buildNarrative({
      product,
      compass,
      firstLedger,
      firstEvent,
      noteCount: allTastingNotes.length,
      flavorWords,
    });
  }, [product, compass, firstLedger, firstEvent, allTastingNotes.length, flavorWords]);

  const stockStatus = product ? stockStatusLabel(product.stockGrams ?? 0) : null;

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────

  if (!product) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center">
          <p className="h3 mb-2">Tea not found</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Go back</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-tea-bg">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors mb-10"
        >
          <ArrowLeft size={13} />
          <span>Back</span>
        </button>

        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-12"
        >
          <p className="label-caps text-tea-text-dim mb-3">
            Product{product.givenName ? ` · ${product.givenName}` : ''}
          </p>

          {product.imageUrl && (
            <div className="w-20 h-20 rounded-full overflow-hidden border border-tea-border mb-6">
              <img
                src={product.imageUrl}
                alt={product.givenName}
                className="w-full h-full object-cover opacity-90"
              />
            </div>
          )}

          <h1 className="h1 mb-2">The story</h1>
          <p className="h2 text-tea-text-sec mb-2">
            {product.givenName}
          </p>
          {product.chineseName && (
            <p className="subtitle mb-2">
              {product.chineseName}
            </p>
          )}
          <div className="w-8 h-[1px] bg-tea-gold mb-5" />
          <p className="text-ui-14 text-tea-text-sec">
            {[product.type, product.year, product.originRegion, product.originCountry]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </motion.div>

        {/* Narrative prose */}
        {narrative && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-12"
          >
            <p className="body-prose">
              {narrative}
            </p>
          </motion.div>
        )}

        <Divider />

        {/* 1. Origin */}
        {(compass || product.originRegion || product.originCountry) && (
          <section className="mb-12">
            <SectionLabel>Origin</SectionLabel>

            {compass && (
              <div className="space-y-4">
                {compass.origin && (
                  <div>
                    <p className="label-caps text-tea-text-dim mb-1">Location found</p>
                    <p className="text-ui-16 font-serif text-tea-text">{compass.origin}</p>
                  </div>
                )}
                {compass.vendor && (
                  <div>
                    <p className="label-caps text-tea-text-dim mb-1">Vendor</p>
                    <p className="text-ui-16 font-serif text-tea-text">{compass.vendor}</p>
                  </div>
                )}
                {compass.fieldQuality !== undefined && (
                  <div>
                    <p className="label-caps text-tea-text-dim mb-1">Field quality</p>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className={`text-ui-11 ${i < (compass.fieldQuality ?? 0) ? 'text-tea-gold' : 'text-tea-border'}`}
                        >
                          ●
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(compass.sourcingNotes || compass.notes) && (
                  <div>
                    <p className="label-caps text-tea-text-dim mb-1">Sourcing notes</p>
                    <p className="subtitle">
                      {compass.sourcingNotes || compass.notes}
                    </p>
                  </div>
                )}
                {(compass.createdAt || compass.created_at) && (
                  <p className="text-ui-12 text-tea-text-dim">
                    First encountered {formatDate(compass.createdAt || compass.created_at || '')}
                  </p>
                )}
              </div>
            )}

            {!compass && (product.originRegion || product.originCountry) && (
              <p className="text-ui-16 font-serif text-tea-text">
                {[product.originRegion, product.originCountry].filter(Boolean).join(', ')}
              </p>
            )}

            {product.terroir && (
              <p className="mt-4 subtitle">
                {product.terroir}
              </p>
            )}
          </section>
        )}

        {/* 2. Arrival — stock ledger timeline */}
        {ledger.length > 0 && (
          <>
            <Divider />
            <section className="mb-12">
              <SectionLabel>Arrival</SectionLabel>
              <div className="mt-2">
                {[...ledger]
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .slice(0, 8)
                  .map((entry, i) => (
                    <TimelineEntry
                      key={entry.id}
                      date={formatDate(entry.created_at)}
                      label={`${entry.change_g > 0 ? '+' : ''}${entry.change_g.toLocaleString()}g`}
                      note={entry.reason || entry.reference}
                      index={i}
                    />
                  ))}
              </div>
              {ledger.length > 8 && (
                <p className="text-ui-12 text-tea-text-dim ml-6 mt-2">
                  + {ledger.length - 8} more movements
                </p>
              )}
            </section>
          </>
        )}

        {/* 3. First session */}
        {firstEvent && (
          <>
            <Divider />
            <section className="mb-12">
              <SectionLabel>First session</SectionLabel>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <p className="h2 mb-1">
                  {firstEvent.title}
                </p>
                <p className="text-ui-14 text-tea-text-sec">
                  {formatDate(firstEvent.eventDate)}
                </p>
                {events.length > 1 && (
                  <p className="text-ui-12 text-tea-text-dim mt-3">
                    Also served at {events.length - 1} other gathering{events.length - 1 !== 1 ? 's' : ''}.
                  </p>
                )}
              </motion.div>
            </section>
          </>
        )}

        {/* 4. Guest reactions */}
        {allTastingNotes.length > 0 && (
          <>
            <Divider />
            <section className="mb-12">
              <SectionLabel>Guest reactions</SectionLabel>

              {flavorWords.length > 0 && (
                <div className="mb-8">
                  <p className="text-xs text-tea-text-dim mb-4">
                    Most common words across {allTastingNotes.length} tasting note{allTastingNotes.length !== 1 ? 's' : ''}
                  </p>
                  <FlavorCloud words={flavorWords} />
                </div>
              )}

              <div className="space-y-5 mt-6">
                {allTastingNotes.filter(n => n.impression).slice(0, 6).map((note, i) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="border-l border-tea-border pl-5"
                  >
                    <p className="font-serif italic text-sm text-tea-text leading-relaxed mb-2">
                      "{note.impression}"
                    </p>
                    <div className="flex items-center gap-3">
                      {note.attendeeName && (
                        <p className="text-xs text-tea-text-dim">{note.attendeeName}</p>
                      )}
                      {note.rating !== undefined && note.rating !== null && (
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <span
                              key={j}
                              className={`text-ui-10 ${j < note.rating! ? 'text-tea-gold' : 'text-tea-border'}`}
                            >
                              ●
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {allTastingNotes.filter(n => n.impression).length > 6 && (
                  <p className="text-xs text-tea-text-dim">
                    + {allTastingNotes.filter(n => n.impression).length - 6} more notes
                  </p>
                )}
              </div>
            </section>
          </>
        )}

        {/* 5. Available now */}
        <Divider />
        <section className="mb-12">
          <SectionLabel>Available now</SectionLabel>

          <div className="bg-tea-surface border border-tea-border rounded-sm p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
              <div>
                <p className="text-xs text-tea-text-dim mb-1">Current stock</p>
                <p className="font-serif text-2xl text-tea-text num">
                  {(product.stockGrams ?? 0).toLocaleString()}g
                </p>
              </div>
              <div>
                <p className="text-xs text-tea-text-dim mb-1">Price/g</p>
                <p className="font-serif text-2xl text-tea-text num">
                  ${product.pricePerGramUSD.toFixed(3)}
                </p>
              </div>
              <div>
                <p className="text-xs text-tea-text-dim mb-1">Status</p>
                <p className={`font-serif text-base ${stockStatus?.color ?? 'text-tea-text'}`}>
                  {stockStatus?.label}
                </p>
              </div>
            </div>

            {(product.stockGrams ?? 0) > 0 && (
              <button
                onClick={() => {
                  openPurchaseOrder();
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-tea-gold text-tea-bg text-xs hover:bg-tea-gold-lt transition-colors"
              >
                <ShoppingBag size={13} />
                Add to invoice
              </button>
            )}
          </div>

          {product.processingNotes && (
            <p className="mt-4 text-xs text-tea-text-sec leading-relaxed">
              {product.processingNotes}
            </p>
          )}
        </section>

        {/* Description / lore */}
        {(product.lore || product.description) && (
          <>
            <Divider />
            <section className="mb-12">
              <SectionLabel>{product.lore ? 'Lore' : 'Description'}</SectionLabel>
              <p className="font-serif text-sm text-tea-text-sec leading-relaxed">
                {product.lore || product.description}
              </p>
            </section>
          </>
        )}

        {/* Footer */}
        <div className="border-t border-tea-border pt-8 text-center">
          <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec/30">
            Teajia · Product Archive
          </p>
        </div>

      </div>
    </div>
  );
};

export default ProductStoryView;
