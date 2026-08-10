import type { PublicReferenceStatement } from '../receiving/previewImporter';

export type PlaceLevel = 'major_region' | 'tea_area' | 'mountain' | 'village' | 'locality';

export interface PublicTeaFamily {
  id: string;
  name: string;
  facts: PublicReferenceStatement[];
  productIds: string[];
}

export interface PublicTeaType {
  id: string;
  name: string;
  familyId: string;
  facts: PublicReferenceStatement[];
  productIds: string[];
}

export interface PublicTeaOrigin {
  id: string;
  name: string;
  level: PlaceLevel;
  parentId?: string;
  facts: PublicReferenceStatement[];
  productIds: string[];
}

export interface PublicTeaReferenceSource {
  sourceId: string;
  publisher: string;
  publisherRoleLabel: string;
  title: string;
  author: string;
  publishedDate: string;
  url: string;
}

export interface TeaReferenceCatalogue {
  families: PublicTeaFamily[];
  types: PublicTeaType[];
  origins: PublicTeaOrigin[];
  sources: PublicTeaReferenceSource[];
}
