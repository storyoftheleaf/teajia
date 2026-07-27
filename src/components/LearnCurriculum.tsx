
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Story, ContentType } from '../types';
import { Icons } from './Icons';
import { CardContainer } from './shared/CardContainer';
import { LEARN_CURRICULUM, LEARN_PATHS } from '../constants';
import { useProductReferences } from './reader/ProductReferences';
import { api } from '../lib/api';

interface LearnCurriculumProps {
  onStoryClick: (story: Story) => void;
  watchedStories: Record<string, boolean>;
}

// Static icon maps - prevent recreation on every render
const CONTENT_TYPE_ICONS: Record<ContentType, React.ReactNode> = {
  [ContentType.Article]: <Icons.Book className="w-3.5 h-3.5" />,
  [ContentType.Reel]: <Icons.Play className="w-3.5 h-3.5" />,
  [ContentType.Film]: <Icons.Play className="w-3.5 h-3.5" />,
  [ContentType.Audio]: <Icons.Audio className="w-3.5 h-3.5" />,
  [ContentType.PhotoEssay]: <Icons.Camera className="w-3.5 h-3.5" />,
};

const PATH_ICONS: Record<string, React.ReactNode> = {
  'Leaf': <Icons.Leaf className="w-8 h-8" />,
  'Location': <Icons.Location className="w-8 h-8" />,
  'Teapot': <Icons.Teapot className="w-8 h-8" />,
  'Box': <Icons.Box className="w-8 h-8" />,
};

