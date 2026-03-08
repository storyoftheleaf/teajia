import { CostCurrency } from '../../types';

// Currency auto-detection mapping from supplier location
export const CURRENCY_BY_LOCATION = {
  'China': 'CNY' as CostCurrency,
  'Taiwan': 'TWD' as CostCurrency,
  'Hong Kong': 'HKD' as CostCurrency,
  'Indonesia': 'IDR' as CostCurrency,
  'Japan': 'JPY' as CostCurrency,
  'Malaysia': 'MYR' as CostCurrency,
};

export const SUPPLIER_LOCATIONS = ['China', 'Taiwan', 'Hong Kong', 'Indonesia', 'Japan', 'Malaysia'] as const;
