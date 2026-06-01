import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X as XIcon, Search, Loader2, Plus, Tag as TagIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../../../lib/api';
import type { CollectionRecipient } from '../../../types';
import { ContactTagEditor } from '../contactTags/ContactTagEditor';

// Filename + export name kept for source-compatibility with existing imports
// (CollectionShareSheet, AddPublicationSheet). The component is the
// tag-aware "RecipientPicker": one compose surface (typeahead + recents +
// tag chips) feeding a row-based guest list. Idempotent against an existing
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

function initialOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '·';
  return trimmed.charAt(0).toUpperCase();
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

  // Inline tag editor: customer_id of the chip whose popover is open, or null.
  const [tagEditingId, setTagEditingId] = useState<string | null>(null);
  const tagEditorRef = useRef<HTMLDivElement>(null);

  // Refresh the account-wide tag list when a row's tags change so the
  // picker's tag chips stay accurate (counts/new tags) without remount.
  const handleTagsChanged = () => {
    api.customerTags.listAll().then(setTags).catch(() => {});
  };

  // Auto-dismiss skip notes so they don't persist as visual noise.
  useEffect(() => {
    if (!skipNote) return;
    const t = setTimeout(() => setSkipNote(null), 4000);
    return () => clearTimeout(t);
  }, [skipNote]);

  // Close the per-row tag editor on outside click / Escape.
  useEffect(() => {
    if (!tagEditingId) return;
    const handleClick = (e: MouseEvent) => {
      if (!tagEditorRef.current?.contains(e.target as Node)) setTagEditingId(null);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTagEditingId(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [tagEditingId]);

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

  // Recents: dedicated endpoint, scales beyond client-side fan-out.
  useEffect(() => {
    let cancelled = false;
    api.collections.recentRecipients(RECENT_WINDOW_DAYS, RECENT_LIMIT * 2)
      .then(rows => {
        if (cancelled) return;
        setRecents(rows.map(r => ({ id: r.customer_id, name: r.name, phone: r.phone })));
      })
      .catch(() => { /* leave empty */ });
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

  const visibleRecents = useMemo(() => {
    return recents
      .filter(c => !isExcluded(c.id) && !selectedIds.has(c.id))
      .slice(0, RECENT_LIMIT);
  }, [recents, alreadyPublishedIds, selectedIds]);

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

  // Set/clear the phone on a freeform (non-contact) recipient so the owner can
  // send to someone who isn't a saved contact and still get a WhatsApp link.
  const setPhoneAt = (idx: number, phone: string) => {
    const next = value.slice();
    next[idx] = { ...next[idx], phone };
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
        setSkipNote(`Everyone tagged "${tag}" is already on the list.`);
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
    }
  };

  const hasQuickAdds = visibleRecents.length > 0 || tags.length > 0;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Compose surface — typeahead + quick-add rails read as one tool */}
      <div className="rounded-xl border border-tea-border bg-tea-bg/40 overflow-visible">
        {/* Typeahead row */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
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
            className="w-full pl-9 pr-9 py-2.5 text-ui-13 bg-transparent border-0 rounded-t-xl outline-none text-tea-text placeholder:text-tea-text-dim focus:bg-tea-bg/60 transition-colors"
          />
          {customersLoading && (
            <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-tea-text-dim animate-spin" />
          )}
          {open && (matches.length > 0 || queryIsNewName) && (
            <ul className="absolute top-full left-0 right-0 mt-1 z-30 max-h-64 overflow-y-auto rounded-xl bg-tea-surface border border-tea-border shadow-xl py-1">
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
                    <span className="text-ui-13 text-tea-text truncate">{c.name}</span>
                    {c.phone && <span className="text-ui-10 text-tea-text-dim shrink-0 num">{c.phone}</span>}
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
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-ui-12 text-tea-text-sec hover:bg-tea-elevated hover:text-tea-text transition-colors"
                  >
                    <Plus size={11} />
                    Add "{query.trim()}" as a new name
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Quick-add rails — separated by a hairline, never just floating */}
        {hasQuickAdds && (
          <div className="px-3 pb-2.5 pt-1 flex flex-col gap-2">
            {visibleRecents.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim shrink-0 w-14">
                  Recent
                </span>
                <div className="flex flex-wrap gap-1">
                  {visibleRecents.map(c => (
                    <motion.button
                      key={c.id}
                      type="button"
                      onClick={() => addCustomer(c)}
                      whileTap={{ scale: 0.96 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-tea-elevated/70 text-tea-text text-ui-12 hover:bg-tea-gold/10 transition-colors"
                    >
                      <Plus size={10} className="text-tea-text-dim" />
                      <span className="truncate max-w-[140px]">{c.name}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {tags.length > 0 && (
              <div className="relative flex items-start gap-2">
                <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim shrink-0 w-14 pt-0.5">
                  Tags
                </span>
                <div className="flex flex-wrap gap-1">
                  {visibleTags.map(t => (
                    <motion.button
                      key={t.tag}
                      type="button"
                      onClick={() => addByTag(t.tag)}
                      whileTap={{ scale: 0.96 }}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-tea-elevated/70 text-tea-text text-ui-12 hover:bg-tea-gold/10 transition-colors"
                    >
                      <span className="truncate max-w-[160px]">{t.tag}</span>
                      <span className="text-ui-10 text-tea-text-dim num">{t.count}</span>
                    </motion.button>
                  ))}
                  {overflowTags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTagsExpanded(v => !v)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-ui-12 text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated/70 transition-colors"
                    >
                      +{overflowTags.length} more
                    </button>
                  )}
                </div>

                {tagsExpanded && (
                  <div
                    ref={tagPopoverRef}
                    className="absolute z-40 top-full mt-1 left-16 w-[280px] max-w-[calc(100%-4rem)] rounded-xl bg-tea-surface border border-tea-border shadow-xl"
                  >
                    <div className="relative border-b border-tea-border">
                      <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                      <input
                        type="text"
                        value={tagFilter}
                        onChange={e => setTagFilter(e.target.value)}
                        placeholder="Filter tags…"
                        autoFocus
                        className="w-full pl-7 pr-3 py-1.5 text-ui-12 bg-transparent border-none outline-none text-tea-text placeholder:text-tea-text-dim"
                      />
                    </div>
                    <ul className="max-h-64 overflow-y-auto py-1">
                      {filteredOverflowTags.length === 0 ? (
                        <li className="px-3 py-2 text-ui-11 text-tea-text-dim italic">No tags match.</li>
                      ) : filteredOverflowTags.map(t => (
                        <li key={t.tag}>
                          <button
                            type="button"
                            onClick={() => { addByTag(t.tag); setTagsExpanded(false); setTagFilter(''); }}
                            className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-tea-elevated transition-colors"
                          >
                            <span className="text-ui-12 text-tea-text truncate">{t.tag}</span>
                            <span className="text-ui-10 text-tea-text-dim shrink-0 num">{t.count}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {skipNote && (
          <motion.p
            key={skipNote}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-ui-11 text-tea-text-dim italic"
          >
            {skipNote}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Guest list */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <p className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim">
            Guest list
          </p>
          {value.length > 0 && (
            <span className="text-ui-10 text-tea-text-dim num">{value.length}</span>
          )}
        </div>

        {value.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-ui-12 text-tea-text-dim italic">
              No one yet. Pick from recents or type a name above.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            <AnimatePresence initial={false}>
              {value.map((r, i) => {
                const editing = !!r.customer_id && tagEditingId === r.customer_id;
                const key = `${r.customer_id ?? 'n'}_${r.name}_${i}`;
                return (
                  <motion.li
                    key={key}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -8, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                    className="group relative flex items-center gap-2.5 py-1.5 px-1 -mx-1 rounded-md hover:bg-tea-elevated/40 transition-colors"
                  >
                    {/* Monogram avatar */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-tea-gold/10 text-tea-gold text-ui-12 font-medium tracking-wide"
                      aria-hidden
                    >
                      {initialOf(r.name)}
                    </div>

                    {/* Identity */}
                    <div className="flex-1 min-w-0 flex items-baseline gap-2">
                      <span className="text-ui-13 text-tea-text truncate shrink-0">
                        {r.name}
                      </span>
                      {r.customer_id ? (
                        r.phone ? (
                          <span className="text-ui-11 text-tea-text-dim num truncate">
                            {r.phone}
                          </span>
                        ) : (
                          <span className="text-ui-10 text-tea-text-dim italic">
                            no phone
                          </span>
                        )
                      ) : (
                        // Freeform recipient: let the owner add a phone so a
                        // WhatsApp link works for someone not on the list.
                        <input
                          type="tel"
                          inputMode="tel"
                          value={r.phone ?? ''}
                          onChange={e => setPhoneAt(i, e.target.value)}
                          placeholder="Add phone for WhatsApp (optional)"
                          autoComplete="off"
                          data-1p-ignore
                          data-lpignore="true"
                          className="flex-1 min-w-0 bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none text-ui-11 text-tea-text-sec num py-0.5 placeholder:text-tea-text-dim placeholder:not-italic transition-colors"
                        />
                      )}
                    </div>

                    {/* Tag editor trigger (customer rows only) */}
                    {r.customer_id && (
                      <button
                        type="button"
                        onClick={() => setTagEditingId(prev => prev === r.customer_id ? null : r.customer_id!)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-tea-text-sec hover:text-tea-gold transition-all p-1"
                        aria-label={`Edit tags for ${r.name}`}
                        title="Edit tags"
                      >
                        <TagIcon size={12} />
                      </button>
                    )}

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-tea-text-sec hover:text-tea-text transition-all p-1"
                      aria-label={`Remove ${r.name}`}
                    >
                      <XIcon size={13} />
                    </button>

                    {editing && (
                      <div
                        ref={tagEditorRef}
                        className="absolute z-30 top-full right-0 mt-1 w-[280px] max-w-[calc(100vw-2rem)] rounded-xl bg-tea-surface border border-tea-border shadow-xl p-3"
                      >
                        <p className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim mb-2 truncate">
                          Tags for {r.name}
                        </p>
                        <ContactTagEditor
                          customerId={r.customer_id!}
                          compact
                          autoFocus
                          onChange={handleTagsChanged}
                        />
                      </div>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
};
