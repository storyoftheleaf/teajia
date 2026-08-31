import React, { useEffect, useMemo, useState } from 'react';
import type { DbArticle } from '../../admin/types';

// Restored from MagazinePageReader (commit 3dae784^). Adapted to the new
// Page model in src/pages/ArticlePage.tsx and the DbArticle type. Behaviour
// preserved: per-page or whole-article scope, 4:5 poster preview, native
// Web Share Level 2 with image fallback, copy-link / save-image / SMS /
// Instagram / X / email destinations.

const T = {
  bg: 'var(--tea-bg)',
  text: 'var(--tea-text)',
  textSec: 'var(--tea-text-sec)',
  textDim: 'var(--tea-text-dim)',
  gold: 'var(--tea-gold)',
  border: 'var(--tea-border)',
  display: 'var(--font-display)',
  body: 'var(--font-body)',
  ui: 'var(--font-sans)',
  mono: 'var(--font-mono)',
} as const;

const labelStyle: React.CSSProperties = {
  fontFamily: T.ui, fontSize: 10.5, fontWeight: 400,
  letterSpacing: '0.22em', textTransform: 'uppercase', color: T.textSec,
};

// Mirror of the Page union from ArticlePage.tsx, duplicated locally to keep
// the share module independent. Only the kinds the composer cares about need
// fields; everything else falls through to the cover composition.
export type SharePage =
  | { kind: 'cover'; title: string; subtitle?: string }
  | { kind: 'masthead'; intro: string }
  | { kind: 'colophon'; title: string }
  | { kind: 'end'; title: string }
  | { kind: 'body'; head: string; paragraphs: string[] }
  | { kind: 'section'; title: string; numeral: string }
  | { kind: 'quote'; text: string; attribution?: string }
  | { kind: 'image'; caption?: string; alt: string }
  | { kind: 'paragraph_styled'; text: string }
  | { kind: 'block_cover'; title: string; subtitle?: string; kicker?: string }
  | { kind: 'block_chapter'; title: string; subtitle?: string; number?: string }
  | { kind: 'qa'; items: Array<{ q: string; a: string }> }
  | { kind: 'pull_sidebar'; body: string; sidebar: string }
  | { kind: 'epilogue'; text: string; signature?: string }
  | { kind: 'stat'; value: string; label: string; context?: string }
  | { kind: 'definition'; term: string; body: string }
  | { kind: 'recipe'; title: string; ingredients: string[]; steps: string[] }
  | { kind: 'tasting_notes'; items: Array<{ label: string; note: string }> }
  | { kind: 'poem'; text: string }
  | { kind: 'map'; caption?: string }
  | { kind: 'list'; title?: string; items: string[] }
  | { kind: 'embed'; caption?: string; description?: string }
  | { kind: 'back_matter'; lines: string[] }
  | { kind: string; [k: string]: unknown }; // catch-all

// ─── Composition model ───────────────────────────────────────────────────────

type ShareComposition =
  | { type: 'quote'; content: string; footer?: string }
  | { type: 'passage'; head: string; text?: string }
  | { type: 'qa'; head: string; qa?: { q: string; a: string } }
  | { type: 'cover'; title: string; subtitle?: string };

