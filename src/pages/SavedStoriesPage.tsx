import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bookmark } from 'lucide-react';

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
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3 pb-nav-gap">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors mb-6"
        aria-label="Back"
      >
        <ChevronLeft size={14} />
        <span className="text-ui-12 uppercase tracking-[0.15em]">Back</span>
      </button>

      <h1 className="h2">Saved Stories</h1>
      <p className="label-caps text-tea-text-dim mt-1">
        {savedIds.length} {savedIds.length === 1 ? 'Story' : 'Stories'} Saved
      </p>

      {savedIds.length === 0 ? (
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <Bookmark size={28} strokeWidth={1.25} className="text-tea-text-dim" />
          <h3 className="font-display text-ui-17 text-tea-text mt-4">No saved stories</h3>
          <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">
            Tap the bookmark icon while reading to save stories for later.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden mt-6">
          {savedIds.map((storyId) => (
            <li key={storyId}>
              <button
                onClick={() => navigate('/magazine')}
                className="w-full text-left px-4 md:px-6 py-4 hover:bg-tea-accent-sub transition-colors"
              >
                <div className="font-display text-ui-15 text-tea-text">Story #{storyId}</div>
                <div className="text-ui-12 text-tea-text-dim mt-1">Saved · tap to open</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
