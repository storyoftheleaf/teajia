import React from 'react';
import { useAppStore } from '../store';
import { Settings2 } from 'lucide-react';
import { getTokenClaims } from '../../lib/api';
import { UserManagement } from './UserManagement';

export const SettingsView: React.FC = () => {
  const { isDevAdmin } = useAppStore();

  const claims = getTokenClaims();
  const currentUserRole = claims?.role || (isDevAdmin ? 'owner' : 'user');

  return (
    <div className="h-[calc(100vh-64px)] overflow-auto custom-scrollbar bg-tea-bg p-6">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h2 className="text-2xl font-serif text-tea-text flex items-center gap-3">
            <Settings2 className="w-6 h-6 text-tea-gold" />
            System Settings
          </h2>
          <p className="text-tea-text-sec text-sm mt-2">
            Configure application behavior and manage users.
          </p>
        </div>

        {/* User Management Section */}
        <UserManagement currentUserRole={currentUserRole} />

      </div>
    </div>
  );
};
