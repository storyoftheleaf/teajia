import React from 'react';
import type { InventoryItem } from '../../../types';
import { resolveTermLabel } from '../../../data/tastingTaxonomy';
import { AlcoveSectionHeading } from './AlcoveSectionHeading';

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
  /**
   * 'card' is the quiet modal card, where a chapter label is a 10px whisper
   * over 14px prose because the whole card is a glance.
   *
   * 'page' is the product page, where this section IS the page: the label
   * becomes the centred rule-and-word mark that names a chapter, and the prose
   * steps up to reading size in reading ink. The 14px secondary text was the
   * single thing that made the page feel thin.
   */
  variant?: 'card' | 'page';
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
  variant = 'card',
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

  const onPage = variant === 'page';

  const paragraphClass = onPage
    ? 'm-0 whitespace-pre-line font-body text-[16.5px] font-normal leading-[1.82] text-tea-text-sec [text-wrap:pretty] [&+p]:mt-3 lg:text-ui-17'
    : 'm-0 whitespace-pre-line font-body text-ui-14 font-normal leading-[1.75] text-tea-text-sec [&+p]:mt-[9px]';

  /*
   * Inside the prose, a `## ` line is the author's own title for the passage.
   * On the card it stays a small caps label; on the page it becomes a real
   * heading in the display serif, which is the one line the reader lands on
   * after the chapter mark.
   */
  const headingClass = onPage
    ? 'm-0 font-display text-[23px] font-medium leading-[1.26] text-tea-text [text-wrap:balance] [&:not(:first-child)]:mt-7 first:mt-0 lg:text-[25px]'
    : 'm-0 font-sans text-ui-10 uppercase tracking-[0.2em] text-tea-text-dim [&:not(:first-child)]:mt-5 first:mt-0';

  /** The chapter's own name: a whisper on the card, a marked rule on the page. */
  function sectionLabel(label: string) {
    return onPage
      ? <AlcoveSectionHeading label={label} size="lg" className="mb-[18px] lg:mb-5" />
      : <p className={headingClass}>{label}</p>;
  }

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
      <div className={onPage ? '[&:not(:first-child)]:mt-9 first:mt-0 lg:[&:not(:first-child)]:mt-11' : '[&:not(:first-child)]:mt-5 first:mt-0'}>
        {sectionLabel(label)}
        <div className={onPage ? '' : 'mt-1.5'}>{renderMarkdown(body)}</div>
      </div>
    );
  }

  return (
    <section aria-label="About this tea">
      <div className="px-5">
        {/* Teaser first: the user-entered one-liner, shown only when present. */}
        {teaser && (
          <p
            className={`m-0 font-display leading-[1.45] text-tea-text [text-wrap:balance] ${
              onPage ? 'mb-9 text-center text-ui-20 lg:mb-11 lg:text-[23px]' : 'text-ui-18'
            }`}
          >
            {teaser}
          </p>
        )}
        {/* Order: Lore (when present), then Terroir, Processing, Mood, Experience. */}
        {mainStory.trim() && (
          <div className={onPage ? '[&:not(:first-child)]:mt-9 first:mt-0 lg:[&:not(:first-child)]:mt-11' : '[&:not(:first-child)]:mt-5 first:mt-0'}>
            {sectionLabel('Lore')}
            <div className={onPage ? '' : 'mt-1.5'}>{renderMarkdown(mainStory)}</div>
          </div>
        )}
        {labeledSection('Terroir', terroir)}
        {labeledSection('Processing', processing)}
        {labeledSection('Mood', mood)}
        {labeledSection('Experience', feelingDescription)}
      </div>

      {/* DESCRIPTION. Adrian's personal / tasting notes. Only shown when present. */}
      {introduction.trim() && (
        <div className={onPage ? 'mx-5 mt-9 lg:mt-11' : 'mx-5 mt-5 border-t border-tea-border pt-4'}>
          {sectionLabel('Adrian\u2019s notes')}
          <div className={onPage ? '' : 'mt-1.5'}>{renderMarkdown(introduction)}</div>
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