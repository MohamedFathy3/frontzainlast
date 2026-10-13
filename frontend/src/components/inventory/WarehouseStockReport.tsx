import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, History, Package, RefreshCw, Warehouse } from 'lucide-react';
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type WarehouseOption = {
  id: number;
  name: string;
  products_count: number;
  total_stock: number;
  stock_value: number;
};

type BalanceRow = {
  warehouse_id: number | null;
  warehouse_name: string;
  product_id: number;
  product_name: string;
  variant: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  unit_cost: number;
  stock_value: number;
};

type MovementRow = {
  type: string;
  id: number | string;
  movement_date: string;
  warehouse_id: number;
  warehouse_name?: string;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_cost: number;
  amount: number;
  reference: string | null;
  note: string | null;
};

type WarehouseReport = {
  summary: {
    warehouses_count: number;
    products_count: number;
    total_stock: number;
    stock_value: number;
  };
  warehouses: WarehouseOption[];
  balances: BalanceRow[];
  balance_meta: { current_page: number; last_page: number; total: number };
  movements: MovementRow[];
  movement_meta: { current_page: number; last_page: number; total: number };
  opening_balance_note: string;
  valuation_note: string;
};

const movementNames: Record<string, { ar: string; en: string }> = {
  purchase: { ar: 'مشتريات', en: 'Purchase' },
  purchase_return: { ar: 'مرتجع مشتريات', en: 'Purchase return' },
  sale: { ar: 'مبيعات', en: 'Sale' },
  sales_return: { ar: 'مرتجع مبيعات', en: 'Sales return' },
  pos_sale: { ar: 'بيع نقطة بيع (غير مرتبط بمخزن)', en: 'POS sale (unassigned)' },
  pos_return: { ar: 'مرتجع نقطة بيع (غير مرتبط بمخزن)', en: 'POS return (unassigned)' },
  adjustment: { ar: 'تسوية جرد', en: 'Inventory adjustment' },
  opening: { ar: 'رصيد أول المدة (محسوب)', en: 'Opening balance (estimated)' },
};

