import { housesDoor, tableDoor } from '../../components/navSections';

/**
 * The four doors with the new bar (Adrian, 2026-11-27): today's four words,
 * each with a few plain words beside it, in the order the line under the
 * headline names them (Adrian's homepage brief, 2026-11-28). Plain data, so
 * the edge (functions/_middleware.ts) writes the same doors for crawlers. Each goes where its
 * bar word goes (navSections.ts), so Deepen follows tableDoor() and Create
 * follows housesDoor(), which is Advise until Tea Houses opens (4.20).
 */
export function homeDoorsLaunchFour() {
  return [
    { accent: 'Discover', words: 'teachings, conversations and tea wisdom', to: '/read' },
    { accent: 'Source', words: 'fine tea and teaware, old and new, found by hand', to: '/shop' },
    { accent: 'Deepen', words: 'journal your tastings, sit at a table, share what you found', to: tableDoor() },
    { accent: 'Create', words: 'your tea space, designed with us or inspired to make your own', to: housesDoor() },
  ];
}
