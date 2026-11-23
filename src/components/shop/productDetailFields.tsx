import { getTeaColor } from '../../designTokens';
import type { InventoryItem } from '../../types';
import { resolveLineage, resolveRecord } from '../../wisdom/productIdentity';
import { findProductOriginReference } from '../../wisdom/reference/catalogue';
import type { TeaReferenceCatalogue } from '../../wisdom/reference/types';
import { regionElevationPresentation } from '../../wisdom/regions';
import { normalizeTeaType, TEA_TYPES } from '../../wisdom/vocabulary';
import type { Fact } from '../wisdom/FactGrid';
import { recordFacts } from '../wisdom/TeaReference';

export function productIdentity(item: InventoryItem) {
  return {
    item,
    productName: item.variant || item.name,
    givenName: item.variant !== item.name ? item.name : '',
    teaType: item.type,
    typeLabel: item.category === 'ware' ? item.type : undefined,
    chineseCharacters: (item.chineseName ?? '').replace(/[0-9A-Za-z\s]/g, ''),
    typeColor: getTeaColor(item.type),
  };
}

export function productGallery(item: InventoryItem, surface: 'card' | 'page') {
  const images = [item.image, ...(item.additionalImages ?? [])].filter(Boolean);
  const ware = item.category === 'ware';
  return {
    itemName: item.name,
    allImages: surface === 'card' ? images.slice(0, 3) : ware ? images.slice(0, 4) : images,
    squarePage: !ware,
    featured: surface === 'page' && ware,
  };
}

export function teaRegionFields(item: InventoryItem) {
  const region = item.category === 'tea' ? resolveLineage(item).region : null;
  const scoped = regionElevationPresentation(region);
  const elevation = scoped && {
    ...scoped,
    label: region?.elevation?.scope === 'tea_growing' ? 'Elevation' : scoped.label,
  };
  return { region, elevation };
}

export function teaFacts(item: InventoryItem, catalogue: TeaReferenceCatalogue | null,
  { region, elevation }: ReturnType<typeof teaRegionFields>, store: string | null): Fact[] {
  const regionName = region?.province || region?.name;
  const reference = findProductOriginReference(catalogue, item.id, item.origin);
  return [
    { label: 'Vintage', value: item.year },
    reference ? {
      label: 'Region', value: reference.name, to: `/wisdom/region/${reference.id}`,
      state: { fromProduct: { id: item.id, slug: item.slug, name: item.variant || item.name, store, originId: reference.id } },
    } : { label: 'Region', value: regionName && regionName !== item.origin ? regionName : '' },
    { label: 'Location', value: item.origin },
    { label: 'Leaf cultivar', value: item.cultivar ?? '' },
    { label: 'Format', value: item.form ?? '' },
    { label: elevation?.label ?? 'Elevation', value: elevation?.value ?? '' },
    { label: 'Forest cover', value: region?.forestCover ?? '' },
    { label: 'Tree character', value: region?.treeCharacter ?? '' },
    ...recordFacts(resolveRecord(item)),
  ];
}

function known(value: string | undefined) {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^(unknown|not recorded|n\/a)$/i.test(text) ? '' : text;
}

export function teawareFacts(item: InventoryItem): Fact[] {
  const details = item.teawareDetails;
  const age = known(details?.age_estimate) || known(item.year);
  const basis = known(details?.dating_basis);
  const capacity = item.capacityMl;
  return [
    { label: 'Clay type', value: known(details?.clay_type) },
    { label: 'Form', value: known(item.form) },
    { label: 'Material', value: known(item.material) },
    { label: 'Date', value: age, content: age && basis ? <>{age}<small className="block text-tea-text-sec">{basis}</small></> : undefined },
    { label: 'Maker', value: known(details?.maker) },
    { label: 'Mark', value: known(details?.mark) },
    { label: 'Made in', value: known(item.origin) },
    { label: 'Acquired in', value: known(details?.acquired_in) },
    { label: 'Acquired from', value: known(details?.acquired_from) },
    { label: 'Acquired when', value: known(details?.acquired_when) },
    { label: 'Construction', value: known(details?.construction) },
    { label: 'Use history', value: known(details?.use_history) },
    { label: 'Condition', value: known(details?.condition) },
    { label: 'Capacity', value: typeof capacity === 'number' && Number.isFinite(capacity) && capacity > 0 ? `Approx. ${capacity} ml` : '' },
  ];
}

interface ReadingSection {
  label: string;
  paragraphs?: string[];
  links?: { name: string; href?: string }[];
}

export interface ProductReading {
  label: string;
  teaser?: string;
  sections: ReadingSection[];
  brewing?: string[];
}

function passage(label: string, ...text: (string | undefined)[]): ReadingSection {
  return { label, paragraphs: text.map(s => s?.trim() || '').filter(Boolean) };
}

export function teaReading(item: InventoryItem, surface: 'card' | 'page'): ProductReading {
  const text = item.processingNotes ?? '';
  const [processing, aroma] = surface === 'page' ? text.split(/\n\s*## Style aroma reference\s*\n/, 2) : [text];
  return {
    label: 'About this tea',
    teaser: item.tasting?.teaser?.trim(),
    sections: [
      passage('Introduction', item.description),
      passage('Lore', item.lore),
      passage('Terroir', item.terroir),
      passage('Processing', processing),
      passage('Mood', item.mood),
      passage('Experience', item.experience),
      passage('Flavor & Aroma Profile', aroma),
    ],
    brewing: item.tasting?.brewing,
  };
}

export function teawareReading(item: InventoryItem, store: string | null): ProductReading {
  const details = item.teawareDetails;
  const teaNames = Array.isArray(details?.recommended_tea_types) ? details.recommended_tea_types : [details?.recommended_tea_type];
  const links = [...new Set(teaNames.map(known).filter(Boolean))].map(name => {
    const type = normalizeTeaType(name) ?? TEA_TYPES.find(t => name.toLowerCase().split(/[^a-z]+/).includes(t.toLowerCase()));
    if (!type) return { name };
    const params = new URLSearchParams({ type });
    if (store) params.set('store', store);
    return { name, href: `/shop?${params}` };
  });
  return {
    label: 'About this piece',
    sections: [
      passage('About this piece', ...new Set([item.description, item.lore, item.processingNotes, item.experience].map(known))),
      { label: 'Suggested teas', links },
      passage('Clay', known(details?.clay_history)),
      passage('Form and history', known(details?.form_history)),
      passage('Provenance', known(details?.provenance)),
      passage('At the tea table', known(details?.brewing_notes)),
      passage('Pouring', known(details?.pour_notes)),
    ],
  };
}
