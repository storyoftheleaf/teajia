import { API_URL, ApiError, fetchWithTimeout, getTokenClaims } from '../../../lib/api';
import { useAppStore } from '../../../lib/store';

export const WISDOM_NODE_TYPES = [
  'cultivar',
  'region',
  'tea_type',
  'producer',
  'mark',
  'style',
  'named_tea',
] as const;

export type WisdomNodeType = typeof WISDOM_NODE_TYPES[number];
export type WisdomTargetType = 'article' | 'tea_profile' | 'wisdom_node' | 'product_tasting' | 'promoted_tasting_note';
export type WisdomRelationshipKind = 'supports' | 'illustrates' | 'mentions' | 'is_example_of';
export type WisdomReviewStatus = 'proposed' | 'approved' | 'rejected';
export type WisdomTargetState = 'public' | 'unpublished' | 'missing' | 'unknown';

export interface WisdomNodeIdentity {
  nodeType: WisdomNodeType;
  nodeId: string;
}

export interface WisdomNodeOverride {
  node_type: WisdomNodeType;
  node_id: string;
  editorial_status: 'draft' | 'review' | 'approved';
  public_state: 'inherit' | 'public' | 'hidden';
  editor_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
}

export interface WisdomRelation {
  id: string;
  node_type: WisdomNodeType;
  node_id: string;
  target_type: WisdomTargetType;
  target_id: string;
  target_subtype: WisdomNodeType | null;
  relationship_kind: WisdomRelationshipKind;
  source: string;
  review_status: WisdomReviewStatus;
  target_state: WisdomTargetState;
  target_label: string | null;
  target_href: string | null;
  account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WisdomRelationWrite {
  node_type: WisdomNodeType;
  node_id: string;
  target_type: WisdomTargetType;
  target_id: string;
  target_subtype?: WisdomNodeType | null;
  relationship_kind: WisdomRelationshipKind;
  source?: string;
  review_status?: WisdomReviewStatus;
  account_id?: string | null;
}

export type WisdomFindingCode =
  | 'missing_supporting_writing'
  | 'missing_visible_tea'
  | 'missing_target'
  | 'unpublished_dependency'
  | 'orphaned_article'
  | 'ambiguous_product'
  | 'hidden_public_dependency'
  | 'unmappable_article_product';

export interface WisdomIntegrityFinding {
  id: string;
  code: WisdomFindingCode;
  node_type: WisdomNodeType | null;
  node_id: string | null;
  title: string;
  detail: string;
  severity: 'attention' | 'broken';
  target_type?: WisdomTargetType | null;
  target_id?: string | null;
  href?: string | null;
}

export interface PublicWisdomWriting {
  id: string;
  title: string;
  href: string;
  excerpt?: string | null;
  author_name?: string | null;
}

export interface PublicWisdomTea {
  id: string;
  name: string;
  href: string | null;
  image_url?: string | null;
  detail?: string | null;
}

export interface PublicWisdomRelated {
  public_state?: 'inherit' | 'public' | 'hidden';
  writings: PublicWisdomWriting[];
  teas: PublicWisdomTea[];
}

export interface PublicWisdomState {
  public_state: 'inherit' | 'public' | 'hidden';
  is_public: boolean;
}

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const asNullableString = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;

const normalizeRelation = (value: unknown): WisdomRelation => {
  const row = asRecord(value);
  return {
    id: String(row.id ?? ''),
    node_type: row.node_type as WisdomNodeType,
    node_id: String(row.node_id ?? ''),
    target_type: row.target_type as WisdomTargetType,
    target_id: String(row.target_id ?? ''),
    target_subtype: asNullableString(row.target_subtype) as WisdomNodeType | null,
    relationship_kind: row.relationship_kind as WisdomRelationshipKind,
    source: String(row.source ?? 'manual'),
    review_status: row.review_status as WisdomReviewStatus,
    target_state: ['public', 'unpublished', 'missing'].includes(String(row.target_state)) ? row.target_state as WisdomTargetState : 'unknown',
    target_label: asNullableString(row.target_label),
    target_href: asNullableString(row.target_href),
    account_id: asNullableString(row.account_id),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
};

const FINDING_COPY: Record<string, { code: WisdomFindingCode; title: string; severity: WisdomIntegrityFinding['severity'] }> = {
  missing_writing: { code: 'missing_supporting_writing', title: 'Node lacks supporting writing', severity: 'attention' },
  missing_supporting_writing: { code: 'missing_supporting_writing', title: 'Node lacks supporting writing', severity: 'attention' },
  missing_target: { code: 'missing_target', title: 'Relation target is missing', severity: 'broken' },
  unpublished_dependency: { code: 'unpublished_dependency', title: 'Relation points to unpublished material', severity: 'attention' },
  orphaned_article: { code: 'orphaned_article', title: 'Published article is structurally orphaned', severity: 'attention' },
  missing_visible_tea: { code: 'missing_visible_tea', title: 'Node lacks a visible tea example', severity: 'attention' },
  ambiguous_product: { code: 'ambiguous_product', title: 'Product maps to more than one canonical tea', severity: 'attention' },
  hidden_public_dependency: { code: 'hidden_public_dependency', title: 'Public material depends on a hidden node', severity: 'broken' },
  unmappable_article_product: { code: 'unmappable_article_product', title: 'Article product link cannot reach a canonical tea', severity: 'attention' },
};

const normalizeFinding = (value: unknown): WisdomIntegrityFinding => {
  const row = asRecord(value);
  const rawCode = String(row.code ?? row.kind ?? 'missing_target');
  const copy = FINDING_COPY[rawCode] ?? { code: rawCode as WisdomFindingCode, title: String(row.title ?? 'Wisdom relationship needs review'), severity: row.severity === 'broken' ? 'broken' as const : 'attention' as const };
  const nodeType = asNullableString(row.node_type) as WisdomNodeType | null;
  const nodeId = asNullableString(row.node_id);
  const targetId = asNullableString(row.target_id);
  return {
    id: asNullableString(row.id) ?? [rawCode, nodeType, nodeId, targetId].filter(Boolean).join(':'),
    code: copy.code,
    node_type: nodeType,
    node_id: nodeId,
    title: asNullableString(row.title) ?? copy.title,
    detail: asNullableString(row.detail) ?? [nodeType && nodeId ? `${nodeType}:${nodeId}` : null, targetId ? `Target ${targetId}` : null].filter(Boolean).join(' · '),
    severity: row.severity === 'broken' || row.severity === 'attention' ? row.severity : copy.severity,
    target_type: asNullableString(row.target_type) as WisdomIntegrityFinding['target_type'],
    target_id: targetId,
    href: asNullableString(row.href),
  };
};

const normalizePublicRelated = (value: unknown): PublicWisdomRelated => {
  const body = asRecord(value);
  const writings = Array.isArray(body.writings) ? body.writings.map(item => {
    const row = asRecord(item);
    const slug = asNullableString(row.slug);
    return {
      id: asNullableString(row.id) ?? slug ?? '',
      title: String(row.title ?? ''),
      href: asNullableString(row.href) ?? `/article/${encodeURIComponent(slug ?? '')}`,
      excerpt: asNullableString(row.excerpt) ?? asNullableString(row.subtitle),
      author_name: asNullableString(row.author_name),
    };
  }) : [];
  const teas = Array.isArray(body.teas) ? body.teas.map(item => {
    const row = asRecord(item);
    const detail = [asNullableString(row.detail), asNullableString(row.type), asNullableString(row.origin_region)]
      .filter((part, index, all) => Boolean(part) && all.indexOf(part) === index).join(' · ') || null;
    return {
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      href: asNullableString(row.href),
      image_url: asNullableString(row.image_url),
      detail,
    };
  }) : [];
  const publicState = ['inherit', 'public', 'hidden'].includes(String(body.public_state))
    ? body.public_state as PublicWisdomRelated['public_state']
    : undefined;
  return { ...(publicState ? { public_state: publicState } : {}), writings, teas };
};

type Request = (path: string, init?: RequestInit, authenticated?: boolean) => Promise<unknown>;

const storedToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('teajia_token') || sessionStorage.getItem('teajia_token');
  } catch {
    return null;
  }
};

