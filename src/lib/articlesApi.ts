import type { ArticleDraftInput, DbArticle, ReadIssueStory, ReviewedDbArticle } from '../types';

interface ArticleApiDependencies {
  apiUrl: string;
  authedFetch: (url: string, init?: RequestInit) => Promise<any>;
  fetchWithTimeout: (url: string) => Promise<Response>;
  handleResponse: (response: Response) => Promise<any>;
}

export function createArticleApi({ apiUrl: API_URL, authedFetch, fetchWithTimeout, handleResponse }: ArticleApiDependencies) {
  return {
    // Admin
    list: async (status?: string): Promise<DbArticle[]> => {
      return authedFetch(`${API_URL}/api/admin/articles${status ? `?status=${status}` : ''}`);
    },
    get: async (id: string): Promise<ReviewedDbArticle> => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}`)
    },
    create: async (data: ArticleDraftInput): Promise<ReviewedDbArticle> => {
      return authedFetch(`${API_URL}/api/admin/articles`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: ArticleDraftInput, reviewDigest: string): Promise<ReviewedDbArticle> => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...data, review_digest: reviewDigest }),
      });
    },
    publish: async (id: string, reviewDigest: string): Promise<ReviewedDbArticle> => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ review_digest: reviewDigest }),
      });
    },
    unpublish: async (id: string, reviewDigest: string): Promise<ReviewedDbArticle> => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}/unpublish`, {
        method: 'POST',
        body: JSON.stringify({ review_digest: reviewDigest }),
      });
    },
    delete: async (id: string, reviewDigest: string): Promise<{ success: boolean }> => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ review_digest: reviewDigest }),
      });
    },
    approveEdition: (id: string, reviewDigest: string, candidateId: string, place: boolean): Promise<{ placed: boolean }> =>
      authedFetch(`${API_URL}/api/admin/articles/${id}/approve-edition`, {
        method: 'POST',
        body: JSON.stringify({ review_digest: reviewDigest, candidate_id: candidateId, place }),
      }),
    readIssue: async (): Promise<{ story: ReadIssueStory | null }> =>
      handleResponse(await fetchWithTimeout(`${API_URL}/api/read/editorial-issue`)),
    // Public
    listPublished: async (limit = 20, offset = 0) => {
      const res = await fetchWithTimeout(
        `${API_URL}/api/articles?limit=${limit}&offset=${offset}`
      );
      return handleResponse(res);
    },
    getBySlug: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/articles/${slug}`);
      return handleResponse(res);
    },
  };
}
