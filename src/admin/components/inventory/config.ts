import type React from 'react';
import {
  AlertTriangle,
  Archive,
  CheckSquare,
  Coffee,
  Droplets,
  EyeOff,
  FlaskConical,
  Globe,
  PackageX,
} from 'lucide-react';
import type { BulkEditField, ColDef, InventoryViewConfig } from './types';

export const VIEW_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  AlertTriangle,
  EyeOff,
  CheckSquare,
  FlaskConical,
  Archive,
  Coffee,
  Globe,
  Droplets,
  PackageX,
};

export const VIEW_FILTER_LABELS: Record<string, string> = {
  All: 'All',
  Working: 'Working',
  ForSale: 'Selling',
  Alerts: 'Alerts',
  Unpublished: 'Hidden',
  Unverified: 'Verify',
  Samples: 'Samples',
  Personal: 'Personal',
  Archived: 'Archived',
  SoldOut: 'Sold',
  Untasted: 'Untasted',
  NeedsDevelopment: 'Needs development',
  ToTaste: 'To taste',
  Reorder: 'Reorder',
  LowStock: 'Low stock',
  MissingLocation: 'Missing location',
};

export const TEA_COLUMN_DEFS = [
  { key: 'productName', label: 'Product', defaultWidth: 'w-[26%]', alwaysVisible: true },
  { key: 'type', label: 'Type', defaultWidth: 'w-[11%]' },
  { key: 'year', label: 'Year', defaultWidth: 'w-[9%]' },
  { key: 'originRegion', label: 'Origin', defaultWidth: 'w-[14%]' },
  { key: 'stockGrams', label: 'Stock', defaultWidth: 'w-[9%]' },
  { key: 'verified', label: 'Verified', defaultWidth: 'w-[7%]' },
  { key: 'costAmount', label: 'Cost', defaultWidth: 'w-[8%]' },
  { key: 'costPerGramUSD', label: 'Cost/g', defaultWidth: 'w-[8%]' },
  { key: 'pricePerGramUSD', label: 'Retail', defaultWidth: 'w-[8%]' },
  { key: 'vendor', label: 'Source', defaultWidth: 'w-[12%]' },
  { key: 'form', label: 'Leaf', defaultWidth: 'w-[10%]' },
] as const satisfies readonly ColDef[];

// On a phone the default All view scrolls sideways, so column ORDER is what the
// eye meets first as it swipes. Adrian's priority for that first read:
// Product (pinned) → Year → Type → Stock → Cost → Source → Origin. This order is
// applied ONLY to the mobile swipe table for the All view; desktop keeps the
// TEA_COLUMN_DEFS order above. Keys not listed here fall back to their natural
// position after these.
export const MOBILE_TEA_ALL_ORDER: readonly string[] = [
  'productName', 'stockGrams', 'pricePerGramUSD', 'type', 'costAmount', 'vendor', 'originRegion', 'form', 'year',
];

export const TEAWARE_COLUMN_DEFS = [
  { key: 'productName', label: 'Product', defaultWidth: 'w-[28%]', alwaysVisible: true },
  { key: 'teawareCategory', label: 'Category', defaultWidth: 'w-[12%]' },
  { key: 'material', label: 'Material', defaultWidth: 'w-[14%]' },
  { key: 'capacityMl', label: 'Capacity', defaultWidth: 'w-[10%]' },
  { key: 'quantityUnits', label: 'Units', defaultWidth: 'w-[8%]' },
  { key: 'verified', label: 'Verified', defaultWidth: 'w-[7%]' },
  { key: 'costAmount', label: 'Cost', defaultWidth: 'w-[10%]' },
  { key: 'pricePerGramUSD', label: 'Retail', defaultWidth: 'w-[8%]' },
] as const satisfies readonly ColDef[];

export const GROUPBY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'type', label: 'Type' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'status', label: 'Status' },
  { value: 'originCountry', label: 'Origin Country' },
  { value: 'ownerUserId', label: 'Owner' }, // stock spine step 2 — group by whose stock it is
] as const;

