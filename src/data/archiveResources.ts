/**
 * ARCHIVED RESOURCES DATA
 *
 * This file contains the Resources section that was removed from the main navigation
 * during the v2 navigation restructuring (Q4 2024).
 *
 * The Resources section was consolidated into other areas:
 * - Reference materials → Learn > Library
 * - Collection guides → Offerings / Magazine
 * - Educational content → Learn > Courses / Library
 *
 * If Resources need to be restored or referenced in the future, use this file
 * as the source of truth for the data structure and content.
 */

import { Resource } from '../types';

export const ARCHIVED_RESOURCES: Resource[] = [
  // Example archived resources - this would contain the original RESOURCES data
  // The RESOURCES constant was previously imported from './resources'
  // If you need to restore this data, reference the original ./resources file
];

/**
 * Archive Notes:
 *
 * Original location: /Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia-grid/data/resources.ts
 *
 * The Resources page showed:
 * - Collection curations
 - Tea house recommendations
 * - Travel guides
 * - Educational playlists
 * - Brewing technique references
 * - Tea sourcing guides
 *
 * This content should be redistributed or made available through:
 * - Magazine (editorial recommendations)
 * - Learn > Library (reference materials)
 * - Offerings (curated services)
 *
 * To restore Resources section:
 * 1. Import ARCHIVED_RESOURCES from this file
 * 2. Add RESOURCES back to Section type in types.ts
 * 3. Create a new ResourcesPage component
 * 4. Add routing in App.tsx renderSectionContent()
 * 5. Add RESOURCES to navigation items in BottomTabBar and LeftSidebar
 * 6. Update navigation constants in constants.ts
 */