function compositionForPage(page: SharePage | null, article: DbArticle): ShareComposition {
  if (!page) return { type: 'cover', title: article.title, subtitle: article.subtitle ?? undefined };
  const k = page.kind;

  if (k === 'cover' || k === 'masthead' || k === 'colophon' || k === 'end' || k === 'back_matter') {
    return { type: 'cover', title: article.title, subtitle: article.subtitle ?? undefined };
  }
  if (k === 'quote' && (page as any).text) {
    return { type: 'quote', content: String((page as any).text), footer: (page as any).attribution };
  }
  if (k === 'pull_sidebar') {
    const body = (page as any).body ?? (page as any).sidebar;
    if (body) return { type: 'quote', content: String(body) };
  }
  if (k === 'qa' && Array.isArray((page as any).items) && (page as any).items.length) {
    return { type: 'qa', head: 'In Conversation', qa: (page as any).items[0] };
  }
  if (k === 'body') {
    const paragraphs = (page as any).paragraphs as string[] | undefined;
    return { type: 'passage', head: (page as any).head ?? article.title, text: paragraphs?.[0] };
  }
  if (k === 'epilogue') {
    return { type: 'passage', head: 'Coda', text: (page as any).text };
  }
  if (k === 'section' || k === 'block_chapter') {
    return { type: 'passage', head: (page as any).title ?? '', text: (page as any).subtitle };
  }
  if (k === 'block_cover') {
    return { type: 'cover', title: (page as any).title ?? article.title, subtitle: (page as any).subtitle ?? (page as any).kicker };
  }
  if (k === 'paragraph_styled') {
    return { type: 'passage', head: article.title, text: (page as any).text };
  }
  if (k === 'stat') {
    return { type: 'passage', head: (page as any).value ?? '', text: (page as any).label };
  }
  if (k === 'definition') {
    return { type: 'passage', head: (page as any).term ?? '', text: (page as any).body };
  }
  if (k === 'recipe') {
    const steps: string[] = (page as any).steps ?? [];
    return { type: 'passage', head: (page as any).title ?? 'Recipe', text: steps[0] };
  }
  if (k === 'tasting_notes') {
    const items = (page as any).items as Array<{ label: string; note: string }> | undefined;
    if (items?.length) return { type: 'passage', head: items[0].label, text: items[0].note };
  }
  if (k === 'poem') {
    return { type: 'quote', content: String((page as any).text ?? '') };
  }
  if (k === 'list') {
    const items: string[] = (page as any).items ?? [];
    return { type: 'passage', head: (page as any).title ?? '', text: items.join(' · ') };
  }
  if (k === 'embed') {
    return { type: 'passage', head: (page as any).caption ?? '', text: (page as any).description };
  }
  if (k === 'image') {
    return { type: 'passage', head: '', text: (page as any).caption ?? (page as any).alt };
  }
  return { type: 'cover', title: article.title, subtitle: article.subtitle ?? undefined };
}

function shortPageLabel(page: SharePage | null): string {
  if (!page) return '—';
  const k = page.kind;
  if (k === 'cover') return 'Cover';
  if (k === 'masthead') return 'Letter before you begin';
  if (k === 'colophon') return 'Colophon';
  if (k === 'end') return 'End of story';
  if (k === 'section' || k === 'block_chapter') {
    const numeral = (page as any).numeral ?? (page as any).number;
    const title = (page as any).title ?? '';
    return numeral ? `${numeral} · ${title}` : title || k;
  }
  if (k === 'quote' && (page as any).text) return '“' + truncate(String((page as any).text), 32) + '”';
  if (k === 'body') return (page as any).head ?? 'Reading';
  if (k === 'qa') return 'In Conversation';
  if (k === 'recipe') return (page as any).title ?? 'Recipe';
  if (k === 'definition') return (page as any).term ?? 'Definition';
  if (k === 'stat') return (page as any).label ?? 'Stat';
  if (k === 'tasting_notes') return 'Tasting notes';
  if (k === 'image') return (page as any).caption ?? 'Plate';
  return k;
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trim() + '…' : s;
}

