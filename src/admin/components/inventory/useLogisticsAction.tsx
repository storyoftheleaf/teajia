import React, { useState } from 'react';
import type { LogisticsMutation } from './LogisticsControls';

/** Keep recovery beside the action without discarding its form or retry intent. */
export function useLogisticsAction(save: LogisticsMutation) {
  const [error, setError] = useState('');
  const mutate: LogisticsMutation = async action => {
    setError('');
    await save(action, setError);
  };
  return { mutate, error };
}

export function LogisticsActionError({ message, recovery }: { message: string; recovery: string }) {
  return message ? <p role="alert" className="logistics-action-error logistics-field-note">{message} <span className="text-tea-text-sec">{recovery}</span></p> : null;
}
