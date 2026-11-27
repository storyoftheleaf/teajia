import { useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icons } from '../components/Icons';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { api, hasToken, type MyFavourites } from '../lib/api';
import { useAppStore } from '../lib/store';
import { MY_FAVOURITES_KEY } from '../lib/favouritesTypes';
import { favouritesOpen } from '../lib/favouritesOpen';
import { SiteNotFound } from '../components/SiteNotFound';
import { PART_QUERY, partView } from '../lib/closedPart';
import { TEA_TABLE_MINE_KEY, teaTableApi, useTeaTableMine } from '../lib/teaTableApi';
import { recapPath } from '../lib/publicSitConnections';
import type { TeaTableItem, TeaTableMine } from '../lib/teaTableContract';
import { historyIndex } from '../admin/components/adminHistory';

// Launch 4, favourites in three kinds (todo/plans/guests-and-tea-masters-launch-4-run.md, K3).
// Everything a person has marked, in one place: articles they kept, teas the
// shop has (the heart), and teas in their own Tea Chest. The three records stay
// separate; this page only reads them and takes one off at a time. Each list is
// private to its owner. There are no counts here of any kind.

type Kind = keyof MyFavourites;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-8">
      <h2 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>{title}</h2>
      <ul className="mt-3 divide-y divide-tea-border rounded-xl border border-tea-border bg-tea-surface">{children}</ul>
    </section>
  );
}

function Row({ to, title, detail, onTakeOff, busy }: {
  to: string;
  title: string;
  detail?: string | null;
  onTakeOff: () => void;
  busy: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-3">
      <Link to={to} className="min-w-0 flex-1 break-words">
        <span className={`${TYPOGRAPHY_CLASSES.body} block text-tea-text`}>{title}</span>
        {detail && <span className="mt-0.5 block text-ui-12 text-tea-text-dim">{detail}</span>}
      </Link>
      <button
        type="button"
        onClick={onTakeOff}
        disabled={busy}
        aria-label={`Take ${title} off`}
        className="tap-target shrink-0 text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text disabled:opacity-60"
      >
        Take off
      </button>
    </li>
  );
}

export default function FavouritesPage() {
  // Closed, the address is simply not a page.
  if (!favouritesOpen()) return <SiteNotFound />;
  return <OpenFavouritesPage />;
}

