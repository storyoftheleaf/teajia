import React from 'react';
import { ContributorIdentityMark } from '../../../components/shared/ContributorIdentityMark';
import { Dek, Kicker, SplitName } from '../../../components/people/immersive';
import { coverKicker, ownLine } from '../../../components/people/profileFormat';
import type { ContributorWrite } from '../../../types';
import { LABEL } from './parts';
import { mediaUrl } from '../../../lib/mediaUrl';

/** The public cover's size on a 390px phone: the page's max width less its 24px sides, 420 tall. */
export const COVER_PHONE = { width: 342, height: 420 };

/**
 * The top of /people/:slug as it will read on a phone, drawn from what is in
 * the editor right now: the portrait at its focal point, the fade, the kicker,
 * the name with its italic surname, the one line in their own words. Below it,
 * what the rest of the page will carry and what it will not, so an empty
 * section is a decision you can see rather than a surprise after publishing.
 */
export function PageProof({ form, galleryCount, linkCount, slug, published }: { form: ContributorWrite; galleryCount: number; linkCount: number; slug: string; published: boolean }) {
  const portrait = mediaUrl(form.portrait_url || form.avatar_url || null) ?? null;
  const focus = form.portrait_url ? form.portrait_focus : form.avatar_focus;
  const name = form.display_name?.trim() || 'Their name';
  const kicker = coverKicker(form.role, form.location_line);
  const line = ownLine(form);
  const hasWords = Boolean(form.beginnings?.trim() || form.now_text?.trim() || form.inspirations?.trim());

  const carries: Array<{ label: string; state: string; absent: boolean }> = [
    { label: 'In my words', state: hasWords ? 'on the page' : 'nothing written yet', absent: !hasWords },
    { label: 'Hands on', state: galleryCount ? `${galleryCount} ${galleryCount === 1 ? 'photo' : 'photos'}` : 'no photos yet', absent: !galleryCount },
    { label: 'Reach me', state: linkCount ? `${linkCount} ${linkCount === 1 ? 'way' : 'ways'}` : 'no links yet', absent: !linkCount },
    { label: 'Closing', state: form.closing?.trim() ? 'on the page' : 'no closing line', absent: !form.closing?.trim() },
  ];

  return (
    <div data-testid="page-proof">
      <div className="flex items-baseline justify-between gap-3">
        <p className={LABEL}>The page, on a phone</p>
        {published && slug && (
          <a href={`/people/${encodeURIComponent(slug)}`} target="_blank" rel="noreferrer" className="tap-target font-sans text-ui-12 text-tea-text-sec underline decoration-tea-border underline-offset-4 hover:text-tea-text">Open it</a>
        )}
      </div>
      <div
        className="relative mt-3 flex w-full flex-col justify-end overflow-hidden bg-tea-surface text-tea-text"
        style={{ maxWidth: COVER_PHONE.width, height: COVER_PHONE.height, border: '1px solid rgb(var(--tea-gold-rgb) / 0.24)' }}
        aria-label="Preview of the cover"
      >
        {portrait ? (
          <img src={portrait} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: focus ?? undefined }} />
        ) : (
          <span className="absolute inset-0"><ContributorIdentityMark name={name} /></span>
        )}
        <span aria-hidden className="absolute inset-x-0 bottom-0" style={{ height: '56%', background: 'linear-gradient(to top, rgb(var(--tea-bg-rgb) / 1), rgb(var(--tea-bg-rgb) / 0))' }} />
        <span className="relative block p-6">
          {kicker && <Kicker className="mb-3">{kicker}</Kicker>}
          <span className={`block font-display text-[40px] leading-[0.98] ${form.display_name?.trim() ? 'text-tea-text' : 'text-tea-text-dim'}`}><SplitName name={name} /></span>
          {form.chinese_name?.trim() && <span className="mt-2 block text-[22px] leading-none tracking-wider text-tea-readgold" style={{ fontFamily: "'Ma Shan Zheng','Noto Serif SC',cursive" }}>{form.chinese_name}</span>}
          {line && <Dek className="mt-3 max-w-[30ch] text-ui-14">{line}</Dek>}
        </span>
      </div>

      <ul className="mt-5 max-w-[342px]" aria-label="What the page carries">
        {carries.map(item => (
          <li key={item.label} className="flex items-baseline justify-between gap-4 border-b border-tea-border py-2.5">
            <span className={`font-sans text-ui-10 font-medium uppercase tracking-display ${item.absent ? 'text-tea-text-dim' : 'text-tea-text-sec'}`}>{item.label}</span>
            <span className={`font-body text-ui-13 italic ${item.absent ? 'text-tea-text-dim' : 'text-tea-text'}`}>{item.state}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
