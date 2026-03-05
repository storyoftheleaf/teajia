import type { VisualGuideItem } from '../types/library';

export const VISUAL_GUIDES: VisualGuideItem[] = [
  // Brewing Guides
  {
    id: 'br1',
    title: 'Gongfu Brewing Essentials',
    description: 'Complete guide to traditional gongfu brewing',
    type: 'guide',
  },
  {
    id: 'br2',
    title: 'Water Temperature Chart',
    description: 'Downloadable PDF with optimal temperatures by tea type',
    type: 'guide',
  },
  {
    id: 'br3',
    title: 'Leaf-to-Water Ratios',
    description: 'Quick reference for proportions and timing',
    type: 'guide',
  },
  {
    id: 'br4',
    title: 'Teaware Care & Maintenance',
    description: 'How to properly care for your brewing vessels',
    type: 'guide',
  },
  {
    id: 'br5',
    title: 'Flavor Development Guide',
    description: 'How brewing parameters affect taste',
    type: 'guide',
  },
  // Reference Tools
  {
    id: 'r1',
    title: 'Tasting Notes Worksheet',
    description: 'Printable template for recording observations',
    type: 'reference',
    iconKey: 'Book',
  },
  {
    id: 'r2',
    title: 'Tea Region Map',
    description: 'Major tea-producing regions worldwide',
    type: 'reference',
    iconKey: 'Location',
  },
  {
    id: 'r3',
    title: 'Collection Organization',
    description: 'Spreadsheet for tracking your collection',
    type: 'reference',
    iconKey: 'Grid',
  },
  {
    id: 'r4',
    title: 'Brewing Experiment Journal',
    description: 'Guided journal for brewing experiments',
    type: 'reference',
    iconKey: 'Book',
  },
];
