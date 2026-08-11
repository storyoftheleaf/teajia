import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Link2, Loader2, Plus, X } from 'lucide-react';
import { Modal } from '../../../components/shared/Modal';
import { api } from '../../../lib/api';
import { WISDOM_TYPE } from './config';
import {
  wisdomRelationsApi,
  type WisdomIntegrityFinding,
  type WisdomNodeIdentity,
  type WisdomNodeOverride,
  type WisdomNodeType,
  type WisdomRelation,
  type WisdomRelationshipKind,
  type WisdomReviewStatus,
  type WisdomTargetType,
} from './relationsApi';

export type {
  WisdomIntegrityFinding,
  WisdomNodeIdentity,
  WisdomNodeOverride,
  WisdomNodeType,
  WisdomRelation,
} from './relationsApi';

const HOLDING_NODE_TYPES: Record<string, WisdomNodeType> = {
  cultivars: 'cultivar',
  regions: 'region',
  varieties: 'tea_type',
  producers: 'producer',
  marks: 'mark',
  styles: 'style',
  'named-teas': 'named_tea',
};

const NODE_TYPE_HOLDINGS: Record<WisdomNodeType, string> = Object.fromEntries(
  Object.entries(HOLDING_NODE_TYPES).map(([holding, type]) => [type, holding]),
) as Record<WisdomNodeType, string>;

export const nodeTypeForHolding = (holdingId: string): WisdomNodeType => {
  const nodeType = HOLDING_NODE_TYPES[holdingId];
  if (!nodeType) throw new Error(`Unknown Wisdom holding: ${holdingId}`);
  return nodeType;
};

export const holdingIdForNodeType = (nodeType: WisdomNodeType): string => NODE_TYPE_HOLDINGS[nodeType];

export type WisdomRelationDisplayState = 'approved' | 'proposed' | 'broken' | 'rejected';

export const relationDisplayState = (relation: WisdomRelation): WisdomRelationDisplayState => {
  if (relation.target_state === 'missing') return 'broken';
  if (relation.review_status === 'approved') return 'approved';
  if (relation.review_status === 'rejected') return 'rejected';
  return 'proposed';
};

const LEGAL_RELATIONSHIPS: Record<WisdomTargetType, readonly WisdomRelationshipKind[]> = {
  article: ['supports', 'mentions'],
  tea_profile: ['illustrates', 'mentions', 'is_example_of'],
  wisdom_node: ['supports', 'illustrates', 'mentions', 'is_example_of'],
  product_tasting: ['supports', 'illustrates'],
  promoted_tasting_note: ['supports', 'illustrates'],
};

export const legalRelationshipKinds = (targetType: WisdomTargetType): readonly WisdomRelationshipKind[] =>
  LEGAL_RELATIONSHIPS[targetType];

export type RelationTargetOption = { id: string; label: string; subtype?: WisdomNodeType };

export const filterRelationTargetOptions = (options: RelationTargetOption[], query: string, subtype?: WisdomNodeType): RelationTargetOption[] => {
  const normalized = query.trim().toLowerCase();
  const scoped = subtype ? options.filter(option => !option.subtype || option.subtype === subtype) : options;
  if (!normalized) return scoped.slice(0, 8);
  return scoped.filter(option => option.label.toLowerCase().includes(normalized) || option.id.toLowerCase().includes(normalized)).slice(0, 8);
};

export const relationTargetGuidance = (targetType: WisdomTargetType): string => {
  if (targetType === 'tea_profile') return 'Open Catalog to find the canonical tea profile. Only profiles available to this account appear in name search.';
  if (targetType === 'promoted_tasting_note') return 'Promote a private note in the tasting-note review queue before linking it here.';
  return 'Name search is not available for this target type yet.';
};

export const findingResolution = (finding: Pick<WisdomIntegrityFinding, 'node_type' | 'node_id' | 'href'>):
  { kind: 'node' } | { kind: 'link'; href: string } | { kind: 'manual' } => {
  if (finding.node_type && finding.node_id) return { kind: 'node' };
  if (finding.href) return { kind: 'link', href: finding.href };
  return { kind: 'manual' };
};