function OpenFavouritesPage() {
  const navigate = useNavigate();
  const authed = hasToken();
  const qc = useQueryClient();
  const favoriteTeas = useAppStore(s => s.favoriteTeas);
  const toggleFavoriteTea = useAppStore(s => s.toggleFavoriteTea);
  const mergeFavorites = useAppStore(s => s.mergeFavorites);

  useEffect(() => {
    if (!authed) navigate(`/signin?returnTo=${encodeURIComponent('/account/favourites')}`, { replace: true });
  }, [authed, navigate]);

  const favourites = useQuery({
    queryKey: MY_FAVOURITES_KEY,
    queryFn: () => api.favourites.list(),
    enabled: authed,
    staleTime: 1000 * 60,
    ...PART_QUERY,
  });
  const { data, isLoading, refetch } = favourites;
  const view = partView(favourites);
  const isError = view.state === 'failed';

  const drop = (kind: Kind, id: string) => qc.setQueryData<MyFavourites>(MY_FAVOURITES_KEY, current => current && ({
    ...current,
    [kind]: (current[kind] as Array<{ id: string }>).filter(item => item.id !== id),
  }));

  const takeOff = useMutation({
    mutationFn: async ({ kind, id }: { kind: Kind; id: string }) => {
      if (kind === 'articles') await api.favourites.unkeepArticle(id);
      else if (kind === 'chest_teas') {
        await api.favourites.markChestTea(id, false);
        await qc.invalidateQueries({ queryKey: ['cellar'] });
      } else {
        // The heart's own list, changed exactly as the heart changes it.
        if (!favoriteTeas.includes(id)) mergeFavorites([id]);
        toggleFavoriteTea(id);
      }
    },
    onSuccess: (_result, { kind, id }) => drop(kind, id),
  });

  // Pieces kept from the Tea Table, while it is open (src/lib/teaTable.ts). Its own record, read on its own.
  const teaTable = useTeaTableMine();
  const letGo = useMutation({
    mutationFn: (item: TeaTableItem) => teaTableApi.keep(item.kind, item.id, false),
    onSuccess: (_result, item) => qc.setQueryData<TeaTableMine>(TEA_TABLE_MINE_KEY, current => current && ({
      ...current, kept: current.kept.filter(kept => !(kept.kind === item.kind && kept.id === item.id)),
    })),
  });

  if (!authed) return null;
  // Open on the site, not yet on the worker: the address is not a page yet (A10-3).
  if (view.state === 'closed') return <SiteNotFound />;

  // A row the Keep control placed before the list was read again has no title yet.
  const articles = (data?.articles ?? []).filter(article => article.title);
  const shopTeas = data?.shop_teas ?? [];
  const chestTeas = data?.chest_teas ?? [];
  const tablePieces = teaTable.data?.kept ?? [];
  const empty = !!data && articles.length === 0 && shopTeas.length === 0 && chestTeas.length === 0 && tablePieces.length === 0;
  const busy = (kind: Kind, id: string) => takeOff.isPending && takeOff.variables?.kind === kind && takeOff.variables.id === id;

  return (
    <main data-testid="favourites-page" className="min-h-screen bg-tea-bg pb-nav-gap-lg">
      <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6">
        <button
          type="button"
          onClick={() => (historyIndex() > 0 ? navigate(-1) : navigate('/account'))}
          className="tap-target inline-flex items-center gap-1.5 text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text"
        >
          <Icons.Back className="h-4 w-4" />
          <span>Back</span>
        </button>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} mt-6 text-tea-text`}>Favourites</h1>
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 text-tea-text-sec`}>Only you can see these.</p>

        {isLoading && <p className="mt-8 text-ui-14 text-tea-text-sec">Opening your favourites.</p>}
        {isError && (
          <div role="alert" className="mt-8 rounded-xl border border-tea-border bg-tea-surface p-5">
            <p className="text-ui-14 text-tea-text-sec">We could not open your favourites just now.</p>
            <button type="button" onClick={() => refetch()} className="tap-target mt-2 text-ui-13 text-tea-gold hover:text-tea-gold-lt">
              Try again
            </button>
          </div>
        )}
        {takeOff.error && <p role="alert" className="mt-4 text-ui-13 text-tea-text">{takeOff.error.message}</p>}

        {empty && (
          <p className={`${TYPOGRAPHY_CLASSES.body} mt-8 text-tea-text-sec`}>
            Nothing kept yet. Keep an article from <Link to="/read" className="text-tea-gold hover:text-tea-gold-lt">Read</Link>,
            or a tea from <Link to="/shop" className="text-tea-gold hover:text-tea-gold-lt">the shop</Link>.
          </p>
        )}

        {articles.length > 0 && (
          <Section title="Articles">
            {articles.map(article => (
              <Row key={article.id} to={article.path} title={article.title} detail={article.subtitle}
                busy={busy('articles', article.id)} onTakeOff={() => takeOff.mutate({ kind: 'articles', id: article.id })} />
            ))}
          </Section>
        )}
        {shopTeas.length > 0 && (
          <Section title="Teas at the shop">
            {shopTeas.map(tea => (
              <Row key={tea.id} to={tea.path} title={tea.name} detail={tea.type}
                busy={busy('shop_teas', tea.id)} onTakeOff={() => takeOff.mutate({ kind: 'shop_teas', id: tea.id })} />
            ))}
          </Section>
        )}
        {chestTeas.length > 0 && (
          <Section title="Teas in my Tea Chest">
            {chestTeas.map(tea => (
              <Row key={tea.id} to={tea.path} title={tea.name} detail={[tea.type, tea.year].filter(Boolean).join(', ') || null}
                busy={busy('chest_teas', tea.id)} onTakeOff={() => takeOff.mutate({ kind: 'chest_teas', id: tea.id })} />
            ))}
          </Section>
        )}
        {tablePieces.length > 0 && (
          <Section title="From the Tea Table">
            {tablePieces.map(item => (
              <Row key={`${item.kind}:${item.id}`}
                to={item.kind === 'recap' ? recapPath(item.slug) : item.tea.path}
                title={item.kind === 'recap' ? item.title : item.tea.name}
                detail={item.kind === 'recap' ? (item.host ? `Hosted by ${item.host}` : null) : `Tasted by ${item.person.name}`}
                busy={letGo.isPending && letGo.variables?.id === item.id}
                onTakeOff={() => letGo.mutate(item)} />
            ))}
          </Section>
        )}
      </div>
    </main>
  );
}
