import React from 'react';
import { Icons } from '../Icons';
import { VISUAL_GUIDES } from '../../data/visualGuides';

const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-ink/5 dark:hover:bg-white/5 px-2 -ml-2';

const ICON_MAP: Record<string, React.ReactNode> = {
  Book: <Icons.Book className="w-6 h-6" />,
  Location: <Icons.Location className="w-6 h-6" />,
  Grid: <Icons.Grid className="w-6 h-6" />,
};

const TYPE_COLORS: Record<string, string> = {
  guide: 'bg-tea-green/10 dark:bg-green-500/20 text-tea-green dark:text-green-300 border border-tea-green/30 dark:border-green-400/40',
  reference: 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-400/30 dark:border-orange-400/40',
};

interface VisualGuidesProps {
  onBack: () => void;
}

export const VisualGuides: React.FC<VisualGuidesProps> = ({ onBack }) => {
  const guides = VISUAL_GUIDES.filter(g => g.type === 'guide');
  const reference = VISUAL_GUIDES.filter(g => g.type === 'reference');

  return (
    <div className="w-full">
      <button onClick={onBack} className={BACK_BTN}>
        <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-ink/70 dark:text-tea-paper/70" />
        <span className="font-serif text-sm text-tea-ink/70 dark:text-tea-paper/70">Learn</span>
      </button>

      <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal mb-3 text-tea-ink dark:text-tea-paper">
        Visual Guides
      </h1>
      <p className="font-serif text-base text-tea-ink/60 dark:text-tea-paper/60 mb-10">
        Infographics and printables
      </p>

      {/* Brewing Guides */}
      <section className="mb-12">
        <h2 className="font-serif text-lg font-medium text-tea-ink dark:text-tea-paper mb-4">
          Brewing Guides
        </h2>
        <div className="flex flex-col divide-y divide-tea-ink/5 dark:divide-white/5">
          {guides.map(item => (
            <button
              key={item.id}
              className="flex items-center gap-4 py-3.5 px-1 group text-left hover:bg-tea-ink/[0.02] dark:hover:bg-white/[0.02] transition-colors min-h-[44px]"
            >
              <div className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0 bg-tea-green/10 dark:bg-green-500/20 text-tea-green dark:text-green-400">
                <Icons.Download className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-sm text-tea-ink dark:text-tea-paper truncate mb-0.5">
                  {item.title}
                </h3>
                <p className="text-xs text-tea-ink/50 dark:text-tea-paper/50 line-clamp-1">
                  {item.description}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm hidden sm:inline ${TYPE_COLORS.guide}`}>
                  PDF
                </span>
                <Icons.Next className="w-4 h-4 text-tea-ink/20 dark:text-tea-paper/20 group-hover:text-tea-seal transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Reference Tools */}
      <section>
        <h2 className="font-serif text-lg font-medium text-tea-ink dark:text-tea-paper mb-4">
          Reference Tools
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {reference.map(item => (
            <button
              key={item.id}
              className="group rounded-xl p-5 bg-tea-paper-dark/50 dark:bg-white/5 hover:bg-tea-paper-dark/80 dark:hover:bg-white/[0.07] transition-colors text-left min-h-[44px]"
            >
              <div className="w-10 h-10 rounded-sm flex items-center justify-center mb-3 bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                {(item.iconKey && ICON_MAP[item.iconKey]) || <Icons.Book className="w-6 h-6" />}
              </div>
              <h3 className="font-serif text-sm font-medium text-tea-ink dark:text-tea-paper mb-1">
                {item.title}
              </h3>
              <p className="text-xs text-tea-ink/50 dark:text-tea-paper/50 leading-relaxed line-clamp-2">
                {item.description}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