export const findingAdminHref = (finding: Pick<WisdomIntegrityFinding, 'target_type' | 'target_id' | 'href'>): string => {
  if (finding.target_type === 'article') return '/admin/magazine';
  if (finding.target_type === 'tea_profile') return '/admin/catalog';
  if (finding.target_type === 'product_tasting' && finding.target_id) return `/admin/stock?panel=${encodeURIComponent(finding.target_id)}`;
  if (finding.target_type === 'promoted_tasting_note') return '/admin/wisdom?review=integrity';
  if (finding.href?.startsWith('/admin/')) return finding.href;
  return '/admin/wisdom?review=integrity';
};

const STATE_LABEL: Record<WisdomRelationDisplayState, string> = {
  approved: 'Approved',
  proposed: 'Proposed',
  broken: 'Broken',
  rejected: 'Rejected',
};

const targetLabel = (type: WisdomTargetType): string => ({
  article: 'Writing',
  tea_profile: 'Tea',
  wisdom_node: 'Wisdom node',
  product_tasting: 'Product tasting',
  promoted_tasting_note: 'Promoted note',
})[type];

const statusClass = (state: WisdomRelationDisplayState) =>
  state === 'approved'
    ? 'text-tea-gold'
    : state === 'broken'
      ? 'text-tea-text'
      : 'text-tea-text-sec';

interface ViewProps {
  identity: WisdomNodeIdentity;
  relations: WisdomRelation[];
  override: WisdomNodeOverride | null;
  canEdit: boolean;
  canApprove?: boolean;
  busyId?: string | null;
  onReview?: (relation: WisdomRelation, status: WisdomReviewStatus) => void;
  onDelete?: (relation: WisdomRelation) => void;
  onAdd?: () => void;
  onOverrideChange?: (patch: Partial<Pick<WisdomNodeOverride, 'editorial_status' | 'public_state'>>) => void;
}

