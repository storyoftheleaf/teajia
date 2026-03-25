import React, { useRef, useState, useCallback } from 'react';

const DELIMITER = '\n\n';

interface NotesFieldProps {
  notes: string;
  onNotesChange: (notes: string) => void;
}

export const NotesField: React.FC<NotesFieldProps> = ({ notes, onNotesChange }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);

  // Split stored notes into individual entries
  const noteEntries = notes
    ? notes.split(DELIMITER).filter((n) => n.trim().length > 0)
    : [];

  const commitNote = useCallback(() => {
    const trimmed = currentInput.trim();
    if (!trimmed) return;

    const updated = noteEntries.length > 0
      ? [...noteEntries, trimmed].join(DELIMITER)
      : trimmed;

    onNotesChange(updated);
    setCurrentInput('');
    textareaRef.current?.focus();
  }, [currentInput, noteEntries, onNotesChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commitNote();
      }
    },
    [commitNote]
  );

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);

  // Inline editing of previous notes
  const startEdit = useCallback((index: number) => {
    setEditingIndex(index);
    setEditValue(noteEntries[index]);
    setTimeout(() => editRef.current?.focus(), 0);
  }, [noteEntries]);

  const commitEdit = useCallback(() => {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    const updated = [...noteEntries];
    if (trimmed) {
      updated[editingIndex] = trimmed;
    } else {
      // Empty edit removes the note
      updated.splice(editingIndex, 1);
    }
    onNotesChange(updated.filter((n) => n.trim()).join(DELIMITER));
    setEditingIndex(null);
    setEditValue('');
  }, [editingIndex, editValue, noteEntries, onNotesChange]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commitEdit();
      }
      if (e.key === 'Escape') {
        setEditingIndex(null);
        setEditValue('');
      }
    },
    [commitEdit]
  );

  return (
    <div className="space-y-1">
      <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">
        Notes
      </label>

      {/* Previous note entries */}
      {noteEntries.length > 0 && (
        <div className="space-y-1 mb-2">
          {noteEntries.map((entry, i) => (
            <div key={i}>
              {editingIndex === i ? (
                <textarea
                  ref={editRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={handleEditKeyDown}
                  rows={2}
                  className="w-full bg-tea-surface/60 text-tea-text rounded-md px-3 py-1.5 border border-tea-border/10 focus:border-tea-gold/50 outline-none transition-colors text-sm resize-none"
                />
              ) : (
                <div
                  onClick={() => startEdit(i)}
                  className="pl-3 border-l-2 border-tea-border py-1 cursor-pointer hover:border-tea-gold transition-colors group"
                >
                  <p className="text-sm text-tea-text-sec whitespace-pre-wrap leading-relaxed group-hover:text-tea-text transition-colors">
                    {entry}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Current note input */}
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="What did the vendor say? Your impressions..."
          rows={focused ? 5 : 3}
          className="flex-1 bg-tea-surface/60 text-tea-text rounded-md px-3 py-1.5 border border-tea-border/10 focus:border-tea-gold/50 outline-none transition-colors text-sm resize-none"
        />
        {currentInput.trim() && (
          <button
            type="button"
            onClick={commitNote}
            className="text-xs text-tea-text-dim hover:text-tea-gold transition-colors px-2 py-1 mb-1 shrink-0"
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
};

export default NotesField;
