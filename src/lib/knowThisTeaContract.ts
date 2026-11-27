// "Does anyone know this tea?" (Launch 5, M8; src/lib/knowThisTea.ts), the
// answers shared by the worker (worker/src/knowThisTea.ts) and the site.
//
// The public piece carries no count of any kind: not how many people wrote,
// not how many kept it. What people write to the asker is in
// KnowThisTeaAsked, which only the asker reads. Nobody's user id is in any of
// these.
import type { FamilyPersonPhotograph } from './familyContract';

/** A question on the Tea Table: one photograph and where the tea came from. */
export interface TeaTableQuestion {
  kind: 'question';
  id: string;
  /** When it was put on the table. It sits in the table's time order by this. */
  at: string;
  /** Who asked: their page's name and link when they have a published page, otherwise a first name and no link. */
  person: { name: string; path: string | null };
  where_from: string;
  photograph: FamilyPersonPhotograph;
  /**
   * Set by the asker alone. `path` is the tea in the shop, when it is there.
   * `by` is the first name of the person the asker thanked, only when that
   * person allowed it.
   */
  named: { name: string; path: string | null; by: string | null } | null;
}

/** What one person told the asker. Read by the asker alone. */
export interface KnowThisTeaNote {
  id: string;
  at: string;
  /** Their first name. */
  by: string;
  words: string;
  /** The tea in the shop they pointed to, when they gave one. */
  tea: { name: string; path: string } | null;
  /** Whether they allowed their first name to show on the piece if they are thanked. */
  name_shown: boolean;
  thanked: boolean;
}

/** GET /api/tea-table/questions/:id/asked: the asker's own view of their question. */
export interface KnowThisTeaAsked {
  question: TeaTableQuestion;
  notes: KnowThisTeaNote[];
}

/** GET /api/admin/tea-table/questions, for the platform owner alone. */
export interface KnowThisTeaManageItem {
  id: string;
  at: string;
  by: string;
  where_from: string;
  named: string | null;
  hidden: boolean;
  /** On the table now: not taken off by the asker and not hidden. */
  showing: boolean;
}

/** The address of one question's own page: a step on the Tea Table. */
export const questionPath = (id: string) => `/tea-table?question=${encodeURIComponent(id)}`;
