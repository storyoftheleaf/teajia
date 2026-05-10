export type InventoryCategory = 'tea' | 'teaware';

export type InventorySortDirection = 'asc' | 'desc';

export type InventoryViewConfig = {
  id: string;
  name: string;
  icon?: string | null;
  columns: string[];
  sortConfig: { key: string; direction: InventorySortDirection }[];
  filterType: string;
  groupBy: string | null;
};

export type ColDef = {
  key: string;
  label: string;
  defaultWidth: string;
  alwaysVisible?: boolean;
};

export type BulkEditField = {
  key: string;
  label: string;
  type: 'select' | 'boolean';
  options?: readonly string[];
};
