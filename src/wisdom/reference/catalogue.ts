import type { PublicProduct } from '../../types';
import { isTeaType, normalizeTeaType, TEA_TYPES } from '../vocabulary';
import type {
  PublicReferenceEntry,
  PublicReferencePreview,
  PublicReferenceStatement,
} from '../receiving/previewImporter';
import type {
  PlaceLevel,
  PublicTeaOrigin,
  PublicTeaReferenceSource,
  PublicTeaType,
  TeaReferenceCatalogue,
} from './types';

const PLACE_LEVELS = new Set<PlaceLevel>([
  'major_region',
  'tea_area',
  'mountain',
  'village',
  'locality',
]);

const PUER_FAMILY_LABELS = new Set(['puer', 'puerh']);
const PUER_TYPES = TEA_TYPES.filter(type => type === 'Sheng' || type === 'Shou');

type PublicPlaceEntry = PublicReferenceEntry & { parentId?: string };

interface PlaceCandidate {
  entries: PublicPlaceEntry[];
  level: PlaceLevel;
  name: string;
}

function normalizedWords(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchesAtTokenBoundary(value: string, candidate: string): boolean {
  const haystack = normalizedWords(value);
  const needle = normalizedWords(candidate);
  return Boolean(needle) && (` ${haystack} `.includes(` ${needle} `));
}

function searchableProductFields(product: PublicProduct): string[] {
  return [
    product.type,
    product.originRegion,
    product.originCountry,
    product.givenName,
    product.productName,
  ];
}

function productMatches(product: PublicProduct, label: string): boolean {
  return searchableProductFields(product).some(value => matchesAtTokenBoundary(value, label));
}

function isSellableTea(product: PublicProduct): boolean {
  return (product.status === 'Active' || product.status === 'Sold Out')
    && !product.isPersonal
    && isTeaType(product.type);
}

function publicStatement(statement: PublicReferenceStatement): PublicReferenceStatement {
  return {
    id: statement.id,
    label: statement.label,
    text: statement.text,
    ...(statement.excerpt === undefined ? {} : { excerpt: statement.excerpt }),
    citation: {
      label: statement.citation.label,
      url: statement.citation.url,
    },
  };
}

function orderedUniqueFacts(entries: readonly PublicReferenceEntry[]): PublicReferenceStatement[] {
  const facts = entries
    .flatMap(entry => entry.statements)
    .map(publicStatement)
    .sort((left, right) => left.id.localeCompare(right.id)
      || JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const byId = new Map<string, PublicReferenceStatement>();
  for (const fact of facts) {
    if (!byId.has(fact.id)) byId.set(fact.id, fact);
  }
  return [...byId.values()];
}

function orderedUniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}

function allEntries(preview: PublicReferencePreview): PublicReferenceEntry[] {
  return preview.sections
    .flatMap(section => section.entries)
    .sort((left, right) => left.id.localeCompare(right.id)
      || left.label.localeCompare(right.label)
      || left.entityKind.localeCompare(right.entityKind));
}

function controlledTypeFor(entry: PublicReferenceEntry): 'Sheng' | 'Shou' | null {
  if (entry.entityKind !== 'tea_style') return null;
  const controlled = normalizeTeaType(entry.label);
  return controlled === 'Sheng' || controlled === 'Shou' ? controlled : null;
}

function buildTypes(
  entries: readonly PublicReferenceEntry[],
  products: readonly PublicProduct[],
): PublicTeaType[] {
  return PUER_TYPES.flatMap(type => {
    const matches = products.filter(product => normalizeTeaType(product.type) === type || productMatches(product, type));
    if (matches.length === 0) return [];
    const typeEntries = entries.filter(entry => controlledTypeFor(entry) === type);
    return [{
      id: type.toLowerCase(),
      name: type,
      familyId: 'puer',
      facts: orderedUniqueFacts(typeEntries),
      productIds: orderedUniqueIds(matches.map(product => product.id)),
    }];
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function isPuerFamily(entry: PublicReferenceEntry): boolean {
  return entry.entityKind === 'tea_family'
    && PUER_FAMILY_LABELS.has(normalizedWords(entry.label).replace(/\s/g, ''));
}

function buildOrigins(
  entries: readonly PublicReferenceEntry[],
  products: readonly PublicProduct[],
): PublicTeaOrigin[] {
  const candidates = new Map<string, PlaceCandidate>();
  for (const entry of entries) {
    if (!PLACE_LEVELS.has(entry.entityKind as PlaceLevel)) continue;
    const placeEntry = entry as PublicPlaceEntry;
    const existing = candidates.get(entry.id);
    if (existing) {
      existing.entries.push(placeEntry);
      continue;
    }
    candidates.set(entry.id, {
      entries: [placeEntry],
      level: entry.entityKind as PlaceLevel,
      name: entry.label,
    });
  }

  const declaredParents = new Map<string, string>();
  for (const [id, candidate] of candidates) {
    const declarations: unknown[] = [];
    for (const placeEntry of candidate.entries) {
      if (Object.prototype.hasOwnProperty.call(placeEntry, 'parentId')) declarations.push(placeEntry.parentId);
    }
    if (declarations.length === 0) continue;
    if (declarations.some(parentId => typeof parentId !== 'string' || !parentId.trim())) continue;
    const parentIds = new Set(declarations.map(parentId => (parentId as string).trim()));
    if (parentIds.size !== 1) continue;
    const [parentId] = parentIds;
    if (parentId === id || !candidates.has(parentId)) continue;
    declaredParents.set(id, parentId);
  }

  const entersCycle = (startId: string): boolean => {
    const seen = new Set([startId]);
    let currentId = startId;
    while (declaredParents.has(currentId)) {
      const parentId = declaredParents.get(currentId)!;
      if (seen.has(parentId)) return true;
      seen.add(parentId);
      currentId = parentId;
    }
    return false;
  };
  const verifiedParents = new Map(
    [...declaredParents].filter(([id]) => !entersCycle(id)),
  );

  const directMatches = new Map<string, string[]>();
  for (const [id, candidate] of candidates) {
    const productIds = products
      .filter(product => candidate.entries.some(placeEntry => productMatches(product, placeEntry.label)))
      .map(product => product.id);
    if (productIds.length > 0) directMatches.set(id, productIds);
  }

  const surfacedIds = new Map<string, string[]>();
  for (const [matchedId, productIds] of directMatches) {
    let currentId: string | undefined = matchedId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const existing = surfacedIds.get(currentId) || [];
      existing.push(...productIds);
      surfacedIds.set(currentId, existing);
      currentId = verifiedParents.get(currentId);
    }
  }

  return [...surfacedIds.entries()]
    .filter(([id]) => candidates.has(id))
    .map(([id, productIds]) => {
      const origin = candidates.get(id)!;
      const parentId = verifiedParents.get(id);
      return {
        id,
        name: origin.name,
        level: origin.level,
        ...(parentId ? { parentId } : {}),
        facts: orderedUniqueFacts(origin.entries),
        productIds: orderedUniqueIds(productIds),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function publicSources(preview: PublicReferencePreview): PublicTeaReferenceSource[] {
  const sources = preview.sources
    .map(source => ({
      sourceId: source.sourceId,
      publisher: source.publisher,
      publisherRoleLabel: source.publisherRoleLabel,
      title: source.title,
      author: source.author,
      publishedDate: source.publishedDate,
      url: source.url,
    }))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId)
      || JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const byId = new Map<string, PublicTeaReferenceSource>();
  for (const source of sources) {
    if (!byId.has(source.sourceId)) byId.set(source.sourceId, source);
  }
  return [...byId.values()];
}

export function buildTeaReferenceCatalogue(
  publicPreview: PublicReferencePreview,
  publicProducts: readonly PublicProduct[],
): TeaReferenceCatalogue {
  const entries = allEntries(publicPreview);
  const products = publicProducts.filter(isSellableTea);
  const types = buildTypes(entries, products);
  const familyProductIds = orderedUniqueIds(types.flatMap(type => type.productIds));
  const familyEntries = entries.filter(isPuerFamily);

  return {
    families: familyProductIds.length === 0 ? [] : [{
      id: 'puer',
      name: familyEntries[0]?.label || 'Pu’er',
      facts: orderedUniqueFacts(familyEntries),
      productIds: familyProductIds,
    }],
    types,
    origins: buildOrigins(entries, products),
    sources: publicSources(publicPreview),
  };
}
