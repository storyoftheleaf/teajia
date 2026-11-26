// Launch 4: favourites in three kinds, the caller's own only. Reached as
// api.favourites. No counts in any answer.
import type { MyFavourites } from './favouritesTypes';

interface FavouritesApiDependencies {
  apiUrl: string;
  authedFetch: (url: string, init?: RequestInit) => Promise<any>;
}

export function createFavouritesApi({ apiUrl, authedFetch }: FavouritesApiDependencies) {
  const article = (id: string) => `${apiUrl}/api/me/favourites/articles/${encodeURIComponent(id)}`;
  return {
    list: (): Promise<MyFavourites> => authedFetch(`${apiUrl}/api/me/favourites`),
    keepArticle: (id: string): Promise<{ kept: boolean }> => authedFetch(article(id), { method: 'PUT' }),
    unkeepArticle: (id: string): Promise<{ kept: boolean }> => authedFetch(article(id), { method: 'DELETE' }),
    markChestTea: (id: string, favourite: boolean): Promise<{ id: string; favourite: boolean }> =>
      authedFetch(`${apiUrl}/api/me/cellar/${encodeURIComponent(id)}/favourite`, {
        method: 'PUT', body: JSON.stringify({ favourite }),
      }),
  };
}
