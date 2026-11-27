/**
 * A person's own things, for their own assistant: their orders, their Tea
 * Chest and their tasting journal, exactly as Your Table shows them.
 *
 * Any signed-in connection may read its own person's things and nobody
 * else's: each tool reads only by the caller's own user id, through the same
 * functions the Your Table routes use (`listMyOrders`, `listMyTeaChest`,
 * `listMyJournal` in index.ts, handed in as `env.personal`). They are reads
 * only. Nothing here sends, prompts or reminds: an assistant answers when the
 * person asks, which keeps the quiet at the table (CLAUDE.md, What this is).
 */
import type { ToolDefinition, ToolModule } from './registry';

const NOT_AVAILABLE = { error: 'not_available' } as const;

const defs: ToolDefinition[] = [
  {
    name: 'list_my_orders',
    scope: 'signed-in',
    description: 'Your own orders from Teajia shops, newest first: what was bought, what it cost, whether it is paid and where the parcel is. Only your own.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_my_tea_chest',
    scope: 'signed-in',
    description: 'The teas in your own Tea Chest, with how much you hold, where each came from and what you noted. Private to you.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_my_journal',
    scope: 'signed-in',
    description: 'Your own tasting journal: the teas you have tasted, at home or at a session, with your notes. Private to you.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Most recent first; default 50, max 200.' } },
      additionalProperties: false,
    },
  },
];

export const personalTools: ToolModule = {
  area: 'personal',
  defs,
  handlers: {
    list_my_orders: async (env, auth) => {
      if (!env.personal) return NOT_AVAILABLE;
      const orders = await env.personal.orders(auth.userId, auth.accountId);
      return { orders, count: orders.length };
    },
    list_my_tea_chest: async (env, auth) => {
      if (!env.personal) return NOT_AVAILABLE;
      const items = await env.personal.teaChest(auth.userId);
      return { items, count: items.length };
    },
    list_my_journal: async (env, auth, args) => {
      if (!env.personal) return NOT_AVAILABLE;
      const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 200);
      const entries = (await env.personal.journal(auth.userId, auth.userEmail, auth.accountId)).slice(0, limit);
      return { entries, count: entries.length };
    },
  },
};
