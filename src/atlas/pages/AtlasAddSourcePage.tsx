import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { SiteNotFound } from '../../components/SiteNotFound';
import { atlasAdminResponse } from '../../lib/api';
import { ATLAS_ROOT, AtlasFrame } from '../AtlasFrame';
import { atlasJson, clearAtlasCache } from '../client';
import type { AtlasHome, AtlasTopic } from '../types';
import {
  buildSourcePackage, issueIdFor, pictureStem, sourceIdFor, suggestTopics,
  type CheckedSection, type SourceDetails, type SourceKind,
} from '../add/buildPackage';
import { publishSource, type PublishStep } from '../add/publish';
import { readPdf, type PictureCandidate, type ReadResult } from '../add/readPdf';
import { withLigaturesRepaired } from '../add/libraryWords';
import { documentTitle, proposeSplit } from '../add/split';
import { bodySize, pageName, pageOffset, pageParas, printedPage, runningLines, type Para } from '../add/text';
import type { SplitMethod } from '../add/types';

// Add a source to the Tea Atlas (docs/TEA_ATLAS.md, "Adding a source in the
// admin"). Drop a PDF; it is read and split here in the browser; check the
// sections; publish. Only the site owner reaches this page: the server answers
// everyone else with the same 404 as the rest of the library.

type Stage =
  | { name: 'asking' }
  | { name: 'shut' }
  | { name: 'drop'; error?: string }
  | { name: 'reading'; file: string; done: number; total: number }
  | { name: 'review' }
  | { name: 'publishing'; step: PublishStep }
  | { name: 'done'; sourceId: string; name_: string; articles: number };

interface Draft {
  key: number;
  title: string;
  author: string;
  start: number;
  /** null: follow the suggestion, which moves when the section's pages do. */
  topics: string[] | null;
}

const METHOD_WORDS: Record<SplitMethod, string> = {
  outline: 'Split by the PDF’s own bookmarks.',
  contents: 'Split by its contents page.',
  headings: 'Split where large headings start a page.',
  whole: 'No chapters found, so it is one article. Add a break at any page to split it.',
};

const field = 'w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-15 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none';
const quiet = 'text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors';

let nextKey = 1;

