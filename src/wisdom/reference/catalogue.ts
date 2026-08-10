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
  PublicTeaReferencePage,
  PublicTeaReferenceSource,
  PublicTeaType,
  TeaReferenceCatalogue,
} from './types';
import {
  GENERATED_TEA_REFERENCE_PAGES,
  GENERATED_TEA_REFERENCE_REGISTRY,
} from './generatedPages';

const PLACE_LEVELS = new Set<PlaceLevel>([
  'major_region',
  'tea_area',
  'mountain',
  'village',
  'locality',
]);

const PUER_FAMILY_LABELS = new Set(['puer', 'puerh']);
const PLACE_DESCRIPTOR_WORDS = new Set([
  'area',
  'county',
  'greater',
  'mountain',
  'mountains',
  'production',
  'puer',
  'puerh',
  'region',
  'regions',
  'tea',
  'village',
]);
const PUER_TYPES = TEA_TYPES.filter(type => type === 'Sheng' || type === 'Shou');
const INVENTORY_CANDIDATE_TYPES: ReadonlySet<string> = new Set(['Oolong', 'Dark', 'White', 'Red']);
const PLACE_RANK: Record<PlaceLevel, number> = {
  major_region: 0,
  tea_area: 1,
  mountain: 2,
  village: 3,
  locality: 4,
};

interface PlaceCandidate {
  entries: PublicReferenceEntry[];
  level: PlaceLevel;
  name: string;
}

function codePointCompare(left: string, right: string): number {
  const leftCharacters = left[Symbol.iterator]();
  const rightCharacters = right[Symbol.iterator]();
  while (true) {
    const leftCharacter = leftCharacters.next();
    const rightCharacter = rightCharacters.next();
    if (leftCharacter.done || rightCharacter.done) {
      return leftCharacter.done === rightCharacter.done ? 0 : leftCharacter.done ? -1 : 1;
    }
    const leftPoint = leftCharacter.value.codePointAt(0)!;
    const rightPoint = rightCharacter.value.codePointAt(0)!;
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
  }
}

function normalizedWords(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
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

function productMatchesPlace(product: PublicProduct, label: string): boolean {
  const words = normalizedWords(label).split(' ').filter(Boolean);
  const concise = words.filter(word => !PLACE_DESCRIPTOR_WORDS.has(word)).join(' ');
  const aliases = new Set([label, concise].filter(alias => [...normalizedWords(alias)].length >= 2));
  return [...aliases].some(alias => (
    searchableProductFields(product).some(value => matchesAtTokenBoundary(value, alias))
  ));
}

function hasPositiveRetail(product: PublicProduct): boolean {
  return Number(product.fixedRetailPriceUSD) > 0 || Number(product.pricePerGramUSD) > 0;
}

function isSellableActiveTea(product: PublicProduct): boolean {
  return product.status === 'Active'
    && product.stockGrams > 0
    && hasPositiveRetail(product);
}

/** Only public catalogue records can be shown; active records alone qualify a reference entry. */
function isEligiblePublicTeaProduct(product: PublicProduct): boolean {
  if (product.isPersonal || !isTeaType(product.type)) return false;
  return product.status === 'Sold Out' || isSellableActiveTea(product);
}

export interface InventoryBackedReferenceLotCandidate {
  productId: string;
  displayName: string;
  year?: number;
}

export interface InventoryBackedReferenceCandidate {
  canonicalType: 'Oolong' | 'Dark' | 'White' | 'Red';
  matchMethod: 'controlled_type';
  familyId: null;
  facts: [];
  lots: InventoryBackedReferenceLotCandidate[];
  modelGap: string;
}

/**
 * Inventory can safely nominate its controlled types for editorial review, but
 * it cannot decide whether each is a family or child type and carries no cited
 * reference facts. Keep these candidates separate from the public cited model.
 */
export function buildInventoryBackedReferenceCandidates(
  publicProducts: readonly PublicProduct[],
): InventoryBackedReferenceCandidate[] {
  const byType = new Map<InventoryBackedReferenceCandidate['canonicalType'], PublicProduct[]>();
  for (const product of publicProducts) {
    if (product.isPersonal || !isSellableActiveTea(product)) continue;
    const canonicalType = normalizeTeaType(product.type);
    if (!canonicalType || !INVENTORY_CANDIDATE_TYPES.has(canonicalType)) continue;
    const candidateType = canonicalType as InventoryBackedReferenceCandidate['canonicalType'];
    byType.set(candidateType, [...(byType.get(candidateType) ?? []), product]);
  }

  return [...byType.entries()]
    .map(([canonicalType, products]) => ({
      canonicalType,
      matchMethod: 'controlled_type' as const,
      familyId: null,
      facts: [] as [],
      lots: products
        .map(product => ({
          productId: product.id,
          displayName: product.givenName || product.productName,
          ...(product.year ? { year: product.year } : {}),
        }))
        .sort((left, right) => (
          codePointCompare(left.productId, right.productId)
          || codePointCompare(left.displayName, right.displayName)
          || Number(left.year ?? 0) - Number(right.year ?? 0)
        ))
        .filter((lot, index, all) => index === 0 || all[index - 1].productId !== lot.productId),
      modelGap: 'The public product model has a controlled tea type, but no reviewed reference family/type id or cited facts.',
    }))
    .sort((left, right) => codePointCompare(left.canonicalType, right.canonicalType));
}

function publicStatement(statement: PublicReferenceStatement): PublicReferenceStatement {
  return {
    id: statement.id,
    label: statement.label,
    text: statement.text,
    ...(statement.excerpt === undefined ? {} : { excerpt: statement.excerpt }),
    citation: {
      sourceId: statement.citation.sourceId,
      label: statement.citation.label,
      url: statement.citation.url,
    },
  };
}

function orderedUniqueFacts(entries: readonly PublicReferenceEntry[]): PublicReferenceStatement[] {
  const facts = entries
    .flatMap(entry => entry.statements)
    .map(publicStatement)
    .sort((left, right) => codePointCompare(left.id, right.id)
      || codePointCompare(JSON.stringify(left), JSON.stringify(right)));
  const byId = new Map<string, PublicReferenceStatement>();
  for (const fact of facts) {
    if (!byId.has(fact.id)) byId.set(fact.id, fact);
  }
  return [...byId.values()];
}

function orderedUniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort(codePointCompare);
}

