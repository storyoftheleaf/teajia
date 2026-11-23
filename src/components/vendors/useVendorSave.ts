import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

/**
 * Save part of a vendor (a customers row) and refresh every view of them: the
 * vendor page, the people and supplier lists, and the vendor pickers.
 */
export function useVendorSave(vendorId: string) {
  const queryClient = useQueryClient();
  return async (patch: Record<string, unknown>) => {
    await api.customers.update(vendorId, patch);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] }),
      queryClient.invalidateQueries({ queryKey: ['customers'] }),
    ]);
  };
}
