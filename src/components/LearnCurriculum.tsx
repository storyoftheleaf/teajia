
import React, { useState, useMemo } from 'react';
import { Story, ContentType } from '../types';
import { Icons } from './Icons';
import { CardContainer } from './shared/CardContainer';
import { LEARN_CURRICULUM, LEARN_PATHS } from '../constants';

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

export const LearnCurriculum: React.FC<LearnCurriculumProps> = ({ onStoryClick, watchedStories }) => {
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
      case 'Beginner': return 'bg-tea-green/20 text-emerald-300 border border-tea-green/40 shadow-sm';
      case 'Intermediate': return 'bg-blue-500/20 text-blue-200 border border-blue-400/40 shadow-sm';
      case 'Advanced': return 'bg-tea-gold/20 text-tea-gold border border-tea-gold/40 shadow-sm';
      default: return 'bg-tea-gold/10 text-tea-paper/50';
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
                ? 'bg-tea-gold text-white'
                : 'text-tea-text/60 hover:text-tea-text'
            }`}
          >
            All Courses
          </button>
          <button
            onClick={() => setViewMode('paths')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              viewMode === 'paths'
                ? 'bg-tea-gold text-white'
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
          <p className="font-serif italic text-sm text-tea-text/60 leading-relaxed max-w-lg">
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
          <h2 className="text-lg font-serif text-tea-text mb-6">Choose Your Path</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {LEARN_PATHS.map(path => (
              <CardContainer
                key={path.id}
                variant="dark"
                className="cursor-pointer transition-all duration-300 hover:shadow-lg"
                onClick={() => setSelectedPath(path.id)}
              >
                <div className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="text-tea-text-dim">{getPathIcon(path.icon)}</div>
                  <h3 className="font-serif text-base text-tea-text">{path.title}</h3>
                  <p className="text-xs text-tea-text/50 leading-relaxed">{path.description}</p>
                  <div className="text-[11px] uppercase tracking-wider text-tea-text/40 mt-2">
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
              <div className="text-tea-text-dim">{getPathIcon(selectedPathData.icon)}</div>
              <div>
                <h2 className="font-serif text-2xl text-tea-text">{selectedPathData.title}</h2>
                <p className="text-sm text-tea-text/60 mt-1">{selectedPathData.description}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modules List */}
      <div className="flex flex-col gap-8 max-w-4xl mx-auto px-2 md:px-0">
         {filteredModules.map((module, moduleIndex) => {
             const isExpanded = expandedModules[module.id];
             const completedCount = module.lessons.filter(l => watchedStories[l.id]).length;
             const totalCount = module.lessons.length;
             const progress = (completedCount / totalCount) * 100;

             return (
                 <div key={module.id} className="group">
                     {/* Module Header Card */}
                     <CardContainer
                        variant="dark"
                        className={`relative cursor-pointer overflow-hidden transition-all duration-500 ease-out ${isExpanded ? 'shadow-2xl' : 'shadow-sm hover:shadow-lg'}`}
                        onClick={() => toggleModule(module.id)}
                     >
                        {/* Progress Bar (Top) */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-tea-gold/5">
                            <div
                              className="h-full bg-tea-gold transition-all duration-1000 ease-out"
                              style={{ width: `${progress}%` }}
                            ></div>
                        </div>

                        <div className="p-5 md:p-7 flex items-start gap-5 md:gap-8">
                            {/* Big Number */}
                            <div className="font-serif text-6xl md:text-7xl text-white/5 leading-none shrink-0 select-none">
                                0{moduleIndex + 1}
                            </div>

                            <div className="flex-1 pt-2">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-serif text-2xl md:text-3xl text-tea-text leading-tight group-hover:text-tea-gold transition-colors">
                                        {module.title}
                                    </h3>
                                    <div className="text-tea-text/30 transition-transform duration-500" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                        <Icons.ChevronDown className="w-6 h-6" />
                                    </div>
                                </div>
                                <p className="text-xs uppercase tracking-[0.15em] text-tea-text/50 mb-3 font-medium">
                                    {module.lessons.length} Lessons • {module.subtitle}
                                </p>
                                <div className={`grid transition-all duration-500 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                    <div className="overflow-hidden">
                                        <p className="font-serif italic text-tea-text/60 /70 leading-relaxed max-w-lg">
                                            {module.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                     </CardContainer>

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
                                         <div className={`w-3 h-3 rounded-full border z-10 shrink-0 transition-all duration-300 ${isWatched ? 'bg-tea-gold border-tea-gold' : 'border-tea-text/40  bg-white group-hover/lesson:border-tea-gold/[0.08] dark:group-hover/lesson:border-tea-paper'}`}></div>

                                         {/* Lesson Card */}
                                         <div className={`flex-1 bg-tea-text/5 hover:bg-tea-text/10 border border-tea-gold/[0.08] rounded-[1px] p-4 flex items-center justify-between transition-all duration-300 group-hover/lesson:-translate-y-0.5 group-hover/lesson:shadow-md ${!isLast ? 'border-b border-b-tea-border' : ''}`}>
                                             <div className="flex items-center gap-4">
                                                 {/* Type Icon Box */}
                                                 <div className="w-11 h-11 bg-tea-text/10 rounded-lg flex items-center justify-center text-tea-text/70 shrink-0">
                                                     {getIconForType(lesson.type)}
                                                 </div>

                                                 <div className="flex flex-col gap-1.5">
                                                     {/* Primary: Title */}
                                                     <h4 className={`font-serif text-lg leading-tight transition-colors ${isWatched ? 'text-tea-text/60' : 'text-tea-text group-hover/lesson:text-tea-gold'}`}>
                                                         {lesson.title}
                                                     </h4>
                                                     {/* Secondary: Subtitle + Duration */}
                                                     <div className="flex items-center gap-2">
                                                         <span className="text-[11px] uppercase tracking-wider text-tea-text/60">{lesson.subtitle}</span>
                                                         <span className="w-1 h-1 rounded-full bg-tea-text/30/30"></span>
                                                         <span className="font-mono text-[11px] text-tea-text/50">{lesson.durationOrTime}</span>
                                                     </div>
                                                     {/* Tertiary: Badges */}
                                                     <div className="flex items-center gap-1.5 mt-0.5">
                                                         <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${getDifficultyColor(getDifficultyLevel(lessonIndex))}`}>
                                                           {getDifficultyLevel(lessonIndex)}
                                                         </span>
                                                         {isWatched && (
                                                           <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-tea-green/20 text-emerald-300 border border-tea-green/40 shadow-sm">
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
                     </div>
                 </div>
             );
         })}
      </div>

    </div>
  );
};
