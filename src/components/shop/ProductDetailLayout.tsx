import { createContext, useContext, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addProductPhotograph } from '../../lib/familyApi';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authPagePath } from '../../lib/authNavigation';
import { useAppStore } from '../../lib/store';
import { Icons } from '../Icons';
import { Button } from '../shared/Button';
import { FactGrid, type Fact } from '../wisdom/FactGrid';
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
  facts: Fact[];
  factsTitle: string;
  afterFacts?: ReactNode;
  order?: ReactNode;
  character?: ReactNode;
  reading?: ProductReading;
  related?: ReactNode;
  teaOrder?: boolean;
  modals?: ReactNode;
  soldOut?: boolean;
}

export function ProductDetailLayout({
  identity, gallery, actions, facts, factsTitle, afterFacts, order, character, reading, related, teaOrder, modals, soldOut, ownerPreviewNavigation,
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
      {ownerPreviewNavigation ?? <div className="tea-product-nav mb-1 flex w-full items-center justify-between gap-4 border-b border-tea-border px-5 lg:px-10">
        <Link
          to={shopHref}
          aria-label="Back to shop"
          className="btn-quiet btn-sm"
        >
          <Icons.Back className="h-3.5 w-3.5" />
          <span>Shop</span>
          {crumbType && (
            <>
              <span aria-hidden="true" className="text-tea-text-dim">/</span>
              <span>{crumbType}</span>
            </>
          )}
        </Link>
        {actions && <ProductOrderAccess onCartClick={onCartClick} cartItemCount={cartItemCount} />}
      </div>}

      <article className="tea-product-page mx-auto w-full max-w-screen-xl" data-sold-out={soldOut || undefined}>
        <div className="tea-product-layout">
          <div className="tea-product-plaque">
            <div className={hasMemberPhotos ? 'tea-product-plaque-stack' : 'relative lg:h-full'}>
              <AlcoveIdentityHeader {...identity} variant="plate" />
              {hasMemberPhotos && <div className="tea-product-under-plaque">
                <TeaPhotographRow photographs={photos.row} teaName={item.name} onChooseCover={photos.chooseCover}
                  onRemove={photos.removeOwn} onShape={photos.reshapeOwn} onShare={photos.shareOwn}
                  addPhoto={hasShopPhotos ? undefined : addPhoto} />
              </div>}
            </div>
          </div>
          <div className="tea-product-reading">
            <AlcoveGallery key={item.id} {...gallery} layout="page" onExpandImage={setExpandedImage}
              addPhoto={hasShopPhotos ? addPhoto : undefined} />
            {hasProductActions && isAuthenticated && <input type="file" ref={input} hidden multiple accept="image/*" aria-label="Add product photos" onChange={event => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              if (files.length) upload.mutate(files);
            }} />}
            {upload.isError && <span role="alert">{upload.error.message || 'The photo could not be added. Try again.'}</span>}
            {hasProductActions && actions && <ProductDetailActions {...actions} key={item.id} emptyGalleryAction={emptyGallery ? addPhoto : undefined} />}
            {visibleFacts.length > 0 && (
              <section className="tea-product-provenance" aria-labelledby="tea-product-provenance-title">
                <h2 id="tea-product-provenance-title" className="m-0 font-display text-ui-20 text-tea-text">{factsTitle}</h2>
                <FactGrid facts={visibleFacts} />
              </section>
            )}
            {afterFacts}
            {order && <div data-page-order data-tea-product-order={teaOrder || undefined} className="commerce-dock commerce-price-surface paper-surface dark z-nav">{order}</div>}
            {character}
            {reading && <AlcoveAboutSection reading={reading} variant="page" />}
            {related}
          </div>
        </div>
        <div aria-hidden="true" className="h-40 lg:h-8" />
        <ImageOverlayModal open={Boolean(expandedImage)} expandedImageUrl={expandedImage} itemName={item.name} onClose={() => setExpandedImage(null)} />
        {modals}
      </article>
      {selectedBy.length > 0 && (
        <section aria-label="Selected by" className="mx-5 mt-4 lg:mx-10" data-testid="product-selected-by">
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

    </>
  );
}

function ProductDetailActions({
  productId, label, onTaste, onEdit, emptyGalleryAction,
}: {
  productId: string;
  label: string;
  onTaste?: () => void;
  onEdit?: () => void;
  emptyGalleryAction?: ReactNode;
}) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const collected = useAppStore(state => state.favoriteTeas.includes(productId));
  const toggleFavorite = useAppStore(state => state.toggleFavoriteTea);

  const accountAction = isAuthenticated ? (
    <Button variant="secondary" size="sm" className="tea-product-profile" icon={<Icons.User aria-hidden="true" />} onClick={() => navigate('/account')}>
      {user?.name?.trim() || 'My account'}
    </Button>
  ) : (
    <Button variant="secondary" size="sm" onClick={() => navigate(authPagePath('signin', pathname + search))}>Log in</Button>
  );

  return (
    <div className="tea-product-account" role="group" aria-label={label}>
      {emptyGalleryAction ? (
        <div className="tea-product-account-photo">{accountAction}{emptyGalleryAction}</div>
      ) : accountAction}
      {isAuthenticated ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onTaste && <Button variant="secondary" size="sm" onClick={onTaste}>Taste</Button>}
          <Button variant="secondary" size="sm" aria-pressed={collected} onClick={() => toggleFavorite(productId)}>
            {collected ? 'Collected' : '+ Collect'}
          </Button>
          {onEdit && <Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button>}
        </div>
      ) : onTaste && <Button variant="secondary" size="sm" onClick={onTaste}>Add your tasting</Button>}
    </div>
  );
}
