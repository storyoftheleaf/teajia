import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Icons } from '../components/Icons';
import { LogoEmblem } from '../components/Logos/LogoEmblem';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid reset link. Please request a new one from your administrator.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.auth.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may be expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Icons.AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-serif text-tea-text mb-2">Invalid Reset Link</h2>
          <p className="text-sm text-tea-text-sec mb-6">
            This password reset link is missing or invalid. Please contact your administrator for a new link.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-tea-gold text-tea-text text-xs uppercase tracking-[0.2em] font-bold hover:bg-tea-gold/90 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mx-auto mb-4">
            <Icons.Check className="w-8 h-8 text-tea-gold" />
          </div>
          <h2 className="text-xl font-serif text-tea-text mb-2">Password Reset</h2>
          <p className="text-sm text-tea-text-sec mb-6">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-tea-gold text-tea-text text-xs uppercase tracking-[0.2em] font-bold hover:bg-tea-gold/90 transition-colors"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tea-bg flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="flex flex-col items-center mb-8">
          <LogoEmblem size={48} color="var(--tea-gold)" className="opacity-80 mb-4" />
          <h2 className="text-xl font-serif text-tea-text mb-1">Reset Password</h2>
          <p className="text-sm text-tea-text-sec font-serif italic">Choose a new password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-tea-surface border border-tea-border p-3.5 text-tea-text outline-none focus:border-tea-gold transition-colors placeholder-tea-text-sec/50 text-base"
              placeholder="Min 6 characters"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-tea-surface border border-tea-border p-3.5 text-tea-text outline-none focus:border-tea-gold transition-colors text-base"
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-red-600 text-sm">
              <Icons.AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-tea-gold text-tea-text font-bold text-xs uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-tea-gold/20 border-t-tea-text-sec rounded-full animate-spin" />
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
