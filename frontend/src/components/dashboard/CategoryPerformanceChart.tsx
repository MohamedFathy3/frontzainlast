import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryPerformance } from '@/hooks/useDashboardData';
import { formatDashboardAmount } from '@/components/dashboard/formatDashboardAmount';

interface CategoryPerformanceChartProps {
  categories?: CategoryPerformance[];
  isLoading?: boolean;
  currencyCode: string;
}

const CategoryPerformanceChart: React.FC<CategoryPerformanceChartProps> = ({ categories = [], isLoading = false, currencyCode }) => {
  const { language, t } = useLanguage();
  const data = categories
    .filter((item) => item && item.category_name)
    .map((item) => ({
      name: item.category_name,
      revenue: Number(item.total_revenue) || 0,
      quantity: Number(item.total_quantity) || 0,
    }))
    .filter((item) => item.revenue > 0 || item.quantity > 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('dashboard.categoryPerformance')}</CardTitle>
        <p className="text-xs text-muted-foreground">{language === 'ar' ? 'مبيعات الشهر حسب التصنيف' : 'Current-month sales by category'}</p>
      </CardHeader>
      <CardContent className="h-[300px] pt-2">
        {isLoading ? <Skeleton className="h-full w-full" /> : data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => formatDashboardAmount(Number(value), currencyCode, language)} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [formatDashboardAmount(Number(value), currencyCode, language), language === 'ar' ? 'قيمة المبيعات' : 'Sales']} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 5, 5, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <span>{language === 'ar' ? 'لا توجد مبيعات مصنفة هذا الشهر' : 'No categorized sales this month'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CategoryPerformanceChart;
