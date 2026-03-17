import { Story } from '../types';

// Articles
import { pathOfClouds } from './articles/path-of-clouds';
import { theMidnightKiln } from './articles/the-midnight-kiln';
import { botanicalAtlas } from './articles/botanical-atlas';
import { urbanTeaHouse } from './articles/urban-tea-house';
import { theMastersVoice } from './articles/the-masters-voice';
import { ancientRoutes } from './articles/ancient-routes';
import { culinaryLeaf } from './articles/culinary-leaf';
import { fluidDynamics } from './articles/fluid-dynamics';
import { retroArchive } from './articles/retro-archive';
import { minimalWhitespace } from './articles/minimal-whitespace';
import { dataInfographic } from './articles/data-infographic';
import { teaFeatureArticle } from './articles/tea-feature-article';
import { teaFeatureProcess } from './articles/tea-feature-process';
import { interviewWithImages } from './articles/interview-with-images';
import { artistInterview } from './articles/artist-interview';
import { waterTemperature } from './articles/water-temperature';
import { theOxidationSpectrum } from './articles/the-oxidation-spectrum';
import { caffeineInTea } from './articles/caffeine-in-tea';
import { curatedLinks } from './articles/curated-links';
import { visualPhotoEssay } from './articles/visual-photo-essay';
import { cinematicPhotoSequence } from './articles/cinematic-photo-sequence';
import { notebookJournal } from './articles/notebook-journal';
import { anatomyOfACup } from './articles/anatomy-of-a-cup';
import { darkAtmospheric } from './articles/dark-atmospheric';
import { geometricBauhaus } from './articles/geometric-bauhaus';
import { poetryCollection } from './articles/poetry-collection';
import { referenceWithToc } from './articles/reference-with-toc';
import { debateDualPerspective } from './articles/debate-dual-perspective';

// Start Here Articles
import { theCreationOfTeajia } from './articles/the-creation-of-teajia';
import { beginningIntoTea } from './articles/beginning-into-tea';
import { historyOfTea } from './articles/history-of-tea';
import { creatingATeaSpace } from './articles/creating-a-tea-space';

// Photo Essays
import { teaFieldsInSpring } from './photo-essays/tea-fields-in-spring';
import { handsOfCraft } from './photo-essays/hands-of-craft';
import { vesselsAndLight } from './photo-essays/vessels-and-light';
import { ritualMoments } from './photo-essays/ritual-moments';
import { journeyThroughYunnan } from './photo-essays/journey-through-yunnan';
import { thePottersWeek } from './photo-essays/the-potters-week';

export const STORIES: Story[] = [
  // --- EXISTING STORY (Keeping the main one) ---
  pathOfClouds,

  // --- TEMPLATE 1: DARK MODE / CERAMIC (The Midnight Kiln) ---
  theMidnightKiln,

  // --- TEMPLATE 2: LIGHT MODE / BOTANICAL (Botanical Atlas) ---
  botanicalAtlas,

  // --- TEMPLATE 3: URBAN EDITORIAL (Urban Tea House) ---
  urbanTeaHouse,

  // --- TEMPLATE 4: INTERVIEW (The Master's Voice) ---
  theMastersVoice,

  // --- TEMPLATE 5: TRAVELOGUE (Ancient Routes) ---
  ancientRoutes,

  // --- TEMPLATE 6: RECIPE (Culinary Leaf) ---
  culinaryLeaf,

  // --- TEMPLATE 7: ABSTRACT (Fluid Dynamics) ---
  fluidDynamics,

  // --- TEMPLATE 8: VINTAGE (Retro Archive) ---
  retroArchive,

  // --- TEMPLATE 9: MINIMALIST (White Space) ---
  minimalWhitespace,

  // --- TEMPLATE 10: DATA (Infographic) ---
  dataInfographic,

  // --- PHOTO ESSAYS ---

  // Photo Essay 1: Tea Fields in Spring
  teaFieldsInSpring,

  // Photo Essay 2: Hands of Craft
  handsOfCraft,

  // Photo Essay 3: Vessels & Light
  vesselsAndLight,

  // Photo Essay 4: Ritual Moments
  ritualMoments,

  // Photo Essay 5: Journey Through Yunnan
  journeyThroughYunnan,

  // Photo Essay 6: The Potter's Week
  thePottersWeek,

  // =====================================================
  // TEA FEATURE ARTICLES
  // Deep-dive articles highlighting specific teas
  // =====================================================

  teaFeatureArticle,
  teaFeatureProcess,

  // =====================================================
  // INTERVIEW ARTICLES
  // Voices in Tea series
  // =====================================================

  interviewWithImages,
  artistInterview,

  // =====================================================
  // SCIENCE ARTICLES
  // Tea Science series
  // =====================================================

  waterTemperature,
  theOxidationSpectrum,
  caffeineInTea,

  // =====================================================
  // CURATED READING ARTICLES
  // External link roundups
  // =====================================================

  curatedLinks,

  // --- NEW CONTENT DISPLAY ARTICLES ---

  // Article 1: Seasonal Rhythms - Continuous narrative flow
  visualPhotoEssay,

  // Article 2: The Slow Pour - Cinematic photo sequence
  cinematicPhotoSequence,

  // Article 3: Field Notes - Notebook journal
  notebookJournal,

  // Article 4: Anatomy of a Cup - Scientific diagram style
  anatomyOfACup,

  // Article 5: Dark Atmospheric - Moody noir meditation
  darkAtmospheric,

  // Article 6: Geometric Bauhaus - Modernist grid layout
  geometricBauhaus,

  // Article 7: Poetry Collection - Whispered verse
  poetryCollection,

  // Article 8: Living Archive - Curated links & references
  referenceWithToc,

  // Article 9: Dual Voices - Split-screen dialogue
  debateDualPerspective,

  // =====================================================
  // START HERE ARTICLES
  // Foundational guides for new readers
  // =====================================================

  theCreationOfTeajia,
  beginningIntoTea,
  historyOfTea,
  creatingATeaSpace,
];
