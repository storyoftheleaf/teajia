import React, { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TEA_TYPES, type TeaType } from './types';
import { getTeaColor } from '../../designTokens';

interface BatchCaptureRowProps {
  onAdded?: (id: string) => void;
}

export const BatchCaptureRow: React.FC<BatchCaptureRowProps> = ({ onAdded }) => {
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const commitEntry = useTeaCompassStore((s) => s.commitEntry);
  const setActiveEntry = useTeaCompassStore((s) => s.setActiveEntry);

  const [name, setName] = useState('');
  const [type, setType] = useState<TeaType | ''>('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAdd = () => {
    if (!name.trim()) {
      nameRef.current?.focus();
      return;
    }

    const id = startNewCapture('tea');
    const updates: Record<string, unknown> = { name: name.trim() };
    if (type) updates.type = type;
    updateEntry(id, updates);
    commitEntry(id); // immediately commit as a minimal entry

    setFeedback(name.trim());
    setName('');
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 1500);
    nameRef.current?.focus();
    onAdded?.(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAdd();
  };

  const typeColor = type ? getTeaColor(type) : null;

  return (
    <div className="space-y-1.5 mb-3">
      <div className="flex items-center gap-1.5">
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Quick add tea name…"
          className="flex-1 min-w-0 bg-tea-surface/60 text-tea-text text-[13px] rounded-lg px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none placeholder:text-tea-text-dim"
        />

        {/* Type picker */}
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TeaType | '')}
          className="shrink-0 bg-tea-surface/60 text-[12px] rounded-lg px-2 py-2 border border-tea-border outline-none focus:border-tea-gold/40 appearance-none cursor-pointer"
          style={typeColor ? { color: typeColor, borderColor: `${typeColor}40` } : { color: 'var(--tea-text-dim)' }}
        >
          <option value="">Type</option>
          {TEA_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!name.trim()}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-tea-gold/10 text-tea-gold hover:bg-tea-gold/20 transition-colors disabled:opacity-30 disabled:cursor-default"
          title="Add to session"
        >
          <Plus size={14} />
        </button>
      </div>

      {feedback && (
        <p className="text-[10px] text-tea-gold/70 px-1">
          + {feedback} added
        </p>
      )}
    </div>
  );
};

export default BatchCaptureRow;