function allEntries(preview: PublicReferencePreview): PublicReferenceEntry[] {
  return preview.sections
    .flatMap(section => section.entries)
    .sort((left, right) => codePointCompare(left.id, right.id)
      || codePointCompare(left.label, right.label)
      || codePointCompare(left.entityKind, right.entityKind));
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
    const matches = products.filter(product => normalizeTeaType(product.type) === type);
    if (!matches.some(product => product.status === 'Active')) return [];
    const typeEntries = entries.filter(entry => controlledTypeFor(entry) === type);
    return [{
      id: type.toLowerCase(),
      name: type,
      familyId: 'puer',
      facts: orderedUniqueFacts(typeEntries),
      productIds: orderedUniqueIds(matches.map(product => product.id)),
    }];
  }).sort((left, right) => codePointCompare(left.id, right.id));
}

function isPuerFamily(entry: PublicReferenceEntry): boolean {
  return entry.entityKind === 'tea_family'
    && PUER_FAMILY_LABELS.has(normalizedWords(entry.label).replace(/\s/g, ''));
}

function directlyMatchedFamilyProductIds(
  familyEntries: readonly PublicReferenceEntry[],
  products: readonly PublicProduct[],
): string[] {
  const matches = products.filter(product => (
    familyEntries.some(entry => productMatches(product, entry.label))
  ));
  return matches.some(product => product.status === 'Active')
    ? matches.map(product => product.id)
    : [];
}

function buildOrigins(
  entries: readonly PublicReferenceEntry[],
  products: readonly PublicProduct[],
): PublicTeaOrigin[] {
  const candidates = new Map<string, PlaceCandidate>();
  for (const entry of entries) {
    if (!PLACE_LEVELS.has(entry.entityKind as PlaceLevel)) continue;
    const existing = candidates.get(entry.id);
    if (existing) {
      existing.entries.push(entry);
      continue;
    }
    candidates.set(entry.id, {
      entries: [entry],
      level: entry.entityKind as PlaceLevel,
      name: entry.label,
    });
  }

  const structurallyValidParents = new Map<string, string>();
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
    structurallyValidParents.set(id, parentId);
  }

  const entersCycle = (startId: string): boolean => {
    const seen = new Set([startId]);
    let currentId = startId;
    while (structurallyValidParents.has(currentId)) {
      const parentId = structurallyValidParents.get(currentId)!;
      if (seen.has(parentId)) return true;
      seen.add(parentId);
      currentId = parentId;
    }
    return false;
  };
  const verifiedParents = new Map(
    [...structurallyValidParents].filter(([id, parentId]) => {
      if (entersCycle(id)) return false;
      const child = candidates.get(id)!;
      const parent = candidates.get(parentId)!;
      return PLACE_RANK[parent.level] < PLACE_RANK[child.level];
    }),
  );

  const directActiveMatches = new Map<string, string[]>();
  const directAllMatches = new Map<string, string[]>();
  for (const [id, candidate] of candidates) {
    const matchingProducts = products
      .filter(product => candidate.entries.some(placeEntry => productMatchesPlace(product, placeEntry.label)));
    if (matchingProducts.length > 0) {
      directAllMatches.set(id, matchingProducts.map(product => product.id));
    }
    const activeProductIds = matchingProducts
      .filter(product => product.status === 'Active')
      .map(product => product.id);
    if (activeProductIds.length > 0) directActiveMatches.set(id, activeProductIds);
  }

  const surfacedIds = new Map<string, string[]>();
  for (const [matchedId] of directActiveMatches) {
    const productIds = directAllMatches.get(matchedId) ?? [];
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
    .sort((left, right) => codePointCompare(left.id, right.id));
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
    .sort((left, right) => codePointCompare(left.sourceId, right.sourceId)
      || codePointCompare(JSON.stringify(left), JSON.stringify(right)));
  const byId = new Map<string, PublicTeaReferenceSource>();
  for (const source of sources) {
    if (!byId.has(source.sourceId)) byId.set(source.sourceId, source);
  }
  return [...byId.values()];
}

