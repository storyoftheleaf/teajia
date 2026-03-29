/**
 * Contributor-Led Collections — editorial contributors curate their own "picks"
 * Each collection is linked to a CommunityMember and references product IDs.
 * This serves as both discovery and social proof.
 */

export interface ContributorCollection {
  id: string;
  /** CommunityMember ID */
  contributorId: string;
  /** Display name (e.g., "Sarah's Morning Ritual") */
  title: string;
  /** Short description of why these teas were chosen */
  description: string;
  /** Product IDs from the inventory */
  productIds: string[];
  /** Optional season or theme tag */
  theme?: string;
  /** Date the collection was last updated */
  updatedAt: string;
}

/**
 * Seed data — contributor collections can later be managed via admin.
 * For now, these are defined statically and rendered on the Shop page.
 */
export const CONTRIBUTOR_COLLECTIONS: ContributorCollection[] = [
  // Placeholder — populate when contributors curate their first picks
  // {
  //   id: 'cc-001',
  //   contributorId: 'member-001',
  //   title: "Sarah's Morning Ritual",
  //   description: 'Three teas I reach for before the world wakes up.',
  //   productIds: [],
  //   theme: 'morning',
  //   updatedAt: '2026-03-01',
  // },
];
