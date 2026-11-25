import type { DbArticle } from './types';

export type ReviewedDbArticle = DbArticle & {
  review_digest: string;
  has_pending_revision?: boolean;
  editorial_pilot?: {
    review_digest: string;
    placement_review_digest: string;
    candidate_id: string;
    content_hash: string;
    source_revision: number;
    placed: boolean;
    approved_id: string | null;
    approved_source_revision: number | null;
    ready: boolean;
    candidate: DbArticle;
  };
};

export type ReadIssueStory = Pick<DbArticle, 'slug' | 'title' | 'subtitle' | 'cover_image_url' | 'author_name'>;

type ClearableArticleField = 'subtitle' | 'category' | 'cover_image_url' | 'pull_quote' | 'pull_quote_subject';
export type ArticleDraftInput = Partial<Omit<DbArticle, ClearableArticleField>> & {
  [Field in ClearableArticleField]?: DbArticle[Field] | null;
};
