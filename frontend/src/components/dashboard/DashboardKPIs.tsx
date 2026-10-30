import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import KPICard from '@/components/dashboard/KPICard';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardMetrics } from '@/hooks/useDashboardData';
import { formatDashboardAmount } from '@/components/dashboard/formatDashboardAmount';
import { ArrowDownToLine, Boxes, ShoppingCart, TrendingUp, Wallet } from 'lucide-react';

interface DashboardKPIsProps {
  metrics: DashboardMetrics;
  isLoading: boolean;
  currencyCode: string;
  isError?: boolean;
}

const DashboardKPIs: React.FC<DashboardKPIsProps> = ({ metrics, isLoading, currencyCode, isError = false }) => {
  const { language } = useLanguage();
  const labels = language === 'ar' ? {
    today: 'مبيعات اليوم',
    compared: 'مقارنة بالأمس',
    month: 'مبيعات الشهر',
    monthCaption: 'من بداية الشهر حتى الآن',
    expenses: 'مصروفات الشهر',
    expensesCaption: 'مصروفات مسجلة',
    orders: 'فواتير البيع',
    ordersCaption: 'هذا الشهر',
    lowStock: 'مخزون منخفض / نافد',
    stockCaption: 'منتج في مخازن الفرع المحدد',
  } : {
    today: "Today's sales",
    compared: 'vs yesterday',
    month: 'Sales this month',
    monthCaption: 'Month to date',
    expenses: 'Expenses this month',
    expensesCaption: 'Recorded expenses',
    orders: 'Sales invoices',
    ordersCaption: 'This month',
    lowStock: 'Low / out of stock',
    stockCaption: 'Product balances at selected branch',
  };

  if (isLoading) {
    return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {[1, 2, 3, 4, 5].map((item) => <Card key={item} className="p-4"><Skeleton className="mb-3 h-4 w-28" /><Skeleton className="mb-2 h-8 w-36" /><Skeleton className="h-3 w-24" /></Card>)}
    </div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KPICard title={labels.today} value={isError ? '—' : formatDashboardAmount(metrics.todaySales, currencyCode, language)} change={isError ? undefined : metrics.salesChange} changeLabel={labels.compared} icon={<Wallet size={20} />} variant="success" />
      <KPICard title={labels.month} value={isError ? '—' : formatDashboardAmount(metrics.monthSales, currencyCode, language)} subtitle={labels.monthCaption} icon={<TrendingUp size={20} />} variant="primary" />
      <KPICard title={labels.expenses} value={isError ? '—' : formatDashboardAmount(metrics.monthExpenses, currencyCode, language)} subtitle={labels.expensesCaption} icon={<ArrowDownToLine size={20} />} />
      <KPICard title={labels.orders} value={isError ? '—' : metrics.monthOrders} subtitle={labels.ordersCaption} icon={<ShoppingCart size={20} />} />
      <KPICard title={labels.lowStock} value={isError ? '—' : metrics.lowStockCount} subtitle={labels.stockCaption} icon={<Boxes size={20} />} variant={metrics.lowStockCount ? 'warning' : 'default'} />
    </div>
  );
};

export default DashboardKPIs;
