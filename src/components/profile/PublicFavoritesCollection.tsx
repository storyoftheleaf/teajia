import { ArrowRight } from '@phosphor-icons/react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { visiblePublicFavorites } from './profileDomain';
import type { ProfileFavorite } from './types';

interface PublicFavoritesCollectionProps {
  contributorName: string;
  favorites: ProfileFavorite[];
  compact?: boolean;
}

export function PublicFavoritesCollection({ contributorName, favorites, compact = false }: PublicFavoritesCollectionProps) {
  const visible = visiblePublicFavorites(favorites);

  if (visible.length === 0) {
    return (
      <div className="border-y border-tea-border py-10">
        <p className={`${TYPOGRAPHY_CLASSES.subtitle} max-w-[44ch] text-tea-text-sec`}>
          {contributorName} has not published a favorites selection yet.
        </p>
      </div>
    );
  }

  const shown = compact ? visible.slice(0, 4) : visible;
  return (
    <ol className="divide-y divide-tea-border border-y border-tea-border">
      {shown.map((favorite, index) => {
        const tea = favorite.tea;
        return (
          <li key={favorite.tea_profile_id} className="grid gap-5 py-7 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-start md:gap-8 md:py-9">
            <div className={`${index % 2 === 1 ? 'sm:translate-y-3' : ''} aspect-[4/5] overflow-hidden rounded-md border border-tea-border bg-tea-surface`}>
              {tea.image_url ? (
                <img src={tea.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full items-end p-3">
                  <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>{tea.type || 'Tea'}</span>
                </div>
              )}
            </div>
            <div className="min-w-0 sm:pt-1">
              <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>
                {tea.type || 'Tea'}{tea.year ? ` · ${tea.year}` : ''}{tea.origin ? ` · ${tea.origin}` : ''}
              </p>
              {tea.public_path ? (
                <a href={tea.public_path} className="tap-target group mt-2 inline-flex max-w-full items-center gap-3 text-tea-text transition-colors hover:text-tea-gold">
                  <span className={`${TYPOGRAPHY_CLASSES.h2} truncate`}>{tea.name}</span>
                  <ArrowRight size={19} className="shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </a>
              ) : (
                <h3 className={`${TYPOGRAPHY_CLASSES.h2} mt-2 truncate text-tea-text`}>{tea.name}</h3>
              )}
              {tea.chinese_name && <p className="mt-1 font-display text-ui-17 text-tea-text-sec">{tea.chinese_name}</p>}
              {favorite.note && (
                <blockquote className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-4 max-w-[54ch] border-l border-tea-gold pl-4 text-tea-text-sec`}>
                  {favorite.note}
                </blockquote>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
