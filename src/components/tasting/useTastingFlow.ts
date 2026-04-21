import { useState, useCallback, useMemo, useRef } from 'react';
import type { TastingData } from '../../types';
import {
  TASTING_TAXONOMY,
  type TastingCategoryId,
} from '../../data/tastingTaxonomy';

/** Haptic feedback helpers */
const vibrateLight = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
};
const vibrateMedium = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25);
};

export interface TastingFlowState {
  value: TastingData;
  expandedGroups: Set<string>;
  toggleTerm: (categoryId: TastingCategoryId, termId: string) => void;
  toggleGroup: (categoryId: TastingCategoryId, groupLabel: string) => void;
  /** Atomically select one term, deselecting any other in the same category. Tap same term again to deselect. */
  selectExclusive: (categoryId: TastingCategoryId, termId: string) => void;
  expandGroup: (groupLabel: string) => void;
  collapseGroup: (groupLabel: string) => void;
  collapseAllGroups: () => void;
  isGroupSelected: (categoryId: TastingCategoryId, groupLabel: string) => boolean;
  getGroupSelectedTerms: (categoryId: TastingCategoryId, groupLabel: string) => string[];
  addCustomTerm: (categoryId: TastingCategoryId, term: string) => void;
  clearCategory: (categoryId: TastingCategoryId) => void;
  clearAll: () => void;
  undo: () => void;
  canUndo: boolean;
  hasAnySelection: boolean;
  getCategoryCount: (categoryId: TastingCategoryId) => number;
}

function getGroupFirstTerm(categoryId: string, groupLabel: string): string | null {
  const cat = TASTING_TAXONOMY.categories.find(c => c.id === categoryId);
  if (!cat) return null;
  const group = cat.groups.find(g => g.label === groupLabel);
  return group?.terms[0]?.id ?? null;
}

function getGroupTermIds(categoryId: string, groupLabel: string): string[] {
  const cat = TASTING_TAXONOMY.categories.find(c => c.id === categoryId);
  if (!cat) return [];
  const group = cat.groups.find(g => g.label === groupLabel);
  return group?.terms.map(t => t.id) ?? [];
}

const MAX_UNDO = 5;

export function useTastingFlow(
  initialValue: TastingData,
  onChange: (data: TastingData) => void
): TastingFlowState {
  // Start with all flavor groups expanded
  const flavorCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'flavor');
  const allGroupLabels = flavorCategory ? flavorCategory.groups.map(g => g.label) : [];
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(allGroupLabels));
  const undoStack = useRef<TastingData[]>([]);

  const pushUndo = useCallback((current: TastingData) => {
    undoStack.current = [...undoStack.current.slice(-(MAX_UNDO - 1)), current];
  }, []);

  const toggleTerm = useCallback((categoryId: TastingCategoryId, termId: string) => {
    vibrateLight();
    pushUndo(initialValue);
    const current = initialValue[categoryId] || [];
    const next = current.includes(termId)
      ? current.filter(t => t !== termId)
      : [...current, termId];
    onChange({ ...initialValue, [categoryId]: next.length ? next : undefined });
  }, [initialValue, onChange, pushUndo]);

  const selectExclusive = useCallback((categoryId: TastingCategoryId, termId: string) => {
    vibrateLight();
    pushUndo(initialValue);
    const current = initialValue[categoryId] || [];
    if (current.includes(termId)) {
      // Tap same term again → deselect
      onChange({ ...initialValue, [categoryId]: undefined });
    } else {
      // Replace entire category with just this term
      onChange({ ...initialValue, [categoryId]: [termId] });
    }
  }, [initialValue, onChange, pushUndo]);

  const isGroupSelected = useCallback((categoryId: TastingCategoryId, groupLabel: string): boolean => {
    const current = initialValue[categoryId] || [];
    const groupTerms = getGroupTermIds(categoryId, groupLabel);
    return groupTerms.some(t => current.includes(t));
  }, [initialValue]);

  const getGroupSelectedTerms = useCallback((categoryId: TastingCategoryId, groupLabel: string): string[] => {
    const current = initialValue[categoryId] || [];
    const groupTerms = getGroupTermIds(categoryId, groupLabel);
    return groupTerms.filter(t => current.includes(t));
  }, [initialValue]);

  const toggleGroup = useCallback((categoryId: TastingCategoryId, groupLabel: string) => {
    vibrateMedium();
    pushUndo(initialValue);
    const current = initialValue[categoryId] || [];
    const groupTerms = getGroupTermIds(categoryId, groupLabel);
    const hasAny = groupTerms.some(t => current.includes(t));

    if (hasAny) {
      const next = current.filter(t => !groupTerms.includes(t));
      onChange({ ...initialValue, [categoryId]: next.length ? next : undefined });
      setExpandedGroups(prev => {
        if (!prev.has(groupLabel)) return prev;
        const n = new Set(prev);
        n.delete(groupLabel);
        return n;
      });
    } else {
      const firstTerm = getGroupFirstTerm(categoryId, groupLabel);
      if (firstTerm) {
        onChange({ ...initialValue, [categoryId]: [...current, firstTerm] });
      }
    }
  }, [initialValue, onChange, pushUndo]);

  const expandGroup = useCallback((groupLabel: string) => {
    setExpandedGroups(prev => new Set(prev).add(groupLabel));
  }, []);

  const collapseGroup = useCallback((groupLabel: string) => {
    setExpandedGroups(prev => {
      const n = new Set(prev);
      n.delete(groupLabel);
      return n;
    });
  }, []);

  const collapseAllGroups = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  const addCustomTerm = useCallback((categoryId: TastingCategoryId, term: string) => {
    const id = term.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!id) return;
    const current = initialValue[categoryId] || [];
    if (current.includes(id)) return;
    pushUndo(initialValue);
    vibrateLight();
    onChange({ ...initialValue, [categoryId]: [...current, id] });
  }, [initialValue, onChange, pushUndo]);

  const clearCategory = useCallback((categoryId: TastingCategoryId) => {
    if (!initialValue[categoryId]?.length) return;
    vibrateMedium();
    pushUndo(initialValue);
    const next = { ...initialValue };
    delete next[categoryId];
    onChange(next);
  }, [initialValue, onChange, pushUndo]);

  const clearAll = useCallback(() => {
    vibrateMedium();
    pushUndo(initialValue);
    onChange({});
    setExpandedGroups(new Set());
  }, [initialValue, onChange, pushUndo]);

  const undo = useCallback(() => {
    const stack = undoStack.current;
    if (stack.length === 0) return;
    const prev = stack.pop()!;
    vibrateLight();
    onChange(prev);
  }, [onChange]);

  const canUndo = undoStack.current.length > 0;

  const hasAnySelection = useMemo(() => {
    return Object.entries(initialValue).some(([, arr]) => {
      return Array.isArray(arr) && arr.length > 0;
    });
  }, [initialValue]);

  const getCategoryCount = useCallback((categoryId: TastingCategoryId): number => {
    return initialValue[categoryId]?.length || 0;
  }, [initialValue]);

  return {
    value: initialValue,
    expandedGroups,
    toggleTerm,
    toggleGroup,
    selectExclusive,
    expandGroup,
    collapseGroup,
    collapseAllGroups,
    isGroupSelected,
    getGroupSelectedTerms,
    addCustomTerm,
    clearCategory,
    clearAll,
    undo,
    canUndo,
    hasAnySelection,
    getCategoryCount,
  };
}