export default function AtlasAddSourcePage() {
  const [stage, setStage] = useState<Stage>({ name: 'asking' });
  const [read, setRead] = useState<ReadResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [method, setMethod] = useState<SplitMethod>('whole');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [details, setDetails] = useState<SourceDetails>({ name: '', kind: 'book', subtitle: '', credit: '', year: '', issueLabel: '' });
  const [leftOut, setLeftOut] = useState<Set<string>>(new Set());
  const [topics, setTopics] = useState<AtlasTopic[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    atlasAdminResponse('can-manage')
      .then(res => { if (live) setStage(res.ok ? { name: 'drop' } : { name: 'shut' }); })
      .catch(() => { if (live) setStage({ name: 'shut' }); });
    atlasJson<AtlasHome>('home.json').then(h => { if (live) setTopics(h.topics); }).catch(() => {});
    return () => { live = false; };
  }, []);

  // Text per page, worked out once per PDF: previews and topic suggestions read it.
  const paras = useMemo(() => {
    if (!read) return [] as Para[][];
    const body = bodySize(read.doc);
    const running = runningLines(read.doc);
    return read.doc.pages.map(p => pageParas(p, body, running));
  }, [read]);
  const offset = useMemo(() => (read ? pageOffset(read.doc) : 0), [read]);

  const sorted = useMemo(() => [...drafts].sort((a, b) => a.start - b.start), [drafts]);
  const endOf = (i: number) => (sorted[i + 1]?.start ?? read?.doc.pageCount ?? 1) - 1;

  const suggested = useMemo(() => {
    const out = new Map<number, string[]>();
    sorted.forEach((d, i) => {
      const end = (sorted[i + 1]?.start ?? paras.length) - 1;
      const text = paras.slice(d.start, end + 1).flat().map(p => ({ t: 'p' as const, v: p.text }));
      out.set(d.key, suggestTopics(d.title, text, topics));
    });
    return out;
  }, [sorted, paras, topics]);

  const onFile = useCallback(async (file: File) => {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setStage({ name: 'drop', error: 'That is not a PDF.' });
      return;
    }
    setFileName(file.name);
    setStage({ name: 'reading', file: file.name, done: 0, total: 0 });
    try {
      const raw = await readPdf(file, (done, total) => setStage({ name: 'reading', file: file.name, done, total }));
      const result = { ...raw, doc: await withLigaturesRepaired(raw.doc) };
      const proposal = proposeSplit(result.doc, file.name);
      const name = documentTitle(result.doc, file.name);
      const kind: SourceKind = proposal.method === 'outline' || result.doc.pageCount > 80 ? 'book'
        : result.doc.pageCount <= 20 ? 'article' : 'magazine';
      setRead(result);
      setMethod(proposal.method);
      setDrafts(proposal.sections.map(s => ({ key: nextKey++, title: s.title, author: s.author ?? '', start: s.start, topics: null })));
      setDetails({
        name, kind, subtitle: result.doc.author, credit: [name, result.doc.author].filter(Boolean).join(', '),
        year: '', issueLabel: kind === 'magazine' ? '' : name,
      });
      // Paper backgrounds start out left out; one click keeps them. A cover is
      // as smooth as paper, so the first two pages' pictures always start kept.
      setLeftOut(new Set([...result.pictures].filter(([page]) => page > 1).flatMap(([, pics]) => pics).filter(p => p.plain).map(p => p.url)));
      setError('');
      setStage({ name: 'review' });
    } catch (err) {
      setStage({ name: 'drop', error: `Could not read that PDF. ${err instanceof Error ? err.message : ''}`.trim() });
    }
  }, []);

  const update = (key: number, patch: Partial<Draft>) => setDrafts(ds => ds.map(d => (d.key === key ? { ...d, ...patch } : d)));

  const joinUp = (key: number) => setDrafts(ds => ds.filter(d => d.key !== key));

  const breakAt = (printed: number) => {
    if (!read) return;
    const index = printed + offset - 1;
    if (index <= 0 || index >= read.doc.pageCount || drafts.some(d => d.start === index)) return;
    const page = read.doc.pages[index];
    const top = page.lines.length ? Math.max(...page.lines.map(l => l.size)) : 0;
    const title = page.lines.find(l => l.size === top)?.text ?? `Page ${printed}`;
    setDrafts(ds => [...ds, { key: nextKey++, title, author: '', start: index, topics: null }]);
  };

  const moveStart = (key: number, printed: number) => {
    const i = sorted.findIndex(d => d.key === key);
    if (i <= 0 || !read) return;
    const index = printed + offset - 1;
    const lo = sorted[i - 1].start + 1;
    const hi = (sorted[i + 1]?.start ?? read.doc.pageCount) - 1;
    if (index >= lo && index <= hi) update(key, { start: index, topics: null });
  };

  const topicsOf = (d: Draft) => d.topics ?? suggested.get(d.key) ?? [];

  const onPublish = async () => {
    if (!read) return;
    if (!details.name.trim()) { setError('Give the source a name.'); return; }
    if (!details.credit.trim()) { setError('Say who the source is credited to; every article shows it.'); return; }
    if (details.year && !/^\d{4}$/.test(details.year)) { setError('The year is four digits, or empty.'); return; }
    setError('');
    const issueId = issueIdFor(details);
    const media = new Map<number, string[]>();
    const blobs = new Map<string, Blob>();
    for (const [page, pics] of read.pictures) {
      const srcs: string[] = [];
      pics.filter(p => !leftOut.has(p.url)).forEach((p, n) => {
        const src = `${issueId}/${pictureStem(issueId, page, n + 1)}.jpg`;
        srcs.push(src);
        blobs.set(src, p.jpeg);
      });
      media.set(page, srcs);
    }
    const sections: CheckedSection[] = sorted.map(d => ({ title: d.title, author: d.author, start: d.start, topics: topicsOf(d) }));
    const pkg = buildSourcePackage({ doc: read.doc, details, sections, pictures: media, topics });
    setStage({ name: 'publishing', step: { label: 'Checking the name', done: 0, total: 1 } });
    try {
      await publishSource(pkg, blobs, step => setStage({ name: 'publishing', step }));
      clearAtlasCache();
      setStage({ name: 'done', sourceId: sourceIdFor(details.name), name_: details.name, articles: pkg.articles.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publishing stopped.');
      setStage({ name: 'review' });
    }
  };

  const startOver = () => {
    for (const pics of read?.pictures.values() ?? []) for (const p of pics) URL.revokeObjectURL(p.url);
    setRead(null);
    setDrafts([]);
    setStage({ name: 'drop' });
  };

  if (stage.name === 'shut') return <SiteNotFound />;
  if (stage.name === 'asking') return <AtlasFrame title="Add a source" hideSearch hideIndex><p className="text-tea-text-dim text-ui-14">Loading…</p></AtlasFrame>;

  return (
    <AtlasFrame title="Add a source" measure="wide" hideSearch hideIndex>
      <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-2`}>Add a source</h1>

      {stage.name === 'drop' && <DropZone onFile={onFile} error={stage.error} />}

      {stage.name === 'reading' && (
        <p className="text-tea-text-sec text-ui-15 mt-6" role="status">
          Reading {stage.file}{stage.total ? `: page ${stage.done} of ${stage.total}` : '…'}
        </p>
      )}

      {stage.name === 'publishing' && (
        <p className="text-tea-text-sec text-ui-15 mt-6" role="status">
          {stage.step.label}{stage.step.total > 1 ? `: ${stage.step.done} of ${stage.step.total}` : '…'}
        </p>
      )}

      {stage.name === 'done' && (
        <div className="mt-6" role="status">
          <p className="text-tea-text text-ui-17 mb-4">
            Published: {stage.name_}, {stage.articles} {stage.articles === 1 ? 'article' : 'articles'}.
          </p>
          <div className="flex flex-wrap gap-6">
            <Link to={`${ATLAS_ROOT}/source/${stage.sourceId}`} className="text-ui-15 text-tea-gold hover:text-tea-text transition-colors">
              Read it in the Tea Atlas
            </Link>
            <button type="button" onClick={startOver} className={quiet}>Add another</button>
          </div>
        </div>
      )}

      {stage.name === 'review' && read && (
        <>
          <p className="text-tea-text-sec text-ui-15 mb-8">
            {fileName}: {read.doc.pageCount} pages. {METHOD_WORDS[method]} Check the sections, fix anything, then publish.
          </p>

          <section aria-labelledby="add-details" className="mb-10">
            <h2 id="add-details" className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec mb-4`}>The source</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Labelled label="Name">
                <input className={field} value={details.name} onChange={e => setDetails({ ...details, name: e.target.value })} />
              </Labelled>
              <Labelled label="Kind">
                <select className={field} value={details.kind} onChange={e => setDetails({ ...details, kind: e.target.value as SourceKind })}>
                  <option value="book">Book</option>
                  <option value="magazine">Magazine issue</option>
                  <option value="article">Article</option>
                </select>
              </Labelled>
              <Labelled label="Line under the name">
                <input className={field} value={details.subtitle} placeholder="Author, edition or years" onChange={e => setDetails({ ...details, subtitle: e.target.value })} />
              </Labelled>
              <Labelled label="Credit, shown with every article">
                <input className={field} value={details.credit} placeholder="Publisher or website" onChange={e => setDetails({ ...details, credit: e.target.value })} />
              </Labelled>
              <Labelled label="Year">
                <input className={field} value={details.year} inputMode="numeric" placeholder="Four digits" onChange={e => setDetails({ ...details, year: e.target.value.trim() })} />
              </Labelled>
              <Labelled label={details.kind === 'magazine' ? 'Issue' : 'Shown as'}>
                <input className={field} value={details.issueLabel} placeholder={details.kind === 'magazine' ? 'May 2018' : details.name} onChange={e => setDetails({ ...details, issueLabel: e.target.value })} />
              </Labelled>
            </div>
          </section>

          <section aria-labelledby="add-sections" className="mb-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
              <h2 id="add-sections" className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>
                {sorted.length} {sorted.length === 1 ? 'section' : 'sections'}
              </h2>
              <BreakAt onBreak={breakAt} />
            </div>
            <ol className="divide-y divide-tea-border">
              {sorted.map((d, i) => (
                <SectionRow
                  key={d.key}
                  draft={d}
                  first={i === 0}
                  from={printedPage(d.start, offset)}
                  fromName={pageName(read.doc, d.start, offset)}
                  toName={pageName(read.doc, endOf(i), offset)}
                  preview={previewOf(paras, d.start, endOf(i), d.title)}
                  pictures={read.pictures ? range(d.start, endOf(i)).flatMap(p => read.pictures.get(p) ?? []) : []}
                  leftOut={leftOut}
                  onTogglePicture={url => setLeftOut(s => { const n = new Set(s); if (n.has(url)) n.delete(url); else n.add(url); return n; })}
                  topics={topics}
                  chosen={topicsOf(d)}
                  onTopics={next => update(d.key, { topics: next })}
                  onTitle={title => update(d.key, { title })}
                  onAuthor={author => update(d.key, { author })}
                  onStart={printed => moveStart(d.key, printed)}
                  onJoinUp={() => joinUp(d.key)}
                />
              ))}
            </ol>
          </section>

          {error && <p className="text-ui-15 text-tea-text mb-4" role="alert">{error}</p>}
          <div className="flex justify-between items-center gap-4">
            <button type="button" onClick={startOver} className="text-ui-15 text-tea-text-sec hover:text-tea-text transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={onPublish}
              className="cta-solid text-ui-15 px-5 py-2.5 rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none"
            >
              Publish to the Tea Atlas
            </button>
          </div>
        </>
      )}
    </AtlasFrame>
  );
}

