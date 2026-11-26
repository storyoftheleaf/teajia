// Launch 4: what GET /api/me/favourites answers (worker/src/favourites.ts).
// Three kinds, each the caller's own, each with the path that opens it.
// There are no counts here, by design.

export interface FavouriteArticle {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
  path: string;
  is_public: boolean;
}

export interface FavouriteShopTea {
  id: string;
  name: string;
  type: string | null;
  image_url: string | null;
  path: string;
}

export interface FavouriteChestTea {
  id: string;
  name: string;
  type: string | null;
  year: number | null;
  image_url: string | null;
  path: string;
}

export interface MyFavourites {
  articles: FavouriteArticle[];
  shop_teas: FavouriteShopTea[];
  chest_teas: FavouriteChestTea[];
}

/** The React Query key for the caller's favourites. */
export const MY_FAVOURITES_KEY = ['my-favourites'] as const;
