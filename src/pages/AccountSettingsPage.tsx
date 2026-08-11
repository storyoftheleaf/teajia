import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api, setToken } from '../lib/api';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { Icons } from '../components/Icons';
import { useTheme } from '../context/ThemeContext';

const inputClass = "w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors";
const labelClass = "block label-caps text-tea-text-sec mb-1.5";
const helperClass = "text-ui-12 text-tea-text-dim mt-1";

function FormError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 p-3 bg-tea-error/10 ring-1 ring-inset ring-tea-error/40 rounded-md text-tea-error text-ui-13">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{error}</span>
    </div>
  );
}

function PrimarySubmit({ label, loading }: { label: string; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : null}
      {label}
    </button>
  );
}

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [editName, setEditName] = useState(auth.user?.name || '');
  const [editEmail, setEditEmail] = useState(auth.user?.email || '');
  const [editUsername, setEditUsername] = useState(auth.user?.username || '');
  const [editPhone, setEditPhone] = useState(auth.user?.phone || '');
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  // Google-linked accounts have no password yet, the form becomes "Set
  // password" (no current-password field). Default true so an existing
  // password is never changeable without the current one while /me loads.
  const [hasPassword, setHasPassword] = useState(true);
  useEffect(() => {
    api.auth.me()
      .then((me: any) => { if (typeof me?.has_password === 'boolean') setHasPassword(me.has_password); })
      .catch(() => { /* keep the safe default */ });
  }, []);

  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSaved(false);
    setProfileLoading(true);
    try {
      const updates: { name?: string; email?: string; username?: string | null; phone?: string } = {};
      if (editName && editName !== auth.user?.name) updates.name = editName;
      if (editEmail && editEmail !== auth.user?.email) updates.email = editEmail;
      const trimmedUsername = editUsername.trim();
      const currentUsername = auth.user?.username ?? '';
      if (trimmedUsername !== currentUsername) {
        updates.username = trimmedUsername === '' ? null : trimmedUsername;
      }
      const trimmedPhone = editPhone.trim();
      if (trimmedPhone !== (auth.user?.phone ?? '')) updates.phone = trimmedPhone;
      if (Object.keys(updates).length === 0) {
        setProfileError('No changes to save.');
        setProfileLoading(false);
        return;
      }
      const result = await api.auth.updateProfile(updates);
      if (result.token) setToken(result.token);
      await auth.checkSession();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: unknown) {
      setProfileError((err as Error)?.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    if (deleteConfirmText !== 'DELETE') { setDeleteError('Type DELETE to confirm.'); return; }
    if (!deletePassword) { setDeleteError('Password is required.'); return; }
    setDeleteLoading(true);
    try {
      await api.auth.deleteAccount(deletePassword);
      auth.logout();
      navigate('/');
    } catch (err: unknown) {
      setDeleteError((err as Error)?.message || 'Failed to delete account.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSaved(false);
    if (newPassword.length < 6) { setPasswordError('New password must be at least 6 characters.'); return; }
    if (newPassword !== confirmNewPassword) { setPasswordError('New passwords do not match.'); return; }
    setPasswordLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordSaved(true);
      setHasPassword(true);
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err: unknown) {
      setPasswordError((err as Error)?.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3 pb-nav-gap">
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <p className="text-ui-13 text-tea-text-sec mb-4">You need to be signed in to access account settings.</p>
          <button
            onClick={() => navigate('/signin')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const initials = (auth.user?.name || auth.user?.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3 pb-nav-gap space-y-8">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
        aria-label="Back"
      >
        <ArrowLeft size={14} />
        <span className="text-ui-12">Back</span>
      </button>

      {/* Header */}
      <div>
        <h1 className="h2">Account Settings</h1>
        <p className="label-caps text-tea-text-dim mt-1">Profile · Security</p>
        <a href="/account/profile" className="tap-target mt-3 inline-flex text-ui-13 text-tea-gold transition-colors hover:text-tea-gold-lt">Tea Master profile</a>
      </div>

      {/* Identity card */}
      <div className="bg-tea-surface border border-tea-border rounded-xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-tea-elevated text-tea-text-sec font-display text-ui-15 flex items-center justify-center flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="h3">{auth.user?.name || 'Member'}</h3>
          <p className="text-ui-13 text-tea-text-sec mt-0.5 truncate">{auth.user?.email}</p>
          {auth.user?.username ? (
            <p className="text-ui-12 text-tea-text-dim mt-0.5">@{auth.user.username}</p>
          ) : null}
        </div>
      </div>

      {/* Edit Profile */}
      <section className="space-y-4">
        <div>
          <h2 className="h3">Edit profile</h2>
          <p className="text-ui-12 text-tea-text-dim mt-1">Update your name, username, or email.</p>
        </div>
        <form onSubmit={handleEditProfile} className="space-y-3">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className={inputClass}
              placeholder={auth.user?.name || 'your name'}
            />
          </div>
          <div>
            <label className={labelClass}>
              Username <span className="normal-case tracking-normal font-normal text-tea-text-dim">(optional)</span>
            </label>
            <input
              type="text"
              value={editUsername}
              onChange={e => setEditUsername(e.target.value)}
              autoComplete="username"
              pattern="[a-zA-Z0-9_.\-]{3,32}"
              className={inputClass}
              placeholder={auth.user?.username || 'Pick a username'}
            />
            <p className={helperClass}>Leave blank to remove. Sign in with email or username.</p>
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={editEmail}
              onChange={e => setEditEmail(e.target.value)}
              className={inputClass}
              placeholder={auth.user?.email || 'your email'}
            />
          </div>
          <div>
            <label className={labelClass}>
              WhatsApp / Phone <span className="normal-case tracking-normal font-normal text-tea-text-dim">(optional)</span>
            </label>
            <input
              type="tel"
              value={editPhone}
              onChange={e => setEditPhone(e.target.value)}
              className={inputClass}
              placeholder="+886 912 345 678"
              autoComplete="tel"
            />
            <p className={helperClass}>Include country code. Used to pre-fill RSVP forms.</p>
          </div>
          <FormError error={profileError} />
          {profileSaved && <p className="text-ui-13 text-tea-green">Profile updated.</p>}
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-2 py-1 text-tea-text-sec hover:text-tea-text transition-colors text-ui-13"
            >
              Cancel
            </button>
            <PrimarySubmit label="Save changes" loading={profileLoading} />
          </div>
        </form>
      </section>

      <hr className="border-tea-border" />

      {/* Appearance */}
      <section>
        <div className="flex flex-col items-center pb-8">
          <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
            {theme === 'dark' ? (
              <Icons.Moon className="w-7 h-7 text-tea-gold" />
            ) : (
              <Icons.Sun className="w-7 h-7 text-tea-gold" />
            )}
          </div>
          <h2 className="font-display text-3xl text-tea-text">Appearance</h2>
          <p className="font-body italic text-sm text-tea-text-dim mt-1">Choose how Teajia looks on this device</p>
        </div>
        <div>
          <label className={labelClass}>Theme</label>
          <div
            role="radiogroup"
            aria-label="Theme"
            className="grid grid-cols-2 gap-2 p-1 bg-tea-surface border border-tea-border rounded"
          >
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'light'}
              onClick={(e) => { if (theme !== 'light') toggleTheme(e); }}
              className={`tap-target flex items-center justify-center gap-2 py-2.5 rounded text-sm font-sans transition-colors duration-150 ${
                theme === 'light'
                  ? 'cta-solid'
                  : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-gold/5'
              }`}
            >
              <Icons.Sun className="w-4 h-4" />
              Light
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              onClick={(e) => { if (theme !== 'dark') toggleTheme(e); }}
              className={`tap-target flex items-center justify-center gap-2 py-2.5 rounded text-sm font-sans transition-colors duration-150 ${
                theme === 'dark'
                  ? 'cta-solid'
                  : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-gold/5'
              }`}
            >
              <Icons.Moon className="w-4 h-4" />
              Dark
            </button>
          </div>
          <p className="text-ui-11 text-tea-text-dim mt-1.5">Your choice is remembered on this device.</p>
        </div>
      </section>

      <div className="border-t border-tea-border" />

      {/* Change / Set Password */}
      <section className="space-y-4">
        <div>
          <h2 className="h3">{hasPassword ? 'Change password' : 'Set a password'}</h2>
          <p className="text-ui-12 text-tea-text-dim mt-1">
            {hasPassword
              ? 'Update your account password.'
              : 'Your account signs in with Google. Set a password to also sign in with email, useful where Google is unreachable.'}
          </p>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-3">
          {hasPassword && (
            <div>
              <label className={labelClass}>Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          )}
          <div>
            <label className={labelClass}>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className={inputClass}
              placeholder="Min 6 characters"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Confirm new password</label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={e => setConfirmNewPassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <FormError error={passwordError} />
          {passwordSaved && <p className="text-ui-13 text-tea-green">{hasPassword ? 'Password updated.' : 'Password set, you can now sign in with email + password.'}</p>}
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-2 py-1 text-tea-text-sec hover:text-tea-text transition-colors text-ui-13"
            >
              Cancel
            </button>
            <PrimarySubmit label={hasPassword ? 'Update password' : 'Set password'} loading={passwordLoading} />
          </div>
        </form>
      </section>

      <hr className="border-tea-border" />

      {/* Danger Zone */}
      <section className="space-y-4">
        <div>
          <h2 className="h3 text-tea-error">Delete account</h2>
          <p className="text-ui-12 text-tea-text-dim mt-1">This action is permanent and cannot be undone.</p>
        </div>
        <form onSubmit={handleDeleteAccount} className="space-y-3">
          <div className="p-4 bg-tea-error/10 ring-1 ring-inset ring-tea-error/40 rounded-md text-ui-13 text-tea-text-sec">
            Deleting your account will permanently remove your profile, order history, and tasting journal. This cannot be reversed.
          </div>
          <div>
            <label className={labelClass}>Type DELETE to confirm</label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              className={inputClass}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <div>
            <label className={labelClass}>Your password</label>
            <input
              type="password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <FormError error={deleteError} />
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-2 py-1 text-tea-text-sec hover:text-tea-text transition-colors text-ui-13"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-error text-tea-bg text-xs font-semibold hover:bg-tea-error/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleteLoading ? <Loader2 size={13} className="animate-spin" /> : null}
              Permanently delete account
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
