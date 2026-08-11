import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from '@phosphor-icons/react';
import { useParams } from 'react-router-dom';
import { PublicFavoritesCollection } from '../components/profile/PublicFavoritesCollection';
import { CopyPublicLinkButton } from '../components/profile/ProfileShareLinks';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { api } from '../lib/api';

export default function ProfileFavoritesPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const query = useQuery({ queryKey: ['profile', slug, 'public-favorites'], queryFn: () => api.profile.getPublicFavorites(slug), enabled: Boolean(slug) });

  useEffect(() => { if (query.data) document.title = `${query.data.contributor.display_name}'s favorite teas · Teajia`; }, [query.data]);

  if (query.isLoading) return <PublicPageLoading />;
  if (query.isError || !query.data) return <Unavailable message={query.error instanceof Error ? query.error.message : 'The collection could not be loaded.'} onRetry={() => query.refetch()} />;
  const { contributor, favorites } = query.data;
  const shareUrl = typeof window === 'undefined' ? `https://teajia.com/people/${encodeURIComponent(slug)}/favorites` : window.location.href;
  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-8 pb-nav-gap-lg md:px-6 md:pt-14">
      <a href={`/people/${encodeURIComponent(slug)}`} className="tap-target inline-flex items-center gap-2 text-ui-12 text-tea-text-sec hover:text-tea-text"><ArrowLeft size={16} /> {contributor.display_name}</a>
      <header className="mt-12 max-w-3xl">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-gold`}>Personal curation</p>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} mt-3 text-tea-text`}>Favorite teas</h1>
        <p className={`${TYPOGRAPHY_CLASSES.subtitle} mt-4 text-tea-text-sec`}>A short, changing selection chosen by {contributor.display_name}.</p>
        <div className="mt-5"><CopyPublicLinkButton value={shareUrl} label="public favorites link" /></div>
      </header>
      <div className="mt-12"><PublicFavoritesCollection contributorName={contributor.display_name} favorites={favorites} /></div>
    </main>
  );
}

function PublicPageLoading() { return <main className="mx-auto w-full max-w-4xl animate-pulse px-4 pt-14 pb-nav-gap-lg md:px-6"><div className="h-5 w-32 rounded-md bg-tea-surface" /><div className="mt-10 h-12 w-64 rounded-md bg-tea-surface" /><div className="mt-12 h-72 rounded-md border border-tea-border bg-tea-surface" /></main>; }
function Unavailable({ onRetry }: { message: string; onRetry: () => void }) { return <main className="mx-auto w-full max-w-3xl px-4 py-20 pb-nav-gap-lg text-center md:px-6"><h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Public favorites unavailable</h1><p role="alert" className={`${TYPOGRAPHY_CLASSES.subtitle} mt-3 text-tea-text-sec`}>We could not load this public collection. Nothing private has been revealed.</p><button type="button" onClick={onRetry} className="tap-target mt-5 text-ui-13 text-tea-gold hover:text-tea-gold-lt">Retry</button></main>; }
