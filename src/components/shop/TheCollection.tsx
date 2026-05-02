import React, { useState, useEffect } from 'react';
import { useParallax } from '../../hooks/useParallax';
import { Button } from '../shared/Button';
import { PageHeader } from '../shared/PageHeader';
import { ShippingBadge } from './ShippingBadge';
import { ProductInquiry } from './ProductInquiry';
import { COLLECTION_ITEMS, COLLECTION_SECTIONS } from '../../data/collectionItems';
import type { CollectionItem, CollectionCategory } from '../../types/shop';

interface TheCollectionProps {
  onBack: () => void;
  onNavigateToPractice: () => void;
  scrollToCategory?: CollectionCategory;
}

// ── Individual parallax section ──
const CollectionSection: React.FC<{
  category: CollectionCategory;
  title: string;
  subtitle: string;
  items: CollectionItem[];
  onInquire: (item: CollectionItem) => void;
}> = ({ category, title, subtitle, items, onInquire }) => {
  const { ref, offset, isVisible } = useParallax(0.04);

  if (items.length === 0) return null;

  return (
    <section ref={ref} id={`collection-${category}`} className="relative mb-8">
      {/* Parallax background image */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-100"
          style={{
            backgroundImage: `url(${items[0].image})`,
            transform: `translateY(${isVisible ? offset : 0}px) scale(1.1)`,
            filter: 'brightness(0.3) saturate(0.7)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-tea-border via-transparent to-tea-bg" />
      </div>

      {/* Content scrolls over the fixed image */}
      <div className="relative z-10 px-6 md:px-10 py-16 md:py-24 max-w-4xl mx-auto">
        <div className="mb-12">
          <div className="w-12 h-[1px] bg-tea-gold mb-4" />
          <h2 className="font-serif text-3xl md:text-4xl text-tea-text mb-2">{title}</h2>
          <p className="text-tea-text/60 font-serif italic">{subtitle}</p>
        </div>

        <div className="grid gap-10">
          {items.map(item => (
            <CollectionCard key={item.id} item={item} onInquire={onInquire} />
          ))}
        </div>
      </div>
    </section>
  );
};

// ── Single collection card — always inquiry, price shown as context ──
const CollectionCard: React.FC<{
  item: CollectionItem;
  onInquire: (item: CollectionItem) => void;
}> = ({ item, onInquire }) => {
  return (
    <div className="bg-tea-bg/80 backdrop-blur-md border border-tea-border rounded-sm overflow-hidden hover:border-tea-gold/15 transition-colors duration-300">
      <div className="flex flex-col md:flex-row">
        {/* Image */}
        <div className="w-full md:w-2/5 aspect-[3/4] md:aspect-auto overflow-hidden">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-500"
          />
        </div>

        {/* Details */}
        <div className="flex-1 p-6 md:p-8 flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="font-serif text-2xl text-tea-text">{item.name}</h3>
            <ShippingBadge type={item.shippingType} />
          </div>

          <p className="font-serif text-tea-text/60 italic mb-4">{item.subtitle}</p>

          <p className="text-sm text-tea-text/70 leading-relaxed mb-6 flex-1">
            {item.story}
          </p>

          {/* Meta details */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-tea-text/40 uppercase tracking-wider mb-6">
            {item.origin && <span>{item.origin}</span>}
            {item.year && <span>{item.year}</span>}
            {item.materials && <span>{item.materials}</span>}
            {item.dimensions && <span>{item.dimensions}</span>}
          </div>

          {/* Actions — always inquiry in The Collection */}
          <div className="flex items-center gap-3">
            {item.price && (
              <span className="font-serif text-xl text-tea-gold mr-2">
                ${item.price}
              </span>
            )}
            <Button variant="primary" size="sm" onClick={() => onInquire(item)}>
              Inquire
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main component ──
export const TheCollection: React.FC<TheCollectionProps> = ({ onBack, onNavigateToPractice, scrollToCategory }) => {
  const [inquiryItem, setInquiryItem] = useState<CollectionItem | null>(null);

  // Scroll to target category on mount
  useEffect(() => {
    if (scrollToCategory) {
      // Small delay for DOM to render
      const timer = setTimeout(() => {
        const el = document.getElementById(`collection-${scrollToCategory}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scrollToCategory]);

  const itemsByCategory = (cat: CollectionCategory) =>
    COLLECTION_ITEMS.filter(i => i.category === cat);

  return (
    <div className="w-full bg-tea-bg text-tea-text min-h-screen animate-[fadeIn_0.5s_ease-out]">
      <PageHeader
        title="The Collection"
        onBack={onBack}
        backLabel="Shop"
        rightContent={
          <span className="text-ui-10 uppercase tracking-display text-tea-text/30">
            By inquiry only
          </span>
        }
      />

      {/* Hero description */}
      <div className="px-6 md:px-10 py-16 md:py-24 max-w-4xl mx-auto">
        <p className="text-lg text-tea-text/60 max-w-xl leading-relaxed">
          Each piece carries a story, a provenance, and a purpose. Browse the gallery and reach out when something speaks to you.
        </p>
      </div>

      {/* Category sections with parallax */}
      {COLLECTION_SECTIONS.map(section => (
        <CollectionSection
          key={section.category}
          category={section.category}
          title={section.title}
          subtitle={section.subtitle}
          items={itemsByCategory(section.category)}
          onInquire={setInquiryItem}
        />
      ))}

      {/* Cross-pollination CTA */}
      <div className="px-6 md:px-10 py-20 md:py-28 max-w-4xl mx-auto border-t border-tea-border">
        <h3 className="font-serif text-2xl md:text-3xl text-tea-text mb-3">Begin Your Practice</h3>
        <p className="text-tea-text/60 mb-8 max-w-md">
          Explore everyday teas, teaware, and ceremony essentials to support your daily ritual.
        </p>
        <button
          onClick={onNavigateToPractice}
          className="font-serif text-base group inline-flex items-center gap-2 text-tea-gold min-h-[44px]"
        >
          <span className="group-hover:underline">Browse the Shop</span>
          <span className="inline-block group-hover:translate-x-[3px] transition-transform">&rarr;</span>
        </button>
      </div>

      {/* Inquiry modal */}
      <ProductInquiry
        isOpen={!!inquiryItem}
        onClose={() => setInquiryItem(null)}
        productName={inquiryItem?.name || ''}
      />
    </div>
  );
};
