import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  ContributorProfile,
  ContributorListItem,
  ContributorLink,
} from '../types';

// useContributor(slug), public profile for /people/:slug.
// Returns the contributor row joined with articles by, pull-quotes about,
// host account, products attributed, the person's tea selection and
// collection, the next hosted event, the gallery, and the seasonal stamp.
// The worker already sends every one of these; this hook's job is to hand
// them on, typed, and to defend the page against shape drift on the arrays.
//
// See docs/ARCHITECTURE.md.

const arrayOf = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export const useContributor = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['contributor', slug],
    enabled: !!slug,
    queryFn: async (): Promise<ContributorProfile> => {
      const data = await api.people.getBySlug(slug!);

      // Worker returns links as a JSON-parsed array of typed links. Anything
      // without a platform and a value is dropped rather than rendered blank.
      const links: ContributorLink[] = arrayOf<Partial<ContributorLink>>(data?.links)
        .filter((link): link is ContributorLink => typeof link?.platform === 'string' && typeof link?.value === 'string' && link.value.trim().length > 0)
        .map(link => ({ ...link, qr_image_url: link.qr_image_url ?? null }));

      return {
        id: data.id,
        display_name: data.display_name,
        business_name: data.business_name ?? null,
        chinese_name: data.chinese_name ?? null,
        role: data.role ?? null,
        pronouns: data.pronouns ?? null,
        location_line: data.location_line ?? null,
        active_since: data.active_since ?? null,

        beginnings: data.beginnings ?? null,
        now_text: data.now_text ?? null,
        now_stamp: data.now_stamp ?? null,
        now_updated_at: data.now_updated_at ?? null,
        inspirations: data.inspirations ?? null,
        closing: data.closing ?? null,

        avatar_url: data.avatar_url ?? null,
        portrait_url: data.portrait_url ?? null,
        portrait_caption: data.portrait_caption ?? null,
        voice_clip_url: data.voice_clip_url ?? null,
        voice_clip_caption: data.voice_clip_caption ?? null,

        pouring_today_product_id: data.pouring_today_product_id ?? null,
        pouring_today_note: data.pouring_today_note ?? null,
        where_to_find_text: data.where_to_find_text ?? null,

        links,
        languages: arrayOf<string>(data.languages),
        is_published: (data.is_published ? 1 : 0) as 0 | 1,
        gallery_images: arrayOf(data.gallery_images),

        articles: arrayOf(data.articles),
        pull_quotes: arrayOf(data.pull_quotes),
        featured_in: arrayOf(data.featured_in),
        products: arrayOf(data.products),
        tea_selection: arrayOf(data.tea_selection),
        collection: data.collection && typeof data.collection.slug === 'string' ? data.collection : null,
        hosting: data.hosting && typeof data.hosting.slug === 'string' ? data.hosting : null,
        accounts: arrayOf(data.accounts),
        shelf_slug: typeof data.shelf_slug === 'string' ? data.shelf_slug : null,
        has_payment_methods: data.has_payment_methods === true,
        payment_accounts: arrayOf(data.payment_accounts),
        host_account: data.host_account ?? null,
        seasonal_line: data.seasonal_line ?? null,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
};

// useContributors(), directory list for /people.
// The card grid needs the image, the two names, the role, and the two facts
// the filter row reads (host, writer).

export const useContributors = () => {
  return useQuery({
    queryKey: ['contributors', 'public'],
    queryFn: async (): Promise<ContributorListItem[]> => {
      const data = await api.people.list();
      const rows = arrayOf<Record<string, any>>(data?.contributors);
      return rows.map((r): ContributorListItem => ({
        id: r.id,
        display_name: r.display_name,
        chinese_name: r.chinese_name ?? null,
        role: r.role ?? null,
        business_name: r.business_name ?? null,
        location_line: r.location_line ?? null,
        avatar_url: r.avatar_url ?? null,
        card_image_url: r.card_image_url ?? null,
        is_host: r.is_host === true,
        article_count: Number(r.article_count || 0),
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
};
