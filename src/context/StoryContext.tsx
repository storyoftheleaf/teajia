
import React, { createContext, useContext, useState, useMemo } from 'react';
import { Story } from '../types';

interface StoryContextType {
  stories: Story[];
  addStory: (story: Story) => void;
  updateStory: (story: Story) => void;
  deleteStory: (id: string) => void;
  resetStories: () => void;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

export const StoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Legacy code-defined magazine stories were retired with /magazine-archive.
  // Published articles now come from D1 through the article APIs.
  const [stories, setStories] = useState<Story[]>([]);

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
    setStories([]);
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
