import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

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
  if (sourceIds.length === 0) fail(fileName, `section ${sectionKey} needs at least one compact citation marker`);
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
  if (kind !== 'reference_topic' && visibility !== 'public') {
    fail(fileName, `${kind} pages must be public`);
  }
  if (HAN_SCRIPT.test(label)) fail(fileName, 'Han-script is not allowed in the public label');
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) fail(fileName, 'source_ids must contain at least one source');
  if (sourceIds.some(sourceId => !SOURCE_ID_PATTERN.test(sourceId))) fail(fileName, 'source_ids contains an invalid source id');
  if (new Set(sourceIds).size !== sourceIds.length) fail(fileName, 'source_ids contains a duplicate');
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
  const declaredSourceIds = [...sourceIds].sort(codePointCompare);
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

export async function buildRegistry({ pagesDirectory, translationsPath }) {
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
    if (page.kind === 'tea_area' && (!parent || !['major_region', 'tea_area'].includes(parent.kind))) {
      throw new Error(`tea_area ${page.id} must have a major_region or tea_area parent`);
    }
    for (const sourceId of page.sourceIds) {
      const source = sourcesById.get(sourceId);
      if (!source) throw new Error(`${page.id} cites missing private source provenance ${sourceId}`);
      if (GEOGRAPHIC_KINDS.has(page.kind) && NON_PLACE_SOURCE_SHAPES.has(source.content_shape)) {
        throw new Error(`${source.content_shape} research ${sourceId} must be a reference_topic, not ${page.kind}`);
      }
    }
    for (const section of page.sections) {
      for (const sourceId of section.sourceIds) {
        const source = sourcesById.get(sourceId);
        const resolves = source.evidence.some(evidence => evidence.uses.some(use => (
          use.page_id === page.id && use.section_key === section.key
        )));
        if (!resolves) throw new Error(`${page.id}#${section.key} citation ${sourceId} has no private evidence provenance`);
      }
    }
  }
  const pages = sourcePages.filter(page => page.visibility === 'public').map(({ visibility: _visibility, ...page }) => page);
  const usedSourceIds = new Set(pages.flatMap(page => page.sourceIds));
  const sources = document.sources
    .filter(source => usedSourceIds.has(source.source_id))
    .map(publicSource)
    .sort((left, right) => codePointCompare(left.sourceId, right.sourceId));
  return { schemaVersion: 1, pages, sources };
}

export function renderGeneratedRegistry(registry) {
  return `/* This file is generated by scripts/tea-reference-markdown/build-pages.mjs. */\nimport type { TeaReferencePageRegistry } from './types';\n\nexport const GENERATED_TEA_REFERENCE_REGISTRY = ${JSON.stringify(registry, null, 2)} as const satisfies TeaReferencePageRegistry;\n\nexport const GENERATED_TEA_REFERENCE_PAGES = GENERATED_TEA_REFERENCE_REGISTRY.pages;\n`;
}
