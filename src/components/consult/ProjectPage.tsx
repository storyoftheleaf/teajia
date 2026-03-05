import React from 'react';
import { Icons } from '../Icons';
import { ProjectData } from '../../types/consult';

interface ProjectPageProps {
  project: ProjectData;
  onBack: () => void;
  onOpenInquiry: () => void;
}

const TYPE_LABELS: Record<ProjectData['type'], string> = {
  space: 'Space',
  event: 'Event',
  journey: 'Journey',
};

export const ProjectPage: React.FC<ProjectPageProps> = ({ project, onBack, onOpenInquiry }) => {
  return (
    <div className="animate-[fadeIn_0.5s_ease-out]">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-tea-ink/50 dark:text-tea-paper/50 hover:text-tea-seal transition-colors duration-300 mb-8"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-xs uppercase tracking-widest">Back</span>
      </button>

      {/* Project name */}
      <h1 className="font-serif text-3xl md:text-4xl text-tea-ink dark:text-tea-paper font-light leading-tight mb-6">
        {project.name}
      </h1>

      {/* Placeholder hero image */}
      <div className="w-full aspect-[16/9] bg-tea-ink/5 dark:bg-white/5 rounded-sm mb-8 flex items-center justify-center">
        {project.heroImage ? (
          <img src={project.heroImage} alt={project.name} className="w-full h-full object-cover rounded-sm" />
        ) : (
          <Icons.Image className="w-10 h-10 text-tea-ink/15 dark:text-tea-paper/15" />
        )}
      </div>

      {/* Location / Type */}
      <div className="flex items-center gap-3 text-sm text-tea-ink/50 dark:text-tea-paper/50 mb-10">
        <span className="flex items-center gap-1.5">
          <Icons.Location className="w-3.5 h-3.5" />
          {project.location}
        </span>
        <span className="w-1 h-1 rounded-full bg-tea-ink/20 dark:bg-tea-paper/20" />
        <span>{TYPE_LABELS[project.type]}</span>
      </div>

      {/* The Client / Description */}
      <section className="mb-10">
        <h2 className="text-xs uppercase tracking-widest text-tea-ink/50 dark:text-tea-paper/50 mb-3">
          {project.client ? 'The Client' : 'About'}
        </h2>
        <p className="text-tea-ink/80 dark:text-tea-paper/80 text-base leading-relaxed">
          {project.client || project.description}
        </p>
        {project.client && project.description && (
          <p className="text-tea-ink/60 dark:text-tea-paper/60 text-sm leading-relaxed mt-2">
            {project.description}
          </p>
        )}
      </section>

      {/* The Work */}
      {project.work.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs uppercase tracking-widest text-tea-ink/50 dark:text-tea-paper/50 mb-3">
            The Work
          </h2>
          <ul className="space-y-2">
            {project.work.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-tea-seal/40 mt-2 shrink-0" />
                <span className="text-tea-ink/70 dark:text-tea-paper/70 text-base">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Placeholder image gallery */}
      {project.images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 mb-10">
          {project.images.map((img, i) => (
            <div key={i} className="aspect-square bg-tea-ink/5 dark:bg-white/5 rounded-sm overflow-hidden">
              <img src={img} alt={`${project.name} ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-10">
          {[0, 1].map((i) => (
            <div key={i} className="aspect-square bg-tea-ink/5 dark:bg-white/5 rounded-sm flex items-center justify-center">
              <Icons.Image className="w-6 h-6 text-tea-ink/10 dark:text-tea-paper/10" />
            </div>
          ))}
        </div>
      )}

      {/* The Result */}
      <section className="mb-12">
        <h2 className="text-xs uppercase tracking-widest text-tea-ink/50 dark:text-tea-paper/50 mb-3">
          The Result
        </h2>
        <p className="text-tea-ink/70 dark:text-tea-paper/70 text-base leading-relaxed italic">
          {project.result || 'Details coming soon.'}
        </p>
      </section>

      {/* CTA */}
      <div className="border-t border-tea-ink/10 dark:border-white/10 pt-10 mb-4">
        <p className="text-tea-ink/60 dark:text-tea-paper/60 text-sm mb-6">
          Interested in something similar?
        </p>
        <button
          onClick={onOpenInquiry}
          className="inline-flex items-center gap-2 px-6 py-3 bg-tea-seal text-white uppercase tracking-wider text-xs font-medium rounded-sm hover:bg-tea-seal/90 transition-all duration-300"
        >
          Start a conversation
          <Icons.Next className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
