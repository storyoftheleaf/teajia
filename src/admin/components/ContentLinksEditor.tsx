import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, Link2, Loader2, ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';
import { STORIES } from '../../content';
import { LEARN_CURRICULUM } from '../../constants';
import { consultProjects } from '../../data/consultProjects';
import { Product } from '../types';

/**
 * ContentLinksEditor — admin panel for curating article/module/project → product
 * xref rows. Pick an entity type, pick the entity from a dropdown, then add or
 * remove linked products. Uses the authenticated api.xref.* endpoints.
 */

type EntityType = 'article' | 'module' | 'project';

const ENTITY_LABELS: Record<EntityType, string> = {
  article: 'Magazine Article',
  module: 'Learn Module',
  project: 'Consult Project',
};

function useEntityOptions(type: EntityType): Array<{ id: string; label: string }> {
  return useMemo(() => {
    if (type === 'article') {
      return STORIES.filter(s => s.status === 'published' || s.status === 'draft').map(s => ({
        id: s.id,
        label: s.title,
      }));
    }
    if (type === 'module') {
      return LEARN_CURRICULUM.map(m => ({ id: m.id, label: `${m.subtitle}: ${m.title}` }));
    }
    // project
    return consultProjects.map(p => ({ id: p.id, label: p.name }));
  }, [type]);
}

async function fetchLinked(type: EntityType, entityId: string): Promise<Array<{ id: string }>> {
  if (type === 'article') return api.xref.articles.list(entityId);
  if (type === 'module') return api.xref.modules.list(entityId);
  return api.xref.projects.list(entityId);
}

async function linkProduct(type: EntityType, entityId: string, productId: string) {
  if (type === 'article') return api.xref.articles.link(entityId, productId);
  if (type === 'module') return api.xref.modules.link(entityId, productId);
  return api.xref.projects.link(entityId, productId);
}

async function unlinkProduct(type: EntityType, entityId: string, productId: string) {
  if (type === 'article') return api.xref.articles.unlink(entityId, productId);
  if (type === 'module') return api.xref.modules.unlink(entityId, productId);
  return api.xref.projects.unlink(entityId, productId);
}

interface ContentLinksEditorProps {
  products: Product[];
  onClose: () => void;
}