export const WisdomRelationsPanelView: React.FC<ViewProps> = ({
  identity,
  relations,
  override,
  canEdit,
  canApprove = false,
  busyId,
  onReview,
  onDelete,
  onAdd,
  onOverrideChange,
}) => (
  <section className="mt-8 border-t border-tea-border pt-6" data-testid="wisdom-relations-panel">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className={WISDOM_TYPE.label}>Supporting material</p>
        <p className="mt-1 text-ui-12 text-tea-text-dim">
          <span className="font-mono">{identity.nodeType}:{identity.nodeId}</span>
          {' · '}Only approved public targets appear in the reference.
        </p>
      </div>
      {canEdit && onAdd && (
        <button type="button" onClick={onAdd} className="tap-target inline-flex items-center gap-1.5 text-ui-12 text-tea-gold hover:text-tea-gold-lt">
          <Plus size={14} aria-hidden="true" /> Add relation
        </button>
      )}
    </div>

    {canEdit && !canApprove && relations.some(item => item.review_status === 'proposed') && (
      <p className="mt-3 rounded-md border border-tea-border bg-tea-accent-sub px-3 py-2 text-ui-11 leading-relaxed text-tea-text-sec">
        Proposed links are waiting for platform editorial review. They are not public until approved.
      </p>
    )}
    {canApprove && relations.some(item => item.review_status === 'proposed') && (
      <p className="mt-3 rounded-md border border-tea-border bg-tea-accent-sub px-3 py-2 text-ui-11 leading-relaxed text-tea-text-sec">
        Editorial review is ready here. Approve a supported link or leave it proposed for another reviewer.
      </p>
    )}

    {canApprove && onOverrideChange && (
      <div className="mt-4 flex flex-wrap gap-3 rounded-md border border-tea-border bg-tea-surface p-3">
        <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-ui-12 text-tea-text-sec">
          <span className="shrink-0">Editorial</span>
          <select
            aria-label="Editorial status"
            value={override?.editorial_status ?? 'draft'}
            onChange={event => onOverrideChange({ editorial_status: event.target.value as WisdomNodeOverride['editorial_status'] })}
            className="min-h-[44px] min-w-0 flex-1 rounded-md border border-tea-border bg-tea-bg px-2 text-ui-12 text-tea-text focus:border-tea-gold focus:outline-none"
          >
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="approved">Approved</option>
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-ui-12 text-tea-text-sec">
          <span className="shrink-0">Public</span>
          <select
            aria-label="Public state"
            value={override?.public_state ?? 'inherit'}
            onChange={event => onOverrideChange({ public_state: event.target.value as WisdomNodeOverride['public_state'] })}
            className="min-h-[44px] min-w-0 flex-1 rounded-md border border-tea-border bg-tea-bg px-2 text-ui-12 text-tea-text focus:border-tea-gold focus:outline-none"
          >
            <option value="inherit">Inherit</option>
            <option value="public">Public</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
      </div>
    )}

    {relations.length === 0 ? (
      <p className="mt-4 text-ui-12 text-tea-text-dim">No structured supporting material is linked yet.</p>
    ) : (
      <ul className="mt-4 divide-y divide-tea-border rounded-md border border-tea-border bg-tea-surface px-3">
        {relations.map(item => {
          const state = relationDisplayState(item);
          const busy = busyId === item.id;
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <span className={`shrink-0 text-ui-10 font-medium uppercase tracking-[0.08em] ${statusClass(state)}`}>
                {STATE_LABEL[state]}
              </span>
              <span className="text-ui-10 uppercase tracking-[0.08em] text-tea-text-dim">{targetLabel(item.target_type)}</span>
              <div className="min-w-0 flex-1 basis-48">
                {item.target_href && item.target_state !== 'missing' ? (
                  <a href={item.target_href} target="_blank" rel="noreferrer" className="text-ui-12 text-tea-gold hover:text-tea-gold-lt">
                    {item.target_label || item.target_id}
                  </a>
                ) : (
                  <p className="break-words text-ui-12 text-tea-text-sec">{item.target_label || item.target_id}</p>
                )}
                <p className="mt-0.5 text-ui-11 text-tea-text-dim">{item.relationship_kind.replace(/_/g, ' ')}</p>
              </div>
              {canApprove && state !== 'broken' && state !== 'approved' && onReview && (
                <button type="button" disabled={busy} onClick={() => onReview(item, 'approved')} className="tap-target inline-flex items-center gap-1 text-ui-11 text-tea-gold hover:text-tea-gold-lt disabled:opacity-50">
                  <Check size={13} aria-hidden="true" /> Approve
                </button>
              )}
              {canApprove && state === 'approved' && onReview && (
                <button type="button" disabled={busy} onClick={() => onReview(item, 'proposed')} className="tap-target text-ui-11 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Return to review</button>
              )}
              {canEdit && item.account_id && onDelete && (
                <button type="button" disabled={busy} onClick={() => onDelete(item)} aria-label={`Remove relation to ${item.target_label || item.target_id}`} className="tap-target p-2 text-tea-text-sec hover:text-tea-text disabled:opacity-50">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} aria-hidden="true" />}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

interface EditorProps {
  identity: WisdomNodeIdentity;
  onCancel: () => void;
  onSave: (write: { target_type: WisdomTargetType; target_id: string; target_subtype: WisdomNodeType | null; relationship_kind: WisdomRelationshipKind }) => void;
  pending: boolean;
  targetOptions?: Partial<Record<WisdomTargetType, RelationTargetOption[]>>;
}

const RelationEditor: React.FC<EditorProps> = ({ identity, onCancel, onSave, pending, targetOptions = {} }) => {
  const [targetType, setTargetType] = useState<WisdomTargetType>('article');
  const [targetId, setTargetId] = useState('');
  const [targetSubtype, setTargetSubtype] = useState<WisdomNodeType>('cultivar');
  const [kind, setKind] = useState<WisdomRelationshipKind>('supports');
  const [targetQuery, setTargetQuery] = useState('');
  const kinds = legalRelationshipKinds(targetType);
  const changeTargetType = (next: WisdomTargetType) => {
    setTargetType(next);
    setKind(legalRelationshipKinds(next)[0]);
    setTargetId('');
    setTargetQuery('');
  };
  const options = targetOptions[targetType] ?? [];
  const activeSubtype = targetType === 'wisdom_node' ? targetSubtype : undefined;
  const matchingOptions = filterRelationTargetOptions(options, targetQuery, activeSubtype);
  const selectedOption = options.find(option => option.id === targetId && (!activeSubtype || !option.subtype || option.subtype === activeSubtype));
  return (
    <div className="mt-4 rounded-md border border-tea-border bg-tea-surface p-3" data-testid="wisdom-relation-editor">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-ui-11 text-tea-text-dim">
          <span>Target type</span>
          <select value={targetType} onChange={event => changeTargetType(event.target.value as WisdomTargetType)} className="min-h-[44px] w-full rounded-md border border-tea-border bg-tea-bg px-2 text-ui-12 text-tea-text focus:border-tea-gold focus:outline-none">
            <option value="article">Writing</option>
            <option value="tea_profile">Tea profile</option>
            <option value="wisdom_node">Wisdom node</option>
            <option value="product_tasting">Product tasting</option>
            <option value="promoted_tasting_note">Promoted tasting note</option>
          </select>
        </label>
        <label className="space-y-1 text-ui-11 text-tea-text-dim">
          <span>Relationship</span>
          <select value={kind} onChange={event => setKind(event.target.value as WisdomRelationshipKind)} className="min-h-[44px] w-full rounded-md border border-tea-border bg-tea-bg px-2 text-ui-12 text-tea-text focus:border-tea-gold focus:outline-none">
            {kinds.map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        {targetType === 'wisdom_node' && (
          <label className="space-y-1 text-ui-11 text-tea-text-dim">
            <span>Node type</span>
            <select value={targetSubtype} onChange={event => { setTargetSubtype(event.target.value as WisdomNodeType); setTargetId(''); setTargetQuery(''); }} className="min-h-[44px] w-full rounded-md border border-tea-border bg-tea-bg px-2 text-ui-12 text-tea-text focus:border-tea-gold focus:outline-none">
              {Object.values(HOLDING_NODE_TYPES).map(nodeType => <option key={nodeType} value={nodeType}>{nodeType.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
        )}
        {options.length > 0 ? (
          <div className="space-y-1 text-ui-11 text-tea-text-dim sm:col-span-2">
            <label htmlFor="wisdom-target-search">Find target by name</label>
            <input id="wisdom-target-search" value={targetQuery} onChange={event => { setTargetQuery(event.target.value); setTargetId(''); }} placeholder={`Search ${targetLabel(targetType).toLowerCase()}s`} className="min-h-[44px] w-full rounded-md border border-tea-border bg-tea-bg px-3 text-ui-12 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none" />
            {selectedOption ? (
              <p className="pt-1 text-ui-11 text-tea-text-sec">Selected: <span className="text-tea-text">{selectedOption.label}</span></p>
            ) : targetQuery.trim() && (
              <ul className="max-h-48 overflow-y-auto rounded-md border border-tea-border bg-tea-elevated p-1">
                {matchingOptions.map(option => (
                  <li key={option.id}>
                    <button type="button" onClick={() => { setTargetId(option.id); if (option.subtype) setTargetSubtype(option.subtype); setTargetQuery(option.label); }} className="tap-target w-full rounded-md px-2 py-2 text-left text-ui-12 text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text">
                      <span className="block text-tea-text">{option.label}</span>
                      <span className="block font-mono text-ui-10 text-tea-text-dim">{option.id}</span>
                    </button>
                  </li>
                ))}
                {matchingOptions.length === 0 && <li className="px-2 py-3 text-ui-11 text-tea-text-dim">No matching target.</li>}
              </ul>
            )}
          </div>
        ) : (
          <label className="space-y-1 text-ui-11 text-tea-text-dim">
            <span>Stable target ID</span>
            <input value={targetId} onChange={event => setTargetId(event.target.value)} placeholder="Stable target ID" className="min-h-[44px] w-full rounded-md border border-tea-border bg-tea-bg px-3 text-ui-12 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none" />
            <span className="block text-ui-10">{relationTargetGuidance(targetType)}</span>
            {targetType === 'tea_profile' && <a href="/admin/catalog" className="tap-target inline-block pt-1 text-ui-11 text-tea-gold hover:text-tea-gold-lt">Open Catalog</a>}
          </label>
        )}
      </div>
      <p className="mt-3 text-ui-11 text-tea-text-dim">New links from {identity.nodeType}:{identity.nodeId} enter review before they can appear publicly.</p>
      <div className="mt-3 flex justify-between gap-3">
        <button type="button" onClick={onCancel} disabled={pending} className="tap-target text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Cancel</button>
        <button type="button" onClick={() => onSave({ target_type: targetType, target_id: targetId.trim(), target_subtype: targetType === 'wisdom_node' ? targetSubtype : null, relationship_kind: kind })} disabled={pending || !targetId.trim()} className="tap-target rounded-md cta-solid px-3 py-2 text-ui-12 disabled:opacity-50">Propose relation</button>
      </div>
    </div>
  );
};

export const WisdomRelationsPanel: React.FC<{ identity: WisdomNodeIdentity; canEdit: boolean; canApprove: boolean; targetOptions?: Partial<Record<WisdomTargetType, RelationTargetOption[]>> }> = ({ identity, canEdit, canApprove, targetOptions = {} }) => {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = ['wisdom-relations', identity.nodeType, identity.nodeId] as const;
  const query = useQuery({ queryKey: key, queryFn: () => wisdomRelationsApi.relations(identity) });
  const articleQuery = useQuery({ queryKey: ['admin-articles', 'wisdom-relation-picker'], queryFn: () => api.articles.list(), enabled: editing });
  const teaProfileQuery = useQuery({ queryKey: ['network-catalog', 'wisdom-relation-picker'], queryFn: () => api.network.catalog(), enabled: editing });
  const promotedNoteQuery = useQuery({ queryKey: ['tasting-note-candidates', 'promoted', 'wisdom-relation-picker'], queryFn: () => api.tastingNoteCandidates.list('promoted'), enabled: editing });
  const promotedNotes = Array.isArray(promotedNoteQuery.data) ? promotedNoteQuery.data : [];
  const resolvedTargetOptions = useMemo(() => ({
    ...targetOptions,
    article: (articleQuery.data ?? []).map(article => ({ id: article.id, label: article.title })),
    tea_profile: (teaProfileQuery.data?.profiles ?? []).map(profile => ({ id: profile.id, label: profile.name })),
    promoted_tasting_note: promotedNotes.map((candidate: Record<string, any>) => ({
      id: String(candidate.id),
      label: String(candidate.finalText || candidate.sourceText || candidate.edited_text || candidate.source_text || candidate.id).slice(0, 100),
    })),
  }), [targetOptions, articleQuery.data, teaProfileQuery.data, promotedNotes]);
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const create = useMutation({
    mutationFn: (write: Parameters<EditorProps['onSave']>[0]) => wisdomRelationsApi.createRelation({ ...write, ...{ node_type: identity.nodeType, node_id: identity.nodeId }, source: 'manual', review_status: 'proposed' }),
    onSuccess: () => { setEditing(false); setError(null); void refresh(); },
    onError: cause => setError(cause instanceof Error ? cause.message : 'Could not create this relation.'),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WisdomReviewStatus }) => wisdomRelationsApi.updateRelation(id, { review_status: status }),
    onSuccess: () => { setError(null); void refresh(); },
    onError: cause => setError(cause instanceof Error ? cause.message : 'Could not update this relation.'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => wisdomRelationsApi.deleteRelation(id),
    onSuccess: () => { setError(null); void refresh(); },
    onError: cause => setError(cause instanceof Error ? cause.message : 'Could not remove this relation.'),
  });
  const changeOverride = useMutation({
    mutationFn: (patch: Partial<Pick<WisdomNodeOverride, 'editorial_status' | 'public_state'>>) => wisdomRelationsApi.updateOverride(identity, patch),
    onSuccess: () => { setError(null); void refresh(); },
    onError: cause => setError(cause instanceof Error ? cause.message : 'Could not update this node.'),
  });

  if (query.isLoading) return <div className="mt-8 flex items-center gap-2 border-t border-tea-border pt-6 text-ui-12 text-tea-text-sec"><Loader2 size={14} className="animate-spin" /> Loading supporting material…</div>;
  if (query.isError) return <div role="alert" className="mt-8 border-t border-tea-border pt-6"><p className="text-ui-12 text-tea-text-sec">Could not load supporting material.</p><button type="button" onClick={() => void query.refetch()} className="tap-target mt-2 text-ui-12 text-tea-gold hover:text-tea-gold-lt">Try again</button></div>;

  return (
    <>
      <WisdomRelationsPanelView
        identity={identity}
        relations={query.data?.relations ?? []}
        override={query.data?.override ?? null}
        canEdit={canEdit}
        canApprove={canApprove}
        busyId={update.variables?.id ?? remove.variables ?? null}
        onAdd={() => setEditing(true)}
        onReview={(relation, status) => update.mutate({ id: relation.id, status })}
        onDelete={relation => {
          if (window.confirm(`Remove the relation to ${relation.target_label || relation.target_id}?`)) remove.mutate(relation.id);
        }}
        onOverrideChange={patch => changeOverride.mutate(patch)}
      />
      {editing && <RelationEditor identity={identity} onCancel={() => setEditing(false)} onSave={write => create.mutate(write)} pending={create.isPending} targetOptions={resolvedTargetOptions} />}
      {error && <p role="alert" className="mt-2 text-ui-11 text-tea-text-sec">{error}</p>}
    </>
  );
};

interface QueueProps {
  isOpen: boolean;
  selectedFindingId?: string | null;
  onClose: () => void;
  onSelectFinding: (finding: WisdomIntegrityFinding) => void;
}

export const WisdomIntegrityQueue: React.FC<QueueProps> = ({ isOpen, selectedFindingId, onClose, onSelectFinding }) => {
  const query = useQuery({ queryKey: ['wisdom-findings'], queryFn: wisdomRelationsApi.findings, enabled: isOpen });
  const findings = query.data ?? [];
  const grouped = useMemo(() => ({ broken: findings.filter(item => item.severity === 'broken'), attention: findings.filter(item => item.severity === 'attention') }), [findings]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="panel" ariaLabel="Wisdom integrity findings">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-nav-gap sm:px-6">
        <div className="mx-auto max-w-4xl pb-8">
          <p className={WISDOM_TYPE.label}>Integrity</p>
          <h2 className="mt-1 font-display text-ui-28 text-tea-text">Review queue</h2>
          <p className="mt-2 max-w-2xl text-ui-12 leading-[1.6] text-tea-text-sec">Technical breaks and editorial gaps are listed here without inventing relationships. Each node finding opens the exact record that needs review.</p>
          {query.isLoading && <p className="mt-6 flex items-center gap-2 text-ui-12 text-tea-text-sec"><Loader2 size={14} className="animate-spin" /> Loading findings…</p>}
          {query.isError && <div role="alert" className="mt-6"><p className="text-ui-12 text-tea-text-sec">Could not load findings.</p><button type="button" onClick={() => void query.refetch()} className="tap-target mt-2 text-ui-12 text-tea-gold">Try again</button></div>}
          {!query.isLoading && !query.isError && findings.length === 0 && <p className="mt-6 text-ui-12 text-tea-text-dim">No relationship integrity findings need review.</p>}
          {(['broken', 'attention'] as const).map(group => grouped[group].length > 0 && (
            <section key={group} className="mt-7">
              <div className="flex items-center gap-2">
                {group === 'broken' ? <AlertTriangle size={14} className="text-tea-text-sec" /> : <Link2 size={14} className="text-tea-gold" />}
                <h3 className={WISDOM_TYPE.label}>{group === 'broken' ? 'Broken links' : 'Editorial gaps'} · {grouped[group].length}</h3>
              </div>
              <ul className="mt-3 divide-y divide-tea-border rounded-md border border-tea-border bg-tea-surface px-3">
                {grouped[group].map(finding => {
                  const resolution = finding.node_type && finding.node_id
                    ? findingResolution(finding)
                    : findingResolution({ ...finding, href: findingAdminHref(finding) });
                  const findingBody = <>
                      <span className="text-ui-12 font-medium text-tea-text">{finding.title}</span>
                      <span className="mt-1 block text-ui-11 leading-[1.5] text-tea-text-sec">{finding.detail}</span>
                      {finding.node_type && finding.node_id && <span className="mt-1 block font-mono text-ui-10 text-tea-gold">{finding.node_type}:{finding.node_id}</span>}
                    </>;
                  return (
                    <li key={finding.id} className={`py-3 ${finding.id === selectedFindingId ? 'bg-tea-accent-sub' : ''}`}>
                      {resolution.kind === 'node' ? (
                        <button type="button" onClick={() => onSelectFinding(finding)} className="tap-target w-full text-left">{findingBody}</button>
                      ) : resolution.kind === 'link' ? (
                        <a href={resolution.href} className="tap-target block w-full text-left">{findingBody}<span className="mt-1 block text-ui-10 text-tea-gold">Open target</span></a>
                      ) : (
                        <div className="w-full text-left">{findingBody}<span className="mt-1 block text-ui-10 text-tea-text-dim">No direct record is available. Use the target ID above in the relevant editor.</span></div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
};
