// pages/Dashboard.tsx
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DashboardKPIs from '@/components/dashboard/DashboardKPIs';
import QuickAccessGrid from '@/components/dashboard/QuickAccessGrid';
import SalesTrendChart from '@/components/dashboard/SalesTrendChart';
import CategoryPerformanceChart from '@/components/dashboard/CategoryPerformanceChart';
import BranchRevenueChart from '@/components/dashboard/BranchRevenueChart';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import { useDashboardData } from '@/hooks/useDashboardData';

const Dashboard: React.FC = () => {
  const { language } = useLanguage();
  const { 
    dashboardMetrics,
    recentTransactions,
    salesTrend,
    topCategories,
    branchRevenues,
    currencyCode,
    isLoading,
    isError,
    error,
    refetch,
  } = useDashboardData();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return language === 'ar' ? 'صباح الخير' : 'Good Morning';
    if (hour < 18) return language === 'ar' ? 'مساء الخير' : 'Good Afternoon';
    return language === 'ar' ? 'مساء الخير' : 'Good Evening';
  };

  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Welcome Header */}
        <DashboardHeader greeting={getGreeting()} />

        {/* Quick Access */}
        <QuickAccessGrid />

        {/* KPI Cards */}
        <DashboardKPIs metrics={dashboardMetrics} isLoading={isLoading} currencyCode={currencyCode} isError={isError} />

        {isError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>{language === 'ar' ? 'تعذر تحميل بيانات لوحة المعلومات من الخادم.' : 'Dashboard data could not be loaded from the server.'} {error instanceof Error ? error.message : ''}</span>
            <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-4">
              {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        )}
        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <SalesTrendChart data={salesTrend} isLoading={isLoading} currencyCode={currencyCode} />
          </div>
          <div>
            <CategoryPerformanceChart categories={topCategories} isLoading={isLoading} currencyCode={currencyCode} />
          </div>
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BranchRevenueChart branches={branchRevenues} isLoading={isLoading} currencyCode={currencyCode} />
          <RecentTransactions transactions={recentTransactions} isLoading={isLoading} currencyCode={currencyCode} />
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
