export type InventoryCommandRisk = 'routine' | 'review' | 'destructive';

export type InventoryCommand = {
  id: string;
  label: string;
  group: 'view' | 'record' | 'bulk' | 'maintenance';
  risk: InventoryCommandRisk;
  requiresConfirmation: boolean;
};

export const INVENTORY_COMMANDS = [
  {
    id: 'inventory.view.columns',
    label: 'Columns',
    group: 'view',
    risk: 'routine',
    requiresConfirmation: false,
  },
  {
    id: 'inventory.view.group',
    label: 'Group',
    group: 'view',
    risk: 'routine',
    requiresConfirmation: false,
  },
  {
    id: 'inventory.view.price-mode',
    label: 'Price Mode',
    group: 'view',
    risk: 'routine',
    requiresConfirmation: false,
  },
  {
    id: 'inventory.record.edit',
    label: 'Edit Product',
    group: 'record',
    risk: 'routine',
    requiresConfirmation: false,
  },
  {
    id: 'inventory.record.public-toggle',
    label: 'Toggle Public',
    group: 'record',
    risk: 'review',
    requiresConfirmation: false,
  },
  {
    id: 'inventory.record.archive',
    label: 'Archive Product',
    group: 'record',
    risk: 'review',
    requiresConfirmation: false,
  },
  {
    id: 'inventory.bulk.apply',
    label: 'Apply Bulk Edit',
    group: 'bulk',
    risk: 'review',
    requiresConfirmation: false,
  },
  {
    id: 'inventory.bulk.generate-wisdom',
    label: 'Generate Wisdom',
    group: 'bulk',
    risk: 'review',
    requiresConfirmation: true,
  },
  {
    id: 'inventory.bulk.reset-verification',
    label: 'Reset Stock Check',
    group: 'bulk',
    risk: 'review',
    requiresConfirmation: true,
  },
  {
    id: 'inventory.maintenance.database-wipe',
    label: 'Database Wipe',
    group: 'maintenance',
    risk: 'destructive',
    requiresConfirmation: true,
  },
] as const satisfies readonly InventoryCommand[];

export const INVENTORY_COMMAND_GROUPS = [
  { id: 'view', label: 'View' },
  { id: 'record', label: 'Record' },
  { id: 'bulk', label: 'Bulk' },
  { id: 'maintenance', label: 'Maintenance' },
] as const;
