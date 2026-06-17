// src/components/immersive/ImmersiveShareCard.tsx
// AR.6 — Share-card generation for the immersive reader.
//
// From a rendered immersive article, generate a shareable image at 4:5, 9:16 or
// 1:1 from a chosen moment (cover, a pull-quote, or a stat). The old reader was
// BUILT inside a 4:5 frame; here the article is a real web read and the card is
// GENERATED from it, in whichever format the destination wants.
//
// Implementation choice: a brand-token canvas renderer, NOT html-to-image.
// Reasoning: although html-to-image is in the project, canvas is the proven path
// in this codebase (src/components/article/SharePanel.tsx renders posters the
// same way) and it sidesteps the font-embedding / CORS-tainted-image pitfalls of
// DOM snapshotting. Canvas also lets one composition reflow cleanly across three
// very different aspect ratios. Brand law holds: --tea-* tokens read from the
// live stylesheet, aged bronze never bright gold, Cormorant/Lora/Plus Jakarta,
// no icons or emoji (text labels + the ↗ arrow + Chinese 器 mark only).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ArticleBlock, DbArticle } from '../../types';

export type ShareFormat = '4x5' | '9x16' | '1x1';

const FORMATS: { id: ShareFormat; label: string; w: number; h: number }[] = [
  { id: '4x5', label: '4 : 5', w: 1080, h: 1350 },
  { id: '9x16', label: '9 : 16', w: 1080, h: 1920 },
  { id: '1x1', label: '1 : 1', w: 1080, h: 1080 },
];

// A "moment" is one shareable beat pulled from the article's blocks.
type Moment =
  | { kind: 'cover'; title: string; subtitle?: string; kicker?: string }
  | { kind: 'quote'; text: string; attribution?: string }
  | { kind: 'stat'; value: string; label: string; context?: string };

// Walk the block stack and offer the cover plus any pull-quotes and stats as
// shareable moments. The cover is always first (falls back to the article title
// when there is no cover block).
function momentsFromArticle(article: DbArticle): { moment: Moment; label: string }[] {
  const out: { moment: Moment; label: string }[] = [];
  const coverBlock = article.blocks.find(b => b.type === 'cover') as Extract<ArticleBlock, { type: 'cover' }> | undefined;
  out.push({
    moment: {
      kind: 'cover',
      title: coverBlock?.title ?? article.title,
      subtitle: coverBlock?.subtitle ?? article.subtitle,
      kicker: coverBlock?.kicker,
    },
    label: 'Cover',
  });
  let qi = 0, si = 0;
  for (const b of article.blocks) {
    if (b.type === 'quote') {
      qi += 1;
      out.push({ moment: { kind: 'quote', text: b.text, attribution: b.attribution }, label: `Quote ${qi}` });
    } else if (b.type === 'stat') {
      si += 1;
      out.push({ moment: { kind: 'stat', value: b.value, label: b.label, context: b.context }, label: `Stat ${si}` });
    }
  }
  return out;
}