const request: Request = async (path, init = {}, authenticated = true) => {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (authenticated) {
    const token = storedToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const claimAccount = getTokenClaims()?.active_account_id;
    const accountId = typeof claimAccount === 'string' ? claimAccount : useAppStore.getState().activeAccountId;
    if (accountId) headers.set('X-Teajia-Account', accountId);
  }
  const response = await fetchWithTimeout(`${API_URL}${path}`, { ...init, headers });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(`Request failed (${response.status})`, response.status);
  }
  if (!response.ok) {
    const body = data as { error?: unknown };
    throw new ApiError(typeof body?.error === 'string' ? body.error : `Request failed (${response.status})`, response.status);
  }
  return data;
};

export const createWisdomRelationsApi = (send: Request = request) => ({
  relations: async (identity: WisdomNodeIdentity): Promise<{ relations: WisdomRelation[]; override: WisdomNodeOverride | null }> => {
    const data = await send(`/api/admin/wisdom/relations?node_type=${encodeURIComponent(identity.nodeType)}&node_id=${encodeURIComponent(identity.nodeId)}`) as { relations?: unknown[]; override?: WisdomNodeOverride | null };
    return { relations: (data.relations ?? []).map(normalizeRelation), override: data.override ?? null };
  },
  createRelation: async (write: WisdomRelationWrite): Promise<WisdomRelation> => {
    const data = await send('/api/admin/wisdom/relations', { method: 'POST', body: JSON.stringify(write) }) as { relation: WisdomRelation };
    return normalizeRelation(data.relation);
  },
  updateRelation: async (id: string, patch: Partial<WisdomRelationWrite>): Promise<WisdomRelation> => {
    const data = await send(`/api/admin/wisdom/relations/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) }) as { relation: WisdomRelation };
    return normalizeRelation(data.relation);
  },
  deleteRelation: async (id: string): Promise<void> => {
    await send(`/api/admin/wisdom/relations/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  updateOverride: async (identity: WisdomNodeIdentity, patch: Partial<Pick<WisdomNodeOverride, 'editorial_status' | 'public_state' | 'editor_note'>>): Promise<WisdomNodeOverride> => {
    const data = await send(`/api/admin/wisdom/nodes/${encodeURIComponent(identity.nodeType)}/${encodeURIComponent(identity.nodeId)}`, { method: 'PUT', body: JSON.stringify(patch) }) as { override: WisdomNodeOverride };
    return data.override;
  },
  findings: async (): Promise<WisdomIntegrityFinding[]> => {
    const data = await send('/api/admin/wisdom/findings') as { findings: WisdomIntegrityFinding[] };
    return data.findings.map(normalizeFinding);
  },
  publicRelated: async (identity: WisdomNodeIdentity): Promise<PublicWisdomRelated> =>
    normalizePublicRelated(await send(`/api/public/wisdom/${encodeURIComponent(identity.nodeType)}/${encodeURIComponent(identity.nodeId)}/related`, {}, false)),
  publicState: async (identity: WisdomNodeIdentity): Promise<PublicWisdomState> => {
    const data = asRecord(await send(`/api/public/wisdom/${encodeURIComponent(identity.nodeType)}/${encodeURIComponent(identity.nodeId)}/state`, {}, false));
    const publicState = ['inherit', 'public', 'hidden'].includes(String(data.public_state))
      ? data.public_state as PublicWisdomState['public_state']
      : 'inherit';
    return { public_state: publicState, is_public: data.is_public !== false && publicState !== 'hidden' };
  },
});

export const wisdomRelationsApi = createWisdomRelationsApi();
