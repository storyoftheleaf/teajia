import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Search, X as XIcon, Check, BookOpen, Plus,
  Copy, MessageCircle, ArrowRight, CheckCircle2,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { buildWhatsAppUrl } from '../../../lib/whatsapp';
import type { CollectionListRow, CollectionRecipient } from '../../../types';
import { RecipientTypeahead } from './RecipientTypeahead';

interface CollectionShareSheetProps {
  open: boolean;
  productIds: string[];
  onClose: () => void;
  /** Called once the user clicks Done on the success card — InventoryView uses
   *  this to clear selection. Toast is no longer fired from here; the success
   *  card replaces it. */
  onSuccess: (args: { collectionId: string; collectionTitle: string; addedCount: number; publicationSlug?: string }) => void;
}

type FormMode = 'new' | 'existing';
type Phase = 'form' | 'success';

interface SuccessState {
  collectionId: string;
  collectionTitle: string;
  collectionNote?: string;
  /** undefined when "Add to existing" was used without re-publishing. */
  publicationSlug?: string;
  recipients: CollectionRecipient[];
  addedCount: number;
}

export const CollectionShareSheet: React.FC<CollectionShareSheetProps> = ({
  open, productIds, onClose, onSuccess,
}) => {
  const [phase, setPhase] = useState<Phase>('form');
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const [mode, setMode] = useState<FormMode>('new');

  // Create-new state
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [recipients, setRecipients] = useState<CollectionRecipient[]>([]);

  // Existing state
  const [collections, setCollections] = useState<CollectionListRow[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [publishAfterAdd, setPublishAfterAdd] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = productIds.length;

  useEffect(() => {
    if (!open) {
      setPhase('form');
      setSuccess(null);
      setMode('new');
      setTitle('');
      setNote('');
      setRecipients([]);
      setSearch('');
      setSelectedCollectionId(null);
      setPublishAfterAdd(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setCollectionsLoading(true);
    api.collections.list()
      .then(res => { if (!cancelled) setCollections(res.collections); })
      .catch(() => { if (!cancelled) setCollections([]); })
      .finally(() => { if (!cancelled) setCollectionsLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        // On the success card, Escape acts like Done so InventoryView clears.
        if (phase === 'success' && success) {
          onSuccess({
            collectionId: success.collectionId,
            collectionTitle: success.collectionTitle,
            addedCount: success.addedCount,
            publicationSlug: success.publicationSlug,
          });
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, onSuccess, phase, success, submitting]);

  const filteredCollections = useMemo(() => {
    const eligible = collections.filter(c => c.status !== 'archived');
    if (!search.trim()) return eligible;
    const q = search.toLowerCase();
    return eligible.filter(c => c.title.toLowerCase().includes(q));
  }, [collections, search]);

  const selectedCollection = filteredCollections.find(c => c.id === selectedCollectionId);

  const canSubmitNew = title.trim().length > 0 && recipients.length > 0 && count > 0;
  const canSubmitExisting = !!selectedCollectionId && count > 0 && (!publishAfterAdd || recipients.length > 0);

  const handleSubmitNew = async () => {
    if (!canSubmitNew || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { id } = await api.collections.create({
        title: title.trim(),
        note: note.trim() || undefined,
        initial_product_ids: productIds,
      });
      const { slug } = await api.collections.publish(id, recipients);
      setSuccess({
        collectionId: id,
        collectionTitle: title.trim(),
        collectionNote: note.trim() || undefined,
        publicationSlug: slug,
        recipients,
        addedCount: count,
      });
      setPhase('success');
    } catch (err: any) {
      setError(err?.message || 'Failed to create collection');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitExisting = async () => {
    if (!canSubmitExisting || !selectedCollection || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.collections.addItems(selectedCollection.id, productIds);
      let pubSlug: string | undefined;
      if (publishAfterAdd && recipients.length > 0) {
        const pub = await api.collections.publish(selectedCollection.id, recipients);
        pubSlug = pub.slug;
      }
      setSuccess({
        collectionId: selectedCollection.id,
        collectionTitle: selectedCollection.title,
        publicationSlug: pubSlug,
        recipients: publishAfterAdd ? recipients : [],
        addedCount: result.added,
      });
      setPhase('success');
    } catch (err: any) {
      setError(err?.message || 'Failed to add to collection');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    if (!success) { onClose(); return; }
    onSuccess({
      collectionId: success.collectionId,
      collectionTitle: success.collectionTitle,
      addedCount: success.addedCount,
      publicationSlug: success.publicationSlug,
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="collection-share-title"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm"
        onClick={submitting ? undefined : (phase === 'success' ? handleDone : onClose)}
      />

      <div className="relative w-full max-w-md bg-tea-surface border border-tea-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {phase === 'form' ? (
          <FormPhase
            mode={mode} setMode={setMode}
            count={count}
            title={title} setTitle={setTitle}
            note={note} setNote={setNote}
            recipients={recipients} setRecipients={setRecipients}
            search={search} setSearch={setSearch}
            collectionsLoading={collectionsLoading}
            filteredCollections={filteredCollections}
            selectedCollection={selectedCollection}
            selectedCollectionId={selectedCollectionId}
            setSelectedCollectionId={setSelectedCollectionId}
            publishAfterAdd={publishAfterAdd}
            setPublishAfterAdd={setPublishAfterAdd}
            error={error}
            submitting={submitting}
            canSubmitNew={canSubmitNew}
            canSubmitExisting={canSubmitExisting}
            onClose={onClose}
            onSubmitNew={handleSubmitNew}
            onSubmitExisting={handleSubmitExisting}
          />
        ) : success ? (
          <SuccessPhase success={success} onDone={handleDone} />
        ) : null}
      </div>
    </div>
  );
};

// ── Form phase ──────────────────────────────────────────────────────────────

interface FormPhaseProps {
  mode: FormMode;
  setMode: (m: FormMode) => void;
  count: number;
  title: string;
  setTitle: (s: string) => void;
  note: string;
  setNote: (s: string) => void;
  recipients: CollectionRecipient[];
  setRecipients: (r: CollectionRecipient[]) => void;
  search: string;
  setSearch: (s: string) => void;
  collectionsLoading: boolean;
  filteredCollections: CollectionListRow[];
  selectedCollection: CollectionListRow | undefined;
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  publishAfterAdd: boolean;
  setPublishAfterAdd: (b: boolean) => void;
  error: string | null;
  submitting: boolean;
  canSubmitNew: boolean;
  canSubmitExisting: boolean;
  onClose: () => void;
  onSubmitNew: () => void;
  onSubmitExisting: () => void;
}

const FormPhase: React.FC<FormPhaseProps> = ({
  mode, setMode, count, title, setTitle, note, setNote,
  recipients, setRecipients, search, setSearch,
  collectionsLoading, filteredCollections, selectedCollection,
  selectedCollectionId, setSelectedCollectionId,
  publishAfterAdd, setPublishAfterAdd, error, submitting,
  canSubmitNew, canSubmitExisting, onClose, onSubmitNew, onSubmitExisting,
}) => (
  <>
    <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-tea-gold-lt flex items-center justify-center flex-shrink-0">
          <BookOpen size={14} className="text-tea-gold" />
        </div>
        <div className="min-w-0">
          <h2 id="collection-share-title" className="text-sm font-medium text-tea-text tracking-wide">
            Share as Collection
          </h2>
          <p className="text-[11px] text-tea-text-dim mt-0.5">
            {count} product{count !== 1 ? 's' : ''} selected
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="text-tea-text-sec hover:text-tea-text transition-colors p-1 -mr-1 disabled:opacity-40"
        aria-label="Close"
      >
        <XIcon size={15} />
      </button>
    </header>

    <div className="px-5 pb-1 flex-shrink-0">
      <div role="tablist" className="grid grid-cols-2 gap-1 p-1 bg-tea-bg border border-tea-border rounded-lg">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'new'}
          onClick={() => setMode('new')}
          className={`flex items-center justify-center gap-1.5 py-2 text-[11px] uppercase tracking-wide rounded-md transition-colors ${
            mode === 'new' ? 'bg-tea-surface text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
          }`}
        >
          <Plus size={11} /> New collection
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'existing'}
          onClick={() => setMode('existing')}
          className={`flex items-center justify-center gap-1.5 py-2 text-[11px] uppercase tracking-wide rounded-md transition-colors ${
            mode === 'existing' ? 'bg-tea-surface text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
          }`}
        >
          <BookOpen size={11} /> Add to existing
        </button>
      </div>
    </div>

    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
      {mode === 'new' ? (
        <form
          // We intentionally don't submit; suppressing default keeps Enter from
          // refreshing the page when the user hits return on the title input.
          onSubmit={e => e.preventDefault()}
          className="flex flex-col gap-3"
          autoComplete="off"
          // off-list name keeps Chrome's password-manager and contact-fill
          // heuristics from latching onto these inputs as a contact form.
          data-form-purpose="collection-share"
        >
          <div>
            <label className="block text-[10px] uppercase tracking-[1.2px] text-tea-text-dim mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Spring 2026 for Saskia"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              name="collection-title"
              className="w-full px-3 py-2 text-sm bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[1.2px] text-tea-text-dim mb-1">
              Note <span className="text-tea-text-dim/70 normal-case tracking-normal">(optional — shown above the list)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="A short message for whoever opens the link…"
              rows={3}
              autoComplete="off"
              spellCheck
              name="collection-note"
              className="w-full px-3 py-2 text-sm bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[1.2px] text-tea-text-dim mb-1.5">
              Recipients
            </label>
            <RecipientTypeahead value={recipients} onChange={setRecipients} />
            <p className="text-[10px] text-tea-text-dim mt-2">
              Each recipient gets the same link. Pick from your contacts or add a new name.
            </p>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search your collections…"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              name="collection-search"
              className="w-full pl-8 pr-3 py-2 text-xs bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
            />
          </div>

          <div className="min-h-[100px]">
            {collectionsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-tea-text-dim text-xs">
                <Loader2 size={13} className="animate-spin" /> Loading collections…
              </div>
            ) : filteredCollections.length === 0 ? (
              <p className="py-8 text-xs text-tea-text-dim text-center">
                {search ? 'No collections match that search.' : 'No collections yet. Create a new one instead.'}
              </p>
            ) : (
              <ul className="space-y-1">
                {filteredCollections.map(c => {
                  const isSelected = c.id === selectedCollectionId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCollectionId(c.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          isSelected ? 'bg-tea-gold-lt' : 'bg-tea-bg hover:bg-tea-elevated'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-tea-gold' : 'bg-tea-surface'
                        }`}>
                          {isSelected && <Check size={10} className="text-tea-bg" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-tea-text truncate">{c.title}</p>
                          <p className="text-[11px] text-tea-text-dim truncate">
                            {c.item_count} product{c.item_count !== 1 ? 's' : ''} ·
                            {' '}{c.active_publication_count > 0
                              ? `${c.active_publication_count} active share${c.active_publication_count !== 1 ? 's' : ''}`
                              : c.status === 'draft' ? 'draft' : 'not shared yet'}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selectedCollection && (
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publishAfterAdd}
                  onChange={e => setPublishAfterAdd(e.target.checked)}
                  className="mt-[3px] accent-tea-gold"
                />
                <span className="text-xs text-tea-text">
                  Also share to new recipient(s)
                  <span className="block text-[10px] text-tea-text-dim mt-0.5">
                    Creates another link on the same collection.
                  </span>
                </span>
              </label>
              {publishAfterAdd && (
                <RecipientTypeahead value={recipients} onChange={setRecipients} />
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>

    <footer className="flex items-center justify-between gap-3 px-5 py-4 border-t border-tea-border flex-shrink-0">
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="text-xs text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40"
      >
        Cancel
      </button>
      {mode === 'new' ? (
        <button
          type="button"
          onClick={onSubmitNew}
          disabled={!canSubmitNew || submitting}
          className="flex items-center gap-2 px-4 py-2 bg-tea-gold text-tea-bg rounded-lg text-xs font-semibold tracking-wide hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting
            ? <><Loader2 size={12} className="animate-spin" /> Publishing…</>
            : <>Create &amp; share</>
          }
        </button>
      ) : (
        <button
          type="button"
          onClick={onSubmitExisting}
          disabled={!canSubmitExisting || submitting}
          className="flex items-center gap-2 px-4 py-2 bg-tea-gold text-tea-bg rounded-lg text-xs font-semibold tracking-wide hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting
            ? <><Loader2 size={12} className="animate-spin" /> Adding…</>
            : publishAfterAdd ? <>Add &amp; share</> : <>Add to collection</>
          }
        </button>
      )}
    </footer>
  </>
);

// ── Success phase ───────────────────────────────────────────────────────────

const SuccessPhase: React.FC<{ success: SuccessState; onDone: () => void }> = ({ success, onDone }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const url = success.publicationSlug
    ? `${window.location.origin}/c/${success.publicationSlug}`
    : null;

  const copyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — silent */ }
  };

  const recipientsWithPhone = success.recipients.filter(r => r.phone && r.phone.trim());
  const recipientsWithoutPhone = success.recipients.filter(r => !r.phone || !r.phone.trim());

  const buildRecipientMessage = (r: CollectionRecipient) => {
    const greeting = r.name ? `Hi ${r.name.split(' ')[0]} — ` : 'Hi — ';
    const intro = success.collectionNote
      ? `I made a small collection for you: ${success.collectionTitle}.`
      : `I made a small collection for you: ${success.collectionTitle}.`;
    const link = url ? `\n\n${url}` : '';
    return `${greeting}${intro}${link}`;
  };

  return (
    <>
      <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-tea-gold-lt flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={15} className="text-tea-gold" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-tea-text tracking-wide truncate">
              {url ? 'Shared.' : 'Added.'}
            </h2>
            <p className="text-[11px] text-tea-text-dim mt-0.5 truncate">
              {success.collectionTitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="text-tea-text-sec hover:text-tea-text transition-colors p-1 -mr-1"
          aria-label="Close"
        >
          <XIcon size={15} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 pt-2 flex flex-col gap-4">

        {url && (
          <div>
            <label className="block text-[10px] uppercase tracking-[1.2px] text-tea-text-dim mb-1.5">
              Shareable link
            </label>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 min-w-0 px-3 py-2 bg-tea-bg border border-tea-border rounded-lg overflow-hidden">
                <p className="text-[12px] text-tea-text font-mono truncate">{url}</p>
              </div>
              <button
                type="button"
                onClick={copyUrl}
                className="flex items-center gap-1.5 px-3 py-2 bg-tea-elevated text-tea-text rounded-lg text-[11px] uppercase tracking-wide hover:bg-tea-gold-lt hover:text-tea-gold transition-colors"
              >
                {copied
                  ? <><Check size={11} /> Copied</>
                  : <><Copy size={11} /> Copy</>
                }
              </button>
            </div>
          </div>
        )}

        {recipientsWithPhone.length > 0 && url && (
          <div>
            <label className="block text-[10px] uppercase tracking-[1.2px] text-tea-text-dim mb-1.5">
              Send via WhatsApp
            </label>
            <ul className="flex flex-col gap-1.5">
              {recipientsWithPhone.map((r, i) => (
                <li key={`${r.customer_id ?? 'n'}_${i}`}>
                  <a
                    href={buildWhatsAppUrl(r.phone || '', buildRecipientMessage(r))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2.5 bg-tea-bg border border-tea-border rounded-lg hover:border-tea-gold/40 hover:bg-tea-elevated transition-colors group"
                  >
                    <MessageCircle size={13} className="text-tea-gold flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-tea-text truncate">{r.name}</p>
                      <p className="text-[10px] text-tea-text-dim truncate font-mono">{r.phone}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-[1.2px] text-tea-text-sec group-hover:text-tea-gold transition-colors">
                      Send
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recipientsWithoutPhone.length > 0 && url && (
          <div className="px-3 py-2.5 bg-tea-bg rounded-lg">
            <p className="text-[10px] uppercase tracking-[1.2px] text-tea-text-dim mb-1">
              No phone on file
            </p>
            <p className="text-[11px] text-tea-text-sec">
              Copy the link and send it to{' '}
              {recipientsWithoutPhone.map((r, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (i === recipientsWithoutPhone.length - 1 ? ' and ' : ', ')}
                  <span className="text-tea-text">{r.name}</span>
                </React.Fragment>
              ))}{' '}
              however suits.
            </p>
          </div>
        )}

        {!url && (
          <div className="px-3 py-3 bg-tea-bg rounded-lg">
            <p className="text-[12px] text-tea-text">
              Added {success.addedCount} product{success.addedCount !== 1 ? 's' : ''} to this collection.
            </p>
            <p className="text-[11px] text-tea-text-dim mt-1">
              Open the collection to share, edit, or publish.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => { navigate(`/admin/collections/${success.collectionId}`); onDone(); }}
          className="flex items-center justify-between px-3 py-2.5 bg-tea-bg border border-tea-border rounded-lg hover:border-tea-gold/40 hover:bg-tea-elevated transition-colors group"
        >
          <span className="text-[12px] text-tea-text">View collection</span>
          <ArrowRight size={13} className="text-tea-text-sec group-hover:text-tea-gold transition-colors" />
        </button>
      </div>

      <footer className="flex items-center justify-end gap-3 px-5 py-4 border-t border-tea-border flex-shrink-0">
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 bg-tea-gold text-tea-bg rounded-lg text-xs font-semibold tracking-wide hover:bg-tea-gold/90 transition-colors"
        >
          Done
        </button>
      </footer>
    </>
  );
};
