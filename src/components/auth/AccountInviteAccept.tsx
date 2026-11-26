/**
 * Accepting an account or tea master invite at /invite/:token.
 *
 * Five places in the worker invite a person to a shop by putting a token in
 * password_reset_tokens and sending them `/invite/<token>`. That address also
 * serves session plus-guest invites, so when the guest invite lookup does not
 * know the token, the page offers this instead: choose a password, and the
 * existing reset route sets it, verifies the email and turns the invited
 * membership active. Invites already sent start working; nothing new is stored.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { authPagePath } from '../../lib/authNavigation';
import { Icons } from '../Icons';

const inputClass = "w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors placeholder-tea-text-dim";
const labelClass = "block label-caps text-tea-text-sec mb-1.5";

export const AccountInviteAccept: React.FC<{ token: string }> = ({ token }) => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'form' | 'saving' | 'done' | 'unknown'>('form');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setState('saving');
    try {
      await api.auth.resetPassword(token, password);
      setState('done');
    } catch {
      // The reset route cannot tell an unknown token from a used or expired one, and neither can we.
      setState('unknown');
    }
  };

  if (state === 'unknown') {
    return (
      <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap" data-testid="invite-unknown">
        <div className="text-center">
          <h1 className="h2">Invite not found</h1>
          <p className="subtitle mt-2">This invite link may be invalid, already used, or expired. Ask the person who invited you for a new one.</p>
        </div>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap" data-testid="invite-accepted">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 flex items-center justify-center mx-auto mb-5">
            <Icons.Check className="w-7 h-7 text-tea-gold" />
          </div>
          <h1 className="h2">You have joined</h1>
          <p className="subtitle mt-2">Your password is set. Sign in with your email and the password you chose.</p>
        </div>
        <button type="button" onClick={() => navigate(authPagePath('signin', null))} className="btn-primary btn-primary-lg w-full">
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap" data-testid="invite-accept">
      <div className="text-center mb-8">
        <h1 className="h2">You are invited</h1>
        <p className="subtitle mt-2">Choose a password to accept.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="invite-password">Password</label>
          <input id="invite-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
            className={inputClass} placeholder="Min 6 characters" autoComplete="new-password" required autoFocus />
        </div>
        <div>
          <label className={labelClass} htmlFor="invite-confirm">Confirm password</label>
          <input id="invite-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            className={inputClass} autoComplete="new-password" required />
        </div>
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-tea-error/5 border border-tea-error/20">
            <Icons.AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-tea-error" />
            <span className="text-ui-12 text-tea-error">{error}</span>
          </div>
        )}
        <button type="submit" disabled={state === 'saving'} className="btn-primary btn-primary-lg w-full">
          {state === 'saving'
            ? <div className="w-4 h-4 border-2 border-tea-bg/30 border-t-tea-bg rounded-full animate-spin" />
            : 'Accept invite'}
        </button>
      </form>
    </div>
  );
};
