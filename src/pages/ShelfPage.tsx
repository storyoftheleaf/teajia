import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Loader2, Package } from 'lucide-react';
import { PublicIdentityLinks } from '../components/profile/PublicIdentityLinks';
import { TeaCard, TeaCardTitle } from '../components/tea/TeaCard';
import { TYPOGRAPHY_CLASSES as T } from '../designTokens';
import { usePublicShelf } from '../hooks/usePublicShelf';
import { mediaUrl } from '../lib/mediaUrl';
import { hasShelfAmount, publicShelfPath, SHELF_OFFER_ANCHOR, shelfAmount, shelfWhatsAppHref } from '../lib/publicShelf';

export default function ShelfPage() {
  const { slug } = useParams<{ slug: string }>();
  const { hash, state } = useLocation();
  const { data, isLoading, isError, refetch, isFetchedAfterMount } = usePublicShelf(slug);
  const expectedSeller = typeof state?.sellerProfile === 'string' ? state.sellerProfile : null;
  const sellerChanged = Boolean(expectedSeller && data && data.contributor_slug !== expectedSeller);
  const offerLink = hash.startsWith(`#${SHELF_OFFER_ANCHOR}`);
  const selected = offerLink
    ? data?.items.find(item => publicShelfPath(data.slug, item.id).endsWith(hash))
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

  const seller = data.seller_name?.trim();
  const heading = data.title || (seller ? `${seller}’s tea shelf` : 'Tea shelf');
  const canOrder = data.items.some(item => shelfWhatsAppHref(data, item));

  return (
    <div className="min-h-screen bg-tea-bg">
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-nav-gap">
        <header className="mb-6">
          {seller && <p className={`${T.label} break-words`}>Personal shelf · {seller}</p>}
          <h1 className={`${T.h1} break-words`}>{heading}</h1>
          {canOrder && <p className={`${T.bodyLight} mt-2`}>Arrange payment and delivery directly with {seller || 'the seller'} on WhatsApp.</p>}
          <PublicIdentityLinks contributorSlug={data.contributor_slug} subjectName={seller || heading} className="mt-2" />
        </header>

        {offerLink && !selected && (
          <p role="status" tabIndex={-1} id="shelf-offer-unavailable" className={`${T.bodyLight} mb-4 scroll-mt-24`}>
            This offer is no longer available.
          </p>
        )}

        {data.items.length === 0 ? (
          <p className={T.bodyLight}>No teas are currently for sale.</p>
        ) : (
          <>
            <h2 className={`${T.h2} mb-3`}>Teas for sale</h2>
            {!canOrder && <p className={`${T.bodyLight} mb-3`}>WhatsApp orders are currently unavailable.</p>}
            <div className="grid gap-3">
              {data.items.map(item => {
                const order = shelfWhatsAppHref(data, item);
                const facts = [item.type, item.origin, item.year].filter(Boolean).join(' · ');
                return (
                  <TeaCard
                    key={item.id}
                    title={(
                      <TeaCardTitle id={`${SHELF_OFFER_ANCHOR}${item.id}`} tabIndex={-1} className="break-words scroll-mt-24">
                        {item.name}
                      </TeaCardTitle>
                    )}
                    actions={(
                      <>
                        <p className={`${T.bodyLight} py-2`}>{hasShelfAmount(item) ? shelfAmount(item.grams) : 'Availability unconfirmed'}</p>
                        {order && (
                          <a href={order} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm my-1 max-w-full">
                            <span className="truncate">{seller ? `Order from ${seller}` : 'Ask on WhatsApp'}</span>
                          </a>
                        )}
                      </>
                    )}
                  >
                    {(item.image_url || facts || order) && <div className="flex gap-3 items-start pb-3">
                      {item.image_url && <img src={mediaUrl(item.image_url)} alt="" loading="lazy" className="size-16 rounded-md object-cover" />}
                      <div className={`${T.bodyLight} min-w-0 break-words`}>
                        {facts && <p>{facts}</p>}
                        {order && <p>Ask about price</p>}
                      </div>
                    </div>}
                  </TeaCard>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
