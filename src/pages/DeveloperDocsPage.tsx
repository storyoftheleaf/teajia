import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';
import { MarkdownView } from '../components/shared/MarkdownView';

/**
 * DeveloperDocsPage — owner-only in-app reader for the project's development
 * documentation. Every markdown doc under docs/ (plus the load-bearing root
 * docs) is bundled at build time via import.meta.glob as raw text, so the
 * reader is always current with the repo and needs no upload step. This page
 * is lazy-loaded, so the doc corpus lives in its own chunk and never weighs
 * down the main bundle.
 *
 * Gating: platform owners / admins only. Product cards (products/**) and agent
 * skill files (.agents/**) are deliberately excluded — this is "what we built,"
 * not the catalog or the tooling.
 */

// Lazy doc loaders. Vite resolves these globs at build time but, because they
// are NOT eager, each doc's body lives in its own tiny chunk fetched only when
// that doc is opened. The index needs paths only, so the page chunk stays
// light even though docs/ is ~1.7 MB of raw text in total.
const docLoaders = import.meta.glob('/docs/**/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const rootLoaders = import.meta.glob(
  ['/PRODUCT.md', '/PLAN.md', '/README.md', '/DEPLOY.md', '/AGENTS.md'],
  { query: '?raw', import: 'default' },
) as Record<string, () => Promise<string>>;

interface DocEntry {
  path: string;       // /docs/plan/foo.md
  title: string;      // Foo
  group: string;      // Plans
  load: () => Promise<string>;
}

const GROUP_ORDER = ['Overview', 'Roadmap & State', 'Plans', 'Briefs', 'Audits', 'Reference', 'Archive', 'Root'];

function classify(path: string): { group: string; title: string } {
  const file = path.split('/').pop() || path;
  const base = file.replace(/\.md$/, '');
  const title = base
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bMcp\b/g, 'MCP')
    .replace(/\bUi\b/g, 'UI')
    .replace(/\bIa\b/g, 'IA')
    .replace(/\bRsvp\b/g, 'RSVP')
    .replace(/\bCsv\b/g, 'CSV');

  if (path.startsWith('/docs/_archive/')) return { group: 'Archive', title };
  if (path.startsWith('/docs/_audit/') || /AUDIT|FRICTION|REVIEW|FINDINGS/i.test(file)) return { group: 'Audits', title };
  if (path.startsWith('/docs/plan/') || /_PLAN\.md$|PLAN\.md$/i.test(file)) return { group: 'Plans', title };
  if (path.startsWith('/docs/brief/') || /BRIEF|PERSONAS|SPRINT|STRATEGY|PRIORITIES/i.test(file)) return { group: 'Briefs', title };
  if (/STATE_OF_THE_SITE|ROADMAP|CHANGELOG/i.test(file)) return { group: 'Roadmap & State', title };
  if (/ARCHITECTURE|VISION|PRODUCT|FLOWS|SITE_MAP|INDEX/i.test(file)) return { group: 'Overview', title };
  if (/GUIDE|WORKFLOW|PLAYBOOK|NOTES|RULES|CONSISTENCY|SYSTEM/i.test(file)) return { group: 'Reference', title };
  return { group: 'Reference', title };
}

export default function DeveloperDocsPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [active, setActive] = useState<string | null>(null);

  const docs = useMemo<DocEntry[]>(() => {
    const all: DocEntry[] = [];
    for (const [path, load] of Object.entries(docLoaders)) {
      const { group, title } = classify(path);
      all.push({ path, title, group, load });
    }
    for (const [path, load] of Object.entries(rootLoaders)) {
      const file = path.split('/').pop()!.replace(/\.md$/, '');
      all.push({ path, title: file.replace(/\b\w/g, (c) => c.toUpperCase()), group: 'Root', load });
    }
    return all.sort((a, b) => a.title.localeCompare(b.title));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, DocEntry[]>();
    for (const d of docs) {
      if (!map.has(d.group)) map.set(d.group, []);
      map.get(d.group)!.push(d);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, [docs]);

  const activeDoc = useMemo(() => docs.find((d) => d.path === active) || null, [docs, active]);
  const [activeBody, setActiveBody] = useState<string | null>(null);

  useEffect(() => {
    if (!activeDoc) {
      setActiveBody(null);
      return;
    }
    let cancelled = false;
    setActiveBody(null);
    activeDoc.load().then((body) => {
      if (!cancelled) setActiveBody(body);
    });
    return () => {
      cancelled = true;
    };
  }, [activeDoc]);

  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center pb-nav">
        <div className="font-display text-[22px] text-tea-text mb-2">Not available</div>
        <p className="font-serif text-ui-15 text-tea-text-sec max-w-[320px]">
          The development library is visible to the platform owner only.
        </p>
        <button
          onClick={() => navigate('/account')}
          className="mt-6 text-ui-13 text-tea-text-sec hover:text-tea-text underline underline-offset-2"
        >
          Back to Your Table
        </button>
      </div>
    );
  }

  // Reading a single doc
  if (activeDoc) {
    return (
      <div className="min-h-dvh bg-tea-bg pb-nav-gap-lg">
        <div className="sticky top-0 z-10 bg-tea-bg/95 backdrop-blur-sm border-b border-tea-border">
          <div className="max-w-[760px] mx-auto px-6 lg:px-8 py-3 flex items-center gap-3">
            <button
              onClick={() => setActive(null)}
              className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text tap-target"
            >
              <ArrowLeft className="w-4 h-4" weight="bold" />
              <span className="text-ui-13">All docs</span>
            </button>
            <span className="text-ui-12 text-tea-text-dim truncate ml-auto">{activeDoc.title}</span>
          </div>
        </div>
        <article className="max-w-[760px] mx-auto px-6 lg:px-8 pt-8">
          {activeBody === null ? (
            <p className="font-serif text-ui-15 text-tea-text-dim">Loading…</p>
          ) : (
            <MarkdownView source={activeBody} />
          )}
        </article>
      </div>
    );
  }

  // Index of all docs
  return (
    <div className="min-h-dvh bg-tea-bg pb-nav-gap-lg">
      <div className="max-w-[760px] mx-auto px-6 lg:px-8 pt-8">
        <button
          onClick={() => navigate('/account')}
          className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text mb-6 tap-target"
        >
          <ArrowLeft className="w-4 h-4" weight="bold" />
          <span className="text-ui-13">Your Table</span>
        </button>

        <h1 className="font-display text-ui-26 text-tea-text tracking-[0.01em]">Development Library</h1>
        <p className="font-serif text-ui-15 text-tea-text-sec mt-2 mb-8 leading-[1.65]">
          Everything that has been designed and built into Teajia, as written down. {docs.length} documents,
          newest thinking and shipped work both. Owner-only.
        </p>

        {grouped.map(({ group, items }) => (
          <section key={group} className="mb-8">
            <div className="font-sans text-ui-12 font-semibold uppercase tracking-[0.08em] text-tea-text-dim mb-3">
              {group}
            </div>
            <div className="flex flex-col">
              {items.map((d) => (
                <button
                  key={d.path}
                  onClick={() => setActive(d.path)}
                  className="text-left py-2.5 border-b border-tea-border hover:bg-tea-gold/[0.04] -mx-2 px-2 rounded transition-colors"
                >
                  <span className="font-serif text-ui-15 text-tea-text">{d.title}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
