import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { claimIdFor, currentRevision, projectClaim, reviewStateFor, validateLedger } from './claim-ledger.mjs';

const HAN_SCRIPT = /\p{Script=Han}/u;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SECTION_PATTERN = /^## ([^\n]+) \{#([a-z0-9]+(?:-[a-z0-9]+)*)\}$/;
const CITATION_PATTERN = /\[cite:([a-z0-9]+(?:-[a-z0-9]+)*)\]/g;
const CITATION_LIKE_PATTERN = /\[\s*(?:cite|citation)(?:\b|:)/i;
const PAGE_KINDS = new Set([
  'tea_family',
  'tea_type',
  'major_region',
  'tea_area',
  'leaf_grade',
  'reference_topic',
]);
const GEOGRAPHIC_KINDS = new Set(['major_region', 'tea_area']);
const NON_PLACE_SOURCE_SHAPES = new Set(['route', 'list', 'grouping']);
const FRONT_MATTER_KEYS = new Set([
  'id',
  'slug',
  'kind',
  'label',
  'native_name',
  'parent',
  'source_ids',
  'visibility',
]);

export function codePointCompare(left, right) {
  const leftCharacters = left[Symbol.iterator]();
  const rightCharacters = right[Symbol.iterator]();
  while (true) {
    const leftCharacter = leftCharacters.next();
    const rightCharacter = rightCharacters.next();
    if (leftCharacter.done || rightCharacter.done) {
      return leftCharacter.done === rightCharacter.done ? 0 : leftCharacter.done ? -1 : 1;
    }
    const leftPoint = leftCharacter.value.codePointAt(0);
    const rightPoint = rightCharacter.value.codePointAt(0);
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
  }
}

function fail(fileName, message) {
  throw new Error(`${fileName}: ${message}`);
}

function requiredScalar(frontMatter, key, fileName) {
  const value = frontMatter[key];
  if (typeof value !== 'string' || !value.trim()) fail(fileName, `front matter ${key} is required`);
  return value.trim();
}

function parseFrontMatter(lines, fileName) {
  const frontMatter = {};
  let activeList = null;
  for (const line of lines) {
    const listItem = line.match(/^  - (.+)$/);
    if (listItem) {
      if (!activeList) fail(fileName, 'front matter list item has no list key');
      frontMatter[activeList].push(listItem[1].trim());
      continue;
    }
    const scalar = line.match(/^([a-z_]+):(?: (.*))?$/);
    if (!scalar) fail(fileName, `unsupported front matter line: ${line}`);
    const [, key, rawValue = ''] = scalar;
    if (!FRONT_MATTER_KEYS.has(key)) fail(fileName, `unknown front matter key ${key}`);
    if (Object.hasOwn(frontMatter, key)) fail(fileName, `duplicate front matter key ${key}`);
    if (key === 'source_ids') {
      if (rawValue) fail(fileName, 'source_ids must use an indented list');
      frontMatter[key] = [];
      activeList = key;
    } else {
      frontMatter[key] = rawValue.trim();
      activeList = null;
    }
  }
  return frontMatter;
}

function cleanSectionText(lines, fileName, sectionKey) {
  const raw = lines.join('\n').trim();
  if (!raw) fail(fileName, `section ${sectionKey} is empty`);
  if (/^#{1,6}\s/m.test(raw)) fail(fileName, `section ${sectionKey} contains an unsupported nested heading`);
  if (HAN_SCRIPT.test(raw)) fail(fileName, `Han-script is not allowed in public prose for section ${sectionKey}`);
  const sourceIds = [];
  const withoutCitations = raw.replace(CITATION_PATTERN, (_marker, sourceId) => {
    sourceIds.push(sourceId);
    return '';
  });
  if (CITATION_LIKE_PATTERN.test(withoutCitations)) {
    fail(fileName, `section ${sectionKey} contains a malformed or unsupported citation marker`);
  }
  const text = withoutCitations.split('\n\n').map(paragraph => paragraph.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
  if (!/[A-Za-z]{2}/.test(text) || !/[.!?][”’"']?$/.test(text)) {
    fail(fileName, `section ${sectionKey} must contain ordinary English prose`);
  }
  return { text, sourceIds: [...new Set(sourceIds)].sort(codePointCompare) };
}

export function parsePageMarkdown(markdown, fileName = '<markdown>') {
  const normalized = markdown.replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) fail(fileName, 'expected one front matter block at the start of the file');
  const frontMatter = parseFrontMatter(match[1].split('\n'), fileName);
  const id = requiredScalar(frontMatter, 'id', fileName);
  const slug = requiredScalar(frontMatter, 'slug', fileName);
  const kind = requiredScalar(frontMatter, 'kind', fileName);
  const label = requiredScalar(frontMatter, 'label', fileName);
  const parent = requiredScalar(frontMatter, 'parent', fileName);
  const visibility = requiredScalar(frontMatter, 'visibility', fileName);
  const nativeName = typeof frontMatter.native_name === 'string' && frontMatter.native_name.trim()
    ? frontMatter.native_name.trim()
    : undefined;
  const sourceIds = frontMatter.source_ids;

  if (!ID_PATTERN.test(id)) fail(fileName, `invalid page id ${id}`);
  if (!ID_PATTERN.test(slug)) fail(fileName, `invalid page slug ${slug}`);
  if (!PAGE_KINDS.has(kind)) fail(fileName, `unsupported page kind ${kind}`);
  if (!['public', 'draft'].includes(visibility)) fail(fileName, `unsupported visibility ${visibility}`);
  if (kind === 'reference_topic' && visibility !== 'draft') {
    fail(fileName, 'reference_topic pages must remain non-public drafts');
  }
  if (HAN_SCRIPT.test(label)) fail(fileName, 'Han-script is not allowed in the public label');
  if (sourceIds !== undefined && !Array.isArray(sourceIds)) fail(fileName, 'source_ids must be a list');
  if ((sourceIds ?? []).some(sourceId => !SOURCE_ID_PATTERN.test(sourceId))) fail(fileName, 'source_ids contains an invalid source id');
  if (new Set(sourceIds ?? []).size !== (sourceIds ?? []).length) fail(fileName, 'source_ids contains a duplicate');
  if (parent !== 'none' && !ID_PATTERN.test(parent)) fail(fileName, `invalid parent ${parent}`);

  const bodyLines = match[2].trim().split('\n');
  const sections = [];
  let current = null;
  for (const line of bodyLines) {
    const heading = line.match(SECTION_PATTERN);
    if (heading) {
      if (current) {
        const clean = cleanSectionText(current.lines, fileName, current.key);
        sections.push({ key: current.key, label: current.label, ...clean });
      }
      current = { label: heading[1].trim(), key: heading[2], lines: [] };
      if (HAN_SCRIPT.test(current.label)) fail(fileName, `Han-script is not allowed in section label ${current.key}`);
      continue;
    }
    if (!current) {
      if (line.trim()) fail(fileName, 'body content must begin with a keyed level-two section');
      continue;
    }
    current.lines.push(line);
  }
  if (current) {
    const clean = cleanSectionText(current.lines, fileName, current.key);
    sections.push({ key: current.key, label: current.label, ...clean });
  }
  if (sections.length === 0) fail(fileName, 'at least one keyed section is required');
  if (new Set(sections.map(section => section.key)).size !== sections.length) fail(fileName, 'section keys must be unique');
  const citedSourceIds = [...new Set(sections.flatMap(section => section.sourceIds))].sort(codePointCompare);
  const declaredSourceIds = [...(sourceIds ?? [])].sort(codePointCompare);
  if (JSON.stringify(citedSourceIds) !== JSON.stringify(declaredSourceIds)) {
    fail(fileName, 'front matter source_ids must exactly match cited source IDs');
  }

  return {
    id,
    slug,
    kind,
    label,
    visibility,
    ...(nativeName ? { nativeName } : {}),
    parentId: parent === 'none' ? undefined : parent,
    sourceIds: declaredSourceIds,
    sections,
  };
}

function assertEnglish(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  if (HAN_SCRIPT.test(value)) throw new Error(`${label} must be an English public display value`);
}

function validatePrivateDocument(document) {
  if (document?.schema_version !== 1) throw new Error('Private provenance schema_version must be 1');
  if (!Array.isArray(document.sources) || !Array.isArray(document.translations)) {
    throw new Error('Private provenance must contain sources and translations arrays');
  }
  const sourceIds = new Set();
  const evidenceIds = new Set();
  const evidenceOwners = new Map();
  for (const source of document.sources) {
    if (!SOURCE_ID_PATTERN.test(source?.source_id ?? '')) throw new Error('Private source has an invalid source_id');
    if (sourceIds.has(source.source_id)) throw new Error(`Duplicate private source ${source.source_id}`);
    sourceIds.add(source.source_id);
    if (!['en', 'zh'].includes(source.source_language)) throw new Error(`${source.source_id} has an unsupported source_language`);
    if (!['reference', 'route', 'list', 'grouping'].includes(source.content_shape)) {
      throw new Error(`${source.source_id} has an unsupported content_shape`);
    }
    const publicFields = ['publisher', 'publisher_role_label', 'title', 'url'];
    for (const field of publicFields) assertEnglish(source.public?.[field], `${source.source_id} public ${field}`);
    if (!/^https:\/\//.test(source.public.url)) throw new Error(`${source.source_id} public URL must use HTTPS`);
    if (!Array.isArray(source.evidence) || source.evidence.length === 0) throw new Error(`${source.source_id} needs private evidence provenance`);
    for (const evidence of source.evidence) {
      if (typeof evidence.evidence_id !== 'string' || !evidence.evidence_id.startsWith('EVIDENCE-')) {
        throw new Error(`${source.source_id} has an invalid evidence id`);
      }
      if (evidenceIds.has(evidence.evidence_id)) throw new Error(`Duplicate evidence ${evidence.evidence_id}`);
      evidenceIds.add(evidence.evidence_id);
      evidenceOwners.set(evidence.evidence_id, source.source_id);
      if (!/^[a-f0-9]{64}$/.test(evidence.excerpt_sha256 ?? '')) throw new Error(`${evidence.evidence_id} has an invalid excerpt hash`);
      if (!Array.isArray(evidence.uses) || evidence.uses.length === 0) throw new Error(`${evidence.evidence_id} needs at least one page/section use`);
    }
  }
  const translations = new Map();
  for (const translation of document.translations) {
    if (translations.has(translation.evidence_id)) throw new Error(`Duplicate translation ${translation.evidence_id}`);
    translations.set(translation.evidence_id, translation);
    if (!sourceIds.has(translation.source_id)) throw new Error(`${translation.evidence_id} translation source is missing`);
    if (evidenceOwners.get(translation.evidence_id) !== translation.source_id) {
      throw new Error(`${translation.evidence_id} translation source ${translation.source_id} does not own its evidence record`);
    }
    if (!HAN_SCRIPT.test(translation.original ?? '')) throw new Error(`${translation.evidence_id} original must preserve Han-script evidence`);
    assertEnglish(translation.english, `${translation.evidence_id} English translation`);
    for (const field of ['method', 'translator', 'version', 'translated_date']) {
      if (typeof translation[field] !== 'string' || !translation[field].trim()) throw new Error(`${translation.evidence_id} needs ${field}`);
    }
    const hash = crypto.createHash('sha256').update(translation.original).digest('hex');
    const evidence = document.sources.flatMap(source => source.evidence).find(item => item.evidence_id === translation.evidence_id);
    if (!evidence || evidence.excerpt_sha256 !== hash) throw new Error(`${translation.evidence_id} original does not match its exact evidence hash`);
    if (JSON.stringify(translation.locator) !== JSON.stringify(evidence.locator)) {
      throw new Error(`${translation.evidence_id} translation locator does not match its evidence locator`);
    }
  }
  for (const source of document.sources.filter(candidate => candidate.source_language === 'zh')) {
    for (const evidence of source.evidence) {
      if (!translations.has(evidence.evidence_id)) throw new Error(`${evidence.evidence_id} needs a private translation`);
    }
  }
}

function publicSource(source) {
  return {
    sourceId: source.source_id,
    publisher: source.public.publisher,
    publisherRoleLabel: source.public.publisher_role_label,
    title: source.public.title,
    author: source.public.author ?? '',
    publishedDate: source.public.published_date ?? '',
    url: source.public.url,
  };
}

export async function loadSourcePages({ pagesDirectory, translationsPath }) {
  const [fileNames, privateJson] = await Promise.all([
    fs.readdir(pagesDirectory),
    fs.readFile(translationsPath, 'utf8'),
  ]);
  const document = JSON.parse(privateJson);
  validatePrivateDocument(document);
  const markdownFileNames = fileNames.filter(fileName => fileName.endsWith('.md')).sort(codePointCompare);
  const sourcePages = await Promise.all(markdownFileNames.map(async fileName => (
    parsePageMarkdown(await fs.readFile(path.join(pagesDirectory, fileName), 'utf8'), fileName)
  )));
  sourcePages.sort((left, right) => codePointCompare(left.id, right.id));
  if (new Set(sourcePages.map(page => page.id)).size !== sourcePages.length) throw new Error('Page IDs must be unique');
  if (new Set(sourcePages.map(page => page.slug)).size !== sourcePages.length) throw new Error('Page slugs must be unique');
  const pagesById = new Map(sourcePages.map(page => [page.id, page]));
  const sourcesById = new Map(document.sources.map(source => [source.source_id, source]));

  for (const page of sourcePages) {
    const pathIds = [];
    const seen = new Set();
    let current = page;
    while (current) {
      if (seen.has(current.id)) {
        const cycleStart = pathIds.indexOf(current.id);
        const cycle = [...pathIds.slice(cycleStart), current.id].join(' -> ');
        throw new Error(`Page hierarchy cycle detected: ${cycle}`);
      }
      seen.add(current.id);
      pathIds.push(current.id);
      current = current.parentId ? pagesById.get(current.parentId) : undefined;
    }
  }

  for (const page of sourcePages) {
    if (page.parentId && !pagesById.has(page.parentId)) throw new Error(`${page.id} parent ${page.parentId} is missing`);
    if (page.parentId === page.id) throw new Error(`${page.id} cannot be its own parent`);
    const parent = page.parentId ? pagesById.get(page.parentId) : undefined;
    if (page.kind === 'tea_family' && parent) throw new Error(`tea_family ${page.id} must be a root page`);
    if (page.kind === 'tea_type' && parent?.kind !== 'tea_family') {
      throw new Error(`tea_type ${page.id} must have a tea_family parent`);
    }
    if (page.kind === 'major_region' && parent && parent.kind !== 'major_region') {
      throw new Error(`major_region ${page.id} may only have a major_region parent`);
    }
    if (page.kind === 'leaf_grade' && parent?.kind !== 'tea_type') {
      throw new Error(`leaf_grade ${page.id} must have a tea_type parent`);
    }
    if (page.kind === 'tea_area' && (!parent || !['major_region', 'tea_area'].includes(parent.kind))) {
      throw new Error(`tea_area ${page.id} must have a major_region or tea_area parent`);
    }
    for (const sourceId of page.sourceIds) {
      const source = sourcesById.get(sourceId);
      if (!source) {
        if (page.visibility === 'draft' && page.kind !== 'reference_topic') continue;
        throw new Error(`${page.id} cites missing private source provenance ${sourceId}`);
      }
      if (GEOGRAPHIC_KINDS.has(page.kind) && NON_PLACE_SOURCE_SHAPES.has(source.content_shape)) {
        throw new Error(`${source.content_shape} research ${sourceId} must be a reference_topic, not ${page.kind}`);
      }
    }
    for (const section of page.sections) {
      for (const sourceId of section.sourceIds) {
        const source = sourcesById.get(sourceId);
        const resolves = Boolean(source) && source.evidence.some(evidence => evidence.uses.some(use => (
          use.page_id === page.id && use.section_key === section.key
        )));
        if (!resolves) {
          // A draft page may cite research whose capture is still pending; it never reaches the public registry.
          if (page.visibility === 'draft' && page.kind !== 'reference_topic') {
            section.unresolvedSourceIds = [...(section.unresolvedSourceIds ?? []), sourceId];
            continue;
          }
          throw new Error(`${page.id}#${section.key} citation ${sourceId} has no private evidence provenance`);
        }
      }
    }
  }
  return { sourcePages, document };
}

export function assertEverySectionCited(sourcePages) {
  for (const page of sourcePages) {
    for (const section of page.sections) {
      if (section.sourceIds.length === 0) throw new Error(`${page.id}.md: section ${section.key} needs at least one compact citation marker`);
    }
  }
}

export function publicRegistryFrom(sourcePages, document) {
  const pages = sourcePages
    .filter(page => page.visibility === 'public')
    .map(({ visibility: _visibility, ...page }) => ({
      ...page,
      sections: page.sections.map(({ unresolvedSourceIds: _unresolved, ...section }) => section),
    }));
  const usedSourceIds = new Set(pages.flatMap(page => page.sourceIds));
  const sources = document.sources
    .filter(source => usedSourceIds.has(source.source_id))
    .map(publicSource)
    .sort((left, right) => codePointCompare(left.sourceId, right.sourceId));
  return { schemaVersion: 1, pages, sources };
}

export async function buildRegistry(paths) {
  const { sourcePages, document } = await loadSourcePages(paths);
  assertEverySectionCited(sourcePages);
  return publicRegistryFrom(sourcePages, document);
}

export function renderGeneratedRegistry(registry) {
  return `/* This file is generated by scripts/tea-reference-markdown/build-pages.mjs. */\nimport type { TeaReferencePageRegistry } from './types';\n\nexport const GENERATED_TEA_REFERENCE_REGISTRY = ${JSON.stringify(registry, null, 2)} as const satisfies TeaReferencePageRegistry;\n\nexport const GENERATED_TEA_REFERENCE_PAGES = GENERATED_TEA_REFERENCE_REGISTRY.pages;\n`;
}

/**
 * Build the public registry and claim projections from Markdown plus the claim ledger.
 * Public text comes from the ledger's current approved revision, never from Markdown.
 * Contract: docs/_notes/tea-wisdom-claims.md
 */
export async function buildWisdom({ pagesDirectory, translationsPath, claimsPath }) {
  const { sourcePages, document } = await loadSourcePages({ pagesDirectory, translationsPath });
  const ledger = JSON.parse(await fs.readFile(claimsPath, 'utf8'));
  const entries = validateLedger(ledger, sourcePages, document);

  const approvedPages = sourcePages
    .filter(page => page.visibility === 'public')
    .map(page => {
      const sections = page.sections
        .map(section => {
          const entry = entries.get(claimIdFor(page.id, section.key));
          const state = reviewStateFor(entry, section.text);
          if (state !== 'approved' && state !== 'pending') return undefined;
          return { ...section, text: currentRevision(entry).text };
        })
        .filter(Boolean);
      const sourceIds = [...new Set(sections.flatMap(section => section.sourceIds))].sort(codePointCompare);
      return { ...page, sections, sourceIds };
    })
    .filter(page => page.sections.length > 0);
  const registry = publicRegistryFrom(approvedPages, document);

  const located = new Map();
  for (const page of sourcePages) {
    for (const section of page.sections) located.set(claimIdFor(page.id, section.key), { page, section });
  }
  const claims = [];
  const draftClaims = [];
  for (const entry of [...entries.values()].sort((left, right) => codePointCompare(left.claim_id, right.claim_id))) {
    const { page, section } = located.get(entry.claim_id) ?? {};
    const draft = projectClaim(entry, page, section, { preview: true });
    if (section?.unresolvedSourceIds?.length) draft.unresolvedSourceIds = section.unresolvedSourceIds;
    draftClaims.push(draft);
    const isPublic = page?.visibility === 'public' && (draft.reviewState === 'approved' || draft.reviewState === 'pending');
    if (isPublic) claims.push({ ...projectClaim(entry, page, section, { preview: false }), reviewState: 'approved' });
  }
  const draftPages = sourcePages.map(({ sections, ...page }) => ({
    ...page,
    sections: sections.map(({ key, label, sourceIds, unresolvedSourceIds }) => ({
      key, label, sourceIds, ...(unresolvedSourceIds ? { unresolvedSourceIds } : {}),
    })),
  }));
  const draftSources = document.sources.map(publicSource).sort((left, right) => codePointCompare(left.sourceId, right.sourceId));
  return { registry, claims, draftClaims, draftPages, draftSources };
}

export function renderGeneratedClaims(claims) {
  return `/* This file is generated by scripts/tea-reference-markdown/build-pages.mjs. Approved public claims only. */\nimport type { PublicClaim } from './claims';\n\nexport const GENERATED_CLAIMS: readonly PublicClaim[] = ${JSON.stringify(claims, null, 2)};\n`;
}

// The draft set grows with every page, so it is written as parts that each stay well
// under the 1,500-line file ceiling (src/admin/guards/driftCeilings.test.ts), plus one
// small entry module that joins them. Every part lives in DRAFT_PARTS_DIRECTORY, which
// the generator owns outright: a part it no longer writes is deleted.
export const DRAFT_PARTS_DIRECTORY = 'generatedDraft';
export const DRAFT_PART_LINE_BUDGET = 1000;

const DRAFT_HEADER = `/* This file is generated by scripts/tea-reference-markdown/build-pages.mjs.
 * Every claim in every review state. Load only through a mode-guarded dynamic import()
 * (see docs/_notes/tea-wisdom-claims.md); it must never reach a production bundle. */`;

function chunkByLines(items, budget) {
  const chunks = [];
  let current = [];
  let lines = 0;
  for (const item of items) {
    const itemLines = JSON.stringify(item, null, 2).split('\n').length + 1;
    if (current.length && lines + itemLines > budget) {
      chunks.push(current);
      current = [];
      lines = 0;
    }
    current.push(item);
    lines += itemLines;
  }
  if (current.length || !chunks.length) chunks.push(current);
  return chunks;
}

/** Returns [relative path, contents] pairs: the entry file first, then each part. */
export function renderGeneratedDraftClaims({ draftClaims, draftPages, draftSources }, budget = DRAFT_PART_LINE_BUDGET) {
  const groups = [
    { name: 'claims', exportName: 'GENERATED_DRAFT_CLAIMS', type: 'DraftClaim', items: draftClaims },
    { name: 'pages', exportName: 'GENERATED_DRAFT_PAGES', type: 'DraftReferencePage', items: draftPages },
    { name: 'sources', exportName: 'GENERATED_DRAFT_SOURCES', type: 'PublicTeaReferenceSource', items: draftSources },
  ];
  const parts = [];
  const imports = [];
  const exports = [];
  for (const group of groups) {
    const locals = [];
    chunkByLines(group.items, budget).forEach((chunk, index) => {
      const module = `${group.name}-${index + 1}`;
      const local = `${group.name}${index + 1}`;
      parts.push([
        `${DRAFT_PARTS_DIRECTORY}/${module}.ts`,
        `${DRAFT_HEADER}\nimport type { ${group.type} } from '../claims';\n\nexport const PART: readonly ${group.type}[] = ${JSON.stringify(chunk, null, 2)};\n`,
      ]);
      imports.push(`import { PART as ${local} } from './${DRAFT_PARTS_DIRECTORY}/${module}';`);
      locals.push(`...${local}`);
    });
    exports.push(`export const ${group.exportName}: readonly ${group.type}[] = [${locals.join(', ')}];`);
  }
  const entry = `${DRAFT_HEADER}\nimport type { DraftClaim, DraftReferencePage, PublicTeaReferenceSource } from './claims';\n${imports.join('\n')}\n\n${exports.join('\n')}\n`;
  return [['generatedDraftClaims.ts', entry], ...parts];
}
