import { ORDERS_PAUSED_MESSAGE } from '../../lib/shopPurchase';
import { createContext, useContext, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addProductPhotograph } from '../../lib/familyApi';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authPagePath } from '../../lib/authNavigation';
import { useAppStore } from '../../lib/store';
import { Icons } from '../Icons';
import { Button } from '../shared/Button';
import type { Fact } from '../wisdom/FactGrid';
import { TeaFactsBox } from './TeaFactsBox';
import { AlcoveGallery } from './alcove/AlcoveGallery';
import { AlcoveIdentityHeader } from './alcove/AlcoveIdentityHeader';
import { ImageOverlayModal } from './alcove/AlcoveModals';
import { AlcoveAboutSection } from './alcove/AlcoveAboutSection';
import type { ProductReading } from './productDetailFields';
import { ProductOrderAccess } from './ProductOrderAccess';
import { GroupHead, IndexRow, SplitName } from '../people/immersive';
import type { api } from '../../lib/api';
import { useTeaFamily } from './useTeaFamily';
import { TeaPhotographRow } from './TeaFamilyStrips';

interface ProductPageContextValue {
  shopHref: string;
  crumbType?: string | null;
  selectedBy: Awaited<ReturnType<typeof api.products.getSelectedBy>>['selected_by'];
  onCartClick?: () => void;
  cartItemCount: number;
}

export const ProductDetailPageContext = createContext<ProductPageContextValue>({
  shopHref: '/shop', selectedBy: [], cartItemCount: 0,
});

interface ProductDetailLayoutProps {
  identity: Omit<ComponentProps<typeof AlcoveIdentityHeader>, 'variant'>;
  gallery: Omit<ComponentProps<typeof AlcoveGallery>, 'layout' | 'onExpandImage'>;
  actions?: ComponentProps<typeof ProductDetailActions>;
  ownerPreviewNavigation?: ReactNode;
  galleryCaption?: string;
  facts: Fact[];
  factsTitle: string;
  history?: ReactNode;
  styleReference?: ReactNode;
  order?: ReactNode;
  tasting?: ReactNode;
  /** Customer notes the shop promoted; set after the story, under "What people often notice". */
  journal?: ReactNode;
  reading?: ProductReading;
  related?: ReactNode;
  teaOrder?: boolean;
  modals?: ReactNode;
  soldOut?: boolean;
}