function generatedFacts(page: PublicTeaReferencePage): PublicReferenceStatement[] {
  const sourcesById = new Map(
    GENERATED_TEA_REFERENCE_REGISTRY.sources.map(source => [source.sourceId, source]),
  );
  return page.sections.flatMap(section => section.sourceIds.map(sourceId => {
    const source = sourcesById.get(sourceId)!;
    const date = source.publishedDate ? ` (${source.publishedDate.slice(0, 4)})` : '';
    return {
      id: `${page.id}:${section.key}:${sourceId}`,
      label: section.label,
      text: section.text,
      citation: {
        sourceId,
        label: `${source.publisher}, ${source.title}${date}`,
        url: source.url,
      },
    };
  }));
}

function generatedOrigins(products: readonly PublicProduct[]): PublicTeaOrigin[] {
  const pages = GENERATED_TEA_REFERENCE_PAGES.filter(
    page => page.kind === 'major_region' || page.kind === 'tea_area',
  );
  const byId = new Map(pages.map(page => [page.id, page]));
  const allMatches = new Map<string, string[]>();
  const activeMatches = new Set<string>();

  for (const page of pages) {
    const matchingProducts = products.filter(product => productMatchesPlace(product, page.label));
    if (matchingProducts.length > 0) allMatches.set(page.id, matchingProducts.map(product => product.id));
    if (matchingProducts.some(product => product.status === 'Active')) activeMatches.add(page.id);
  }

  const surfacedIds = new Map<string, string[]>();
  for (const matchedId of activeMatches) {
    const productIds = allMatches.get(matchedId) ?? [];
    let currentId: string | undefined = matchedId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      surfacedIds.set(currentId, [...(surfacedIds.get(currentId) ?? []), ...productIds]);
      currentId = byId.get(currentId)?.parentId;
    }
  }

  return [...surfacedIds].map(([id, productIds]) => {
    const page = byId.get(id)!;
    return {
      id: page.id,
      name: page.label,
      level: page.kind,
      ...(page.parentId ? { parentId: page.parentId } : {}),
      facts: generatedFacts(page),
      productIds: orderedUniqueIds(productIds),
    };
  }).sort((left, right) => codePointCompare(left.id, right.id));
}

/** Builds the launch catalogue from tracked Markdown without preview endpoints or private capture data. */
export function buildGeneratedTeaReferenceCatalogue(
  publicProducts: readonly PublicProduct[],
): TeaReferenceCatalogue {
  const products = publicProducts.filter(isEligiblePublicTeaProduct);
  const types = GENERATED_TEA_REFERENCE_PAGES
    .filter(page => page.kind === 'tea_type')
    .flatMap(page => {
      const canonicalType = normalizeTeaType(page.id);
      if (!canonicalType) return [];
      const matches = products.filter(product => normalizeTeaType(product.type) === canonicalType);
      if (!matches.some(product => product.status === 'Active')) return [];
      return [{
        id: page.id,
        name: page.label,
        familyId: page.parentId ?? '',
        facts: generatedFacts(page),
        productIds: orderedUniqueIds(matches.map(product => product.id)),
      }];
    });
  const families = GENERATED_TEA_REFERENCE_PAGES
    .filter(page => page.kind === 'tea_family')
    .flatMap(page => {
      const controlledMatches = page.id === 'puer'
        ? PUER_TYPES.flatMap(type => {
          const matches = products.filter(product => normalizeTeaType(product.type) === type);
          return matches.some(product => product.status === 'Active') ? matches.map(product => product.id) : [];
        })
        : [];
      const directMatches = products.filter(product => productMatches(product, page.label));
      const directIds = directMatches.some(product => product.status === 'Active')
        ? directMatches.map(product => product.id)
        : [];
      const productIds = orderedUniqueIds([...controlledMatches, ...directIds]);
      return productIds.length === 0 ? [] : [{
        id: page.id,
        name: page.label,
        facts: generatedFacts(page),
        productIds,
      }];
    });

  return {
    families,
    types,
    origins: generatedOrigins(products),
    sources: [...GENERATED_TEA_REFERENCE_REGISTRY.sources],
    pages: GENERATED_TEA_REFERENCE_PAGES,
  };
}

export function buildTeaReferenceCatalogue(
  publicPreview: PublicReferencePreview,
  publicProducts: readonly PublicProduct[],
): TeaReferenceCatalogue {
  const entries = allEntries(publicPreview);
  const products = publicProducts.filter(isEligiblePublicTeaProduct);
  const types = buildTypes(entries, products);
  const familyEntries = entries.filter(isPuerFamily);
  const familyProductIds = orderedUniqueIds([
    ...types.flatMap(type => type.productIds),
    ...directlyMatchedFamilyProductIds(familyEntries, products),
  ]);

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
    pages: GENERATED_TEA_REFERENCE_PAGES,
  };
}
