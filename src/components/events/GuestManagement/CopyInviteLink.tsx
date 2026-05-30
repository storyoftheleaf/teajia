import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

// ----------------------------------------------------------------
// Copy-invite-link button
// ----------------------------------------------------------------
interface CopyInviteLinkProps {
  inviteToken: string;
  nameHint?: string;
  contact?: string;
  eventTitle?: string;
  claimedByName?: string;
}

const CopyInviteLink: React.FC<CopyInviteLinkProps> = ({
  inviteToken,
  nameHint,
  contact,
  eventTitle,
  claimedByName,
}) => {
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}/invite/${inviteToken}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isPhone = contact && !contact.includes('@');
  const whatsappUrl = isPhone
    ? (() => {
        const digits = contact!.replace(/\D/g, '');
        const msg = `Hey! I've saved you a seat at ${eventTitle || 'our tea session'}. Claim it here: ${inviteUrl}`;
        return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
      })()
    : null;

  // Identity miniature: small monogram avatar + name/hint
  const monogram = (claimedByName || nameHint || '?').trim().charAt(0).toUpperCase();

  if (claimedByName) {
    return (
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-tea-gold/10 text-tea-gold text-ui-14" style={{ fontFamily: 'var(--font-display)' }}>
          {monogram}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ui-14 text-tea-text truncate" style={{ fontFamily: 'var(--font-display)' }}>{claimedByName}</p>
          {nameHint && <p className="text-ui-12 text-tea-text-sec italic truncate">{nameHint}</p>}
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[0.15em] bg-tea-gold/10 text-tea-text">
          <Check className="w-3 h-3" /> Claimed
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-tea-elevated text-tea-text-dim text-ui-14" style={{ fontFamily: 'var(--font-display)' }}>
        {monogram}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-ui-14 text-tea-text-sec italic truncate">
          {nameHint || 'Guest'}
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-0.5">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-ui-11 font-semibold text-tea-readgold hover:text-tea-text transition-colors"
            >
              Send via WhatsApp
            </a>
          ) : null}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-ui-11 font-semibold text-tea-text-sec hover:text-tea-text transition-colors"
          >
            {copied ? (
              <><Check className="w-3 h-3" />Copied</>
            ) : (
              <><Copy className="w-3 h-3" />Copy link</>
            )}
          </button>
        </div>
      </div>
      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[0.15em] bg-tea-elevated text-tea-text-dim">
        Unclaimed
      </span>
    </div>
  );
};

export default CopyInviteLink;
