
import React, { createContext, useContext, useCallback, useRef, useEffect, useState, useMemo } from 'react';

// Type definitions for preloader state and configuration
export interface PreloaderState {
  preloadedUrls: Set<string>;
  failedUrls: Set<string>;
  pendingUrls: Set<string>;
  estimatedSizeMB: number;
}

export interface PreloaderConfig {
  maxMemoryMB: number;
  maxConcurrentLoads: number;
  pagesAhead: number;
}

interface ImagePreloaderContextType {
  preloadImages: (urls: string[]) => Promise<void>;
  getPreloadState: () => PreloaderState;
  clearCache: () => void;
  clearOldPages: (currentPageIndex: number) => void;
  setConfig: (partial: Partial<PreloaderConfig>) => void;
}

const ImagePreloaderContext = createContext<ImagePreloaderContextType | undefined>(undefined);

// Helper to estimate image size (rough approximation)
// Returns 2 MB as average estimate for all images
const estimateImageSize = (_url: string): number => {
  // Most images in the magazine are 1-3 MB, use 2 MB as average estimate
  return 2;
};

// Detect network connection quality
const getNetworkConfig = (): { pagesAhead: number; maxConcurrent: number } => {
  if (typeof window === 'undefined' || !('connection' in navigator)) {
    // Default to standard config if Connection API unavailable
    return { pagesAhead: 3, maxConcurrent: 4 };
  }

  const connection = (navigator as any).connection;
  const effectiveType = connection?.effectiveType;
  const saveData = connection?.saveData;

  // If save data mode enabled, be conservative
  if (saveData) {
    return { pagesAhead: 1, maxConcurrent: 2 };
  }

  // Adjust based on connection speed
  switch (effectiveType) {
    case '4g':
    case '5g':
      return { pagesAhead: 3, maxConcurrent: 4 };
    case '3g':
      return { pagesAhead: 2, maxConcurrent: 2 };
    case '2g':
      return { pagesAhead: 1, maxConcurrent: 1 };
    default:
      return { pagesAhead: 3, maxConcurrent: 4 };
  }
};

// Get device memory to adjust config
const getDeviceMemoryConfig = (): Partial<PreloaderConfig> => {
  if (typeof window === 'undefined' || !('deviceMemory' in navigator)) {
    return {};
  }

  const deviceMemory = (navigator as any).deviceMemory;

  if (deviceMemory && deviceMemory < 4) {
    return { maxMemoryMB: 25 };
  }

  return {};
};

