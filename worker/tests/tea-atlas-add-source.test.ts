import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import worker from '../src/index';
import { atlasAdminShape } from '../src/atlasAdmin';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { buildAtlas } from '../../scripts/atlas-build.mjs';
import { mergeIntoIndex, touchedBy } from '../../src/atlas/add/mergeIndex';
import { buildSourcePackage, countHits, slug, suggestTopics, type SourcePackage } from '../../src/atlas/add/buildPackage';
import { contentsEntries, fromOutline, proposeSplit } from '../../src/atlas/add/split';
import { joinDropCaps, plainLetters, readingOrder } from '../../src/atlas/add/extract';
import { pageParas, repairLigatures, runningLines, styleBlocks } from '../../src/atlas/add/text';
import type { PdfDoc, PdfLine, PdfPage } from '../../src/atlas/add/types';

// Adding a source to the Tea Atlas from the admin (docs/TEA_ATLAS.md).
//
// Three things are pinned here. The door: only the site owner may write, and
// for everyone else, readers with the tick included, it does not exist. The
// merge: one source merged into the published index gives exactly the files a
// full rebuild with that source added gives, so the two writers never
// disagree. And the splitting rules, on small made-up pages.

const SECRET = 'tea-atlas-secret';
const PLATFORM = 'acc-platform';
const databases: SqliteD1[] = [];
const dirs: string[] = [];