export default function WarehouseStockReport() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [warehouseId, setWarehouseId] = useState('all');
  const [search, setSearch] = useState('');
  const [movementType, setMovementType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<BalanceRow | null>(null);

  useEffect(() => {
    setPage(1);
    setMovementPage(1);
    setSelectedProduct(null);
  }, [warehouseId, search, movementType, dateFrom, dateTo]);

  const params = useMemo(() => ({
    warehouse_id: warehouseId === 'all' ? undefined : warehouseId,
    search: search.trim() || undefined,
    type: movementType,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    product_id: selectedProduct?.product_id,
    movement_warehouse_id: selectedProduct?.warehouse_id,
    page,
    movement_page: movementPage,
    per_page: 25,
  }), [warehouseId, search, movementType, dateFrom, dateTo, selectedProduct?.product_id, page, movementPage]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<WarehouseReport>({
    queryKey: ['warehouse-stock-report', params],
    queryFn: async () => {
      const response = await api.get('/inventory/warehouse-report', { params });
      if (response.data?.result !== 'Success') {
        throw new Error(response.data?.message || (isArabic ? 'تعذر تحميل تقرير المخزون' : 'Could not load the inventory report'));
      }
      return response.data.data;
    },
  });

  const number = (value: number) => new Intl.NumberFormat(isArabic ? 'ar-EG' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

  const typeName = (type: string) => movementNames[type]?.[isArabic ? 'ar' : 'en'] || type;

  const exportBalances = () => {
    const rows = data?.balances || [];
    const csv = [
      [isArabic ? 'المخزن' : 'Warehouse', isArabic ? 'المنتج' : 'Product', 'SKU', isArabic ? 'الرصيد' : 'Stock', isArabic ? 'تكلفة الوحدة' : 'Unit cost', isArabic ? 'قيمة الرصيد' : 'Stock value'],
      ...rows.map((row) => [row.warehouse_name, row.product_name, row.sku || '', row.stock, row.unit_cost, row.stock_value]),
    ].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `warehouse-stock-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const changeWarehouse = (value: string) => setWarehouseId(value);

  return (
    <div className="space-y-4" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{isArabic ? 'أرصدة وتكلفة المخازن' : 'Warehouse balances & valuation'}</h2>
          <p className="text-sm text-muted-foreground">
            {isArabic ? 'أرصدة المنتجات الحالية وسجل حركتها من المشتريات والمبيعات والمرتجعات والجرد.' : 'Current stock by warehouse and product movement history.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportBalances} disabled={!data?.balances.length}>
            <Download size={16} className="me-2" />
            {isArabic ? 'تصدير الصفحة' : 'Export page'}
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={16} className={`me-2 ${isFetching ? 'animate-spin' : ''}`} />
            {isArabic ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      {data && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="flex items-center gap-3 p-4">
            <Warehouse className="text-primary" size={22} />
            <div><p className="text-sm text-muted-foreground">{isArabic ? 'عدد المخازن' : 'Warehouses'}</p><p className="text-xl font-semibold">{number(data.summary.warehouses_count)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <Package className="text-primary" size={22} />
            <div><p className="text-sm text-muted-foreground">{isArabic ? 'أرصدة المنتجات بالمخازن' : 'Product balances'}</p><p className="text-xl font-semibold">{number(data.summary.products_count)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{isArabic ? 'إجمالي الكميات' : 'Total quantity'}</p><p className="text-xl font-semibold">{number(data.summary.total_stock)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{isArabic ? 'القيمة التقديرية للمخزون' : 'Estimated inventory value'}</p><p className="text-xl font-semibold">{number(data.summary.stock_value)}</p>
          </CardContent></Card>
        </div>
      )}
      {data && <p className="text-xs text-muted-foreground">{isArabic
        ? 'التكلفة تستخدم تكلفة رصيد المخزن، وعند عدم توفرها تستخدم تكلفة المنتج؛ لذلك القيمة تقديرية وليست تقييم FIFO تاريخيًا.'
        : data.valuation_note}</p>}

      {!!data?.warehouses.length && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.warehouses.map((warehouse) => (
            <Card key={warehouse.id} className="cursor-pointer transition-colors hover:border-primary/50" onClick={() => changeWarehouse(String(warehouse.id))}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{warehouse.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {number(warehouse.products_count)} {isArabic ? 'منتج' : 'products'} · {number(warehouse.total_stock)} {isArabic ? 'وحدة' : 'units'}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-xs text-muted-foreground">{isArabic ? 'قيمة المخزون' : 'Stock value'}</p>
                  <p className="font-semibold">{number(warehouse.stock_value)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={isArabic ? 'بحث باسم المنتج أو SKU أو الباركود' : 'Search product, SKU, or barcode'}
          />
          <Select value={warehouseId} onValueChange={changeWarehouse}>
            <SelectTrigger><SelectValue placeholder={isArabic ? 'كل المخازن' : 'All warehouses'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isArabic ? 'كل المخازن' : 'All warehouses'}</SelectItem>
              {(data?.warehouses || []).map((warehouse) => (
                <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label={isArabic ? 'من تاريخ' : 'From date'} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label={isArabic ? 'إلى تاريخ' : 'To date'} />
          <Select value={movementType} onValueChange={setMovementType}>
            <SelectTrigger><SelectValue placeholder={isArabic ? 'كل الحركات' : 'All movements'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isArabic ? 'كل الحركات' : 'All movements'}</SelectItem>
              {Object.entries(movementNames).map(([value, name]) => (
                <SelectItem key={value} value={value}>{name[isArabic ? 'ar' : 'en']}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">
            {(error as Error)?.message || (isArabic ? 'حدث خطأ أثناء تحميل التقرير.' : 'An error occurred while loading the report.')}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <h3 className="font-semibold">{isArabic ? 'أرصدة المنتجات حسب المخزن' : 'Product balances by warehouse'}</h3>
              <p className="text-xs text-muted-foreground">{isArabic ? 'اختر منتجًا لعرض حركاته.' : 'Select a product to see its movements.'}</p>
            </div>
            <span className="text-sm text-muted-foreground">{number(data?.balance_meta.total || 0)} {isArabic ? 'رصيد' : 'balances'}</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isArabic ? 'المخزن' : 'Warehouse'}</TableHead>
                <TableHead>{isArabic ? 'المنتج' : 'Product'}</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>{isArabic ? 'الرصيد' : 'Stock'}</TableHead>
                <TableHead>{isArabic ? 'تكلفة الوحدة' : 'Unit cost'}</TableHead>
                <TableHead>{isArabic ? 'قيمة الرصيد' : 'Stock value'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{isArabic ? 'جاري تحميل الأرصدة...' : 'Loading balances...'}</TableCell></TableRow>
              ) : !data?.balances.length ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{isArabic ? 'لا توجد أرصدة مطابقة للفلاتر.' : 'No balances match these filters.'}</TableCell></TableRow>
              ) : data.balances.map((row) => (
                <TableRow
                  key={`${row.warehouse_id}-${row.product_id}`}
                  onClick={() => { setSelectedProduct(row); setMovementPage(1); }}
                  className={`cursor-pointer ${selectedProduct?.warehouse_id === row.warehouse_id && selectedProduct.product_id === row.product_id ? 'bg-primary/5' : ''}`}
                >
                  <TableCell>{row.warehouse_name}</TableCell>
                  <TableCell className="font-medium">{row.product_name}</TableCell>
                  <TableCell>{row.sku || row.barcode || '-'}</TableCell>
                  <TableCell>{number(row.stock)}</TableCell>
                  <TableCell>{number(row.unit_cost)}</TableCell>
                  <TableCell className="font-semibold">{number(row.stock_value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-end gap-2 p-4">
            <Button size="sm" variant="outline" disabled={!data || page <= 1} onClick={() => setPage((current) => current - 1)}>
              {isArabic ? 'السابق' : 'Previous'}
            </Button>
            <span className="text-sm text-muted-foreground">
              {number(data?.balance_meta.current_page || 1)} / {number(data?.balance_meta.last_page || 1)}
            </span>
            <Button size="sm" variant="outline" disabled={!data || page >= data.balance_meta.last_page} onClick={() => setPage((current) => current + 1)}>
              {isArabic ? 'التالي' : 'Next'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedProduct && (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div className="flex items-center gap-2">
                <History size={18} className="text-primary" />
                <div>
                  <h3 className="font-semibold">{isArabic ? 'حركة المنتج:' : 'Product movement:'} {selectedProduct.product_name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedProduct.warehouse_name} · {selectedProduct.sku || selectedProduct.barcode || '-'}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}>{isArabic ? 'إغلاق' : 'Close'}</Button>
            </div>
            <div className="border-y bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              {isArabic
                ? 'رصيد أول المدة تقديري، محسوب من الرصيد الحالي مطروحًا منه الحركات المسجلة. عند تحديد تاريخ بداية، يعرض الرصيد قبل هذه الفترة. فواتير نقطة البيع القديمة لا تحتوي على مخزن مرتبط، لذلك تظهر كحركات غير مخصصة ولا تدخل في رصيد مخزن بعينه.'
                : data?.opening_balance_note}
            </div>
            {!data?.movements.length ? (
              <p className="p-8 text-center text-sm text-muted-foreground">{isArabic ? 'لا توجد حركات مسجلة لهذا المنتج.' : 'No recorded movements for this product.'}</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isArabic ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead>{isArabic ? 'المخزن' : 'Warehouse'}</TableHead>
                      <TableHead>{isArabic ? 'نوع الحركة' : 'Movement'}</TableHead>
                      <TableHead>{isArabic ? 'المقاس / اللون' : 'Size / color'}</TableHead>
                      <TableHead>{isArabic ? 'رقم المرجع' : 'Reference'}</TableHead>
                      <TableHead>{isArabic ? 'الكمية' : 'Quantity'}</TableHead>
                      <TableHead>{isArabic ? 'تكلفة الوحدة' : 'Unit cost'}</TableHead>
                      <TableHead>{isArabic ? 'قيمة الحركة' : 'Value'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.movements.map((movement) => (
                      <TableRow key={`${movement.type}-${movement.id}`}>
                        <TableCell>{movement.movement_date ? new Date(movement.movement_date).toLocaleString(isArabic ? 'ar-EG' : 'en-US') : '-'}</TableCell>
                        <TableCell>
                          {movement.warehouse_id
                            ? data.warehouses.find((warehouse) => warehouse.id === movement.warehouse_id)?.name || '-'
                            : isArabic ? 'نقطة بيع - بدون مخزن محدد' : 'POS - no warehouse assigned'}
                        </TableCell>
                        <TableCell>{typeName(movement.type)}</TableCell>
                        <TableCell>{movement.variant || '-'}</TableCell>
                        <TableCell>{movement.reference || '-'}</TableCell>
                        <TableCell className={movement.quantity < 0 ? 'text-destructive' : 'text-emerald-600'}>
                          {movement.quantity > 0 ? '+' : ''}{number(movement.quantity)}
                        </TableCell>
                        <TableCell>{number(movement.unit_cost)}</TableCell>
                        <TableCell>{number(movement.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-end gap-2 p-4">
                  <Button size="sm" variant="outline" disabled={movementPage <= 1} onClick={() => setMovementPage((current) => current - 1)}>
                    {isArabic ? 'السابق' : 'Previous'}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {number(data.movement_meta.current_page)} / {number(data.movement_meta.last_page)}
                  </span>
                  <Button size="sm" variant="outline" disabled={movementPage >= data.movement_meta.last_page} onClick={() => setMovementPage((current) => current + 1)}>
                    {isArabic ? 'التالي' : 'Next'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