export const ContentLinksEditor: React.FC<ContentLinksEditorProps> = ({ products, onClose }) => {
  const [entityType, setEntityType] = useState<EntityType>('article');
  const [entityId, setEntityId] = useState('');
  const [adding, setAdding] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // productId being linked/unlinked
  const queryClient = useQueryClient();

  const entityOptions = useEntityOptions(entityType);

  const qKey = ['admin-xref', entityType, entityId];
  const { data: linkedRaw, isLoading } = useQuery<Array<{ id: string }>>({
    queryKey: qKey,
    queryFn: () => fetchLinked(entityType, entityId),
    enabled: !!entityId,
    staleTime: 0,
  });

  const linkedIds = useMemo(() => new Set((linkedRaw || []).map(r => r.id)), [linkedRaw]);

  const linkedProducts = useMemo(
    () => products.filter(p => linkedIds.has(p.id)),
    [products, linkedIds],
  );

  const pickerResults = useMemo(() => {
    if (!pickerQuery.trim()) return [];
    const q = pickerQuery.toLowerCase();
    return products
      .filter(p => !linkedIds.has(p.id) && (
        p.productName.toLowerCase().includes(q) ||
        (p.type || '').toLowerCase().includes(q)
      ))
      .slice(0, 8);
  }, [products, linkedIds, pickerQuery]);

  const handleEntityTypeChange = (t: EntityType) => {
    setEntityType(t);
    setEntityId('');
    setPickerQuery('');
    setAdding(false);
  };

  const handleLink = async (productId: string) => {
    if (!entityId || busy) return;
    setBusy(productId);
    try {
      await linkProduct(entityType, entityId, productId);
      await queryClient.invalidateQueries({ queryKey: qKey });
      setPickerQuery('');
      setAdding(false);
    } finally {
      setBusy(null);
    }
  };

  const handleUnlink = async (productId: string) => {
    if (!entityId || busy) return;
    setBusy(productId);
    try {
      await unlinkProduct(entityType, entityId, productId);
      await queryClient.invalidateQueries({ queryKey: qKey });
    } finally {
      setBusy(null);
    }
  };

  const selectedEntity = entityOptions.find(o => o.id === entityId);

  return (
    <div className="fixed inset-0 z-modal flex items-end md:items-center justify-center bg-tea-bg/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-tea-surface border border-tea-border rounded-t-xl md:rounded-xl shadow-xl flex flex-col"
        style={{ maxHeight: '85dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-tea-border shrink-0">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-tea-gold" />
            <h2 className="font-serif text-base text-tea-text">Content Links</h2>
          </div>
          <button onClick={onClose} className="text-tea-text-sec hover:text-tea-text transition-colors p-1 rounded" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Entity type tabs */}
        <div className="flex border-b border-tea-border shrink-0">
          {(Object.keys(ENTITY_LABELS) as EntityType[]).map(t => (
            <button
              key={t}
              onClick={() => handleEntityTypeChange(t)}
              className={`flex-1 py-2.5 text-xs font-medium tracking-wide transition-colors ${
                entityType === t
                  ? 'text-tea-gold border-b-2 border-tea-gold -mb-px'
                  : 'text-tea-text-dim hover:text-tea-text'
              }`}
            >
              {ENTITY_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Entity picker */}
        <div className="px-5 pt-4 shrink-0">
          <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim block mb-1.5">
            Select {ENTITY_LABELS[entityType]}
          </label>
          <div className="relative">
            <select
              value={entityId}
              onChange={e => { setEntityId(e.target.value); setAdding(false); setPickerQuery(''); }}
              className="w-full appearance-none bg-tea-elevated border border-tea-border rounded px-3 py-2 text-sm text-tea-text pr-8 focus:outline-none focus:ring-1 focus:ring-tea-gold/40"
            >
              <option value="">— choose —</option>
              {entityOptions.map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tea-text-dim pointer-events-none" />
          </div>
        </div>

        {/* Linked products list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {!entityId ? (
            <p className="text-sm text-tea-text-dim text-center py-6">Select a {ENTITY_LABELS[entityType].toLowerCase()} above to manage its linked products.</p>
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-tea-text-dim py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim mb-3">
                {linkedProducts.length === 0 ? 'No products linked' : `${linkedProducts.length} linked product${linkedProducts.length === 1 ? '' : 's'}`}
              </p>

              {linkedProducts.length > 0 && (
                <ul className="space-y-2 mb-4">
                  {linkedProducts.map(p => (
                    <li key={p.id} className="flex items-center gap-3 py-2 px-3 bg-tea-elevated rounded border border-tea-border">
                      <div className="flex-1 min-w-0">
                        <span className="font-serif text-sm text-tea-text italic block truncate">{p.productName}</span>
                        <span className="text-[11px] text-tea-text-sec">{p.type}</span>
                      </div>
                      <button
                        onClick={() => handleUnlink(p.id)}
                        disabled={!!busy}
                        className="shrink-0 text-tea-text-dim hover:text-red-400 transition-colors disabled:opacity-40 p-1"
                        title="Remove link"
                      >
                        {busy === p.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add product */}
              {!adding ? (
                <button
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1.5 text-xs text-tea-gold hover:text-tea-gold/80 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add product
                </button>
              ) : (
                <div className="border border-tea-border rounded bg-tea-elevated p-3">
                  <input
                    autoFocus
                    type="text"
                    value={pickerQuery}
                    onChange={e => setPickerQuery(e.target.value)}
                    placeholder="Search by name or type…"
                    className="w-full bg-transparent text-sm text-tea-text placeholder:text-tea-text-dim focus:outline-none"
                  />
                  {pickerResults.length > 0 && (
                    <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto border-t border-tea-border pt-2">
                      {pickerResults.map(p => (
                        <li key={p.id}>
                          <button
                            onClick={() => handleLink(p.id)}
                            disabled={!!busy}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-tea-surface transition-colors disabled:opacity-40 flex items-center gap-2"
                          >
                            {busy === p.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-tea-gold shrink-0" />
                            ) : (
                              <Plus className="w-3 h-3 text-tea-gold shrink-0" />
                            )}
                            <span className="font-serif text-sm text-tea-text italic truncate">{p.productName}</span>
                            <span className="text-[11px] text-tea-text-sec shrink-0">{p.type}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {pickerQuery.trim() && pickerResults.length === 0 && (
                    <p className="text-xs text-tea-text-dim mt-2">No matching products.</p>
                  )}
                  <button
                    onClick={() => { setAdding(false); setPickerQuery(''); }}
                    className="mt-2 text-xs text-tea-text-dim hover:text-tea-text transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer summary */}
        {selectedEntity && (
          <div className="px-5 py-3 border-t border-tea-border shrink-0">
            <p className="text-[11px] text-tea-text-dim truncate">
              <span className="text-tea-text-sec">{selectedEntity.label}</span>
              {' '}· {linkedProducts.length} product{linkedProducts.length === 1 ? '' : 's'} linked
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentLinksEditor;
