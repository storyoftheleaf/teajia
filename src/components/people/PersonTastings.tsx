import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { FamilyPersonTasting } from '../../lib/familyContract';
import { familyApi } from '../../lib/familyApi';
import { authPagePath } from '../../lib/authNavigation';
import { useAuth } from '../../hooks/useAuth';
import { mediaUrl } from '../../lib/mediaUrl';
import { Button } from '../shared/Button';
import { Dek, GOLD_TEXT_INLINE, GOLD_TEXT_STYLE, GroupHead, IndexRow } from './immersive';
import { PhotographThumb, PhotographZoom, type ZoomPhotograph } from '../shared/Photographs';

// The Tastings section of a person's page: the teas they shared, in their own
// words and photographs. Built from the page's existing parts: the group
// divider, the index row for each tea, and the two-column photograph grid the
// "Hands on" section uses. Words and photographs only. There is no score, no
// verdict and no count anywhere in here: the worker never sends them.
//
// A tea that has sold out stays, marked as gone, with one action: ask Teajia to
// find more. The same marker and action serve "The teas" and the favourites
// page, so it lives here once.

const CHINESE_FONT_STACK = "'Noto Serif SC','Cormorant Garamond',serif";

function noteDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * "Gone from the shop." and the one action beside it. Signed out, the action
 * takes the visitor to sign in and back; signed in, it files the request and
 * says so. Asking twice is told kindly, not refused.
 */
export function SoldOutLine({ productId, name }: { productId: string | null | undefined; name: string }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<'idle' | 'sending' | 'asked' | 'already' | 'failed'>('idle');
  const ask = async () => {
    if (!productId) return;
    setState('sending');
    try {
      const result = await familyApi.requestRestock(productId);
      setState(result.already_asked ? 'already' : 'asked');
    } catch {
      setState('failed');
    }
  };
  const canAsk = Boolean(productId) && (state === 'idle' || state === 'sending' || state === 'failed');
  return (
    <div className="flex flex-wrap items-center gap-x-4 pb-2" data-testid="sold-out-line">
      <Dek className="text-ui-13">Gone from the shop.</Dek>
      {canAsk && !isAuthenticated && (
        <Link to={authPagePath('signin', `${location.pathname}${location.search}`)} className={GOLD_TEXT_INLINE} style={GOLD_TEXT_STYLE} data-testid="find-me-more">Find me more</Link>
      )}
      {canAsk && isAuthenticated && (
        <Button variant="plain" type="button" className={GOLD_TEXT_INLINE} style={GOLD_TEXT_STYLE} disabled={state === 'sending'} onClick={ask} aria-label={`Ask Teajia to find more of ${name}`} data-testid="find-me-more">Find me more</Button>
      )}
      {state === 'asked' && <Dek className="text-ui-13">Asked. Teajia will look.</Dek>}
      {state === 'already' && <Dek className="text-ui-13">You have already asked.</Dek>}
      {state === 'failed' && <span role="alert" className="font-body text-ui-13 italic text-tea-text-sec">That did not go through. Try again.</span>}
    </div>
  );
}

function PhotographGrid({ tasting }: { tasting: FamilyPersonTasting }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (tasting.photographs.length === 0) return null;
  const toZoom = (photo: FamilyPersonTasting['photographs'][number]): ZoomPhotograph => ({
    id: photo.id,
    smallSrc: mediaUrl(photo.small_url),
    fullSrc: mediaUrl(photo.full_url),
    width: photo.small_width,
    height: photo.small_height,
    alt: `${tasting.name}, photographed by the person on this page`,
  });
  const open = tasting.photographs.find(photo => photo.id === openId) ?? null;
  return (
    <>
      {/* The small copy, always: a row never asks for the large file. Each is cropped
          to one of the three shapes; the large copy is asked for only in the zoom. */}
      <ul className="photo-row mt-3.5" aria-label={`Photographs of ${tasting.name}`} data-testid="tasting-photographs">
        {tasting.photographs.map(photo => (
          <li key={photo.id}><PhotographThumb photo={toZoom(photo)} size="page" onOpen={setOpenId} /></li>
        ))}
      </ul>
      <PhotographZoom photo={open ? toZoom(open) : null} onClose={() => setOpenId(null)} />
    </>
  );
}

export function PersonTastingsSection({ tastings }: { tastings: FamilyPersonTasting[] }) {
  if (tastings.length === 0) return null;
  return (
    <section id="tastings" data-reveal className="scroll-mt-[96px]" data-testid="profile-tastings">
      <div className="px-6">
        <GroupHead label="Tastings" />
        <ul>
          {tastings.map(tasting => (
            <li key={tasting.product_id} data-testid="profile-tasting">
              <IndexRow
                to={tasting.public_path}
                testId="profile-tasting-row"
                title={(
                  <>
                    {tasting.name}
                    {tasting.chinese_name && <span className="ml-2 text-ui-15 text-tea-text-sec" style={{ fontFamily: CHINESE_FONT_STACK }}>{tasting.chinese_name}</span>}
                  </>
                )}
              />
              {tasting.words.length > 0 && (
                <div className="pt-3.5">
                  {tasting.words.map((word, index) => {
                    const date = noteDate(word.date);
                    return (
                      <div key={`${word.date ?? 'undated'}-${index}`} className={index === 0 ? '' : 'mt-3.5'} data-testid="tasting-note">
                        {date && <time dateTime={word.date ?? undefined} className="block font-sans text-ui-10 uppercase tracking-[0.18em] text-tea-text-dim">{date}</time>}
                        <p className="mt-1 whitespace-pre-line font-body text-ui-15 leading-[1.65] text-tea-text">{word.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              <PhotographGrid tasting={tasting} />
              {tasting.sold_out && <div className="mt-3"><SoldOutLine productId={tasting.product_id} name={tasting.name} /></div>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
