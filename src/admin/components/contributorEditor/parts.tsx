import React, { useLayoutEffect, useRef } from 'react';

// The contributor editor's type and controls. Rules in docs/CONTRIBUTOR_EDITOR.md:
// hairline underlines, not boxes; actions are words; bronze at full strength
// once per view (the Save button), everywhere else a hairline.

/** Field label: micro caps, three words at most. */
export const LABEL = 'block font-sans text-ui-10 font-medium uppercase tracking-display text-tea-text-sec';

/** A question asked in the person's own words, set as a sentence rather than micro caps (micro caps are for three words or fewer). */
export const QUESTION = 'block font-display text-ui-20 font-normal leading-snug text-tea-text';

/** A hairline field. The line brightens to bronze while the field is in use. */
const LINE = 'w-full rounded-none border-0 border-b border-tea-border bg-transparent px-0 text-tea-text placeholder:text-tea-text-dim/60 transition-colors focus:border-tea-gold focus:outline-none focus:ring-0 disabled:opacity-60';
export const LINE_SANS = `${LINE} min-h-11 py-2 font-sans text-ui-15`;
export const LINE_SERIF = `${LINE} min-h-11 py-2 font-body text-ui-16`;

/** A word that does something: Cormorant, reading bronze, a hairline under it. */
export const ACTION = 'tap-target inline-flex min-h-11 items-center border-b border-tea-border bg-transparent font-display text-ui-17 leading-none text-tea-readgold transition-colors hover:border-tea-gold hover:text-tea-gold-lt disabled:cursor-default disabled:border-transparent disabled:opacity-40';
/** The quiet version, for removing and reordering: secondary text, no line until hover. */
export const QUIET = 'tap-target inline-flex min-h-11 items-center border-b border-transparent bg-transparent font-sans text-ui-13 text-tea-text-sec transition-colors hover:border-tea-border hover:text-tea-text disabled:cursor-default disabled:opacity-40';

export function Section({ id, title, note, children, testId }: { id: string; title: string; note?: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <section aria-labelledby={`${id}-title`} className="border-t border-tea-border pt-9 pb-12 first:border-t-0 first:pt-2" data-testid={testId}>
      <h3 id={`${id}-title`} className="font-display text-ui-28 font-normal leading-tight text-tea-text">{title}</h3>
      {note && <p className="mt-1.5 max-w-[52ch] font-body text-ui-14 italic leading-relaxed text-tea-text-sec">{note}</p>}
      <div className="mt-7">{children}</div>
    </section>
  );
}

type LineProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: React.ReactNode; inputClassName?: string; labelClassName?: string; aside?: React.ReactNode };

export function Line({ label, hint, className = '', inputClassName = LINE_SANS, labelClassName = LABEL, aside, id, ...input }: LineProps) {
  const fieldId = id ?? `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className={labelClassName}>{label}</label>
        {aside}
      </div>
      <input id={fieldId} className={`mt-1 ${inputClassName}`} {...input} />
      {hint && <p className="mt-1.5 font-sans text-ui-12 leading-relaxed text-tea-text-dim">{hint}</p>}
    </div>
  );
}

type ProseProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: React.ReactNode; aside?: React.ReactNode; minRows?: number; labelClassName?: string };

/** A passage the person wrote, typed in Lora at reading size, growing with its text. */
export function Prose({ label, hint, aside, id, minRows = 3, className = '', labelClassName = LABEL, value, ...area }: ProseProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fieldId = id ?? `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const fit = () => {
      // A field inside a closed sheet measures nothing; leave it to its rows
      // until it is shown, or it would be pinned two pixels tall.
      if (!node.offsetParent) return;
      node.style.height = 'auto';
      node.style.height = `${node.scrollHeight + 2}px`;
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    let width = node.clientWidth;
    const observer = new ResizeObserver(() => {
      if (node.clientWidth === width) return;
      width = node.clientWidth;
      fit();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className={labelClassName}>{label}</label>
        {aside}
      </div>
      <textarea
        ref={ref}
        id={fieldId}
        rows={minRows}
        value={value}
        className={`mt-1 block resize-none overflow-hidden py-2.5 leading-[1.7] ${LINE_SERIF}`}
        {...area}
      />
      {hint && <p className="mt-1.5 font-sans text-ui-12 leading-relaxed text-tea-text-dim">{hint}</p>}
    </div>
  );
}

/** A thin counter for a field with a limit; bronze only once the limit is close. */
export function Count({ value, max }: { value: number; max: number }) {
  const near = value > max * 0.9;
  return <span className={`font-mono text-ui-11 tabular-nums ${near ? 'text-tea-readgold' : 'text-tea-text-dim'}`}>{value}/{max}</span>;
}
