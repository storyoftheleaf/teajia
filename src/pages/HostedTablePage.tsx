// /account/host/:id: one of the host's own tables (Launch 2, slice H4). A
// placeholder written with the contract (slice H1); Sol builds the page in H4,
// with ?part=guests|teas|way|after as steps through useStepParam. It shows
// nothing unless Launch 2 is open and the person may host (in Launch 2, approved hosts only).
import React from 'react';
import { useMayHost } from '../hooks/useMayHost';

const HostedTablePage: React.FC = () => {
  const mayHost = useMayHost();
  if (!mayHost) return null;
  return <div className="min-h-screen bg-tea-bg pb-nav" data-host-page="table" />;
};

export default HostedTablePage;
