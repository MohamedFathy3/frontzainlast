/* eslint-disable @typescript-eslint/no-explicit-any */
// InventoryCount.tsx
import React, { useState, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { cn, formatDate } from '@/lib/utils';
import api from '@/lib/api';
import { useInventory } from '@/hooks/useInventory';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import InventoryPrintTemplate from '@/components/inventory/InventoryPrintTemplate';
import type {
  Warehouse,
  Product,
  WarehouseProduct,
  InventoryRecord,
  CountedProduct,
  ProductUnit,
  UnitColor
} from '@/types/inventory';

import {
  ClipboardList,
  Plus,
  Search,
  CheckCircle,
  Eye,
  Save,
  Warehouse as WarehouseIcon,
  Package,
  TrendingDown,
  TrendingUp,
  Filter,
  X,
  RefreshCw,
  Building2,
  Edit2,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// ========== Helper Functions ==========

const getWarehouseStock = (color: any, warehouseId: string | number): number => {
  const ws = color.warehouseStocks?.find(
    (w: any) => Number(w.warehouse_id) === Number(warehouseId)
  );
  if (ws) return Number(ws.stock) || 0;
  return Number(color.warehouse_stock) || 0;
};

const flattenProductColors = (
  product: WarehouseProduct,
  warehouseId: string | number
): CountedProduct[] => {
  const flattened: CountedProduct[] = [];

  if (!product.units || product.units.length === 0) {
    return [{
      product_id: product.id,
      unit_id: null,
      product_unit_id: null,
      color_id: null,
      counted_stock: 0,
      system_stock: Number(product.stock) || 0,
      product_name: product.name,
      unit_name: null,
      color: null,
      color_hex: null,
      sku: product.sku,
      barcode: (product as any).barcode
    } as CountedProduct];
  }

  product.units.forEach((unit: ProductUnit) => {
    if (unit.colors && unit.colors.length > 0) {
      unit.colors.forEach((color: UnitColor) => {
        flattened.push({
          product_id: product.id,
          unit_id: unit.unit_id,
          product_unit_id: unit.id,
          color_id: color.color_id,
          counted_stock: 0,
          system_stock: getWarehouseStock(color, warehouseId),
          product_name: product.name,
          unit_name: unit.unit_name,
          color: color.color,
          color_hex: color.hex_code,
          sku: product.sku,
          barcode: (unit as any).barcode || (product as any).barcode
        } as CountedProduct);
      });
    } else {
      flattened.push({
        product_id: product.id,
        unit_id: unit.unit_id,
        product_unit_id: unit.id,
        color_id: null,
        counted_stock: 0,
        system_stock: 0,
        product_name: product.name,
        unit_name: unit.unit_name,
        color: null,
        color_hex: null,
        sku: product.sku,
        barcode: (unit as any).barcode || (product as any).barcode
      } as CountedProduct);
    }
  });

  return flattened;
};

const getProductUniqueKey = (product: CountedProduct): string => {
  return `${product.product_id}_${product.unit_id || ''}_${product.color_id || ''}`;
};

// ========== Component ==========
const InventoryCount = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { useGetAll, useGetById, useCreate, useUpdate } = useInventory();

  // ========== State ==========
  const [newCountOpen, setNewCountOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [countNotes, setCountNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState<any>({});
  const [countedProducts, setCountedProducts] = useState<CountedProduct[]>([]);
  const [editRecordOpen, setEditRecordOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<InventoryRecord | null>(null);
  const [editCountedStock, setEditCountedStock] = useState(0);
  const [editNote, setEditNote] = useState('');
  const [updateStock, setUpdateStock] = useState(false);
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // وضع العرض فقط
  const [isViewMode, setIsViewMode] = useState(false);

  // State لتعديل الـ variants (فقط لما المستخدم يعدّل)
  const [editVariants, setEditVariants] = useState<Array<{
    product_unit_id: number;
    unit_id: number;
    unit_name: string;
    color_id: number;
    color_name: string;
    color_code: string;
    counted_stock: number;
    original_stock: number;
  }>>([]);

  // State للطباعة
  const printRef = useRef<HTMLDivElement>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [printData, setPrintData] = useState<any>(null);

  // ========== Queries ==========
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await api.post('/warehouse/index', {
        filters: { active: true },
        orderBy: 'id',
        orderByDirection: 'asc',
        perPage: 100,
        paginate: false
      });
      return response.data.result === 'Success' ? response.data.data || [] : [];
    }
  });

  const { data: warehouseProducts = [] } = useQuery({
    queryKey: ['warehouse-products', selectedWarehouse],
    queryFn: async () => {
      if (!selectedWarehouse) return [];
      const response = await api.get(`/warehouses/${selectedWarehouse}/products`);
      return response.data?.data || [];
    },
    enabled: !!selectedWarehouse && newCountOpen
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ['all-products'],
    queryFn: async () => {
      const response = await api.post('/product/index', {
        filters: { active: true },
        orderBy: 'id',
        orderByDirection: 'asc',
        perPage: 1000,
        paginate: false
      });
      return response.data.data || [];
    }
  });

  const { data: inventoryRecords = [], isLoading: recordsLoading, refetch: refetchRecords } = useGetAll({
    warehouse_id: warehouseFilter !== 'all' ? parseInt(warehouseFilter) : undefined,
    product_id: productFilter !== 'all' ? parseInt(productFilter) : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined
  });

  const { data: inventoryDetails, isLoading: detailsLoading } = useGetById(selectedRecord?.id || null, editRecordOpen);

  // ========== Mutations ==========
  const createMutation = useCreate();
  const updateMutation = useUpdate();

  // ========== Initial Variants (sync via useMemo) ==========
  const initialEditVariants = useMemo(() => {
    const d: any = inventoryDetails;
    if (!d) return [];

    const candidates = [
      d?.product?.units,
      d?.data?.product?.units,
      d?.data?.data?.product?.units,
      d?.units,
      d?.data?.units,
    ];

    const units = candidates.find((c) => Array.isArray(c) && c.length > 0) ?? [];
    if (units.length === 0) return [];

    const flat: Array<{
      product_unit_id: number;
      unit_id: number;
      unit_name: string;
      color_id: number;
      color_name: string;
      color_code: string;
      counted_stock: number;
      original_stock: number;
    }> = [];

    units.forEach((unit: any) => {
      if (Array.isArray(unit.colors)) {
        unit.colors.forEach((color: any) => {
          flat.push({
            product_unit_id: Number(unit.id) || 0,
            unit_id: Number(unit.unit_id) || 0,
            unit_name: unit.unit_name || '-',
            color_id: Number(color.color_id) || 0,
            color_name: color.color || '-',
            color_code: color.hex_code || '#ccc',
            counted_stock: Number(color.counted_stock ?? color.warehouse_stock) || 0,
            original_stock: Number(color.system_stock ?? color.warehouse_stock) || 0,
          });
        });
      }
    });

    return flat;
  }, [inventoryDetails]);

  const displayVariants = editVariants.length > 0 ? editVariants : initialEditVariants;

  // ========== إجماليات الديالوج (بتتحدث وانت بتعدّل) ==========
  const dlgSystem = displayVariants.length > 0
    ? displayVariants.reduce((s, v) => s + (Number(v.original_stock) || 0), 0)
    : Number(selectedRecord?.system_stock) || 0;

  const dlgCounted = displayVariants.length > 0
    ? displayVariants.reduce((s, v) => s + (Number(v.counted_stock) || 0), 0)
    : Number(editCountedStock) || 0;

  const dlgDiff = dlgCounted - dlgSystem;

  // ========== Company Info ==========
  const companyInfo = {
    name: user?.company_name || 'Company Name',
    nameAr: user?.company_name_ar || 'اسم الشركة',
    logo: user?.company_logo,
    address: user?.company_address,
    addressAr: user?.company_address_ar,
    phone: user?.company_phone,
    email: user?.company_email,
    tax_id: user?.company_tax_id,
  };

  // ========== Translations ==========
  const t = {
    en: {
      title: 'Inventory Count',
      description: 'Perform physical inventory counts and reconciliation',
      newCount: 'New Count',
      countNumber: 'Count #',
      warehouse: 'Warehouse',
      selectWarehouse: 'Select Warehouse',
      date: 'Date',
      status: 'Status',
      totalItems: 'Total Items',
      variance: 'Variance',
      actions: 'Actions',
      draft: 'Draft',
      inProgress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
      view: 'View',
      edit: 'Edit',
      complete: 'Complete',
      cancel: 'Cancel',
      save: 'Save',
      notes: 'Notes',
      product: 'Product',
      sku: 'SKU',
      systemQty: 'System Qty',
      countedQty: 'Counted Qty',
      varianceQty: 'Variance',
      noData: 'No inventory counts found',
      createCount: 'Create Count',
      countCreated: 'Inventory count created',
      countSaved: 'Count saved',
      countCompleted: 'Count completed',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      confirmComplete: 'Are you sure you want to complete this count?',
      confirmCancel: 'Are you sure you want to cancel this count?',
      difference: 'Difference',
      inventoryRecords: 'Inventory Records',
      allWarehouses: 'All Warehouses',
      allProducts: 'All Products',
      filter: 'Filter',
      reset: 'Reset',
      editNote: 'Edit Note',
      addNote: 'Add Note',
      saveNote: 'Save Note',
      positiveVariance: 'Surplus',
      negativeVariance: 'Shortage',
      zeroVariance: 'Accurate',
      searchProducts: 'Search products...',
      selectedProducts: 'Selected Products',
      productsCount: 'products',
      warehouseProducts: 'Warehouse Products',
      noProducts: 'No products found',
      systemStock: 'System Stock',
      countedStock: 'Counted Stock',
      differenceCount: 'Difference',
      countDate: 'Count Date',
      viewDetails: 'View Details',
      close: 'Close',
      editInventory: 'Edit Inventory',
      viewInventory: 'View Inventory',
      readOnly: 'Read Only',
      updateActualStock: 'Update Actual Stock',
      willUpdateStock: 'This will update the product stock to match the counted quantity',
      saveChanges: 'Save Changes',
      print: 'Print',
      export: 'Export',
      report: 'Inventory Report',
      generatingReport: 'Generating report...',
      totalSystemStock: 'Total System Stock',
      totalCountedStock: 'Total Counted Stock',
      totalDifference: 'Total Difference',
      varianceSummary: 'Variance Summary',
      unit: 'Size',
      color: 'Color',
      details: 'Details'
    },
    ar: {
      title: 'جرد المخزون',
      description: 'إجراء جرد فعلي للمخزون ومطابقته',
      newCount: 'جرد جديد',
      countNumber: 'رقم الجرد',
      warehouse: 'المخزن',
      selectWarehouse: 'اختر المخزن',
      date: 'التاريخ',
      status: 'الحالة',
      totalItems: 'عدد الأصناف',
      variance: 'الفرق',
      actions: 'الإجراءات',
      draft: 'مسودة',
      inProgress: 'قيد التنفيذ',
      completed: 'مكتمل',
      cancelled: 'ملغي',
      view: 'عرض',
      edit: 'تعديل',
      complete: 'إكمال',
      cancel: 'إلغاء',
      save: 'حفظ',
      notes: 'ملاحظات',
      product: 'المنتج',
      sku: 'رمز المنتج',
      systemQty: 'كمية النظام',
      countedQty: 'الكمية المعدودة',
      varianceQty: 'الفرق',
      noData: 'لا توجد عمليات جرد',
      createCount: 'إنشاء الجرد',
      countCreated: 'تم إنشاء عملية الجرد',
      countSaved: 'تم حفظ الجرد',
      countCompleted: 'تم إكمال الجرد',
      loading: 'جاري التحميل...',
      error: 'خطأ',
      success: 'نجاح',
      confirmComplete: 'هل أنت متأكد من إكمال هذا الجرد؟',
      confirmCancel: 'هل أنت متأكد من إلغاء هذا الجرد؟',
      difference: 'الفرق',
      inventoryRecords: 'سجلات الجرد',
      allWarehouses: 'جميع المخازن',
      allProducts: 'جميع المنتجات',
      filter: 'تصفية',
      reset: 'إعادة تعيين',
      editNote: 'تعديل الملاحظة',
      addNote: 'إضافة ملاحظة',
      saveNote: 'حفظ الملاحظة',
      positiveVariance: 'فائض',
      negativeVariance: 'عجز',
      zeroVariance: 'دقيق',
      searchProducts: 'ابحث عن منتج...',
      selectedProducts: 'المنتجات المختارة',
      productsCount: 'منتج',
      warehouseProducts: 'منتجات المخزن',
      noProducts: 'لا توجد منتجات',
      systemStock: 'مخزون النظام',
      countedStock: 'المخزون المعدود',
      differenceCount: 'الفرق',
      countDate: 'تاريخ الجرد',
      viewDetails: 'عرض التفاصيل',
      close: 'إغلاق',
      editInventory: 'تعديل الجرد',
      viewInventory: 'عرض الجرد',
      readOnly: 'للعرض فقط',
      updateActualStock: 'تحديث المخزون الفعلي',
      willUpdateStock: 'سيتم تحديث مخزون المنتج في النظام ليتطابق مع الكمية المعدودة',
      saveChanges: 'حفظ التغييرات',
      print: 'طباعة',
      export: 'تصدير',
      report: 'تقرير الجرد',
      generatingReport: 'جاري إنشاء التقرير...',
      totalSystemStock: 'إجمالي مخزون النظام',
      totalCountedStock: 'إجمالي المخزون المعدود',
      totalDifference: 'إجمالي الفرق',
      varianceSummary: 'ملخص الفروقات',
      unit: 'المقاس',
      color: 'اللون',
      details: 'التفاصيل'
    }
  }[language];

  // ========== Helper Functions ==========
  const getStatusBadge = (record: InventoryRecord) => {
    const diff = record.difference;
    if (diff > 0) {
      return (
        <Badge variant="outline" className="gap-1 bg-green-100 text-green-700 border-green-200">
          <TrendingUp size={12} />+{diff} ({t.positiveVariance})
        </Badge>
      );
    }
    if (diff < 0) {
      return (
        <Badge variant="outline" className="gap-1 bg-red-100 text-red-700 border-red-200">
          <TrendingDown size={12} />{diff} ({t.negativeVariance})
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 bg-gray-100 text-gray-700 border-gray-200">
        <CheckCircle size={12} />{t.zeroVariance}
      </Badge>
    );
  };

  const handleAddProductToCount = (item: CountedProduct, countedStock: number) => {
    if (countedStock < 0) {
      toast({ title: t.error, description: 'الكمية يجب أن تكون 0 أو أكثر', variant: 'destructive' });
      return;
    }

    const uniqueKey = getProductUniqueKey(item);

    setCountedProducts(prev => {
      const existingIndex = prev.findIndex(p => getProductUniqueKey(p) === uniqueKey);

      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], counted_stock: countedStock };
        return updated;
      }

      return [...prev, { ...item, uniqueKey, counted_stock: countedStock }];
    });
  };

  const handleRemoveProductFromCount = (productId: number, unitId?: number | null, colorId?: number | null) => {
    setCountedProducts(prev => prev.filter(p =>
      !(p.product_id === productId && p.unit_id === unitId && p.color_id === colorId)
    ));
  };

  const handleClearAllProducts = () => setCountedProducts([]);

  const handleResetFilters = () => {
    setWarehouseFilter('all');
    setProductFilter('all');
    setDateFrom('');
    setDateTo('');
    setFilterValues({});
  };

  // افتح السجل في وضع العرض أو التعديل
  const handleOpenRecord = (record: InventoryRecord, viewOnly: boolean = false) => {
    setSelectedRecord(record);
    setEditCountedStock(record.counted_stock);
    setEditNote(record.note || '');
    setUpdateStock(false);
    setEditVariants([]);
    setIsViewMode(viewOnly);
    setEditRecordOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedRecord || isViewMode) return;

    // لو المنتج عنده ألوان → ابعت variants
    if (displayVariants.length > 0) {
      updateMutation.mutate({
        id: selectedRecord.id,
        data: {
          variants: displayVariants.map(v => ({
            product_unit_id: v.product_unit_id,
            color_id: v.color_id,
            counted_stock: v.counted_stock,
          })),
          note: editNote,
        } as any,
      }, {
        onSuccess: () => {
          setEditRecordOpen(false);
          setSelectedRecord(null);
          setEditVariants([]);
          setIsViewMode(false);
          refetchRecords();
        },
      });
      return;
    }

    // منتج بدون ألوان → counted_stock
    updateMutation.mutate({
      id: selectedRecord.id,
      data: { counted_stock: editCountedStock, note: editNote },
    }, {
      onSuccess: () => {
        setEditRecordOpen(false);
        setSelectedRecord(null);
        setIsViewMode(false);
        refetchRecords();
      },
    });
  };

  // ========== Flatten Products for Display ==========
  const flattenedProducts = useMemo(() => {
    if (!warehouseProducts.length) return [];

    const flattened: CountedProduct[] = [];
    warehouseProducts.forEach((product: WarehouseProduct) => {
      flattened.push(...flattenProductColors(product, selectedWarehouse));
    });

    if (!searchQuery) return flattened;
    const query = searchQuery.toLowerCase();
    return flattened.filter((row: CountedProduct) =>
      row.product_name?.toLowerCase().includes(query) ||
      row.sku?.toLowerCase().includes(query) ||
      (row as any).barcode?.toLowerCase().includes(query) ||
      row.unit_name?.toLowerCase().includes(query) ||
      row.color?.toLowerCase().includes(query)
    );
  }, [warehouseProducts, searchQuery, selectedWarehouse]);

  const selectedProductsSummary = useMemo(() => {
    return countedProducts.map(cp => {
      const fullProduct = flattenedProducts.find(fp =>
        fp.product_id === cp.product_id &&
        fp.unit_id === cp.unit_id &&
        fp.color_id === cp.color_id
      );
      return {
        ...cp,
        product_name: fullProduct?.product_name || cp.product_name,
        unit_name: fullProduct?.unit_name || cp.unit_name,
        color: fullProduct?.color || cp.color,
        sku: fullProduct?.sku || cp.sku
      };
    });
  }, [countedProducts, flattenedProducts]);

  const filteredInventoryRecords = useMemo(() => {
    let filtered = inventoryRecords || [];
    if (warehouseFilter !== 'all') {
      filtered = filtered.filter((r: InventoryRecord) => r.warehouse?.id === parseInt(warehouseFilter));
    }
    if (productFilter !== 'all') {
      filtered = filtered.filter((r: InventoryRecord) => r.product?.id === parseInt(productFilter));
    }
    return filtered;
  }, [inventoryRecords, warehouseFilter, productFilter]);

  // تجميع سجلات نفس الفورم + نفس المنتج في صف واحد
  const groupedInventoryRecords = useMemo(() => {
    const map = new Map<string, any>();
    filteredInventoryRecords.forEach((r: any) => {
      const key = r.batch_id
        ? `${r.batch_id}_${r.product?.id ?? r.product_id}`
        : `single_${r.id}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          ...r,
          system_stock: Number(r.system_stock) || 0,
          counted_stock: Number(r.counted_stock) || 0,
          difference: Number(r.difference) || 0,
          variants_count: 1,
        });
      } else {
        existing.system_stock += Number(r.system_stock) || 0;
        existing.counted_stock += Number(r.counted_stock) || 0;
        existing.difference += Number(r.difference) || 0;
        existing.variants_count += 1;
      }
    });
    return Array.from(map.values());
  }, [filteredInventoryRecords]);

  // ========== Print & Export Functions ==========
  const preparePrintData = () => {
    const records = filteredInventoryRecords;
    const totalSystemStock = records.reduce((sum: number, r: InventoryRecord) => sum + r.system_stock, 0);
    const totalCountedStock = records.reduce((sum: number, r: InventoryRecord) => sum + r.counted_stock, 0);
    const totalDifference = totalCountedStock - totalSystemStock;
    const positiveVariance = records.filter((r: InventoryRecord) => r.difference > 0).length;
    const negativeVariance = records.filter((r: InventoryRecord) => r.difference < 0).length;
    const zeroVariance = records.filter((r: InventoryRecord) => r.difference === 0).length;

    return {
      records,
      warehouseName: warehouseFilter !== 'all'
        ? warehouses.find((w: Warehouse) => w.id === parseInt(warehouseFilter))?.name
        : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      createdAt: new Date().toISOString(),
      totalRecords: records.length,
      totalSystemStock,
      totalCountedStock,
      totalDifference,
      positiveVariance,
      negativeVariance,
      zeroVariance,
    };
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `inventory-count-report-${new Date().toISOString().split('T')[0]}`,
    onAfterPrint: () => setShowPrint(false),
  });

  const handlePrintClick = () => {
    if (filteredInventoryRecords.length === 0) {
      toast({
        title: t.error,
        description: language === 'ar' ? 'لا توجد بيانات للطباعة' : 'No data to print',
        variant: 'destructive',
      });
      return;
    }
    setPrintData(preparePrintData());
    setShowPrint(true);
    setTimeout(() => handlePrint(), 100);
  };

  const exportToExcel = () => {
    const records = filteredInventoryRecords;
    if (records.length === 0) {
      toast({
        title: t.error,
        description: language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export',
        variant: 'destructive',
      });
      return;
    }

    const excelData: any[] = records.map((record: InventoryRecord, index: number) => ({
      '#': index + 1,
      [t.product]: language === 'ar' ? record.product.name_ar || record.product.name : record.product.name,
      [t.sku]: record.product.sku,
      [t.warehouse]: language === 'ar' ? record.warehouse.name_ar || record.warehouse.name : record.warehouse.name,
      [t.systemStock]: record.system_stock,
      [t.countedStock]: record.counted_stock,
      [t.difference]: record.difference,
      [t.notes]: record.note || '',
      [t.date]: formatDate(record.created_at),
    }));

    const totalSystemStock = records.reduce((sum: number, r: InventoryRecord) => sum + r.system_stock, 0);
    const totalCountedStock = records.reduce((sum: number, r: InventoryRecord) => sum + r.counted_stock, 0);
    const totalDifference = totalCountedStock - totalSystemStock;
    const positiveVariance = records.filter((r: InventoryRecord) => r.difference > 0).length;
    const negativeVariance = records.filter((r: InventoryRecord) => r.difference < 0).length;
    const zeroVariance = records.filter((r: InventoryRecord) => r.difference === 0).length;

    excelData.push({
      '#': '', [t.product]: '=== ' + (language === 'ar' ? 'الملخص' : 'Summary') + ' ===',
      [t.sku]: '', [t.warehouse]: '', [t.systemStock]: totalSystemStock,
      [t.countedStock]: totalCountedStock, [t.difference]: totalDifference,
      [t.notes]: '', [t.date]: '',
    });
    excelData.push({
      '#': '', [t.product]: t.positiveVariance, [t.sku]: '', [t.warehouse]: '',
      [t.systemStock]: positiveVariance, [t.countedStock]: '', [t.difference]: '',
      [t.notes]: '', [t.date]: '',
    });
    excelData.push({
      '#': '', [t.product]: t.negativeVariance, [t.sku]: '', [t.warehouse]: '',
      [t.systemStock]: negativeVariance, [t.countedStock]: '', [t.difference]: '',
      [t.notes]: '', [t.date]: '',
    });
    excelData.push({
      '#': '', [t.product]: t.zeroVariance, [t.sku]: '', [t.warehouse]: '',
      [t.systemStock]: zeroVariance, [t.countedStock]: '', [t.difference]: '',
      [t.notes]: '', [t.date]: '',
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [
      { wch: 5 }, { wch: 35 }, { wch: 15 }, { wch: 20 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 15 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Count');
    const fileName = `inventory-count-${new Date().toISOString().split('T')[0]}.xlsx`;
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), fileName);

    toast({
      title: t.success,
      description: language === 'ar' ? 'تم تصدير البيانات بنجاح' : 'Data exported successfully',
    });
  };

  const isLoading = recordsLoading;

  // ========== Render ==========
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardList className="text-primary" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{t.title}</h2>
            <p className="text-sm text-muted-foreground">{t.description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {filteredInventoryRecords.length > 0 && (
            <>
              <Button variant="outline" onClick={handlePrintClick} className="gap-2">
                <Printer size={16} />{t.print}
              </Button>
              <Button variant="outline" onClick={exportToExcel} className="gap-2">
                <FileSpreadsheet size={16} />{t.export}
              </Button>
            </>
          )}
          <Button onClick={() => setNewCountOpen(true)} className="gap-2">
            <Plus size={16} />{t.newCount}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter size={16} />{t.filter}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">{t.warehouse}</Label>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger><SelectValue placeholder={t.allWarehouses} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allWarehouses}</SelectItem>
                  {warehouses.map((w: Warehouse) => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Building2 size={14} />
                        {language === 'ar' ? w.name_ar || w.name : w.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t.product}</Label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger><SelectValue placeholder={t.allProducts} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allProducts}</SelectItem>
                  {allProducts.slice(0, 50).map((p: Product) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {language === 'ar' ? p.name_ar || p.name : p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t.date} From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t.date} To</Label>
              <div className="flex gap-2">
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="flex-1" />
                <Button variant="outline" size="icon" onClick={handleResetFilters} title={t.reset}>
                  <RefreshCw size={16} />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Records Table */}
      <Card>
        <CardHeader className="border-b"><CardTitle>{t.inventoryRecords}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] w-full">
            <div className="min-w-[1000px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>{t.countNumber}</TableHead>
                    <TableHead>{t.warehouse}</TableHead>
                    <TableHead>{t.product}</TableHead>
                    <TableHead className="text-center">{t.systemStock}</TableHead>
                    <TableHead className="text-center">{t.countedStock}</TableHead>
                    <TableHead className="text-center">{t.difference}</TableHead>
                    <TableHead>{t.date}</TableHead>
                    <TableHead>{t.notes}</TableHead>
                    <TableHead className="text-center">{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8">
                        <div className="flex justify-center">
                          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : groupedInventoryRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        <ClipboardList className="mx-auto h-12 w-12 mb-4 opacity-20" />
                        <p>{t.noData}</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedInventoryRecords.map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          INV-{formatDate(record.created_at).replace(/\//g, '')}-{record.warehouse?.id || record.warehouse_id}
                        </TableCell>
                        <TableCell>
                          {language === 'ar' ? record.warehouse?.name_ar || record.warehouse?.name : record.warehouse?.name}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {language === 'ar' ? record.product?.name_ar || record.product?.name : record.product?.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{record.product?.sku}</p>
                          </div>
                          {record.variants_count > 1 && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              {record.variants_count} {language === 'ar' ? 'مقاس/لون' : 'variants'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-medium">{record.system_stock}</TableCell>
                        <TableCell className="text-center font-medium">{record.counted_stock}</TableCell>
                        <TableCell className="text-center">{getStatusBadge(record)}</TableCell>
                        <TableCell>{formatDate(record.created_at)}</TableCell>
                        <TableCell>
                          <span className="text-sm truncate max-w-[150px] block">{record.note || '-'}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* زرار التعديل → edit mode */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenRecord(record, false)}
                              className="h-8 w-8 p-0 text-blue-600"
                              title={t.edit}
                            >
                              <Edit2 size={16} />
                            </Button>
                            {/* زرار العرض → view only mode */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title={t.view}
                              onClick={() => handleOpenRecord(record, true)}
                            >
                              <Eye size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Edit/View Inventory Dialog */}
      <Dialog open={editRecordOpen} onOpenChange={setEditRecordOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              {isViewMode ? <Eye size={18} /> : <Edit2 size={18} />}
              {isViewMode ? t.viewInventory : t.editInventory}
              {isViewMode && (
                <Badge variant="secondary" className="ms-2 text-xs">
                  {t.readOnly}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : selectedRecord && inventoryDetails ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* بيانات المنتج والمخزن */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">{t.product}</p>
                  <p className="font-medium">
                    {language === 'ar' ? selectedRecord.product?.name_ar || selectedRecord.product?.name : selectedRecord.product?.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{selectedRecord.product?.sku}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t.warehouse}</p>
                  <p className="font-medium">
                    {language === 'ar' ? selectedRecord.warehouse?.name_ar || selectedRecord.warehouse?.name : selectedRecord.warehouse?.name}
                  </p>
                </div>
              </div>

              {/* إجماليات الجرد */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">{t.systemStock}</p>
                  <p className="text-lg font-bold">{dlgSystem}</p>
                </div>
                <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">{t.countedStock}</p>
                  <p className="text-lg font-bold">{dlgCounted}</p>
                </div>
                <div className={cn(
                  "p-2 rounded-lg text-center",
                  dlgDiff > 0 ? "bg-green-100 dark:bg-green-950/30" :
                    dlgDiff < 0 ? "bg-red-100 dark:bg-red-950/30" : "bg-gray-100 dark:bg-gray-800"
                )}>
                  <p className="text-xs text-muted-foreground">{t.difference}</p>
                  <p className={cn(
                    "text-lg font-bold",
                    dlgDiff > 0 ? "text-green-600" :
                      dlgDiff < 0 ? "text-red-600" : "text-gray-600"
                  )}>
                    {dlgDiff > 0 ? `+${dlgDiff}` : dlgDiff}
                  </p>
                </div>
              </div>

              {/* عرض الألوان والمقاسات */}
              {displayVariants.length > 0 ? (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      {language === 'ar' ? 'المقاسات والألوان' : 'Sizes & Colors'}
                      <span className="text-xs text-muted-foreground ms-2">({displayVariants.length})</span>
                    </Label>
                    <span className="text-xs font-medium">
                      {language === 'ar' ? 'المجموع: ' : 'Total: '}
                      <b className="text-primary">{dlgCounted}</b>
                    </span>
                  </div>
                  <div className="border rounded-lg divide-y max-h-[250px] overflow-y-auto bg-card">
                    {displayVariants.map((v, idx) => (
                      <div key={`${v.product_unit_id}-${v.color_id}`} className="flex items-center gap-2 p-2 hover:bg-muted/30">
                        <Badge variant="secondary" className="text-xs shrink-0 min-w-[40px] justify-center">
                          {v.unit_name}
                        </Badge>
                        <Badge variant="outline" className="text-xs gap-1 shrink-0">
                          <div className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: v.color_code }} />
                          {v.color_name}
                        </Badge>
                        <div className="flex-1 text-xs text-muted-foreground text-end">
                          {language === 'ar' ? 'مخزون النظام: ' : 'System: '}
                          <b>{v.original_stock}</b>
                        </div>
                        {/* Input معطّل في وضع العرض فقط */}
                        <Input
                          type="number"
                          min="0"
                          disabled={isViewMode}
                          value={v.counted_stock}
                          onChange={(e) => {
                            if (isViewMode) return;
                            const val = Number(e.target.value);
                            const base = displayVariants.map(x => ({ ...x }));
                            base[idx] = { ...base[idx], counted_stock: isNaN(val) ? 0 : val };
                            setEditVariants(base);
                          }}
                          className={cn(
                            "w-20 text-center h-8",
                            !isViewMode && v.counted_stock !== v.original_stock && "border-blue-500 bg-blue-50 dark:bg-blue-950/30 font-bold",
                            isViewMode && "bg-muted cursor-not-allowed"
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 mt-4">
                  <Label>{t.countedStock}</Label>
                  <Input
                    type="number"
                    min="0"
                    disabled={isViewMode}
                    value={editCountedStock}
                    onChange={(e) => {
                      if (isViewMode) return;
                      setEditCountedStock(Number(e.target.value));
                    }}
                    className={cn(
                      "text-center text-lg font-medium",
                      isViewMode && "bg-muted cursor-not-allowed"
                    )}
                  />
                </div>
              )}

              {/* ملاحظات */}
              <div className="space-y-2 mt-4">
                <Label>{t.notes}</Label>
                <Textarea
                  value={editNote}
                  onChange={(e) => {
                    if (isViewMode) return;
                    setEditNote(e.target.value);
                  }}
                  rows={2}
                  disabled={isViewMode}
                  placeholder={t.addNote}
                  className={cn(isViewMode && "bg-muted cursor-not-allowed")}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="p-4 border-t gap-2">
            {/* في وضع العرض: زرار إغلاق فقط */}
            {isViewMode ? (
              <Button variant="outline" onClick={() => setEditRecordOpen(false)}>
                {t.close}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setEditRecordOpen(false)}>{t.cancel}</Button>
                <Button onClick={handleSaveEdit} disabled={updateMutation.isPending} className="gap-2">
                  {updateMutation.isPending ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
                  {updateMutation.isPending ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : t.saveChanges}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Count Dialog */}
      <Dialog open={newCountOpen} onOpenChange={setNewCountOpen}>
        <DialogContent className="w-[96vw] max-w-[1500px] max-h-[94vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Plus size={18} />{t.newCount}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-2">
              <Label>{t.warehouse} *</Label>
              <Select
                value={selectedWarehouse}
                onValueChange={(v) => {
                  setSelectedWarehouse(v);
                  setCountedProducts([]);
                  setSearchQuery('');
                }}
              >
                <SelectTrigger><SelectValue placeholder={t.selectWarehouse} /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w: Warehouse) => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      <div className="flex items-center gap-2">
                        <WarehouseIcon size={14} />
                        {language === 'ar' ? w.name_ar || w.name : w.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.notes}</Label>
              <Textarea
                value={countNotes}
                onChange={(e) => setCountNotes(e.target.value)}
                rows={2}
                placeholder={language === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'}
              />
            </div>

            {selectedWarehouse && (
              <>
                {selectedProductsSummary.length > 0 && (
                  <div className="bg-primary/5 p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{t.selectedProducts}</span>
                      <Badge variant="secondary">{selectedProductsSummary.length} {t.productsCount}</Badge>
                      <Button variant="ghost" size="sm" onClick={handleClearAllProducts} className="h-7 text-xs text-destructive">
                        <X size={12} className="me-1" />
                        {language === 'ar' ? 'مسح الكل' : 'Clear All'}
                      </Button>
                    </div>
                    <ScrollArea className="max-h-[150px]">
                      <div className="space-y-1">
                        {selectedProductsSummary.map((p, idx) => (
                          <div key={`selected-${p.product_id}-${p.unit_id}-${p.color_id}-${idx}`} className="flex items-center justify-between text-xs p-1 hover:bg-primary/10 rounded">
                            <div className="flex-1 min-w-0">
                              <span className="truncate block">
                                {p.product_name}
                                {p.unit_name && ` (${p.unit_name})`}
                                {p.color && ` - ${p.color}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-medium text-green-600">{p.counted_stock}</span>
                              <span className="text-muted-foreground">/ {p.system_stock}</span>
                              <Button variant="ghost" size="icon" className="h-5 w-5"
                                onClick={() => handleRemoveProductFromCount(p.product_id, p.unit_id, p.color_id)}>
                                <X size={10} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{t.product}</Label>
                  <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      placeholder={t.searchProducts}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="ps-9"
                    />
                  </div>
                </div>

                <ScrollArea className="h-[min(52vh,560px)] border rounded-lg">
                  {flattenedProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Package className="h-12 w-12 mb-2 opacity-20" />
                      <p className="text-sm">{t.noProducts}</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-2">
                      {flattenedProducts.map((item: CountedProduct, idx: number) => {
                        const countedItem = countedProducts.find(p =>
                          p.product_id === item.product_id &&
                          p.unit_id === item.unit_id &&
                          p.color_id === item.color_id
                        );

                        return (
                          <div
                            key={`product-${item.product_id}-${item.unit_id}-${item.color_id}-${idx}`}
                            className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.product_name}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                                <span className="font-mono">{item.sku}</span>
                                {(item as any).barcode && (
                                  <span className="font-mono">
                                    {language === 'ar' ? 'باركود' : 'Barcode'}: {(item as any).barcode}
                                  </span>
                                )}
                                {item.unit_name && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {t.unit}: {item.unit_name}
                                    </Badge>
                                  </>
                                )}
                                {item.color && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: item.color_hex || '#ccc' }}
                                      />
                                      {item.color}
                                    </Badge>
                                  </>
                                )}
                                <span>•</span>
                                <span>{t.systemStock}: {item.system_stock}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Input
                                type="number"
                                min="0"
                                value={countedItem?.counted_stock ?? ''}
                                onChange={(e) => handleAddProductToCount(item, Number(e.target.value))}
                                className="w-24 text-center"
                                placeholder="0"
                              />
                              {countedItem ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-destructive"
                                  onClick={() => handleRemoveProductFromCount(item.product_id, item.unit_id, item.color_id)}
                                >
                                  <X size={16} />
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => handleAddProductToCount(item, item.system_stock || 0)}
                                >
                                  <Plus size={16} />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </div>

          <DialogFooter className="p-4 border-t gap-2">
            <Button variant="outline" onClick={() => setNewCountOpen(false)}>{t.cancel}</Button>
            <Button
              onClick={() => {
                const productsToSend = countedProducts.map((p: any) => ({
                  product_id: p.product_id,
                  unit_id: p.unit_id ?? null,
                  product_unit_id: p.product_unit_id ?? null,
                  color_id: p.color_id ?? null,
                  counted_stock: p.counted_stock ?? 0
                }));

                createMutation.mutate({
                  warehouse_id: Number(selectedWarehouse),
                  note: countNotes,
                  products: productsToSend
                }, {
                  onSuccess: () => {
                    setNewCountOpen(false);
                    setSelectedWarehouse('');
                    setCountNotes('');
                    setCountedProducts([]);
                    setSearchQuery('');
                    refetchRecords();
                  }
                });
              }}
              disabled={!selectedWarehouse || countedProducts.length === 0 || createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {createMutation.isPending ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') : t.createCount}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Template */}
      {showPrint && printData && (
        <div style={{ display: 'none' }}>
          <InventoryPrintTemplate ref={printRef} data={printData} companyInfo={companyInfo} />
        </div>
      )}
    </div>
  );
};

export default InventoryCount;