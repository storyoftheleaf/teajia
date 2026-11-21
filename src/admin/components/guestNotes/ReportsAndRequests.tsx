import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { familyApi } from '../../../lib/familyApi';
import type { FamilyReport, FamilyRestockRequest } from '../../../lib/familyContract';
import { mediaUrl } from '../../../lib/mediaUrl';
import { Chip, SectionHeading, TextAction, dayLabel, errorSentence } from './parts';
import { OFFERED_KEY } from './OfferedPhotographs';
import { FEEDBACK_KEY } from './FeedbackList';

/**
 * What visitors and members have sent the shop: reports on a page, a
 * photograph or a tasting, and "find me more" requests on a sold-out tea.
 * Each section shows only while something is open, so a quiet shop sees
 * neither heading.
 */
const REPORTS_KEY = ['family-reports', 'open'] as const;
const RESTOCK_KEY = ['family-restock-requests', 'open'] as const;

function ReportRow({ report }: { report: FamilyReport }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const settled = () => Promise.all([
    qc.invalidateQueries({ queryKey: ['family-reports'] }),
    qc.invalidateQueries({ queryKey: OFFERED_KEY }),
    qc.invalidateQueries({ queryKey: FEEDBACK_KEY }),
  ]);
  const hide = useMutation({
    mutationFn: () => { setError(null); return familyApi.shop.hide({ target_kind: report.target_kind, target_id: report.target_id }); },
    onSuccess: settled,
    onError: cause => setError(errorSentence(cause, 'Could not hide that.')),
  });
  const dismiss = useMutation({
    mutationFn: () => { setError(null); return familyApi.shop.dismissReport(report.id); },
    onSuccess: settled,
    onError: cause => setError(errorSentence(cause, 'Could not clear that report.')),
  });
  const pending = hide.isPending || dismiss.isPending;
  return (
    <li className="flex gap-3 border-b border-tea-border py-4 last:border-b-0">
      {report.small_url && (
        <img src={mediaUrl(report.small_url)} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-md object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-ui-12 font-medium text-tea-text">{report.label ?? 'Something no longer on Teajia'}</span>
          <span className="text-ui-10 uppercase tracking-[0.14em] text-tea-text-dim">{dayLabel(report.created_at)}</span>
          {report.hidden && <Chip>Hidden</Chip>}
        </div>
        {report.reason && <p className="mt-1 text-ui-13 italic leading-relaxed text-tea-text-sec">{report.reason}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-4">
          {!report.hidden && <TextAction onClick={() => hide.mutate()} disabled={pending}>Hide it</TextAction>}
          <TextAction tone="quiet" onClick={() => dismiss.mutate()} disabled={pending}>Nothing wrong</TextAction>
        </div>
        {error && <p role="alert" className="mt-1 text-ui-11 text-tea-text-sec">{error}</p>}
      </div>
    </li>
  );
}

function RestockRow({ request }: { request: FamilyRestockRequest }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const answer = useMutation({
    mutationFn: () => { setError(null); return familyApi.shop.answerRestock(request.id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family-restock-requests'] }),
    onError: cause => setError(errorSentence(cause, 'Could not mark that answered.')),
  });
  return (
    <li className="border-b border-tea-border py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-ui-12 font-medium text-tea-text">{request.product_name ?? 'A tea'}</span>
        <span className="text-ui-11 text-tea-text-sec">{request.requester_name}</span>
        {request.requester_email && <span className="text-ui-11 text-tea-text-dim">{request.requester_email}</span>}
        <span className="text-ui-10 uppercase tracking-[0.14em] text-tea-text-dim">{dayLabel(request.created_at)}</span>
      </div>
      {request.note && <p className="mt-1 text-ui-13 italic leading-relaxed text-tea-text-sec">{request.note}</p>}
      <div className="mt-1">
        <TextAction onClick={() => answer.mutate()} disabled={answer.isPending}>Answered</TextAction>
      </div>
      {error && <p role="alert" className="mt-1 text-ui-11 text-tea-text-sec">{error}</p>}
    </li>
  );
}

export function ReportsAndRequests() {
  const reports = useQuery({ queryKey: REPORTS_KEY, queryFn: () => familyApi.shop.reports('open') });
  const requests = useQuery({ queryKey: RESTOCK_KEY, queryFn: () => familyApi.shop.restockRequests('open') });
  const reportList = reports.data?.reports ?? [];
  const requestList = requests.data?.requests ?? [];

  return (
    <>
      {reportList.length > 0 && (
        <section aria-label="Reports" className="mt-8">
          <SectionHeading>Reports</SectionHeading>
          <p className="mt-1 text-ui-12 text-tea-text-sec">
            {`${reportList.length} report${reportList.length === 1 ? '' : 's'} waiting. Hiding takes it off every page at once.`}
          </p>
          <ul className="mt-2">{reportList.map(report => <ReportRow key={report.id} report={report} />)}</ul>
        </section>
      )}
      {requestList.length > 0 && (
        <section aria-label="Find me more" className="mt-8">
          <SectionHeading>Find me more</SectionHeading>
          <p className="mt-1 text-ui-12 text-tea-text-sec">
            {`${requestList.length} request${requestList.length === 1 ? '' : 's'} for teas that are gone from the shop.`}
          </p>
          <ul className="mt-2">{requestList.map(request => <RestockRow key={request.id} request={request} />)}</ul>
        </section>
      )}
    </>
  );
}
