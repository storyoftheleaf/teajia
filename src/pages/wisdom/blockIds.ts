/**
 * A stable id on every article block, stored in the block's own JSON as
 * `blockId`. Readers ignore it. The worker uses it to keep Wisdom claim uses on
 * their blocks when a save moves, inserts or deletes blocks
 * (worker/src/articleWisdomClaimUses.ts, remapBlockIndexes).
 */
import type { ArticleBlock } from '../../types';

export function blockIdOf(block: ArticleBlock | undefined): string | null {
  const id = (block as { blockId?: unknown } | undefined)?.blockId;
  return typeof id === 'string' && id ? id : null;
}

function newBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The same blocks, each with an id; blocks that already have one keep it, and a duplicated id is replaced. */
export function withBlockIds(blocks: readonly ArticleBlock[]): ArticleBlock[] {
  const seen = new Set<string>();
  let changed = false;
  const out = blocks.map(block => {
    const id = blockIdOf(block);
    if (id && !seen.has(id)) { seen.add(id); return block; }
    changed = true;
    const fresh = newBlockId();
    seen.add(fresh);
    return { ...block, blockId: fresh } as unknown as ArticleBlock;
  });
  return changed ? out : (blocks as ArticleBlock[]);
}
