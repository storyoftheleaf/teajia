import React from 'react';
import { Link } from 'react-router-dom';
import { QUIET_LINK } from '../../../pages/wisdom/frame';
import type { ProductReading } from '../productDetailFields';
import { resolveTermLabel } from '../../../data/tastingTaxonomy';
import { AlcoveSectionHeading } from './AlcoveSectionHeading';

export function AlcoveAboutSection({
  reading, variant = 'card',
}: { reading: ProductReading; variant?: 'card' | 'page' }) {
  const { label, teaser, sections, brewing = [] } = reading;
  const populated = sections.filter(section => section.paragraphs?.length || section.links?.length);
  if (!teaser && !populated.length && !brewing.length) return null;
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

  return (
    <section aria-label={label} className={onPage ? 'mt-10 lg:mt-12' : undefined}>
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
        {populated.map(section => (
          <div key={section.label} className={onPage ? '[&:not(:first-child)]:mt-9 first:mt-0 lg:[&:not(:first-child)]:mt-11' : '[&:not(:first-child)]:mt-5 first:mt-0'}>
            {sectionLabel(section.label)}
            {section.paragraphs?.map((text, index) => (
              <div key={index} className={onPage ? '' : 'mt-1.5'}>{renderMarkdown(text)}</div>
            ))}
            {section.links?.length ? (
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {section.links.map(link => <li key={link.name}>
                  {link.href ? <Link className={`${QUIET_LINK} tap-target inline-flex items-center`} to={link.href}>{link.name} →</Link> : link.name}
                </li>)}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      {brewing.length > 0 && (
        <div className="mx-5 mt-3.5 grid grid-cols-[92px_1fr] items-start py-2.5">
          <div className="pt-[3px] font-sans text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim">
            Brewing
          </div>
          <div className="font-body text-[13.5px] leading-[1.6] text-tea-text-sec">
            {brewing.map(termId => resolveTermLabel(termId)).join(' · ')}
          </div>
        </div>
      )}
    </section>
  );
}
