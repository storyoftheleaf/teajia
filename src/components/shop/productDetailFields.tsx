import { getTeaColor } from '../../designTokens';
import type { InventoryItem } from '../../types';
import { resolveLineage } from '../../wisdom/productIdentity';
import { reviewedLotProse } from '../../wisdom/reference/namedTeaLots';
import { passageAnchorId } from '../../wisdom/reference/listingPassages';
import type { ListingPassage } from '../../wisdom/reference/claims';
import { findProductOriginReference } from '../../wisdom/reference/catalogue';
import type { TeaReferenceCatalogue } from '../../wisdom/reference/types';
import { regionElevationPresentation } from '../../wisdom/regions';
import { normalizeTeaForm, normalizeTeaType, TEA_TYPES } from '../../wisdom/vocabulary';
import type { Fact } from '../wisdom/FactGrid';

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
  { region }: ReturnType<typeof teaRegionFields>, store: string | null,
  wisdom?: { passages: readonly ListingPassage[]; grade?: string; namedTeaId?: string; search: string }): Fact[] {
  const linkFor = (field: ListingPassage['gridField']) => {
    const passage = wisdom?.passages.find(entry => entry.gridField === field);
    return passage ? (wisdom?.search ?? '') + '#' + passageAnchorId(passage.claim.claimId) : undefined;
  };
  const typeLink = linkFor('type');
  const gradeLink = linkFor('grade');
  const recordedType = normalizeTeaType(item.type);
  const typeReference = recordedType && catalogue?.types.find(type => normalizeTeaType(type.id) === recordedType);
  const family = typeReference && catalogue?.families.find(entry => entry.id === typeReference.familyId);
  const named = wisdom?.namedTeaId && catalogue?.pages.find(page => page.kind === 'named_tea' && page.id === wisdom.namedTeaId);
  const regionName = region?.province || region?.name;
  const reference = findProductOriginReference(catalogue, item.id, item.origin);
  return [
    { label: 'Vintage', value: known(item.year) },
    ...(family ? [{ label: 'Tea family', value: family.name, to: '/wisdom/family/' + encodeURIComponent(family.id) }] : []),
    ...(typeLink ? [{ label: 'Type', value: item.type, to: typeLink }] : []),
    ...(gradeLink && wisdom?.grade ? [{
      label: 'Grade', value: wisdom.grade.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '), to: gradeLink,
    }] : []),
    reference ? {
      label: 'Region', value: reference.name, to: `/wisdom/region/${reference.id}`,
      state: { fromProduct: { id: item.id, slug: item.slug, name: item.variant || item.name, store, originId: reference.id } },
    } : { label: 'Region', value: regionName && regionName !== item.origin ? regionName : '' },
    { label: 'Location', value: known(item.origin), to: linkFor('location') },
    { label: 'Leaf cultivar', value: known(item.cultivar ?? '') },
    { label: 'Format', value: known(item.form) },
    ...(named ? [{ label: 'Named tea', value: named.label, to: '/wisdom/named/' + encodeURIComponent(named.id) }] : []),
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
    { label: 'Form', value: known(item.form) },
    { label: 'Capacity', value: typeof capacity === 'number' && Number.isFinite(capacity) && capacity > 0 ? `Approx. ${capacity} ml` : '' },
    { label: 'Condition', value: known(details?.condition) },
    { label: 'Material', value: known(item.material) },
    { label: 'Clay type', value: known(details?.clay_type) },
    { label: 'Construction', value: known(details?.construction) },
    { label: 'Maker', value: known(details?.maker) },
    { label: 'Mark', value: known(details?.mark) },
    { label: 'Date', value: age, content: age && basis ? <>{age}<small className="block text-tea-text-sec">{basis}</small></> : undefined },
    { label: 'Made in', value: known(item.origin) },
    { label: 'Use history', value: known(details?.use_history) },
    { label: 'Acquired in', value: known(details?.acquired_in) },
    { label: 'Acquired from', value: known(details?.acquired_from) },
    { label: 'Acquired when', value: known(details?.acquired_when) },
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
  introduction?: string;
  clay?: ReadingSection;
  sections: ReadingSection[];
  brewing?: string[];
}

function passage(label: string, ...text: (string | undefined)[]): ReadingSection {
  return { label, paragraphs: text.map(s => s?.trim() || '').filter(Boolean) };
}

// Move a short authored opening intact. Long or formatted prose stays in the reading.
function listingOpening(item: InventoryItem, fallback: string, teaser = '') {
  const description = known(item.description);
  const [first, ...rest] = description.split(/\n\s*\n/);
  const matchesPlaque = (text: string) => [item.name, item.variant, item.chineseName, item.type]
    .some(label => label?.trim().toLowerCase() === text.replace(/[.!。]$/, '').trim().toLowerCase());
  const opening = teaser && !matchesPlaque(teaser) ? teaser
    : first && first.length <= 200 && !first.includes('\n') && !first.startsWith('#') && !matchesPlaque(first) ? first : fallback;
  return {
    introduction: opening || undefined,
    remaining: first === opening || matchesPlaque(first) ? rest.join('\n\n').trim() : description,
  };
}

function teaIntroduction(item: InventoryItem) {
  const form = normalizeTeaForm(item.form);
  const names = { Loose: 'Loose leaf', Rolled: 'Rolled leaf', Cake: 'A tea cake', Brick: 'A tea brick',
    Tuo: 'A tuo', Ball: 'A tea ball', Bag: 'Bagged tea' };
  const origin = known(item.origin);
  if (form) return names[form] + (origin ? ` from ${origin}.` : '.');
  return origin ? `This tea comes from ${origin}.` : '';
}

export function teaReading(item: InventoryItem, surface: 'card' | 'page'): ProductReading {
  const text = reviewedLotProse(item.id, 'processingNotes', item.processingNotes) ?? '';
  const page = surface === 'page';
  // The free-text delimiter carries no evidence or approval. The standalone page
  // gets its closing style reference from the reviewed Wisdom projection.
  const processing = page ? text.split(/(?:^|\n)\s*## Style aroma reference\s*\n/i, 1)[0] : text;
  const teaser = item.tasting?.teaser?.trim();
  const opening = page ? listingOpening(item, teaIntroduction(item), item.tastingSource === 'owner' ? teaser : '') : undefined;
  return {
    label: 'About this tea',
    introduction: opening?.introduction,
    teaser: page ? undefined : teaser,
    sections: [
      passage('Introduction', opening?.remaining ?? item.description),
      passage('Lore', reviewedLotProse(item.id, 'lore', item.lore)),
      passage('Terroir', reviewedLotProse(item.id, 'terroir', item.terroir)),
      passage('Processing', processing),
      passage('Mood', item.mood),
      passage('Experience', item.experience),
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
  // If the plaque already gives the capacity, keep the remaining known facts in the grid.
  const capacity = item.capacityMl;
  const names = [item.name, item.variant].join(' ').toLowerCase().replace(/\s+/g, '');
  const fallback = typeof capacity === 'number' && Number.isFinite(capacity) && capacity > 0 && !names.includes(`${capacity}ml`)
    ? `This piece holds approximately ${capacity} ml.` : '';
  const opening = listingOpening(item, fallback);
  return {
    label: 'About this piece',
    introduction: opening.introduction,
    sections: [
      passage('About this piece', ...new Set([opening.remaining, ...[item.lore, item.processingNotes, item.experience].map(known)
        .filter(text => text !== opening.introduction && text !== known(item.description))])),
      passage('Clay', known(details?.clay_history)),
      passage('Form and history', known(details?.form_history)),
      passage('Provenance', known(details?.provenance)),
      passage('At the tea table', known(details?.brewing_notes)),
      passage('Pouring', known(details?.pour_notes)),
      { label: 'Suggested teas', links },
    ],
  };
}
