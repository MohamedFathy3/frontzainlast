import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/contexts/AppContext';
import api from '@/lib/api';

export interface DashboardMetrics {
  todaySales: number;
  salesChange: number | undefined;
  monthSales: number;
  monthOrders: number;
  monthExpenses: number;
  lowStockCount: number;
  averageOrderValue: number;
}

export interface SalesTrendPoint {
  month: string;
  revenue: number;
}

export interface CategoryPerformance {
  category_id: number;
  category_name: string;
  total_quantity: number;
  total_revenue: number;
}

export interface BranchRevenue {
  branch_id: number;
  branch_name: string;
  branch_name_ar?: string | null;
  revenue: number;
}

export interface RecentTransaction {
  id: string;
  type: 'sale' | 'purchase';
  invoice_number: string;
  party_name: string;
  branch_name: string;
  branch_name_ar?: string | null;
  payment_method: string | null;
  total_amount: number;
  created_at: string;
}

interface DashboardOverviewResponse {
  result: string;
  data: {
    currency_code: string;
    currency_symbol?: string;
    metrics: {
      today_sales: number;
      yesterday_sales: number;
      sales_change_percent: number | null;
      month_sales: number;
      month_orders: number;
      month_expenses: number;
      average_order_value: number;
      low_stock_count: number;
    };
    sales_trend: SalesTrendPoint[];
    top_categories: CategoryPerformance[];
    branch_revenues: BranchRevenue[];
    recent_transactions: RecentTransaction[];
  };
}

export const useDashboardData = () => {
  const { currentBranch } = useApp();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-overview', currentBranch?.id ?? 'all'],
    queryFn: async () => {
      const response = await api.get<DashboardOverviewResponse>('/dashboard/overview', {
        params: currentBranch?.id ? { branch_id: currentBranch.id } : {},
      });
      if (response.data?.result !== 'Success' || !response.data.data) {
        throw new Error(response.data?.result || 'Dashboard data could not be loaded');
      }
      return response.data.data;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const apiMetrics = data?.metrics;
  const dashboardMetrics: DashboardMetrics = {
    todaySales: Number(apiMetrics?.today_sales ?? 0),
    salesChange: apiMetrics?.sales_change_percent == null ? undefined : Number(apiMetrics.sales_change_percent),
    monthSales: Number(apiMetrics?.month_sales ?? 0),
    monthOrders: Number(apiMetrics?.month_orders ?? 0),
    monthExpenses: Number(apiMetrics?.month_expenses ?? 0),
    lowStockCount: Number(apiMetrics?.low_stock_count ?? 0),
    averageOrderValue: Number(apiMetrics?.average_order_value ?? 0),
  };

  return {
    dashboardMetrics,
    salesTrend: data?.sales_trend ?? [],
    topCategories: data?.top_categories ?? [],
    branchRevenues: data?.branch_revenues ?? [],
    recentTransactions: data?.recent_transactions ?? [],
    currencyCode: data?.currency_code ?? 'EGP',
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  };
};
