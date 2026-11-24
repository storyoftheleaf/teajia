export const casualSitLimits = { title: 120, writing: 1000, teaName: 200, photoAlt: 250 } as const;

import type { PublicSessionTea } from './sessionTea';

export type CasualSitRecap = {
  slug: string;
  title: string;
  date: string;
  writing: string;
  tea: { name: string; productId: string | null };
  /** The poured tea as a record (shared/sessionTea.ts). */
  teas?: PublicSessionTea[];
  host: { slug: string; name: string };
  photo: { id: string; alt: string } | null;
};

export type CasualSitPublicationDraft = {
  title: string;
  writing: string;
  teaName: string;
  linkShopTea: boolean;
  photo: { id: string; alt: string } | null;
};

export type CasualSitPublicationStatus = {
  profile: { slug: string; name: string } | null;
  shopTeaName: string | null;
  publication: (CasualSitPublicationDraft & { slug: string; visible: boolean }) | null;
};
