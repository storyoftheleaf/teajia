import type { TastingData } from '../../types';
import { impressionNotes } from './YourImpression';

/**
 * The words of a tasting's notes as one string. Notes are strings (older tastings)
 * or note objects, so this reads both; joining the raw list prints "[object Object]".
 */
export function tastingNoteText(data: TastingData): string {
  return impressionNotes(data).map(n => typeof n === 'string' ? n : n.text).join('\n');
}
