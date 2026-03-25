import React, { useRef, useState, useCallback } from 'react';

interface NotesFieldProps {
  notes: string;
  onNotesChange: (notes: string) => void;
}

export const NotesField: React.FC<NotesFieldProps> = ({ notes, onNotesChange }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onNotesChange(e.target.value);
    },
    [onNotesChange]
  );

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);

  // Append a new line when there's existing content and user starts typing after blur
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && notes.trim().length > 0) {
        // Allow default Enter behavior -- natural line breaks
      }
    },
    [notes]
  );

  return (
    <div className="space-y-1">
      <label className="text-xs text-tea-text-dim uppercase tracking-wider">
        Notes
      </label>
      <textarea
        ref={textareaRef}
        value={notes}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Tasting impressions, vendor details, anything..."
        rows={focused ? 5 : 3}
        className="w-full bg-tea-surface text-tea-text border border-tea-border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-tea-gold transition-all"
      />
    </div>
  );
};

export default NotesField;
