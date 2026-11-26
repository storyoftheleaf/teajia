// /account/host: make a table (Launch 2, slice H3). A placeholder written
// with the contract (slice H1); Sol builds the screen in H3. It shows nothing
// unless Launch 2 is open and the person may host (in Launch 2, approved hosts only).
import React from 'react';
import { useMayHost } from '../hooks/useMayHost';

const HostTablePage: React.FC = () => {
  const mayHost = useMayHost();
  if (!mayHost) return null;
  return <div className="min-h-screen bg-tea-bg pb-nav" data-host-page="new" />;
};

export default HostTablePage;
