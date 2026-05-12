import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronRight } from 'lucide-react';

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
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3 pb-nav-gap">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors mb-6"
        aria-label="Back"
      >
        <ArrowLeft size={14} />
        <span className="text-ui-12">Back</span>
      </button>

      <div>
        <h1 className="h2">Reading history</h1>
        <p className="label-caps text-tea-text-dim mt-1">
          {history.length} {history.length === 1 ? 'article' : 'articles'} in progress
        </p>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <BookOpen size={28} strokeWidth={1.25} className="text-tea-text-dim" />
          <h3 className="font-display text-ui-17 text-tea-text mt-4">No reading history</h3>
          <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-1">
            Your reading progress will appear here as you explore articles.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden mt-6">
          {history.map((entry) => (
            <li key={entry.storyId}>
              <button
                onClick={() => navigate('/magazine')}
                className="w-full text-left flex items-center gap-3 px-4 md:px-6 py-4 hover:bg-tea-accent-sub transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-display text-ui-15 text-tea-text">Story #{entry.storyId}</div>
                  <div className="text-ui-12 text-tea-text-dim mt-1">Page {entry.page + 1}</div>
                </div>
                <ChevronRight size={14} className="text-tea-text-dim shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
