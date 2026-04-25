/**
 * TastingCard — a beautiful shareable image generated from a journal entry.
 *
 * The component renders an off-screen card via a ref, then html-to-image
 * captures it as a PNG for download or Web Share API.
 *
 * All styles are inline so html-to-image resolves them correctly.
 */

import React, { useRef, useState, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2 } from 'lucide-react';
import type { CustomerTasting } from '../../types';
import { LIQUOR_COLORS, resolveTermLabel } from '../../data/tastingTaxonomy';

/* ── helpers ── */

function qualityWord(q: number | undefined): string | null {
  if (!q) return null;
  if (q >= 9) return 'Exceptional';
  if (q >= 7) return 'Impressive';
  if (q >= 5) return 'Pleasant';
  if (q >= 3) return 'Rough edges';
  return 'Didn\'t connect';
}

function formatCardDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return '';
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── card component (rendered off-screen for image capture) ── */

interface TastingCardVisualProps {
  entry: CustomerTasting;
  cardRef: React.RefObject<HTMLDivElement>;
}

const TastingCardVisual: React.FC<TastingCardVisualProps> = ({ entry, cardRef }) => {
  const noteData = entry.note.tasting;
  const liquorColorId = noteData['liquor-color']?.[0] ?? null;
  const liquorHex = liquorColorId ? (LIQUOR_COLORS[liquorColorId] ?? null) : null;

  const flavorTerms = (noteData.flavor ?? [])
    .slice(0, 5)
    .map(id => resolveTermLabel(id))
    .filter(Boolean);

  const qualityScore = noteData.quality ?? entry.note.rating ?? null;
  const word = qualityWord(qualityScore ?? undefined);

  const chineseMarkers: string[] = [
    noteData.huiGan ? '回甘' : '',
    noteData.yun    ? '韵'   : '',
    noteData.qi     ? '气'   : '',
    noteData.tangGan ? '汤感' : '',
  ].filter(Boolean);

  const bg = '#171410';
  const text = '#f0ebe3';
  const muted = '#8a7f74';
  const gold = '#c8a84b';
  const border = '#2e2820';

  return (
    <div
      ref={cardRef}
      style={{
        width: 375,
        background: bg,
        fontFamily: "'Georgia', 'Palatino Linotype', serif",
        position: 'absolute',
        top: -9999,
        left: -9999,
        zIndex: -1,
        overflow: 'hidden',
      }}
    >
      {/* Liquor color top accent */}
      {liquorHex && (
        <div style={{ height: 4, background: `linear-gradient(to right, ${liquorHex}, ${hexToRgba(liquorHex, 0.3)})` }} />
      )}

      <div style={{ padding: '24px 28px 28px' }}>

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <span style={{
            fontFamily: "'Georgia', serif",
            fontSize: 13,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: gold,
          }}>
            Teajia
          </span>
          {liquorHex && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: liquorHex,
                boxShadow: `0 0 0 1.5px ${hexToRgba(liquorHex, 0.3)}`,
              }} />
              <span style={{ fontSize: 10, color: muted, letterSpacing: '0.06em', fontFamily: 'Georgia, serif' }}>
                {liquorColorId?.replace(/-/g, ' ')}
              </span>
            </div>
          )}
        </div>

        {/* Tea name */}
        <div style={{
          fontSize: 26,
          fontWeight: 'normal',
          color: text,
          lineHeight: 1.2,
          marginBottom: 6,
          fontFamily: "'Georgia', 'Palatino Linotype', serif",
        }}>
          {entry.productName}
        </div>

        {/* Tea type */}
        {entry.productType && (
          <div style={{
            fontSize: 11,
            color: muted,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 24,
            fontFamily: 'Georgia, serif',
          }}>
            {entry.productType}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: border, marginBottom: 24 }} />

        {/* Flavor terms */}
        {flavorTerms.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, color: muted, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'Georgia, serif' }}>
              Flavor
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {flavorTerms.map((term, i) => (
                <span key={i} style={{
                  fontSize: 12,
                  color: text,
                  background: hexToRgba(gold, 0.12),
                  border: `1px solid ${hexToRgba(gold, 0.2)}`,
                  borderRadius: 20,
                  padding: '3px 10px',
                  fontFamily: 'Georgia, serif',
                  letterSpacing: '0.04em',
                }}>
                  {term}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quality word */}
        {word && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, color: muted, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Georgia, serif' }}>
              Quality
            </div>
            <div style={{ fontSize: 18, color: gold, fontFamily: "'Georgia', serif", letterSpacing: '0.04em' }}>
              {word}
            </div>
          </div>
        )}

        {/* Chinese markers */}
        {chineseMarkers.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {chineseMarkers.map((c, i) => (
              <span key={i} style={{
                fontSize: 16,
                color: hexToRgba(gold, 0.7),
                fontFamily: 'serif',
                letterSpacing: '0.06em',
              }}>
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Personal note */}
        {entry.note.personalNote && (
          <div style={{ marginBottom: 20 }}>
            <p style={{
              fontSize: 12,
              color: muted,
              fontStyle: 'italic',
              lineHeight: 1.6,
              fontFamily: 'Georgia, serif',
              borderLeft: `2px solid ${hexToRgba(gold, 0.3)}`,
              paddingLeft: 12,
            }}>
              "{entry.note.personalNote}"
            </p>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: border, marginBottom: 18 }} />

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: muted, fontFamily: 'Georgia, serif', letterSpacing: '0.06em' }}>
            {formatCardDate(entry.createdAt)}
          </span>
          <span style={{ fontSize: 10, color: hexToRgba(gold, 0.5), fontFamily: 'Georgia, serif', letterSpacing: '0.1em' }}>
            teajia.com
          </span>
        </div>
      </div>
    </div>
  );
};

