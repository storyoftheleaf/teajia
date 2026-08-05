import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  ContributorProfile,
  ContributorListItem,
  ContributorLink,
} from '../types';

// useContributor(slug), public profile for /people/:slug.
// Returns the contributor row joined with articles by, pull-quotes about,
// host account, products attributed, and the seasonal stamp.
//
// See docs/ARCHITECTURE.md.

export const useContributor = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['contributor', slug],
    enabled: !!slug,
    queryFn: async (): Promise<ContributorProfile> => {
      const data = await api.people.getBySlug(slug!);

      // Worker returns links as a JSON-parsed array. Defend against any
      // shape drift by re-coercing.
      const links: ContributorLink[] = Array.isArray(data?.links) ? data.links : [];

      return {
        id: data.id,
        account_id: data.account_id,
        user_id: data.user_id ?? null,
        face_of_account_id: data.face_of_account_id ?? null,

        display_name: data.display_name,
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
        is_published: (data.is_published ? 1 : 0) as 0 | 1,

        articles: Array.isArray(data.articles) ? data.articles : [],
        pull_quotes: Array.isArray(data.pull_quotes) ? data.pull_quotes : [],
        featured_in: Array.isArray(data.featured_in) ? data.featured_in : [],
        products: Array.isArray(data.products) ? data.products : [],
        host_account: data.host_account ?? null,
        seasonal_line: data.seasonal_line ?? null,

        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
};

// useContributors(), directory list for /people.
// Lighter shape; only the fields needed to render the typeset directory.

export const useContributors = () => {
  return useQuery({
    queryKey: ['contributors', 'public'],
    queryFn: async (): Promise<ContributorListItem[]> => {
      const data = await api.people.list();
      const rows = Array.isArray(data?.contributors) ? data.contributors : [];
      return rows.map((r: any): ContributorListItem => ({
        id: r.id,
        display_name: r.display_name,
        chinese_name: r.chinese_name ?? null,
        role: r.role ?? null,
        location_line: r.location_line ?? null,
        avatar_url: r.avatar_url ?? null,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
};
