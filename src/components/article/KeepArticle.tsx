import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, hasToken, type MyFavourites } from '../../lib/api';
import { favouritesOpen } from '../../lib/favouritesOpen';
import { MY_FAVOURITES_KEY } from '../../lib/favouritesTypes';
import { Button } from '../shared/Button';

// Launch 4: one quiet "Keep" on an article. Signed out, it leads to sign in and
// back to this article. Kept articles are listed, privately, at
// /account/favourites. No count is read or shown.

export function KeepArticle({ articleId, className = '' }: { articleId: string; className?: string }) {
  const open = favouritesOpen();
  const authed = hasToken();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: MY_FAVOURITES_KEY,
    queryFn: () => api.favourites.list(),
    enabled: open && authed,
    staleTime: 1000 * 60,
  });
  const kept = !!data?.articles.some(article => article.id === articleId);

  const toggle = useMutation({
    mutationFn: (keep: boolean) => keep ? api.favourites.keepArticle(articleId) : api.favourites.unkeepArticle(articleId),
    onSuccess: (_result, keep) => {
      qc.setQueryData<MyFavourites>(MY_FAVOURITES_KEY, current => current && ({
        ...current,
        // Until the list is read again, a placeholder row is enough to say "Kept".
        articles: keep
          ? [{ id: articleId, slug: '', title: '', subtitle: null, cover_image_url: null, path: '', is_public: false }, ...current.articles]
          : current.articles.filter(article => article.id !== articleId),
      }));
      return qc.invalidateQueries({ queryKey: MY_FAVOURITES_KEY });
    },
  });

  if (!open) return null;

  const onClick = () => {
    if (!authed) {
      navigate(`/signin?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    toggle.mutate(!kept);
  };

  return (
    <Button
      variant="plain"
      type="button"
      onClick={onClick}
      disabled={toggle.isPending}
      aria-pressed={authed ? kept : undefined}
      data-testid="keep-article"
      className={`tap-target inline-flex items-center justify-center text-ui-12 tracking-wide text-tea-text-sec transition-colors hover:text-tea-text disabled:opacity-60 ${className}`}
    >
      {kept ? 'Kept' : 'Keep'}
    </Button>
  );
}