function tokens() {
  const root = getComputedStyle(document.documentElement);
  const g = (name: string, fallback: string) => root.getPropertyValue(name).trim() || fallback;
  return {
    bg: g('--tea-bg', '#1c1a16'),
    bg2: g('--tea-elevated', '#22201c'),
    text: g('--tea-text', '#ede4d4'),
    textSec: g('--tea-text-sec', '#ddd2bd'),
    textDim: g('--tea-text-dim', '#b3a283'),
    gold: g('--tea-gold', '#a8874d'),
    goldLt: g('--tea-gold-lt', '#bfa06a'),
    display: g('--font-display', "'Cormorant Garamond', Georgia, serif"),
    body: g('--font-body', "'Lora', serif"),
    sans: g('--font-sans', "'Plus Jakarta Sans', system-ui, sans-serif"),
  };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = (text ?? '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(t).width > maxWidth) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Render one moment onto a canvas at the chosen format. Scales type to the
// canvas so the composition reads the same at every aspect ratio.
async function renderCard(moment: Moment, article: DbArticle, fmt: ShareFormat): Promise<HTMLCanvasElement> {
  try { await (document as any).fonts?.ready; } catch { /* fonts API absent */ }
  const f = FORMATS.find(x => x.id === fmt)!;
  const W = f.w, H = f.h;
  const PAD = Math.round(W * 0.1);
  const C = tokens();
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background: a quiet vertical wash from bg2 into bg.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, C.bg2);
  grad.addColorStop(0.55, C.bg);
  grad.addColorStop(1, C.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Hairline frame inset.
  ctx.strokeStyle = C.gold;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 2;
  const inset = Math.round(W * 0.045);
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.globalAlpha = 1;

  // Masthead.
  ctx.textAlign = 'left';
  ctx.font = `500 ${Math.round(W * 0.026)}px ${C.sans}`;
  ctx.fillStyle = C.goldLt;
  const mast = 'TEAJIA · JOURNAL';
  ctx.fillText(spaced(mast), PAD, PAD + W * 0.02);

  const innerW = W - PAD * 2;
  const midY = H * 0.5;

  if (moment.kind === 'cover') {
    // Large 器 watermark, then kicker / title / subtitle, left-aligned.
    ctx.save();
    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = C.gold;
    ctx.font = `400 ${Math.round(W * 0.5)}px ${C.display}`;
    ctx.fillText('器', W - inset - 10, H * 0.66);
    ctx.restore();

    // Anchor the title block so it does not collide with the kicker; the kicker
    // sits a clear band above the first title line.
    let y = H * 0.40;
    if (moment.kicker) {
      ctx.font = `500 ${Math.round(W * 0.024)}px ${C.sans}`;
      ctx.fillStyle = C.goldLt;
      ctx.fillText(spaced(moment.kicker.toUpperCase()), PAD, y);
      y += W * 0.075;
    }
    ctx.font = `600 ${Math.round(W * 0.105)}px ${C.display}`;
    ctx.fillStyle = C.text;
    const titleLines = wrap(ctx, moment.title, innerW);
    for (const line of titleLines.slice(0, 4)) { ctx.fillText(line, PAD, y); y += W * 0.115; }
    if (moment.subtitle) {
      y += W * 0.01;
      ctx.font = `400 ${Math.round(W * 0.04)}px ${C.body}`;
      ctx.fillStyle = C.textSec;
      for (const line of wrap(ctx, moment.subtitle, innerW * 0.92).slice(0, 3)) { ctx.fillText(line, PAD, y); y += W * 0.052; }
    }
  } else if (moment.kind === 'quote') {
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = C.gold;
    ctx.font = `italic 400 ${Math.round(W * 0.26)}px ${C.display}`;
    ctx.fillText('“', PAD - W * 0.01, midY - H * 0.16);
    ctx.restore();

    ctx.font = `italic 500 ${Math.round(W * 0.066)}px ${C.display}`;
    ctx.fillStyle = C.goldLt;
    const qLines = wrap(ctx, moment.text, innerW);
    const lineH = W * 0.084;
    let y = midY - (qLines.length * lineH) / 2;
    for (const line of qLines.slice(0, 8)) { ctx.fillText(line, PAD, y); y += lineH; }
    ctx.fillStyle = C.gold;
    ctx.fillRect(PAD, y + W * 0.03, W * 0.08, 2);
    ctx.font = `500 ${Math.round(W * 0.026)}px ${C.sans}`;
    ctx.fillStyle = C.textDim;
    ctx.fillText(spaced((moment.attribution ?? article.title).toUpperCase()), PAD, y + W * 0.075);
  } else {
    // Stat: oversized value, centered, with label + context beneath.
    ctx.textAlign = 'center';
    ctx.font = `600 ${Math.round(W * 0.26)}px ${C.display}`;
    ctx.fillStyle = C.goldLt;
    ctx.fillText(truncate(moment.value, 8), W / 2, midY);
    ctx.font = `500 ${Math.round(W * 0.03)}px ${C.sans}`;
    ctx.fillStyle = C.textDim;
    ctx.fillText(spaced(moment.label.toUpperCase()), W / 2, midY + W * 0.07);
    if (moment.context) {
      ctx.font = `italic 400 ${Math.round(W * 0.038)}px ${C.body}`;
      ctx.fillStyle = C.textSec;
      let y = midY + W * 0.15;
      for (const line of wrap(ctx, moment.context, innerW * 0.9).slice(0, 3)) { ctx.fillText(line, W / 2, y); y += W * 0.05; }
    }
    ctx.textAlign = 'left';
  }

  // Footer: article title + quiet wordmark.
  const fy = H - PAD;
  ctx.strokeStyle = C.gold;
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.moveTo(PAD, fy - W * 0.06); ctx.lineTo(W - PAD, fy - W * 0.06); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.font = `italic 400 ${Math.round(W * 0.038)}px ${C.display}`;
  ctx.fillStyle = C.text;
  ctx.fillText(truncate(article.title, 46), PAD, fy - W * 0.018);
  ctx.font = `400 ${Math.round(W * 0.022)}px ${C.sans}`;
  ctx.fillStyle = C.textDim;
  ctx.fillText('teajia.com', W - PAD - ctx.measureText('teajia.com').width, fy - W * 0.018);

  return canvas;
}

function spaced(s: string): string { return s.split('').join('  '); }
function truncate(s: string, n: number): string { return s && s.length > n ? s.slice(0, n - 1).trim() + '…' : (s ?? ''); }

export interface ImmersiveShareCardProps {
  article: DbArticle;
  onClose: () => void;
}

export const ImmersiveShareCard: React.FC<ImmersiveShareCardProps> = ({ article, onClose }) => {
  const moments = useMemo(() => momentsFromArticle(article), [article]);
  const [momentIdx, setMomentIdx] = useState(0);
  const [format, setFormat] = useState<ShareFormat>('4x5');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const moment = moments[Math.min(momentIdx, moments.length - 1)]?.moment;

  useEffect(() => {
    if (!moment) return;
    let cancelled = false;
    let prevUrl: string | null = null;
    setPreviewUrl(null);
    renderCard(moment, article, format)
      .then(canvas => new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png')))
      .then(blob => {
        if (cancelled || !blob) return;
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        prevUrl = url;
        setPreviewUrl(url);
      })
      .catch(() => { if (!cancelled) setStatus('Could not render this card.'); });
    return () => { cancelled = true; if (prevUrl) URL.revokeObjectURL(prevUrl); };
  }, [moment, article, format]);

  const flash = (m: string) => { setStatus(m); setTimeout(() => setStatus(null), 2600); };

  const download = () => {
    const blob = blobRef.current;
    if (!blob) { flash('Still preparing the card…'); return; }
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `teajia-${article.slug ?? 'card'}-${format}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash('Card saved');
  };

  const nativeShare = async () => {
    const blob = blobRef.current;
    if (!blob) { flash('Still preparing the card…'); return; }
    const file = new File([blob], `teajia-${article.slug ?? 'card'}-${format}.png`, { type: 'image/png' });
    if (navigator.share && (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }))) {
      try { await navigator.share({ files: [file], title: article.title }); return; }
      catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    download();
  };

  const tabBase = 'px-3 py-1.5 rounded-full text-ui-11 tracking-[0.06em] transition-colors';

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-label="Share a card"
      className="fixed inset-0 z-modal flex items-end md:items-center justify-center"
      style={{ background: 'rgba(12,10,7,0.86)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      data-testid="immersive-share-card"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full md:max-w-lg max-h-[94dvh] overflow-y-auto bg-tea-bg border-t md:border border-tea-border rounded-t-xl md:rounded-xl flex flex-col pb-nav-gap md:pb-0"
      >
        {/* Header — close on the left per panel convention */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-tea-border">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-tea-text-sec hover:text-tea-text text-ui-20 leading-none tap-target"
          >
            ✕
          </button>
          <span className="font-sans text-ui-11 uppercase tracking-[0.2em] text-tea-text-dim">Share a card</span>
        </div>

        {/* Preview */}
        <div className="px-5 pt-5 flex justify-center">
          <div
            className="relative overflow-hidden rounded-md border border-tea-border bg-tea-elevated"
            style={{ width: format === '9x16' ? 220 : 280, aspectRatio: format === '4x5' ? '4 / 5' : format === '9x16' ? '9 / 16' : '1 / 1' }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Share card preview" className="w-full h-full object-cover" data-testid="share-card-image" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-sans text-ui-10 tracking-[0.12em] uppercase text-tea-gold-lt">Preparing…</span>
              </div>
            )}
          </div>
        </div>

        {/* Moment picker */}
        {moments.length > 1 && (
          <div className="px-5 pt-5">
            <span className="block font-sans text-ui-10 uppercase tracking-[0.18em] text-tea-text-dim mb-2">Moment</span>
            <div className="flex flex-wrap gap-2">
              {moments.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMomentIdx(i)}
                  className={`${tabBase} ${momentIdx === i ? 'bg-tea-gold text-tea-bg' : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Format tabs */}
        <div className="px-5 pt-5">
          <span className="block font-sans text-ui-10 uppercase tracking-[0.18em] text-tea-text-dim mb-2">Format</span>
          <div className="flex gap-2" role="group" aria-label="Card format">
            {FORMATS.map(f => (
              <button
                key={f.id}
                type="button"
                data-testid={`share-format-${f.id}`}
                aria-pressed={format === f.id}
                onClick={() => setFormat(f.id)}
                className={`${tabBase} ${format === f.id ? 'bg-tea-gold text-tea-bg' : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-5 mt-4 flex items-center justify-between gap-3 border-t border-tea-border">
          <span className="font-sans text-ui-10 tracking-[0.1em] uppercase text-tea-text-dim min-w-0 truncate">
            {status ?? `Teajia · ${article.title}`}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={download}
              className="rounded-full border border-tea-border bg-tea-elevated text-tea-text-sec hover:text-tea-text font-sans text-ui-11 tracking-[0.08em] uppercase px-4 py-2"
            >
              Download
            </button>
            <button
              type="button"
              onClick={nativeShare}
              className="rounded-full bg-tea-gold text-tea-bg font-sans text-ui-11 tracking-[0.08em] uppercase px-4 py-2"
            >
              Share ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