export function ProductDetailLayout({
  identity, gallery, actions, facts, factsTitle, history, order, tasting, journal, reading, related, styleReference, teaOrder, modals, soldOut, ownerPreviewNavigation, galleryCaption,
}: ProductDetailLayoutProps) {
  const { shopHref, crumbType, selectedBy, onCartClick, cartItemCount } = useContext(ProductDetailPageContext);
  const { item } = identity;
  const hasProductActions = Boolean(actions) && !ownerPreviewNavigation;
  const photos = useTeaFamily(hasProductActions ? item.id : undefined);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        if (useAppStore.getState().authUser?.email !== user?.email) return;
        await addProductPhotograph(item.id, file);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['family', 'my-tea', item.id] }),
  });
  const hasShopPhotos = gallery.allImages.length > 0;
  const hasMemberPhotos = photos.row.length > 0;
  const emptyGallery = !hasShopPhotos && !hasMemberPhotos;
  const addPhoto = !hasProductActions ? undefined : (
    <Button variant="secondary" size="sm" type="button" className={emptyGallery ? 'shrink-0' : 'product-photo-add'}
      aria-label={emptyGallery ? 'Add your own picture' : 'Add your photo'}
      title={emptyGallery ? undefined : 'Add your photo'} disabled={upload.isPending} onClick={() => {
        if (isAuthenticated) input.current?.click();
        else navigate(authPagePath('signup', pathname + search + hash));
      }}>
      {emptyGallery ? '+ Add your own picture' : <Icons.Plus aria-hidden="true" />}
    </Button>
  );
  const visibleFacts = facts.filter(fact => fact.value?.trim() || fact.content);
  return (
    <>
      {ownerPreviewNavigation ?? <div className="tea-product-nav mb-1 flex w-full items-center justify-between gap-4 border-b border-tea-border px-5 max-[383px]:gap-2 max-[383px]:px-3 lg:px-10">
        <Link
          to={shopHref}
          aria-label="Back to shop"
          className="btn-quiet btn-sm"
        >
          <Icons.Back className="h-3.5 w-3.5" />
          <span>Shop</span>
          {crumbType && (
            <>
              <span aria-hidden="true" className="text-tea-text-dim max-[383px]:hidden">/</span>
              <span className="max-[383px]:hidden">{crumbType}</span>
            </>
          )}
        </Link>
        {actions && <div className="tea-product-nav-end flex min-w-0 items-center gap-3 max-[383px]:gap-1">
          {hasProductActions && <ProductAccount onEdit={actions?.onEdit} />}
          <ProductOrderAccess onCartClick={onCartClick} cartItemCount={cartItemCount} />
        </div>}
      </div>}

      <article className="tea-product-page mx-auto w-full max-w-screen-xl" data-sold-out={soldOut || undefined}>
        <div className="tea-product-layout">
          <div className="tea-product-plaque">
            <div className="relative lg:h-full">
              <AlcoveIdentityHeader {...identity} variant="plate" />
            </div>
          </div>
          <div className="tea-product-reading">
            <AlcoveGallery key={`gallery-${item.id}`} {...gallery} layout="page" onExpandImage={setExpandedImage}
              addPhoto={hasShopPhotos ? addPhoto : undefined} />
            {hasShopPhotos && galleryCaption && <p className="mx-5 mt-2 text-tea-text-sec">{galleryCaption}</p>}
            {/* Photos come first (Adrian, 2026-11-24): the shop's, then the family's
                as one row of equal thumbnails. Who took one shows only when it is
                opened. With no photos at all, the add button stands in their place. */}
            {hasMemberPhotos && <TeaPhotographRow photographs={photos.row} teaName={item.name} onChooseCover={photos.chooseCover}
              onRemove={photos.removeOwn} onShape={photos.reshapeOwn} onShare={photos.shareOwn}
              addPhoto={hasShopPhotos ? undefined : addPhoto} />}
            {emptyGallery && addPhoto && <div className="tea-product-photo-empty">{addPhoto}</div>}
            {hasProductActions && isAuthenticated && <input type="file" ref={input} hidden multiple accept="image/*" aria-label="Add product photos" onChange={event => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              if (files.length) upload.mutate(files);
            }} />}
            {upload.isError && <span role="alert">{upload.error.message || 'The photo could not be added. Try again.'}</span>}
            <TeaFactsBox facts={visibleFacts} summary={reading?.introduction} title={factsTitle} />
            {hasProductActions && actions && <ProductDetailActions {...actions} key={`actions-${item.id}`} />}
            {item.ordersPaused && <p className="mx-5 my-2 text-ui-13 text-tea-text-sec">{ORDERS_PAUSED_MESSAGE}</p>}
            {reading?.clay && <AlcoveAboutSection reading={{ label: reading.clay.label, sections: [reading.clay] }} variant="page" />}
            {tasting}
            {order && <div data-page-order data-tea-product-order={teaOrder || undefined} className="commerce-dock commerce-price-surface paper-surface dark z-nav">{order}</div>}
            {history}
            {journal}
            {reading && <AlcoveAboutSection reading={reading} variant="page" />}
            {related}
            {selectedBy.length > 0 && (
              <section aria-label="Selected by" className="mx-5 mt-4" data-testid="product-selected-by">
                {/* The profile page's own row (2026-09-21): the spaced-caps divider,
                    the name with its italic gold surname, the tea master's own note
                    as the dek, a hairline under. It reads as the person's voice on
                    the tea, which is the whole point of the line. */}
                <GroupHead label="Selected by" />
                {selectedBy.map(creator => (
                  <IndexRow
                    key={creator.slug}
                    to={`/people/${encodeURIComponent(creator.slug)}`}
                    title={<SplitName name={creator.display_name} />}
                    dek={creator.why ?? (creator.business_name ? `At ${creator.business_name}.` : undefined)}
                    testId="product-selected-by-row"
                    ariaLabel={`${creator.display_name}, who selected this item`}
                  />
                ))}
              </section>
            )}
            {styleReference}
          </div>
        </div>
        <div aria-hidden="true" className="h-40 lg:h-8" />
        <ImageOverlayModal open={Boolean(expandedImage)} expandedImageUrl={expandedImage} itemName={item.name} onClose={() => setExpandedImage(null)} />
        {modals}
      </article>
    </>
  );
}

/** Your name (or Log in) and, for the owner, Edit: in the top bar, out of a customer's way. */
function ProductAccount({ onEdit }: { onEdit?: () => void }) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  if (!isAuthenticated) {
    return <Button variant="quiet" size="sm" onClick={() => navigate(authPagePath('signin', pathname + search))}>Log in</Button>;
  }
  return <>
    <Button variant="quiet" size="sm" className="tea-product-profile" icon={<Icons.User aria-hidden="true" />} onClick={() => navigate('/account')}>
      {user?.name?.trim() || 'My account'}
    </Button>
    {onEdit && <Button variant="quiet" size="sm" onClick={onEdit}>Edit</Button>}
  </>;
}

/**
 * The quiet ribbon (Adrian's pick, 2026-11-24): Add your tasting and Add to
 * collection as spaced capitals between two hairlines, straight after the facts.
 */
function ProductDetailActions({
  productId, label, onTaste,
}: {
  productId: string;
  label: string;
  onTaste?: () => void;
  onEdit?: () => void;
}) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const collected = useAppStore(state => state.favoriteTeas.includes(productId));
  const toggleFavorite = useAppStore(state => state.toggleFavoriteTea);

  return (
    <div className="tea-product-ribbon" role="group" aria-label={label}>
      {onTaste && <Button variant="quiet" onClick={onTaste}>Add your tasting</Button>}
      <Button variant="quiet" aria-pressed={isAuthenticated ? collected : undefined} onClick={() => {
        if (isAuthenticated) toggleFavorite(productId);
        else navigate(authPagePath('signin', pathname + search));
      }}>
        {collected && isAuthenticated ? 'In your collection' : 'Add to collection'}
      </Button>
    </div>
  );
}
