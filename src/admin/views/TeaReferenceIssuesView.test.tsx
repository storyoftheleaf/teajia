import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TeaReferenceWisdomSwitch } from './WisdomView';
import type { TeaReferenceIssue } from '../../wisdom/reference/issues';

const SurfaceSwitch = TeaReferenceWisdomSwitch as React.FC<Record<string, unknown>>;

const issues: TeaReferenceIssue[] = [
  {
    id: 'issue-b', account_id: 'account-1', page_id: 'lincang', page_slug: 'lincang',
    route: '/wisdom/region/lincang', section_key: 'scope', section_label: 'Scope',
    category: 'geography_or_hierarchy', note: 'The hierarchy needs checking.',
    public_text_snapshot: 'Current Lincang copy.', source_ids: ['source-2'], status: 'open',
    created_by_user_id: 'owner-1', created_at: '2026-08-10T09:00:00.000Z',
    resolved_by_user_id: null, resolved_at: null,
  },
  {
    id: 'issue-a', account_id: 'account-1', page_id: 'assamica', page_slug: 'assamica',
    route: '/wisdom/family/assamica', section_key: 'character', section_label: 'Character',
    category: 'unclear_writing', note: 'This could be more direct.',
    public_text_snapshot: 'Current assamica copy.', source_ids: ['source-1'], status: 'open',
    created_by_user_id: 'owner-1', created_at: '2026-08-09T09:00:00.000Z',
    resolved_by_user_id: null, resolved_at: null,
  },
  { ...({} as TeaReferenceIssue), id: 'issue-c', account_id: 'account-1', page_id: 'lincang', page_slug: 'lincang', route: '/wisdom/region/lincang', section_key: 'history', section_label: 'History', category: 'wrong_source', note: 'Source mismatch.', public_text_snapshot: 'History copy.', source_ids: ['source-3'], status: 'open', created_by_user_id: 'owner-1', created_at: '2026-08-11T09:00:00.000Z', resolved_by_user_id: null, resolved_at: null },
];

describe('Tea Reference issues integration', () => {
  it('offers Reference issues inside Wisdom only to the platform owner', async () => {
    const module = await import('./WisdomView');
    const isPlatformOwnerRole = (module as Record<string, unknown>).isPlatformOwnerRole as ((role: unknown) => boolean) | undefined;

    expect(isPlatformOwnerRole?.('platform_owner')).toBe(true);
    expect(isPlatformOwnerRole?.('platform_admin')).toBe(false);
    expect(isPlatformOwnerRole?.('owner')).toBe(false);
    expect(isPlatformOwnerRole?.('unknown')).toBe(false);
    expect(isPlatformOwnerRole?.(null)).toBe(false);

    const ownerHtml = renderToStaticMarkup(
      <SurfaceSwitch
        previewEnabled={false}
        isPlatformOwner
        browse={<div>Existing Wisdom base</div>}
        issues={<div>Grouped issue queue</div>}
        review={null}
      />,
    );
    expect(ownerHtml).toContain('Browse base');
    expect(ownerHtml).toContain('Reference issues');
    expect(ownerHtml).toContain('Existing Wisdom base');
    expect(ownerHtml).not.toContain('Review incoming');

    const adminHtml = renderToStaticMarkup(
      <SurfaceSwitch
        previewEnabled={false}
        isPlatformOwner={false}
        browse={<div>Existing Wisdom base</div>}
        issues={<div>Grouped issue queue</div>}
        review={null}
      />,
    );
    expect(adminHtml).toBe('<div>Existing Wisdom base</div>');
  });

  it('keeps private issue queries out of the persisted React Query cache', () => {
    const entrySource = readFileSync(new URL('../../index.tsx', import.meta.url), 'utf8');
    expect(entrySource).toContain("'tea-reference-issues'");
  });

  it('groups the open queue by canonical page in deterministic editorial order', async () => {
    const module = await import('./TeaReferenceIssuesView');
    const groupIssues = (module as any).groupOpenReferenceIssues as ((items: TeaReferenceIssue[]) => Array<{ pageId: string; issues: TeaReferenceIssue[] }>) | undefined;
    expect(groupIssues).toBeTypeOf('function');
    expect(groupIssues?.(issues).map(group => [group.pageId, group.issues.map(issue => issue.id)])).toEqual([
      ['assamica', ['issue-a']],
      ['lincang', ['issue-b', 'issue-c']],
    ]);
  });

  it('renders intentional loading, empty, and error queue states', async () => {
    const module = await import('./TeaReferenceIssuesView');
    const Content = (module as any).TeaReferenceIssuesContent as React.FC<any> | undefined;
    expect(Content).toBeTypeOf('function');
    if (!Content) return;

    const common = { selectedIds: new Set<string>(), isResolving: false, onToggle: () => {}, onRetry: () => {}, onResolve: () => {}, onExport: () => {}, isExporting: false };
    expect(renderToStaticMarkup(<Content {...common} state="loading" issues={[]} />)).toMatch(/Loading reference issues/i);
    expect(renderToStaticMarkup(<Content {...common} state="empty" issues={[]} />)).toMatch(/No open reference issues/i);
    expect(renderToStaticMarkup(<Content {...common} state="empty" issues={[]} actionError="Could not export the regeneration brief." />)).toContain('role="alert"');
    const errorHtml = renderToStaticMarkup(<Content {...common} state="error" issues={[]} />);
    expect(errorHtml).toMatch(/could not load/i);
    expect(errorHtml).toContain('Try again');
  });

  it('renders a low-density grouped queue with selectable rows and no internal ids', async () => {
    const module = await import('./TeaReferenceIssuesView');
    const Content = (module as any).TeaReferenceIssuesContent as React.FC<any> | undefined;
    expect(Content).toBeTypeOf('function');
    if (!Content) return;
    const html = renderToStaticMarkup(
      <Content
        state="ready"
        issues={issues}
        selectedIds={new Set(['issue-b'])}
        isResolving={false}
        isExporting={false}
        onToggle={() => {}}
        onRetry={() => {}}
        onResolve={() => {}}
        onExport={() => {}}
      />,
    );
    expect(html).toContain('Assamica');
    expect(html).toContain('Lincang');
    expect(html).toContain('Geography or hierarchy');
    expect(html).toContain('The hierarchy needs checking.');
    expect(html).toContain('Current Lincang copy.');
    expect(html).toContain('1 selected');
    expect(html).not.toContain('issue-b');
    expect(html).not.toContain('source-2');
    expect(html).toContain('1 cited source');
    expect(html).toContain('Export regeneration brief');
    expect(html).toContain('Resolve 1 selected');
    expect(html).toContain('divide-y');
  });

  it('updates selection without mutating the previous set', async () => {
    const module = await import('./TeaReferenceIssuesView');
    const toggle = (module as any).toggleReferenceIssueSelection as ((selected: Set<string>, id: string) => Set<string>) | undefined;
    expect(toggle).toBeTypeOf('function');
    const original = new Set(['issue-a']);
    const added = toggle?.(original, 'issue-b');
    expect([...original]).toEqual(['issue-a']);
    expect([...(added ?? [])]).toEqual(['issue-a', 'issue-b']);
    expect([...(toggle?.(added ?? new Set(), 'issue-a') ?? [])]).toEqual(['issue-b']);
  });
});
