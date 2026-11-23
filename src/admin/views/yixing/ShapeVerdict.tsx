import { Button } from '../../../components/shared/Button';
import { useRef, useState } from 'react';
import { TYPOGRAPHY_CLASSES as TYPE } from '../../../designTokens';
import { shapeEvidenceName, type ChangeShape, type Decision, type Pot, type ShapeAction } from './data';
import type { ShapeExemplar, ShapeForm } from './shapeData';

export function ShapeVerdict({ pot, form, example, decision, onShape, onReload }: {
  pot: Pot; form: ShapeForm; example: ShapeExemplar; decision: Decision;
  onShape: ChangeShape; onReload: () => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const inFlight = useRef(false);
  const confirmed = decision.confirmedShape?.formId === form.id ? decision.confirmedShape : undefined;
  const rejected = decision.rejectedShapes && Object.prototype.hasOwnProperty.call(decision.rejectedShapes, form.id)
    ? decision.rejectedShapes[form.id] : undefined;
  const pinned = confirmed ?? rejected;

  async function choose(action: ShapeAction) {
    if (inFlight.current || conflict) return;
    inFlight.current = true;
    setSaving(true);
    setMessage('');
    try {
      await onShape(pot.id, {
        formId: form.id, asset: action === 'withdraw' && pinned ? pinned.asset : example.asset,
        action, revision: decision.revision,
      });
      setMessage(action === 'confirm' ? 'Shape confirmed.' : action === 'reject' ? 'Shape rejected.'
        : confirmed ? 'Confirmation withdrawn.' : 'Rejection removed.');
    } catch (error) {
      setConflict(error instanceof Error && 'status' in error && error.status === 409);
      setMessage(error instanceof Error ? error.message : 'Unable to save the shape decision.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return <section aria-label="Review decision" className="mt-3 min-w-0 border-t border-tea-border pt-3">
    <h2 className={TYPE.h2}>Review decision</h2>
    {pinned ? <p className={TYPE.body + ' mt-1 break-words'}>
      <strong>{confirmed ? 'Confirmed shape' : 'Rejected shape'}</strong> · {pinned.title}
    </p> : decision.confirmedShape ? <p className={TYPE.body + ' mt-1 break-words'}>
      Current confirmation · {shapeEvidenceName(decision.confirmedShape)}
    </p> : null}
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {(!confirmed || confirmed.asset !== example.asset) && <Button variant="primary" type="button" disabled={saving || conflict}
        onClick={() => void choose('confirm')}>{confirmed ? 'Use this reference' : 'Confirm shape'}</Button>}
      {!rejected && <Button variant="secondary" type="button" disabled={saving || conflict}
        onClick={() => void choose('reject')}>Reject shape</Button>}
      {pinned && <Button variant="quiet" type="button" disabled={saving || conflict}
        onClick={() => void choose('withdraw')}>{confirmed ? 'Withdraw confirmation' : 'Undo rejection'}</Button>}
      {conflict && <Button variant="secondary" type="button" onClick={async () => {
        try { await onReload(); } catch { setMessage('Reload failed. Try again.'); }
      }}>Reload saved choices</Button>}
    </div>
    {(saving || message) && <p className={TYPE.body + ' mt-2'} role="status">{saving ? 'Saving…' : message}</p>}
  </section>;
}
