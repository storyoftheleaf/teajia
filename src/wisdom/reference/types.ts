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

export type PublicTeaReferencePageKind = 'tea_family' | 'tea_type' | 'major_region' | 'tea_area';

export interface PublicTeaReferencePageSection {
  key: string;
  label: string;
  text: string;
  sourceIds: readonly string[];
}

export interface PublicTeaReferencePage {
  id: string;
  slug: string;
  kind: PublicTeaReferencePageKind;
  label: string;
  nativeName?: string;
  parentId?: string;
  sourceIds: readonly string[];
  sections: readonly PublicTeaReferencePageSection[];
}

export interface TeaReferencePageRegistry {
  schemaVersion: 1;
  pages: readonly PublicTeaReferencePage[];
  sources: readonly PublicTeaReferenceSource[];
}

export interface TeaReferenceCatalogue {
  families: PublicTeaFamily[];
  types: PublicTeaType[];
  origins: PublicTeaOrigin[];
  sources: PublicTeaReferenceSource[];
  pages: readonly PublicTeaReferencePage[];
}
