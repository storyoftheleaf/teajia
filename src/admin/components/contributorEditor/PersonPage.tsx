import React from 'react';
import { CONTRIBUTOR_LINK_PLATFORMS, type ContributorGalleryImage, type ContributorLinkPlatform } from '../../../types';
import { mediaUrl } from '../../../lib/mediaUrl';
import { ACTION, Count, LABEL, LINE_SANS, Line, Prose, QUESTION, QUIET } from './parts';
import { PhotoPlace, type Crop } from './PhotoPlace';
import { GalleryPlace, GALLERY_IMAGE_LIMIT } from './GalleryPlace';
import { EditorRow, EditorSheet, type SheetId } from './CardParts';

// The person's page, as the person would fill it in. One card for the top of
// the page and three rows for the rest, every label a plain question in the
// second person. Shared by the shop's editor (/admin/contributors) and the
// tea master's own screen (/account/profile), so a contributor and Adrian see
// the same words. Rules and the reasoning: docs/CONTRIBUTOR_EDITOR.md.

export type PersonLink = { platform: ContributorLinkPlatform; value: string; qr_image_url?: string | null; label?: string | null };

/** Only what the public page shows. Everything else stays stored, untouched, out of sight. */
export type PersonValue = {
  display_name: string;
  chinese_name: string;
  role: string;
  location_line: string;
  now_text: string;
  beginnings: string;
  closing: string;
  portrait_url: string;
  portrait_focus: string | null;
  links: PersonLink[];
  gallery_images: ContributorGalleryImage[];
};

/** The crops the page makes of the portrait. */
export const PORTRAIT_CROPS: Crop[] = [
  { label: 'Phone', width: 342, height: 420 },
  { label: 'Computer', width: 576, height: 420 },
  { label: 'People list', width: 140, height: 180 },
];

/** Needed before a page can go live, in the words the person reads. */
export const MISSING_BEGINNINGS = 'Write how tea began for you before the page can go live.';

function platformWord(platform: ContributorLinkPlatform): string {
  switch (platform) {
    case 'wechat': return 'WeChat';
    case 'instagram': return 'Instagram';
    case 'website': return 'Website';
    default: return 'Other';
  }
}

function platformAsk(platform: ContributorLinkPlatform): string {
  switch (platform) {
    case 'wechat': return 'Your WeChat ID';
    case 'instagram': return 'Your Instagram name';
    case 'website': return 'Your website address';
    default: return 'The address';
  }
}

type Props = {
  value: PersonValue;
  onChange: (patch: Partial<PersonValue>) => void;
  onPortrait: (next: { url: string | null; focus: string | null }) => void;
  onGallery: (change: (images: ContributorGalleryImage[]) => ContributorGalleryImage[]) => void;
  markBusy: (key: string) => (busy: boolean) => void;
  sheet: SheetId | null;
  openSheet: (id: SheetId, from: HTMLElement | null) => void;
  closeSheet: () => void;
  /** A full-screen sheet for a normal page; the default sits inside a panel. */
  sheetMode?: 'panel' | 'page';
  takePortrait?: React.MutableRefObject<((files: File[]) => void) | null>;
  takeGallery?: React.MutableRefObject<((files: File[]) => void) | null>;
  /** Shown under the name, such as the page address for someone new. */
  afterName?: React.ReactNode;
  /** Rows only the shop sees, after the three everyone sees. */
  extraRows?: React.ReactNode;
  /** Offer a photo by web address. The shop can; a contributor places photos. */
  allowAddress?: boolean;
};

/**
 * The card and the rows. Returned in two parts because the card scrolls with
 * the page while the sheets sit over it, and the screen around them decides
 * where each goes.
 */
