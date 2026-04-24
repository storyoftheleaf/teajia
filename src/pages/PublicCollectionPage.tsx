import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { MessageCircle, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { buildWhatsAppUrl } from '../lib/whatsapp';
import type { PublicCollectionResponse, PublicCollectionItem } from '../types';

const ROMAN = [
  '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX',
];

function toRoman(n: number): string {
  if (n <= 30) return ROMAN[n] || String(n);
  // Beyond 30 — still a reasonable format for a collection.
  return String(n);
}

const PublicCollectionPage: React.FC = () => {
  const { slug = '' } = useParams();
  const [data, setData] = useState<PublicCollectionResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'gone' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    api.collections.getPublic(slug)
      .then(res => {
        if (cancelled) return;
        setData(res);
        setStatus('ok');
      })
      .catch((err: any) => {
        if (cancelled) return;
        const msg = err?.message || '';
        if (/410|no longer available/i.test(msg)) setStatus('gone');
        else if (/404|not found/i.test(msg)) setStatus('notfound');
        else setStatus('error');
      });
    return () => { cancelled = true; };
  }, [slug]);

  // View-count: one ping per session per slug.
  useEffect(() => {
    if (status !== 'ok' || !slug) return;
    const key = `tj_c_view_${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* private mode — skip */ }
    api.collections.trackPublicView(slug).catch(() => { /* ignore */ });
  }, [status, slug]);

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <p className="text-sm text-tea-text-dim">Loading…</p>
      </main>
    );
  }

  if (status === 'notfound' || status === 'gone') {
    return (
      <main className="min-h-screen bg-tea-bg flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <p className="font-display text-[clamp(24px,3.5vw,32px)] leading-[1.2] text-tea-text mb-3" style={{ fontWeight: 500 }}>
            {status === 'gone' ? 'This collection has been put away.' : 'Not found.'}
          </p>
          <p className="font-body text-[15px] leading-[1.65] text-tea-text-sec italic">
            {status === 'gone'
              ? 'The link may have been taken down. Ask Adrian directly for a new one.'
              : 'The link you followed doesn’t lead anywhere. Check it with whoever shared it.'}
          </p>
        </div>
      </main>
    );
  }

  if (status === 'error' || !data) {
    return (
      <main className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <p className="text-sm text-red-400">Something went wrong loading this page.</p>
      </main>
    );
  }

  return (
    <>
      <Helmet>
        {/* Link-gated: keep out of search indexes. Metadata still helps when the link is shared. */}
        <meta name="robots" content="noindex, nofollow" />
        <title>{data.collection.title}</title>
        {data.collection.note && <meta name="description" content={data.collection.note.slice(0, 160)} />}
      </Helmet>
      <CollectionCatalog data={data} />
    </>
  );
};

export default PublicCollectionPage;

// ── Catalog body ────────────────────────────────────────────────────────────

const CollectionCatalog: React.FC<{ data: PublicCollectionResponse }> = ({ data }) => {
  const { collection, items, account } = data;
  const storeName = account?.name ?? 'Teajia';

  const visible = useMemo(
    () => items.filter(i => i.product_status === 'Active'),
    [items]
  );

  return (
    <main className="min-h-screen bg-tea-bg text-tea-text">
      {/* Masthead — editorial; small label, big title, italic note */}
      <header className="border-b border-tea-border">
        <div className="max-w-[720px] mx-auto px-5 sm:px-8 pt-12 pb-10 md:pt-20 md:pb-14">
          <p className="font-sans text-[11px] uppercase tracking-[1.5px] text-tea-text-dim mb-5">
            A collection from <span className="text-tea-text-sec">{storeName}</span>
          </p>
          <h1
            className="font-display text-[clamp(32px,6vw,56px)] leading-[1.08] tracking-[-0.005em] text-tea-text mb-6"
            style={{ fontWeight: 400 }}
          >
            {collection.title}
          </h1>
          {collection.note && (
            <p className="font-body text-[17px] leading-[1.7] text-tea-text-sec italic max-w-[55ch]">
              {collection.note}
            </p>
          )}
          {collection.hero_image_url && (
            <figure className="mt-10 -mx-5 sm:mx-0">
              <img
                src={collection.hero_image_url}
                alt=""
                className="w-full max-h-[50vh] object-cover sm:rounded-md"
                loading="eager"
              />
            </figure>
          )}
        </div>
      </header>

      {/* Catalog body */}
      <section className="max-w-[720px] mx-auto px-5 sm:px-8 py-10 md:py-16">
        {visible.length === 0 ? (
          <p className="font-body text-[15px] leading-[1.65] text-tea-text-sec italic py-10 text-center">
            The teas in this collection are currently unavailable.
          </p>
        ) : (
          <ol className="flex flex-col gap-14 md:gap-20">
            {visible.map((item, i) => (
              <CatalogEntry
                key={item.id}
                item={item}
                index={i + 1}
                collectionTitle={collection.title}
                whatsappNumber={account?.whatsapp_number}
              />
            ))}
          </ol>
        )}
      </section>

      <footer className="border-t border-tea-border py-10 text-center">
        <p className="font-sans text-[10px] uppercase tracking-[1.8px] text-tea-text-dim">
          {storeName} · Curated for you
        </p>
      </footer>
    </main>
  );
};

// ── One entry ───────────────────────────────────────────────────────────────

const CatalogEntry: React.FC<{
  item: PublicCollectionItem;
  index: number;
  collectionTitle: string;
  whatsappNumber?: string | null;
}> = ({ item, index, collectionTitle, whatsappNumber }) => {
  const oos = item.out_of_stock;
  const tastingList = Array.isArray(item.tasting_notes) ? item.tasting_notes : [];

  const msg = oos
    ? `Hi — I saw ${item.product_name} in your "${collectionTitle}" collection. Is it available again?`
    : `Hi — I'd like to know more about ${item.product_name} from your "${collectionTitle}" collection.`;

  const href = buildWhatsAppUrl(whatsappNumber ?? '', msg);
  const origin = [item.origin_region, item.origin_country].filter(Boolean).join(', ');

  return (
    <li className="flex flex-col gap-5">
      <div className="flex items-baseline gap-4">
        <span className="font-display text-[17px] tabular-nums tracking-[0.05em] text-tea-gold" style={{ fontWeight: 500 }}>
          {toRoman(index)}.
        </span>
        <div className="flex-1 min-w-0">
          <h2
            className="font-display text-[clamp(22px,3.2vw,28px)] leading-[1.2] tracking-[-0.005em] text-tea-text"
            style={{ fontWeight: 400 }}
          >
            {item.product_name}
            {item.chinese_name && (
              <span className="block sm:inline font-body italic text-[15px] sm:ml-3 text-tea-text-sec mt-1 sm:mt-0" style={{ fontWeight: 300 }}>
                {item.chinese_name}
              </span>
            )}
          </h2>
          {(origin || item.year) && (
            <p className="font-sans text-[10px] uppercase tracking-[1.5px] text-tea-text-dim mt-2">
              {[origin, item.year].filter(Boolean).join(' · ')}
              {oos && (
                <span className="ml-3 inline-flex items-center gap-1 text-tea-text-sec">
                  <AlertCircle size={10} /> currently unavailable
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {item.image_url && (
        <figure className="pl-[42px]">
          <img
            src={item.image_url}
            alt=""
            className="block w-full max-w-[420px] rounded-sm"
            loading="lazy"
          />
        </figure>
      )}

      <div className="pl-[42px] max-w-[60ch]">
        {item.description && (
          <p className="font-body text-[15px] leading-[1.75] text-tea-text mb-4">
            {item.description}
          </p>
        )}

        {tastingList.length > 0 && (
          <p className="font-sans text-[11px] uppercase tracking-[1.3px] text-tea-text-sec mb-5">
            {tastingList.slice(0, 6).join(' · ')}
          </p>
        )}

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-tea-gold text-tea-bg rounded-md text-[12px] font-medium tracking-[0.3px] hover:bg-tea-gold-lt transition-colors"
        >
          <MessageCircle size={13} />
          {oos ? 'Ask about availability' : 'Request via WhatsApp'}
        </a>
      </div>
    </li>
  );
};
