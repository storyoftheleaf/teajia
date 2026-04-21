import React, { useEffect, useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

type CatalogProduct = {
  id: string;
  type: string;
  givenName: string;
  productName: string;
  originRegion: string;
  originCountry: string;
  year?: number;
  tastingNotes: string[];
  imageUrl?: string;
  stockGrams: number;
  status: string;
  wholesalePrice?: number;
  catalogVisible?: boolean;
};

const TYPE_FILTERS = [
  'All', 'Green', 'Oolong', 'Sheng', 'Shou', 'Red', 'Dark', 'White', 'Yellow', 'Herbal', 'Teaware',
] as const;

export const CatalogView: React.FC = () => {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [trustTier, setTrustTier] = useState<string>('basic');
  const [platformWhatsapp, setPlatformWhatsapp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('All');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.catalog
      .list()
      .then((data) => {
        if (cancelled) return;
        setProducts(data.products as CatalogProduct[]);
        setTrustTier(data.trust_tier);
        setPlatformWhatsapp((data as any).platform_whatsapp || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load catalog');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (typeFilter === 'All') return products;
    return products.filter((p) => p.type === typeFilter);
  }, [products, typeFilter]);

  const showWholesalePrice = trustTier === 'verified' || trustTier === 'partner';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-tea-text-dim" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-tea-text-sec">{error}</p>
      </div>
    );
  }

  const isEmpty = products.length === 0;

  return (
    <div className="px-4 pb-16 space-y-6">
      <div className="pt-6 space-y-1">
        <h1 className="text-base font-medium text-tea-text tracking-wide">Teajia Catalog</h1>
        <p className="text-xs text-tea-text-dim">Products available to source from Teajia Bali</p>
      </div>

      {isEmpty ? (
        <div className="py-14 text-center space-y-2">
          <p className="text-sm text-tea-text-sec">The wholesale catalog is not yet available for your account.</p>
          <p className="text-xs text-tea-text-dim">Contact Adrian to get set up.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 flex-wrap">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                  typeFilter === t
                    ? 'bg-tea-gold/15 text-tea-gold font-semibold'
                    : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/60'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs text-tea-text-dim">No products in this category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-5">
              {filtered.map((product) => {
                const isAvailable = product.status === 'Active' && product.stockGrams > 0;
                const displayName = [product.givenName, product.productName].filter(Boolean).join(' ');
                const origin = [product.originRegion, product.originCountry].filter(Boolean).join(', ');
                const notes = product.tastingNotes?.slice(0, 3).join(', ');
                const waText = encodeURIComponent(
                  `Hi Adrian, I'd like to stock ${displayName} in my Teajia account.`
                );
                const waLink = platformWhatsapp
                  ? `https://wa.me/${platformWhatsapp.replace(/[^\d]/g, '')}?text=${waText}`
                  : `https://wa.me/?text=${waText}`;

                return (
                  <div key={product.id} className="bg-tea-surface rounded-xl overflow-hidden">
                    <div className="relative aspect-[4/3] bg-tea-bg">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-tea-bg" />
                      )}
                      {product.type && (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-tea-bg/80 text-[10px] text-tea-text-sec backdrop-blur-sm">
                          {product.type}
                        </span>
                      )}
                    </div>

                    <div className="p-4 space-y-1.5">
                      <p className="text-sm font-medium text-tea-text leading-snug">{displayName}</p>

                      {origin && (
                        <p className="text-xs text-tea-text-sec">{origin}</p>
                      )}

                      {product.year && (
                        <p className="text-xs text-tea-text-dim">{product.year}</p>
                      )}

                      {notes && (
                        <p className="text-xs text-tea-text-dim">{notes}</p>
                      )}

                      <div className="pt-0.5">
                        {isAvailable ? (
                          <span className="text-xs text-tea-gold">Available</span>
                        ) : (
                          <span className="text-xs text-tea-text-dim">Out of Stock</span>
                        )}
                      </div>

                      {showWholesalePrice && product.wholesalePrice != null && (
                        <p className="text-xs text-tea-gold">
                          Wholesale: ${product.wholesalePrice.toFixed(2)}/g
                        </p>
                      )}

                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full mt-3 py-2 text-xs text-center border border-tea-border rounded-lg text-tea-text-sec hover:border-tea-gold hover:text-tea-gold transition-colors"
                      >
                        Request to Stock
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
