import { GlossaryTerm } from '../types/library';
import { GLOSSARY_TERMS as SOURCE_TERMS } from './glossary';

// Convert the existing glossary data into the Library's GlossaryTerm format.
// This preserves all 90+ terms from the original source.
export const glossaryTerms: GlossaryTerm[] = SOURCE_TERMS.map(t => ({
  id: t.id,
  term: t.term,
  pronunciation: t.pronunciation,
  chinese: t.chineseCharacters,
  definition: t.definition,
  deepDive: t.deepDive?.extendedDescription,
  relatedArticleIds: [],
  relatedProductIds: [],
}));
