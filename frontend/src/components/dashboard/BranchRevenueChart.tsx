import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { BranchRevenue } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDashboardAmount } from '@/components/dashboard/formatDashboardAmount';

interface BranchRevenueChartProps {
  branches?: BranchRevenue[];
  isLoading?: boolean;
  currencyCode: string;
}

const BranchRevenueChart: React.FC<BranchRevenueChartProps> = ({ branches = [], isLoading = false, currencyCode }) => {
  const { language, t } = useLanguage();
  const data = branches.map((branch) => ({
    name: language === 'ar' ? branch.branch_name_ar || branch.branch_name : branch.branch_name,
    revenue: Number(branch.revenue) || 0,
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('dashboard.branchRevenue')}</CardTitle>
        <p className="text-xs text-muted-foreground">{language === 'ar' ? 'مبيعات الشهر الفعلية' : 'Actual sales this month'}</p>
      </CardHeader>
      <CardContent className="h-[300px] pt-2">
        {isLoading ? <Skeleton className="h-full w-full" /> : data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => formatDashboardAmount(Number(value), currencyCode, language)} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [formatDashboardAmount(Number(value), currencyCode, language), language === 'ar' ? 'المبيعات' : 'Sales']} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 5, 5, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {language === 'ar' ? 'لا توجد مبيعات مرتبطة بفروع خلال الشهر' : 'No branch-linked sales this month'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BranchRevenueChart;
