import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Product } from '../types';
import { buildProductUpdatePayload } from '../productUpdatePayload';
import { api } from '../../lib/api';
import { TEA_TYPES } from '../../types';

/**
 * Edit the words and facts a reader sees on a tea's page, from inside the
 * tasting overlay.
 *
 * Deliberately NOT the whole inventory panel: stock, cost, margin, vendor and
 * collections stay in the inventory section, because this surface opens on the
 * public page and its job is the tea as the reader meets it.
 *
 * Styling reuses the global admin field classes rather than importing the
 * inventory panel's components. Importing that panel would drag the entire
 * editor into the public page's eager bundle for the sake of one input.
 *
 * Every field commits when you leave it, the same behaviour as the inventory
 * rows. The write goes through the per-domain product routes, which mirror into
 * tea_profiles and product_listings, so a change made here is a change to the
 * tea itself rather than to this one card.
 */

const INPUT = 'admin-input w-full h-9 py-2 px-3 text-ui-14 leading-tight';
const AREA = 'admin-input w-full py-2 px-3 text-ui-14 leading-relaxed resize-y';
const LABEL = 'block text-ui-10 uppercase tracking-[0.06em] text-admin-text-dim mb-1.5';

type FieldKey = keyof Product;

/** Text field that holds its own draft and commits when it loses focus. */
const Field: React.FC<{
  label: string;
  value: string | number | null | undefined;
  onCommit: (v: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}> = ({ label, value, onCommit, type = 'text', placeholder = '', multiline = false, rows = 4 }) => {
  const initial = value === null || value === undefined ? '' : String(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState(initial);
  const committed = useRef(initial);

  useEffect(() => {
    // Follow the record when it changes underneath, but never overwrite a value
    // the user is part-way through typing.
    if (document.activeElement !== inputRef.current) {
      setDraft(initial);
      committed.current = initial;
    }
  }, [initial]);

  const commit = () => {
    if (draft === committed.current) return;
    committed.current = draft;
    onCommit(draft);
  };

  const shared = {
    value: draft,
    placeholder,
    onBlur: commit,
    autoComplete: 'off' as const,
  };

  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      {multiline ? (
        <textarea
          {...shared}
          ref={el => { inputRef.current = el; }}
          rows={rows}
          onChange={e => setDraft(e.target.value)}
          className={AREA}
        />
      ) : (
        <input
          {...shared}
          ref={el => { inputRef.current = el; }}
          type={type}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          spellCheck={false}
          className={INPUT}
        />
      )}
    </label>
  );
};

export const ProductDetailsEditor: React.FC<{
  product: Product;
  onChanged?: (field: FieldKey, value: unknown) => void;
}> = ({ product, onChanged }) => {
  const [local, setLocal] = useState<Product>(product);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => { setLocal(product); }, [product]);

  const commit = useCallback(async (field: FieldKey, value: unknown) => {
    const payload = buildProductUpdatePayload(field, value);
    if (!payload) return;
    setBusy(true);
    setFailed(null);
    try {
      await api.products.updateByDomain(product.id, payload);
      setLocal(prev => ({ ...prev, [field]: value }) as Product);
      onChanged?.(field, value);
    } catch (err: any) {
      // Say so rather than letting the field look saved. A change that silently
      // does not land is the exact failure this surface exists to prevent.
      setFailed(err?.message || 'That change did not save. Try again.');
    } finally {
      setBusy(false);
    }
  }, [product.id, onChanged]);

  return (
    <div className="space-y-3 px-4 pb-10 pt-4">
      {failed && (
        <p className="admin-card px-3 py-2 text-ui-12 text-tea-gold">{failed}</p>
      )}

      <section className="admin-card space-y-3 px-4 py-4">
        <Field
          label="Name shown"
          value={local.givenName}
          onCommit={v => commit('givenName', v)}
          placeholder="The name at the top of the page"
        />
        <Field label="Tea name" value={local.productName} onCommit={v => commit('productName', v)} />
        <Field label="Chinese" value={local.chineseName} onCommit={v => commit('chineseName', v)} />

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={LABEL}>Type</span>
            <select
              value={local.type || ''}
              onChange={e => commit('type', e.target.value)}
              className={`${INPUT} cursor-pointer appearance-none`}
            >
              {[...TEA_TYPES, 'Teaware', 'Misc'].map(t => (
                <option key={t} value={t} className="bg-admin-surface text-admin-text">{t}</option>
              ))}
            </select>
          </label>
          <Field
            label="Year"
            value={local.year}
            onCommit={v => commit('year', v)}
            type="number"
            placeholder="e.g. 2019"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Country" value={local.originCountry} onCommit={v => commit('originCountry', v)} />
          <Field label="Region" value={local.originRegion} onCommit={v => commit('originRegion', v)} />
        </div>
      </section>

      <section className="admin-card space-y-3 px-4 py-4">
        <Field
          label="Notes on the page"
          value={local.description}
          onCommit={v => commit('description', v)}
          multiline
          rows={5}
          placeholder="The paragraph a reader sees first"
        />
        <Field label="Lore" value={local.lore} onCommit={v => commit('lore', v)} multiline rows={4} />
        <Field label="Terroir" value={local.terroir} onCommit={v => commit('terroir', v)} multiline rows={3} />
        <Field
          label="Processing"
          value={local.processingNotes}
          onCommit={v => commit('processingNotes', v)}
          multiline
          rows={3}
        />
      </section>

      <p className="px-1 text-ui-10 text-admin-text-dim">
        {busy ? 'Saving' : 'Each field saves when you leave it, everywhere this tea appears.'}
      </p>
    </div>
  );
};
