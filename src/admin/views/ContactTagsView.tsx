import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil, Search, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../components/Toast';

// Admin tool to clean up the freeform tag dictionary. Rename catches drift
// (loves: puer vs loves: pu'er); merge collapses two near-duplicates; delete
// removes a tag from every contact. All operations are account-scoped.

interface TagRow {
  tag: string;
  count: number;
}

export const ContactTagsView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

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

  const deleteTag = async (tag: string) => {
    if (busy) return;
    if (!confirm(`Remove "${tag}" from every contact? Existing collection links won't change.`)) return;
    setBusy(true);
    try {
      await api.customerTags.rename(tag, '');
      showToast(`Deleted "${tag}".`, 'info');
      load();
    } catch {
      showToast('Could not delete tag.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-tea-bg pb-nav-gap">
      <div className="sticky top-0 z-10 bg-tea-bg/95 backdrop-blur-sm border-b border-tea-border px-4 md:px-8 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors text-sm"
        >
          <ArrowLeft size={15} /> Back
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-6">
        <header>
          <h1 className="font-serif text-3xl text-tea-text">Contact tags</h1>
          <p className="text-tea-text-sec text-sm mt-1">
            Rename, merge, or delete tags across every contact at once.
          </p>
        </header>

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
          <p className="text-center text-tea-text-dim text-sm py-8">
            {tags.length === 0
              ? 'No tags yet. Tag contacts on their profile pages.'
              : 'No tags match that filter.'}
          </p>
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
                        <span className="text-[10px] uppercase tracking-wide text-tea-gold">Will merge</span>
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
                        className="px-3 py-1 bg-tea-gold text-tea-bg rounded-md text-xs font-medium hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {targetExists ? 'Merge' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <span className="text-sm text-tea-text truncate">{t.tag}</span>
                        <span className="text-[11px] text-tea-text-dim shrink-0">{t.count}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(t.tag)}
                        className="text-tea-text-sec hover:text-tea-text transition-colors p-1"
                        aria-label={`Rename ${t.tag}`}
                        title="Rename or merge"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTag(t.tag)}
                        className="text-tea-text-sec hover:text-red-400 transition-colors p-1"
                        aria-label={`Delete ${t.tag}`}
                        title="Delete everywhere"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
