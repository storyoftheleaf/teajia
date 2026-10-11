/**
 * `rename_supplier`: the agent door onto the same rename the Supplier sheet uses.
 *
 * The work lives in `../supplierRename.ts`; this file is only the two-step
 * preview/confirm around it, so a spoken "Master Bo is really called Bo Lin"
 * shows Adrian what would change before it does.
 */
import { applySupplierRename, previewSupplierRename, SupplierRenameRefusal } from '../supplierRename';
import type { ToolAuth, ToolDefinition, ToolEnv, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope, type TicketPayload } from './tickets';

interface RenameSupplierTicket extends TicketPayload {
  kind: 'rename_supplier';
  vendorId: string;
  oldName: string;
  newName: string;
}

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || null;
};

async function toolRenameSupplier(env: ToolEnv, auth: ToolAuth, args: any): Promise<unknown> {
  try {
    const confirm = text(args?.confirm, 80);
    if (confirm) {
      const t = await consumeTicket<RenameSupplierTicket, 'rename_supplier'>(env, confirm, 'rename_supplier', auth);
      if (!t) return INVALID_TICKET;
      // Pinned to the name the preview showed: if it moved since, nothing is written.
      const done = await applySupplierRename(env.DB, auth.accountId, t.vendorId, t.newName, t.oldName);
      return { committed: true, vendor_id: done.vendor_id, old_name: done.old_name, new_name: done.new_name, changed: done.counts, total_changed: done.total };
    }

    const vendorId = text(args?.vendor_id, 80);
    if (!vendorId) throw new SupplierRenameRefusal('vendor_id is required. Find it with curate_find.', 400, 'vendor_required');
    const preview = await previewSupplierRename(env.DB, auth.accountId, vendorId, args?.new_name);
    const token = await issueTicket<RenameSupplierTicket>(env, {
      kind: 'rename_supplier', accountId: auth.accountId, vendorId, oldName: preview.old_name, newName: preview.new_name,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'rename_supplier',
      read_back: `Rename "${preview.old_name}" to "${preview.new_name}" on the supplier card and everywhere the name is kept.`,
      changes: preview.counts.filter(c => c.by_id + c.by_name > 0),
      total_rows: preview.total,
    }, token);
  } catch (e) {
    if (e instanceof SupplierRenameRefusal) return { error: e.code, message: e.message };
    throw e;
  }
}

const defs: ToolDefinition[] = [
  {
    name: 'rename_supplier',
    scope: 'catalog:write',
    description: 'Use this when Adrian says a supplier is not called what the shop has, e.g. "Master Bo is really Bo Lin". Renames the supplier card and every record that carries the name (Curate teas, the shelf, orders, visits, arrivals) in one step that lands whole or not at all. Rows tied to the supplier by id are renamed; rows that only held the old name as text are matched on the old name within this shop. The preview counts what would change; send confirm only after Adrian said yes. Contact details are changed with curate_save_vendor.',
    inputSchema: {
      type: 'object',
      properties: {
        vendor_id: { type: 'string', description: 'From curate_find.' },
        new_name: { type: 'string', description: 'What the supplier is really called.' },
        confirm: { type: 'string', description: 'The confirmation_token from the preview, sent only after Adrian said yes.' },
      },
      additionalProperties: false,
    },
  },
];

export const supplierRenameTools: ToolModule = {
  area: 'supplier-rename',
  defs,
  handlers: { rename_supplier: toolRenameSupplier },
};
