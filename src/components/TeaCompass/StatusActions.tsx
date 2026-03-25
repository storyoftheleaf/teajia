import React from 'react';
import type { CompassStatus } from './types';

interface StatusActionsProps {
  status: CompassStatus;
  onStatusChange: (status: CompassStatus) => void;
}

export const StatusActions: React.FC<StatusActionsProps> = ({ status, onStatusChange }) => {
  const handleWant = () => {
    onStatusChange(status === 'want' ? 'logged' : 'want');
  };

  const handleBuy = () => {
    onStatusChange(status === 'buying' ? 'logged' : 'buying');
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleWant}
        className={`flex-1 ${status === 'want' ? 'pill-active-amber' : 'pill'}`}
        style={{ justifyContent: 'center', paddingTop: '0.625rem', paddingBottom: '0.625rem' }}
      >
        Want
      </button>
      <button
        type="button"
        onClick={handleBuy}
        className={`flex-1 ${status === 'buying' ? 'pill-active' : 'pill'}`}
        style={{ justifyContent: 'center', paddingTop: '0.625rem', paddingBottom: '0.625rem' }}
      >
        Buy
      </button>
    </div>
  );
};

export default StatusActions;
