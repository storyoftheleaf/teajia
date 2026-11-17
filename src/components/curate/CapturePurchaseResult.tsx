import { TeaCard, TeaCardMeta, TeaCardTitle } from '../tea/TeaCard';
import { CapturePhotoImage } from './CapturePhotoImage';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';
import { Link } from 'react-router-dom';
import type { CurateReceiptProposal } from '../../types';
import { sharedTeaRecordHref } from '../../lib/sharedTeaRecord';

const primary = 'tap-target min-h-11 rounded-md cta-solid px-3 text-ui-12 font-semibold';

function receiptAmount(receipt: CurateReceiptProposal) {
  return `${receipt.quantity.toLocaleString()} ${receipt.unit === 'g' ? 'g' : receipt.quantity === 1 ? 'piece' : 'pieces'}`;
}

export function CapturePurchaseResult({ entryId, teaName, teaType, supplierName, photos, focusSample, receipt, sampleReviewOpen, onOpenSampleReview, recordedSample, purchaseDraft, busy, error, onReview, onRetry, onReviewOrder }: {
  entryId: string;
  teaName: string;
  teaType?: string;
  supplierName?: string;
  photos?: string[];
  focusSample: boolean;
  receipt: CurateReceiptProposal | null;
  sampleReviewOpen: boolean;
  onOpenSampleReview: (receiptId: string) => void;
  recordedSample: CurateReceiptProposal | null;
  purchaseDraft: boolean;
  busy: boolean;
  error: string;
  onReview: (action: 'accept' | 'reject') => void;
  onRetry: () => void;
  onReviewOrder?: () => void;
}) {
  const sample = receipt?.purpose === 'sample';
  if (focusSample && receipt) {
    if (!sampleReviewOpen) return <div className="flex flex-wrap items-center justify-between gap-2 text-ui-12 text-tea-text-sec">
      <span>Pending private sample · {receiptAmount(receipt)}</span>
      <Button type="button" size="sm" onClick={() => onOpenSampleReview(receipt.id)}>Review sample receipt</Button>
    </div>;
    const evidencePhotos = (photos ?? []).filter(Boolean);
    const cancel = () => { if (!busy) onReview('reject'); };
    return <Modal isOpen onClose={cancel} title="Confirm sample receipt" initialFocus="container">
      <div className="px-4 pb-4 space-y-3">
        <TeaCard teaType={teaType} title={<TeaCardTitle>{teaName.trim() || 'Unnamed tea'}</TeaCardTitle>}
          meta={<TeaCardMeta primary={supplierName || 'No supplier recorded'}
            trailing={<><strong className="text-tea-text">{receiptAmount(receipt)}</strong> · Private sample</>} />} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={cancel}>Cancel</Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => onReview('accept')}>{busy ? 'Saving…' : `Record ${receiptAmount(receipt)}`}</Button>
        </div>
        <p className="text-ui-12 text-tea-text-sec">Confirm only what you received. This sample stays private.</p>
        {error && <p role="alert" className="text-ui-12 text-tea-text-sec">{error}</p>}
        {evidencePhotos.length > 0 && <div className="flex items-center gap-2 border-t border-tea-border pt-2 text-ui-12 text-tea-text-sec">
          <CapturePhotoImage src={evidencePhotos[0]} alt="" className="size-9 shrink-0 rounded object-cover" />
          <span>{evidencePhotos.length === 1 ? '1 photo on this tea' : `${evidencePhotos.length} photos on this tea`}</span>
        </div>}
      </div>
    </Modal>;
  }
  return <div className="space-y-2 text-ui-12 text-tea-text-sec">
    {recordedSample ? <div className="flex flex-wrap items-center justify-between gap-x-3" role="status">
      <strong className="text-tea-text">Private sample received · {receiptAmount(recordedSample)}</strong>
      <Link className={`${primary} inline-flex items-center`} to={sharedTeaRecordHref(entryId)}>Open tea in Library</Link>
    </div> : receipt ? <>
      <p><strong className="text-tea-text">{receiptAmount(receipt)}</strong> · {sample ? 'Private sample' : receipt.purpose === 'working' ? 'Shop stock' : 'Personal stock'} · {receipt.acquisition_kind === 'free_sample' ? 'Free sample' : receipt.acquisition_kind}</p>
      <p>{sample ? 'Confirm only what you received. This sample stays private.' : 'Inventory changes only after you accept this receipt.'}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" disabled={busy} onClick={() => onReview('reject')} className="tap-target min-h-11 text-tea-text-sec hover:text-tea-text">Reject</button>
        <button type="button" disabled={busy} onClick={() => onReview('accept')} className={primary}>
          {busy ? 'Saving…' : sample ? `Record ${receiptAmount(receipt)} as received` : 'Accept into Inventory'}
        </button>
      </div>
    </> : purchaseDraft && !error && <div className="flex flex-wrap items-center justify-between gap-x-3" role="status">
      <strong className="text-tea-text">Added to supplier order draft</strong>
      {onReviewOrder && <button type="button" onClick={onReviewOrder} className={primary}>Review supplier order</button>}
    </div>}
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2">
      <span>{error}</span>
      {!receipt && <button type="button" disabled={busy} onClick={onRetry} className="tap-target min-h-11 text-tea-text-sec underline">{purchaseDraft ? 'Retry saving draft' : 'Retry receipt'}</button>}
    </div>}
  </div>;
}
