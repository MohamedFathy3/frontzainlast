import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { AlertTriangle, Bell, BellOff, CheckCircle, Package, RefreshCw, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

type SystemAlert = {
  id: string;
  category: 'low_stock' | 'out_of_stock' | 'overdue_payable' | string;
  type: 'warning' | 'error' | string;
  title: string;
  title_en: string;
  message: string;
  message_en: string;
  product_name: string | null;
  sku: string | null;
  barcode: string | null;
  warehouse_name: string | null;
  current_quantity: number;
  threshold_quantity: number;
  reference_type: string;
  reference_id: number;
  created_at: string;
};

type AlertStatuses = Record<string, { read?: boolean; resolved?: boolean }>;
const STORAGE_KEY = 'system-alert-status-v1';

const readStatuses = (): AlertStatuses => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as AlertStatuses;
  } catch {
    return {};
  }
};

const LowStockAlerts = () => {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [showResolved, setShowResolved] = useState(false);
  const [statuses, setStatuses] = useState<AlertStatuses>(readStatuses);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  }, [statuses]);

  const { data: alerts = [], isLoading, isFetching, isError, error, refetch } = useQuery<SystemAlert[]>({
    queryKey: ['system-alerts'],
    queryFn: async () => {
      const response = await api.get('/system/alerts', { params: { limit: 300 } });
      if (response.data?.result !== 'Success') {
        throw new Error(response.data?.message || (isArabic ? 'تعذر تحميل التنبيهات' : 'Could not load alerts'));
      }
      return response.data.data || [];
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const visibleAlerts = useMemo(() => alerts.filter((alert) => showResolved || !statuses[alert.id]?.resolved), [alerts, showResolved, statuses]);
  const unreadCount = alerts.filter((alert) => !statuses[alert.id]?.read && !statuses[alert.id]?.resolved).length;
  const totalCount = visibleAlerts.length;

  const text = {
    title: isArabic ? 'تنبيهات النظام' : 'System alerts',
    description: isArabic ? 'تنبيهات مباشرة من المخزون والفواتير والعمليات المهمة.' : 'Live alerts from inventory, invoices, and important operations.',
    product: isArabic ? 'المنتج / الجهة' : 'Product / party',
    sku: isArabic ? 'رمز / رقم المستند' : 'SKU / reference',
    stock: isArabic ? 'الرصيد الحالي' : 'Current balance',
    threshold: isArabic ? 'حد التنبيه' : 'Alert threshold',
    type: isArabic ? 'النوع' : 'Type',
    date: isArabic ? 'تاريخ الإنشاء' : 'Created at',
    status: isArabic ? 'الحالة' : 'Status',
    actions: isArabic ? 'الإجراءات' : 'Actions',
    unread: isArabic ? 'تنبيهات غير مقروءة' : 'Unread alerts',
    total: isArabic ? 'إجمالي التنبيهات' : 'Total alerts',
    showResolved: isArabic ? 'إظهار التنبيهات المخفية' : 'Show dismissed alerts',
    refresh: isArabic ? 'تحديث' : 'Refresh',
    noAlerts: isArabic ? 'لا توجد تنبيهات حالية' : 'No current alerts',
    loading: isArabic ? 'جاري تحميل التنبيهات...' : 'Loading alerts...',
    error: isArabic ? 'تعذر تحميل تنبيهات النظام.' : 'Could not load system alerts.',
    markRead: isArabic ? 'مقروء' : 'Mark read',
    dismiss: isArabic ? 'إخفاء' : 'Dismiss',
    read: isArabic ? 'مقروء' : 'Read',
    unreadStatus: isArabic ? 'غير مقروء' : 'Unread',
    dismissed: isArabic ? 'مخفي' : 'Dismissed',
    low: isArabic ? 'مخزون منخفض' : 'Low stock',
    out: isArabic ? 'نفاد المخزون' : 'Out of stock',
    due: isArabic ? 'فاتورة مورد متأخرة' : 'Overdue supplier invoice',
    unit: isArabic ? 'وحدة' : 'units',
    currency: isArabic ? 'جنيه' : 'EGP',
  };

  const categoryLabel = (category: string) => {
    if (category === 'low_stock') return text.low;
    if (category === 'out_of_stock') return text.out;
    if (category === 'overdue_payable') return text.due;
    return category;
  };

  const setRead = (id: string) => setStatuses((current) => ({ ...current, [id]: { ...current[id], read: true } }));
  const dismiss = (id: string) => setStatuses((current) => ({ ...current, [id]: { ...current[id], read: true, resolved: true } }));

  return (
    <div className="space-y-6" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2"><AlertTriangle className="text-amber-600" size={24} /></div>
          <div>
            <h2 className="text-xl font-bold">{text.title}</h2>
            <p className="text-sm text-muted-foreground">{text.description}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={16} className={`me-2 ${isFetching ? 'animate-spin' : ''}`} />{text.refresh}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-red-500/10 p-2"><BellOff className="text-red-500" size={20} /></div>
          <div><p className="text-sm text-muted-foreground">{text.unread}</p><p className="text-2xl font-bold">{unreadCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-amber-500/10 p-2"><Bell className="text-amber-600" size={20} /></div>
          <div><p className="text-sm text-muted-foreground">{text.total}</p><p className="text-2xl font-bold">{totalCount}</p></div>
        </CardContent></Card>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={showResolved} onCheckedChange={(checked) => setShowResolved(checked === true)} />{text.showResolved}
      </label>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2"><AlertTriangle size={18} />{text.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isError && <div className="p-4 text-sm text-destructive">{(error as Error)?.message || text.error}</div>}
          <ScrollArea className="h-[min(60vh,620px)] w-full">
            <div className="min-w-[1050px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>{text.product}</TableHead><TableHead>{text.sku}</TableHead>
                    <TableHead>{text.stock}</TableHead><TableHead>{text.threshold}</TableHead>
                    <TableHead>{text.type}</TableHead><TableHead>{text.date}</TableHead>
                    <TableHead>{text.status}</TableHead><TableHead>{text.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">{text.loading}</TableCell></TableRow>
                  ) : visibleAlerts.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground"><CheckCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />{text.noAlerts}</TableCell></TableRow>
                  ) : visibleAlerts.map((alert) => {
                    const status = statuses[alert.id];
                    const isResolved = Boolean(status?.resolved);
                    const isRead = Boolean(status?.read);
                    const quantity = Number(alert.current_quantity || 0);
                    const isPayable = alert.category === 'overdue_payable';
                    return (
                      <TableRow key={alert.id} className={!isRead && !isResolved ? 'bg-amber-500/5' : ''}>
                        <TableCell className="max-w-[260px] font-medium">
                          <div className="truncate">{isArabic ? alert.product_name : alert.product_name}</div>
                          {alert.warehouse_name && <div className="text-xs text-muted-foreground">{alert.warehouse_name}</div>}
                          {alert.barcode && <div className="font-mono text-xs text-muted-foreground">{alert.barcode}</div>}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">{alert.sku || '-'}</TableCell>
                        <TableCell className="font-semibold">{quantity.toLocaleString(isArabic ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 })} {isPayable ? text.currency : text.unit}</TableCell>
                        <TableCell>{isPayable ? '-' : Number(alert.threshold_quantity || 0)}</TableCell>
                        <TableCell><Badge variant={alert.type === 'error' ? 'destructive' : 'secondary'} className="gap-1">{alert.category === 'out_of_stock' ? <XCircle size={12} /> : <Package size={12} />}{categoryLabel(alert.category)}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(alert.created_at)}</TableCell>
                        <TableCell><Badge variant={isResolved ? 'outline' : isRead ? 'secondary' : 'destructive'}>{isResolved ? text.dismissed : isRead ? text.read : text.unreadStatus}</Badge></TableCell>
                        <TableCell><div className="flex items-center gap-1">
                          {!isRead && !isResolved && <Button variant="ghost" size="sm" onClick={() => setRead(alert.id)}>{text.markRead}</Button>}
                          {!isResolved && <Button variant="ghost" size="sm" onClick={() => dismiss(alert.id)}>{text.dismiss}</Button>}
                        </div></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default LowStockAlerts;
