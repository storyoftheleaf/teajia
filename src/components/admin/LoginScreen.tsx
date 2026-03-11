import React, { useState } from 'react';
import { Icons } from '../Icons';

interface LoginScreenProps {
  onLogin: () => void;
  onClose: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onClose }) => {
  const [pwd, setPwd] = useState('');

  const checkLogin = () => {
    onLogin();
  };

  return (
    <div className="w-full h-full bg-tea-bg flex items-center justify-center p-6 md:pb-6">
      <button
        onClick={onClose}
        className="absolute top-6 left-6 text-tea-text/60 hover:text-tea-text"
        aria-label="Close login screen"
      >
        <Icons.Close className="w-6 h-6" />
      </button>

      <div className="w-full max-w-xs text-center">
        <div className="w-12 h-12 bg-tea-gold rounded-lg mx-auto mb-8 flex items-center justify-center text-tea-bg font-serif font-bold text-xl">
          T
        </div>
        <h2 className="text-tea-text font-serif text-xl mb-6">Editor Access</h2>

        <input
          type="password"
          value={pwd}
          onChange={e => setPwd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && checkLogin()}
          placeholder="Passkey"
          className="w-full bg-tea-surface border border-tea-gold/15 p-3 text-center text-tea-text tracking-[0.2em] outline-none focus:border-tea-gold rounded-sm mb-4 placeholder:text-tea-text/30"
          aria-label="Enter passkey"
        />

        <button
          onClick={checkLogin}
          className="w-full bg-tea-gold text-tea-bg py-3 uppercase tracking-[0.15em] text-xs font-bold hover:bg-tea-gold-lt transition-colors rounded-sm"
        >
          Enter
        </button>

        <div className="border-t border-tea-gold/15 mt-6 pt-6">
          <p className="text-tea-text/60 text-xs mb-3">Development Mode</p>
          <p className="text-tea-text/50 text-xs italic">
            Authentication is currently disabled
          </p>
        </div>
      </div>
    </div>
  );
};
