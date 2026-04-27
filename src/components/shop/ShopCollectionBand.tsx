import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ShopCollectionEntry, ShopCollectionItem } from '../../types';

// ── Mini product card ────────────────────────────────────────────────────────

const BandItemCard: React.FC<{ item: ShopCollectionItem }> = ({ item }) => {
  const origin = [item.origin_region, item.origin_country].filter(Boolean).join(', ');

  return (
    <article className="flex-shrink-0 w-[148px] sm:w-[164px] flex flex-col gap-2">
      {/* Image */}
      <div className="w-full aspect-square rounded-sm overflow-hidden bg-tea-elevated">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-display text-[28px] text-tea-text-dim" style={{ fontWeight: 300 }}>茶</span>
          </div>
        )}
      </div>

      {/* Name */}
      <div className="flex flex-col gap-0.5">
        <p
          className="font-display text-[14px] leading-[1.25] text-tea-text line-clamp-2"
          style={{ fontWeight: 400 }}
        >
          {item.product_name}
        </p>
        {item.chinese_name && (
          <p className="font-body text-[12px] text-tea-text-sec italic leading-[1.3]" style={{ fontWeight: 300 }}>
            {item.chinese_name}
          </p>
        )}
        {(origin || item.year) && (
          <p className="font-sans text-[10px] uppercase tracking-[1.2px] text-tea-text-dim leading-[1.4] mt-0.5">
            {[origin, item.year].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </article>
  );
};

// ── Band ─────────────────────────────────────────────────────────────────────

interface ShopCollectionBandProps {
  entry: ShopCollectionEntry;
}

export const ShopCollectionBand: React.FC<ShopCollectionBandProps> = ({ entry }) => {
  const { collection, items, slug } = entry;
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  return (
    <section className="border-t border-tea-border py-12 lg:py-16">
      {/* Band header */}
      <div className="px-3 md:px-4 lg:px-6 mb-8">
        {/* Eyebrow label */}
        <p className="font-sans text-[11px] uppercase tracking-[1.5px] text-tea-text-dim mb-4">
          Editorial Collection
        </p>

        {/* Title + see-all row */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h2
            className="font-display text-[clamp(22px,3.2vw,28px)] leading-[1.2] tracking-[0.01em] text-tea-text"
            style={{ fontWeight: 500 }}
          >
            {collection.title}
          </h2>

          <Link
            to={`/c/${slug}`}
            className="flex-shrink-0 flex items-center gap-1.5 font-sans text-[12px] text-tea-text-sec hover:text-tea-text transition-colors group"
            aria-label={`See all items in ${collection.title}`}
          >
            <span className="tracking-[0.2px]">See all</span>
            <ArrowRight
              size={12}
              className="transition-transform group-hover:translate-x-0.5 group-hover:text-tea-gold"
            />
          </Link>
        </div>

        {/* Note */}
        {collection.note && (
          <p className="font-body text-[15px] leading-[1.65] text-tea-text-sec italic mt-3 max-w-[52ch]"
             style={{ fontWeight: 400 }}>
            {collection.note}
          </p>
        )}

        {/* Curator attribution */}
        {collection.curator_display_name && (
          <p className="font-body text-[13px] leading-[1.5] text-tea-text-dim italic mt-2"
             style={{ fontWeight: 400 }}>
            Curated by {collection.curator_display_name}
          </p>
        )}
      </div>

      {/* Item scroll row */}
      <div className="relative overflow-hidden">
        <div
          ref={scrollRef}
          className="px-3 md:px-4 lg:px-6 overflow-x-auto scrollbar-none pb-2"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex gap-4 lg:grid lg:grid-cols-4 xl:grid-cols-5 lg:gap-5">
            {items.map(item => (
              <BandItemCard key={item.item_id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
