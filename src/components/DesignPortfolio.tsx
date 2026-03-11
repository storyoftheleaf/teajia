import React, { useState } from 'react';
import { DESIGN_PROJECTS, PROJECT_TYPE_LABELS, DesignProject } from '../data/designPortfolio';
import { Icons } from './Icons';

interface DesignPortfolioProps {
  onInquiryClick?: () => void;
  showAll?: boolean;
  maxProjects?: number;
}

export const DesignPortfolio: React.FC<DesignPortfolioProps> = ({
  onInquiryClick,
  showAll = false,
  maxProjects = 3,
}) => {
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);

  const displayedProjects = showAll
    ? DESIGN_PROJECTS.filter(p => p.status === 'completed')
    : DESIGN_PROJECTS.filter(p => p.status === 'completed').slice(0, maxProjects);

  const handleProjectClick = (project: DesignProject) => {
    setSelectedProject(project);
  };

  const closeModal = () => {
    setSelectedProject(null);
  };

  return (
    <div className="w-full">
      {/* Section Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Icons.Grid className="w-5 h-5 text-tea-gold" />
          <span className="text-xs uppercase tracking-[0.15em] text-tea-gold font-medium">Portfolio</span>
        </div>
        <h3 className="font-serif text-2xl md:text-3xl text-tea-text mb-2">
          Our Work
        </h3>
        <p className="text-tea-text/70 text-sm max-w-xl">
          A selection of tea spaces we've designed and curated. Each project reflects our commitment to creating intentional, beautiful environments for tea practice.
        </p>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {displayedProjects.map((project) => (
          <button
            key={project.id}
            onClick={() => handleProjectClick(project)}
            className="group text-left bg-tea-bg rounded-lg overflow-hidden border border-tea-gold/[0.08] hover:border-tea-gold/30 transition-all duration-300 hover:shadow-lg"
          >
            {/* Image */}
            <div className="aspect-[4/3] relative overflow-hidden">
              <img
                src={project.imageUrl}
                alt={project.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Status Badge */}
              {project.status === 'in-progress' && (
                <span className="absolute top-3 left-3 px-2 py-1 bg-amber-500/90 text-white text-[10px] uppercase tracking-wider rounded">
                  In Progress
                </span>
              )}

              {/* Project Type Badge */}
              <span className="absolute top-3 right-3 px-2 py-1 bg-tea-gold/60/90 text-tea-text text-[10px] uppercase tracking-wider rounded">
                {PROJECT_TYPE_LABELS[project.projectType]}
              </span>

              {/* View Details Overlay */}
              <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="inline-flex items-center gap-2 text-white text-sm font-medium">
                  View Project <Icons.ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              <h4 className="font-serif text-lg text-tea-text mb-1 group-hover:text-tea-gold transition-colors">
                {project.title}
              </h4>
              <p className="text-tea-text/60 text-sm mb-3">
                {project.subtitle}
              </p>
              <div className="flex items-center gap-2 text-tea-text/50 text-xs">
                <Icons.MapPin className="w-3 h-3" />
                <span>{project.location}</span>
                <span className="mx-1">•</span>
                <span>{project.year}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* View All / CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {!showAll && DESIGN_PROJECTS.filter(p => p.status === 'completed').length > maxProjects && (
          <button className="px-6 py-2 border border-tea-gold/[0.08] text-tea-text rounded-lg hover:border-tea-gold hover:text-tea-gold transition-colors text-sm">
            View All Projects
          </button>
        )}
        {onInquiryClick && (
          <button
            onClick={onInquiryClick}
            className="px-6 py-2 bg-tea-gold text-white rounded-lg hover:bg-tea-gold/90 transition-colors text-sm font-medium"
          >
            Start Your Project
          </button>
        )}
      </div>

      {/* Project Detail Modal */}
      {selectedProject && (
        <div
          className="fixed inset-0 z-modal bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 animate-[fadeIn_0.2s_ease-out]"
          onClick={closeModal}
        >
          <div
            className="bg-tea-bg  max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl animate-[scaleIn_0.3s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 p-2 bg-tea-gold/10 hover:bg-tea-gold/15 rounded-full text-white transition-colors"
            >
              <Icons.Close className="w-5 h-5" />
            </button>

            {/* Hero Image */}
            <div className="aspect-[16/9] relative">
              <img
                src={selectedProject.imageUrl}
                alt={selectedProject.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <span className="inline-block px-2 py-1 bg-tea-gold text-white text-[10px] uppercase tracking-wider rounded mb-3">
                  {PROJECT_TYPE_LABELS[selectedProject.projectType]}
                </span>
                <h2 className="font-serif text-3xl md:text-4xl text-white mb-2">
                  {selectedProject.title}
                </h2>
                <p className="text-white/80 text-lg">{selectedProject.subtitle}</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8">
              {/* Location & Year */}
              <div className="flex items-center gap-4 text-tea-text/60 text-sm mb-6">
                <div className="flex items-center gap-2">
                  <Icons.MapPin className="w-4 h-4" />
                  <span>{selectedProject.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icons.Calendar className="w-4 h-4" />
                  <span>{selectedProject.year}</span>
                </div>
              </div>

              {/* Description */}
              <div className="mb-8">
                <h3 className="font-serif text-xl text-tea-text mb-3">About This Project</h3>
                <p className="text-tea-text/80 leading-relaxed">
                  {selectedProject.description}
                </p>
              </div>

              {/* Features */}
              <div className="mb-8">
                <h3 className="font-serif text-xl text-tea-text mb-4">Key Features</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedProject.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-tea-text/80">
                      <Icons.Check className="w-5 h-5 text-tea-gold flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Gallery */}
              {selectedProject.galleryImages && selectedProject.galleryImages.length > 1 && (
                <div className="mb-8">
                  <h3 className="font-serif text-xl text-tea-text mb-4">Gallery</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedProject.galleryImages.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt={`${selectedProject.title} - Image ${i + 1}`}
                        className="w-full aspect-[4/3] object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Testimonial */}
              {selectedProject.testimonial && (
                <div className="bg-tea-gold/10 rounded-lg p-6 mb-8">
                  <Icons.Message className="w-8 h-8 text-tea-gold/40 mb-4" />
                  <p className="text-tea-text text-lg italic font-serif mb-4">
                    "{selectedProject.testimonial.quote}"
                  </p>
                  <div className="text-tea-text/70 text-sm">
                    <span className="font-medium">{selectedProject.testimonial.author}</span>
                    <span className="mx-2">•</span>
                    <span>{selectedProject.testimonial.role}</span>
                  </div>
                </div>
              )}

              {/* Placeholder Notice */}
              {selectedProject.isPlaceholder && (
                <div className="text-center py-4 border-t border-tea-gold/[0.08]">
                  <p className="text-tea-text/50 text-xs">
                    This is a representative project. Contact us to see our full portfolio.
                  </p>
                </div>
              )}

              {/* CTA */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => {
                    closeModal();
                    onInquiryClick?.();
                  }}
                  className="px-8 py-3 bg-tea-gold text-white rounded-lg hover:bg-tea-gold/90 transition-colors font-medium"
                >
                  Start a Project Like This
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
