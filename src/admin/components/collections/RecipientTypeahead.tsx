import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X as XIcon, Search, Loader2, Plus } from 'lucide-react';
import { api } from '../../../lib/api';
import type { CollectionRecipient } from '../../../types';

// Filename + export name kept for source-compatibility with existing imports
// (CollectionShareSheet, AddPublicationSheet). The component is now the
// tag-aware "RecipientPicker": three add-sources (recents, typeahead, tags)
// merging into one chip set, with idempotent filtering against an existing
// collection's active publications. See project_contact_tags_feature memory.

interface RecipientTypeaheadProps {
  value: CollectionRecipient[];
  onChange: (next: CollectionRecipient[]) => void;
  /** Existing collection id, when known. Powers idempotent filtering: customers
   *  already on an active publication of THIS collection are excluded from all
   *  three add-sources. Pass null when the collection is being newly created. */
  collectionId?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
}

interface CustomerRow {
  id: string;
  name: string;
  phone?: string;
}

interface TagRow {
  tag: string;
  count: number;
}

const RECENT_WINDOW_DAYS = 90;
const RECENT_LIMIT = 6;
const TAG_VISIBLE = 8;

function dedupeRecipients(rs: CollectionRecipient[]): CollectionRecipient[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const out: CollectionRecipient[] = [];
  for (const r of rs) {
    if (r.customer_id) {
      if (seenIds.has(r.customer_id)) continue;
      seenIds.add(r.customer_id);
      out.push(r);
    } else {
      const key = r.name.trim().toLowerCase();
      if (!key || seenNames.has(key)) continue;
      seenNames.add(key);
      out.push(r);
    }
  }
  return out;
}

