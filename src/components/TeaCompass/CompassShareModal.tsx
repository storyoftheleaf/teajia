/**
 * CompassShareModal
 *
 * Lets an admin share a capture card two ways:
 *  A) Direct push to a known account slug
 *  B) Generate an invite link for external tasters
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Link as LinkIcon, QrCode, Send, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../lib/api';
import { fetchStore } from '../../lib/storefrontApi';
import { syncCompassEntries } from '../../lib/teaCompassSync';

interface CompassShareModalProps {
  entryId: string;
  entryName: string;
  synced: boolean;
  onClose: () => void;
}

export const CompassShareModal: React.FC<CompassShareModalProps> = ({
  entryId,
  entryName,
  synced,
  onClose,
}) => {
  const [accountSlug, setAccountSlug] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [directSent, setDirectSent] = useState(false);
  const [tab, setTab] = useState<'direct' | 'link' | 'table'>('link');
  const [showQr, setShowQr] = useState(false);
  const [tableUrl, setTableUrl] = useState<string | null>(null);
  const [copiedTable, setCopiedTable] = useState(false);

  const lookupAccountId = async (slug: string): Promise<string | null> => {
    try {
      const data = await fetchStore(slug);
      return (data as any)?.id || null;
    } catch {
      return null;
    }
  };

  const directMutation = useMutation({
    mutationFn: async () => {
      if (!synced) await syncCompassEntries();
      const accountId = await lookupAccountId(accountSlug.trim().toLowerCase());
      if (!accountId) throw new Error(`No account found for "${accountSlug}"`);
      return api.compass.share({ entryId, targetAccountIds: [accountId] });
    },
    onSuccess: () => {
      setDirectSent(true);
      // Auto-close after showing success briefly
      setTimeout(onClose, 2000);
    },
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!synced) await syncCompassEntries();
      return api.compass.share({ entryId, generateInviteLink: true });
    },
    onSuccess: (data: any) => {
      // Worker returns { shares, invite_link: "/share/<token>" }
      const invitePath = data?.invite_link;
      if (invitePath) {
        setInviteLink(`${window.location.origin}${invitePath}`);
      }
    },
  });

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-priority flex items-end sm:items-center justify-center pb-nav sm:pb-0"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-tea-bg/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet — bottom-docked on mobile but the parent flex container
          carries pb-nav, so the sheet sits ABOVE the BottomTabBar
          rather than rendering behind it. On sm+ the modal centers
          normally. */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative z-10 w-full sm:max-w-sm bg-tea-elevated rounded-t-xl sm:rounded-xl border border-tea-border p-5 pb-5 shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-dim mb-0.5">Share</p>
            <h2 className="font-serif text-ui-15 text-tea-text leading-tight truncate max-w-[200px]">
              {entryName || 'This card'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tap-target p-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-4 rounded-md bg-tea-surface/40 p-0.5">
          <button
            type="button"
            onClick={() => setTab('direct')}
            className={`flex-1 py-1.5 rounded-[5px] text-ui-11 font-medium transition-colors ${
              tab === 'direct' ? 'bg-tea-surface text-tea-text ' : 'text-tea-text-dim'
            }`}
          >
            Account
          </button>
          <button
            type="button"
            onClick={() => setTab('link')}
            className={`flex-1 py-1.5 rounded-[5px] text-ui-11 font-medium transition-colors ${
              tab === 'link' ? 'bg-tea-surface text-tea-text ' : 'text-tea-text-dim'
            }`}
          >
            Link
          </button>
          <button
            type="button"
            onClick={() => setTab('table')}
            className={`flex-1 py-1.5 rounded-[5px] text-ui-11 font-medium transition-colors ${
              tab === 'table' ? 'bg-tea-surface text-tea-text ' : 'text-tea-text-dim'
            }`}
          >
            Follow-up
          </button>
        </div>

        <AnimatePresence mode="wait">
          {tab === 'direct' ? (
            <motion.div
              key="direct"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <p className="text-xs text-tea-text-sec">
                Enter the account slug (the part after{' '}
                <span className="text-tea-text font-mono">/store/</span>)
                to push this card directly.
              </p>

              {directSent ? (
                <div className="flex items-center gap-2 py-3 px-3 rounded-xl bg-tea-gold/10 text-tea-gold text-sm font-medium">
                  <Check size={14} strokeWidth={2.5} />
                  Card sent to {accountSlug}
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={accountSlug}
                      onChange={(e) => {
                        setAccountSlug(e.target.value);
                        if (directMutation.isError) directMutation.reset();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && accountSlug.trim() && !directMutation.isPending) {
                          directMutation.mutate();
                        }
                      }}
                      placeholder="account-slug"
                      className="flex-1 bg-tea-surface text-tea-text text-sm rounded-md px-3 py-2.5 border border-tea-border focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 transition-colors placeholder:text-tea-text-sec/70 font-mono"
                    />
                    <button
                      type="button"
                      disabled={!accountSlug.trim() || directMutation.isPending}
                      onClick={() => directMutation.mutate()}
                      className="px-4 py-2 rounded-md cta-solid text-xs font-semibold uppercase tracking-[0.08em] disabled:opacity-40 transition-opacity flex items-center gap-1.5"
                    >
                      {directMutation.isPending ? (
                        <span className="inline-block w-3.5 h-3.5 border-2 border-tea-bg/30 border-t-tea-bg rounded-full animate-spin" />
                      ) : (
                        <Send size={12} />
                      )}
                      Send
                    </button>
                  </div>
                  {directMutation.isError && (
                    <p className="text-xs text-tea-error">
                      {(directMutation.error as Error)?.message || 'Could not send. Check the slug and try again.'}
                    </p>
                  )}
                </>
              )}
            </motion.div>
          ) : tab === 'link' ? (
            <motion.div
              key="link"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <p className="text-xs text-tea-text-sec">
                Generate a link anyone can open to view the card. Signed-in Teajia users
                can save it to their tea journal.
              </p>

              {inviteLink ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-tea-surface rounded-md px-3 py-2 border border-tea-border">
                    <span className="flex-1 text-ui-11 text-tea-text-sec font-mono truncate">{inviteLink}</span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="shrink-0 text-tea-text-dim hover:text-tea-gold transition-colors"
                    >
                      {copiedLink ? <Check size={14} className="text-tea-gold" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="flex-1 py-2.5 rounded-md bg-tea-gold/10 text-tea-gold text-xs font-semibold uppercase tracking-[0.08em] hover:bg-tea-gold/15 transition-colors flex items-center justify-center gap-2"
                    >
                      <Copy size={12} />
                      {copiedLink ? 'Copied!' : 'Copy link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQr(v => !v)}
                      className={`px-3 py-2.5 rounded-md text-xs font-semibold uppercase tracking-[0.08em] transition-colors flex items-center gap-1.5 ${
                        showQr ? 'cta-solid' : 'bg-tea-gold/10 text-tea-gold hover:bg-tea-gold/15'
                      }`}
                    >
                      <QrCode size={12} />
                      QR
                    </button>
                  </div>
                  <AnimatePresence>
                    {showQr && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex justify-center pt-1"
                      >
                        <div className="p-3 bg-tea-text rounded-xl">
                          <QRCodeSVG value={inviteLink} size={180} bgColor="transparent" fgColor="var(--tea-bg)" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={linkMutation.isPending}
                  onClick={() => linkMutation.mutate()}
                  className="w-full py-3 rounded-md cta-solid text-xs font-semibold uppercase tracking-[0.08em] disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
                >
                  {linkMutation.isPending ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-tea-bg/30 border-t-tea-bg rounded-full animate-spin" />
                  ) : (
                    <LinkIcon size={13} />
                  )}
                  Generate link
                </button>
              )}

              {linkMutation.isError && (
                <p className="text-xs text-tea-error">
                  {(linkMutation.error as Error)?.message || 'Could not generate link. Try again.'}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="table"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <p className="text-xs text-tea-text-sec">
                Generate a 24-hour QR code for after-session feedback. Guests can leave a verdict without creating an account.
              </p>
              {tableUrl ? (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="p-3 bg-tea-text rounded-xl">
                      <QRCodeSVG value={tableUrl} size={180} bgColor="transparent" fgColor="var(--tea-bg)" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(tableUrl);
                      setCopiedTable(true);
                      setTimeout(() => setCopiedTable(false), 2000);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-tea-surface border border-tea-border text-tea-text-sec text-xs font-medium hover:text-tea-text transition-colors"
                  >
                    {copiedTable ? <Check size={13} className="text-tea-gold" /> : <Copy size={13} />}
                    {copiedTable ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!synced}
                  onClick={async () => {
                    try {
                      const result = await api.compass.createTableShare(entryId);
                      if (result?.url) {
                        setTableUrl(`${window.location.origin}${result.url}`);
                      }
                    } catch { /* ignore */ }
                  }}
                  className="w-full py-3 rounded-md cta-solid text-xs font-semibold uppercase tracking-[0.08em] disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
                >
                  <QrCode size={13} />
                  {synced ? 'Generate feedback QR' : 'Sync first to generate'}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default CompassShareModal;
