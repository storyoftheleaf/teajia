import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Package } from 'lucide-react';
import { api, type PublicShelfItem } from '../lib/api';

// Stock spine step 5: the standalone public shelf at /u/<slug>. A person's
// private cellar, published with Adrian's permission. Shelf-first: the seller's
// tea + a direct WhatsApp order, nothing else. Teajia does not take the order
// or hold the money, the buyer deals with the seller directly.

function waLink(whatsapp: string | null, item: PublicShelfItem, sellerName: string | null): string {
  const digits = (whatsapp || '').replace(/[^\d]/g, '');
  const msg = `Hi${sellerName ? ` ${sellerName}` : ''}, I'd like to order ${item.name}${item.year ? ` (${item.year})` : ''} from your shelf.`;
  const text = encodeURIComponent(msg);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

const ShelfPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-shelf', slug],
    queryFn: () => api.shelf.getPublic(slug!),
    enabled: !!slug,
    retry: false,
    staleTime: 1000 * 60,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tea-bg text-tea-text-dim">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-tea-bg text-center px-6">
        <Package size={32} className="text-tea-text-dim mb-3" />
        <h1 className="font-display text-xl text-tea-text">Shelf not found</h1>
        <p className="text-ui-14 text-tea-text-sec mt-1">This shelf doesn't exist or isn't public.</p>
      </div>
    );
  }

  const heading = data.title || (data.seller_name ? `${data.seller_name}'s shelf` : 'Tea shelf');

  return (
    <div className="min-h-screen bg-tea-bg">
      <div className="max-w-2xl mx-auto px-5 py-10 pb-nav-gap">
        {/* Header, shelf-first, no bio. */}
        <header className="mb-8">
          <p className="text-ui-11 text-tea-text-dim uppercase tracking-[0.14em] mb-1">A personal shelf</p>
          <h1 className="font-display text-2xl text-tea-text">{heading}</h1>
          <p className="text-ui-13 text-tea-text-sec mt-2">
            Order directly with the seller over WhatsApp, they fulfil and are paid themselves.
          </p>
        </header>

        {data.items.length === 0 ? (
          <p className="text-ui-14 italic text-tea-text-sec py-12">
            {data.seller_name ? `${data.seller_name} is` : 'This shelf is'} setting the shelf. Check back soon.
          </p>
        ) : (
          /* One section per tea, an editorial spread, not a card list.
             Full-width letterbox photo on top, prose below, hairline between. */
          <div>
            {data.items.map((item, i) => (
              <section
                key={item.id}
                className={i > 0 ? 'mt-16 pt-16 border-t border-tea-border' : ''}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full aspect-[16/9] object-cover mb-5"
                  />
                ) : (
                  <div className="w-full aspect-[16/9] bg-tea-elevated flex items-center justify-center mb-5">
                    <Package size={28} className="text-tea-text-dim" />
                  </div>
                )}

                <h2 className="font-display text-2xl text-tea-text">{item.name}</h2>
                <p className="text-ui-13 text-tea-text-dim mt-1">
                  {[item.type, item.origin, item.year].filter(Boolean).join(' · ') || '—'}
                </p>

                <div className="flex items-baseline justify-between mt-5">
                  {item.grams > 0 ? (
                    <p className="font-mono text-ui-13 text-tea-text-sec">{Math.round(item.grams)}g available</p>
                  ) : (
                    <p className="text-ui-13 italic text-tea-text-sec">Ask about availability</p>
                  )}
                  <a
                    href={waLink(data.whatsapp, item, data.seller_name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group text-ui-14 text-tea-text-sec hover:text-tea-gold transition-colors"
                  >
                    Order <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                  </a>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShelfPage;
