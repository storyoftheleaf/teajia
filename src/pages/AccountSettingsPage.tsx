import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api, setToken } from '../lib/api';
import { Icons } from '../components/Icons';

const inputClass = "w-full bg-tea-surface border border-tea-border p-3.5 text-tea-text rounded outline-none focus:border-tea-gold focus:ring-0 transition-colors duration-150 placeholder-tea-text-dim font-sans text-sm";
const inputStyle = { boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' };
const labelClass = "block text-ui-10 font-bold uppercase tracking-display text-tea-text-sec mb-2";

function FormError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-red-600 text-sm">
      <Icons.AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{error}</span>
    </div>
  );
}

function SubmitButton({ label, loading }: { label: string; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-2.5 bg-tea-gold text-tea-bg font-sans font-medium rounded hover:bg-tea-gold-lt transition-colors duration-150 disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
    >
      {loading ? <div className="w-4 h-4 border-2 border-tea-border border-t-tea-text-sec rounded-full animate-spin" /> : label}
    </button>
  );
}

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const auth = useAuth();

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
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err: unknown) {
      setPasswordError((err as Error)?.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="max-w-sm mx-auto pt-12 text-center">
        <p className="text-tea-text-sec text-sm mb-4">You need to be signed in to access account settings.</p>
        <button onClick={() => navigate('/signin')} className="text-sm text-tea-gold hover:underline">Sign In</button>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto pt-12 pb-12 space-y-12">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-xs uppercase tracking-caps">Back</span>
      </button>

      {/* Edit Profile */}
      <section>
        <div className="flex flex-col items-center pb-8">
          <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
            <Icons.User className="w-7 h-7 text-tea-gold" />
          </div>
          <h1 className="font-display text-3xl text-tea-text">Edit Profile</h1>
          <p className="font-body italic text-sm text-tea-text-dim mt-1">Update your name, username, or email</p>
        </div>
        <form onSubmit={handleEditProfile} className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className={inputClass}
              style={inputStyle}
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
              style={inputStyle}
              placeholder={auth.user?.username || 'Pick a username'}
            />
            <p className="text-ui-11 text-tea-text/40 mt-1.5">Leave blank to remove. Sign in with email or username.</p>
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={editEmail}
              onChange={e => setEditEmail(e.target.value)}
              className={inputClass}
              style={inputStyle}
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
              style={inputStyle}
              placeholder="+886 912 345 678"
              autoComplete="tel"
            />
            <p className="text-ui-11 text-tea-text/40 mt-1.5">Include country code. Used to pre-fill RSVP forms.</p>
          </div>
          <FormError error={profileError} />
          {profileSaved && <p className="text-sm text-green-600">Profile updated.</p>}
          <SubmitButton label="Save Changes" loading={profileLoading} />
        </form>
      </section>

      <div className="border-t border-tea-border" />

      {/* Change Password */}
      <section>
        <div className="flex flex-col items-center pb-8">
          <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
            <Icons.Lock className="w-7 h-7 text-tea-gold" />
          </div>
          <h2 className="font-display text-3xl text-tea-text">Change Password</h2>
          <p className="font-body italic text-sm text-tea-text-dim mt-1">Update your account password</p>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className={labelClass}>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className={inputClass}
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label className={labelClass}>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className={inputClass}
              style={inputStyle}
              placeholder="Min 6 characters"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Confirm New Password</label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={e => setConfirmNewPassword(e.target.value)}
              className={inputClass}
              style={inputStyle}
              required
            />
          </div>
          <FormError error={passwordError} />
          {passwordSaved && <p className="text-sm text-green-600">Password updated.</p>}
          <SubmitButton label="Update Password" loading={passwordLoading} />
        </form>
      </section>

      <div className="border-t border-tea-border" />

      {/* Danger Zone */}
      <section>
        <div className="flex flex-col items-center pb-8">
          <div className="w-16 h-16 rounded-full bg-red-500/8 flex items-center justify-center mb-4">
            <Icons.AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="font-display text-3xl text-tea-text">Delete Account</h2>
          <p className="font-body italic text-sm text-tea-text-dim mt-1">This action is permanent and cannot be undone</p>
        </div>
        <form onSubmit={handleDeleteAccount} className="space-y-4">
          <div className="p-4 bg-red-500/5 border border-red-500/15 text-sm text-tea-text-sec space-y-1">
            <p>Deleting your account will permanently remove your profile, order history, and tasting journal. This cannot be reversed.</p>
          </div>
          <div>
            <label className={labelClass}>Type DELETE to confirm</label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              className={inputClass}
              style={inputStyle}
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
              style={inputStyle}
              required
            />
          </div>
          <FormError error={deleteError} />
          <button
            type="submit"
            disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
            className="w-full py-2.5 bg-red-600 text-tea-bg font-sans font-medium rounded hover:bg-red-700 transition-colors duration-150 disabled:opacity-40 flex justify-center items-center gap-2 mt-2"
          >
            {deleteLoading ? <div className="w-4 h-4 border-2 border-tea-bg/30 border-t-tea-bg rounded-full animate-spin" /> : 'Permanently Delete Account'}
          </button>
        </form>
      </section>
    </div>
  );
}