const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

function previewOf(paras: Para[][], start: number, end: number, title: string): string {
  const low = title.trim().toLowerCase();
  for (const page of paras.slice(start, end + 1)) {
    const p = page.find(x => !x.heading && x.text.length > 40 && x.text.trim().toLowerCase() !== low);
    if (p) return p.text.length > 160 ? `${p.text.slice(0, 160).trimEnd()}…` : p.text;
  }
  return '';
}

const Labelled: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-ui-13 text-tea-text-sec mb-1">{label}</span>
    {children}
  </label>
);

function DropZone({ onFile, error }: { onFile: (f: File) => void; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div className="mt-6">
      <p className="text-tea-text-sec text-ui-15 mb-6">
        A book, a magazine issue or a saved web article, as a PDF. It is split into sections here, on this computer; you check them before anything is published.
      </p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className={`w-full rounded-md border border-dashed px-6 py-16 text-center transition-colors ${over ? 'border-tea-gold bg-tea-surface' : 'border-tea-border hover:border-tea-gold'}`}
      >
        <span className="block text-tea-text text-ui-17 mb-1">Drop a PDF here</span>
        <span className="block text-tea-text-sec text-ui-14">or choose one</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label="Choose a PDF"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
      {error && <p className="text-ui-15 text-tea-text mt-4" role="alert">{error}</p>}
    </div>
  );
}

