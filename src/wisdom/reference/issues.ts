export const TEA_REFERENCE_ISSUE_CATEGORIES = [
  { id: 'incorrect_information', label: 'Incorrect information' },
  { id: 'translation', label: 'Translation' },
  { id: 'unclear_writing', label: 'Unclear writing' },
  { id: 'wrong_source', label: 'Wrong source' },
  { id: 'geography_or_hierarchy', label: 'Geography or hierarchy' },
  { id: 'missing_information', label: 'Missing information' },
] as const;

export type TeaReferenceIssueCategory = typeof TEA_REFERENCE_ISSUE_CATEGORIES[number]['id'];

export interface TeaReferencePageSection {
  key: string;
  label: string;
  text: string;
  sourceIds: readonly string[];
}

export interface TeaReferenceFlagPage {
  id: string;
  slug: string;
  kind?: string;
  label: string;
  nativeName?: string;
  parentId?: string;
  sourceIds?: readonly string[];
  sections: readonly TeaReferencePageSection[];
}

export interface TeaReferenceIssue {
  id: string;
  account_id: string;
  page_id: string;
  page_slug: string;
  route: string;
  section_key: string;
  section_label: string;
  category: TeaReferenceIssueCategory;
  note: string;
  public_text_snapshot: string;
  source_ids: string[];
  status: 'open' | 'resolved';
  created_by_user_id: string;
  created_at: string;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
}

export interface CreateTeaReferenceIssueInput {
  page_id: string;
  section_key: string;
  category: TeaReferenceIssueCategory;
  note: string;
}

export interface CreateTeaReferenceIssueResponse {
  issue: TeaReferenceIssue;
  duplicate: boolean;
}

export interface ListTeaReferenceIssuesResponse {
  issues: TeaReferenceIssue[];
}

export interface ResolveTeaReferenceIssuesResponse {
  resolved_ids: string[];
  resolved_count: number;
}

export function teaReferenceCategoryLabel(category: TeaReferenceIssueCategory): string {
  return TEA_REFERENCE_ISSUE_CATEGORIES.find(option => option.id === category)?.label ?? category;
}
