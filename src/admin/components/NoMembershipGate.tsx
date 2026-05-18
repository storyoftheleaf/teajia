import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Search, ShoppingBag, Store } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

interface Props {
  onLogout?: () => void;
}

export const NoMembershipGate: React.FC<Props> = ({ onLogout }) => {
  const publicLinks = [
    { label: 'Magazine', href: '/magazine', icon: <BookOpen size={14} strokeWidth={1.5} /> },
    { label: 'Find a Table', href: '/find-a-table', icon: <Search size={14} strokeWidth={1.5} /> },
    { label: 'Shop', href: '/shop', icon: <ShoppingBag size={14} strokeWidth={1.5} /> },
  ];

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-tea-bg text-tea-text">
      <div className="w-full max-w-md bg-tea-surface rounded-xl border border-tea-border p-8 text-center">
        <div className="mb-5 flex justify-center">
          <div className="w-14 h-14 rounded-full bg-tea-accent-sub flex items-center justify-center border border-tea-border">
            <Store className="text-tea-gold" size={22} />
          </div>
        </div>
        <h1 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-3`}>
          Waiting for an invite
        </h1>
        <p className="text-ui-14 text-tea-text-sec leading-relaxed mb-4">
          This login is not connected to a tea house yet. Ask the owner to add your email in Members & Access.
        </p>
        <p className="text-ui-12 text-tea-text-sec leading-relaxed mb-6">
          After they invite you, refresh this page or sign in again. If they receive an invite link, open it first to set your password.
        </p>
        <div className="border-t border-tea-border pt-5 mb-6">
          <div className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec font-medium mb-3">
            While you wait
          </div>
          <div className="grid grid-cols-1 gap-2">
            {publicLinks.map(link => (
              <Link
                key={link.href}
                to={link.href}
                className="min-h-[44px] flex items-center justify-center gap-2 border border-tea-border text-ui-13 text-tea-text-sec hover:text-tea-gold hover:bg-tea-accent-sub transition-colors"
              >
                <span className="text-tea-gold/70" aria-hidden="true">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec hover:text-tea-text transition-colors tap-target"
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
};

export default NoMembershipGate;
