/**
 * Tea houses as Adrian's portfolio: the shapes the worker (worker/src/teaHouses.ts)
 * and the pages share. A house's page leads with what Adrian did there, in his
 * words, part by part, each part present only where he said it is true.
 */

/** The parts Adrian may have done in a house, in the order a build runs. */
export const TEA_HOUSE_PARTS = ['room', 'teaware', 'tea_menu', 'training', 'opening', 'sourcing'] as const;
export type TeaHousePart = (typeof TEA_HOUSE_PARTS)[number];

/** Each part's name, as a heading on a house's page and in Manage. */
export const TEA_HOUSE_PART_LABELS: Record<TeaHousePart, string> = {
  room: 'The room and its layout',
  teaware: 'The teaware',
  tea_menu: 'The tea menu',
  training: 'Training those who pour',
  opening: 'The opening sessions',
  sourcing: 'The sourcing since',
};

/** Each part as an offer, on Build. */
export const TEA_HOUSE_PART_OFFERS: Record<TeaHousePart, string> = {
  room: 'The room and its layout',
  teaware: 'The teaware for it',
  tea_menu: 'Its tea menu',
  training: 'Training the people who pour',
  opening: 'Its opening sessions',
  sourcing: 'The sourcing after it opens',
};

/** At most this many photographs on one part. */
export const TEA_HOUSE_PART_PHOTOS = 6;
/** At most this many characters of his words on one part: one or two sentences, with room. */
export const TEA_HOUSE_WORDS_MAX = 1200;

export function isTeaHousePart(value: unknown): value is TeaHousePart {
  return typeof value === 'string' && (TEA_HOUSE_PARTS as readonly string[]).includes(value);
}

/** One part of a house, in his words. */
export interface TeaHouseContribution {
  part: TeaHousePart;
  words: string;
  photographs: string[];
}

/** A house as the public pages name it. Never an address. */
export interface TeaHouseSummary {
  slug: string;
  name: string;
  place: string | null;
}

/** A house on Work: its name, its place, one photograph. */
export interface TeaHouseWorkItem extends TeaHouseSummary {
  photograph: string | null;
}

/** GET /api/tea-houses/work: the houses in Adrian's order. */
export interface TeaHouseWork {
  houses: TeaHouseWorkItem[];
}

/** GET /api/tea-houses/work/:slug: one house's page. */
export interface TeaHousePage {
  house: TeaHouseSummary;
  parts: TeaHouseContribution[];
}

/** GET /api/tea-houses/build: each part he has done somewhere, with the houses where he did it, in his order. */
export interface TeaHouseBuild {
  parts: Array<{ part: TeaHousePart; houses: TeaHouseSummary[] }>;
}

/** A house in Manage. */
export interface TeaHouseManageItem {
  id: string;
  slug: string;
  name: string;
  place: string | null;
  /** Whether the house's own page is public. A portfolio page of a house that is not public cannot be seen. */
  is_public: boolean;
  /** Null until he has said anything about this house. */
  page: { position: number; shown: boolean } | null;
  parts: TeaHouseContribution[];
}

export interface TeaHouseManage {
  houses: TeaHouseManageItem[];
}

/** A house's place in words: city, country. */
export function teaHousePlace(city: string | null | undefined, country: string | null | undefined): string | null {
  const place = [city, country].map(value => (value ?? '').trim()).filter(Boolean).join(', ');
  return place || null;
}

/** The address of a house's portfolio page. */
export function teaHousePagePath(slug: string): string {
  return `/tea-houses/work/${encodeURIComponent(slug)}`;
}
