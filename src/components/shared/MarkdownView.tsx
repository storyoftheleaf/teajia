import React, { useMemo } from 'react';

/**
 * MarkdownView, a compact, dependency-free markdown renderer scoped to the
 * subset of markdown the Teajia development docs actually use: headings,
 * paragraphs, ordered/unordered lists, GFM tables, fenced + inline code,
 * blockquotes, horizontal rules, bold/italic, and links. It is intentionally
 * NOT a full CommonMark implementation, it exists so the in-app Developer
 * Docs reader can render the repo's docs without pulling the react-markdown /
 * remark / rehype tree into the bundle.
 *
 * Styling uses tea tokens only (no raw white, no bright borders), matching the
 * editorial register of the rest of the app.
 */

type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'code'; text: string; lang?: string }
  | { kind: 'quote'; text: string }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'hr' };

function splitTableRow(line: string): string[] {
  // Trim the outer pipes, then split on unescaped pipes.
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    let line = lines[i];

    // Fenced code
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      const lang = fence[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ kind: 'code', text: buf.join('\n'), lang });
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push({ kind: 'h', level: h[1].length, text: h[2].trim() });
      i++;
      continue;
    }

    // Table: a header row followed by a divider row
    if (line.includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const header = splitTableRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', text: buf.join(' ') });
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    // Paragraph, gather until blank line or a block starter
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ kind: 'p', text: buf.join(' ') });
  }

  return blocks;
}

/** Render inline markdown (bold, italic, code, links) to React nodes. */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Token pattern: inline code, bold, italic, or links.
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*|_[^_]+_)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${n++}`;
    if (tok.startsWith('`')) {
      nodes.push(
        <code key={key} className="px-1 py-0.5 rounded bg-tea-elevated text-tea-gold-lt text-ui-13 font-mono">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith('**')) {
      nodes.push(<strong key={key} className="font-semibold text-tea-text">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('[')) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) {
        const href = lm[2];
        const external = /^https?:\/\//.test(href);
        nodes.push(
          external ? (
            <a key={key} href={href} target="_blank" rel="noreferrer" className="text-tea-gold-lt underline underline-offset-2 hover:text-tea-gold">
              {lm[1]}
            </a>
          ) : (
            // Internal repo path, render as plain emphasized text, not a dead link.
            <span key={key} className="text-tea-text-sec italic">{lm[1]}</span>
          ),
        );
      } else {
        nodes.push(tok);
      }
    } else {
      // italic (* or _)
      nodes.push(<em key={key} className="italic text-tea-text">{tok.slice(1, -1)}</em>);
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const HEADING_CLASSES: Record<number, string> = {
  1: 'font-display text-ui-26 text-tea-text mt-2 mb-4 tracking-[0.01em]',
  2: 'font-display text-ui-20 text-tea-text mt-8 mb-3 tracking-[0.01em]',
  3: 'font-sans text-ui-16 font-semibold text-tea-text mt-6 mb-2',
  4: 'font-sans text-ui-14 font-semibold text-tea-text-sec mt-5 mb-2 uppercase tracking-[0.06em]',
  5: 'font-sans text-ui-13 font-semibold text-tea-text-sec mt-4 mb-1',
  6: 'font-sans text-ui-12 font-semibold text-tea-text-dim mt-4 mb-1',
};

export const MarkdownView: React.FC<{ source: string }> = ({ source }) => {
  const blocks = useMemo(() => parseBlocks(source), [source]);

  return (
    <div className="max-w-none">
      {blocks.map((b, idx) => {
        const key = `b-${idx}`;
        switch (b.kind) {
          case 'h':
            return (
              <div key={key} className={HEADING_CLASSES[b.level] ?? HEADING_CLASSES[6]}>
                {renderInline(b.text, key)}
              </div>
            );
          case 'p':
            return (
              <p key={key} className="font-serif text-ui-15 leading-[1.7] text-tea-text-sec mb-4">
                {renderInline(b.text, key)}
              </p>
            );
          case 'ul':
            return (
              <ul key={key} className="list-disc pl-5 mb-4 space-y-1.5">
                {b.items.map((it, j) => (
                  <li key={j} className="font-serif text-ui-15 leading-[1.65] text-tea-text-sec marker:text-tea-gold/50">
                    {renderInline(it, `${key}-${j}`)}
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} className="list-decimal pl-5 mb-4 space-y-1.5">
                {b.items.map((it, j) => (
                  <li key={j} className="font-serif text-ui-15 leading-[1.65] text-tea-text-sec marker:text-tea-text-dim">
                    {renderInline(it, `${key}-${j}`)}
                  </li>
                ))}
              </ol>
            );
          case 'code':
            return (
              <pre key={key} className="mb-4 p-4 rounded-xl bg-tea-elevated overflow-x-auto">
                <code className="font-mono text-ui-13 leading-[1.6] text-tea-text-sec whitespace-pre">{b.text}</code>
              </pre>
            );
          case 'quote':
            return (
              <blockquote key={key} className="mb-4 pl-4 border-l-2 border-tea-gold/40 font-serif text-ui-15 italic leading-[1.65] text-tea-text-sec">
                {renderInline(b.text, key)}
              </blockquote>
            );
          case 'hr':
            return <hr key={key} className="my-6 border-tea-border" />;
          case 'table':
            return (
              <div key={key} className="mb-4 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      {b.header.map((h, j) => (
                        <th key={j} className="py-2 pr-4 font-sans text-ui-12 font-semibold uppercase tracking-[0.05em] text-tea-text-dim border-b border-tea-border">
                          {renderInline(h, `${key}-h-${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c} className="py-2 pr-4 font-serif text-ui-14 leading-[1.55] text-tea-text-sec border-b border-tea-border align-top">
                            {renderInline(cell, `${key}-${r}-${c}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
};

export default MarkdownView;
