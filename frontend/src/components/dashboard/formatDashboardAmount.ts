export const formatDashboardAmount = (amount: number, currencyCode: string, language: string): string => {
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: currencyCode || 'EGP',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    const symbol = currencyCode || 'EGP';
    return language === 'ar'
      ? `${value.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ${symbol}`
      : `${symbol} ${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
};
