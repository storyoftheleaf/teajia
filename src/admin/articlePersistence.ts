import type { ArticleDraftInput as ArticleDraft, ReviewedDbArticle } from '../types';

type ArticleWrites = {
  create: (draft: ArticleDraft) => Promise<ReviewedDbArticle>;
  update: (id: string, draft: ArticleDraft, reviewDigest: string) => Promise<ReviewedDbArticle>;
  publish: (id: string, reviewDigest: string) => Promise<ReviewedDbArticle>;
  unpublish: (id: string, reviewDigest: string) => Promise<ReviewedDbArticle>;
};

// Each write consumes the snapshot returned with the last accepted article.
// The server compares it at the write, including across separate editors.
export function createArticlePersistence(initial: ReviewedDbArticle | null, writes: ArticleWrites) {
  let current = initial;
  let tail: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };

  const reviewDigest = (article: ReviewedDbArticle) => {
    if (!article.review_digest) throw new Error('Reopen this article to review the latest version.');
    return article.review_digest;
  };

  const persist = async (draft: ArticleDraft): Promise<ReviewedDbArticle> => {
    const { status: _status, published_at: _publishedAt, ...content } = draft;
    current = current ? await writes.update(current.id, content, reviewDigest(current)) : await writes.create(content);
    if (!current.id) throw new Error('Article save did not return an ID');
    return current;
  };

  return {
    hasPendingPublication: () => Boolean(current?.has_pending_revision),
    save: (draft: ArticleDraft) => enqueue(async () => (await persist(draft)).id),
    setPublished: (draft: ArticleDraft, publish: boolean) => enqueue(async () => {
      const reviewed = publish ? await persist(draft) : current;
      if (!reviewed) throw new Error('Save the article first.');
      current = publish
        ? await writes.publish(reviewed.id, reviewDigest(reviewed))
        : await writes.unpublish(reviewed.id, reviewDigest(reviewed));
      return current;
    }),
  };
}
