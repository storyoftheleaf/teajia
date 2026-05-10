import React from 'react';
import { Store } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

interface Props {
  onLogout?: () => void;
}

export const NoMembershipGate: React.FC<Props> = ({ onLogout }) => {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-tea-bg text-tea-text">
      <div className="w-full max-w-md bg-tea-surface rounded-lg border border-tea-border p-8 text-center">
        <div className="mb-5 flex justify-center">
          <div className="w-14 h-14 rounded-full bg-tea-gold-lt flex items-center justify-center">
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
