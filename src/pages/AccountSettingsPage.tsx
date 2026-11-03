import { authPagePath } from '../lib/authNavigation';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api, setToken } from '../lib/api';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { Icons } from '../components/Icons';
import { useTheme } from '../context/ThemeContext';
import { TYPOGRAPHY_CLASSES } from '../designTokens';

const inputClass = "w-full bg-tea-surface border border-tea-border rounded-md px-3 min-h-11 py-2 text-ui-16 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors";
const labelClass = "block label-caps text-tea-text-sec mb-1.5";
const helperClass = "text-ui-12 text-tea-text-dim mt-1";

function FormError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 p-3 bg-tea-error/10 ring-1 ring-inset ring-tea-error/40 rounded-md text-tea-error text-ui-13">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{error}</span>
    </div>
  );
}

function PrimarySubmit({ label, loading, disabled = false }: { label: string; loading: boolean; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="tap-target inline-flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : null}
      {label}
    </button>
  );
}

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  // The public Tea Master identity is one link inside, shown only to someone
  // who has one or may start one; for anyone else that page would refuse them.
  const profileQuery = useQuery({ queryKey: ['profile', 'self'], queryFn: api.profile.getSelf, enabled: auth.isAuthenticated });
  const hasPublicIdentity = Boolean(profileQuery.data?.profile || profileQuery.data?.can_create);
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
  const securityQuery = useQuery({
    queryKey: ['account', 'sign-in-methods', auth.user?.email],
    queryFn: api.auth.me,
    enabled: auth.isAuthenticated,
    retry: false,
  });
  const [passwordWasSet, setPasswordWasSet] = useState(false);
  const hasPassword = passwordWasSet ? true : typeof securityQuery.data?.has_password === 'boolean' ? securityQuery.data.has_password : null;
  const unknownStatus = securityQuery.isPending ? 'Checking…' : 'Status unavailable';
  const googleConnected = typeof securityQuery.data?.google_connected === 'boolean' ? securityQuery.data.google_connected : null;
  const emailVerified = typeof securityQuery.data?.email_verified === 'boolean' ? securityQuery.data.email_verified : null;
  const touchedFields = useRef(new Set<string>());
  const [profileBaseline, setProfileBaseline] = useState({
    name: auth.user?.name || '', email: auth.user?.email || '', username: auth.user?.username || '', phone: auth.user?.phone || '',
  });
  useEffect(() => {
    const next = { name: auth.user?.name || '', email: auth.user?.email || '', username: auth.user?.username || '', phone: auth.user?.phone || '' };
    if (!touchedFields.current.has('name')) setEditName(next.name);
    if (!touchedFields.current.has('email')) setEditEmail(next.email);
    if (!touchedFields.current.has('username')) setEditUsername(next.username);
    if (!touchedFields.current.has('phone')) setEditPhone(next.phone);
    setProfileBaseline(next);
  }, [auth.user?.name, auth.user?.email, auth.user?.username, auth.user?.phone]);
  const edited = (field: string) => { touchedFields.current.add(field); setProfileSaved(false); };
  const profileChanged = editName !== profileBaseline.name || editEmail !== profileBaseline.email || editUsername.trim() !== profileBaseline.username || editPhone.trim() !== profileBaseline.phone;

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
      if (editName && editName !== profileBaseline.name) updates.name = editName;
      if (editEmail && editEmail !== profileBaseline.email) updates.email = editEmail;
      const trimmedUsername = editUsername.trim();
      const currentUsername = profileBaseline.username;
      if (trimmedUsername !== currentUsername) {
        updates.username = trimmedUsername === '' ? null : trimmedUsername;
      }
      const trimmedPhone = editPhone.trim();
      if (trimmedPhone !== profileBaseline.phone) updates.phone = trimmedPhone;
      if (Object.keys(updates).length === 0) {
        return;
      }
      const result = await api.auth.updateProfile(updates);
      if (result.token) setToken(result.token);
      setProfileBaseline({ name: editName, email: editEmail, username: trimmedUsername, phone: trimmedPhone });
      touchedFields.current.clear();
      await auth.checkSession();
      setProfileSaved(true);

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
      setPasswordWasSet(true);
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
            onClick={() => navigate(authPagePath('signin', '/account/settings'))}
            className="tap-target inline-flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-md cta-solid text-xs font-semibold transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 pt-4 pb-nav-gap">
      <button onClick={() => navigate(-1)} className="tap-target inline-flex min-h-11 items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors" aria-label="Back">
        <ArrowLeft size={14} /> Back
      </button>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className={TYPOGRAPHY_CLASSES.h2}>Account settings</h1>
          <p className="mt-1 text-ui-13 text-tea-text-dim">Your details, sign-in methods and preferences.</p>
        </div>
        {hasPublicIdentity && <a href="/account/profile" className="tap-target inline-flex min-h-11 items-center text-ui-13 text-tea-gold hover:text-tea-gold-lt">Public profile and payment ↗</a>}
      </header>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-labelledby="profile-heading" className="min-w-0 border border-tea-border rounded-md bg-tea-surface p-4 md:p-5">
          <h2 id="profile-heading" className={TYPOGRAPHY_CLASSES.h3}>Profile</h2>
          <form onSubmit={handleEditProfile} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 xl:grid-cols-2">
              <div>
                <label htmlFor="profile-name" className={labelClass}>Name</label>
                <input id="profile-name" disabled={profileLoading} type="text" autoComplete="name" value={editName} onChange={e => { edited('name'); setEditName(e.target.value); }} className={inputClass} required />
              </div>
              <div>
                <label htmlFor="profile-username" className={labelClass}>Username <span className="normal-case tracking-normal">(optional)</span></label>
                <input id="profile-username" disabled={profileLoading} type="text" autoComplete="username" pattern="[a-zA-Z0-9_.\-]{3,32}" value={editUsername} onChange={e => { edited('username'); setEditUsername(e.target.value); }} className={inputClass} aria-describedby="username-help" />
              </div>
            </div>
            <p id="username-help" className={helperClass}>Sign in with email or username.</p>
            <div>
              <label htmlFor="profile-email" className={labelClass}>Email</label>
              <input id="profile-email" disabled={profileLoading} type="email" autoComplete="email" value={editEmail} onChange={e => { edited('email'); setEditEmail(e.target.value); }} className={inputClass} required />
            </div>
            <div>
              <label htmlFor="profile-phone" className={labelClass}>WhatsApp / Phone <span className="normal-case tracking-normal">(optional)</span></label>
              <input id="profile-phone" disabled={profileLoading} type="tel" autoComplete="tel" placeholder="+886 912 345 678" value={editPhone} onChange={e => { edited('phone'); setEditPhone(e.target.value); }} className={inputClass} aria-describedby="phone-help" />
              <p id="phone-help" className={helperClass}>Include your country code for reservations.</p>
            </div>
            <FormError error={profileError} />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p role="status" className="text-ui-12 text-tea-text-sec">{profileLoading ? 'Saving…' : profileSaved ? 'Changes saved.' : profileChanged ? 'Unsaved changes' : ''}</p>
              <PrimarySubmit label="Save changes" loading={profileLoading} disabled={!profileChanged} />
            </div>
          </form>
        </section>

        <div className="min-w-0 space-y-5">
          <section aria-labelledby="security-heading" className="min-w-0 border border-tea-border rounded-md bg-tea-surface p-4 md:p-5">
            <h2 id="security-heading" className={TYPOGRAPHY_CLASSES.h3}>Sign-in &amp; security</h2>
            <dl className="mt-3 divide-y divide-tea-border text-ui-13">
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5"><dt className="text-tea-text-sec">Email</dt><dd className="text-tea-text">{emailVerified === null ? unknownStatus : emailVerified ? 'Verified' : 'Not verified'}</dd></div>
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5"><dt className="text-tea-text-sec">Google</dt><dd className="text-tea-text">{googleConnected === null ? unknownStatus : googleConnected ? 'Connected' : 'Not connected'}</dd></div>
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5"><dt className="text-tea-text-sec">Password</dt><dd className="text-tea-text">{hasPassword === null ? unknownStatus : hasPassword ? 'Set' : 'Not set'}</dd></div>
            </dl>
            {securityQuery.isPending && <p role="status" className="mt-2 text-ui-12 text-tea-text-dim">Checking sign-in methods…</p>}
            {securityQuery.isError && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-ui-12 text-tea-text-sec"><span>Could not check sign-in methods.</span><button type="button" className="tap-target min-h-11 text-tea-gold" onClick={() => void securityQuery.refetch()}>Try again</button></div>}
            <details className="mt-2 border-t border-tea-border">
              <summary className="min-h-11 cursor-pointer py-3 text-ui-13 text-tea-text hover:text-tea-gold focus-visible:outline-tea-gold">{hasPassword === false ? 'Set a password' : 'Change password'}</summary>
              <form onSubmit={handleChangePassword} className="space-y-3 pb-1">
                <p className="text-ui-12 text-tea-text-dim">{hasPassword === false ? 'Add a password to sign in with your email as well.' : 'Use at least 6 characters for your new password.'}</p>
                {hasPassword !== false && <div><label htmlFor="current-password" className={labelClass}>Current password</label><input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputClass} required /></div>}
                <div><label htmlFor="new-password" className={labelClass}>New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} required /></div>
                <div><label htmlFor="confirm-password" className={labelClass}>Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} className={inputClass} required /></div>
                <FormError error={passwordError} />
                <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-ui-12 text-tea-text-sec">{passwordSaved ? 'Password saved.' : hasPassword === null ? 'Check your sign-in methods before continuing.' : ''}</p><PrimarySubmit label={hasPassword === false ? 'Set password' : 'Update password'} loading={passwordLoading} disabled={hasPassword === null} /></div>
              </form>
            </details>
          </section>

          <section aria-labelledby="appearance-heading" className="border border-tea-border rounded-md bg-tea-surface p-4 md:p-5">
            <h2 id="appearance-heading" className={TYPOGRAPHY_CLASSES.h3}>Appearance</h2>
            <div role="radiogroup" aria-label="Theme" className="mt-3 grid grid-cols-2 gap-2 rounded-md border border-tea-border p-1">
              {(['light', 'dark'] as const).map(option => <button key={option} type="button" role="radio" aria-checked={theme === option} onClick={e => { if (theme !== option) toggleTheme(e); }} className={`min-h-11 flex items-center justify-center gap-2 rounded text-ui-13 transition-colors ${theme === option ? 'cta-solid' : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub'}`}>
                {option === 'light' ? <Icons.Sun className="h-4 w-4" /> : <Icons.Moon className="h-4 w-4" />}{option === 'light' ? 'Light' : 'Dark'}
              </button>)}
            </div>
            <p className="mt-2 text-ui-12 text-tea-text-dim">Remembered on this device.</p>
          </section>
        </div>
      </div>

      <details className="mt-5 border-t border-tea-border">
        <summary className="min-h-11 cursor-pointer py-3 text-ui-13 text-tea-text-dim hover:text-tea-text focus-visible:outline-tea-gold">Delete account</summary>
        <form onSubmit={handleDeleteAccount} className="max-w-md space-y-3 pb-4">
          <p className="text-ui-13 text-tea-text-sec">Permanently remove your profile, order history and tasting journal. This cannot be undone.</p>
          {hasPassword === false && <p className="text-ui-12 text-tea-text-sec">A password is required to delete your account. Set one in Sign-in &amp; security first.</p>}
          <div><label htmlFor="delete-confirm" className={labelClass}>Type DELETE to confirm</label><input id="delete-confirm" type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} className={inputClass} autoComplete="off" /></div>
          <div><label htmlFor="delete-password" className={labelClass}>Your password</label><input id="delete-password" type="password" autoComplete="current-password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} className={inputClass} required /></div>
          <FormError error={deleteError} />
          <button type="submit" disabled={deleteLoading || deleteConfirmText !== 'DELETE' || hasPassword !== true} className="min-h-11 inline-flex items-center gap-2 rounded-md border border-tea-border px-4 py-2 text-ui-13 text-tea-text hover:bg-tea-accent-sub disabled:opacity-40 disabled:cursor-not-allowed">{deleteLoading && <Loader2 size={14} className="animate-spin" />}Permanently delete account</button>
        </form>
      </details>
    </div>
  );
}
