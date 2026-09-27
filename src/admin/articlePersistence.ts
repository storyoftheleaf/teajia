import type { DbArticle } from '../types';

type ArticleDraft = Partial<DbArticle>;
type ArticleWrites = {
  create: (draft: ArticleDraft) => Promise<DbArticle>;
  update: (id: string, draft: ArticleDraft) => Promise<DbArticle>;
  publish: (id: string) => Promise<unknown>;
  unpublish: (id: string) => Promise<unknown>;
};

// Serializes every write for one editor. Ordinary content writes never carry
// status; only the dedicated publish/unpublish endpoint changes that field.
export function createArticlePersistence(initialId: string | null, writes: ArticleWrites) {
  let articleId = initialId;
  let tail: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };

  const persist = async (draft: ArticleDraft): Promise<string> => {
    const { status: _status, ...content } = draft;
    if (articleId) {
      await writes.update(articleId, content);
    } else {
      const created = await writes.create({ ...content, status: 'draft' });
      if (!created.id) throw new Error('Article create did not return an ID');
      articleId = created.id;
    }
    return articleId;
  };

  return {
    save: (draft: ArticleDraft) => enqueue(() => persist(draft)),
    setPublished: (draft: ArticleDraft, publish: boolean) => enqueue(async () => {
      const id = await persist(draft);
      if (publish) await writes.publish(id);
      else await writes.unpublish(id);
      return id;
    }),
  };
}
