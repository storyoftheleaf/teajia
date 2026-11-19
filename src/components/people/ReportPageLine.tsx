import { useState } from 'react';
import { familyApi } from '../../lib/familyApi';
import { Button } from '../shared/Button';
import { Dek } from './immersive';

/**
 * The one report line at the foot of a family page, for anyone, signed in or
 * not. One tap files it with the shop; the owner decides what to do. No form,
 * no reason box, and nothing about the reporter is asked.
 */
export function ReportPageLine({ contributorId }: { contributorId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const send = async () => {
    setState('sending');
    try {
      await familyApi.report({ target_kind: 'page', target_id: contributorId });
      setState('sent');
    } catch {
      setState('failed');
    }
  };
  if (state === 'sent') return <Dek className="mt-4 text-ui-13" >Thank you. Teajia has been told.</Dek>;
  return (
    <p className="mt-4 font-body text-ui-13 text-tea-text-dim" data-testid="report-page">
      {state === 'failed' && <span role="alert" className="mr-2 italic text-tea-text-sec">That did not go through.</span>}
      <Button variant="plain" type="button" className="tap-target text-tea-text-dim underline decoration-tea-border underline-offset-4 hover:text-tea-text" disabled={state === 'sending'} onClick={send}>Report this page</Button>
    </p>
  );
}