// ─── Canvas poster ────────────────────────────────────────────────────────────

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function renderPosterToCanvas(comp: ShareComposition, article: DbArticle): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const W = 800, H = 1000, PAD = 52;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const root = getComputedStyle(document.documentElement);
  const C = {
    bg:      root.getPropertyValue('--tea-bg').trim()       || '#18130e',
    text:    root.getPropertyValue('--tea-text').trim()     || '#ede4d6',
    textSec: root.getPropertyValue('--tea-text-sec').trim() || '#b5a79a',
    textDim: root.getPropertyValue('--tea-text-dim').trim() || '#7a6e66',
    gold:    root.getPropertyValue('--tea-gold').trim()     || '#b8924e',
  };
  const displayFam = root.getPropertyValue('--font-display').trim() || "'Cormorant Garamond', Georgia, serif";
  const bodyFam    = root.getPropertyValue('--font-body').trim()    || "'Lora', serif";
  const monoFam    = root.getPropertyValue('--font-mono').trim()    || "'Lora', Georgia, serif";

  const setDisplay = (size: number, style = 'normal') => { ctx.font = `${style} 400 ${size}px ${displayFam}`; };
  const setBody    = (size: number, style = 'normal') => { ctx.font = `${style} 400 ${size}px ${bodyFam}`; };
  const setMono    = (size: number)                   => { ctx.font = `400 ${size}px ${monoFam}`; };

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  setMono(10);
  ctx.fillStyle = C.gold;
  ctx.textAlign = 'left';
  ctx.fillText('TEAJIA · JOURNAL', PAD, PAD + 12);
  ctx.fillStyle = C.textDim;
  ctx.textAlign = 'right';
  ctx.fillText('ISSUE 04', W - PAD, PAD + 12);
  ctx.textAlign = 'left';

  const bodyTop = PAD + 60;
  const bodyW   = W - PAD * 2;

  if (comp.type === 'cover') {
    ctx.font = `400 280px "Ma Shan Zheng", serif`;
    ctx.fillStyle = C.gold;
    ctx.globalAlpha = 0.12;
    ctx.textAlign = 'right';
    ctx.fillText('器', W - PAD + 24, bodyTop + 210);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    setMono(10);
    ctx.fillStyle = C.gold;
    ctx.fillText('COVER STORY · ISSUE 04', PAD, bodyTop + 30);
    setDisplay(68, 'italic');
    ctx.fillStyle = C.text;
    const titleLines = wrapText(ctx, truncate(comp.title, 36), bodyW);
    let y = bodyTop + 96;
    for (const line of titleLines) { ctx.fillText(line, PAD, y); y += 76; }
    if (comp.subtitle) {
      setBody(17);
      ctx.fillStyle = C.textSec;
      const subLines = wrapText(ctx, truncate(comp.subtitle, 140), bodyW * 0.8);
      y += 8;
      for (const line of subLines.slice(0, 5)) { ctx.fillText(line, PAD, y); y += 27; }
    }
  } else if (comp.type === 'quote') {
    setDisplay(180, 'italic');
    ctx.fillStyle = C.gold;
    ctx.globalAlpha = 0.38;
    ctx.fillText('“', PAD - 10, bodyTop + 80);
    ctx.globalAlpha = 1;
    setDisplay(26, 'italic');
    ctx.fillStyle = C.text;
    const qLines = wrapText(ctx, truncate(comp.content, 160), bodyW);
    const lineH = 38;
    const midY = bodyTop + (H - PAD - 120 - bodyTop) / 2;
    let y = midY - (qLines.length * lineH) / 2;
    for (const line of qLines) { ctx.fillText(line, PAD, y); y += lineH; }
    ctx.fillStyle = C.gold;
    ctx.fillRect(PAD, y + 20, 40, 1);
    setBody(15, 'italic');
    ctx.fillStyle = C.textSec;
    ctx.fillText(article.title, PAD, y + 46);
  } else if (comp.type === 'passage') {
    setDisplay(32, 'italic');
    ctx.fillStyle = C.text;
    const headLines = wrapText(ctx, truncate(comp.head, 60), bodyW);
    let y = bodyTop + 50;
    for (const line of headLines) { ctx.fillText(line, PAD, y); y += 42; }
    y += 14;
    if (comp.text) {
      setBody(17);
      ctx.fillStyle = C.textSec;
      const bodyLines = wrapText(ctx, truncate(comp.text, 210), bodyW);
      for (const line of bodyLines.slice(0, 9)) { ctx.fillText(line, PAD, y); y += 27; }
    }
  } else if (comp.type === 'qa') {
    setDisplay(26, 'italic');
    ctx.fillStyle = C.text;
    const headLines = wrapText(ctx, truncate(comp.head, 48), bodyW);
    let y = bodyTop + 50;
    for (const line of headLines) { ctx.fillText(line, PAD, y); y += 34; }
    y += 20;
    if (comp.qa) {
      setBody(16, 'italic');
      ctx.fillStyle = C.gold;
      const qLines = wrapText(ctx, `Q. ${truncate(comp.qa.q, 100)}`, bodyW);
      for (const line of qLines.slice(0, 4)) { ctx.fillText(line, PAD, y); y += 25; }
      y += 14;
      setBody(16);
      ctx.fillStyle = C.textSec;
      const aLines = wrapText(ctx, `A. ${truncate(comp.qa.a, 180)}`, bodyW);
      for (const line of aLines.slice(0, 7)) { ctx.fillText(line, PAD, y); y += 25; }
    }
  }

  const btmY = H - PAD - 72;
  ctx.strokeStyle = 'rgba(184,146,78,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, btmY); ctx.lineTo(W - PAD, btmY); ctx.stroke();
  setDisplay(18, 'italic');
  ctx.fillStyle = C.text;
  ctx.fillText(article.title, PAD, btmY + 28);
  setMono(9);
  ctx.fillStyle = C.textDim;
  ctx.fillText('teajia · journal', PAD, btmY + 50);

  return canvas;
}

