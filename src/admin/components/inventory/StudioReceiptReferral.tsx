import React, { useRef } from 'react';
import { Button } from '../../../components/shared/Button';
import { api } from '../../../lib/api';
import type { LogisticsShipment, LogisticsShipmentLine, StudioReceiptReferral } from '../../../lib/logisticsTypes';
import { logisticsNumber as n, logisticsUnit as u, type LogisticsMutation } from './LogisticsControls';
import { referenceUrl } from './logisticsManifest';
import { LogisticsActionError, useLogisticsAction } from './useLogisticsAction';

export function StudioReferralForm({ shipment, line, busy, save, saved, cancel }: {
  shipment: LogisticsShipment;
  line: LogisticsShipmentLine;
  busy: boolean;
  save: LogisticsMutation;
  saved: () => void;
  cancel: () => void;
}) {
  const { mutate, error } = useLogisticsAction(save);
  const attempt = useRef<{ key: string; fingerprint: string } | null>(null);
  return <form className="logistics-form" onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const observed = String(form.get('observed') ?? '').trim();
    const input = {
      reason: String(form.get('reason') ?? '').trim(),
      source_reference: String(form.get('reference') ?? '').trim(),
      observed_quantity: observed ? Number(observed) : null,
    };
    const fingerprint = JSON.stringify(input);
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { key: crypto.randomUUID(), fingerprint };
    const idempotency_key = attempt.current.key;
    void mutate(async () => {
      await api.logistics.referStudioLine(shipment.id, line.id, { ...input, idempotency_key });
      saved();
    });
  }}>
    <p><strong>{line.product_name}</strong> · {n(line.quantity - line.received_quantity)} {u(line.unit)} due</p>
    <div className="logistics-fields">
      <label>Reason<textarea className="admin-input w-full resize-none" name="reason" rows={2} maxLength={1000} required disabled={busy}/></label>
      <label>Source reference<input name="reference" className="basis-full" placeholder="e.g. package label, photo link" maxLength={1000} required disabled={busy}/></label>
      <label>Observed quantity ({u(line.unit)}, optional)<input name="observed" type="number" min="0" step={line.unit === 'unit' ? '1' : 'any'} disabled={busy}/></label>
    </div>
    <div className="flex flex-wrap justify-between gap-2">
      <Button variant="plain" className="tap-target purchase-tracking-button" type="button" disabled={busy} onClick={cancel}>Cancel</Button>
      <Button variant="plain" className="tap-target purchase-tracking-button" type="submit" disabled={busy}>Save referral</Button>
    </div>
    <LogisticsActionError message={error} recovery="Check the report and use Save referral to try again."/>
  </form>;
}

export function StudioReferralReview({ shipment, line, referral, canResolve, busy, save, onReturnToReceipt }: {
  shipment: LogisticsShipment;
  line: LogisticsShipmentLine;
  referral: StudioReceiptReferral;
  canResolve: boolean;
  busy: boolean;
  save: LogisticsMutation;
  onReturnToReceipt?: () => void;
}) {
  const { mutate, error } = useLogisticsAction(save);
  const sourceUrl = referenceUrl(referral.source_reference);
  return <div className="logistics-form">
    <p><strong>{line.product_name}</strong> · {n(line.quantity - line.received_quantity)} {u(line.unit)} due</p>
    <p className="break-words">{shipment.logistics_company_name} · {shipment.tracking_number || 'Outbound tracking not recorded'}</p>
    <dl className="grid gap-2">
      <div><dt className="text-tea-text-dim">Reason</dt><dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{referral.reason}</dd></div>
      <div><dt className="text-tea-text-dim">Source reference</dt><dd className="[overflow-wrap:anywhere]">{sourceUrl
        ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline">{referral.source_reference}</a>
        : referral.source_reference}</dd></div>
      <div><dt className="text-tea-text-dim">Observed quantity</dt><dd>{referral.observed_quantity == null ? 'Unknown' : `${n(referral.observed_quantity)} ${u(line.unit)}`}</dd></div>
      <div><dt className="text-tea-text-dim">Reported by</dt><dd>{referral.recorded_by_name} · <time dateTime={referral.recorded_at}>{new Date(referral.recorded_at).toLocaleString()}</time></dd></div>
      {referral.resolved_at && <div><dt className="text-tea-text-dim">Resolution</dt><dd className="[overflow-wrap:anywhere]">{referral.resolution}</dd><dd>{referral.resolved_by_name} · <time dateTime={referral.resolved_at}>{new Date(referral.resolved_at).toLocaleString()}</time></dd></div>}
    </dl>
    {canResolve && !referral.resolved_at && <form className="logistics-form" onSubmit={event => {
      event.preventDefault();
      const resolution = String(new FormData(event.currentTarget).get('resolution') || '').trim();
      void mutate(() => api.logistics.resolveStudioReferral(referral.id, resolution));
    }}>
      <label>Resolution<textarea className="admin-input w-full resize-none" name="resolution" rows={2} maxLength={1000} required disabled={busy}/></label>
      <p className="text-tea-text-sec">Resolving the discrepancy leaves stock unchanged.</p>
      <div className="flex justify-end"><Button variant="plain" className="tap-target purchase-tracking-button" type="submit" disabled={busy}>Resolve referral</Button></div>
      <LogisticsActionError message={error} recovery="Check the resolution and try again."/>
    </form>}
    {referral.resolved_at && onReturnToReceipt && (shipment.state === 'in_transit' || shipment.state === 'partially_received') &&
      line.quantity > line.received_quantity && <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-tea-text-sec">Discrepancy resolved. Confirm the remaining stock after counting it.</p>
        <Button variant="plain" className="tap-target purchase-tracking-button" type="button" disabled={busy}
          onClick={onReturnToReceipt}>Return to this receipt</Button>
      </div>}
  </div>;
}