/* ── share modal ── */

interface TastingCardModalProps {
  entry: CustomerTasting;
  onClose: () => void;
}

export const TastingCardModal: React.FC<TastingCardModalProps> = ({ entry, onClose }) => {
  const cardRef = useRef<HTMLDivElement>(null!);
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const getImage = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch (e) {
      console.error('TastingCard export failed', e);
      return null;
    } finally {
      setExporting(false);
    }
  }, []);

  const handleDownload = async () => {
    const blob = await getImage();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entry.productName.replace(/\s+/g, '-').toLowerCase()}-tasting.png`;
    a.click();
    URL.revokeObjectURL(url);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };

  const handleShare = async () => {
    const blob = await getImage();
    if (!blob) return;
    const file = new File([blob], `${entry.productName}-tasting.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${entry.productName} · Teajia`,
          text: entry.productType ? `${entry.productType} tea tasting` : 'Tea tasting',
        });
      } catch {}
    } else {
      // Fall back to download on desktop
      handleDownload();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-end"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Off-screen card (captured by html-to-image) */}
      <TastingCardVisual entry={entry} cardRef={cardRef} />

      {/* Sheet */}
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="w-full bg-tea-bg border-t border-tea-border rounded-t-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div>
            <div className="text-sm font-medium text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
              Share tasting card
            </div>
            <div className="text-[11px] text-tea-text-dim mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
              {entry.productName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-tea-text-dim hover:text-tea-text transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Card preview — visible to user */}
        <div className="px-5 mb-5 overflow-hidden rounded-xl" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: '#171410',
              boxShadow: '0 4px 32px rgba(24,19,14,0.5)',
              transform: 'scale(0.96)',
              transformOrigin: 'top center',
            }}
          >
            <PreviewCard entry={entry} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-tea-surface border border-tea-border text-tea-text text-[13px] font-medium transition-opacity disabled:opacity-50"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <Download size={15} />
            {done ? 'Saved' : 'Download'}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-tea-gold text-[13px] font-semibold transition-opacity disabled:opacity-50"
            style={{ fontFamily: 'var(--font-display)', color: '#171410' }}
          >
            <Share2 size={15} />
            {exporting ? 'Generating…' : 'Share'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ── Preview card (visible inside the sheet, uses Tailwind) ── */

const PreviewCard: React.FC<{ entry: CustomerTasting }> = ({ entry }) => {
  const liquorColorId = entry.note.tasting['liquor-color']?.[0] ?? null;
  const liquorHex = liquorColorId ? (LIQUOR_COLORS[liquorColorId] ?? null) : null;
  const flavorTerms = (entry.note.tasting.flavor ?? []).slice(0, 4).map(resolveTermLabel).filter(Boolean);
  const word = qualityWord(entry.note.tasting.quality ?? entry.note.rating ?? undefined);
  const chineseMarkers = [
    entry.note.tasting.huiGan ? '回甘' : '',
    entry.note.tasting.yun    ? '韵'   : '',
    entry.note.tasting.qi     ? '气'   : '',
    entry.note.tasting.tangGan ? '汤感' : '',
  ].filter(Boolean);

  return (
    <div style={{ background: '#171410', fontFamily: 'Georgia, serif' }}>
      {liquorHex && (
        <div style={{ height: 3, background: `linear-gradient(to right, ${liquorHex}, transparent)` }} />
      )}
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] tracking-[0.22em] uppercase" style={{ color: '#c8a84b', fontFamily: 'Georgia, serif' }}>Teajia</span>
          {liquorHex && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: liquorHex }} />
              <span className="text-[9px]" style={{ color: '#8a7f74', fontFamily: 'Georgia, serif' }}>{liquorColorId?.replace(/-/g, ' ')}</span>
            </div>
          )}
        </div>
        <div className="text-[22px] leading-snug mb-1" style={{ color: '#f0ebe3', fontFamily: 'Georgia, serif' }}>{entry.productName}</div>
        {entry.productType && <div className="text-[9px] tracking-[0.18em] uppercase mb-4" style={{ color: '#8a7f74', fontFamily: 'Georgia, serif' }}>{entry.productType}</div>}
        <div className="border-b mb-4" style={{ borderColor: '#2e2820' }} />
        {flavorTerms.length > 0 && (
          <div className="mb-3">
            <div className="text-[8px] tracking-[0.2em] uppercase mb-2" style={{ color: '#8a7f74', fontFamily: 'Georgia, serif' }}>Flavor</div>
            <div className="flex flex-wrap gap-1.5">
              {flavorTerms.map((t, i) => (
                <span key={i} className="text-[11px] rounded-full px-2.5 py-0.5" style={{ color: '#f0ebe3', background: 'rgba(200,168,75,0.12)', border: '1px solid rgba(200,168,75,0.2)', fontFamily: 'Georgia, serif' }}>{t}</span>
              ))}
            </div>
          </div>
        )}
        {word && <div className="text-[15px] mb-3" style={{ color: '#c8a84b', fontFamily: 'Georgia, serif' }}>{word}</div>}
        {chineseMarkers.length > 0 && (
          <div className="flex gap-2 mb-3">
            {chineseMarkers.map((c, i) => (
              <span key={i} className="text-[14px]" style={{ color: 'rgba(200,168,75,0.7)', fontFamily: 'serif' }}>{c}</span>
            ))}
          </div>
        )}
        {entry.note.personalNote && (
          <p className="text-[11px] italic mb-3 pl-3" style={{ color: '#8a7f74', fontFamily: 'Georgia, serif', borderLeft: '2px solid rgba(200,168,75,0.3)', lineHeight: 1.6 }}>
            "{entry.note.personalNote}"
          </p>
        )}
        <div className="border-b mb-3" style={{ borderColor: '#2e2820' }} />
        <div className="flex items-center justify-between">
          <span className="text-[9px]" style={{ color: '#8a7f74', fontFamily: 'Georgia, serif' }}>{formatCardDate(entry.createdAt)}</span>
          <span className="text-[9px] tracking-[0.1em]" style={{ color: 'rgba(200,168,75,0.4)', fontFamily: 'Georgia, serif' }}>teajia.com</span>
        </div>
      </div>
    </div>
  );
};
