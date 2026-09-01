import React from 'react';
import type { InventoryItem } from '../../../types';
import { resolveTermLabel } from '../../../data/tastingTaxonomy';

interface AlcoveAboutSectionProps {
  item: InventoryItem;
  magazineUrl?: string;
  /** Historical / cultural lore (item.lore). */
  mainStory: string;
  /** Personal / tasting notes (item.description). Rendered only when present. */
  introduction: string;
  /** Experience prose (item.experience). Rendered only when present. */
  feelingDescription: string;
  terroir: string;
  processing: string;
  mood: string;
}

/**
 * "About this tea": each populated field renders as its own labeled block
 * (TERROIR / PROCESSING / MOOD / EXPERIENCE), not concatenated into one blob.
 * so no section repeats and each reads clearly. `description` is treated as
 * personal / tasting notes and only renders when it actually has content, so
 * an empty or AI-authored-experience never clutters the page.
 */
export const AlcoveAboutSection: React.FC<AlcoveAboutSectionProps> = ({
  item,
  magazineUrl,
  mainStory,
  introduction,
  feelingDescription,
  terroir,
  processing,
  mood,
}) => {
  const brewingTerms = item.tasting?.brewing ?? [];
  const hasBrewing = brewingTerms.length > 0;
  const teaser = item.tasting?.teaser?.trim() || '';

  const hasAny =
    Boolean(teaser) ||
    Boolean(introduction.trim()) ||
    Boolean(mainStory.trim()) ||
    Boolean(terroir.trim()) ||
    Boolean(processing.trim()) ||
    Boolean(mood.trim()) ||
    Boolean(feelingDescription.trim());
  if (!hasAny && !hasBrewing) return null;

  const paragraphClass =
    'm-0 whitespace-pre-line font-body text-ui-14 font-normal leading-[1.75] text-tea-text-sec [&+p]:mt-[9px]';
  const headingClass =
    'm-0 font-sans text-ui-10 uppercase tracking-[0.2em] text-tea-text-dim [&:not(:first-child)]:mt-5 first:mt-0';

  // Render prose that may carry simple `## Section` markdown headers as real
  // labels instead of literal '##' characters. Split on lines that begin with
  // '## '; those become heading rows, everything else stays a paragraph.
  function renderMarkdown(text: string) {
    const lines = text.split('\n');
    const blocks: React.ReactNode[] = [];
    let para: string[] = [];
    let key = 0;
    const flush = () => {
      const content = para.join('\n').trim();
      if (content) {
        blocks.push(<p key={`p${key++}`} className={paragraphClass}>{content}</p>);
      }
      para = [];
    };
    for (const line of lines) {
      if (/^#{1,3}\s+/.test(line)) {
        flush();
        const label = line.replace(/^#{1,3}\s+/, '').trim();
        if (label) blocks.push(<p key={`h${key++}`} className={headingClass}>{label}</p>);
      } else {
        para.push(line);
      }
    }
    flush();
    return blocks;
  }

  function labeledSection(label: string, body: string) {
    if (!body.trim()) return null;
    return (
      <div className="[&:not(:first-child)]:mt-5 first:mt-0">
        <p className={headingClass}>{label}</p>
        <div className="mt-1.5">{renderMarkdown(body)}</div>
      </div>
    );
  }

  return (
    <section aria-label="About this tea">
      <div className="px-5">
        {/* Teaser first: the user-entered one-liner, shown only when present. */}
        {teaser && (
          <p className="m-0 font-display text-ui-18 leading-[1.45] text-tea-text [text-wrap:balance]">
            {teaser}
          </p>
        )}
        {/* Order: Lore (when present), then Terroir, Processing, Mood, Experience. */}
        {mainStory.trim() && (
          <div className="[&:not(:first-child)]:mt-5 first:mt-0">
            <p className={headingClass}>Lore</p>
            <div className="mt-1.5">{renderMarkdown(mainStory)}</div>
          </div>
        )}
        {labeledSection('Terroir', terroir)}
        {labeledSection('Processing', processing)}
        {labeledSection('Mood', mood)}
        {labeledSection('Experience', feelingDescription)}
      </div>

      {/* DESCRIPTION. Adrian's personal / tasting notes. Only shown when present. */}
      {introduction.trim() && (
        <div className="mx-5 mt-5 border-t border-tea-border pt-4">
          <p className={headingClass}>Adrian&apos;s notes</p>
          <div className="mt-1.5">{renderMarkdown(introduction)}</div>
        </div>
      )}

      {hasBrewing && (
        <div className="mx-5 mt-3.5 grid grid-cols-[92px_1fr] items-start py-2.5">
          <div className="pt-[3px] font-sans text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim">
            Brewing
          </div>
          <div className="font-body text-[13.5px] leading-[1.6] text-tea-text-sec">
            {brewingTerms.map(termId => resolveTermLabel(termId)).join(' · ')}
          </div>
        </div>
      )}
    </section>
  );
};