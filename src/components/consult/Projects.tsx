import React, { useState, useMemo } from 'react';
import { Icons } from '../Icons';
import { ConsultProject } from '../../types/consult';
import { consultProjects } from '../../data/consultProjects';
import { CardContainer } from '../shared/CardContainer';
import { useSectionReveal } from '../../hooks/useSectionReveal';

const CTA_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2 rounded-sm';
const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-text/5 px-2 -ml-2';

type FilterType = 'all' | 'space' | 'event' | 'journey';

const FILTER_TABS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'space', label: 'Spaces' },
  { id: 'event', label: 'Events' },
  { id: 'journey', label: 'Journeys' },
];

interface ProjectsProps {
  onBack: () => void;
  onSelectProject: (projectId: string) => void;
}

const ProjectCard: React.FC<{
  project: ConsultProject;
  onSelect: (id: string) => void;
}> = ({ project, onSelect }) => (
  <button
    onClick={() => onSelect(project.id)}
    className={`text-left group w-full ${CTA_FOCUS}`}
  >
    <CardContainer className="overflow-hidden mb-4 md:hover:-translate-y-1 transition-all duration-300">
      <div className="w-full bg-tea-elevated/90" style={{ aspectRatio: '16/10' }} role="img" aria-label={`${project.name} project`} />
    </CardContainer>
    <h3 className="font-serif text-lg font-medium text-tea-text">
      {project.name}
    </h3>
    <p className="text-xs uppercase tracking-wider text-tea-text/40">
      {project.location}
    </p>
  </button>
);

export const Projects: React.FC<ProjectsProps> = ({ onBack, onSelectProject }) => {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const reveal = useSectionReveal();

  const filteredProjects = useMemo(() => {
    if (filterType === 'all') return consultProjects;
    return consultProjects.filter(p => p.type === filterType);
  }, [filterType]);

  return (
    <div className="w-full">
      {/* Back navigation */}
      <button onClick={onBack} className={BACK_BTN}>
        <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-text-sec" />
        <span className="font-serif text-sm text-tea-text-sec">Consult</span>
      </button>

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-tea-gold font-sans mb-2">
          Portfolio
        </p>
        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal mb-6 text-tea-text">
          Projects
        </h1>

        {/* Filter tabs */}
        <div className="flex items-center gap-6 border-b border-tea-border pb-3">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`text-xs uppercase tracking-[0.25em] transition-all duration-300 relative ${
                filterType === tab.id
                  ? 'text-tea-text font-medium'
                  : 'text-tea-text/60 hover:text-tea-text/90/90'
              }`}
            >
              {tab.label}
              {filterType === tab.id && (
                <span className="absolute -bottom-3 left-0 w-full h-[1px] bg-tea-gold" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Project grid */}
      <div ref={reveal.ref} className={`${reveal.className}`} style={reveal.style}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => (
            <ProjectCard key={project.id} project={project} onSelect={onSelectProject} />
          ))}
        </div>
      </div>
    </div>
  );
};
