import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import {
  teaReferenceCategoryLabel,
  type TeaReferenceIssue,
} from '../../wisdom/reference/issues';
import { GENERATED_TEA_REFERENCE_PAGES } from '../../wisdom/reference/generatedPages';

interface TeaReferenceIssueGroup {
  pageId: string;
  pageLabel: string;
  route: string;
  issues: TeaReferenceIssue[];
}

const pageLabels = new Map<string, string>(
  GENERATED_TEA_REFERENCE_PAGES.map(page => [page.id, page.label]),
);
const fallbackPageLabel = (slug: string): string => slug
  .split('-')
  .filter(Boolean)
  .map(part => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

function codePointCompare(left: string, right: string): number {
  const leftPoints = [...left].map(character => character.codePointAt(0) ?? 0);
  const rightPoints = [...right].map(character => character.codePointAt(0) ?? 0);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] < rightPoints[index] ? -1 : 1;
  }
  return leftPoints.length - rightPoints.length;
}

export function groupOpenReferenceIssues(items: TeaReferenceIssue[]): TeaReferenceIssueGroup[] {
  const groups = new Map<string, TeaReferenceIssueGroup>();
  for (const issue of items) {
    if (issue.status !== 'open') continue;
    const existing = groups.get(issue.page_id);
    if (existing) existing.issues.push(issue);
    else groups.set(issue.page_id, {
      pageId: issue.page_id,
      pageLabel: pageLabels.get(issue.page_id) ?? fallbackPageLabel(issue.page_slug),
      route: issue.route,
      issues: [issue],
    });
  }

  return [...groups.values()]
    .sort((a, b) => codePointCompare(a.pageLabel, b.pageLabel) || codePointCompare(a.pageId, b.pageId))
    .map(group => ({
      ...group,
      issues: [...group.issues].sort((a, b) => (
        codePointCompare(a.created_at, b.created_at) || codePointCompare(a.id, b.id)
      )),
    }));
}

export function toggleReferenceIssueSelection(selected: Set<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function downloadTeaReferenceBrief(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tea-reference-regeneration-brief.md';
  link.click();
  URL.revokeObjectURL(url);
}

const formatIssueDate = (iso: string): string => new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(iso));

interface TeaReferenceIssuesContentProps {
  state: 'loading' | 'empty' | 'error' | 'ready';
  issues: TeaReferenceIssue[];
  selectedIds: Set<string>;
  isResolving: boolean;
  isExporting: boolean;
  actionError?: string;
  onToggle: (id: string) => void;
  onRetry: () => void;
  onResolve: () => void;
  onExport: () => void;
}

