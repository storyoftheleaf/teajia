import React, { useEffect, useMemo, useState } from 'react';

interface ReadingEntry {
  date: string; // ISO date string YYYY-MM-DD
  pagesRead: number;
}

interface ReadingStreakProps {
  storyId: string;
}

const STORAGE_KEY = 'reading_history';
const WEEKS = 4;
const DAYS_PER_WEEK = 7;
const TOTAL_DAYS = WEEKS * DAYS_PER_WEEK;

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function getDayISO(offsetFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetFromToday);
  return d.toISOString().split('T')[0];
}

function getIntensity(pages: number): string {
  if (pages === 0) return 'opacity-0';
  if (pages <= 5) return 'opacity-30';
  if (pages <= 15) return 'opacity-60';
  return 'opacity-100';
}

/**
 * ReadingStreak — 7x4 activity heat-map showing reading history.
 * Records today's reading to localStorage on mount.
 * Shows current streak (consecutive days) and articles this week.
 */
const ReadingStreak: React.FC<ReadingStreakProps> = ({ storyId }) => {
  const [history, setHistory] = useState<ReadingEntry[]>([]);

  // Load and update history on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const entries: ReadingEntry[] = raw ? JSON.parse(raw) : [];

    const today = getTodayISO();
    const existingIdx = entries.findIndex((e) => e.date === today);

    if (existingIdx !== -1) {
      entries[existingIdx].pagesRead += 1;
    } else {
      entries.push({ date: today, pagesRead: 1 });
    }

    // Keep only last 28 days
    const cutoff = getDayISO(-TOTAL_DAYS);
    const trimmed = entries.filter((e) => e.date >= cutoff);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    setHistory(trimmed);
  }, [storyId]);

  // Build grid data: last TOTAL_DAYS days newest-first then reverse
  const gridDays = useMemo(() => {
    const map: Record<string, number> = {};
    history.forEach((e) => { map[e.date] = e.pagesRead; });

    return Array.from({ length: TOTAL_DAYS }, (_, i) => {
      const date = getDayISO(-(TOTAL_DAYS - 1 - i));
      return { date, pages: map[date] ?? 0 };
    });
  }, [history]);

  // Calculate streak
  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < TOTAL_DAYS; i++) {
      const date = getDayISO(-i);
      const entry = history.find((e) => e.date === date);
      if (entry && entry.pagesRead > 0) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [history]);

  // Articles this week
  const articlesThisWeek = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const date = getDayISO(-i);
      const entry = history.find((e) => e.date === date);
      if (entry) count += entry.pagesRead;
    }
    return count;
  }, [history]);

  return (
    <div className="flex flex-col items-start gap-3">
      {/* Stats row */}
      <div className="flex gap-4 text-xs text-tea-text-dim">
        <span>
          <span className="text-tea-gold font-semibold">{streak}</span> day streak
        </span>
        <span>
          <span className="text-tea-gold font-semibold">{articlesThisWeek}</span> pages this week
        </span>
      </div>

      {/* 7x4 grid */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${DAYS_PER_WEEK}, 1fr)` }}
        aria-label="Reading activity over past 4 weeks"
      >
        {gridDays.map((day) => (
          <div
            key={day.date}
            title={`${day.date}: ${day.pages} pages`}
            className={`w-3 h-3 rounded-sm bg-tea-gold ${getIntensity(day.pages)}`}
          />
        ))}
      </div>

      {/* Week labels */}
      <div
        className="grid text-tea-text-dim"
        style={{ gridTemplateColumns: `repeat(${DAYS_PER_WEEK}, 1fr)`, gap: '4px' }}
      >
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="text-center text-xs w-3">{d}</span>
        ))}
      </div>
    </div>
  );
};

export default ReadingStreak;