export const ImagePreloaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Cache storage: Map of URL -> HTMLImageElement
  const cacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Track URLs being loaded
  const loadingRef = useRef<Map<string, Promise<void>>>(new Map());

  // Track active concurrent loads
  const activeLoadsRef = useRef(0);

  // Track failed URLs
  const failedRef = useRef<Set<string>>(new Set());

  // Configuration state
  const [config, setConfigState] = useState<PreloaderConfig>(() => {
    const networkConfig = getNetworkConfig();
    const deviceConfig = getDeviceMemoryConfig();

    return {
      maxMemoryMB: 40,
      maxConcurrentLoads: networkConfig.maxConcurrent,
      pagesAhead: networkConfig.pagesAhead,
      ...deviceConfig,
    };
  });

  // Monitor network changes and update config
  useEffect(() => {
    if (typeof window === 'undefined' || !('connection' in navigator)) {
      return;
    }

    const connection = (navigator as any).connection;
    if (!connection?.addEventListener) {
      return;
    }

    const handleConnectionChange = () => {
      const networkConfig = getNetworkConfig();
      setConfigState(prev => ({
        ...prev,
        maxConcurrentLoads: networkConfig.maxConcurrent,
        pagesAhead: networkConfig.pagesAhead,
      }));
    };

    connection.addEventListener('change', handleConnectionChange);
    return () => connection.removeEventListener('change', handleConnectionChange);
  }, []);

  // Preload a single image
  const preloadSingleImage = useCallback((url: string): Promise<void> => {
    // If already loading, return existing promise
    if (loadingRef.current.has(url)) {
      return loadingRef.current.get(url)!;
    }

    // If already cached, return immediately
    if (cacheRef.current.has(url)) {
      return Promise.resolve();
    }

    const promise = new Promise<void>((resolve) => {
      // Wait for concurrent slot if needed
      const checkSlot = () => {
        if (activeLoadsRef.current < config.maxConcurrentLoads) {
          activeLoadsRef.current++;

          const img = new Image();

          img.onload = () => {
            cacheRef.current.set(url, img);
            activeLoadsRef.current--;
            loadingRef.current.delete(url);
            resolve();
          };

          img.onerror = () => {
            // Track failed URL for reporting
            failedRef.current.add(url);
            activeLoadsRef.current--;
            loadingRef.current.delete(url);
            resolve();
          };

          img.src = url;
        } else {
          // Retry after brief delay
          setTimeout(checkSlot, 50);
        }
      };

      checkSlot();
    });

    loadingRef.current.set(url, promise);
    return promise;
  }, [config.maxConcurrentLoads]);

  // Preload multiple images with concurrency control
  const preloadImages = useCallback(
    async (urls: string[]) => {
      if (!urls || urls.length === 0) {
        return;
      }

      // Filter out invalid and already-cached URLs
      const urlsToPreload = urls.filter(url => url && !cacheRef.current.has(url));

      if (urlsToPreload.length === 0) {
        return;
      }

      // Preload all URLs (concurrency handled per image)
      await Promise.allSettled(urlsToPreload.map(url => preloadSingleImage(url)));
    },
    [preloadSingleImage]
  );

  // Get current preload state (for UI feedback)
  const getPreloadState = useCallback((): PreloaderState => {
    const preloadedUrls = new Set(cacheRef.current.keys());
    const pendingUrls = new Set(loadingRef.current.keys());

    // Calculate estimated cache size
    const estimatedSizeMB = Math.ceil(
      Array.from(cacheRef.current.keys()).reduce((sum, url) => sum + estimateImageSize(url), 0)
    );

    return {
      preloadedUrls,
      failedUrls: new Set(failedRef.current),
      pendingUrls,
      estimatedSizeMB,
    };
  }, []);

  // Clear entire cache
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    loadingRef.current.clear();
    failedRef.current.clear();
    activeLoadsRef.current = 0;
  }, []);

  // Clear old pages (4+ pages behind current)
  const clearOldPages = useCallback((currentPageIndex: number) => {
    const keysToDelete: string[] = [];

    // This is a simplified implementation - in real usage,
    // we'd need to track which URLs belong to which pages
    // For now, we'll clear if cache gets too large
    if (getPreloadState().estimatedSizeMB > config.maxMemoryMB) {
      // Clear oldest entries (browser stores insertion order)
      const entries = Array.from(cacheRef.current.entries());
      const entriesToRemove = entries.slice(0, Math.floor(entries.length * 0.3)); // Remove oldest 30%

      entriesToRemove.forEach(([url]) => {
        cacheRef.current.delete(url);
        keysToDelete.push(url);
      });
    }
  }, [config.maxMemoryMB, getPreloadState]);

  // Update configuration
  const setConfig = useCallback((partial: Partial<PreloaderConfig>) => {
    setConfigState(prev => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo<ImagePreloaderContextType>(() => ({
    preloadImages,
    getPreloadState,
    clearCache,
    clearOldPages,
    setConfig,
  }), [preloadImages, getPreloadState, clearCache, clearOldPages, setConfig]);

  return (
    <ImagePreloaderContext.Provider value={value}>
      {children}
    </ImagePreloaderContext.Provider>
  );
};

export const useImagePreloader = () => {
  const context = useContext(ImagePreloaderContext);
  if (!context) {
    throw new Error('useImagePreloader must be used within an ImagePreloaderProvider');
  }
  return context;
};
