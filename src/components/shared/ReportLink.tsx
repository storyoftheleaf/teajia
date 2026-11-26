import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useStepParam } from '../../hooks/useStepParam';
import { anyoneHostsOpen } from '../../lib/anyoneHosts';
import { API_URL, authedFetch } from '../../lib/api';
import { Button } from './Button';
import { Modal } from './Modal';

interface ReportLinkProps {
  targetKind: 'session' | 'person';
  targetId: string;
}

function ReportForm({ targetKind, targetId }: ReportLinkProps) {
  const [reason, setReason] = useState('');
  const send = useMutation({
    mutationFn: () => authedFetch(`${API_URL}/api/session-reports`, {
      method: 'POST',
      body: JSON.stringify({ target_kind: targetKind, target_id: targetId, reason }),
    }),
  });

  if (send.isSuccess) {
    return <p role="status" className={`${TYPOGRAPHY_CLASSES.body} p-4 text-tea-text`}>Thank you. Adrian will look at this.</p>;
  }

  return (
    <form className="space-y-3 p-4" onSubmit={event => { event.preventDefault(); send.mutate(); }}>
      <label className={`${TYPOGRAPHY_CLASSES.bodyLight} block text-tea-text-sec`}>
        What happened? (optional)
        <textarea
          className="input-field mt-1 w-full text-ui-16"
          rows={3}
          maxLength={1000}
          value={reason}
          disabled={send.isPending}
          onChange={event => setReason(event.target.value)}
        />
      </label>
      {send.isError && (
        <p role="alert" className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`}>
          {send.error.message || 'Could not send the report. Try again.'}
        </p>
      )}
      <div className="flex flex-wrap justify-end">
        <Button type="submit" size="sm" className="tap-target" disabled={send.isPending}>
          {send.isPending ? 'Sending' : 'Send'}
        </Button>
      </div>
    </form>
  );
}

function EnabledReportLink(props: ReportLinkProps) {
  const target = `${props.targetKind}:${props.targetId}`;
  const [report, setReport] = useStepParam('report');
  const isOpen = report === target;

  return (
    <div>
      <Button variant="quiet" type="button" size="sm" className="tap-target" aria-haspopup="dialog" onClick={() => setReport(target)}>
        Report
      </Button>
      <Modal isOpen={isOpen} onClose={() => setReport(null)} title="Report" clearBottomNav>
        {isOpen && <ReportForm key={target} {...props} />}
      </Modal>
    </div>
  );
}

export function ReportLink(props: ReportLinkProps) {
  return anyoneHostsOpen() ? <EnabledReportLink {...props} /> : null;
}