export const RecipientTypeahead: React.FC<RecipientTypeaheadProps> = ({
  value, onChange, collectionId, placeholder, autoFocus,
}) => {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [recents, setRecents] = useState<CustomerRow[]>([]);
  const [alreadyPublishedIds, setAlreadyPublishedIds] = useState<Set<string>>(new Set());
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
  const tagPopoverRef = useRef<HTMLDivElement>(null);

  // Typeahead state.
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [skipNote, setSkipNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Data loading ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setCustomersLoading(true);
    Promise.all([
      api.customers.list('customer'),
      api.customerTags.listAll(),
    ]).then(([rows, tagRows]) => {
      if (cancelled) return;
      const list: CustomerRow[] = Array.isArray(rows) ? rows : (rows?.customers ?? rows?.results ?? []);
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setCustomers(list);
      setTags(tagRows || []);
    }).catch(() => {
      if (cancelled) return;
      setCustomers([]);
      setTags([]);
    }).finally(() => {
      if (!cancelled) setCustomersLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Idempotent filter: pull active publications of this collection.
  useEffect(() => {
    if (!collectionId) {
      setAlreadyPublishedIds(new Set());
      return;
    }
    let cancelled = false;
    api.collections.get(collectionId).then(detail => {
      if (cancelled) return;
      const ids = new Set<string>();
      for (const pub of detail.publications || []) {
        if (pub.unpublished_at) continue;
        if (pub.target_type !== 'person') continue;
        for (const r of pub.recipients || []) {
          if (r.customer_id) ids.add(r.customer_id);
        }
      }
      setAlreadyPublishedIds(ids);
    }).catch(() => { /* leave empty */ });
    return () => { cancelled = true; };
  }, [collectionId]);

  // Recents: derive from collection_publications across the account.
  // We don't have a dedicated endpoint, so we infer from the collections list
  // (each row carries last_published_at and active_publication_count). For
  // recipient-level history we'd need a new endpoint; for v1 we approximate
  // using customers that appear in publications of OTHER collections recently.
  // Practical short-term: reuse the customers list ordered by last activity.
  // To keep this honest, we hit collections.list and walk their publications.
  useEffect(() => {
    let cancelled = false;
    api.collections.list({ status: 'active' }).then(async ({ collections }) => {
      if (cancelled) return;
      const cutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const recentCollections = (collections || []).filter(c =>
        c.last_published_at && new Date(c.last_published_at).getTime() >= cutoff
      ).slice(0, 12);

      // Fan out to fetch each recent collection's publications in parallel.
      const details = await Promise.all(
        recentCollections.map(c => api.collections.get(c.id).catch(() => null))
      );
      if (cancelled) return;

      // Collect customer ids by most-recent publication date.
      const seen = new Map<string, { id: string; name: string; phone?: string; ts: number }>();
      for (const d of details) {
        if (!d) continue;
        for (const pub of d.publications || []) {
          if (pub.target_type !== 'person') continue;
          const ts = new Date(pub.published_at).getTime();
          if (ts < cutoff) continue;
          for (const r of pub.recipients || []) {
            if (!r.customer_id) continue;
            const prev = seen.get(r.customer_id);
            if (!prev || prev.ts < ts) {
              seen.set(r.customer_id, { id: r.customer_id, name: r.name, phone: r.phone, ts });
            }
          }
        }
      }
      const ordered = Array.from(seen.values()).sort((a, b) => b.ts - a.ts);
      setRecents(ordered.slice(0, RECENT_LIMIT * 2)); // overshoot, filter later
    }).catch(() => { /* leave empty */ });
    return () => { cancelled = true; };
  }, []);

  // Auto-focus typeahead.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Close tag popover on outside click / Escape.
  useEffect(() => {
    if (!tagsExpanded) return;
    const handleClick = (e: MouseEvent) => {
      if (!tagPopoverRef.current?.contains(e.target as Node)) setTagsExpanded(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTagsExpanded(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [tagsExpanded]);

  // ── Derived state ───────────────────────────────────────────────────────
  const selectedIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of value) if (r.customer_id) s.add(r.customer_id);
    return s;
  }, [value]);

  const freeformLowerNames = useMemo(() => {
    const s = new Set<string>();
    for (const r of value) if (!r.customer_id) s.add(r.name.trim().toLowerCase());
    return s;
  }, [value]);

  const isExcluded = (id: string) => alreadyPublishedIds.has(id);

  // Recents row, filtered against already-published and already-selected.
  const visibleRecents = useMemo(() => {
    return recents
      .filter(c => !isExcluded(c.id) && !selectedIds.has(c.id))
      .slice(0, RECENT_LIMIT);
  }, [recents, alreadyPublishedIds, selectedIds]);

  // Typeahead matches.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter(c => !isExcluded(c.id) && !selectedIds.has(c.id))
      .filter(c => c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, customers, alreadyPublishedIds, selectedIds]);

  const queryIsNewName = useMemo(() => {
    const q = query.trim();
    if (!q) return false;
    if (freeformLowerNames.has(q.toLowerCase())) return false;
    if (matches.some(m => m.name.toLowerCase() === q.toLowerCase())) return false;
    return true;
  }, [query, matches, freeformLowerNames]);

  // Tag chips: top by count, with overflow popover.
  const visibleTags = tags.slice(0, TAG_VISIBLE);
  const overflowTags = tags.slice(TAG_VISIBLE);

  const filteredOverflowTags = useMemo(() => {
    const q = tagFilter.trim().toLowerCase();
    const list = q
      ? overflowTags.filter(t => t.tag.includes(q))
      : overflowTags.slice().sort((a, b) => a.tag.localeCompare(b.tag));
    return list;
  }, [overflowTags, tagFilter]);

  // ── Mutations ───────────────────────────────────────────────────────────
  const addCustomer = (c: CustomerRow) => {
    if (isExcluded(c.id) || selectedIds.has(c.id)) return;
    onChange(dedupeRecipients([...value, { customer_id: c.id, name: c.name, phone: c.phone }]));
  };

  const addFreeform = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (freeformLowerNames.has(clean.toLowerCase())) return;
    onChange(dedupeRecipients([...value, { name: clean }]));
  };

  const removeAt = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const addByTag = async (tag: string) => {
    setSkipNote(null);
    try {
      const list = await api.customerTags.customersByTag(tag);
      let added = 0;
      let skipped = 0;
      const next = value.slice();
      for (const c of list) {
        if (isExcluded(c.id)) { skipped++; continue; }
        if (selectedIds.has(c.id)) continue;
        next.push({ customer_id: c.id, name: c.name, phone: c.phone });
        added++;
      }
      onChange(dedupeRecipients(next));
      if (skipped > 0) {
        setSkipNote(skipped === 1
          ? '1 already has this collection. Skipped.'
          : `${skipped} already have this collection. Skipped.`);
      } else if (added === 0) {
        setSkipNote(`Everyone tagged "${tag}" is already selected.`);
      }
    } catch {
      setSkipNote('Could not load that tag.');
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matches.length > 0) {
        addCustomer(matches[0]);
        setQuery('');
        setOpen(true);
      } else if (queryIsNewName) {
        addFreeform(query);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && !query && value.length > 0) {
      removeAt(value.length - 1);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Recents */}
      {visibleRecents.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-tea-text-dim mb-1.5">
            Recently shared with
          </p>
          <div className="flex flex-wrap gap-1.5">
            {visibleRecents.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => addCustomer(c)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-tea-elevated text-tea-text text-[12px] hover:bg-tea-gold/10 hover:text-tea-text transition-colors"
              >
                <Plus size={10} className="text-tea-text-dim" />
                <span className="truncate max-w-[160px]">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Typeahead */}
      <div>
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onInputKeyDown}
            placeholder={placeholder || 'Type a name, or add someone new'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            name="recipient-typeahead"
            className="w-full pl-8 pr-3 py-2 text-[13px] bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold/40"
          />
          {open && (matches.length > 0 || queryIsNewName) && (
            <ul className="absolute top-full left-0 right-0 mt-1 z-20 max-h-64 overflow-y-auto rounded-lg bg-tea-surface border border-tea-border shadow-lg py-1">
              {matches.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      addCustomer(c);
                      setQuery('');
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-tea-elevated transition-colors"
                  >
                    <span className="text-[13px] text-tea-text truncate">{c.name}</span>
                    {c.phone && <span className="text-[10px] text-tea-text-dim shrink-0">{c.phone}</span>}
                  </button>
                </li>
              ))}
              {queryIsNewName && (
                <li>
                  <button
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      addFreeform(query);
                      setQuery('');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] text-tea-text-sec hover:bg-tea-elevated hover:text-tea-text transition-colors"
                  >
                    <Plus size={11} />
                    Add "{query.trim()}" as a new name
                  </button>
                </li>
              )}
            </ul>
          )}
          {customersLoading && (
            <Loader2 size={11} className="absolute right-3 top-1/2 -translate-y-1/2 text-tea-text-dim animate-spin" />
          )}
        </div>
      </div>

      {/* Tag chips */}
      {tags.length > 0 && (
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.12em] text-tea-text-dim mb-1.5">
            Or pick by tag
          </p>
          <div className="flex flex-wrap gap-1.5">
            {visibleTags.map(t => (
              <button
                key={t.tag}
                type="button"
                onClick={() => addByTag(t.tag)}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-tea-elevated text-tea-text text-[12px] hover:bg-tea-gold/10 transition-colors"
              >
                <span className="truncate max-w-[180px]">{t.tag}</span>
                <span className="text-[10px] text-tea-text-dim">{t.count}</span>
              </button>
            ))}
            {overflowTags.length > 0 && (
              <button
                type="button"
                onClick={() => setTagsExpanded(v => !v)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated/60 transition-colors"
              >
                +{overflowTags.length} more
              </button>
            )}
          </div>

          {tagsExpanded && (
            <div
              ref={tagPopoverRef}
              className="absolute z-30 mt-2 left-0 w-[280px] max-w-full rounded-lg bg-tea-surface border border-tea-border shadow-xl"
            >
              <div className="relative border-b border-tea-border">
                <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                <input
                  type="text"
                  value={tagFilter}
                  onChange={e => setTagFilter(e.target.value)}
                  placeholder="Filter tags…"
                  autoFocus
                  className="w-full pl-7 pr-3 py-1.5 text-[12px] bg-transparent border-none outline-none text-tea-text placeholder:text-tea-text-dim"
                />
              </div>
              <ul className="max-h-64 overflow-y-auto py-1">
                {filteredOverflowTags.length === 0 ? (
                  <li className="px-3 py-2 text-[11px] text-tea-text-dim italic">No tags match.</li>
                ) : filteredOverflowTags.map(t => (
                  <li key={t.tag}>
                    <button
                      type="button"
                      onClick={() => { addByTag(t.tag); setTagsExpanded(false); setTagFilter(''); }}
                      className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-tea-elevated transition-colors"
                    >
                      <span className="text-[12px] text-tea-text truncate">{t.tag}</span>
                      <span className="text-[10px] text-tea-text-dim shrink-0">{t.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {skipNote && (
        <p className="text-[11px] text-tea-text-dim italic">{skipNote}</p>
      )}

      {/* Selected footer */}
      <div className="border-t border-tea-border pt-3">
        <p className="text-[10px] uppercase tracking-[0.12em] text-tea-text-dim mb-1.5">
          Selected {value.length > 0 && <span className="normal-case">({value.length})</span>}
        </p>
        {value.length === 0 ? (
          <p className="text-[11px] text-tea-text-dim">No recipients yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {value.map((r, i) => (
              <span
                key={`${r.customer_id ?? 'n'}_${i}`}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-tea-gold/10 text-tea-text text-[12px]"
              >
                <span className="truncate max-w-[180px]">{r.name}</span>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="text-tea-text-sec hover:text-tea-text transition-colors p-0.5"
                  aria-label={`Remove ${r.name}`}
                >
                  <XIcon size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
