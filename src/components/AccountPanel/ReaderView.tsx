import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../Icons';
import { Row, SectionHeader } from './primitives';

interface ReaderViewProps {
  onClose: () => void;
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
  onOpenEvents: () => void;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  onClose,
  onOpenSignIn,
  onOpenSignUp,
  onOpenEvents,
}) => {
  const navigate = useNavigate();
  const go = (route: string) => { onClose(); navigate(route); };

  return (
    <div>
      <div className="px-6 pt-8 pb-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-dim mb-3">Teajia</p>
        <h2 className="font-serif text-[28px] font-normal text-tea-text leading-[1.05] tracking-[-0.5px]">
          Gather <em className="text-tea-gold italic">around tea.</em>
        </h2>
        <p className="font-serif italic text-[13px] text-tea-text-sec mt-3 leading-relaxed">
          A home for practitioners, readers, and those just beginning.
        </p>
      </div>

      <div className="px-6 pb-5">
        <button
          onClick={onOpenSignIn}
          className="w-full py-3 bg-tea-gold text-tea-bg text-[11px] uppercase tracking-[0.25em] font-semibold rounded-sm hover:bg-tea-gold/90 transition-colors"
        >
          Sign In
        </button>
        <button
          onClick={onOpenSignUp}
          className="w-full mt-2 py-3 text-[11px] uppercase tracking-[0.2em] text-tea-text-sec hover:text-tea-text transition-colors"
        >
          Create an account
        </button>
      </div>

      <SectionHeader>What's inside</SectionHeader>
      <div>
        <Row
          label="Journal your sessions"
          onClick={onOpenSignUp}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Find teas for your taste"
          onClick={() => go('/compass')}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Attend a session"
          onClick={onOpenEvents}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
      </div>

      <SectionHeader>Explore</SectionHeader>
      <div>
        <Row
          label="The Magazine"
          onClick={() => go('/magazine')}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Shop"
          onClick={() => go('/shop')}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
        <Row
          label="Our Spaces"
          onClick={() => go('/spaces')}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
      </div>

      <SectionHeader>For your space</SectionHeader>
      <div>
        <Row
          label="Tea for hotels, studios & retreats"
          onClick={() => go('/for-your-space')}
          trailing={<Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />}
        />
      </div>

      <div className="pb-[calc(44px+env(safe-area-inset-bottom,0px))] lg:pb-8" />
    </div>
  );
};
