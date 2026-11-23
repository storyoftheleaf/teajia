import type { SitCreditRole } from './sitCreditContract';

export type PublicSitRef = { slug: string; title: string; event_date: string };
export type ProfileSitRef = PublicSitRef & { role: SitCreditRole };

export const sitLinksQuery = ['public-sit-links'] as const;
export const recapPath = (slug: string) => `/event/${encodeURIComponent(slug)}/recap`;