export function personPageParts(props: Props): { card: React.ReactNode; sheets: React.ReactNode } {
  const { value, onChange, onPortrait, onGallery, markBusy, sheet, openSheet, closeSheet, sheetMode = 'panel', takePortrait, takeGallery, afterName, extraRows, allowAddress = true } = props;
  const links = value.links;
  const gallery = value.gallery_images;
  const began = value.beginnings.trim();
  const updateLink = (index: number, next: Partial<PersonLink>) => onChange({ links: links.map((link, position) => position === index ? { ...link, ...next } : link) });

  const storyParts = [
    began && 'how it began',
    value.now_text.trim() && 'what you do now',
    value.closing.trim() && 'a last line',
  ].filter(Boolean) as string[];
  const storyDescription = storyParts.length
    ? `${storyParts[0].charAt(0).toUpperCase()}${storyParts[0].slice(1)}${storyParts.length > 1 ? `, ${storyParts.slice(1).join(', ')}` : ''}`
    : 'How tea began for you, and what you do now';

  const card = (
    <div className="grid gap-x-10 gap-y-8 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]" data-testid="contributor-card">
      <div className="min-w-0" data-testid="section-portrait">
        <PhotoPlace
          name="Portrait"
          testId="photo-portrait"
          url={value.portrait_url}
          focus={value.portrait_focus}
          onChange={onPortrait}
          crops={PORTRAIT_CROPS}
          purpose="A photo of you at work fills the top of your page best."
          emptyHeight={300}
          onBusy={markBusy('portrait')}
          takeRef={takePortrait}
          allowAddress={allowAddress}
        />
      </div>

      <div className="min-w-0 space-y-6">
        <Line
          label="Your name"
          id="f-name"
          value={value.display_name}
          onChange={event => onChange({ display_name: event.target.value })}
          placeholder="As you want it read"
          autoComplete="off"
          inputClassName="w-full rounded-none border-0 border-b border-tea-border bg-transparent px-0 py-1 font-display text-[34px] font-light leading-tight text-tea-text placeholder:text-tea-text-dim/60 focus:border-tea-gold focus:outline-none focus:ring-0 sm:text-[38px]"
        />
        {afterName}
        <Line label="Name in Chinese" id="f-chinese-name" value={value.chinese_name} onChange={event => onChange({ chinese_name: event.target.value })} placeholder="If you have one" inputClassName={`${LINE_SANS} font-body text-ui-17`} />
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
          <Line label="What you do" id="f-role" value={value.role} onChange={event => onChange({ role: event.target.value })} placeholder="Tea master, potter, grower" />
          <Line label="Where you are" id="f-place" value={value.location_line} onChange={event => onChange({ location_line: event.target.value })} placeholder="City, country" />
        </div>

        <nav className="pt-4" aria-label="The rest of your page">
          <EditorRow id="words" title="Your story" description={storyDescription} state={began ? 'Written' : 'Needed to publish'} needed={!began} onOpen={openSheet} />
          <EditorRow
            id="hands"
            title="Photos of your work"
            description={`Up to ${GALLERY_IMAGE_LIMIT}, shown in order on your page`}
            state={gallery.length ? `${gallery.length} of ${GALLERY_IMAGE_LIMIT}` : 'Not yet'}
            thumbs={gallery.slice(0, 3).map(image => mediaUrl(image.image_url)).filter((src): src is string => Boolean(src))}
            onOpen={openSheet}
          />
          <EditorRow id="reach" title="How people reach you" description={links.length ? links.map(link => link.platform === 'other' && link.label ? link.label : platformWord(link.platform)).join(', ') : 'Your website, Instagram or WeChat'} state={links.length ? `${links.length} ${links.length === 1 ? 'way' : 'ways'}` : 'Not yet'} onOpen={openSheet} />
          {extraRows}
        </nav>
      </div>
    </div>
  );

  const sheets = (
    <>
      <EditorSheet id="words" title="Your story" note="Write it the way you would say it across the table." open={sheet === 'words'} onClose={closeSheet} mode={sheetMode}>
        <div className="space-y-9">
          <Prose label="How did tea begin for you?" labelClassName={QUESTION} id="f-began" value={value.beginnings} onChange={event => onChange({ beginnings: event.target.value })} placeholder="Where it started, and who with." minRows={4} hint={began ? undefined : 'Needed before your page can go live.'} />
          <Prose label="What are you working on now?" labelClassName={QUESTION} id="f-now" value={value.now_text} onChange={event => onChange({ now_text: event.target.value })} placeholder="What fills your days with tea." minRows={4} hint="The first sentence also sits under your name at the top of the page." />
          <Prose label="A last line for your page" labelClassName={QUESTION} id="f-last-line" value={value.closing} maxLength={200} minRows={2} onChange={event => onChange({ closing: event.target.value })} placeholder="What you want to leave people with." aside={<Count value={value.closing.length} max={200} />} />
        </div>
      </EditorSheet>

      <EditorSheet id="hands" title="Photos of your work" note="Drop in photos of you at work. Tap one to write a line about it or move it." open={sheet === 'hands'} onClose={closeSheet} mode={sheetMode}>
        <div data-testid="section-gallery">
          <GalleryPlace images={gallery} update={onGallery} onBusy={markBusy('gallery')} takeRef={takeGallery} />
        </div>
      </EditorSheet>

      <EditorSheet id="reach" title="How people reach you" note="Each one becomes a line at the foot of your page." open={sheet === 'reach'} onClose={closeSheet} mode={sheetMode}>
        <div>
          {links.length === 0 && <p className="font-body text-ui-15 italic text-tea-text-dim">Nothing here yet.</p>}
          {links.map((link, index) => (
            <div key={index} className="border-b border-tea-border py-5 first:pt-0">
              <div role="radiogroup" aria-label={`Link ${index + 1} platform`} className="flex flex-wrap items-baseline gap-x-5">
                {CONTRIBUTOR_LINK_PLATFORMS.map(platform => {
                  const on = link.platform === platform;
                  return (
                    <label key={platform} className={`tap-target inline-flex min-h-11 cursor-pointer items-center border-b font-display text-ui-17 transition-colors ${on ? 'border-tea-gold text-tea-text' : 'border-transparent text-tea-text-sec hover:text-tea-text'}`}>
                      <input type="radio" className="sr-only" name={`link-${index}-platform`} value={platform} checked={on} onChange={() => updateLink(index, { platform })} />
                      {platformWord(platform)}
                    </label>
                  );
                })}
                <button type="button" aria-label={`Remove link ${index + 1}`} onClick={() => onChange({ links: links.filter((_, position) => position !== index) })} className={`${QUIET} ml-auto`}>Remove</button>
              </div>
              <Line
                className="mt-2"
                id={`f-link-${index}-value`}
                label={platformAsk(link.platform)}
                aria-label={`Link ${index + 1} value`}
                value={link.value}
                onChange={event => updateLink(index, { value: event.target.value })}
                placeholder={link.platform === 'website' ? 'https://' : link.platform === 'instagram' ? '@name' : ''}
                inputMode={link.platform === 'website' ? 'url' : undefined}
                autoCapitalize="none"
              />
              {link.platform === 'wechat' && (
                <div className="mt-5">
                  <p className={LABEL}>Your QR code</p>
                  <div className="mt-2 max-w-[320px]">
                    <PhotoPlace
                      name="QR code"
                      noun="QR code"
                      allowAddress={allowAddress}
                      testId={`photo-qr-${index}`}
                      url={link.qr_image_url}
                      focus={null}
                      onChange={next => updateLink(index, { qr_image_url: next.url })}
                      crops={[]}
                      purpose="A screenshot of your WeChat QR, so people can scan it. Optional."
                      emptyHeight={160}
                      onBusy={markBusy(`qr-${index}`)}
                    />
                  </div>
                </div>
              )}
              {link.platform === 'other' && (
                <Line className="mt-4" id={`f-link-${index}-label`} label="What it is" value={link.label ?? ''} onChange={event => updateLink(index, { label: event.target.value })} placeholder="Xiaohongshu, a shop, a newsletter" />
              )}
            </div>
          ))}
          <button type="button" onClick={() => onChange({ links: [...links, { platform: 'website', value: '', qr_image_url: null }] })} className={`${ACTION} mt-4`}>Add a way to reach you</button>
        </div>
      </EditorSheet>
    </>
  );

  return { card, sheets };
}