export const DEFAULT_TEA_VIEWS: InventoryViewConfig[] = [
  {
    id: 'default-all',
    name: 'All',
    icon: null,
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount', 'pricePerGramUSD', 'vendor', 'form'],
    sortConfig: [{ key: 'type', direction: 'asc' }],
    filterType: 'All',
    groupBy: null,
  },
  {
    id: 'default-forsale',
    name: 'Working',
    icon: 'Globe',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'pricePerGramUSD'],
    sortConfig: [{ key: 'stockGrams', direction: 'asc' }],
    filterType: 'Working',
    groupBy: null,
  },
  {
    id: 'default-low-stock',
    name: 'Needs development',
    icon: 'AlertTriangle',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount', 'pricePerGramUSD'],
    sortConfig: [{ key: 'stockGrams', direction: 'asc' }],
    filterType: 'NeedsDevelopment',
    groupBy: null,
  },
  {
    id: 'default-to-taste',
    name: 'To taste',
    icon: 'Droplets',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'vendor'],
    sortConfig: [{ key: 'type', direction: 'asc' }],
    filterType: 'ToTaste',
    groupBy: null,
  },
  {
    id: 'default-reorder',
    name: 'Reorder',
    icon: 'PackageX',
    columns: ['productName', 'type', 'stockGrams', 'vendor', 'costAmount'],
    sortConfig: [{ key: 'stockGrams', direction: 'asc' }],
    filterType: 'Reorder',
    groupBy: null,
  },
  {
    id: 'default-low-stock-action',
    name: 'Low stock',
    icon: 'AlertTriangle',
    columns: ['productName', 'type', 'stockGrams', 'lowStockThreshold', 'vendor'],
    sortConfig: [{ key: 'stockGrams', direction: 'asc' }],
    filterType: 'LowStock',
    groupBy: null,
  },
  {
    id: 'default-missing-location',
    name: 'Missing location',
    icon: 'Archive',
    columns: ['productName', 'type', 'stockGrams', 'vendor'],
    sortConfig: [{ key: 'type', direction: 'asc' }],
    filterType: 'MissingLocation',
    groupBy: null,
  },
  {
    id: 'default-unpublished',
    name: 'Hidden',
    icon: 'EyeOff',
    columns: ['productName', 'type', 'stockGrams', 'pricePerGramUSD'],
    sortConfig: [{ key: 'type', direction: 'asc' }],
    filterType: 'Unpublished',
    groupBy: null,
  },
  {
    id: 'default-stock-check',
    name: 'Verify',
    icon: 'CheckSquare',
    columns: ['productName', 'type', 'stockGrams', 'verified'],
    sortConfig: [{ key: 'stockGrams', direction: 'asc' }],
    filterType: 'Unverified',
    groupBy: null,
  },
  {
    id: 'default-samples',
    name: 'Samples',
    icon: 'FlaskConical',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount'],
    sortConfig: [{ key: 'year', direction: 'desc' }],
    filterType: 'Samples',
    groupBy: null,
  },
  {
    id: 'default-personal',
    name: 'Personal',
    icon: 'Coffee',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount'],
    sortConfig: [{ key: 'year', direction: 'desc' }],
    filterType: 'Personal',
    groupBy: null,
  },
  {
    id: 'default-untasted',
    name: 'Untasted',
    icon: 'Droplets',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'pricePerGramUSD'],
    sortConfig: [{ key: 'type', direction: 'asc' }],
    filterType: 'Untasted',
    groupBy: null,
  },
  {
    id: 'default-archived',
    name: 'Archived',
    icon: 'Archive',
    columns: ['productName', 'type', 'year', 'originRegion', 'stockGrams', 'costAmount'],
    sortConfig: [{ key: 'type', direction: 'asc' }],
    filterType: 'Archived',
    groupBy: null,
  },
  {
    id: 'default-soldout',
    name: 'Sold',
    icon: 'PackageX',
    columns: ['productName', 'type', 'year', 'originRegion', 'vendor', 'pricePerGramUSD'],
    sortConfig: [{ key: 'type', direction: 'asc' }],
    filterType: 'SoldOut',
    groupBy: null,
  },
];

export const DEFAULT_TEAWARE_VIEWS: InventoryViewConfig[] = [
  {
    id: 'default-teaware-all',
    name: 'All',
    columns: ['productName', 'teawareCategory', 'material', 'capacityMl', 'quantityUnits', 'costAmount', 'pricePerGramUSD'],
    sortConfig: [{ key: 'teawareCategory', direction: 'asc' }],
    filterType: 'All',
    groupBy: null,
  },
  {
    id: 'default-teaware-unpublished',
    name: 'Hidden',
    columns: ['productName', 'teawareCategory', 'material', 'costAmount', 'pricePerGramUSD'],
    sortConfig: [{ key: 'teawareCategory', direction: 'asc' }],
    filterType: 'Unpublished',
    groupBy: null,
  },
  {
    id: 'default-teaware-archived',
    name: 'Archived',
    columns: ['productName', 'teawareCategory', 'material', 'costAmount', 'pricePerGramUSD'],
    sortConfig: [{ key: 'teawareCategory', direction: 'asc' }],
    filterType: 'Archived',
    groupBy: null,
  },
];

export const TYPE_OPTIONS = ['Green', 'Yellow', 'White', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Teaware', 'Misc'] as const;

export const BULK_EDIT_FIELDS: readonly BulkEditField[] = [
  { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Archived', 'Sold Out', 'Draft'] },
  { key: 'isPublic', label: 'Public', type: 'boolean' },
  { key: 'isFeatured', label: 'Featured', type: 'boolean' },
  { key: 'isPersonal', label: 'Personal', type: 'boolean' },
  { key: 'canReorder', label: 'Can Reorder', type: 'boolean' },
];
