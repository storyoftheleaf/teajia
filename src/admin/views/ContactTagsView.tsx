import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil, Search, Tag as TagIcon, Trash2 } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';

// Admin tool to clean up the freeform tag dictionary. Rename catches drift
// (loves: puer vs loves: pu'er); merge collapses two near-duplicates; delete
// removes a tag from every contact. All operations are account-scoped.

interface TagRow {
  tag: string;
  count: number;
}

interface ContactTagsViewProps {
  embedded?: boolean;
}

export const ContactTagsView: React.FC<ContactTagsViewProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const load = () => {
    setLoading(true);
    api.customerTags.listAll()
      .then(setTags)
      .catch(() => setTags([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(t => t.tag.includes(q));
  }, [tags, filter]);

  const startEdit = (tag: string) => {
    setEditing(tag);
    setDraft(tag);
  };
  const cancelEdit = () => {
    setEditing(null);
    setDraft('');
  };

  const saveEdit = async (from: string) => {
    if (busy) return;
    const to = draft.trim().toLowerCase();
    if (!to || to === from) {
      cancelEdit();
      return;
    }
    setBusy(true);
    try {
      await api.customerTags.rename(from, to);
      const exists = tags.some(t => t.tag === to);
      showToast(
        exists ? `Merged "${from}" into "${to}".` : `Renamed "${from}" to "${to}".`,
        'success'
      );
      cancelEdit();
      load();
    } catch {
      showToast('Could not save change.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const startMerge = (tag: string) => {
    setMergeSource(tag);
    setMergeTarget('');
    setShowMergePicker(true);
  };

  const confirmMerge = async () => {
    if (!mergeSource || !mergeTarget.trim() || busy) return;
    if (mergeTarget.trim().toLowerCase() === mergeSource) {
      setShowMergePicker(false);
      setMergeSource(null);
      return;
    }
    setBusy(true);
    try {
      await api.customerTags.rename(mergeSource, mergeTarget.trim().toLowerCase());
      const sourceCount = tags.find(t => t.tag === mergeSource)?.count || 0;
      const targetCount = tags.find(t => t.tag === mergeTarget.trim().toLowerCase())?.count || 0;
      showToast(
        `Merged "${mergeSource}" (${sourceCount} customers) into "${mergeTarget.trim()}" (${targetCount} customers).`,
        'success'
      );
      setShowMergePicker(false);
      setMergeSource(null);
      load();
    } catch {
      showToast('Could not merge tags.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const startDelete = (tag: string) => {
    setDeleteTarget(tag);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await api.customerTags.rename(deleteTarget, '');
      showToast(`Deleted "${deleteTarget}".`, 'info');
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      load();
    } catch {
      showToast('Could not delete tag.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-tea-bg pb-nav-gap">
      {!embedded && (
        <div className="sticky top-0 z-sticky bg-tea-bg/95 backdrop-blur-sm border-b border-tea-border px-4 md:px-8 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors text-sm"
          >
            <ArrowLeft size={15} /> Back
          </button>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-6">
        {!embedded && (
          <header>
            <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Contact tags</h1>
            <div className="label-caps text-tea-text-dim mt-2">Tag dictionary</div>
            <p className="text-tea-text-sec text-ui-14 leading-[1.6] mt-3">
              Rename, merge, or delete tags across every contact at once.
            </p>
          </header>
        )}

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter tags…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-tea-surface border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold/40"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={18} className="animate-spin text-tea-text-dim" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
            <TagIcon size={28} strokeWidth={1.25} className="text-tea-text-dim mb-3" />
            <div className="font-display text-ui-17 text-tea-text">
              {tags.length === 0 ? 'No tags yet' : 'No matching tags'}
            </div>
            <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">
              {tags.length === 0
                ? 'Tag contacts on their profile pages to start building the dictionary.'
                : 'Try a different filter, or clear the search to see all tags.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-tea-border border border-tea-border rounded-xl overflow-hidden bg-tea-surface">
            {filtered.map(t => {
              const isEditing = editing === t.tag;
              const targetExists = isEditing && draft.trim() && draft.trim() !== t.tag &&
                tags.some(x => x.tag === draft.trim().toLowerCase());
              return (
                <li key={t.tag} className="flex items-center gap-3 px-4 py-2.5">
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEdit(t.tag);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        autoFocus
                        maxLength={50}
                        className="flex-1 px-2 py-1 text-sm bg-tea-bg border border-tea-border rounded-md outline-none text-tea-text focus:border-tea-gold/40"
                      />
                      {targetExists && (
                        <span className="text-ui-10 uppercase tracking-wide text-tea-readgold">Will merge</span>
                      )}
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-xs text-tea-text-sec hover:text-tea-text transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(t.tag)}
                        disabled={busy || !draft.trim() || draft.trim() === t.tag}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {targetExists ? 'Merge' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <span className="text-sm text-tea-text truncate">{t.tag}</span>
                        <span className="text-ui-11 text-tea-text-dim shrink-0">{t.count}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(t.tag)}
                        className="text-tea-text-sec hover:text-tea-text transition-colors tap-target"
                        aria-label={`Rename ${t.tag}`}
                        title="Rename"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => startMerge(t.tag)}
                        className="text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors px-2 py-1 rounded-md hover:bg-tea-surface"
                        title="Merge into another tag"
                      >
                        Merge
                      </button>
                      <button
                        type="button"
                        onClick={() => startDelete(t.tag)}
                        className="text-tea-text-sec hover:text-tea-text transition-colors tap-target"
                        aria-label={`Delete ${t.tag}`}
                        title="Delete everywhere"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Merge Picker Modal */}
      {showMergePicker && mergeSource && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-serif text-tea-text mb-4">
              Merge "{mergeSource}" into…
            </h3>
            <p className="text-sm text-tea-text-sec mb-4">
              {mergeSource} has {tags.find(t => t.tag === mergeSource)?.count} customers. Select a destination tag.
            </p>

            <div className="space-y-2 mb-6">
              <input
                type="text"
                placeholder="Search or type tag name…"
                value={mergeTarget}
                onChange={e => setMergeTarget(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-tea-surface border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold/40 mb-3"
              />
              <div className="max-h-48 overflow-y-auto space-y-1 border border-tea-border rounded-lg p-2 bg-tea-surface">
                {tags
                  .filter(t => t.tag !== mergeSource && t.tag.toLowerCase().includes(mergeTarget.toLowerCase()))
                  .map(t => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => setMergeTarget(t.tag)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        mergeTarget.toLowerCase() === t.tag.toLowerCase()
                          ? 'bg-tea-gold/10 border border-tea-gold/40 text-tea-text'
                          : 'hover:bg-tea-elevated text-tea-text'
                      }`}
                    >
                      <span>{t.tag}</span>
                      <span className="text-tea-text-dim text-ui-11 ml-2">({t.count})</span>
                    </button>
                  ))}
                {tags.filter(t => t.tag !== mergeSource && t.tag.toLowerCase().includes(mergeTarget.toLowerCase())).length === 0 && mergeTarget.trim() && (
                  <p className="text-sm text-tea-text-dim px-3 py-2">No matching tags.</p>
                )}
              </div>
            </div>

            <div className="flex justify-between gap-3 pt-4 border-t border-tea-border">
              <button
                type="button"
                onClick={() => {
                  setShowMergePicker(false);
                  setMergeSource(null);
                }}
                disabled={busy}
                className="px-4 py-2 text-sm text-tea-text-sec hover:text-tea-text transition-colors rounded-lg hover:bg-tea-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMerge}
                disabled={busy || !mergeTarget.trim() || mergeTarget.trim().toLowerCase() === mergeSource}
                className="px-5 py-2 text-sm font-medium bg-tea-gold text-tea-bg rounded-lg hover:bg-tea-gold/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        title="Delete tag?"
        description={
          deleteTarget
            ? `Remove "${deleteTarget}" from ${tags.find(t => t.tag === deleteTarget)?.count || 0} customers. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        isLoading={busy}
      />
    </div>
  );
};
