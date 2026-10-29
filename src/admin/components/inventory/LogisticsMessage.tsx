import React, { useId, useState } from 'react';
import { TYPOGRAPHY_CLASSES as T } from '../../../designTokens';
import { TrackingTask } from './TrackingTask';
import { downloadMessage, manifestMessage, type LogisticsManifest } from './logisticsManifest';

/** A reviewed copyable message, never an automatic external send. */
export function LogisticsMessage({ manifest }: { manifest: LogisticsManifest }) {
  const [open, setOpen] = useState(false);
  const draftId = useId();
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  return <>
    <button type="button" className="tap-target purchase-tracking-button" onClick={() => { setDraft(manifestMessage(manifest)); setNotice(''); setOpen(true); }}>Message</button>
    <TrackingTask open={open} onClose={() => setOpen(false)} title="Message to logistics">
      <div className="space-y-3">
        <p className={`${T.body} text-tea-text-sec`}>Chinese + English. Review the details, then copy into your conversation with {manifest.company}. Changes here affect this message only.</p>
        <div className="logistics-actions">
          <button type="button" className="tap-target purchase-tracking-button" onClick={async () => {
            try { await navigator.clipboard.writeText(draft); setNotice('Copied. Paste into your message.'); }
            catch { setNotice('Copy was unavailable. Select the text below or save the text file.'); }
          }}>Copy message</button>
          <button type="button" className="tap-target purchase-tracking-button" onClick={() => downloadMessage(manifest.title, draft)}>Save text</button>
          {notice && <span role="status" className="text-tea-text-sec">{notice}</span>}
        </div>
        <label className={`block ${T.label}`} htmlFor={draftId}>Message</label>
        <textarea id={draftId} rows={24} className={`logistics-message-draft w-full resize-y rounded-md border border-tea-border bg-tea-bg text-tea-text p-3 ${T.body} focus:outline-none focus:border-tea-gold`} value={draft} onChange={event => setDraft(event.target.value)} />
      </div>
    </TrackingTask>
  </>;
}