afterEach(() => {
  while (databases.length) databases.pop()!.close();
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function memoryBucket() {
  const objects = new Map<string, { body: Uint8Array; type: string }>();
  const touched: string[] = [];
  return {
    objects,
    touched,
    get: async (key: string) => {
      touched.push(key);
      const hit = objects.get(key);
      if (!hit) return null;
      return {
        body: new Response(hit.body).body,
        httpEtag: '"x"',
        writeHttpMetadata: (h: Headers) => h.set('Content-Type', hit.type),
      };
    },
    head: async (key: string) => { touched.push(key); return objects.has(key) ? {} : null; },
    put: async (key: string, body: ArrayBuffer, opts: { httpMetadata?: { contentType?: string } }) => {
      touched.push(key);
      objects.set(key, { body: new Uint8Array(body), type: opts?.httpMetadata?.contentType ?? '' });
      return {};
    },
  };
}

function setup() {
  const db = new SqliteD1('schema');
  databases.push(db);
  const bucket = memoryBucket();
  seedIdentity(db, { userId: 'site-owner', accountId: PLATFORM, role: 'owner', platformRole: 'platform_owner' });
  db.sqlite.prepare('UPDATE accounts SET is_platform_owner = 1 WHERE id = ?').run(PLATFORM);
  seedIdentity(db, { userId: 'reader', accountId: PLATFORM, role: 'viewer', bundles: [] });
  db.sqlite.prepare('UPDATE account_members SET permissions = ? WHERE user_id = ?').run(JSON.stringify({ bundles: [], tea_atlas: true }), 'reader');
  seedIdentity(db, { userId: 'staff-all-bundles', accountId: PLATFORM, role: 'staff', bundles: ['catalog', 'stock', 'publish', 'gather', 'sell', 'members'] });
  db.sqlite.prepare(`INSERT INTO users (id, email, name, password_hash, role, platform_role, session_version)
    VALUES ('platform-admin', 'admin@test.dev', 'admin', 'test', 'user', 'platform_admin', 0)`).run();
  const env = { DB: db as any, JWT_SECRET: SECRET, ATLAS_BUCKET: bucket, APP_URL: 'https://www.teajia.com' } as any;
  return { env, bucket };
}

async function call(env: any, path: string, userId: string | null, init: { method?: string; body?: string } = {}) {
  const headers = new Headers();
  if (userId) {
    headers.set('Authorization', `Bearer ${await signedToken(SECRET, { sub: userId, email: `${userId}@test.dev`, name: userId, active_account_id: PLATFORM })}`);
    headers.set('X-Teajia-Account', PLATFORM);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, { method: init.method ?? 'GET', headers, body: init.body }), env);
}

describe('the door for adding a source', () => {
  const outsiders: Array<[string, string | null]> = [
    ['a signed-out visitor', null],
    ['a reader with the Tea Atlas tick', 'reader'],
    ['staff holding every bundle', 'staff-all-bundles'],
    ['a platform admin', 'platform-admin'],
  ];
  for (const [who, userId] of outsiders) {
    it(`does not exist for ${who}`, async () => {
      const { env, bucket } = setup();
      const unknown = await (await call(env, '/api/no-such-route', userId)).text();
      for (const [path, method] of [
        ['/api/atlas-admin/can-manage', 'GET'],
        ['/api/atlas-admin/object/index/v1/home.json', 'GET'],
        ['/api/atlas-admin/object/media/book/book-001-001.jpg', 'PUT'],
      ] as const) {
        const res = await call(env, path, userId, { method, body: method === 'PUT' ? 'JPEG' : undefined });
        expect(res.status, path).toBe(404);
        expect(await res.text()).toBe(unknown);
      }
      expect(bucket.touched).toEqual([]);
    });
  }

  it('opens for the site owner', async () => {
    const { env } = setup();
    const res = await call(env, '/api/atlas-admin/can-manage', 'site-owner');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ manage: true });
  });

  it('writes pictures and articles once, and never over an existing one', async () => {
    const { env, bucket } = setup();
    bucket.objects.set('articles/2012-02-p03-answering.json', { body: new TextEncoder().encode('{"gth":true}'), type: 'application/json' });
    const over = await call(env, '/api/atlas-admin/object/articles/2012-02-p03-answering.json', 'site-owner', { method: 'PUT', body: '{"x":1}' });
    expect(over.status).toBe(409);
    expect(new TextDecoder().decode(bucket.objects.get('articles/2012-02-p03-answering.json')!.body)).toBe('{"gth":true}');

    const pic = await call(env, '/api/atlas-admin/object/media/the-book/the-book-001-001.jpg', 'site-owner', { method: 'PUT', body: 'JPEG' });
    expect(pic.status).toBe(200);
    expect(bucket.objects.get('media/the-book/the-book-001-001.jpg')!.type).toBe('image/jpeg');
    expect((await call(env, '/api/atlas-admin/object/media/the-book/the-book-001-001.jpg', 'site-owner', { method: 'PUT', body: 'OTHER' })).status).toBe(409);
  });

  it('rewrites index files and reads them back uncached', async () => {
    const { env } = setup();
    expect((await call(env, '/api/atlas-admin/object/index/v1/home.json', 'site-owner', { method: 'PUT', body: '{"a":1}' })).status).toBe(200);
    expect((await call(env, '/api/atlas-admin/object/index/v1/home.json', 'site-owner', { method: 'PUT', body: '{"a":2}' })).status).toBe(200);
    const back = await call(env, '/api/atlas-admin/object/index/v1/home.json', 'site-owner');
    expect(back.headers.get('Cache-Control')).toBe('no-store');
    expect(await back.json()).toEqual({ a: 2 });
  });

  it('touches only the Tea Atlas shapes', () => {
    for (const ok of ['articles/a.json', 'media/iss/iss-001-001.jpg', 'index/v1/home.json', 'index/v1/issues/2018-05.json',
      'index/v1/search/catalog.json', 'index/v1/search/text/pu.json', 'added/sources.json', 'added/the-book/manifest.json']) {
      expect(atlasAdminShape(ok), ok).not.toBeNull();
    }
    for (const bad of ['_atlas-upload-state.json', 'manifest.json', 'README.md', 'index/v1/other.json', 'media/a/b.png',
      'articles/../_atlas-upload-state.json', 'added/x/articles/a.json', 'index/v2/home.json']) {
      expect(atlasAdminShape(bad), bad).toBeNull();
    }
  });

  it('cannot read back an article or picture it wrote (the reader serves those)', async () => {
    const { env } = setup();
    await call(env, '/api/atlas-admin/object/articles/a.json', 'site-owner', { method: 'PUT', body: '{}' });
    expect((await call(env, '/api/atlas-admin/object/articles/a.json', 'site-owner')).status).toBe(404);
  });
});

