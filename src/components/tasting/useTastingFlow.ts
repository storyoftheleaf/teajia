import { useState, useCallback, useMemo } from 'react';
import type { TastingData } from '../../types';
import {
  TASTING_TAXONOMY,
  type TastingCategoryId,
} from '../../data/tastingTaxonomy';

export interface TastingFlowState {
  value: TastingData;
  expandedGroups: Set<string>;
  toggleTerm: (categoryId: TastingCategoryId, termId: string) => void;
  toggleGroup: (categoryId: TastingCategoryId, groupLabel: string) => void;
  expandGroup: (groupLabel: string) => void;
  collapseGroup: (groupLabel: string) => void;
  isGroupSelected: (categoryId: TastingCategoryId, groupLabel: string) => boolean;
  getGroupSelectedTerms: (categoryId: TastingCategoryId, groupLabel: string) => string[];
  addCustomTerm: (categoryId: TastingCategoryId, term: string) => void;
  hasAnySelection: boolean;
}

/** Find the first term in a group (used as the "group-level" selection) */
function getGroupFirstTerm(categoryId: string, groupLabel: string): string | null {
  const cat = TASTING_TAXONOMY.categories.find(c => c.id === categoryId);
  if (!cat) return null;
  const group = cat.groups.find(g => g.label === groupLabel);
  return group?.terms[0]?.id ?? null;
}

/** Get all term IDs in a group */
function getGroupTermIds(categoryId: string, groupLabel: string): string[] {
  const cat = TASTING_TAXONOMY.categories.find(c => c.id === categoryId);
  if (!cat) return [];
  const group = cat.groups.find(g => g.label === groupLabel);
  return group?.terms.map(t => t.id) ?? [];
}

export function useTastingFlow(
  initialValue: TastingData,
  onChange: (data: TastingData) => void
): TastingFlowState {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleTerm = useCallback((categoryId: TastingCategoryId, termId: string) => {
    const current = initialValue[categoryId] || [];
    const next = current.includes(termId)
      ? current.filter(t => t !== termId)
      : [...current, termId];
    onChange({ ...initialValue, [categoryId]: next.length ? next : undefined });
  }, [initialValue, onChange]);

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
    const current = initialValue[categoryId] || [];
    const groupTerms = getGroupTermIds(categoryId, groupLabel);
    const hasAny = groupTerms.some(t => current.includes(t));

    if (hasAny) {
      // If group is already expanded, just collapse it and keep selections
      if (expandedGroups.has(groupLabel)) {
        setExpandedGroups(prev => {
          const next = new Set(prev);
          next.delete(groupLabel);
          return next;
        });
        return;
      }
      // If not expanded, deselect all group terms
      const next = current.filter(t => !groupTerms.includes(t));
      onChange({ ...initialValue, [categoryId]: next.length ? next : undefined });
      setExpandedGroups(prev => {
        const next = new Set(prev);
        next.delete(groupLabel);
        return next;
      });
    } else {
      // Select the first/generic term and expand to show sub-terms
      const firstTerm = getGroupFirstTerm(categoryId, groupLabel);
      if (firstTerm) {
        onChange({ ...initialValue, [categoryId]: [...current, firstTerm] });
      }
      setExpandedGroups(prev => new Set(prev).add(groupLabel));
    }
  }, [initialValue, onChange, expandedGroups]);

  const expandGroup = useCallback((groupLabel: string) => {
    setExpandedGroups(prev => new Set(prev).add(groupLabel));
  }, []);

  const collapseGroup = useCallback((groupLabel: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.delete(groupLabel);
      return next;
    });
  }, []);

  const addCustomTerm = useCallback((categoryId: TastingCategoryId, term: string) => {
    const id = term.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!id) return;
    const current = initialValue[categoryId] || [];
    if (current.includes(id)) return;
    onChange({ ...initialValue, [categoryId]: [...current, id] });
  }, [initialValue, onChange]);

  const hasAnySelection = useMemo(() => {
    return Object.values(initialValue).some(arr => arr && arr.length > 0);
  }, [initialValue]);

  return {
    value: initialValue,
    expandedGroups,
    toggleTerm,
    toggleGroup,
    expandGroup,
    collapseGroup,
    isGroupSelected,
    getGroupSelectedTerms,
    addCustomTerm,
    hasAnySelection,
  };
}
