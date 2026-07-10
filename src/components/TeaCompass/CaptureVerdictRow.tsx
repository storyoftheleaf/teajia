import React from 'react';
import { BookmarkCheck, BookmarkPlus, CircleSlash, Droplets, ShoppingBag } from 'lucide-react';

/** Inline verdict block for the mobile capture card. Sits at the END of the
 *  card content (part of the scroll), NOT as a fixed bar stacked over the app
 *  nav — the nav is the only bar at the bottom of the screen.
 *
 *  A quiet segmented row of four quick marks, then the commit:
 *  Tasted opens the tasting overlay, Want/Pass toggle entry.status
 *  ('want' / 'pass', the same fields the Library filters read), Bag it is the
 *  physical-sample flag path (sample cart + isSample), and Done runs the same
 *  commit as before. Buy was removed from capture on purpose; ordering happens
 *  in Runs later.
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
    className={`flex min-h-[46px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md font-sans text-ui-10 font-medium transition-colors ${
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
  <div className="lg:hidden pt-1 space-y-3">
    {/* Four quiet marks on the bare page — a decision, not a slab. */}
    <div className="flex items-stretch gap-1">
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
    </div>

    {/* Commit — the one primary action, and now the ONLY warm fill on the
        screen since every other gold moment above has been quieted. */}
    <button
      type="button"
      onClick={onDone}
      disabled={!doneEnabled}
      className="w-full py-2.5 rounded-md bg-tea-gold text-tea-bg font-sans font-semibold tracking-[0.06em] text-ui-14 shadow-lg shadow-tea-gold/10 transition-colors hover:bg-tea-gold/90 active:bg-tea-gold/80 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
      aria-label="Done, save this entry"
    >
      Done
    </button>
  </div>
);

export default CaptureVerdictRow;
