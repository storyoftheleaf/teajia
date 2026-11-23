import { API_URL, authedBlobFetch, authedFetch, type ApiRequestInit } from '../../../lib/api';
import { BASE, type Auth } from './data';

export const SHAPE_LIBRARY_PATH = BASE + '/wisdom/shapes';
export const SHAPE_SILHOUETTES = [
  'Faceted or geometric', 'Low or flattened', 'Overhead handle', 'Pear or egg',
  'Ribbed or naturalistic', 'Round', 'Tall or cylindrical',
] as const;
export const SHAPE_FEATURES = ['profile', 'foot', 'lid', 'knob', 'spout', 'handle'] as const;
export type ShapeSilhouette = typeof SHAPE_SILHOUETTES[number];

type ShapeView = { asset: string; label: string; imageUrl?: string };
export type ShapeExemplar = {
  id?: string;
  title: string;
  credit: string;
  asset: string;
  recordUrl: string;
  imageUrl?: string;
  rights: string;
  notes?: string;
  tradition?: string;
  sourceType?: string;
  maker?: string;
  reviewStatus?: string;
  views?: ShapeView[];
};
export type ShapeForm = {
  id: string;
  chinese: string;
  pinyin: string;
  kind: string;
  silhouette: ShapeSilhouette;
  variants: string;
  nearNeighbors: string;
  features: Record<typeof SHAPE_FEATURES[number], string>;
  exemplar: ShapeExemplar;
  additionalExemplars?: ShapeExemplar[];
  supportingSources: { title: string; url: string }[];
};
export type ShapeLibraryData = { schemaVersion: number; libraryVersion: string; forms: ShapeForm[] };

const endpoint = API_URL + '/api/admin/yixing/shapes';
const options = (auth: Auth, signal: AbortSignal): ApiRequestInit => ({
  expectedAuth: auth, cache: 'no-store', reportIncident: false, signal,
});
export const loadShapeLibrary = (auth: Auth, signal: AbortSignal): Promise<ShapeLibraryData> =>
  authedFetch(endpoint, options(auth, signal));
export function loadShapePhoto(asset: string, auth: Auth, signal: AbortSignal) {
  const filename = asset.split('/').pop() ?? '';
  return authedBlobFetch(endpoint + '/media/' + encodeURIComponent(filename), options(auth, signal));
}

export function shapeLibraryPath(potId?: string, fromListing = false, originals = false) {
  const params = new URLSearchParams();
  if (potId) {
    params.set('pot', potId);
    if (fromListing) params.set('from', 'listing');
    if (originals) params.set('view', 'original');
  }
  return SHAPE_LIBRARY_PATH + (params.size ? '?' + params : '');
}

const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]/gu, '');

export function shapeExemplars(form: ShapeForm) {
  return [form.exemplar, ...(form.additionalExemplars ?? [])];
}

export function matchingShapes(forms: ShapeForm[], query: string, silhouette: string) {
  const terms = query.trim().split(/\s+/).map(normalize).filter(Boolean);
  return forms.filter(form => {
    if (silhouette && form.silhouette !== silhouette) return false;
    if (!terms.length) return true;
    const record = [
      form.chinese, form.pinyin, form.variants,
      ...shapeExemplars(form).flatMap(item => [item.title, item.credit, item.maker ?? '']),
    ].map(normalize).join(' ');
    return terms.every(term => record.includes(term));
  });
}
