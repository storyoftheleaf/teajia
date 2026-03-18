import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface BookmarkFoldProps {
  pageIndex: number;
  storyId: string;
  isBookmarked: boolean;
  onToggle: () => void;
}

/**
 * BookmarkFold — Visual dog-ear bookmark on the page corner.
 * Displays a CSS triangle in the top-right corner.
 * Gold when bookmarked, subtle outline when not.
 * Persists to localStorage under `bookmarks_${storyId}`.
 */
const BookmarkFold: React.FC<BookmarkFoldProps> = ({
  pageIndex,
  storyId,
  isBookmarked,
  onToggle,
}) => {
  const [animating, setAnimating] = useState(false);

  // Sync to localStorage whenever bookmark state changes
  useEffect(() => {
    const key = `bookmarks_${storyId}`;
    const stored = localStorage.getItem(key);
    let bookmarks: number[] = stored ? JSON.parse(stored) : [];

    if (isBookmarked) {
      if (!bookmarks.includes(pageIndex)) {
        bookmarks = [...bookmarks, pageIndex];
      }
    } else {
      bookmarks = bookmarks.filter((p) => p !== pageIndex);
    }

    localStorage.setItem(key, JSON.stringify(bookmarks));
  }, [isBookmarked, pageIndex, storyId]);

  const handleToggle = () => {
    setAnimating(true);
    onToggle();
    setTimeout(() => setAnimating(false), 400);
  };

  return (
    <button
      onClick={handleToggle}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
      className="absolute top-0 right-0 w-12 h-12 overflow-hidden focus:outline-none z-10"
      style={{ background: 'transparent', border: 'none', padding: 0 }}
    >
      <motion.div
        className="absolute top-0 right-0"
        animate={
          animating
            ? { scaleX: [1, 0.6, 1], scaleY: [1, 0.6, 1] }
            : {}
        }
        transition={{ duration: 0.35, ease: 'easeInOut' }}
        style={{ transformOrigin: 'top right' }}
      >
        {/* Dog-ear triangle using CSS border trick */}
        <div
          style={{
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: '0 48px 48px 0',
            borderColor: isBookmarked
              ? 'transparent var(--color-tea-gold, #c9a84c) transparent transparent'
              : 'transparent rgba(201,168,76,0.25) transparent transparent',
            transition: 'border-color 0.25s ease',
          }}
        />
        {/* Small shadow fold line */}
        <div
          className="absolute top-0 right-0 opacity-20"
          style={{
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: '0 48px 48px 0',
            borderColor: 'transparent #000 transparent transparent',
            clipPath: 'polygon(100% 0, 100% 20%, 80% 0)',
          }}
        />
      </motion.div>
      {/* Accessibility label dot indicator */}
      {isBookmarked && (
        <span className="sr-only">Bookmarked</span>
      )}
    </button>
  );
};

export default BookmarkFold;
