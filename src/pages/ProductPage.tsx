import React, { useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence } from 'framer-motion';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../hooks/useAuth';
import { Icons } from '../components/Icons';
import { AlcoveCard } from '../components/shop/AlcoveCard';
import { TastingSession, type TastingItem } from '../components/tasting/TastingSession';
import { TastingEditorModal } from '../admin/components/TastingEditorModal';
import { EmblemLoader } from '../components/shared/EmblemLoader';
import type { InventoryItem } from '../types';
import type { Product } from '../admin/types';

interface ProductPageProps {
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
}

/**
 * The real product page at /shop/product/:id: the cold-load container of the
 * one-URL/two-containers pattern. Grid taps inside the shop open the same URL
 * as the AlcoveModal over the still-mounted grid (background-location routing
 * in App.tsx); shared links, reloads, and search results land here.
 *
 * The page is composed from the SAME alcove blocks as the modal card
 * (AlcoveCard with layout="page"), so behaviors (sample request, custom
 * amount, favorite, share, taste, add-to-cart, sold-out states) are shared,
 * never duplicated. On lg+ identity/facts/order form a 340px left rail with the
 * reading content on the right; below lg it is a single column with the
 * commerce bar fixed above the bottom nav.
 */
export const ProductPage: React.FC<ProductPageProps> = ({ onAddToCart }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { inventory, isLoading, refetch: refetchInventory } = useInventory();
  const { isAdmin } = useAuth();

  const item = useMemo(() => inventory.find(i => i.id === id), [inventory, id]);

  // Tasting session (customers) / product tasting editor (admins): same
  // behaviors the shop grids attach to the modal card.
  const [tastingItem, setTastingItem] = useState<InventoryItem | null>(null);
  const [adminTastingItem, setAdminTastingItem] = useState<InventoryItem | null>(null);

  const handleTaste = useCallback((tasteItem: InventoryItem) => {
    if (isAdmin) {
      setAdminTastingItem(tasteItem);
      return;
    }
    setTastingItem(tasteItem);
  }, [isAdmin]);

  // Tasting-term cross-reference: send the reader into the filtered shop.
  const handleTermClick = useCallback((termId: string, categoryId: string) => {
    const param = categoryId === 'feeling' ? 'feel' : 'flavor';
    navigate(`/shop?${param}=${encodeURIComponent(termId)}`);
  }, [navigate]);

  // Minimal Product shape TastingEditorModal needs, mapped from InventoryItem.
  const adminTastingProductShim: Product | null = useMemo(() => {
    if (!adminTastingItem) return null;
    return {
      id: adminTastingItem.id,
      givenName: adminTastingItem.name,
      productName: adminTastingItem.variant || adminTastingItem.name,
      type: adminTastingItem.type as Product['type'],
      imageUrl: adminTastingItem.image || '',
      tasting: adminTastingItem.tasting,
    } as Product;
  }, [adminTastingItem]);

  // Inventory still loading on a cold load: hold the frame, don't 404 early.
  if (!item && isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmblemLoader />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-[fadeIn_0.5s_ease-out]">
        <h1 className="text-4xl font-serif text-tea-gold mb-4">Not Found</h1>
        <p className="text-sm text-tea-text-sec mb-8 max-w-md">
          This product could not be found. It may have been removed or the link may be incorrect.
        </p>
        <Link
          to="/shop"
          className="cta-solid px-8 py-3 text-xs uppercase tracking-[0.2em] transition-colors"
        >
          Back to Shop
        </Link>
      </div>
    );
  }

  const pricePerGram = parseFloat(item.price_per_gram || '0');
  const isSoldOut = (item.stock_g ?? 0) <= 0;
  const introduction = item.description || '';
  const mainStory = item.lore || '';
  const metaDescription = (introduction || mainStory || `${item.type} tea from ${item.origin}`).slice(0, 160);

  // JSON-LD structured data for SEO (Product + Offer schema)
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.name,
    description: introduction || mainStory || `${item.type} tea from ${item.origin}`,
    image: item.image || undefined,
    brand: { '@type': 'Brand', name: 'Teajia' },
    category: item.category === 'ware' ? 'Teaware' : `${item.type} Tea`,
    ...(item.origin && { countryOfOrigin: { '@type': 'Country', name: item.origin } }),
    offers: {
      '@type': 'Offer',
      price: (pricePerGram * 50).toFixed(2), // Price per 50g serving
      priceCurrency: 'USD',
      availability: isSoldOut
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'Teajia' },
      url: `${window.location.origin}/shop/product/${item.id}`,
    },
  };

  return (
    <div className="w-full animate-[fadeIn_0.5s_ease-out]">
      <Helmet>
        <title>{item.name} · Teajia</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={`${item.name} · Teajia`} />
        <meta property="og:description" content={(introduction || mainStory || '').slice(0, 160)} />
        {item.image && <meta property="og:image" content={item.image} />}
        <meta property="og:type" content="product" />
        <meta property="product:price:amount" content={(pricePerGram * 50).toFixed(2)} />
        <meta property="product:price:currency" content="USD" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      {/* Back: page nav, top-left */}
      <div className="mx-auto w-full max-w-[1080px] pt-4 pb-2">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors text-sm"
        >
          <Icons.Back className="w-4 h-4" />
          <span className="uppercase tracking-[0.12em] text-xs">Back to Shop</span>
        </Link>
      </div>

      {/* The quiet page: same blocks and behaviors as the modal card */}
      <AlcoveCard
        item={item}
        layout="page"
        onAddToCart={onAddToCart}
        onTermClick={handleTermClick}
        onTaste={handleTaste}
        isAdmin={isAdmin}
        onEditProductTasting={isAdmin ? (editItem) => setAdminTastingItem(editItem) : undefined}
      />

      {/* Tasting session (customers) */}
      <AnimatePresence>
        {tastingItem && (
          <TastingSession
            item={tastingItem}
            onClose={() => setTastingItem(null)}
            onOrderTea={(ordered: TastingItem) => {
              // Already on this product's page: just close the session.
              setTastingItem(null);
              if (ordered.id !== item.id) {
                navigate(`/shop/product/${encodeURIComponent(ordered.id)}`);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Admin: product tasting editor, same modal used from the admin panel */}
      {adminTastingItem && adminTastingProductShim && (
        <TastingEditorModal
          product={adminTastingProductShim}
          onClose={() => setAdminTastingItem(null)}
          onSaved={() => {
            setAdminTastingItem(null);
            refetchInventory();
          }}
        />
      )}
    </div>
  );
};

export default ProductPage;
