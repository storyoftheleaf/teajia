import React from 'react';
import { Store } from 'lucide-react';

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
        <h1 className="text-xl text-tea-text mb-3" style={{ fontFamily: 'var(--font-display)' }}>
          Waiting for an invite
        </h1>
        <p className="text-sm text-tea-text-sec leading-relaxed mb-6">
          You haven't been invited to a tea house yet. Ask the owner of the store you work at
          to send you an invite — once they add you to their team, you'll see it here.
        </p>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="text-ui-10 uppercase tracking-display text-tea-text-dim hover:text-tea-text transition-colors"
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
};

export default NoMembershipGate;
