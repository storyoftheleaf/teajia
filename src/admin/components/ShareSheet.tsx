import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Link2, MessageCircle, Download, Send, Mail } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildWhatsAppUrl } from '../../lib/whatsapp';
import { useToast } from './Toast';
import { TeaEvent } from '../../types/events';

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  event: TeaEvent;
}

function formatEventDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function buildWhatsAppMessage(event: TeaEvent, eventUrl: string): string {
  const lines: string[] = [];
  lines.push(`*${event.title}*`);
  if (event.subtitle) lines.push(`_${event.subtitle}_`);
  lines.push('');
  lines.push(formatEventDateShort(event.eventDate));
  if (event.areaHint) lines.push(event.areaHint);
  else if (event.locationName) lines.push(event.locationName);
  lines.push('');
  lines.push('Request your seat:');
  lines.push(eventUrl);
  return lines.join('\n');
}

export const ShareSheet: React.FC<ShareSheetProps> = ({ isOpen, onClose, event }) => {
  const { showToast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);

  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const eventUrl = `${window.location.origin.replace(/\/$/, '')}/event/${event.slug}`;
  const whatsappMessage = buildWhatsAppMessage(event, eventUrl);
  const whatsappUrl = buildWhatsAppUrl('', whatsappMessage);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setCopiedLabel(null);
    }
  }, [isOpen]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLabel(label);
      setTimeout(() => setCopiedLabel(null), 2000);
      showToast(`${label} copied`, 'info');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const handleDownloadQR = () => {
    if (!qrRef.current) return;
    const canvas = qrRef.current.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.slug}-qr.png`;
    a.click();
    showToast('QR downloaded', 'success');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-tea-bg/70 backdrop-blur-sm z-modal flex items-end lg:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-tea-surface border border-tea-border rounded-t-xl lg:rounded-xl w-full max-w-md mx-0 lg:mx-4 mb-0 lg:mb-0"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-tea-border">
            <button
              onClick={onClose}
              className="tap-target text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label="Close share event"
            >
              <X size={16} />
            </button>
            <h2 className="text-sm font-serif text-tea-text tracking-wide">Share Event</h2>
            <div className="w-4" />
          </div>

          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-hide">

            {/* ── WhatsApp ── */}
            <section className="space-y-2">
              <div className="flex items-center gap-1.5 text-ui-10 uppercase tracking-[0.18em] text-tea-text-sec font-medium">
                <MessageCircle size={11} />
                WhatsApp
              </div>

              {/* Message preview */}
              <div className="bg-tea-bg/50 rounded-md p-3 border border-tea-border">
                <pre className="text-xs text-tea-text-sec whitespace-pre-wrap font-sans leading-relaxed">
                  {whatsappMessage}
                </pre>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(whatsappMessage, 'Message')}
                  className={`tap-target flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors ${
                    copiedLabel === 'Message'
                      ? 'bg-tea-gold/20 text-tea-gold'
                      : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'
                  }`}
                >
                  {copiedLabel === 'Message' ? <Check size={11} /> : <Copy size={11} />}
                  Copy Message
                </button>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-target flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-tea-elevated text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  <Send size={11} />
                  Open WhatsApp
                </a>
              </div>
            </section>

            <div className="border-t border-tea-border" />

            {/* ── Email ── */}
            <section className="space-y-2">
              <div className="text-ui-10 uppercase tracking-[0.18em] text-tea-text-sec font-medium">
                Email
              </div>
              <div className="flex items-start gap-2 rounded-md bg-tea-elevated border border-tea-border p-3">
                <Mail size={13} className="mt-0.5 shrink-0 text-tea-text-sec" />
                <p className="text-ui-11 text-tea-text-sec">
                  Email delivery is not configured. Copy the event link or WhatsApp message to share it manually.
                </p>
              </div>
            </section>

            <div className="border-t border-tea-border" />

            {/* ── Copy Link + QR ── */}
            <section className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => copyToClipboard(eventUrl, 'Link')}
                  className={`tap-target flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors ${
                    copiedLabel === 'Link'
                      ? 'bg-tea-gold/20 text-tea-gold'
                      : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'
                  }`}
                >
                  {copiedLabel === 'Link' ? <Check size={11} /> : <Link2 size={11} />}
                  Copy Link
                </button>

                <button
                  onClick={handleDownloadQR}
                  className="tap-target flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-tea-elevated text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  <Download size={11} />
                  Download QR
                </button>
              </div>

              {/* QR Code */}
              <div
                ref={qrRef}
                className="inline-flex items-center justify-center bg-white rounded-md p-3"
              >
                <QRCodeCanvas
                  value={eventUrl}
                  size={120}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#1a1510"
                />
              </div>
              <p className="text-ui-10 text-tea-text-dim truncate">{eventUrl}</p>
            </section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
