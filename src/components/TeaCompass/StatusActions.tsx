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

  const handlePass = () => {
    onStatusChange(status === 'passed' ? 'logged' : 'passed');
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleWant}
        className={status === 'want' ? 'pill-active-amber' : 'pill'}
        style={{ flex: 1, justifyContent: 'center', paddingTop: '0.625rem', paddingBottom: '0.625rem' }}
      >
        Want
      </button>
      <button
        type="button"
        onClick={handleBuy}
        className={status === 'buying' ? 'pill-active' : 'pill'}
        style={{ flex: 1, justifyContent: 'center', paddingTop: '0.625rem', paddingBottom: '0.625rem' }}
      >
        Buy
      </button>
      <button
        type="button"
        onClick={handlePass}
        className="text-xs text-tea-text-dim hover:text-tea-text-sec transition-colors px-2 py-1"
      >
        {status === 'passed' ? 'Passed' : 'Pass'}
      </button>
    </div>
  );
};

export default StatusActions;
