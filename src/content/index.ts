import { Story } from '../types';

// Articles — Template Showcases
import { templateShowcase } from './articles/template-showcase';
import { travelFeatureVideo } from './articles/travel-feature-video';
import { darkModeProcess } from './articles/dark-mode-process';
import { scientificReference } from './articles/scientific-reference';
import { architecturePhotoFeature } from './articles/architecture-photo-feature';
import { longFormInterview } from './articles/long-form-interview';
import { travelJournalMaps } from './articles/travel-journal-maps';
import { recipeAndPairing } from './articles/recipe-and-pairing';
import { experimentalArt } from './articles/experimental-art';
import { retroArchive } from './articles/retro-archive';
import { minimalWhitespace } from './articles/minimal-whitespace';
import { dataInfographic } from './articles/data-infographic';

// Articles — Tea Features
import { teaFeatureArticle } from './articles/tea-feature-article';
import { teaFeatureProcess } from './articles/tea-feature-process';

// Articles — Interviews
import { interviewWithImages } from './articles/interview-with-images';
import { artistInterview } from './articles/artist-interview';

// Articles — Science
import { scienceReferenceCard } from './articles/science-reference-card';
import { scienceProcess } from './articles/science-process';
import { scienceMythDebunking } from './articles/science-myth-debunking';

// Articles — Curated
import { curatedLinks } from './articles/curated-links';

// Articles — Content Display
import { visualPhotoEssay } from './articles/visual-photo-essay';
import { cinematicPhotoSequence } from './articles/cinematic-photo-sequence';
import { notebookJournal } from './articles/notebook-journal';
import { technicalAnalysis } from './articles/technical-analysis';
import { darkAtmospheric } from './articles/dark-atmospheric';
import { geometricBauhaus } from './articles/geometric-bauhaus';
import { poetryCollection } from './articles/poetry-collection';
import { referenceWithToc } from './articles/reference-with-toc';
import { debateDualPerspective } from './articles/debate-dual-perspective';

// Start Here Articles
import { originStory } from './articles/origin-story';
import { beginnersGuide } from './articles/beginners-guide';
import { timelineOverview } from './articles/timeline-overview';
import { lifestyleGuide } from './articles/lifestyle-guide';

// Photo Essays
import { teaFieldsInSpring } from './photo-essays/tea-fields-in-spring';
import { handsOfCraft } from './photo-essays/hands-of-craft';
import { vesselsAndLight } from './photo-essays/vessels-and-light';
import { ritualMoments } from './photo-essays/ritual-moments';
import { journeyThroughYunnan } from './photo-essays/journey-through-yunnan';
import { thePottersWeek } from './photo-essays/the-potters-week';

export const STORIES: Story[] = [
  // --- TEMPLATE SHOWCASES (1-12) ---
  travelFeatureVideo,
  darkModeProcess,
  scientificReference,
  architecturePhotoFeature,
  longFormInterview,
  travelJournalMaps,
  recipeAndPairing,
  experimentalArt,
  retroArchive,
  minimalWhitespace,
  dataInfographic,

  // --- PHOTO ESSAYS ---
  teaFieldsInSpring,
  handsOfCraft,
  vesselsAndLight,
  ritualMoments,
  journeyThroughYunnan,
  thePottersWeek,

  // --- TEA FEATURE ARTICLES ---
  teaFeatureArticle,
  teaFeatureProcess,

  // --- INTERVIEW ARTICLES ---
  interviewWithImages,
  artistInterview,

  // --- SCIENCE ARTICLES ---
  scienceReferenceCard,
  scienceProcess,
  scienceMythDebunking,

  // --- CURATED READING ---
  curatedLinks,

  // --- CONTENT DISPLAY ARTICLES ---
  visualPhotoEssay,
  cinematicPhotoSequence,
  notebookJournal,
  technicalAnalysis,
  darkAtmospheric,
  geometricBauhaus,
  poetryCollection,
  referenceWithToc,
  debateDualPerspective,

  // --- START HERE ARTICLES ---
  originStory,
  beginnersGuide,
  timelineOverview,
  lifestyleGuide,

  // --- REFERENCE ---
  templateShowcase,
];