function BreakAt({ onBreak }: { onBreak: (printed: number) => void }) {
  const [page, setPage] = useState('');
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={e => { e.preventDefault(); const n = Number(page); if (Number.isFinite(n) && page) { onBreak(n); setPage(''); } }}
    >
      <label htmlFor="break-at" className="text-ui-13 text-tea-text-sec whitespace-nowrap">Start a new section at page</label>
      <input
        id="break-at"
        className="w-16 bg-tea-bg border border-tea-border rounded px-2 py-1 text-ui-14 text-tea-text tabular-nums focus:border-tea-gold focus:outline-none"
        inputMode="numeric"
        value={page}
        onChange={e => setPage(e.target.value)}
      />
      <button type="submit" className={quiet}>Add</button>
    </form>
  );
}

interface RowProps {
  draft: Draft;
  first: boolean;
  from: number;
  fromName: string;
  toName: string;
  preview: string;
  pictures: PictureCandidate[];
  leftOut: Set<string>;
  onTogglePicture: (url: string) => void;
  topics: AtlasTopic[];
  chosen: string[];
  onTopics: (ids: string[]) => void;
  onTitle: (t: string) => void;
  onAuthor: (a: string) => void;
  onStart: (printed: number) => void;
  onJoinUp: () => void;
}

function SectionRow(p: RowProps) {
  const [start, setStart] = useState(String(p.from));
  useEffect(() => setStart(String(p.from)), [p.from]);
  const byId = new Map(p.topics.map(t => [t.id, t]));
  const rest = p.topics.filter(t => !p.chosen.includes(t.id));
  return (
    <li className="py-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-2">
        <input
          aria-label="Section title"
          className={`${field} flex-1 min-w-[16rem] font-display text-ui-17`}
          value={p.draft.title}
          onChange={e => p.onTitle(e.target.value)}
        />
        <span className="text-ui-13 text-tea-text-sec tabular-nums">
          {p.first ? (
            <>pages {p.fromName}{p.toName !== p.fromName ? `–${p.toName}` : ''}</>
          ) : (
            <>
              pages{' '}
              <input
                aria-label="Starts at page"
                className="w-14 bg-tea-bg border border-tea-border rounded px-1.5 py-0.5 text-ui-13 text-tea-text tabular-nums focus:border-tea-gold focus:outline-none"
                inputMode="numeric"
                value={start}
                onChange={e => setStart(e.target.value)}
                onBlur={() => { const n = Number(start); if (Number.isFinite(n)) p.onStart(n); setStart(String(p.from)); }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
              {p.toName !== p.fromName ? `–${p.toName}` : ''}
            </>
          )}
        </span>
        {!p.first && (
          <button type="button" onClick={p.onJoinUp} className={quiet}>Join with the one above</button>
        )}
      </div>
      <input
        aria-label="Author"
        className={`${field} max-w-sm py-1 text-ui-14 mb-2`}
        placeholder="Author, if it has one"
        value={p.draft.author}
        onChange={e => p.onAuthor(e.target.value)}
      />
      {p.preview && <p className="text-ui-14 text-tea-text-sec italic mb-3">{p.preview}</p>}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {p.chosen.map(id => (
          <button
            key={id}
            type="button"
            onClick={() => p.onTopics(p.chosen.filter(x => x !== id))}
            className="text-ui-13 text-tea-text bg-tea-surface hover:bg-tea-elevated rounded px-2 py-0.5 transition-colors"
            title="Remove this topic"
          >
            {byId.get(id)?.name ?? id} <span aria-hidden="true" className="text-tea-text-sec">×</span>
          </button>
        ))}
        {rest.length > 0 && (
          <select
            aria-label="Add a topic"
            className="bg-tea-bg border border-tea-border rounded px-2 py-0.5 text-ui-13 text-tea-text-sec focus:border-tea-gold focus:outline-none"
            value=""
            onChange={e => { if (e.target.value) p.onTopics([...p.chosen, e.target.value]); }}
          >
            <option value="">{p.chosen.length ? 'Add a topic' : 'No topics found. Add one'}</option>
            {rest.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      {p.pictures.length > 0 && (
        <div>
          <p className="text-ui-12 text-tea-text-dim mb-2">
            {p.pictures.filter(x => !p.leftOut.has(x.url)).length} of {p.pictures.length} pictures kept. Click one to leave it out.
          </p>
          <div className="flex flex-wrap gap-2">
            {p.pictures.map(pic => {
              const out = p.leftOut.has(pic.url);
              return (
                <button
                  key={pic.url}
                  type="button"
                  onClick={() => p.onTogglePicture(pic.url)}
                  aria-pressed={!out}
                  aria-label={out ? 'Picture left out; click to keep it' : 'Picture kept; click to leave it out'}
                  className={`relative h-20 rounded-[2px] overflow-hidden transition-opacity ${out ? 'opacity-30' : 'opacity-100'}`}
                >
                  <img src={pic.url} alt="" className="h-20 w-auto object-cover" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </li>
  );
}
