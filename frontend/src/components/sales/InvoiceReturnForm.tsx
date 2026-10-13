/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sales/InvoiceReturnForm.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRegionalSettings } from "@/contexts/RegionalSettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Save, Loader2, RotateCcw, ArrowLeftRight, X, Building2 } from "lucide-react";
import api from "@/lib/api";

interface ReturnItem {
  id: string;
  sales_invoice_item_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  product_unit_id: number | null;
  unit_name: string | null;
  color_id: number | null;
  color_name: string | null;
  sold_quantity: number;
  quantity: number;
  price: number;
  reason: string;
}

interface Treasury {
  id: number;
  name: string;
  balance: number;
  currency: string;
  branch_id?: number;
}

interface InvoiceReturnFormProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceData?: any;
}

const InvoiceReturnForm = ({ isOpen, onClose, invoiceData }: InvoiceReturnFormProps) => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const { formatCurrency } = useRegionalSettings();
  
  // ========== State ==========
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [formData, setFormData] = useState({
    sales_invoice_id: "",
    return_method: "cash",
    note: "",
    treasury_id: "" // ✅ أضفنا treasury_id
  });
  const [returnNumber, setReturnNumber] = useState<string>("");

  // ========== Generate Return Number ==========
  useEffect(() => {
    if (isOpen) {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const random = Math.floor(Math.random() * 9000 + 1000);
      setReturnNumber(`RET-${year}${month}${day}-${random}`);
    }
  }, [isOpen]);

  // ========== جلب الخزائن ==========
  const { data: treasuries = [], isLoading: loadingTreasuries } = useQuery({
    queryKey: ['treasuries-form'],
    queryFn: async () => {
      try {
        const response = await api.post('/treasury/index', {
          filters: {},
          orderBy: 'id',
          orderByDirection: 'asc',
          perPage: 100,
          paginate: false
        });
        
        if (response.data.result === 'Success') {
          return response.data.data || [];
        }
        return [];
      } catch (error) {
        console.error('Error fetching treasuries:', error);
        return [];
      }
    },
    enabled: isOpen
  });

  const returnAvailabilityQuery = useQuery({
    queryKey: ['sales-return-availability', invoiceData?.id],
    queryFn: async () => {
      const response = await api.post('/sales-return/index', {
        filters: { sales_invoice_id: invoiceData.id },
        orderBy: 'id',
        orderByDirection: 'asc',
        perPage: 1000,
        paginate: false
      });
      if (response.data.result !== 'Success') {
        throw new Error(response.data.message || 'Failed to load existing returns');
      }
      return response.data.data || [];
    },
    enabled: isOpen && Boolean(invoiceData?.id)
  });

  // ========== Load Invoice Data ==========
  useEffect(() => {
    if (isOpen && invoiceData) {
      // ✅ حط رقم الفاتورة و treasury_id من الفاتورة
      setFormData(prev => ({
        ...prev,
        sales_invoice_id: invoiceData.id,
        treasury_id: invoiceData.treasury_id || ""
      }));
      
      // ✅ حول الأصناف من الفاتورة
      if (invoiceData.items?.length > 0) {
        const returnItems = invoiceData.items.map((item: any) => ({
          id: crypto.randomUUID(),
          sales_invoice_item_id: Number(item.id),
          product_id: item.product_id,
          product_name: item.product_name,
          sku: item.sku || '',
          product_unit_id: item.product_unit_id ?? null,
          unit_name: item.unit_name ?? null,
          color_id: item.color_id ?? null,
          color_name: item.color_name ?? null,
          sold_quantity: Number(item.quantity) || 0,
          quantity: 1,
          price: Number(item.price) || 0,
          reason: ""
        }));
        setItems(returnItems);
      }
    }
  }, [isOpen, invoiceData]);

  const availableQuantities = useMemo(() => {
    const remaining = new Map<number, number>(
      (invoiceData?.items || []).map((item: any): [number, number] => [
        Number(item.id),
        Number(item.quantity) || 0
      ])
    );
    const legacyReturns: any[] = [];

    for (const returned of returnAvailabilityQuery.data || []) {
      for (const returnedItem of returned.items || []) {
        if (returnedItem.sales_invoice_item_id) {
          const itemId = Number(returnedItem.sales_invoice_item_id);
          remaining.set(itemId, Math.max(0, (remaining.get(itemId) || 0) - Number(returnedItem.quantity || 0)));
        } else {
          legacyReturns.push(returnedItem);
        }
      }
    }

    for (const returnedItem of legacyReturns) {
      const matchingItems = (invoiceData?.items || []).filter((item: any) =>
        Number(item.product_id) === Number(returnedItem.product_id)
        && (returnedItem.product_unit_id == null || Number(item.product_unit_id) === Number(returnedItem.product_unit_id))
        && (returnedItem.color_id == null || Number(item.color_id) === Number(returnedItem.color_id))
      );
      let quantityToAllocate = Number(returnedItem.quantity) || 0;
      for (const invoiceItem of matchingItems) {
        if (quantityToAllocate <= 0) break;
        const itemId = Number(invoiceItem.id);
        const available = remaining.get(itemId) || 0;
        const allocated = Math.min(quantityToAllocate, available);
        remaining.set(itemId, available - allocated);
        quantityToAllocate -= allocated;
      }
    }

    return remaining;
  }, [invoiceData?.items, returnAvailabilityQuery.data]);

  const getAvailableQuantity = useCallback(
    (item: ReturnItem) => availableQuantities.get(item.sales_invoice_item_id) || 0,
    [availableQuantities]
  );

  useEffect(() => {
    if (returnAvailabilityQuery.data) {
      setItems(currentItems => currentItems.map(item => ({
        ...item,
        quantity: Math.min(item.quantity, getAvailableQuantity(item))
      })));
    }
  }, [getAvailableQuantity, returnAvailabilityQuery.data]);

  // ========== Calculations ==========
  const totals = {
    totalAmount: items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
  };

  // ========== Handlers ==========

  // ✅ تحديث منتج
  const updateItem = (id: string, field: string, value: number | string) => {
    const updated = items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setItems(updated);
  };

  // ✅ حذف منتج
  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    toast.success(language === 'ar' ? 'تم حذف المنتج' : 'Product removed');
  };

  // ✅ إعادة تعيين النموذج
  const resetForm = () => {
    setItems([]);
    setFormData({
      sales_invoice_id: "",
      return_method: "cash",
      note: "",
      treasury_id: ""
    });
  };

  // ✅ إنشاء مرتجع فاتورة - POST /invoice-return/store
  const createReturnMutation = useMutation({
    mutationFn: async () => {
      // التحقق من البيانات المطلوبة
      if (!formData.sales_invoice_id) {
        throw new Error(language === 'ar' ? 'رقم الفاتورة مطلوب' : 'Invoice number is required');
      }
      if (!formData.treasury_id) {
        throw new Error(language === 'ar' ? 'يجب اختيار الخزينة' : 'Treasury is required');
      }
      const selectedItems = items.filter(item => item.quantity > 0);
      if (selectedItems.length === 0) {
        throw new Error(language === 'ar' ? 'يجب إضافة أصناف' : 'Items are required');
      }
      if (returnAvailabilityQuery.isLoading || returnAvailabilityQuery.isError) {
        throw new Error(language === 'ar' ? 'تعذر التحقق من المرتجعات السابقة، أعد المحاولة' : 'Could not verify previous returns. Please retry.');
      }
      if (selectedItems.some(item => item.quantity > getAvailableQuantity(item))) {
        throw new Error(language === 'ar' ? 'كمية المرتجع تتجاوز الكمية المتبقية من الفاتورة' : 'Return quantity exceeds the remaining invoice quantity');
      }

      // ✅ التأكد إن كل item عنده سبب
      const invalidItems = selectedItems.filter(item => !item.reason || item.reason.trim() === '');
      if (invalidItems.length > 0) {
        throw new Error(language === 'ar' ? 'يجب كتابة سبب الإرجاع لجميع الأصناف' : 'Reason is required for all items');
      }

      // ✅ تجهيز payload مع treasury_id
      const payload = {
        sales_invoice_id: Number(formData.sales_invoice_id),
        return_method: formData.return_method,
        note: formData.note || null,
        treasury_id: Number(formData.treasury_id), // ✅ أضفنا treasury_id
        items: selectedItems.map(item => ({
          sales_invoice_item_id: Number(item.sales_invoice_item_id),
          product_id: Number(item.product_id),
          product_unit_id: item.product_unit_id,
          color_id: item.color_id,
          quantity: Number(item.quantity),
          price: Number(item.price),
          reason: item.reason
        }))
      };

      console.log('📦 Sending payload to /sales-invoice-return/store:', JSON.stringify(payload, null, 2));

      const response = await api.post('/sales-invoice-return/store', payload);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(language === 'ar' ? '✅ تم إنشاء مرتجع الفاتورة بنجاح' : '✅ Invoice return created successfully');
      
      // تحديث البيانات
      queryClient.invalidateQueries({ queryKey: ['invoice-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales-return-availability', invoiceData?.id] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['treasuries-form'] });
      
      // إغلاق النموذج وإعادة تعيينه
      resetForm();
      onClose();
    },
    onError: (error: any) => {
      console.error('❌ Error creating invoice return:', error.response?.data || error);
      
      const errorData = error.response?.data;
      let errorMessage = errorData?.message || error.message;
      
      toast.error(
        language === 'ar' 
          ? `❌ خطأ: ${errorMessage}`
          : `❌ Error: ${errorMessage}`
      );
    }
  });

  // ========== Render ==========
  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 bg-background z-10 border-b px-6 py-4">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <RotateCcw className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-xl">
                {language === 'ar' ? 'مرتجع فاتورة مبيعات' : 'Sales Invoice Return'}
              </span>
              {returnNumber && (
                <span className="text-sm font-mono bg-amber-100 text-amber-700 px-3 py-1 rounded-full">
                  {returnNumber}
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === 'ar'
              ? 'نموذج إنشاء مرتجع لفاتورة مبيعات وتحديد المنتجات والكميات والخزينة.'
              : 'Create a sales invoice return by selecting items, quantities, and treasury.'}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          <div className="space-y-6">
            {/* Invoice Info */}
            {invoiceData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-1 h-5 bg-green-500 rounded-full" />
                    {language === 'ar' ? 'الفاتورة الأصلية' : 'Original Invoice'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {language === 'ar' ? 'رقم الفاتورة' : 'Invoice Number'}
                      </p>
                      <p className="font-bold text-green-700 dark:text-green-400 font-mono">
                        {invoiceData.invoice_number}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {language === 'ar' ? 'العميل' : 'Customer'}
                      </p>
                      <p className="font-medium">
                        {language === 'ar' 
                          ? invoiceData.customer?.name_ar || invoiceData.customer?.name 
                          : invoiceData.customer?.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {language === 'ar' ? 'التاريخ' : 'Date'}
                      </p>
                      <p className="font-medium">{invoiceData.due_date}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Return Method & Treasury */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Return Method */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-1 h-5 bg-amber-500 rounded-full" />
                    {language === 'ar' ? 'طريقة الإرجاع' : 'Return Method'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={formData.return_method}
                    onValueChange={(value) => setFormData({ ...formData, return_method: value })}
                  >
                    <SelectTrigger className="w-full md:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{language === 'ar' ? 'نقداً' : 'Cash'}</SelectItem>
                      <SelectItem value="card">{language === 'ar' ? 'بطاقة' : 'Card'}</SelectItem>
                      <SelectItem value="credit">{language === 'ar' ? 'رصيد' : 'Store Credit'}</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* ✅ Treasury Selection - جديدة */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-1 h-5 bg-blue-500 rounded-full" />
                    <Building2 className="h-4 w-4 text-blue-500" />
                    {language === 'ar' ? 'الخزينة' : 'Treasury'}
                    <span className="text-destructive ml-1">*</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={formData.treasury_id}
                    onValueChange={(value) => setFormData({ ...formData, treasury_id: value })}
                    disabled={loadingTreasuries}
                  >
                    <SelectTrigger className="w-full md:w-64">
                      <SelectValue placeholder={
                        loadingTreasuries 
                          ? (language === 'ar' ? 'جاري التحميل...' : 'Loading...')
                          : (language === 'ar' ? 'اختر الخزينة' : 'Select Treasury')
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingTreasuries ? (
                        <SelectItem value="treasuries-loading" disabled>
                          {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                        </SelectItem>
                      ) : treasuries.length === 0 ? (
                        <SelectItem value="no-treasuries" disabled>
                          {language === 'ar' ? 'لا توجد خزائن' : 'No treasuries found'}
                        </SelectItem>
                      ) : (
                        treasuries.map((treasury: Treasury) => (
                          <SelectItem key={treasury.id} value={String(treasury.id)}>
                            <div className="flex items-center justify-between w-full">
                              <span>{treasury.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {formatCurrency(treasury.balance)}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>

            {/* Return Items */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-1 h-5 bg-amber-500 rounded-full" />
                  {language === 'ar' ? 'الأصناف المرتجعة' : 'Return Items'}
                  {items.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      ({items.length} {language === 'ar' ? 'صنف' : 'items'})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Items Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="min-w-[180px]">
                          {language === 'ar' ? 'المنتج' : 'Product'}
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          {language === 'ar' ? 'الوحدة / اللون' : 'Unit / Color'}
                        </TableHead>
                        <TableHead className="w-20 text-center">
                          {language === 'ar' ? 'الكمية' : 'Qty'}
                        </TableHead>
                        <TableHead className="w-24 text-right">
                          {language === 'ar' ? 'السعر' : 'Price'}
                        </TableHead>
                        <TableHead className="min-w-[200px]">
                          {language === 'ar' ? 'سبب الإرجاع' : 'Reason'} 
                          <span className="text-destructive ml-1">*</span>
                        </TableHead>
                        <TableHead className="w-28 text-right">
                          {language === 'ar' ? 'الإجمالي' : 'Total'}
                        </TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                            <div className="flex flex-col items-center gap-3">
                              <ArrowLeftRight size={32} className="opacity-30" />
                              <span className="text-sm">
                                {language === 'ar' 
                                  ? 'لا توجد أصناف في الفاتورة' 
                                  : 'No items in this invoice'}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/30">
                            <TableCell>
                              <div className="font-medium">{item.product_name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {item.sku}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>{item.unit_name || (language === 'ar' ? 'بدون وحدة' : 'No unit')}</div>
                              <div className="text-xs text-muted-foreground">
                                {item.color_name || (language === 'ar' ? 'بدون لون' : 'No color')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={getAvailableQuantity(item) > 0 ? 1 : 0}
                                max={getAvailableQuantity(item)}
                                value={item.quantity}
                                onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                className="w-16 text-center mx-auto"
                                disabled={getAvailableQuantity(item) === 0 || returnAvailabilityQuery.isLoading}
                              />
                              <div className="text-xs text-muted-foreground text-center mt-1">
                                {language === 'ar' ? 'متاح' : 'Available'}: {getAvailableQuantity(item)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.price}
                                onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                className="w-24 text-right"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder={language === 'ar' ? 'سبب الإرجاع' : 'Return reason'}
                                value={item.reason}
                                onChange={(e) => updateItem(item.id, 'reason', e.target.value)}
                                className="w-full"
                              />
                            </TableCell>
                            <TableCell className="font-medium text-right">
                              {formatCurrency(item.quantity * item.price)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardContent className="pt-4">
                <Label className="mb-2 block">
                  {language === 'ar' ? 'ملاحظات' : 'Notes'}
                </Label>
                <Textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={2}
                  placeholder={language === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'}
                  className="resize-none"
                />
              </CardContent>
            </Card>

            {/* Summary & Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'عدد الأصناف' : 'Items Count'}
                    </p>
                    <p className="text-2xl font-bold">{items.length}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'إجمالي المبلغ المسترد' : 'Total Refund Amount'}
                    </p>
                    <p className="text-3xl font-bold text-amber-600">
                      {formatCurrency(totals.totalAmount)}
                    </p>
                  </div>
                  <Button
                    onClick={() => createReturnMutation.mutate()}
                    disabled={
                      createReturnMutation.isPending || 
                      items.length === 0 ||
                      !formData.treasury_id
                    }
                    className="w-full md:w-auto gap-2 h-11 px-6 bg-amber-600 hover:bg-amber-700"
                    size="lg"
                  >
                    {createReturnMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        {language === 'ar' ? 'حفظ المرتجع' : 'Save Return'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceReturnForm;