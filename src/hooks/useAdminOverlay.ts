import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useProducts } from '../admin/hooks/useAdminData';
import { api } from '../lib/api';
import type { Product } from '../admin/types';

export interface AdminStats {
  pendingOrders: number;
  lowStockItems: number;
  lowStockProducts: Product[];
  totalProducts: number;
  activeProducts: number;
  revenueThisWeek: number;
}

export function useAdminOverlay() {
  const { isAdmin, isAuthenticated } = useAuth();
  const enabled = isAdmin && isAuthenticated;

  const { data: products = [], refetch: refetchProducts } = useProducts();
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.invoices.list(100),
    enabled,
  });

  const productMap = useMemo(() => {
    if (!enabled) return new Map<string, Product>();
    const map = new Map<string, Product>();
    products.forEach((p: Product) => map.set(p.id, p));
    return map;
  }, [products, enabled]);

  const stats = useMemo<AdminStats>(() => {
    if (!enabled) {
      return { pendingOrders: 0, lowStockItems: 0, lowStockProducts: [], totalProducts: 0, activeProducts: 0, revenueThisWeek: 0 };
    }

    const lowStock = products.filter((p: Product) => p.status === 'Active' && p.stockGrams > 0 && p.stockGrams < (p.lowStockThreshold || 100));
    const active = products.filter((p: Product) => p.status === 'Active');

    // Pending orders
    const pending = Array.isArray(invoices)
      ? invoices.filter((inv: any) => inv.status === 'Pending').length
      : 0;

    // Revenue this week (filled invoices in last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const revenue = Array.isArray(invoices)
      ? invoices
          .filter((inv: any) => inv.status === 'Filled' && new Date(inv.updated_at || inv.created_at).getTime() > weekAgo)
          .reduce((sum: number, inv: any) => sum + (Number(inv.total_usd) || 0), 0)
      : 0;

    return {
      pendingOrders: pending,
      lowStockItems: lowStock.length,
      lowStockProducts: lowStock,
      totalProducts: products.length,
      activeProducts: active.length,
      revenueThisWeek: revenue,
    };
  }, [products, invoices, enabled]);

  const updateProduct = async (id: string, data: Record<string, any>) => {
    await api.products.updateByDomain(id, data);
    refetchProducts();
  };

  return {
    isAdmin: enabled,
    products: enabled ? products : [],
    productMap,
    stats,
    invoices: enabled ? invoices : [],
    updateProduct,
    refetchProducts,
  };
}
