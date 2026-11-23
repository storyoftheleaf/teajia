import { useEffect } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { Loader2, Package } from 'lucide-react';
import { PublicIdentityLinks } from '../components/profile/PublicIdentityLinks';
import { PersonalShopTeaRow } from '../components/shop/PersonalShopTeaRow';
import { TYPOGRAPHY_CLASSES as T } from '../designTokens';
import { usePublicShelf } from '../hooks/usePublicShelf';
import { hasShelfAmount, publicShelfPath, SHELF_OFFER_ANCHOR, shelfPrice, shelfWhatsAppHref } from '../lib/publicShelf';

export default function ShelfPage() {
  const { slug } = useParams<{ slug: string }>();
  const { hash, state } = useLocation();
  const { data, isLoading, isError, refetch, isFetchedAfterMount } = usePublicShelf(slug);
  const expectedSeller = typeof state?.sellerProfile === 'string' ? state.sellerProfile : null;
  const sellerChanged = Boolean(expectedSeller && data && data.contributor_slug !== expectedSeller);
  const items = !data?.store_slug ? data?.items.filter(item => hasShelfAmount(item) && shelfPrice(item)) ?? [] : [];
  const offerLink = hash.startsWith(`#${SHELF_OFFER_ANCHOR}`);
  const selected = offerLink
    ? data && items.find(item => publicShelfPath(data.slug, item.id).endsWith(hash))
    : undefined;
  const destination = selected ? `${SHELF_OFFER_ANCHOR}${selected.id}` : 'shelf-offer-unavailable';

  // A cold link can arrive before the shelf data (and its target) renders.
  useEffect(() => {
    if (!offerLink || !isFetchedAfterMount || isError || sellerChanged) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(destination);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [destination, hash, isFetchedAfterMount, isError, offerLink, sellerChanged]);

  if (isLoading || (!isFetchedAfterMount && !isError)) {
    return (
      <div role="status" aria-label="Loading shelf" className="min-h-screen flex items-center justify-center bg-tea-bg text-tea-text-dim">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (isError || !data || sellerChanged) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-tea-bg text-center px-6">
        <Package size={32} className="text-tea-text-dim mb-3" />
        <h1 className={T.h1}>Shelf not found</h1>
        <p role="alert" className={T.bodyLight}>This shelf is currently unavailable.</p>
        {expectedSeller && <Link to={`/people/${encodeURIComponent(expectedSeller)}`} className="btn-quiet mt-4">Back to profile</Link>}
        {!sellerChanged && <button type="button" onClick={() => refetch()} className="btn-quiet mt-4">Retry</button>}
      </div>
    );
  }

  const sellerStorePath = data.store_slug ? `/store/${encodeURIComponent(data.store_slug)}` : null;
  if (sellerStorePath && !offerLink) return <Navigate replace to={sellerStorePath} />;

  const seller = data.seller_name?.trim();
  const heading = data.title || (seller ? `${seller}’s tea shop` : 'Tea shop');
  const canOrder = items.some(item => shelfWhatsAppHref(data, item));

  return (
    <div className="min-h-screen bg-tea-bg">
      <div className="max-w-screen-xl mx-auto px-5 pt-8 pb-nav-gap">
        <header className="mb-6">
          <h1 className={`${T.h1} break-words`}>{heading}</h1>
          {canOrder && <p className={`${T.bodyLight} mt-2`}>Arrange payment and delivery directly with {seller || 'the seller'} on WhatsApp.</p>}
          <PublicIdentityLinks contributorSlug={data.contributor_slug} subjectName={seller || heading} className="mt-2" />
        </header>

        {offerLink && !selected && (
          <p role="status" tabIndex={-1} id="shelf-offer-unavailable" className={`${T.bodyLight} mb-4 scroll-mt-24`}>
            This offer is no longer available.
          </p>
        )}

        {sellerStorePath ? (
          <Link to={sellerStorePath} className="btn-secondary">View current teas for sale</Link>
        ) : items.length === 0 ? (
          <p className={T.bodyLight}>No teas are currently for sale.</p>
        ) : (
          <>
            <h2 className={`${T.h2} mb-3`}>Teas for sale</h2>
            {!canOrder && <p className={`${T.bodyLight} mb-3`}>WhatsApp orders are currently unavailable.</p>}
            <div>
              {items.map(item => (
                <PersonalShopTeaRow
                  key={item.id}
                  item={item}
                  seller={seller}
                  headingId={`${SHELF_OFFER_ANCHOR}${item.id}`}
                  orderHref={shelfWhatsAppHref(data, item)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
