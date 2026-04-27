import { Story } from '../types';

// Photo Essays (active — used by VisualFeatureViewer and related components)
import { teaFieldsInSpring } from './photo-essays/tea-fields-in-spring';
import { handsOfCraft } from './photo-essays/hands-of-craft';
import { vesselsAndLight } from './photo-essays/vessels-and-light';
import { ritualMoments } from './photo-essays/ritual-moments';
import { journeyThroughYunnan } from './photo-essays/journey-through-yunnan';
import { thePottersWeek } from './photo-essays/the-potters-week';

// Article content removed. Articles are now served exclusively from the D1
// `articles` table and rendered through /article/:slug (ArticlePage.tsx).
// Legacy Story-typed article files were deleted in Phase E of the
// Article Unification Plan.

export const STORIES: Story[] = [
  teaFieldsInSpring,
  handsOfCraft,
  vesselsAndLight,
  ritualMoments,
  journeyThroughYunnan,
  thePottersWeek,
];
