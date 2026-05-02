import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';

interface ProgressEntry {
  storyId: string;
  page: number;
}

export default function ReadingHistoryPage() {
  const navigate = useNavigate();

  const history = useMemo<ProgressEntry[]>(() => {
    const entries: ProgressEntry[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('teajia_progress_')) {
          const storyId = key.replace('teajia_progress_', '');
          const raw = localStorage.getItem(key);
          if (raw) {
            const page = parseInt(raw, 10);
            if (!isNaN(page)) entries.push({ storyId, page });
          }
        }
      }
    } catch {}
    return entries;
  }, []);

  return (
    <div className="max-w-sm mx-auto pt-12 pb-12">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-8"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-xs uppercase tracking-caps">Back</span>
      </button>

      <h1 className="font-display text-3xl text-tea-text mb-1">Reading History</h1>
      <p className="font-body italic text-sm text-tea-text-dim mb-8">
        {history.length} {history.length === 1 ? 'article' : 'articles'} in progress
      </p>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
            <Icons.BookOpen className="w-7 h-7 text-tea-gold/40" />
          </div>
          <h3 className="font-serif text-lg text-tea-text mb-2">No Reading History</h3>
          <p className="text-sm text-tea-text-sec text-center max-w-[260px] leading-relaxed">
            Your reading progress will appear here as you explore articles.
          </p>
        </div>
      ) : (
        <div className="border border-tea-border overflow-hidden rounded-md">
          {history.map((entry, i) => (
            <button
              key={entry.storyId}
              onClick={() => navigate('/magazine')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-tea-surface/50 transition-colors group text-left ${
                i < history.length - 1 ? 'border-b border-tea-border' : ''
              }`}
            >
              <Icons.BookOpen className="w-4 h-4 text-tea-text-sec shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-serif text-sm text-tea-text group-hover:text-tea-gold transition-colors truncate block">
                  Story #{entry.storyId}
                </span>
                <span className="text-ui-10 text-tea-text-sec">Page {entry.page + 1}</span>
              </div>
              <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text-sec shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
