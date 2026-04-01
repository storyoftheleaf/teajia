import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Link2, MessageCircle, Download, Loader2, Send } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
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
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const eventUrl = `${window.location.origin}/event/${event.slug}`;
  const whatsappMessage = buildWhatsAppMessage(event, eventUrl);
  const whatsappUrl = buildWhatsAppUrl('', whatsappMessage);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setCopiedLabel(null);
      setEmailSent(false);
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
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.slug}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('QR downloaded', 'success');
  };

  const handleSendEmails = async () => {
    setSendingEmail(true);
    try {
      await api.events.sendEmailInvites(event.id, {});
      setEmailSent(true);
      showToast('Email invites sent', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to send emails', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-tea-text/60 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center"
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
            <h2 className="text-sm font-serif text-tea-text tracking-wide">Share Event</h2>
            <button
              onClick={onClose}
              className="text-tea-text-sec hover:text-tea-text transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-hide">

            {/* ── WhatsApp ── */}
            <section className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-tea-text-sec font-medium">
                <MessageCircle size={11} />
                WhatsApp
              </div>

              {/* Message preview */}
              <div className="bg-tea-bg/50 rounded-md p-3 border border-tea-border/60">
                <pre className="text-xs text-tea-text-sec whitespace-pre-wrap font-sans leading-relaxed">
                  {whatsappMessage}
                </pre>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(whatsappMessage, 'Message')}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors ${
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
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-tea-elevated text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  <Send size={11} />
                  Open WhatsApp
                </a>
              </div>
            </section>

            <div className="border-t border-tea-border/50" />

            {/* ── Email ── */}
            <section className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-tea-text-sec font-medium">
                Email
              </div>
              <p className="text-[11px] text-tea-text-dim">
                Send an invite to all customers in your list.
              </p>
              <button
                onClick={handleSendEmails}
                disabled={sendingEmail || emailSent}
                className={`flex items-center gap-2 text-xs px-4 py-2 rounded transition-colors disabled:opacity-50 ${
                  emailSent
                    ? 'bg-tea-gold/20 text-tea-gold'
                    : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'
                }`}
              >
                {sendingEmail ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : emailSent ? (
                  <Check size={11} />
                ) : (
                  <Send size={11} />
                )}
                {emailSent ? 'Invites Sent' : sendingEmail ? 'Sending...' : 'Send Email Invites'}
              </button>
            </section>

            <div className="border-t border-tea-border/50" />

            {/* ── Copy Link + QR ── */}
            <section className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => copyToClipboard(eventUrl, 'Link')}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors ${
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
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-tea-elevated text-tea-text-sec hover:text-tea-text transition-colors"
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
                <QRCodeSVG
                  value={eventUrl}
                  size={120}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#1a1510"
                />
              </div>
              <p className="text-[10px] text-tea-text-dim truncate">{eventUrl}</p>
            </section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
