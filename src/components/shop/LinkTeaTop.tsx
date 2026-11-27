/** The link's bit on top of the store page: one quiet line, and the sender's words when there are any. */
export function LinkTeaTop({ line, note, noteBy }: { line: string; note?: string | null; noteBy?: string }) {
  return (
    <div className="border-b border-tea-border bg-tea-elevated px-5 py-3 lg:px-10" data-testid="link-tea-top">
      <p className="label-caps text-tea-gold">{line}</p>
      {note?.trim() && (
        <p className="mt-1.5 font-body text-ui-15 italic leading-[1.6] text-tea-text" data-testid="collection-tea-writing">
          “{note.trim()}”{noteBy && <span className="not-italic text-ui-12 text-tea-text-dim">, {noteBy}</span>}
        </p>
      )}
    </div>
  );
}
