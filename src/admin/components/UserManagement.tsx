import React, { useState, useEffect } from 'react';
import { Users, Shield, ShieldCheck, UserCheck, UserX, Key, Trash2, Copy, Check, Loader2, AlertTriangle, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from './Toast';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  admin_request_status: string;
  admin_requested_at: string | null;
  created_at: string;
}

export const UserManagement: React.FC<{ currentUserRole: string }> = ({ currentUserRole }) => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState<{ token: string; user: { email: string; name: string } } | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const isOwner = currentUserRole === 'owner';

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.users.list();
      setUsers(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const pendingRequests = users.filter(u => u.admin_request_status === 'pending');

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    try {
      await api.users.updateRole(userId, { role: 'admin', admin_request_status: 'approved' });
      showToast('Admin access granted', 'success');
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to approve', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeny = async (userId: string) => {
    setActionLoading(userId);
    try {
      await api.users.updateRole(userId, { admin_request_status: 'denied' });
      showToast('Request denied', 'info');
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to deny', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeAdmin = async (userId: string) => {
    setActionLoading(userId);
    try {
      await api.users.updateRole(userId, { role: 'user', admin_request_status: 'none' });
      showToast('Admin access revoked', 'info');
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId: string) => {
    setActionLoading(userId);
    try {
      await api.users.delete(userId);
      showToast('User deleted', 'info');
      setConfirmDelete(null);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (userId: string) => {
    setActionLoading(userId);
    try {
      const data = await api.users.createResetToken(userId);
      setResetToken(data);
      showToast('Reset link generated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate reset link', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyToken = () => {
    if (!resetToken) return;
    const resetUrl = `${window.location.origin}/reset-password?token=${resetToken.token}`;
    navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <span className="badge-role badge-role-owner"><ShieldCheck className="w-3 h-3" />Owner</span>;
      case 'admin':
        return <span className="badge-role badge-role-admin"><Shield className="w-3 h-3" />Admin</span>;
      default:
        return <span className="badge-role badge-role-user">User</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-tea-text-sec animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-tea-accent mx-auto mb-3" />
        <p className="text-tea-text-sec text-sm">{error}</p>
        <button onClick={fetchUsers} className="mt-3 text-tea-accent text-xs uppercase tracking-wider hover:text-tea-accent/80 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Pending Admin Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-tea-surface border border-tea-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-tea-border pb-4">
            <div className="p-2 bg-tea-gold/10 rounded-lg">
              <Clock className="w-5 h-5 text-tea-gold" />
            </div>
            <div>
              <h3 className="text-lg font-serif text-tea-text">Pending Admin Requests</h3>
              <p className="text-tea-text-sec text-xs mt-0.5">{pendingRequests.length} request{pendingRequests.length > 1 ? 's' : ''} awaiting review</p>
            </div>
          </div>

          <div className="space-y-3">
            {pendingRequests.map(user => (
              <div key={user.id} className="flex items-center gap-4 p-4 bg-tea-bg rounded-lg border border-tea-border">
                <div className="w-10 h-10 rounded-full bg-tea-gold/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-serif text-tea-gold font-medium">
                    {(user.name || user.email)[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-tea-text truncate">{user.name || 'Unnamed'}</p>
                  <p className="text-xs text-tea-text-sec truncate">{user.email}</p>
                  {user.admin_requested_at && (
                    <p className="text-[10px] text-tea-text-dim mt-0.5">
                      Requested {new Date(user.admin_requested_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {isOwner && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(user.id)}
                      disabled={actionLoading === user.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-tea-gold/10 text-tea-gold border border-tea-border rounded-lg text-xs font-medium hover:bg-tea-gold/20 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleDeny(user.id)}
                      disabled={actionLoading === user.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-tea-text-sec border border-tea-border rounded-lg text-xs font-medium hover:bg-tea-surface transition-colors disabled:opacity-50"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Deny
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reset Token Modal */}
      {resetToken && (
        <div className="bg-tea-surface border border-tea-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-serif text-tea-text">Password Reset Link</h4>
            <button onClick={() => { setResetToken(null); setCopied(false); }} className="text-tea-text-sec hover:text-tea-text transition-colors text-xs">
              Dismiss
            </button>
          </div>
          <p className="text-xs text-tea-text-sec">
            Share this link with <strong className="text-tea-text">{resetToken.user.name || resetToken.user.email}</strong> to let them reset their password. It expires in 24 hours.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-tea-bg border border-tea-border rounded-lg p-3 text-tea-text-sec break-all select-all">
              {`${window.location.origin}/reset-password?token=${resetToken.token}`}
            </code>
            <button
              onClick={handleCopyToken}
              className="flex-shrink-0 p-2.5 bg-tea-gold/10 text-tea-gold border border-tea-border rounded-lg hover:bg-tea-gold/20 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* All Users List */}
      <div className="bg-tea-surface border border-tea-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-tea-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-tea-accent/10 rounded-lg">
              <Users className="w-5 h-5 text-tea-accent" />
            </div>
            <div>
              <h3 className="text-lg font-serif text-tea-text">All Users</h3>
              <p className="text-tea-text-sec text-xs mt-0.5">{users.length} registered account{users.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id} className="flex items-center gap-4 p-4 bg-tea-bg rounded-lg border border-tea-border hover:border-tea-text-dim/30 transition-colors">
              <div className="w-10 h-10 rounded-full bg-tea-elevated flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-serif text-tea-text-sec font-medium">
                  {(user.name || user.email)[0].toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-tea-text truncate">{user.name || 'Unnamed'}</p>
                  {roleBadge(user.role)}
                </div>
                <p className="text-xs text-tea-text-sec truncate">{user.email}</p>
                <p className="text-[10px] text-tea-text-dim mt-0.5">
                  Joined {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>

              {isOwner && user.role !== 'owner' && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Toggle admin */}
                  {user.role === 'admin' ? (
                    <button
                      onClick={() => handleRevokeAdmin(user.id)}
                      disabled={actionLoading === user.id}
                      title="Revoke admin"
                      className="p-2 text-tea-text-sec hover:text-tea-accent hover:bg-tea-accent/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApprove(user.id)}
                      disabled={actionLoading === user.id}
                      title="Grant admin"
                      className="p-2 text-tea-text-sec hover:text-tea-gold hover:bg-tea-gold/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                    </button>
                  )}

                  {/* Reset password */}
                  <button
                    onClick={() => handleResetPassword(user.id)}
                    disabled={actionLoading === user.id}
                    title="Generate password reset link"
                    className="p-2 text-tea-text-sec hover:text-tea-gold hover:bg-tea-gold/10 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Key className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  {confirmDelete === user.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={actionLoading === user.id}
                        className="px-2 py-1 text-[10px] uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/30 rounded-md hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === user.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1 text-[10px] uppercase tracking-wider text-tea-text-sec border border-tea-border rounded-md hover:bg-tea-surface transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(user.id)}
                      title="Delete user"
                      className="p-2 text-tea-text-sec hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