function SharePoster({ comp, article }: { comp: ShareComposition; article: DbArticle }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      padding: '6.5cqi 6.5cqi 6cqi',
      display: 'flex', flexDirection: 'column',
      containerType: 'inline-size',
    } as React.CSSProperties}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontFamily: T.mono, fontSize: '2.6cqi', color: T.gold, letterSpacing: '0.28em' } as React.CSSProperties}>TEAJIA · JOURNAL</span>
        <span style={{ fontFamily: T.mono, fontSize: '2.6cqi', color: T.textDim } as React.CSSProperties}>ISSUE 04</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4cqi 0' } as React.CSSProperties}>
        {comp.type === 'quote' && (
          <div style={{ textAlign: 'left', position: 'relative', width: '100%' }}>
            <div style={{ position: 'absolute', top: '-7cqi', left: '-2cqi', fontFamily: T.display, fontStyle: 'italic', fontSize: '26cqi', color: T.gold, opacity: 0.4, lineHeight: 0.8, pointerEvents: 'none' } as React.CSSProperties}>&ldquo;</div>
            <p style={{ fontFamily: T.display, fontStyle: 'italic', fontWeight: 400, fontSize: '6.2cqi', lineHeight: 1.18, margin: 0, color: T.text, position: 'relative' } as React.CSSProperties}>{truncate(comp.content, 160)}</p>
            <div style={{ width: '6cqi', height: 1, background: T.gold, margin: '5cqi 0 2.5cqi' } as React.CSSProperties} />
            <p style={{ fontFamily: T.body, fontStyle: 'italic', fontSize: '3.2cqi', color: T.textSec, margin: 0 } as React.CSSProperties}>{article.title}</p>
          </div>
        )}
        {comp.type === 'passage' && (
          <div style={{ width: '100%' }}>
            <h3 style={{ fontFamily: T.display, fontStyle: 'italic', fontWeight: 400, fontSize: '7.2cqi', lineHeight: 1.08, margin: '0 0 3.5cqi', color: T.text } as React.CSSProperties}>{truncate(comp.head, 60)}</h3>
            <p style={{ fontFamily: T.body, fontSize: '3.6cqi', lineHeight: 1.55, margin: 0, color: T.textSec } as React.CSSProperties}>{truncate(comp.text ?? '', 210)}</p>
          </div>
        )}
        {comp.type === 'qa' && (
          <div style={{ width: '100%' }}>
            <h3 style={{ fontFamily: T.display, fontStyle: 'italic', fontWeight: 400, fontSize: '6.2cqi', lineHeight: 1.1, margin: '0 0 4.5cqi', color: T.text } as React.CSSProperties}>{truncate(comp.head, 48)}</h3>
            <p style={{ fontFamily: T.body, fontStyle: 'italic', fontSize: '3.5cqi', lineHeight: 1.5, margin: '0 0 3cqi', color: T.gold } as React.CSSProperties}>Q. {truncate(comp.qa?.q ?? '', 100)}</p>
            <p style={{ fontFamily: T.body, fontSize: '3.5cqi', lineHeight: 1.55, margin: 0, color: T.textSec } as React.CSSProperties}>A. {truncate(comp.qa?.a ?? '', 180)}</p>
          </div>
        )}
        {comp.type === 'cover' && (
          <div style={{ width: '100%', textAlign: 'left', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-6cqi', right: '-2cqi', fontFamily: "'Ma Shan Zheng',cursive", fontSize: '52cqi', color: T.gold, opacity: 0.14, lineHeight: 0.8, pointerEvents: 'none' } as React.CSSProperties}>器</div>
            <div style={{ ...labelStyle, color: T.gold, marginBottom: '4cqi', position: 'relative' } as React.CSSProperties}>Cover story · Issue 04</div>
            <h3 style={{ fontFamily: T.display, fontStyle: 'italic', fontWeight: 400, fontSize: '11cqi', lineHeight: 0.98, margin: '0 0 3.5cqi', color: T.text, letterSpacing: '-0.01em' } as React.CSSProperties}>{truncate(comp.title, 36)}</h3>
            <p style={{ fontFamily: T.body, fontSize: '3.5cqi', lineHeight: 1.55, margin: 0, color: T.textSec, maxWidth: '30ch' } as React.CSSProperties}>{truncate(comp.subtitle ?? '', 140)}</p>
          </div>
        )}
      </div>
      <div style={{ borderTop: '1px solid rgba(184,146,78,0.25)', paddingTop: '3.5cqi', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3cqi', flexShrink: 0 } as React.CSSProperties}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: T.display, fontStyle: 'italic', fontSize: '4cqi', lineHeight: 1.1, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as React.CSSProperties}>{article.title}</div>
          <div style={{ fontFamily: T.mono, fontSize: '2.4cqi', color: T.textDim, marginTop: '0.8cqi' } as React.CSSProperties}>teajia · journal</div>
        </div>
      </div>
    </div>
  );
}

function ShareTab({ active, disabled, onClick, label, sub }: { active: boolean; disabled?: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, textAlign: 'left', padding: '12px 2px 14px',
        marginBottom: -1,
        opacity: disabled ? 0.35 : 1,
        display: 'flex', flexDirection: 'column', gap: 4,
        background: 'none', border: 'none', borderBottom: active ? `1px solid ${T.gold}` : '1px solid transparent',
        cursor: disabled ? 'default' : 'pointer', font: 'inherit',
      } as React.CSSProperties}
    >
      <span style={{ ...labelStyle, color: active ? T.gold : T.textSec }}>{label}</span>
      <span style={{ fontFamily: T.display, fontStyle: 'italic', fontSize: 15, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{sub}</span>
    </button>
  );
}

function ShareDest({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '12px 4px', border: `1px solid ${T.border}`, borderRadius: 3,
        background: 'transparent',
        cursor: onClick ? 'pointer' : 'default', font: 'inherit',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <span style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text }}>{icon}</span>
      <span style={{ ...labelStyle, fontSize: 9, letterSpacing: '0.16em', color: T.textSec, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

const IcCopy = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M5 4V2.5A1.5 1.5 0 016.5 1h7A1.5 1.5 0 0115 2.5v7A1.5 1.5 0 0113.5 11H12M2.5 5h7A1.5 1.5 0 0111 6.5v7A1.5 1.5 0 019.5 15h-7A1.5 1.5 0 011 13.5v-7A1.5 1.5 0 012.5 5z" stroke="currentColor" strokeWidth="1.1"/></svg>;
const IcSave = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M8 11l-3-3M8 11l3-3M3 13h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IcMsg  = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H7l-3 3v-3a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg>;
const IcMore = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="3" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="13" cy="8" r="1.2" fill="currentColor"/></svg>;
const IcIG   = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.1"/><circle cx="8" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.1"/><circle cx="11.6" cy="4.4" r="0.7" fill="currentColor"/></svg>;
const IcX    = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
const IcMail = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="2" y="3.5" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.1"/><path d="M2.5 4.5l5.5 4 5.5-4" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg>;

export interface SharePanelProps {
  page: SharePage | null;
  article: DbArticle;
  onClose: () => void;
}

export function SharePanel({ page, article, onClose }: SharePanelProps) {
  const [scope, setScope] = useState<'page' | 'article'>(page ? 'page' : 'article');
  const effectiveScope = (!page && scope === 'page') ? 'article' : scope;
  const [status, setStatus] = useState<string | null>(null);
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);

  const comp = useMemo<ShareComposition>(() => {
    if (effectiveScope === 'article') return { type: 'cover', title: article.title, subtitle: article.subtitle ?? undefined };
    return compositionForPage(page, article);
  }, [effectiveScope, page, article]);

  useEffect(() => {
    setPosterBlob(null);
    let cancelled = false;
    renderPosterToCanvas(comp, article)
      .then(canvas => new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png')))
      .then(blob => { if (!cancelled && blob) setPosterBlob(blob); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [comp, article]);

  const shareUrl = window.location.href;
  const shareText = `${article.title}${article.subtitle ? ` · ${article.subtitle}` : ''} · Teajia Journal`;
  const articleId = article.slug ?? article.id;

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2800);
  };

  const nativeShare = async (blob: Blob | null): Promise<'success' | 'cancelled' | 'unavailable'> => {
    if (!navigator.share) return 'unavailable';
    const data: ShareData = { title: article.title, text: shareText, url: shareUrl };
    if (blob) {
      const file = new File([blob], `teajia-${articleId}.png`, { type: 'image/png' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        data.files = [file];
      }
    }
    try {
      await navigator.share(data);
      return 'success';
    } catch (e) {
      return (e as Error).name === 'AbortError' ? 'cancelled' : 'unavailable';
    }
  };

  const copyImageToClipboard = async (blob: Blob): Promise<boolean> => {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch {
      return false;
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      flash('Link copied');
    } catch {
      flash('Could not copy. Select the URL bar manually.');
    }
  };

  const handleSaveImage = async () => {
    if (!posterBlob) { flash('Still preparing image…'); return; }
    const url = URL.createObjectURL(posterBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teajia-${articleId || 'journal'}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash('Image saved');
  };

  const handleMessages = async () => {
    const result = await nativeShare(posterBlob);
    if (result === 'success' || result === 'cancelled') return;
    window.open(`sms:?&body=${encodeURIComponent(`${shareText} ${shareUrl}`)}`);
  };

  const handleMore = async () => {
    const result = await nativeShare(posterBlob);
    if (result === 'success' || result === 'cancelled') return;
    try { await navigator.clipboard.writeText(shareUrl); flash('Link copied'); }
    catch { flash('Use the Copy link button'); }
  };

  const handleInstagram = async () => {
    const result = await nativeShare(posterBlob);
    if (result === 'success' || result === 'cancelled') return;
    if (posterBlob) {
      const copied = await copyImageToClipboard(posterBlob);
      window.open('https://www.instagram.com', '_blank', 'noopener');
      flash(copied
        ? 'Poster copied. Paste into your Instagram story.'
        : 'Save the image first, then share on Instagram.');
      return;
    }
    window.open('https://www.instagram.com', '_blank', 'noopener');
  };

  const handleX = async () => {
    const result = await nativeShare(posterBlob);
    if (result === 'success' || result === 'cancelled') return;
    const t = encodeURIComponent(shareText);
    const u = encodeURIComponent(shareUrl);
    if (posterBlob) {
      const copied = await copyImageToClipboard(posterBlob);
      window.open(`https://x.com/intent/tweet?text=${t}&url=${u}`, '_blank', 'noopener');
      flash(copied ? 'Poster copied. Paste it into your post on X.' : 'Link opened in X');
    } else {
      window.open(`https://x.com/intent/tweet?text=${t}&url=${u}`, '_blank', 'noopener');
    }
  };

  const handleEmail = async () => {
    const result = await nativeShare(posterBlob);
    if (result === 'success' || result === 'cancelled') return;
    const subject = encodeURIComponent(article.title);
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    if (posterBlob) {
      const copied = await copyImageToClipboard(posterBlob);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      if (copied) flash('Poster copied. Paste it into your email.');
    } else {
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
  };

  const posterReady = posterBlob !== null;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-label="Share article"
      data-testid="share-panel"
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,7,4,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, maxHeight: '92vh',
          background: T.bg, borderTop: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -20px 60px rgba(24,19,14,0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px 4px' }}>
          <span style={labelStyle}>Share</span>
          <button onClick={onClose} aria-label="Close" style={{ color: T.textDim, fontSize: 18, lineHeight: 1, padding: 4, background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }}>✕</button>
        </div>

        <div style={{ display: 'flex', padding: '0 18px', borderBottom: `1px solid ${T.border}` }}>
          <ShareTab active={effectiveScope === 'page'} disabled={!page} onClick={() => setScope('page')} label="This page" sub={shortPageLabel(page)} />
          <ShareTab active={effectiveScope === 'article'} onClick={() => setScope('article')} label="The article" sub={article.title} />
        </div>

        <div style={{ flex: '0 1 auto', padding: '18px 18px 8px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0, overflow: 'hidden' }}>
          <div style={{
            aspectRatio: '4/5', maxHeight: '46vh', width: 'auto', maxWidth: '100%',
            background: T.bg, border: `1px solid ${posterReady ? T.border : 'rgba(184,146,78,0.2)'}`,
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(24,19,14,0.4)',
            transition: 'border-color 0.4s',
          }}>
            <div style={{ opacity: posterReady ? 1 : 0.55, transition: 'opacity 0.4s' }}>
              <SharePoster comp={comp} article={article} />
            </div>
            {!posterReady && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 10, pointerEvents: 'none' }}>
                <span style={{ fontFamily: T.mono, fontSize: 8, color: T.gold, letterSpacing: '0.12em', opacity: 0.7 }}>Preparing…</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '10px 14px 8px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
          <ShareDest icon={<IcCopy />} label="Copy link"                        onClick={handleCopyLink} />
          <ShareDest icon={<IcSave />} label={posterReady ? 'Save image' : '…'} onClick={posterReady ? handleSaveImage : undefined} />
          <ShareDest icon={<IcMsg  />} label="Messages"                          onClick={handleMessages} />
          <ShareDest icon={<IcMore />} label="More…"                             onClick={handleMore} />
          <ShareDest icon={<IcIG   />} label="Instagram"                         onClick={handleInstagram} />
          <ShareDest icon={<IcX    />} label="X"                                 onClick={handleX} />
          <ShareDest icon={<IcMail />} label="Email"                             onClick={handleEmail} />
        </div>

        <div style={{ padding: '8px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: `1px solid ${T.border}`, marginTop: 6, paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' }}>
          <div style={{ fontFamily: T.mono, fontSize: 9.5, color: status ? T.gold : T.textDim, transition: 'color 0.2s', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {status ?? `TEAJIA · ${article.title.toUpperCase()}`}
          </div>
          <button
            onClick={handleMore}
            style={{ fontFamily: T.mono, fontSize: 9.5, color: T.gold, background: 'none', border: 0, cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' as const, flexShrink: 0 }}
          >
            Share ↗
          </button>
        </div>
      </div>
    </div>
  );
}
