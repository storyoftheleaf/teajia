/**
 * CompassShareModal
 *
 * Lets an admin share a capture card two ways:
 *  A) Direct push to a known account slug
 *  B) Generate an invite link for external tasters
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Link as LinkIcon, Send, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { fetchStore } from '../../lib/storefrontApi';

interface CompassShareModalProps {
  entryId: string;
  entryName: string;
  onClose: () => void;
}

export const CompassShareModal: React.FC<CompassShareModalProps> = ({
  entryId,
  entryName,
  onClose,
}) => {
  const [accountSlug, setAccountSlug] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [directSent, setDirectSent] = useState(false);
  const [tab, setTab] = useState<'direct' | 'link'>('direct');

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
    mutationFn: () => api.compass.share({ entryId, generateInviteLink: true }),
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative z-10 w-full sm:max-w-sm bg-tea-elevated rounded-t-2xl sm:rounded-xl border border-tea-border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5 shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim mb-0.5">Share</p>
            <h2 className="font-serif text-[15px] text-tea-text leading-tight truncate max-w-[200px]">
              {entryName || 'This card'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-tea-text-dim hover:text-tea-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-4 rounded-md bg-tea-surface/40 p-0.5">
          <button
            type="button"
            onClick={() => setTab('direct')}
            className={`flex-1 py-1.5 rounded-[5px] text-[11px] font-medium transition-colors ${
              tab === 'direct' ? 'bg-tea-surface text-tea-text shadow-sm' : 'text-tea-text-dim'
            }`}
          >
            Send to account
          </button>
          <button
            type="button"
            onClick={() => setTab('link')}
            className={`flex-1 py-1.5 rounded-[5px] text-[11px] font-medium transition-colors ${
              tab === 'link' ? 'bg-tea-surface text-tea-text shadow-sm' : 'text-tea-text-dim'
            }`}
          >
            Invite link
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
                <span className="text-tea-text font-mono">teajia.com/store/</span>)
                to push this card directly.
              </p>

              {directSent ? (
                <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-tea-gold/10 text-tea-gold text-sm font-medium">
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
                        // Reset error when user edits
                        if (directMutation.isError) directMutation.reset();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && accountSlug.trim() && !directMutation.isPending) {
                          directMutation.mutate();
                        }
                      }}
                      placeholder="account-slug"
                      className="flex-1 bg-tea-surface text-tea-text text-sm rounded-md px-3 py-2.5 border border-tea-border focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 transition-colors placeholder:text-tea-text-dim font-mono"
                    />
                    <button
                      type="button"
                      disabled={!accountSlug.trim() || directMutation.isPending}
                      onClick={() => directMutation.mutate()}
                      className="px-4 py-2 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold uppercase tracking-[0.08em] disabled:opacity-40 transition-opacity flex items-center gap-1.5"
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
                    <p className="text-xs text-red-400">
                      {(directMutation.error as Error)?.message || 'Could not send. Check the slug and try again.'}
                    </p>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="link"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <p className="text-xs text-tea-text-sec">
                Generate a link anyone can open to view the card. Authenticated Teajia users
                can save it to their compass.
              </p>

              {inviteLink ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-tea-surface rounded-md px-3 py-2 border border-tea-border">
                    <span className="flex-1 text-[11px] text-tea-text-sec font-mono truncate">{inviteLink}</span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="shrink-0 text-tea-text-dim hover:text-tea-gold transition-colors"
                    >
                      {copiedLink ? <Check size={14} className="text-tea-gold" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="w-full py-2.5 rounded-md bg-tea-gold/10 text-tea-gold text-xs font-semibold uppercase tracking-[0.08em] hover:bg-tea-gold/15 transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy size={12} />
                    {copiedLink ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={linkMutation.isPending}
                  onClick={() => linkMutation.mutate()}
                  className="w-full py-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold uppercase tracking-[0.08em] disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
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
                <p className="text-xs text-red-400">
                  {(linkMutation.error as Error)?.message || 'Could not generate link. Try again.'}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default CompassShareModal;
