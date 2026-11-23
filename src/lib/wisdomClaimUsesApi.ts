/**
 * Tea Wisdom claim uses: the article ↔ claim reads and the one write.
 * Contract: docs/_notes/tea-wisdom-claims.md, "Article claim uses".
 * Worker side: worker/src/articleWisdomClaimUses.ts.
 */
import { API_URL, authedFetch, fetchWithTimeout, getTokenClaims, handleResponse } from './api';

export interface WisdomClaimUseRow {
  article_id: string;
  block_index: number;
  claim_id: string;
  rev_used: number;
  use_kind: 'prose' | 'live_block';
}

export interface WisdomCitingArticle {
  id: string;
  title: string;
  slug: string;
  /** Present only on the signed-in answer. */
  status?: 'draft' | 'published' | 'archived';
  claim_ids: string[];
}

export const wisdomClaimUsesApi = {
  list: (articleId: string): Promise<{ uses: WisdomClaimUseRow[] }> =>
    authedFetch(`${API_URL}/api/admin/articles/${encodeURIComponent(articleId)}/wisdom-claim-uses`),

  replace: (articleId: string, uses: Omit<WisdomClaimUseRow, 'article_id'>[]): Promise<{ uses: WisdomClaimUseRow[] }> =>
    authedFetch(`${API_URL}/api/admin/articles/${encodeURIComponent(articleId)}/wisdom-claim-uses`, {
      method: 'PUT',
      body: JSON.stringify({ uses }),
    }),

  /** Articles citing a Wisdom page. Signed in with the publish bundle: the account's drafts too. Otherwise published only. */
  async citingPage(pageId: string): Promise<{ articles: WisdomCitingArticle[] }> {
    const query = `page_id=${encodeURIComponent(pageId)}`;
    if (getTokenClaims()) {
      try {
        return await authedFetch(`${API_URL}/api/admin/wisdom-claim-uses?${query}`);
      } catch {
        // A signed-in reader without the publish bundle reads what anyone reads.
      }
    }
    return handleResponse(await fetchWithTimeout(`${API_URL}/api/wisdom/claim-uses/articles?${query}`));
  },
};