export const TeaReferenceIssuesContent: React.FC<TeaReferenceIssuesContentProps> = ({
  state,
  issues,
  selectedIds,
  isResolving,
  isExporting,
  actionError,
  onToggle,
  onRetry,
  onResolve,
  onExport,
}) => {
  const selectedCount = selectedIds.size;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 pb-nav-gap-lg sm:px-6 lg:px-8">
      <header className="flex flex-col gap-5 border-b border-tea-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Reference issues</h1>
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 max-w-2xl text-tea-text-sec`}>
            Open notes grouped by the public page they affect.
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={isExporting || state === 'loading' || state === 'error'}
          className={`${TYPOGRAPHY_CLASSES.link} inline-flex min-h-11 items-center justify-center gap-2 self-start px-2 text-tea-text-sec transition-colors hover:text-tea-text disabled:opacity-50 sm:self-auto`}
        >
          <Download size={16} aria-hidden="true" />
          {isExporting ? 'Preparing brief…' : 'Export regeneration brief'}
        </button>
      </header>

      {actionError && (
        <p role="alert" className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-4 text-tea-text-sec`}>{actionError}</p>
      )}

      {state === 'loading' && (
        <p role="status" className={`${TYPOGRAPHY_CLASSES.bodyLight} py-12 text-tea-text-sec`}>
          Loading reference issues…
        </p>
      )}

      {state === 'error' && (
        <div role="alert" className="py-12">
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`}>Could not load Reference issues.</p>
          <button type="button" onClick={onRetry} className={`${TYPOGRAPHY_CLASSES.link} mt-3 min-h-11 text-tea-gold hover:text-tea-gold-lt`}>
            Try again
          </button>
        </div>
      )}

      {state === 'empty' && (
        <div className="py-12">
          <p className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>No open Reference issues.</p>
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 text-tea-text-sec`}>Flags added while reading will appear here.</p>
        </div>
      )}

      {state === 'ready' && (
        <div className="space-y-10 py-8">
          {groupOpenReferenceIssues(issues).map(group => (
            <section key={group.pageId}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>
                  {group.pageLabel}{' '}
                  <span className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`}>
                    · {group.issues.length} {group.issues.length === 1 ? 'issue' : 'issues'}
                  </span>
                </h2>
                <a
                  href={group.route}
                  className={`${TYPOGRAPHY_CLASSES.link} min-h-11 py-3 text-tea-text-sec transition-colors hover:text-tea-text`}
                >
                  View public page
                </a>
              </div>
              <div className="divide-y divide-tea-border border-y border-tea-border">
                {group.issues.map(issue => {
                  const selected = selectedIds.has(issue.id);
                  return (
                    <article key={issue.id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] md:gap-8">
                      <label className="flex min-h-11 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => onToggle(issue.id)}
                          className="mt-1 h-4 w-4 accent-tea-gold"
                        />
                        <span>
                          <span className={`${TYPOGRAPHY_CLASSES.label} block text-tea-gold`}>
                            {teaReferenceCategoryLabel(issue.category)}
                          </span>
                          <span className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 block text-tea-text`}>
                            {issue.section_label}
                          </span>
                          <span className={`${TYPOGRAPHY_CLASSES.mono} mt-1 block text-tea-text-dim`}>
                            {formatIssueDate(issue.created_at)}
                          </span>
                        </span>
                      </label>
                      <div className="min-w-0 space-y-4">
                        <div>
                          <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Owner note</p>
                          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 whitespace-pre-wrap break-words text-tea-text`}>{issue.note}</p>
                        </div>
                        <div>
                          <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Public text at flag time</p>
                          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 whitespace-pre-wrap break-words border-l-2 border-tea-border pl-4 text-tea-text-sec`}>
                            {issue.public_text_snapshot}
                          </p>
                        </div>
                        {issue.source_ids.length > 0 && (
                          <p className={`${TYPOGRAPHY_CLASSES.mono} break-words text-tea-text-dim`}>
                            {issue.source_ids.length} cited {issue.source_ids.length === 1 ? 'source' : 'sources'}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {state === 'ready' && (
        <div className="sticky bottom-nav mt-4 border-t border-tea-border bg-tea-bg/95 py-3 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p aria-live="polite" className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`}>
              {selectedCount} selected
            </p>
            <button
              type="button"
              onClick={onResolve}
              disabled={selectedCount === 0 || isResolving}
              className="cta-solid min-h-11 px-5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isResolving ? 'Resolving…' : selectedCount > 0 ? `Resolve ${selectedCount} selected` : 'Resolve selected'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const TeaReferenceIssuesView: React.FC = () => {
  const activeAccountId = useAppStore(state => state.activeAccountId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [actionError, setActionError] = useState('');
  const queryClient = useQueryClient();
  const issuesQuery = useQuery({
    queryKey: ['tea-reference-issues', activeAccountId],
    queryFn: () => api.teaReferenceIssues.list(),
    retry: false,
  });
  const resolveIssues = useMutation({
    mutationFn: (ids: string[]) => api.teaReferenceIssues.resolve(ids),
    onSuccess: response => {
      setActionError('');
      setSelectedIds(current => {
        const next = new Set(current);
        response.resolved_ids.forEach(id => next.delete(id));
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['tea-reference-issues'] });
    },
    onError: () => setActionError('Could not resolve the selected issues. Try again.'),
  });

  const issues = issuesQuery.data?.issues ?? [];
  const state = issuesQuery.isPending
    ? 'loading'
    : issuesQuery.isError
      ? 'error'
      : issues.length === 0
        ? 'empty'
        : 'ready';

  const exportBrief = async () => {
    setIsExporting(true);
    setActionError('');
    try {
      downloadTeaReferenceBrief(await api.teaReferenceIssues.exportBrief());
    } catch {
      setActionError('Could not export the regeneration brief. Try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <TeaReferenceIssuesContent
      state={state}
      issues={issues}
      selectedIds={selectedIds}
      isResolving={resolveIssues.isPending}
      isExporting={isExporting}
      actionError={actionError}
      onToggle={id => setSelectedIds(current => toggleReferenceIssueSelection(current, id))}
      onRetry={() => {
        resolveIssues.reset();
        setActionError('');
        void issuesQuery.refetch();
      }}
      onResolve={() => resolveIssues.mutate([...selectedIds])}
      onExport={() => void exportBrief()}
    />
  );
};

export default TeaReferenceIssuesView;
