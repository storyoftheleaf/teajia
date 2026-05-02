import React, { useState, useRef } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Upload, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';
import { useToast } from './Toast';
import { BriefingCard } from '../../types/events';

interface BriefingCardsEditorProps {
  cards: BriefingCard[];
  onChange: (cards: BriefingCard[]) => void;
  saving?: boolean;
}

export const BriefingCardsEditor: React.FC<BriefingCardsEditorProps> = ({
  cards,
  onChange,
  saving,
}) => {
  const { showToast } = useToast();
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const addCard = () => {
    const next: BriefingCard = { text: '', order: cards.length };
    onChange([...cards, next]);
  };

  const removeCard = (idx: number) => {
    const next = cards
      .filter((_, i) => i !== idx)
      .map((c, i) => ({ ...c, order: i }));
    onChange(next);
  };

  const updateCard = (idx: number, patch: Partial<BriefingCard>) => {
    const next = cards.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next);
  };

  const moveCard = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next.map((c, i) => ({ ...c, order: i })));
  };

  const handleImageUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIdx(idx);
    try {
      const compressed = await compressImage(file);
      const url = await api.uploadImage(compressed);
      updateCard(idx, { imageUrl: url });
      showToast('Photo uploaded', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploadingIdx(null);
      // reset file input
      if (fileRefs.current[idx]) fileRefs.current[idx]!.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-ui-11 uppercase tracking-[0.18em] text-tea-text-sec font-medium">
            Guest Briefing
          </h3>
          <p className="text-ui-11 text-tea-text-dim mt-0.5">
            Cards shown to guests after approval.
          </p>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {cards.map((card, idx) => (
          <motion.div
            key={idx}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.22 }}
            className="bg-tea-bg/30 border border-tea-border rounded-md p-3 space-y-3"
          >
            {/* Card header */}
            <div className="flex items-center justify-between">
              <span className="text-ui-10 uppercase tracking-caps text-tea-text-dim">
                Card {idx + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveCard(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 text-tea-text-dim hover:text-tea-text-sec disabled:opacity-25 transition-colors"
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => moveCard(idx, 1)}
                  disabled={idx === cards.length - 1}
                  className="p-1 text-tea-text-dim hover:text-tea-text-sec disabled:opacity-25 transition-colors"
                >
                  <ArrowDown size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => removeCard(idx)}
                  className="p-1 text-tea-text-dim hover:text-tea-text-sec transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            {/* Photo upload */}
            <div>
              {card.imageUrl ? (
                <div className="relative w-full h-28 rounded overflow-hidden border border-tea-border">
                  <img
                    src={card.imageUrl}
                    alt={`Card ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => updateCard(idx, { imageUrl: undefined })}
                    className="absolute top-1.5 right-1.5 bg-tea-bg/80 text-tea-text p-0.5 rounded-full hover:bg-tea-bg transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRefs.current[idx]?.click()}
                  disabled={uploadingIdx === idx}
                  className="w-full h-16 border border-dashed border-tea-border rounded flex items-center justify-center gap-2 text-tea-text-dim hover:text-tea-text-sec hover:border-tea-gold/30 transition-colors text-xs"
                >
                  {uploadingIdx === idx ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Upload size={13} />
                  )}
                  <span>{uploadingIdx === idx ? 'Uploading...' : 'Add photo (optional)'}</span>
                </button>
              )}
              <input
                ref={(el) => { fileRefs.current[idx] = el; }}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(idx, e)}
                className="hidden"
              />
            </div>

            {/* Text */}
            <textarea
              value={card.text}
              onChange={(e) => updateCard(idx, { text: e.target.value })}
              placeholder="1–2 sentences. The space, what to bring, the rhythm."
              className="w-full border border-tea-border bg-transparent focus:border-tea-gold/60 outline-none text-sm text-tea-text p-2 rounded placeholder:text-tea-text-dim resize-none min-h-[60px]"
              rows={2}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addCard}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors"
        >
          <Plus size={12} /> Add Card
        </button>
        {cards.length > 0 && (
          <span className="text-ui-10 text-tea-text-dim">
            Keep each card to 1–2 sentences.
          </span>
        )}
      </div>
    </div>
  );
};
