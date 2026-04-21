import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';

const STORAGE_KEY = 'teajia_saved_stories';

export default function SavedStoriesPage() {
  const navigate = useNavigate();

  const savedIds = useMemo<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      // App.tsx stores as Record<string, boolean> — convert to array of saved IDs
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.entries(parsed as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k);
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  return (
    <div className="max-w-sm mx-auto pt-12 pb-12">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-8"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-xs uppercase tracking-[0.15em]">Back</span>
      </button>

      <h1 className="font-display text-3xl text-tea-text mb-1">Saved Stories</h1>
      <p className="font-body italic text-sm text-tea-text-dim mb-8">
        {savedIds.length} {savedIds.length === 1 ? 'story' : 'stories'} saved
      </p>

      {savedIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
            <Icons.Leaf className="w-7 h-7 text-tea-gold/40" />
          </div>
          <h3 className="font-serif text-lg text-tea-text mb-2">No Saved Stories</h3>
          <p className="text-sm text-tea-text-sec text-center max-w-[260px] leading-relaxed">
            Tap the leaf icon while reading to save stories for later.
          </p>
        </div>
      ) : (
        <div className="border border-tea-border overflow-hidden rounded-md">
          {savedIds.map((storyId, i) => (
            <button
              key={storyId}
              onClick={() => navigate('/magazine')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-tea-surface/50 transition-colors group text-left ${
                i < savedIds.length - 1 ? 'border-b border-tea-border' : ''
              }`}
            >
              <Icons.Leaf className="w-4 h-4 text-tea-gold shrink-0" />
              <span className="font-serif text-sm text-tea-text group-hover:text-tea-gold transition-colors truncate flex-1">
                Story #{storyId}
              </span>
              <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
