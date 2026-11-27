import { Button } from './Button';

/**
 * A read that failed (a 5xx, a timeout): one plain sentence and a Try again
 * button, the pattern the Tea Table, Favourites and After the sit set (W5).
 * Never the server's words; the failure itself already went to the incident
 * ledger (src/lib/closedPart.ts).
 */
export function LoadFailed({ sentence, onRetry, className = '' }: { sentence: string; onRetry: () => void; className?: string }) {
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-2 ${className}`} data-testid="load-failed">
      <p className="text-ui-14 text-tea-text-sec">{sentence}</p>
      <Button variant="secondary" size="sm" type="button" className="tap-target" onClick={onRetry}>Try again</Button>
    </div>
  );
}
