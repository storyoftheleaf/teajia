import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, Send, HelpCircle, SkipForward } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, ApiError } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

// R9 askable-fields whitelist (mirrored from the worker's CHAT_ASKABLE_FIELDS).
// The server also enforces this; the client-side copy just keeps the picker
// in sync with what the endpoint will actually accept.
type AskableField =
  | 'vendor' | 'origin_country' | 'purchase_location' | 'shipping_mode'
  | 'pack_count' | 'weight_grams' | 'price_paid' | 'cost_currency' | 'purchase_date';

const ASKABLE_FIELDS: { value: AskableField; label: string; kind: 'text' | 'number' | 'date' }[] = [
  { value: 'vendor',            label: 'Vendor',            kind: 'text'   },
  { value: 'origin_country',    label: 'Origin country',    kind: 'text'   },
  { value: 'purchase_location', label: 'Purchase location', kind: 'text'   },
  { value: 'shipping_mode',     label: 'Shipping mode',     kind: 'text'   },
  { value: 'pack_count',        label: 'Pack count',        kind: 'number' },
  { value: 'weight_grams',      label: 'Weight (g)',        kind: 'number' },
  { value: 'price_paid',        label: 'Price paid',        kind: 'number' },
  { value: 'cost_currency',     label: 'Currency',          kind: 'text'   },
  { value: 'purchase_date',     label: 'Purchase date',     kind: 'date'   },
];

export interface ChatAnswer {
  field: AskableField;
  kind: 'value' | 'unknown' | 'skip';
  value?: string;
}

interface Message {
  id: string;
  role: 'assistant' | 'operator';
  body: string;
  field?: AskableField;
  kind?: 'value' | 'unknown' | 'skip';
}

interface Props {
  importId: string;
  itemId: string;
  itemLabel?: string;
  onClose: () => void;
  onAnswered?: (answer: ChatAnswer) => void;
}

let seedId = 0;
const nextMessageId = () => `msg-${Date.now()}-${seedId++}`;

export const IntakeChatSheet: React.FC<Props> = ({ importId, itemId, itemLabel, onClose, onAnswered }) => {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: nextMessageId(),
      role: 'assistant',
      body: itemLabel
        ? `Ask about "${itemLabel}". Pick a field and type the answer, or use Unknown / Skip.`
        : 'Pick a field and type the answer, or use Unknown / Skip.',
    },
  ]);
  const [field, setField] = useState<AskableField>('vendor');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedField = useMemo(
    () => ASKABLE_FIELDS.find((f) => f.value === field) || ASKABLE_FIELDS[0],
    [field],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const post = async (kind: 'value' | 'unknown' | 'skip', value?: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const askedField = selectedField.value;
    const label = ASKABLE_FIELDS.find((f) => f.value === askedField)?.label ?? askedField;
    const bodyText =
      kind === 'value'  ? `${label}: ${value}` :
      kind === 'unknown' ? `${label}: unknown` :
                           `${label}: skip`;
    const optimisticId = nextMessageId();
    setMessages((prev) => [...prev, {
      id: optimisticId, role: 'operator', body: bodyText, field: askedField, kind,
    }]);
    try {
      await api.curateImports.chat(importId, {
        item_id: itemId,
        role: 'operator',
        body: bodyText,
        answers_field: askedField,
        answer_value: kind === 'value' ? value ?? null : null,
        answer_kind: kind,
        origin: 'web',
      });
      setMessages((prev) => [...prev, {
        id: nextMessageId(),
        role: 'assistant',
        body: kind === 'skip'
          ? `Skipped ${label}. Pick another field to continue.`
          : `Recorded ${label}. Pick another field to continue.`,
      }]);
      setText('');
      onAnswered?.({ field: askedField, kind, value });
    } catch (err) {
      // Roll back the optimistic operator bubble so the transcript reflects
      // what the server actually accepted.
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      if (err instanceof ApiError && err.data?.code === 'field_not_askable') {
        setError(`"${label}" is not askable in chat. Pick another field.`);
      } else if (err instanceof Error) {
        setError(err.message || 'Could not save that answer. Try again.');
      } else {
        setError('Could not save that answer. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const value = text.trim();
    if (!value) return;
    void post('value', value);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-modal bg-tea-bg/60 backdrop-blur-sm flex items-end lg:items-stretch lg:justify-end"
        onClick={onClose}
      >
        <motion.aside
          role="dialog"
          aria-label="Ask about this tea"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full lg:w-[420px] lg:max-w-md lg:h-full max-h-[85vh] bg-tea-surface border-t border-tea-border lg:border-t-0 lg:border-l rounded-t-xl lg:rounded-none flex flex-col"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Header: close X on the left per app cancel/back/close rules */}
          <header className="flex items-center gap-3 px-4 py-3 border-b border-tea-border">
            <button
              type="button"
              onClick={onClose}
              className="tap-target text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label="Close chat"
            >
              <X size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Ask about this tea</p>
              {itemLabel && (
                <p className="text-ui-13 text-tea-text truncate">{itemLabel}</p>
              )}
            </div>
          </header>

          {/* Transcript */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'operator' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-ui-13 leading-snug ${
                    m.role === 'operator'
                      ? 'bg-tea-gold/12 text-tea-text border border-tea-gold-lt'
                      : 'bg-tea-elevated text-tea-text-sec border border-tea-border'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <form onSubmit={submit} className="border-t border-tea-border px-4 py-3 space-y-2">
            {error && (
              <p className="text-ui-11 text-tea-gold">{error}</p>
            )}
            <div className="flex items-center gap-2">
              <label className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Field</label>
              <select
                value={field}
                onChange={(e) => { setField(e.target.value as AskableField); setError(null); }}
                className="flex-1 bg-tea-bg border border-tea-border rounded-md px-2 py-1.5 text-ui-12 text-tea-text focus:border-tea-gold outline-none"
              >
                {ASKABLE_FIELDS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type={selectedField.kind === 'number' ? 'number' : selectedField.kind === 'date' ? 'date' : 'text'}
                inputMode={selectedField.kind === 'number' ? 'decimal' : undefined}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Answer for ${selectedField.label.toLowerCase()}`}
                disabled={busy}
                className="flex-1 bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-13 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                className="cta-solid text-ui-12 px-3 py-2 rounded-md inline-flex items-center gap-1.5 disabled:opacity-50"
                aria-label="Send answer"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Send
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void post('unknown')}
                disabled={busy}
                className="tap-target inline-flex items-center gap-1.5 text-ui-11 px-2.5 py-1 rounded-full bg-tea-elevated border border-tea-border text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-50"
              >
                <HelpCircle size={11} /> Unknown
              </button>
              <button
                type="button"
                onClick={() => void post('skip')}
                disabled={busy}
                className="tap-target inline-flex items-center gap-1.5 text-ui-11 px-2.5 py-1 rounded-full bg-tea-elevated border border-tea-border text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-50"
              >
                <SkipForward size={11} /> Skip
              </button>
            </div>
          </form>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
};

export default IntakeChatSheet;
