import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Icons } from '../components/Icons';

const inputClass = "w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors placeholder-tea-text-dim";
const labelClass = "block label-caps text-tea-text-sec mb-1.5";

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
      <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-tea-error/10 flex items-center justify-center mx-auto mb-5">
            <Icons.AlertCircle className="w-6 h-6 text-tea-error" />
          </div>
          <h1 className="h2">Invalid reset link</h1>
          <p className="subtitle mt-2">
            This password reset link is missing or invalid. Please contact your administrator for a new link.
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md cta-solid text-xs font-semibold transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 flex items-center justify-center mx-auto mb-5">
            <Icons.Check className="w-7 h-7 text-tea-gold" />
          </div>
          <h1 className="h2">Password reset</h1>
          <p className="subtitle mt-2">
            Your password has been updated. You can now sign in with your new password.
          </p>
        </div>
        <button
          onClick={() => navigate('/signin')}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md cta-solid text-xs font-semibold transition-colors"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap">
      <div className="text-center mb-8">
        <h1 className="h2">Reset password</h1>
        <p className="subtitle mt-2">Choose a new password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
            placeholder="Min 6 characters"
            required
            autoFocus
          />
          <p className="text-ui-12 text-tea-text-dim mt-1">Must be at least 6 characters.</p>
        </div>
        <div>
          <label className={labelClass}>Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
            required
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-tea-error/5 border border-tea-error/20">
            <Icons.AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-tea-error" />
            <span className="text-ui-12 text-tea-error">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-tea-bg/30 border-t-tea-bg rounded-full animate-spin" />
          ) : (
            'Reset Password'
          )}
        </button>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