// ── The merge gives what a full rebuild gives ─────────────────────────────

const TOPICS = [
  { id: 'sheng-puerh', name: 'Sheng puerh', category: 'Teas', aliases: ['sheng', 'raw puerh'] },
  { id: 'oolong', name: 'Oolong', category: 'Teas', aliases: ['oolong'] },
  { id: 'teaware', name: 'Teaware', category: 'Things', aliases: ['teapot', 'bowl'] },
];

function writePackage(dir: string, manifest: any, articles: any[]) {
  mkdirSync(join(dir, 'articles'), { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
  for (const a of articles) writeFileSync(join(dir, 'articles', `${a.id}.json`), JSON.stringify(a));
}

function basePackage(dir: string) {
  const art = (id: string, issue: string, order: number, title: string, text: string, topics: string[]) => ({
    id, source: 'gth', issue, title, author: 'Wu De', pages: `${order + 1}`, order, topics, words: text.split(' ').length,
    cover: null, blocks: [{ t: 'page', n: order + 1 }, { t: 'h', v: title }, { t: 'p', v: text }],
  });
  const articles = [
    art('2012-02-a', '2012-02', 0, 'Sheng in spring', 'Raw puerh from Yiwu, sheng and bitter, brewed in a teapot.', ['sheng-puerh', 'teaware']),
    art('2012-02-b', '2012-02', 1, 'Oolong roasting', 'Charcoal roasted oolong from Dong Ding.', ['oolong']),
    art('2012-03-a', '2012-03', 0, 'Bowls', 'A bowl for tea, and the Yiwu hills again.', ['teaware']),
  ];
  const manifest = {
    format: 1,
    sources: [{ id: 'gth', name: 'Global Tea Hut', kind: 'magazine', subtitle: 'Tea & Tao', credit: 'Global Tea Hut, globalteahut.org', issues: [
      { id: '2012-02', label: 'February 2012', articles: ['2012-02-a', '2012-02-b'] },
      { id: '2012-03', label: 'March 2012', articles: ['2012-03-a'] },
    ] }],
    topics: TOPICS,
    articles: articles.map(({ blocks: _b, ...m }) => m),
  };
  writePackage(dir, manifest, articles);
}

function newBook(): SourcePackage {
  const articles = [
    { id: '1906-the-book-p01-the-cup', source: 'the-book', issue: '1906-the-book', title: 'The Cup of Humanity', author: '', pages: '1–9', order: 0,
      topics: ['teaware'], words: 12, cover: '1906-the-book/1906-the-book-007-001.jpg',
      blocks: [{ t: 'page' as const, n: 1 }, { t: 'p' as const, v: 'Tea began as a medicine; the teapot and the bowl came later. Yiwu zygote.' },
        { t: 'img' as const, src: '1906-the-book/1906-the-book-007-001.jpg' }] },
    { id: '1906-the-book-p10-the-schools', source: 'the-book', issue: '1906-the-book', title: 'The Schools of Tea', author: 'Okakura', pages: '10–20', order: 1,
      topics: [], words: 8, cover: null, blocks: [{ t: 'p' as const, v: 'Boiled, whipped and steeped: three schools, and no sheng.' }] },
  ];
  return {
    manifest: {
      format: 1,
      sources: [{ id: 'the-book', name: 'The Book of Tea', kind: 'book', subtitle: 'Kakuzo Okakura', credit: 'The Book of Tea, Kakuzo Okakura',
        issues: [{ id: '1906-the-book', label: 'The Book of Tea', articles: articles.map(a => a.id) }] }],
      topics: [TOPICS[2]],
      articles: articles.map(({ blocks: _b, ...m }) => m),
    },
    articles,
  };
}

function indexOf(objects: Array<{ key: string; body?: string }>) {
  const out = new Map<string, unknown>();
  for (const o of objects) if (o.body !== undefined) out.set(o.key.replace(/^index\/v1\//, ''), JSON.parse(o.body));
  return out;
}

describe('merging a new source into the published index', () => {
  it('gives exactly what a full rebuild with the source added gives', () => {
    const root = mkdtempSync(join(tmpdir(), 'atlas-merge-'));
    dirs.push(root);
    const pkgDir = join(root, 'export');
    const addedDir = join(root, 'added', 'the-book');
    basePackage(pkgDir);
    const book = newBook();
    writePackage(addedDir, book.manifest, book.articles);

    const before = indexOf(buildAtlas(pkgDir).objects);
    const after = indexOf(buildAtlas(pkgDir, { added: [{ dir: addedDir }] }).objects);

    const need = touchedBy(book);
    const merged = mergeIntoIndex({
      home: before.get('home.json') as any,
      catalog: before.get('search/catalog.json') as any,
      topics: new Map(need.topics.map(t => [t, before.get(`topics/${t}.json`) as any])),
      shards: new Map(need.shards.filter(s => before.has(`search/text/${s}.json`)).map(s => [s, before.get(`search/text/${s}.json`) as any])),
    }, book);

    // Every file the merge writes is the rebuild's file, byte for byte.
    for (const [key, body] of merged) expect(JSON.stringify(body), key).toBe(JSON.stringify(after.get(key)));
    // And every file the rebuild changed, the merge wrote.
    const changed = [...after.keys()].filter(k => JSON.stringify(after.get(k)) !== JSON.stringify(before.get(k)));
    expect(merged.map(([k]) => k).sort()).toEqual(changed.sort());
    // Home last, so nothing points at a file not yet written.
    expect(merged[merged.length - 1][0]).toBe('home.json');
  });

  it('refuses a source the library already has', () => {
    const book = newBook();
    const home = { format: 1, sources: [{ id: 'the-book' }], topics: [], totals: { sources: 1, issues: 1, articles: 1 } } as any;
    expect(() => mergeIntoIndex({ home, catalog: { fields: [], rows: [] }, topics: new Map(), shards: new Map() }, book)).toThrow(/already/);
  });

  it('a rebuild does not re-send the added articles, which are already in the bucket', () => {
    const root = mkdtempSync(join(tmpdir(), 'atlas-merge-'));
    dirs.push(root);
    basePackage(join(root, 'export'));
    const book = newBook();
    writePackage(join(root, 'added', 'the-book'), book.manifest, book.articles);
    const { objects } = buildAtlas(join(root, 'export'), { added: [{ dir: join(root, 'added', 'the-book') }] });
    const keys = objects.map(o => o.key);
    expect(keys).toContain('index/v1/sources/the-book.json');
    expect(keys).not.toContain('articles/1906-the-book-p01-the-cup.json');
    expect(keys).toContain('articles/2012-02-a.json');
  });
});

// ── Splitting, on made-up pages ──────────────────────────────────────────

const line = (text: string, size: number, x: number, y: number, right = x + text.length * size * 0.5): PdfLine => ({ text, size, x, y, right });
const page = (index: number, lines: PdfLine[], extra: Partial<PdfPage> = {}): PdfPage => ({ index, width: 600, height: 800, lines, pictures: [], ...extra });
const docOf = (pages: PdfPage[], extra: Partial<PdfDoc> = {}): PdfDoc => ({ title: '', author: '', pageCount: pages.length, labels: null, outline: [], pages, ...extra });
const bodyLines = (n: number, y0 = 300) => Array.from({ length: n }, (_, i) => line(`Body text line number ${i} that runs on and on with words`, 10, 40, y0 + i * 13));

describe('splitting', () => {
  it('uses the bookmarks, folding the front matter into one opening section', () => {
    const pages = Array.from({ length: 30 }, (_, i) => page(i, bodyLines(5)));
    const doc = docOf(pages, { outline: [
      { title: 'Title Page', page: 1 }, { title: 'Contents', page: 2 },
      { title: 'I. The Cup of Humanity', page: 4 }, { title: 'II. The Schools of Tea', page: 14 },
    ] });
    expect(proposeSplit(doc)).toEqual({ method: 'outline', sections: [
      { title: 'Cover & contents', start: 0 }, { title: 'I. The Cup of Humanity', start: 4 }, { title: 'II. The Schools of Tea', start: 14 },
    ] });
  });

  it('opens a long bookmarked part into its own bookmarks', () => {
    const pages = Array.from({ length: 100 }, (_, i) => page(i, bodyLines(3)));
    const doc = docOf(pages, { outline: [
      { title: 'Introduction', page: 0 },
      { title: 'Part 1', page: 5, children: [{ title: 'China', page: 7 }, { title: 'Japan', page: 40 }] },
      { title: 'Index', page: 90 },
    ] });
    expect(fromOutline(doc)!.map(s => [s.title, s.start])).toEqual([['Introduction', 0], ['Part 1', 5], ['China', 7], ['Japan', 40], ['Index', 90]]);
  });

  it('splits a long part with no bookmarks at the heading level nearest an article’s length', () => {
    // A 60-page part: a region heading every 12 pages, a country heading every 2.
    // Distinct names: a heading that differs only by a number reads as a running head.
    const name = (i: number) => ['Alder', 'Birch', 'Cedar', 'Damson', 'Elm', 'Fir', 'Gorse', 'Hazel', 'Ivy', 'Juniper'][i % 10] + ' ' + ['North', 'South', 'East', 'West', 'Hill', 'Vale', 'Coast'][Math.floor(i / 10)];
    const pages = Array.from({ length: 70 }, (_, i) => page(i, [
      ...(i >= 6 && i % 12 === 6 ? [line(`Region ${name(i)}`, 30, 40, 60)] : []),
      ...(i >= 6 && i % 2 === 0 && i % 12 !== 6 ? [line(`Country ${name(i)}`, 20, 40, 60)] : []),
      ...bodyLines(8, 120).map(l => ({ ...l, text: `${l.text} on page ${i}` })),
    ]));
    const doc = docOf(pages, { outline: [{ title: 'Introduction', page: 0 }, { title: 'Part 1', page: 5 }, { title: 'Index', page: 66 }] });
    const titles = fromOutline(doc)!.map(s => s.title);
    // Regions (every 12 pages, twice an article) beat countries (every 2, a third of one).
    expect(titles.filter(t => t.startsWith('Region')).length).toBe(5);
    expect(titles.some(t => t.startsWith('Country'))).toBe(false);
  });

  it('reads a magazine contents page: numbers first, titles over two lines, bylines, two runs', () => {
    const lines = [
      line('Contents', 48, 45, 64),
      line('13 The Glory of Tianmu', 16, 43, 321), line('By Wang Duozhi', 11, 65, 334),
      line('25 Tianmu Kilns in', 16, 43, 363), line('Fujian', 15, 65, 380), line('By Li Jian’an', 11, 65, 393),
      line('03 Tea of the Month', 14, 43, 567),
      line('p. 33 Lin Jinzhong, by Wu De', 11, 65, 677),
    ];
    expect(contentsEntries(lines)).toEqual([
      { n: 13, title: 'The Glory of Tianmu', author: 'Wang Duozhi' },
      { n: 25, title: 'Tianmu Kilns in Fujian', author: 'Li Jian’an' },
      { n: 3, title: 'Tea of the Month' },
      { n: 33, title: 'Lin Jinzhong, by Wu De' },
    ]);
  });

  it('splits by large headings and takes the title above a bigger pull quote', () => {
    const pages = [
      page(0, [line('Cover words here', 40, 40, 100), ...bodyLines(10)]),
      page(1, bodyLines(20, 100)),
      page(2, [line('Aged and Aging Oolong', 20, 40, 80), line('We love that our tea', 42, 40, 200), ...bodyLines(10)]),
      page(3, bodyLines(20, 100)),
    ];
    const p = proposeSplit(docOf(pages));
    expect(p.method).toBe('headings');
    expect(p.sections).toEqual([{ title: 'Cover words here', start: 0 }, { title: 'Aged and Aging Oolong', start: 2 }]);
  });

  it('keeps a saved web article whole, under its title', () => {
    const pages = [page(0, [line('SHOU PU VS SHENG', 24, 40, 60), line('PU', 24, 40, 88), ...bodyLines(10)]), page(1, bodyLines(20, 100)), page(2, bodyLines(20, 100))];
    expect(proposeSplit(docOf(pages))).toEqual({ method: 'whole', sections: [{ title: 'SHOU PU VS SHENG PU', start: 0 }] });
  });
});

describe('reading a page as printed', () => {
  it('puts a drop cap back on its word, and reads the left column first', () => {
    const lines = [
      line('to the old ways. If you have such a rare autumn tea,', 11, 317, 230),
      line('take it out and light some charcoal', 11, 317, 243),
      line('I', 78, 34, 272),
      line('n November, shades of winter begin', 11, 67, 232),
      line('we shift more and more to our warmest teas', 11, 67, 245),
    ];
    const ordered = readingOrder(joinDropCaps(lines), 595);
    expect(ordered.map(l => l.text.slice(0, 14))).toEqual(['In November, s', 'we shift more ', 'to the old way', 'take it out an']);
  });

  it('joins hyphenated lines, drops running heads, and keeps words as printed', () => {
    const pages = [0, 1, 2].map(i => page(i, [
      line('THE BOOK OF TEA', 9, 250, 30),
      line(i === 0 ? 'Tea began as a medicine and grew into a bev-' : `Page ${i} opens with a different line of text`, 10, 40, 100),
      line(i === 0 ? 'erage. In China, in the eighth century, it' : `and carries on with other words on page ${i}`, 10, 40, 113),
      line(i === 0 ? 'entered the realm of poetry.' : `before it ends, as page ${i} does.`, 10, 40, 126),
      line(`${i + 1}`, 9, 300, 780),
    ]));
    const doc = docOf(pages);
    const paras = pageParas(doc.pages[0], 10, runningLines(doc));
    expect(paras).toEqual([{ text: 'Tea began as a medicine and grew into a beverage. In China, in the eighth century, it entered the realm of poetry.', heading: false }]);
  });

  it('styles a 茶人 byline as an aside and takes the author from it', () => {
    const { blocks, author } = styleBlocks([
      { page: 5 },
      { text: 'Old Spring, New Path', heading: true },
      { text: 'Old Spring 茶人: Wu De', heading: false },
      { text: 'The spring was old.', heading: false },
    ], 'Old Spring, New Path');
    expect(author).toBe('Wu De');
    expect(blocks).toEqual([{ t: 'page', n: 5 }, { t: 'h', v: 'Old Spring' }, { t: 'aside', v: '茶人: Wu De' }, { t: 'p', v: 'The spring was old.' }]);
  });
});

describe('building the package', () => {
  it('names things the way the Global Tea Hut export does', () => {
    expect(slug('2012-02 p03 Answering Some Puerh Questions')).toBe('2012-02-p03-answering-some-puerh-questions');
    expect(slug('The Book of Tea: Growing it, making it…')).toBe('the-book-of-tea-growing-it-making-it');
  });

  it('builds format-1 articles with page markers, pictures and page spans', () => {
    const pages = [0, 1, 2, 3].map(i => page(i, [line(i === 2 ? 'Chapter Two' : 'Chapter One', 20, 40, 60), ...bodyLines(4)]));
    const doc = docOf(pages);
    const pkg = buildSourcePackage({
      doc,
      details: { name: 'The Book of Tea', kind: 'book', subtitle: 'Okakura', credit: '', year: '1906', issueLabel: '' },
      sections: [{ title: 'Chapter One', author: '', start: 0, topics: [] }, { title: 'Chapter Two', author: 'Okakura', start: 2, topics: ['teaware'] }],
      pictures: new Map([[1, ['1906-the-book-of-tea/1906-the-book-of-tea-002-001.jpg']]]),
      topics: TOPICS,
    });
    expect(pkg.manifest.sources[0]).toMatchObject({ id: 'the-book-of-tea', credit: 'The Book of Tea', issues: [{ id: '1906-the-book-of-tea', label: 'The Book of Tea' }] });
    const [one, two] = pkg.articles;
    expect(one).toMatchObject({ id: '1906-the-book-of-tea-p01-chapter-one', pages: '1–2', order: 0, cover: '1906-the-book-of-tea/1906-the-book-of-tea-002-001.jpg' });
    expect(one.blocks.filter(b => b.t === 'page')).toEqual([{ t: 'page', n: 1 }, { t: 'page', n: 2 }]);
    expect(one.blocks.some(b => b.t === 'h' && b.v === 'Chapter One')).toBe(false);
    expect(two).toMatchObject({ pages: '3–4', author: 'Okakura', topics: ['teaware'] });
    expect(pkg.manifest.topics.map(t => t.id)).toEqual(['teaware']);
    expect(pkg.manifest.articles[0]).not.toHaveProperty('blocks');
  });

  it('suggests topics as tea-atlas.py does: three mentions, or named in the title', () => {
    expect(countHits('Sheng, sheng-cha and sheng. Shengs.', ['sheng'])).toBe(2);
    const blocks = [{ t: 'p' as const, v: 'An oolong, an oolong, one more oolong. A teapot.' }];
    expect(suggestTopics('On the teapot', blocks, TOPICS)).toEqual(['oolong', 'teaware']);
  });
});

describe('letters a PDF hides', () => {
  it('reads old-style small capitals as the letters they are', () => {
    expect(plainLetters('T began in ')).toBe('Tea began in 1906');
  });

  it('puts back lost fi, fl and ff from words the library knows', () => {
    const doc = docOf([page(0, [line('the di\u0000erences between the pro\u0000les,', 10, 40, 100), line('and \u0000avors. But \u0000rst, the zq\u0000x.', 10, 40, 113)])]);
    const known = new Set(['differences', 'profiles', 'flavors', 'first']);
    const fixed = repairLigatures(doc, w => known.has(w));
    expect(fixed.pages[0].lines.map(l => l.text)).toEqual([
      'the differences between the profiles,',
      'and flavors. But first, the zqfix.',
    ]);
  });

  it('drops a web page menu printed on every page, and keeps a book heading that recurs', () => {
    const pages = Array.from({ length: 10 }, (_, i) => page(i, [
      line(`Body opening words for page ${i} of the text`, 10, 40, 100),
      line(`A second line of page ${i}`, 10, 40, 113),
      line('SHOP', 10, 40, 300),
      line(i % 4 === 0 ? 'Ingredients' : `More words on page ${i}`, 10, 40, 313),
      line(`Nearly the end of page ${i}`, 10, 40, 487),
      line(`Closing words for page ${i} of the text`, 10, 40, 500),
    ]));
    const running = runningLines(docOf(pages));
    expect(running.has('SHOP')).toBe(true);
    expect(running.has('Ingredients')).toBe(false);
  });
});
