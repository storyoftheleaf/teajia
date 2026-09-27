import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from './shared/PageHeader';
import { AdviseView } from '../types/advise';
import { adviseProjects } from '../data/adviseProjects';
import { InquiryForm } from './advise/InquiryForm';
import { Projects } from './advise/Projects';
import { ProjectDetail } from './advise/ProjectDetail';
import AdviseIndex from '../pages/advise/AdviseIndex';

/* =====================================================
   AdvisePage, main shell
   ===================================================== */

interface AdvisePageProps {
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
}

export const AdvisePage: React.FC<AdvisePageProps> = ({ onCartClick, onAccountClick, cartItemCount = 0 }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = (searchParams.get('v') || 'main') as AdviseView;
  const selectedProjectId = searchParams.get('pid') || null;
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryPreselect, setInquiryPreselect] = useState('');

  const scrollPositions = useRef<Record<string, number>>({});
  const prevView = useRef<AdviseView>(currentView);

  useEffect(() => {
    if (prevView.current !== currentView) {
      scrollPositions.current[prevView.current] = window.scrollY;
      const savedPosition = scrollPositions.current[currentView] ?? 0;
      requestAnimationFrame(() => window.scrollTo(0, savedPosition));
      prevView.current = currentView;
    }
  }, [currentView]);

  const openInquiry = useCallback((preselect: string) => {
    setInquiryPreselect(preselect);
    setInquiryOpen(true);
  }, []);

  const navigateTo = useCallback((view: AdviseView, projectId?: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (view === 'main') { next.delete('v'); next.delete('pid'); }
      else { next.set('v', view); if (projectId) next.set('pid', projectId); else next.delete('pid'); }
      return next;
    }, { replace: false });
    delete scrollPositions.current[view];
  }, [setSearchParams]);

  const selectedProject = selectedProjectId ? adviseProjects.find(p => p.id === selectedProjectId) : null;

  // Portfolio is not built yet, the projects sub-views are hidden. Any old /advise?v=projects
  // or ?v=project-detail link falls back to the main page. See TODO.md (Advise portfolio).
  const portfolioEnabled = false;

  // Sub-views
  if (portfolioEnabled && currentView === 'projects') {
    return (
      <div className="w-full animate-[fadeIn_0.6s_ease-out]">
        <PageHeader title="Advise" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />
        <div className="mt-8">
          <Projects onBack={() => window.history.back()} onSelectProject={(id) => navigateTo('project-detail', id)} />
        </div>
        <InquiryForm isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} preselect={inquiryPreselect} />
      </div>
    );
  }

  if (portfolioEnabled && currentView === 'project-detail' && selectedProject) {
    return (
      <div className="w-full animate-[fadeIn_0.6s_ease-out]">
        <PageHeader title="Advise" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />
        <div className="mt-8">
          <ProjectDetail project={selectedProject} onBack={() => window.history.back()} onOpenInquiry={openInquiry} onNavigateProjects={() => navigateTo('projects')} />
        </div>
        <InquiryForm isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} preselect={inquiryPreselect} />
      </div>
    );
  }

  /* ── Main view: the Advise landing, built in the Read/Craft immersive
     frame. AdviseIndex carries its own Helmet, nav, hero, services ledger,
     cover rail, and its own InquiryForm mount, so nothing else renders here. */
  return <AdviseIndex />;
};
