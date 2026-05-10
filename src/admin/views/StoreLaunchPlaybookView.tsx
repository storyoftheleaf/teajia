import React, { useEffect, useState } from 'react';
import { StoreLaunchPlaybook } from '../../components/storeLaunch/StoreLaunchPlaybook';
import { api } from '../../lib/api';
import type { Account } from '../../types';
import { useAppStore } from '../store';

export const StoreLaunchPlaybookView: React.FC = () => {
  const { activeAccountId, setActiveAccount } = useAppStore();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    if (!activeAccountId) return;
    let cancelled = false;
    api.accounts.get(activeAccountId)
      .then((data) => {
        if (cancelled) return;
        setAccount(data);
        setActiveAccount(data);
      })
      .catch(() => {
        if (!cancelled) setAccount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeAccountId, setActiveAccount]);

  const storefrontUrl = account?.slug ? `${window.location.origin}/store/${account.slug}` : null;

  return <StoreLaunchPlaybook mode="admin" account={account} storefrontUrl={storefrontUrl} />;
};

export default StoreLaunchPlaybookView;
