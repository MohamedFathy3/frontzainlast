import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SalesTrendPoint } from '@/hooks/useDashboardData';
import { formatDashboardAmount } from '@/components/dashboard/formatDashboardAmount';

interface SalesTrendChartProps {
  data?: SalesTrendPoint[];
  isLoading?: boolean;
  currencyCode: string;
}

const SalesTrendChart: React.FC<SalesTrendChartProps> = ({ data = [], isLoading = false, currencyCode }) => {
  const { language, t } = useLanguage();
  const monthNames = language === 'ar'
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const chartData = data.map((item) => {
    const [, month] = item.month.split('-');
    return { ...item, label: monthNames[Math.max(0, Number(month) - 1)] };
  });

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('dashboard.salesTrend')}</CardTitle>
        <p className="text-xs text-muted-foreground">{language === 'ar' ? 'المبيعات الفعلية خلال آخر ١٢ شهرًا' : 'Actual sales over the last 12 months'}</p>
      </CardHeader>
      <CardContent className="h-[300px] pt-2">
        {isLoading ? <Skeleton className="h-full w-full" /> : chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="dashboardSalesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatDashboardAmount(Number(value), currencyCode, language)} width={86} />
              <Tooltip formatter={(value: number) => [formatDashboardAmount(Number(value), currencyCode, language), language === 'ar' ? 'المبيعات الفعلية' : 'Actual sales']} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#dashboardSalesFill)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {language === 'ar' ? 'لا توجد بيانات مبيعات للفترة' : 'No sales data for this period'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesTrendChart;
