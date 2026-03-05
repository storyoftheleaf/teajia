
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Story } from '../types';
import { STORIES } from '../content';
import { validateStoriesArray } from '../utils/validation';
import { safeLocalStorageGet } from '../utils/errorHandling';

interface StoryContextType {
  stories: Story[];
  addStory: (story: Story) => void;
  updateStory: (story: Story) => void;
  deleteStory: (id: string) => void;
  resetStories: () => void;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

export const StoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stories, setStories] = useState<Story[]>(() => {
    // Load stories from localStorage or fallback to constants
    const saved = safeLocalStorageGet<Story[]>('teajia_stories', []);
    if (saved.length > 0) {
      const validatedStories = validateStoriesArray(saved);
      if (validatedStories.length > 0) {
        return validatedStories;
      }
    }
    return STORIES;
  });

  useEffect(() => {
    localStorage.setItem('teajia_stories', JSON.stringify(stories));
  }, [stories]);

  const addStory = (story: Story) => {
    setStories(prev => [story, ...prev]);
  };

  const updateStory = (story: Story) => {
    setStories(prev => prev.map(s => s.id === story.id ? story : s));
  };

  const deleteStory = (id: string) => {
    setStories(prev => prev.filter(s => s.id !== id));
  };

  const resetStories = () => {
    localStorage.removeItem('teajia_stories');
    setStories(STORIES);
  };

  const value = useMemo(() => ({ stories, addStory, updateStory, deleteStory, resetStories }), [stories]);

  return (
    <StoryContext.Provider value={value}>
      {children}
    </StoryContext.Provider>
  );
};

export const useStories = () => {
  const context = useContext(StoryContext);
  if (!context) {
    throw new Error('useStories must be used within a StoryProvider');
  }
  return context;
};
