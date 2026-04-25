import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X as XIcon, Plus } from 'lucide-react';
import { api } from '../../../lib/api';
import { useToast } from '../Toast';

// Reusable contact-tag editor: chips with X to remove, plus an autocomplete
// input. Used both on CustomerProfilePage (full inline) and inside the
// recipient picker's per-chip popover (compact). Optimistic, with undo on
// delete via toast.

export interface ContactTagEditorProps {
  customerId: string;
  /** Initial tags. If omitted, the editor fetches them on mount. */
  initialTags?: string[];
  /** Called whenever the canonical tag set changes (after server confirms). */
  onChange?: (tags: string[]) => void;
  /** Compact = no section label, smaller chip + input, no empty-state caption. */
  compact?: boolean;
  autoFocus?: boolean;
}

export const ContactTagEditor: React.FC<ContactTagEditorProps> = ({
  customerId, initialTags, onChange, compact, autoFocus,
}) => {
  const { showToast } = useToast();
  const [tags, setTags] = useState<string[]>(initialTags ?? []);
  const [allTags, setAllTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [adding, setAdding] = useState(!!autoFocus);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTags) return;
    api.customers.listTags(customerId).then(setTags).catch(() => setTags([]));
  }, [customerId, initialTags]);

  useEffect(() => {
    api.customerTags.listAll().then(setAllTags).catch(() => setAllTags([]));
  }, []);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const known = useMemo(() => new Set(tags.map(t => t.toLowerCase())), [tags]);

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    return allTags
      .filter(t => t.tag.includes(q) && !known.has(t.tag))
      .slice(0, 6);
  }, [draft, allTags, known]);

  const refreshAccountTags = () => {
    api.customerTags.listAll().then(setAllTags).catch(() => {});
  };

  const commit = async (raw: string) => {
    const clean = raw.trim().toLowerCase().slice(0, 50);
    if (!clean || known.has(clean)) {
      setDraft('');
      return;
    }
    const next = [...tags, clean].sort();
    setTags(next);
    onChange?.(next);
    setDraft('');
    try {
      await api.customers.addTag(customerId, clean);
      refreshAccountTags();
    } catch {
      const rolled = tags;
      setTags(rolled);
      onChange?.(rolled);
      showToast('Could not add tag.', 'error');
    }
  };

  const remove = async (tag: string) => {
    const prev = tags;
    const next = prev.filter(t => t !== tag);
    setTags(next);
    onChange?.(next);
    try {
      await api.customers.removeTag(customerId, tag);
      refreshAccountTags();
      // Undo: re-add on click.
      showToast(`Removed "${tag}".`, 'info', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.customers.addTag(customerId, tag);
              const restored = [...next, tag].sort();
              setTags(restored);
              onChange?.(restored);
              refreshAccountTags();
            } catch {
              showToast('Could not restore tag.', 'error');
            }
          },
        },
        duration: 5000,
      });
    } catch {
      setTags(prev);
      onChange?.(prev);
      showToast('Could not remove tag.', 'error');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Escape') {
      setDraft('');
      setAdding(false);
    } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
      void remove(tags[tags.length - 1]);
    }
  };

  const sizeChip = compact ? 'text-[11px]' : 'text-[12px]';
  const sizeInput = compact ? 'text-[11px] w-36' : 'text-[12px] w-44';

  return (
    <div>
      {!compact && (
        <p className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec mb-3">
          Tags
          {tags.length > 0 && <span className="ml-1 normal-case text-tea-text-dim">({tags.length})</span>}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map(tag => (
          <span
            key={tag}
            className={`group inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-tea-elevated text-tea-text ${sizeChip}`}
          >
            <span className="truncate max-w-[200px]">{tag}</span>
            <button
              type="button"
              onClick={() => remove(tag)}
              className="text-tea-text-dim hover:text-tea-text transition-colors p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
              aria-label={`Remove tag ${tag}`}
            >
              <XIcon size={10} />
            </button>
          </span>
        ))}

        {adding ? (
          <div className="relative">
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => {
                if (draft.trim()) commit(draft);
                setTimeout(() => setAdding(false), 120);
              }}
              placeholder="add tag, press enter"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={50}
              className={`${sizeInput} px-2 py-1 bg-tea-bg border border-tea-border rounded-md outline-none text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold/40`}
            />
            {suggestions.length > 0 && (
              <ul className="absolute top-full left-0 mt-1 z-10 w-56 max-h-56 overflow-y-auto rounded-md bg-tea-surface border border-tea-border shadow-lg py-1">
                {suggestions.map(s => (
                  <li key={s.tag}>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); commit(s.tag); }}
                      className="w-full flex items-center justify-between gap-3 px-2.5 py-1.5 text-left text-[12px] text-tea-text hover:bg-tea-elevated transition-colors"
                    >
                      <span className="truncate">{s.tag}</span>
                      <span className="text-[10px] text-tea-text-dim shrink-0">{s.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${sizeChip} text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated/60 transition-colors`}
          >
            <Plus size={11} />
            add tag
          </button>
        )}
      </div>

      {!compact && tags.length === 0 && !adding && (
        <p className="text-[11px] text-tea-text-dim mt-2">No tags yet.</p>
      )}
    </div>
  );
};
