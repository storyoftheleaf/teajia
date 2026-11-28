import { teaCountWords, type KeepTeaser } from '../../lib/keepTeaser';

/**
 * The head of the sign-in and sign-up pages when an invoice sent the person
 * there: who the teas are from and the teas themselves, in place of "Join
 * Teajia" or "Welcome back" (a newcomer from an invoice is not coming back).
 */
export function KeepTeaserHead({ keeping, className = 'mb-8' }: { keeping: KeepTeaser; className?: string }) {
  return (
    <div className={className} data-testid="signup-keeping">
      <p className="label-caps text-tea-gold mb-2">From {keeping.from}</p>
      <h1 className="h2">Keep your <span className="italic text-tea-readgold">{teaCountWords(keeping.teas.length)}</span></h1>
      <ul className="mt-4 border-t border-tea-border">
        {keeping.teas.map(tea => (
          <li key={`${tea.name}|${tea.amount}`} className="flex items-center gap-3 border-b border-tea-border py-2">
            <span className="min-w-0 flex-1 font-body text-ui-15 text-tea-text">{tea.name}</span>
            {tea.amount && <span className="shrink-0 font-body text-ui-13 tabular-nums text-tea-text-sec">{tea.amount}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
