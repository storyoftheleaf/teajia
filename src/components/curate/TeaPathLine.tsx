import React from 'react';
import { Link } from 'react-router-dom';
import type { TeaPath, TeaPathStepId } from './teaPath';

export type TeaPathActions = Partial<Record<TeaPathStepId, { label: string; run?: () => void; to?: string; hint?: string }>>;

/** The tea's whole way through, with the one next step named and, where it
 *  can be done from here, one tap to it. Reads only; every tap opens a place
 *  that already does the work. */
export function TeaPathLine({ path, actions }: { path: TeaPath; actions: TeaPathActions }) {
  const next = path.next;
  const action = next ? actions[next.id] : undefined;
  return <section aria-label="Where this tea is" className="space-y-2 py-2" data-testid="tea-path">
    <ol className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Steps for this tea">
      {path.steps.map(step => <li key={step.id} aria-current={step === next ? 'step' : undefined}
        className={`text-ui-12 ${step === next ? 'font-medium text-tea-text' : step.done ? 'text-tea-text-sec' : 'text-tea-text-dim'}`}>
        <span aria-hidden="true">{step.done ? '✓ ' : step === next ? '› ' : '· '}</span>
        {step.done ? step.doneLabel : step.todoLabel}
        <span className="sr-only">{step.done ? ', done' : step === next ? ', next' : ', to do'}</span>
      </li>)}
    </ol>
    {path.passed && <p className="text-ui-12 text-tea-text-sec">Rejected. It stays here with its notes.</p>}
    {!next && !path.passed && <p className="text-ui-12 text-tea-text-sec">All the way through: in Stock, costed and written up.</p>}
    {next && <div className="flex min-h-tap flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="text-ui-13 text-tea-text">Next: {next.todoLabel}{action?.hint ? <span className="text-ui-12 text-tea-text-sec"> · {action.hint}</span> : null}</span>
      {action?.to ? <Link to={action.to} className="btn-secondary tap-target">{action.label}</Link>
        : action?.run ? <button type="button" onClick={action.run} className="btn-secondary tap-target">{action.label}</button> : null}
    </div>}
  </section>;
}