// ----------------------------------------------------------------
// Per-module "Explore in the collection" block. Driven exclusively
// by the `module_products` xref table (curated via admin Content Links).
// Renders nothing when no xref rows exist for this module.
// Links use the /shop?product=<id> modal convention.
// ----------------------------------------------------------------
const ModuleExplore: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const navigate = useNavigate();
  const resolved = useProductReferences({
    sourceId: moduleId,
    queryKey: 'module-products',
    fetcher: api.publicXref.modules,
  });
  const products = resolved.slice(0, 3);
  if (products.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-tea-border pl-6 md:pl-24 pr-0 md:pr-8">
      <p className="text-xs font-sans text-tea-text-dim mb-2">
        Explore in the collection
      </p>
      <div className="space-y-1.5">
        {products.map(product => (
          <button
            key={product.id}
            onClick={() => navigate(`/shop?product=${encodeURIComponent(product.id)}`)}
            className="flex items-center gap-2 text-left w-full py-1 group/explore"
          >
            {product.image && (
              <img
                src={product.image}
                alt=""
                className="w-7 h-7 rounded object-cover opacity-70 group-hover/explore:opacity-100 transition-opacity"
              />
            )}
            <span className="text-sm font-sans text-tea-text-sec group-hover/explore:text-tea-gold transition-colors">
              {product.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export const LearnCurriculum: React.FC<LearnCurriculumProps> = ({ onStoryClick, watchedStories }) => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'courses' | 'paths'>('courses');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    'm1': true, // Auto-expand first module
    'm2': false,
    'm3': false
  });

  // Get filtered modules based on selected path
  const filteredModules = useMemo(() => {
    if (viewMode === 'courses') return LEARN_CURRICULUM; // Courses tab: show all modules directly
    if (!selectedPath) return [];
    const path = LEARN_PATHS.find(p => p.id === selectedPath);
    if (!path) return LEARN_CURRICULUM;
    return LEARN_CURRICULUM.filter(m => path.modules.includes(m.id));
  }, [selectedPath, viewMode]);

  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Calculate streak
  const calculateStreak = () => {
    const watchedCount = Object.values(watchedStories).filter(Boolean).length;
    return Math.floor(watchedCount / 2) || 0; // Simple streak calculation
  };

  // Get difficulty for a lesson (simulated)
  const getDifficultyLevel = (index: number): 'Beginner' | 'Intermediate' | 'Advanced' => {
    if (index < 2) return 'Beginner';
    if (index < 4) return 'Intermediate';
    return 'Advanced';
  };

  const getDifficultyColor = (level: string): string => {
    switch(level) {
      case 'Beginner': return 'bg-tea-green/20 text-tea-leaf border border-tea-green/40 ';
      case 'Intermediate': return 'bg-tea-elevated/20 text-tea-text-sec border border-tea-border ';
      case 'Advanced': return 'bg-tea-gold/20 text-tea-gold border border-tea-border ';
      default: return 'bg-tea-gold/10 text-tea-text/50';
    }
  };

  const getIconForType = (type: ContentType) => {
    return CONTENT_TYPE_ICONS[type] || <Icons.Leaf className="w-3.5 h-3.5" />;
  };

  const getPathIcon = (iconName: string) => {
    return PATH_ICONS[iconName] || <Icons.Leaf className="w-8 h-8" />;
  };

  // Calculate curriculum-wide progress
  const allLessons = filteredModules.flatMap(m => m.lessons);
  const totalWatched = allLessons.filter(l => watchedStories[l.id]).length;
  const streak = calculateStreak();

  const selectedPathData = selectedPath ? LEARN_PATHS.find(p => p.id === selectedPath) : null;

  return (
    <div className="w-full animate-[fadeIn_0.5s_ease-out]">

      {/* View Mode Toggle */}
      <div className="max-w-4xl mx-auto px-2 md:px-0 mb-6">
        <div className="inline-flex bg-tea-text/5 rounded-full p-1">
          <button
            onClick={() => { setViewMode('courses'); setSelectedPath(null); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              viewMode === 'courses'
                ? 'cta-solid'
                : 'text-tea-text/60 hover:text-tea-text'
            }`}
          >
            All Courses
          </button>
          <button
            onClick={() => setViewMode('paths')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              viewMode === 'paths'
                ? 'cta-solid'
                : 'text-tea-text/60 hover:text-tea-text'
            }`}
          >
            Learning Paths
          </button>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="max-w-4xl mx-auto px-2 md:px-0 mb-8">
        <div className="flex items-center justify-between">
          <p className="font-display italic text-sm text-tea-text/60 leading-relaxed max-w-lg">
            {selectedPathData
              ? selectedPathData.description
              : viewMode === 'courses'
                ? 'A structured journey from the botany of the leaf to the philosophy of the pour.'
                : 'Choose a learning path to follow a curated sequence of modules.'}
          </p>
          {allLessons.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-tea-text/50 whitespace-nowrap ml-4">
              <span>{totalWatched}/{allLessons.length} completed</span>
              {streak > 0 && (
                <div className="flex items-center gap-1">
                  <Icons.Lightbulb className="w-4 h-4" />
                  <span>{streak} day streak</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Path Selection - only in paths view when no path selected */}
      {viewMode === 'paths' && !selectedPath && (
        <div className="max-w-4xl mx-auto px-2 md:px-0 mb-12">
          <h2 className="text-lg font-display text-tea-text mb-6">Choose Your Path</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {LEARN_PATHS.map(path => (
              <CardContainer
                key={path.id}
                className="cursor-pointer transition-all duration-300"
                onClick={() => setSelectedPath(path.id)}
              >
                <div className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="text-tea-text-sec">{getPathIcon(path.icon)}</div>
                  <h3 className="font-display text-base text-tea-text">{path.title}</h3>
                  <p className="text-xs text-tea-text/50 leading-relaxed">{path.description}</p>
                  <div className="text-ui-11 uppercase tracking-wider text-tea-text/40 mt-2">
                    {path.modules.length} modules
                  </div>
                </div>
              </CardContainer>
            ))}
          </div>
        </div>
      )}

      {/* Selected Path Header - only in paths view */}
      {viewMode === 'paths' && selectedPath && (
        <div className="max-w-4xl mx-auto px-2 md:px-0 mb-6">
          <button
            onClick={() => setSelectedPath(null)}
            className="flex items-center gap-2 text-tea-gold hover:text-tea-text transition-colors text-sm font-medium"
          >
            <Icons.ChevronDown className="w-4 h-4 rotate-90" />
            Back to Path Selection
          </button>
          {selectedPathData && (
            <div className="mt-4 flex items-center gap-3">
              <div className="text-tea-text-sec">{getPathIcon(selectedPathData.icon)}</div>
              <div>
                <h2 className="font-display text-2xl text-tea-text">{selectedPathData.title}</h2>
                <p className="text-sm text-tea-text/60 mt-1">{selectedPathData.description}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto px-2 md:px-0">
         {filteredModules.map((module, moduleIndex) => {
             const isExpanded = expandedModules[module.id];
             const completedCount = module.lessons.filter(l => watchedStories[l.id]).length;
             const totalCount = module.lessons.length;
             const progress = (completedCount / totalCount) * 100;

             return (
                 <div key={module.id} className={`group ${isExpanded ? 'col-span-1 md:col-span-2' : 'col-span-1'}`}>
                     {/* Module Header Card — editorial card style */}
                     <article
                        className={`relative cursor-pointer overflow-hidden rounded-xl bg-tea-surface transition-colors duration-150
                          ${isExpanded ? 'bg-tea-elevated' : 'hover:bg-tea-elevated'}`}
                        onClick={() => toggleModule(module.id)}
                     >
                        {/* Progress Bar (Top) */}
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-tea-border">
                            <div
                              className="h-full bg-tea-gold transition-all duration-1000 ease-out"
                              style={{ width: `${progress}%` }}
                            />
                        </div>

                        <div className="p-5">
                            {/* Level badge */}
                            <span className="font-sans text-ui-10 uppercase tracking-widest text-tea-text-dim block mb-3">
                                Module {moduleIndex + 1} &middot; {module.subtitle || (moduleIndex === 0 ? 'Foundation' : moduleIndex === 1 ? 'Intermediate' : 'Advanced')}
                            </span>

                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-display text-xl text-tea-text leading-tight group-hover:text-tea-gold transition-colors duration-150 flex-1 pr-3">
                                    {module.title}
                                </h3>
                                <div className="text-tea-text-dim transition-transform duration-300 shrink-0 mt-1" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                    <Icons.ChevronDown className="w-4 h-4" />
                                </div>
                            </div>

                            <p className="font-body text-sm text-tea-text-sec leading-relaxed mb-4">
                                {module.description}
                            </p>

                            {/* Meta row */}
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-xs text-tea-text-dim">
                                    {module.lessons.length} lessons
                                </span>
                                {completedCount > 0 && (
                                    <span className="font-sans text-ui-10 uppercase tracking-widest bg-tea-accent-sub text-tea-gold px-2 py-0.5 rounded-full">
                                        {completedCount}/{totalCount} done
                                    </span>
                                )}
                            </div>
                        </div>
                     </article>

                     {/* Lessons List (Accordion Body) */}
                     <div className={`transition-all duration-700 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
                         <div className="pl-6 md:pl-24 pr-0 md:pr-8 flex flex-col relative">
                             {/* Vertical Path Line */}
                             <div className="absolute left-[1.6rem] md:left-[6.15rem] top-0 bottom-6 w-[1px] bg-tea-text/10 z-0"></div>

                             {module.lessons.map((lesson, lessonIndex) => {
                                 const isWatched = watchedStories[lesson.id];
                                 const isLast = lessonIndex === module.lessons.length - 1;

                                 return (
                                     <div
                                        key={lesson.id}
                                        className="relative flex items-center gap-6 py-4 group/lesson cursor-pointer z-10"
                                        style={{ animationDelay: `${lessonIndex * 50}ms`, animationFillMode: 'both' }}
                                        onClick={() => onStoryClick(lesson)}
                                     >
                                         {/* Status Node */}
                                         <div className={`w-3 h-3 rounded-full border z-10 shrink-0 transition-all duration-300 ${isWatched ? 'bg-tea-gold border-tea-gold' : 'border-tea-text/40 bg-tea-surface group-hover/lesson:border-tea-border'}`}></div>

                                         {/* Lesson Card */}
                                         <div className={`flex-1 bg-tea-text/5 hover:bg-tea-text/10 border border-tea-border rounded-[1px] p-4 flex items-center justify-between transition-all duration-300 ${!isLast ? 'border-b border-b-tea-border' : ''}`}>
                                             <div className="flex items-center gap-4">
                                                 {/* Type Icon Box */}
                                                 <div className="w-11 h-11 bg-tea-text/10 rounded-xl flex items-center justify-center text-tea-text/70 shrink-0">
                                                     {getIconForType(lesson.type)}
                                                 </div>

                                                 <div className="flex flex-col gap-1.5">
                                                     {/* Primary: Title */}
                                                     <h4 className={`font-display text-lg leading-tight transition-colors ${isWatched ? 'text-tea-text/60' : 'text-tea-text group-hover/lesson:text-tea-gold'}`}>
                                                         {lesson.title}
                                                     </h4>
                                                     {/* Secondary: Subtitle + Duration */}
                                                     <div className="flex items-center gap-2">
                                                         <span className="text-ui-11 uppercase tracking-wider text-tea-text/60">{lesson.subtitle}</span>
                                                         <span className="w-1 h-1 rounded-full bg-tea-text/30/30"></span>
                                                         <span className="font-mono text-ui-11 text-tea-text/50">{lesson.durationOrTime}</span>
                                                     </div>
                                                     {/* Tertiary: Badges */}
                                                     <div className="flex items-center gap-1.5 mt-0.5">
                                                         <span className={`text-ui-10 uppercase tracking-wider px-2 py-0.5 rounded-md ${getDifficultyColor(getDifficultyLevel(lessonIndex))}`}>
                                                           {getDifficultyLevel(lessonIndex)}
                                                         </span>
                                                         {isWatched && (
                                                           <span className="text-ui-10 uppercase tracking-wider px-2 py-0.5 rounded-md bg-tea-green/20 text-tea-leaf border border-tea-green/40">
                                                             ✓ Completed
                                                           </span>
                                                         )}
                                                     </div>
                                                 </div>
                                             </div>

                                             <div className="opacity-0 group-hover/lesson:opacity-100 transition-all -translate-x-2 group-hover/lesson:translate-x-0 duration-300">
                                                 <Icons.Next className="w-5 h-5 text-tea-text/40" />
                                             </div>
                                         </div>
                                     </div>
                                 );
                             })}
                         </div>

                         {/* End-of-module product exploration —
                             driven by module_products xref (curated in admin → Content Links).
                             Renders nothing until products are linked. */}
                         <ModuleExplore moduleId={module.id} />
                     </div>
                 </div>
             );
         })}
      </div>

    </div>
  );
};
