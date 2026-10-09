// A Read story is published, or taken back down, from the story itself
// (migration 0030). The rules, kept apart from the handlers so a test can pin
// them without standing up a request; the reads and writes live in index.ts.
//
// Who may press the button is the same question src/pages/read/publishGate.ts
// asks before it shows a draft: the Teajia magazine's own people, never any
// shop's owner. The browser's answer is a convenience; this one is the gate,
// and it reads the database rather than the token, so a demotion takes effect
// on the next press instead of when the token expires.

import { isCuratedReadPath, type ReadPublishOverrides, type ReadPublishState } from '../../src/pages/read/articleLive';

export type ReadEditorMembership = {
  role: 'owner' | 'staff' | 'viewer';
  account_kind?: string;
  is_platform_account?: boolean;
  bundles?: readonly string[];
};

/**
 * May this person publish and unpublish Read stories.
 *
 * Platform owner and platform admin: yes, they act as owner everywhere. Anyone
 * else needs a membership on Teajia's own account (the platform account): its
 * owner, or its staff holding the `publish` bundle, the bundle the admin
 * already requires for editorial work. A curator who owns their own shop owns
 * an account, but not this one, so the answer for them is no: the over-grant
 * publishGate.ts closed on the read side must not reopen on the write side.
 */
export function mayEditReadMagazine(input: {
  platformRole: string | null;
  memberships: readonly ReadEditorMembership[];
}): boolean {
  if (input.platformRole === 'platform_owner' || input.platformRole === 'platform_admin') return true;
  return input.memberships.some((m) => {
    const onPlatformAccount = m.account_kind === 'platform' || m.is_platform_account === true;
    if (!onPlatformAccount) return false;
    if (m.role === 'owner') return true;
    return m.role === 'staff' && Array.isArray(m.bundles) && m.bundles.includes('publish');
  });
}

export type ReadPublishRequest = { path: string; state: ReadPublishState };

/**
 * The body of a publish or unpublish: one curated path and the state it should
 * take. A path the curated map does not list is refused by name, so a typo
 * cannot store a row nobody will ever read, and no row can make public a route
 * the map has never heard of.
 */
export function parseReadPublishRequest(body: unknown): ReadPublishRequest | { error: string; code: string } {
  if (!body || typeof body !== 'object') return { error: 'Send a path and a state.', code: 'read_publish_body' };
  const { path, state } = body as { path?: unknown; state?: unknown };
  if (typeof path !== 'string' || !path) return { error: 'Send the story\'s path, for example /read/ritual.', code: 'read_publish_path' };
  if (state !== 'live' && state !== 'draft') return { error: 'The state is live or draft.', code: 'read_publish_state' };
  const clean = path.replace(/\/+$/, '');
  if (!isCuratedReadPath(clean)) return { error: `${clean} is not one of the Read stories.`, code: 'read_publish_unknown_path' };
  return { path: clean, state };
}

/** Stored rows as the map the gate reads, dropping anything the map does not curate. */
export function publishStatesFromRows(rows: readonly { path: unknown; state: unknown }[]): ReadPublishOverrides {
  const out: Record<string, ReadPublishState> = {};
  for (const row of rows) {
    if (typeof row.path !== 'string' || !isCuratedReadPath(row.path)) continue;
    if (row.state === 'live' || row.state === 'draft') out[row.path] = row.state;
  }
  return out;
}
