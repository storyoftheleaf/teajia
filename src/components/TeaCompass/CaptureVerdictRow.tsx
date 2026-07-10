import React from 'react';
import { BookmarkCheck, BookmarkPlus, CircleSlash, Droplets, ShoppingBag } from 'lucide-react';

/** Fixed verdict row for the mobile capture card. Sits just above the
 *  bottom nav (bottom-nav utility) so a decision is always one thumb-reach
 *  away: Tasted / Want / Pass / Bag it, plus the primary Done.
 *
 *  Every action maps to EXISTING semantics:
 *  Tasted opens the tasting overlay, Want/Pass toggle entry.status
 *  ('want' / 'pass', the same fields the Library filters read), Bag it is
 *  the physical-sample flag path (sample cart + isSample), and Done is the
 *  same commit the old footer ran. Buy was removed from capture on purpose;
 *  ordering happens in Runs later.
 */
interface CaptureVerdictRowProps {
  tasted: boolean;
  onTasted: () => void;
  want: boolean;
  onWant: () => void;
  pass: boolean;
  onPass: () => void;
  bagged: boolean;
  onBagIt: () => void;
  doneEnabled: boolean;
  onDone: () => void;
}

const VerdictButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}> = ({ label, icon, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-ui-10 font-medium transition-colors ${
      active ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
    }`}
  >
    {icon}
    {label}
  </button>
);

export const CaptureVerdictRow: React.FC<CaptureVerdictRowProps> = ({
  tasted,
  onTasted,
  want,
  onWant,
  pass,
  onPass,
  bagged,
  onBagIt,
  doneEnabled,
  onDone,
}) => (
  <div className="lg:hidden fixed left-0 right-0 z-20 bottom-nav border-t border-tea-border bg-tea-bg">
    <div className="mx-auto flex max-w-3xl items-stretch px-2 py-1">
      <VerdictButton
        label="Tasted"
        icon={<Droplets size={15} strokeWidth={1.5} />}
        active={tasted}
        onClick={onTasted}
      />
      <VerdictButton
        label={want ? 'Wanted' : 'Want'}
        icon={want ? <BookmarkCheck size={15} strokeWidth={1.5} /> : <BookmarkPlus size={15} strokeWidth={1.5} />}
        active={want}
        onClick={onWant}
      />
      <VerdictButton
        label="Pass"
        icon={<CircleSlash size={15} strokeWidth={1.5} />}
        active={pass}
        onClick={onPass}
      />
      <VerdictButton
        label={bagged ? 'Bagged' : 'Bag it'}
        icon={<ShoppingBag size={15} strokeWidth={1.5} />}
        active={bagged}
        onClick={onBagIt}
      />
      <div className="mx-1 my-2 w-px self-stretch bg-tea-border" aria-hidden />
      <button
        type="button"
        onClick={onDone}
        disabled={!doneEnabled}
        className="flex min-h-[52px] flex-[1.2] items-center justify-center rounded-md text-ui-14 font-display font-semibold tracking-[0.08em] text-tea-gold transition-opacity disabled:opacity-30"
        aria-label="Done, save this entry"
      >
        Done
      </button>
    </div>
  </div>
);

export default CaptureVerdictRow;
