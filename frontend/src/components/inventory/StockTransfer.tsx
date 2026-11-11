/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { AxiosError } from 'axios';
import * as XLSX from 'xlsx';
import {
  Plus,
  Search,
  Save,
  Warehouse,
  Package,
  Filter,
  X,
  RefreshCw,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  List,
} from 'lucide-react';

// ========== أنواع البيانات ==========
interface Warehouse {
  id: number;
  name: string;
  name_ar?: string;
  active: boolean;
}

interface ColorStock {
  id: number;
  color_id: number;
  color: string;
  stock: number;
  total_stock?: number | null;
  hex_code: string;
  warehouse_stock?: number | null;
  warehouseStocks?: Array<{ warehouse_id: number; stock: number }>;
}

interface UnitWithColors {
  id: number;
  unit_id: number;
  unit_name: string;
  cost_price: string;
  sell_price: string;
  barcode: string;
  colors: ColorStock[];
}

interface WarehouseProduct {
  id: number;
  name?: string;
  product_id?: number;
  product_name?: string;
  warehouse_name?: string;
  barcode?: string;
  stock: number;
  cost?: string;
  units?: UnitWithColors[];
  product?: {
    id: number;
    name: string;
    sku: string;
    barcode: string;
    units: UnitWithColors[];
  };
}

interface TransferProduct {
  product_id: number;
  product_unit_id: number;
  color_id: number;
  quantity: number;
  note?: string;
}

interface TransferDocumentItem {
  product_id: number;
  product_unit_id?: number | null;
  color_id?: number | null;
  quantity: number;
  source_before: number;
  source_after: number;
  destination_before: number;
  destination_after: number;
  unit_cost?: number;
  total_cost?: number;
  note?: string;
}

interface TransferDocument {
  transfer_number: string;
  transfer_date: string;
  total_quantity: number;
  items?: TransferDocumentItem[];
  items_count?: number;
  from_warehouse_id?: number;
  to_warehouse_id?: number;
  value?: number;
}

interface TransferHistoryRow {
  id: number;
  transfer_number: string;
  transfer_date: string;
  from_warehouse_id: number;
  to_warehouse_id: number;
  inventory_value: number | string;
  source_warehouse_name?: string;
  destination_warehouse_name?: string;
  creator_name?: string;
  items_count?: number;
  total_quantity?: number;
}

interface TransferHistoryDetails {
  transfer: TransferHistoryRow & Record<string, any>;
  items: Array<TransferDocumentItem & {
    id?: number;
    product_name?: string;
    product_barcode?: string;
    unit_name?: string;
    unit_barcode?: string;
    color_name?: string;
  }>;
  items_count?: number;
  total_quantity?: number;
  inventory_value?: number;
}

interface VariantRow {
  rowKey: string;
  productId: number;
  productName: string;
  unitId: number;
  unitName: string;
  colorId: number;
  colorName: string;
  hexCode: string;
  barcode: string;
  stock: number;
  totalStock: number;
}

interface ProductGroup {
  productId: number;
  productName: string;
  variants: VariantRow[];
  totalStock: number;
}

const computeEffectiveStock = (item: WarehouseProduct): number => {
  const units = item.units || item.product?.units || [];

  if (!units.length) {
    return Number(item.stock) || 0;
  }

  return units.reduce((sum, unit) => {
    return (
      sum +
      (unit.colors || []).reduce((colorSum, c) => {
        let ws: number | null = null;

        if (c.warehouse_stock != null) {
          ws = Number(c.warehouse_stock);
        } else if (
          Array.isArray(c.warehouseStocks) &&
          c.warehouseStocks.length > 0
        ) {
          ws = c.warehouseStocks.reduce(
            (s, w) => s + (Number(w.stock) || 0),
            0,
          );
        }

        return colorSum + (ws ?? 0);
      }, 0)
    );
  }, 0);
};

const buildTransferNumberPrefix = (date: Date = new Date()): string => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `WHS-${dd}${mm}${yyyy}-`;
};

const StockTransfer = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  // ========== State ==========
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');
  const [searchText, setSearchText] = useState('');
  const [modalSearchText, setModalSearchText] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [transferItems, setTransferItems] = useState<TransferProduct[]>([]);
  const [productNotes, setProductNotes] = useState<Record<string, string>>({});
  const [lastTransferDocument, setLastTransferDocument] = useState<TransferDocument | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [selectedHistoryTransferId, setSelectedHistoryTransferId] = useState<number | null>(null);
  const [showHistoryDetailsModal, setShowHistoryDetailsModal] = useState(false);
  const [collapsedProducts, setCollapsedProducts] = useState<Set<number>>(new Set());

  // ========== Translation ==========
  const t = {
    en: {
      title: 'Warehouse Stock',
      description: 'View and transfer products between warehouses',
      warehouse: 'Warehouse',
      product: 'Product',
      stock: 'Stock',
      cost: 'Cost',
      fromWarehouse: 'From Warehouse',
      toWarehouse: 'To Warehouse',
      quantity: 'Quantity',
      note: 'Note',
      newTransfer: 'New Transfer',
      saveTransfer: 'Transfer Now',
      cancel: 'Cancel',
      selectFrom: 'Select source',
      selectTo: 'Select destination',
      search: 'Search by name or barcode...',
      noData: 'No products found',
      loading: 'Loading...',
      allWarehouses: 'All Warehouses',
      refresh: 'Refresh',
      transferSuccess: 'Transfer completed successfully',
      differentWarehouses: 'Source and destination must be different',
      totalItems: 'Total Items',
      totalQuantity: 'Total Quantity',
      filter: 'Filter',
      error: 'Error',
      transferring: 'Transferring...',
      barcode: 'Barcode',
      totalStock: 'Total Stock',
      export: 'Export Excel',
      noDataToExport: 'No data to export',
      exportSuccess: 'Data exported successfully',
      transferNumber: 'Transfer Number',
      transferDate: 'Transfer Date',
      documentInfo: 'Transfer Document',
      autoDocumentNumber: 'The WHS document number is generated automatically on save (daily sequence)',
      itemsCount: 'Transfer Lines',
      variants: 'variants',
      variant: 'variant',
      selected: 'selected',
      expandAll: 'Expand All',
      collapseAll: 'Collapse All',
      transferDetails: 'Transfer Details',
      sourceBalance: 'Source Balance',
      destBalance: 'Destination Balance',
      showDetails: 'Show Details',
      fromLabel: 'From',
      toLabel: 'To',
    },
    ar: {
      title: 'مخزون المخازن',
      description: 'عرض وتحويل المنتجات بين المخازن',
      warehouse: 'المخزن',
      product: 'المنتج',
      stock: 'المخزون',
      cost: 'التكلفة',
      fromWarehouse: 'من مخزن',
      toWarehouse: 'إلى مخزن',
      quantity: 'الكمية',
      note: 'ملاحظة',
      newTransfer: 'تحويل جديد',
      saveTransfer: 'تحويل الآن',
      cancel: 'إلغاء',
      selectFrom: 'اختر المصدر',
      selectTo: 'اختر الوجهة',
      search: 'ابحث بالاسم أو الباركود...',
      noData: 'لا توجد منتجات',
      loading: 'جاري التحميل...',
      allWarehouses: 'جميع المخازن',
      refresh: 'تحديث',
      transferSuccess: 'تم التحويل بنجاح',
      differentWarehouses: 'يجب أن يكون المخزنين مختلفين',
      totalItems: 'إجمالي الأصناف',
      totalQuantity: 'إجمالي الكميات',
      filter: 'تصفية',
      error: 'خطأ',
      transferring: 'جاري التحويل...',
      barcode: 'الباركود',
      totalStock: 'إجمالي المخزون',
      export: 'تصدير Excel',
      noDataToExport: 'لا توجد بيانات للتصدير',
      exportSuccess: 'تم تصدير البيانات بنجاح',
      transferNumber: 'رقم التحويل',
      transferDate: 'تاريخ التحويل',
      documentInfo: 'بيانات مستند التحويل',
      autoDocumentNumber: 'يتم إنشاء رقم مستند WHS تلقائيًا عند الحفظ (تسلسل يومي)',
      itemsCount: 'سطور التحويل',
      variants: 'متغيرات',
      variant: 'متغير',
      selected: 'محدد',
      expandAll: 'توسيع الكل',
      collapseAll: 'طي الكل',
      transferDetails: 'تفاصيل الأصناف المحولة',
      sourceBalance: 'رصيد المصدر',
      destBalance: 'رصيد الوجهة',
      showDetails: 'عرض التفاصيل',
      fromLabel: 'من',
      toLabel: 'إلى',
    },
  }[language];

  // ========== 1. جلب المخازن ==========
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.post('/warehouse/index', {
        filters: { active: true },
        orderBy: 'id',
        perPage: 100,
        paginate: false,
      });
      return res.data.result === 'Success' ? res.data.data || [] : [];
    },
  });

  // ========== سجل مستندات تحويل المخازن ==========
  const { data: transferHistoryResponse, isLoading: historyLoading, refetch: refetchTransferHistory } = useQuery({
    queryKey: ['warehouse-transfer-history', historyPage, historySearch, historyDateFrom, historyDateTo],
    queryFn: async () => {
      const res = await api.get('/warehouses/transfers', {
        params: {
          page: historyPage,
          per_page: 15,
          search: historySearch.trim() || undefined,
          date_from: historyDateFrom || undefined,
          date_to: historyDateTo || undefined,
        },
      });
      return res.data;
    },
    refetchOnWindowFocus: false,
  });

  const transferHistory: TransferHistoryRow[] = transferHistoryResponse?.data || [];
  const historyPagination = transferHistoryResponse?.pagination || {
    current_page: 1, last_page: 1, total: transferHistory.length,
  };

  const { data: historyDetailsResponse, isLoading: historyDetailsLoading } = useQuery({
    queryKey: ['warehouse-transfer-details', selectedHistoryTransferId],
    queryFn: async () => {
      const res = await api.get(`/warehouses/transfers/${selectedHistoryTransferId}`);
      return res.data?.data as TransferHistoryDetails;
    },
    enabled: !!selectedHistoryTransferId && showHistoryDetailsModal,
    refetchOnWindowFocus: false,
  });

  const historyDetails = historyDetailsResponse;

  // ========== 2. جلب المنتجات (الواجهة الرئيسية) ==========
  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ['warehouse-products', warehouseFilter, searchText],
    queryFn: async () => {
      if (warehouseFilter !== 'all') {
        const res = await api.get(`/warehouses/${warehouseFilter}/products`);
        const responseData = res.data?.data ?? res.data;

        return Array.isArray(responseData)
          ? responseData.map((item: any) => ({
            ...item,
            product_id: item.id,
            product_name: item.name || item.product_name,
            barcode: item.barcode || item.product?.barcode || '',
            warehouse_id: Number(warehouseFilter),
            warehouse_name:
              warehouses.find(
                (w: Warehouse) => w.id === Number(warehouseFilter),
              )?.name || '',
            stock: Number(item.stock) || 0,
          }))
          : [];
      }

      const payload: any = {
        orderBy: 'id',
        perPage: 1000,
        paginate: false,
      };

      const filters: any = {};

      if (searchText.trim()) {
        const searchValue = searchText.trim();
        if (/^\d+$/.test(searchValue)) {
          filters.barcode = searchValue;
        } else {
          filters.product_name = searchValue;
        }
      }

      if (Object.keys(filters).length > 0) {
        payload.filters = filters;
      }

      const res = await api.post('/warehouses/index-product', payload);
      return res.data.result === 'Success' ? res.data.data || [] : [];
    },
    refetchOnWindowFocus: false,
  });

  // ========== 3. جلب منتجات المخزن المصدر (مودال) ==========
  const { data: modalProducts = [], isLoading: modalLoading } = useQuery({
    queryKey: ['modal-warehouse-products', fromWarehouse, modalSearchText],
    queryFn: async () => {
      if (!fromWarehouse) return [];

      const res = await api.get(`/warehouses/${fromWarehouse}/products`);
      const responseData = res.data?.data ?? res.data;

      let productsArray: any[] = Array.isArray(responseData)
        ? responseData
        : [];

      const search = modalSearchText.trim().toLowerCase();
      if (search) {
        productsArray = productsArray.filter((product: any) => {
          const name = String(
            product.name || product.product_name || '',
          ).toLowerCase();
          const barcode = String(product.barcode || '');
          return name.includes(search) || barcode.includes(search);
        });
      }

      return productsArray;
    },
    enabled: !!fromWarehouse,
    refetchOnWindowFocus: false,
  });

  // ========== 4. الإحصائيات ==========
  const stats = useMemo(() => {
    const totalItems = products.length;
    const totalStock = products.reduce(
      (sum, p: WarehouseProduct) => sum + computeEffectiveStock(p),
      0,
    );
    return { totalItems, totalStock };
  }, [products]);

  // ========== 5. تحويل منتجات ==========
  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!fromWarehouse) throw new Error('Select source warehouse');
      if (!toWarehouse) throw new Error('Select destination warehouse');
      if (fromWarehouse === toWarehouse)
        throw new Error(t.differentWarehouses);
      if (transferItems.length === 0)
        throw new Error('Add products to transfer');

      const payload = {
        from_warehouse_id: parseInt(fromWarehouse),
        to_warehouse_id: parseInt(toWarehouse),
        products: transferItems.map((item) => ({
          product_id: item.product_id,
          ...(item.product_unit_id > 0 && {
            product_unit_id: item.product_unit_id,
          }),
          ...(item.color_id > 0 && { color_id: item.color_id }),
          quantity: item.quantity,
          ...(productNotes[
            `${item.product_id}-${item.product_unit_id}-${item.color_id}`
          ]
            ? {
              note:
                productNotes[
                `${item.product_id}-${item.product_unit_id}-${item.color_id}`
                ],
            }
            : {}),
        })),
      };

      const res = await api.post('/warehouses/transfer', payload);
      return res.data;
    },
    onSuccess: async (data) => {
      const transferData = data?.data || {};
      setLastTransferDocument({
        transfer_number: transferData.transfer_number,
        transfer_date: transferData.transfer_date,
        total_quantity: transferData.total_quantity ?? 0,
        items: transferData.items ?? [],
        items_count: transferData.items_count ?? (transferData.items?.length ?? 0),
        from_warehouse_id: transferData.from_warehouse_id || parseInt(fromWarehouse),
        to_warehouse_id: transferData.to_warehouse_id || parseInt(toWarehouse),
        value: transferData.value || 0,
      });

      toast({
        title: t.transferSuccess,
        description:
          language === 'ar'
            ? `تم إنشاء المستند ${transferData.transfer_number || '-'} بتاريخ ${transferData.transfer_date || '-'} وتحويل ${transferData.total_quantity ?? 0} وحدة بنجاح`
            : `Document ${transferData.transfer_number || '-'} dated ${transferData.transfer_date || '-'} created; ${transferData.total_quantity ?? 0} units transferred successfully`,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['warehouse-products'] }),
        queryClient.invalidateQueries({
          queryKey: ['modal-warehouse-products'],
        }),
        queryClient.invalidateQueries({ queryKey: ['warehouse-transfer-history'] }),
      ]);

      setShowTransferModal(false);
      setTransferItems([]);
      setProductNotes({});
      setFromWarehouse('');
      setToWarehouse('');
      setModalSearchText('');
      setCollapsedProducts(new Set());
    },
    onError: (error: AxiosError) => {
      const data = error.response?.data as any;
      toast({
        title: t.error,
        description: data?.errors
          ? Object.values(data.errors).flat().join(', ')
          : data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  // ========== 6. بناء خريطة البحث عن أرقام التحويل ==========
  const lastTransferMap = useMemo(() => {
    const map = new Map<string, string>();
    if (lastTransferDocument?.items) {
      lastTransferDocument.items.forEach(item => {
        const key = `${item.product_id}-${item.product_unit_id || 0}-${item.color_id || 0}`;
        map.set(key, lastTransferDocument.transfer_number);
      });
    }
    return map;
  }, [lastTransferDocument]);

  const productLookupMap = useMemo(() => {
    const map = new Map<number, {
      name: string;
      barcode: string;
      units: UnitWithColors[];
    }>();

    products.forEach((p: WarehouseProduct) => {
      const pid = Number(p.product_id || p.product?.id || p.id);
      if (!map.has(pid)) {
        map.set(pid, {
          name: p.product_name || p.name || p.product?.name || '',
          barcode: p.barcode || p.product?.barcode || '',
          units: p.units || p.product?.units || [],
        });
      }
    });

    return map;
  }, [products]);

  const resolveItemDetails = (item: TransferDocumentItem) => {
    const product = productLookupMap.get(item.product_id);
    const productName = product?.name || `#${item.product_id}`;

    let unitName = '-';
    let colorName = '-';
    let hexCode = '';
    let barcode = product?.barcode || '-';

    if (item.product_unit_id && product?.units) {
      const unit = product.units.find(u => Number(u.id) === Number(item.product_unit_id));
      if (unit) {
        unitName = unit.unit_name || '-';
        barcode = unit.barcode || barcode;

        if (item.color_id) {
          const color = (unit.colors || []).find(c => Number(c.color_id) === Number(item.color_id));
          if (color) {
            colorName = color.color || '-';
            hexCode = color.hex_code || '';
          }
        }
      }
    }

    return { productName, unitName, colorName, hexCode, barcode };
  };

  // ========== 7. تغيير الكمية ==========
  const handleQuantityChange = (
    productId: number,
    unitId: number,
    colorId: number,
    quantity: number,
  ) => {
    const row = flattenedModalProducts.find(
      (r) =>
        r.productId === productId &&
        r.unitId === unitId &&
        r.colorId === colorId,
    );
    if (!row) return;

    setTransferItems((prev) =>
      prev.map((item) =>
        item.product_id === productId &&
          item.product_unit_id === unitId &&
          item.color_id === colorId
          ? {
            ...item,
            quantity:
              row.stock < 0
                ? Math.max(1, quantity)
                : Math.min(Math.max(1, quantity), row.stock),
          }
          : item,
      ),
    );
  };

  // ========== 8. تغيير الملاحظة ==========
  const handleNoteChange = (noteKey: string, note: string) => {
    setProductNotes((prev) => ({ ...prev, [noteKey]: note }));
  };

  // ========== 9. حذف منتج ==========
  const handleRemoveProduct = (
    productId: number,
    unitId: number,
    colorId: number,
  ) => {
    const noteKey = `${productId}-${unitId}-${colorId}`;
    setTransferItems((prev) =>
      prev.filter(
        (item) =>
          !(
            item.product_id === productId &&
            item.product_unit_id === unitId &&
            item.color_id === colorId
          ),
      ),
    );
    setProductNotes((prev) => {
      const newNotes = { ...prev };
      delete newNotes[noteKey];
      return newNotes;
    });
  };

  // ========== 10. فتح/غلق المودال ==========
  const handleOpenTransfer = () => {
    setFromWarehouse('');
    setToWarehouse('');
    setTransferItems([]);
    setProductNotes({});
    setModalSearchText('');
    setCollapsedProducts(new Set());
    setShowTransferModal(true);
  };

  const handleCloseTransfer = () => {
    setShowTransferModal(false);
    setTransferItems([]);
    setProductNotes({});
    setFromWarehouse('');
    setToWarehouse('');
    setModalSearchText('');
    setCollapsedProducts(new Set());
  };

  // ========== 11. إعادة تعيين الفلاتر ==========
  const handleResetFilters = () => {
    setWarehouseFilter('all');
    setSearchText('');
    setTimeout(() => refetch(), 100);
  };

  // ========== 12. تصدير بيانات المودال ==========
  const handleExportTransferData = () => {
    if (flattenedModalProducts.length === 0) {
      toast({ title: t.noDataToExport, variant: 'destructive' });
      return;
    }

    const exportData = flattenedModalProducts.map((row) => {
      const transferItem = transferItems.find(
        (item) =>
          item.product_id === row.productId &&
          item.product_unit_id === row.unitId &&
          item.color_id === row.colorId,
      );
      const noteKey = `${row.productId}-${row.unitId}-${row.colorId}`;

      return language === 'ar'
        ? {
          المنتج: row.productName,
          المقاس: row.unitName || '-',
          اللون: row.colorName || '-',
          الباركود: row.barcode || '-',
          'المخزون المتاح': row.stock,
          'كمية التحويل': transferItem?.quantity || 0,
          ملاحظة: productNotes[noteKey] || '',
        }
        : {
          Product: row.productName,
          Size: row.unitName || '-',
          Color: row.colorName || '-',
          Barcode: row.barcode || '-',
          'Available Stock': row.stock,
          'Transfer Quantity': transferItem?.quantity || 0,
          Note: productNotes[noteKey] || '',
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
      { wch: 18 }, { wch: 18 }, { wch: 30 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      language === 'ar' ? 'بيانات التحويل' : 'Transfer Data',
    );
    XLSX.writeFile(
      workbook,
      `warehouse-transfer-${new Date().toISOString().split('T')[0]}.xlsx`,
    );
    toast({ title: t.exportSuccess });
  };

  // ========== 13. تصدير بيانات الجدول الرئيسي ==========
  const handleExportProductsData = () => {
    if (flattenedMainProducts.length === 0) {
      toast({ title: t.noDataToExport, variant: 'destructive' });
      return;
    }

    const exportData = flattenedMainProducts.map((item) => ({
      ...(language === 'ar'
        ? {
          'رقم التحويل': item.transferNumber,
          المنتج: item.productName || '-',
          المقاس: item.unitName || '-',
          اللون: item.colorName || '-',
          الباركود: item.barcode || '-',
          المخزن: item.warehouseName || '-',
          المخزون: item.stock,
        }
        : {
          'Transfer Number': item.transferNumber,
          Product: item.productName || '-',
          Size: item.unitName || '-',
          Color: item.colorName || '-',
          Barcode: item.barcode || '-',
          Warehouse: item.warehouseName || '-',
          Stock: item.stock,
        }),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 24 }, { wch: 16 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      language === 'ar' ? 'تفاصيل مخزون المخازن' : 'Warehouse Stock Details',
    );
    XLSX.writeFile(
      workbook,
      `warehouse-stock-details-${new Date().toISOString().split('T')[0]}.xlsx`,
    );
    toast({ title: t.exportSuccess });
  };

  // ========== تصدير سجل مستندات التحويل ==========
  const handleExportTransferHistory = () => {
    if (!transferHistory.length) {
      toast({ title: t.noDataToExport, variant: 'destructive' });
      return;
    }
    const rows = transferHistory.map((row) => language === 'ar' ? ({
      'رقم التحويل': row.transfer_number,
      'التاريخ': row.transfer_date,
      'من مخزن': row.source_warehouse_name || getWarehouseName(row.from_warehouse_id),
      'إلى مخزن': row.destination_warehouse_name || getWarehouseName(row.to_warehouse_id),
      'عدد الأصناف': Number(row.items_count || 0),
      'إجمالي الكمية': Number(row.total_quantity || 0),
      'إجمالي القيمة': Number(row.inventory_value || 0),
      'منشئ المستند': row.creator_name || '-',
    }) : ({
      'Transfer Number': row.transfer_number,
      Date: row.transfer_date,
      'From Warehouse': row.source_warehouse_name || getWarehouseName(row.from_warehouse_id),
      'To Warehouse': row.destination_warehouse_name || getWarehouseName(row.to_warehouse_id),
      'Items Count': Number(row.items_count || 0),
      'Total Quantity': Number(row.total_quantity || 0),
      'Total Value': Number(row.inventory_value || 0),
      Creator: row.creator_name || '-',
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 24 }, { wch: 22 }, { wch: 24 }, { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 22 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, language === 'ar' ? 'سجل التحويلات' : 'Transfer History');
    XLSX.writeFile(workbook, `warehouse-transfer-history-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: t.exportSuccess });
  };

  // ========== 14. اسم المخزن ==========
  const getWarehouseName = (warehouseId: string | number) => {
    const w = warehouses.find(
      (w: Warehouse) => w.id === Number(warehouseId),
    );
    if (!w) return '-';
    return language === 'ar' ? w.name_ar || w.name : w.name;
  };

  // ========== 15. تفليط منتجات المودال ==========
  const flattenedModalProducts = useMemo<VariantRow[]>(() => {
    const rows: VariantRow[] = [];

    modalProducts.forEach((item: WarehouseProduct) => {
      const productId = Number(
        item.product_id || item.product?.id || item.id,
      );
      const productName =
        item.name || item.product_name || item.product?.name || '';
      const units = item.units || item.product?.units || [];

      if (!units.length) {
        const stock = Number(item.stock) || 0;
        if (stock > 0) {
          rows.push({
            rowKey: `${productId}-0-0`,
            productId,
            productName,
            unitId: 0,
            unitName: '',
            colorId: 0,
            colorName: '',
            hexCode: '',
            barcode: item.barcode || item.product?.barcode || '',
            stock,
            totalStock: stock,
          });
        }
        return;
      }

      units.forEach((unit: UnitWithColors) => {
        (unit.colors || []).forEach((color: ColorStock) => {
          let warehouseQty: number | null = null;

          if (color.warehouse_stock != null) {
            warehouseQty = Number(color.warehouse_stock);
          } else if (
            Array.isArray(color.warehouseStocks) &&
            color.warehouseStocks.length > 0
          ) {
            warehouseQty = Number(color.warehouseStocks[0].stock);
          }

          const stockForWarehouse =
            warehouseQty != null ? warehouseQty : Number(color.stock) || 0;
          const totalStock = Number(color.stock) || 0;

          if (stockForWarehouse <= 0) return;

          rows.push({
            rowKey: `${productId}-${unit.id}-${color.color_id}`,
            productId,
            productName,
            unitId: Number(unit.id),
            unitName: unit.unit_name || '',
            colorId: Number(color.color_id),
            colorName: color.color || '',
            hexCode: color.hex_code || '',
            barcode:
              unit.barcode || item.barcode || item.product?.barcode || '',
            stock: stockForWarehouse,
            totalStock,
          });
        });
      });
    });

    return rows;
  }, [modalProducts]);

  // ========== 16. تفليط منتجات الجدول الرئيسي (مع إضافة رقم التحويل) ==========
  const flattenedMainProducts = useMemo(() => {
    const rows: Array<{
      rowKey: string;
      productName: string;
      unitName: string;
      colorName: string;
      hexCode: string;
      barcode: string;
      warehouseName: string;
      stock: number;
      transferNumber: string;
    }> = [];

    products.forEach((item: WarehouseProduct) => {
      const productId = Number(item.product_id || item.product?.id || item.id);
      const productName = item.name || item.product_name || item.product?.name || '';
      const warehouseName = item.warehouse_name || '-';
      const units = item.units || item.product?.units || [];

      if (!units.length) {
        const stock = Number(item.stock) || 0;
        const key = `${productId}-0-0`;
        const transferNumber = lastTransferMap.get(key) || '-';
        rows.push({
          rowKey: `${productId}-0-0-${item.warehouse_id || item.id}`,
          productName,
          unitName: '-',
          colorName: '-',
          hexCode: '',
          barcode: item.barcode || item.product?.barcode || '-',
          warehouseName,
          stock,
          transferNumber,
        });
        return;
      }

      units.forEach((unit: UnitWithColors) => {
        (unit.colors || []).forEach((color: ColorStock) => {
          let warehouseQty: number | null = null;
          if (color.warehouse_stock != null) {
            warehouseQty = Number(color.warehouse_stock);
          } else if (Array.isArray(color.warehouseStocks) && color.warehouseStocks.length > 0) {
            warehouseQty = Number(color.warehouseStocks[0].stock);
          }
          const stock = warehouseQty != null ? warehouseQty : Number(color.stock) || 0;
          const key = `${productId}-${unit.id}-${color.color_id}`;
          const transferNumber = lastTransferMap.get(key) || '-';

          rows.push({
            rowKey: `${productId}-${unit.id}-${color.color_id}-${item.warehouse_id || item.id}`,
            productName,
            unitName: unit.unit_name || '-',
            colorName: color.color || '-',
            hexCode: color.hex_code || '',
            barcode: unit.barcode || item.barcode || item.product?.barcode || '-',
            warehouseName,
            stock,
            transferNumber,
          });
        });
      });
    });

    return rows;
  }, [products, lastTransferMap]);

  // ========== 17. تجميع منتجات المودال ==========
  const groupedModalProducts = useMemo<ProductGroup[]>(() => {
    const groups = new Map<number, ProductGroup>();

    flattenedModalProducts.forEach((row) => {
      if (!groups.has(row.productId)) {
        groups.set(row.productId, {
          productId: row.productId,
          productName: row.productName,
          variants: [],
          totalStock: 0,
        });
      }
      const group = groups.get(row.productId)!;
      group.variants.push(row);
      group.totalStock += row.stock;
    });

    return Array.from(groups.values());
  }, [flattenedModalProducts]);

  // ========== 18. طي/توسيع منتج ==========
  const toggleProductExpansion = (productId: number) => {
    setCollapsedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleAllGroups = () => {
    if (collapsedProducts.size === groupedModalProducts.length) {
      setCollapsedProducts(new Set());
    } else {
      setCollapsedProducts(new Set(groupedModalProducts.map((g) => g.productId)));
    }
  };

  const getGroupStats = (productId: number) => {
    const items = transferItems.filter((t) => t.product_id === productId);
    const quantity = items.reduce((s, t) => s + t.quantity, 0);
    return { count: items.length, quantity };
  };

  const transferNumberPrefix = useMemo(
    () => buildTransferNumberPrefix(new Date()),
    [showTransferModal, modalProducts.length],
  );

  return (
    <div className="space-y-4">
      {/* ===== الهيدر ===== */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Warehouse className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportProductsData}
            disabled={isLoading || flattenedMainProducts.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 ml-2" />
            {t.export}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 ml-2" />
            {t.refresh}
          </Button>
          <Button size="sm" onClick={handleOpenTransfer}>
            <Plus className="h-4 w-4 ml-2" />
            {t.newTransfer}
          </Button>
        </div>
      </div>

      {/* ===== الإحصائيات ===== */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t.totalItems}</p>
              <p className="text-lg font-bold">{stats.totalItems}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Warehouse className="h-5 w-5 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">{t.totalStock}</p>
              <p className="text-lg font-bold">
                {stats.totalStock.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== كارت آخر تحويل ===== */}
      {lastTransferDocument && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-primary" />
                {t.documentInfo}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{t.transferNumber}</p>
                <p className="font-mono font-bold text-primary text-lg">
                  {lastTransferDocument.transfer_number}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.transferDate}</p>
                <p className="font-medium">
                  {new Date(lastTransferDocument.transfer_date).toLocaleString(
                    language === 'ar' ? 'ar-EG' : 'en-US',
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.totalQuantity}</p>
                <p className="font-bold text-lg">
                  {lastTransferDocument.total_quantity.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t text-xs">
              {lastTransferDocument.from_warehouse_id && (
                <div className="flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 text-primary rotate-180" />
                  <span className="text-muted-foreground">{t.fromLabel}:</span>
                  <Badge variant="outline">{getWarehouseName(lastTransferDocument.from_warehouse_id)}</Badge>
                </div>
              )}
              {lastTransferDocument.to_warehouse_id && (
                <div className="flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 text-success" />
                  <span className="text-muted-foreground">{t.toLabel}:</span>
                  <Badge variant="outline">{getWarehouseName(lastTransferDocument.to_warehouse_id)}</Badge>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                <span className="text-muted-foreground">{t.itemsCount}:</span>
                <Badge variant="secondary">
                  {lastTransferDocument.items_count ?? (lastTransferDocument.items?.length || 0)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== الفلاتر ===== */}
      {/* <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {t.filter}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="flex-1">
              <Select
                value={warehouseFilter}
                onValueChange={setWarehouseFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.allWarehouses} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allWarehouses}</SelectItem>
                  {warehouses.map((w: Warehouse) => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      {language === 'ar' ? w.name_ar || w.name : w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.search}
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  const timeoutId = setTimeout(() => refetch(), 500);
                  return () => clearTimeout(timeoutId);
                }}
                className="pr-9"
              />
            </div>
            <Button variant="outline" size="icon" onClick={handleResetFilters}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card> */}

      {/* ===== سجل مستندات تحويل المخازن ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <List className="h-4 w-4" />
              {language === 'ar' ? 'سجل مستندات تحويل المخازن' : 'Warehouse Transfer Documents'}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Input
                value={historySearch}
                onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                placeholder={language === 'ar' ? 'ابحث برقم التحويل أو المخزن...' : 'Search transfer number or warehouse...'}
                className="w-full sm:w-64"
              />
              <Input type="date" value={historyDateFrom} onChange={(e) => { setHistoryDateFrom(e.target.value); setHistoryPage(1); }} className="w-full sm:w-40" />
              <Input type="date" value={historyDateTo} onChange={(e) => { setHistoryDateTo(e.target.value); setHistoryPage(1); }} className="w-full sm:w-40" />
              <Button variant="outline" size="icon" onClick={() => { setHistorySearch(''); setHistoryDateFrom(''); setHistoryDateTo(''); setHistoryPage(1); }} title={language === 'ar' ? 'مسح الفلاتر' : 'Clear filters'}>
                <X className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportTransferHistory} disabled={historyLoading || transferHistory.length === 0}>
                <FileSpreadsheet className="h-4 w-4 ml-2" />{t.export}
              </Button>
              <Button variant="outline" size="icon" onClick={() => refetchTransferHistory()} title={t.refresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[1050px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'رقم التحويل' : 'Transfer Number'}</TableHead>
                    <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{language === 'ar' ? 'من مخزن' : 'From Warehouse'}</TableHead>
                    <TableHead>{language === 'ar' ? 'إلى مخزن' : 'To Warehouse'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'عدد الأصناف' : 'Items Count'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'إجمالي الكمية' : 'Total Quantity'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'إجمالي القيمة' : 'Total Value'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الإجراء' : 'Action'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8">{t.loading}</TableCell></TableRow>
                  ) : transferHistory.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{language === 'ar' ? 'لا توجد مستندات تحويل حتى الآن' : 'No transfer documents found'}</TableCell></TableRow>
                  ) : transferHistory.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell><Badge variant="outline" className="font-mono text-primary">{row.transfer_number}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap">{row.transfer_date ? new Date(row.transfer_date).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US') : '-'}</TableCell>
                      <TableCell>{row.source_warehouse_name || getWarehouseName(row.from_warehouse_id)}</TableCell>
                      <TableCell>{row.destination_warehouse_name || getWarehouseName(row.to_warehouse_id)}</TableCell>
                      <TableCell className="text-center">{Number(row.items_count || 0).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</TableCell>
                      <TableCell className="text-center font-semibold">{Number(row.total_quantity || 0).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</TableCell>
                      <TableCell className="text-center font-semibold">{Number(row.inventory_value || 0).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => { setSelectedHistoryTransferId(row.id); setShowHistoryDetailsModal(true); }}>
                          <Eye className="h-4 w-4" />{language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t p-3 text-sm">
            <span className="text-muted-foreground">{language === 'ar' ? `إجمالي المستندات: ${historyPagination.total || 0}` : `Total documents: ${historyPagination.total || 0}`}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={historyPage <= 1 || historyLoading} onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}>{language === 'ar' ? 'السابق' : 'Previous'}</Button>
              <span>{historyPagination.current_page || historyPage} / {historyPagination.last_page || 1}</span>
              <Button variant="outline" size="sm" disabled={historyPage >= (historyPagination.last_page || 1) || historyLoading} onClick={() => setHistoryPage((p) => p + 1)}>{language === 'ar' ? 'التالي' : 'Next'}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== جدول المنتجات الرئيسي (Index) ===== */}


      {/* ===== مودال إنشاء التحويل ===== */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="w-[96vw] max-w-[1500px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              {t.newTransfer}
            </DialogTitle>
          </DialogHeader>

          {/* معاينة رقم التحويل */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
            <div>
              <p className="text-xs text-muted-foreground">{t.transferNumber}</p>
              <p className="font-mono font-semibold">
                {transferNumberPrefix}*
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t.transferDate}</p>
              <p className="font-medium">
                {new Date().toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
              </p>
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {t.autoDocumentNumber}
            </p>
          </div>

          <div className="space-y-4 py-4">
            {/* اختيار المخازن */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  {t.fromWarehouse}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={fromWarehouse}
                  onValueChange={(value) => {
                    setFromWarehouse(value);
                    setModalSearchText('');
                    setTransferItems([]);
                    setProductNotes({});
                    setCollapsedProducts(new Set());
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.selectFrom} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w: Warehouse) => (
                      <SelectItem key={w.id} value={w.id.toString()}>
                        {language === 'ar' ? w.name_ar || w.name : w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {t.toWarehouse}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={toWarehouse}
                  onValueChange={setToWarehouse}
                  disabled={!fromWarehouse}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.selectTo} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses
                      .filter(
                        (w: Warehouse) => w.id.toString() !== fromWarehouse,
                      )
                      .map((w: Warehouse) => (
                        <SelectItem key={w.id} value={w.id.toString()}>
                          {language === 'ar' ? w.name_ar || w.name : w.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {fromWarehouse && toWarehouse && (
              <>
                {/* شريط البحث + الإجراءات */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t.search}
                      value={modalSearchText}
                      onChange={(e) => setModalSearchText(e.target.value)}
                      className="pr-9"
                    />
                    {modalSearchText && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-6 w-6"
                        onClick={() => setModalSearchText('')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleAllGroups}
                    className="gap-2 whitespace-nowrap"
                    disabled={groupedModalProducts.length === 0}
                  >
                    {collapsedProducts.size === groupedModalProducts.length ? (
                      <>
                        <ChevronsUpDown className="h-4 w-4" />
                        {t.expandAll}
                      </>
                    ) : (
                      <>
                        <ChevronsDownUp className="h-4 w-4" />
                        {t.collapseAll}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportTransferData}
                    disabled={modalLoading || flattenedModalProducts.length === 0}
                    className="gap-2 whitespace-nowrap"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    {t.export}
                  </Button>
                </div>

                {/* الجدول المجمع حسب المنتج */}
                <div className="border rounded-lg">
                  <div className="p-3 bg-muted/30 border-b flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {t.fromWarehouse}: {getWarehouseName(fromWarehouse)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Package className="h-3 w-3" />
                        {groupedModalProducts.length} {language === 'ar' ? 'منتج' : 'products'}
                      </Badge>
                      {modalSearchText && (
                        <Badge variant="outline" className="gap-1">
                          <Search className="h-3 w-3" />
                          {modalSearchText}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <ScrollArea className="h-[420px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>{t.product}</TableHead>
                          <TableHead>{language === 'ar' ? 'المقاس' : 'Size'}</TableHead>
                          <TableHead>{language === 'ar' ? 'اللون' : 'Color'}</TableHead>
                          <TableHead>{t.barcode}</TableHead>
                          <TableHead className="w-24 text-center">{t.stock}</TableHead>
                          <TableHead className="w-24 text-center">{t.quantity}</TableHead>
                          <TableHead className="w-32">{t.note}</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {modalLoading ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8">
                              {t.loading}
                            </TableCell>
                          </TableRow>
                        ) : groupedModalProducts.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="text-center py-8 text-muted-foreground"
                            >
                              <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
                              {modalSearchText ? (
                                <span>
                                  {t.noData}{' '}
                                  <span className="font-mono">"{modalSearchText}"</span>
                                </span>
                              ) : (
                                t.noData
                              )}
                            </TableCell>
                          </TableRow>
                        ) : (
                          groupedModalProducts.map((group) => {
                            const isCollapsed = collapsedProducts.has(group.productId);
                            const groupStats = getGroupStats(group.productId);
                            const hasSelection = groupStats.count > 0;

                            return (
                              <React.Fragment key={`group-${group.productId}`}>
                                {/* سطر المنتج */}
                                <TableRow
                                  className={`cursor-pointer select-none border-t-2 border-primary/20 ${hasSelection
                                    ? 'bg-primary/10 hover:bg-primary/15'
                                    : 'bg-muted/40 hover:bg-muted/60'
                                    }`}
                                  onClick={() => toggleProductExpansion(group.productId)}
                                >
                                  <TableCell className="font-semibold">
                                    <div className="flex items-center gap-2">
                                      {isCollapsed ? (
                                        <ChevronRight className="h-4 w-4 text-primary" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-primary" />
                                      )}
                                      <span className="text-sm">{group.productName}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell colSpan={2}>
                                    <Badge variant="outline" className="text-xs gap-1">
                                      {group.variants.length}{' '}
                                      {group.variants.length === 1 ? t.variant : t.variants}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {group.variants.length === 1
                                      ? group.variants[0].barcode || '-'
                                      : `—`}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="secondary" className="font-bold">
                                      {group.totalStock}
                                    </Badge>
                                  </TableCell>
                                  <TableCell colSpan={3}>
                                    {hasSelection && (
                                      <div className="flex items-center gap-2">
                                        <Badge className="bg-primary text-primary-foreground gap-1">
                                          <Package className="h-3 w-3" />
                                          {groupStats.quantity}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          ({groupStats.count} {t.selected})
                                        </span>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>

                                {/* سطور المتغيرات */}
                                {!isCollapsed &&
                                  group.variants.map((row) => {
                                    const transferItem = transferItems.find(
                                      (item) =>
                                        item.product_id === row.productId &&
                                        item.product_unit_id === row.unitId &&
                                        item.color_id === row.colorId,
                                    );
                                    const noteKey = `${row.productId}-${row.unitId}-${row.colorId}`;

                                    return (
                                      <TableRow
                                        key={row.rowKey}
                                        className={transferItem ? 'bg-primary/5' : 'bg-background'}
                                      >
                                        <TableCell className="text-xs pl-8 text-muted-foreground">
                                          <span className="opacity-60">↳</span>
                                        </TableCell>
                                        <TableCell>
                                          {row.unitName ? (
                                            <Badge variant="secondary" className="text-xs">
                                              {row.unitName}
                                            </Badge>
                                          ) : (
                                            <span className="text-xs text-muted-foreground">-</span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {row.colorName ? (
                                            <div className="flex items-center gap-1.5">
                                              <span
                                                className="inline-block w-4 h-4 rounded-full border border-border"
                                                style={{ backgroundColor: row.hexCode }}
                                              />
                                              <span className="text-xs">{row.colorName}</span>
                                            </div>
                                          ) : (
                                            <span className="text-xs text-muted-foreground">-</span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className="font-mono text-xs">
                                            {row.barcode || '-'}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Badge
                                            variant={row.stock > 0 ? 'secondary' : 'destructive'}
                                          >
                                            {row.stock}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Input
                                            type="number"
                                            min="1"
                                            max={row.stock >= 0 ? row.stock : undefined}
                                            value={transferItem?.quantity || ''}
                                            onChange={(e) => {
                                              const qty = parseInt(e.target.value) || 0;
                                              if (qty > 0) {
                                                if (transferItem) {
                                                  handleQuantityChange(
                                                    row.productId,
                                                    row.unitId,
                                                    row.colorId,
                                                    qty,
                                                  );
                                                } else {
                                                  if (row.stock >= 0 && qty > row.stock) {
                                                    toast({
                                                      title: t.error,
                                                      description:
                                                        language === 'ar'
                                                          ? `الكمية المطلوبة أكبر من المتاح (${row.stock})`
                                                          : `Requested quantity exceeds available stock (${row.stock})`,
                                                      variant: 'destructive',
                                                    });
                                                    return;
                                                  }
                                                  setTransferItems((prev) => [
                                                    ...prev,
                                                    {
                                                      product_id: row.productId,
                                                      product_unit_id: row.unitId,
                                                      color_id: row.colorId,
                                                      quantity: qty,
                                                    },
                                                  ]);
                                                }
                                              } else if (transferItem) {
                                                handleRemoveProduct(
                                                  row.productId,
                                                  row.unitId,
                                                  row.colorId,
                                                );
                                              }
                                            }}
                                            className="w-20 text-center mx-auto"
                                            placeholder="0"
                                            disabled={row.stock === 0}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            value={productNotes[noteKey] || ''}
                                            onChange={(e) =>
                                              handleNoteChange(noteKey, e.target.value)
                                            }
                                            placeholder={t.note}
                                            disabled={!transferItem}
                                            className="h-8 text-xs"
                                          />
                                        </TableCell>
                                        <TableCell>
                                          {transferItem && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() =>
                                                handleRemoveProduct(
                                                  row.productId,
                                                  row.unitId,
                                                  row.colorId,
                                                )
                                              }
                                              className="h-8 w-8 text-destructive hover:text-destructive"
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                              </React.Fragment>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>

                {/* ملخص التحويل */}
                {transferItems.length > 0 && (
                  <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-lg border border-primary/20">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-sm text-muted-foreground">{t.totalItems}</p>
                          <p className="text-2xl font-bold text-primary">
                            {transferItems.length}
                          </p>
                        </div>
                        <div className="h-10 w-px bg-border" />
                        <div>
                          <p className="text-sm text-muted-foreground">{t.totalQuantity}</p>
                          <p className="text-2xl font-bold text-primary">
                            {transferItems.reduce((sum, item) => sum + item.quantity, 0)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <ArrowLeft className="h-5 w-5 text-success" />
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{t.toWarehouse}</p>
                          <p className="font-bold text-success">
                            {getWarehouseName(toWarehouse)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sticky bottom-0 bg-background pt-4 border-t">
            <Button variant="outline" onClick={handleCloseTransfer}>
              {t.cancel}
            </Button>
            <Button
              onClick={() => transferMutation.mutate()}
              disabled={
                !fromWarehouse ||
                !toWarehouse ||
                fromWarehouse === toWarehouse ||
                transferItems.length === 0 ||
                transferMutation.isPending
              }
              className="gap-2"
            >
              {transferMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t.transferring}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t.saveTransfer}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== نافذة تفاصيل مستند من سجل التحويلات ===== */}
      <Dialog open={showHistoryDetailsModal} onOpenChange={(open) => { setShowHistoryDetailsModal(open); if (!open) setSelectedHistoryTransferId(null); }}>
        <DialogContent className="w-[96vw] max-w-[1350px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              {language === 'ar' ? 'تفاصيل مستند التحويل' : 'Transfer Document Details'}
              {historyDetails?.transfer?.transfer_number ? ` - ${historyDetails.transfer.transfer_number}` : ''}
            </DialogTitle>
          </DialogHeader>
          {historyDetailsLoading ? (
            <div className="py-12 text-center">{t.loading}</div>
          ) : historyDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <div><p className="text-muted-foreground">{t.transferNumber}</p><p className="font-bold font-mono">{historyDetails.transfer.transfer_number}</p></div>
                <div><p className="text-muted-foreground">{t.transferDate}</p><p className="font-medium">{historyDetails.transfer.transfer_date ? new Date(historyDetails.transfer.transfer_date).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US') : '-'}</p></div>
                <div><p className="text-muted-foreground">{t.fromWarehouse}</p><p className="font-medium">{historyDetails.transfer.source_warehouse_name || getWarehouseName(historyDetails.transfer.from_warehouse_id)}</p></div>
                <div><p className="text-muted-foreground">{t.toWarehouse}</p><p className="font-medium">{historyDetails.transfer.destination_warehouse_name || getWarehouseName(historyDetails.transfer.to_warehouse_id)}</p></div>
                <div><p className="text-muted-foreground">{language === 'ar' ? 'منشئ المستند' : 'Created By'}</p><p className="font-medium">{historyDetails.transfer.creator_name || '-'}</p></div>
                <div><p className="text-muted-foreground">{t.totalItems}</p><p className="font-bold">{historyDetails.items_count ?? historyDetails.items?.length ?? 0}</p></div>
                <div><p className="text-muted-foreground">{t.totalQuantity}</p><p className="font-bold">{historyDetails.total_quantity ?? 0}</p></div>
                <div><p className="text-muted-foreground">{language === 'ar' ? 'إجمالي القيمة' : 'Total Value'}</p><p className="font-bold">{Number(historyDetails.inventory_value ?? historyDetails.transfer.inventory_value ?? 0).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <ScrollArea className="max-h-[520px] w-full">
                  <div className="min-w-[1250px]">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>{t.product}</TableHead>
                        <TableHead>{language === 'ar' ? 'الوحدة' : 'Unit'}</TableHead>
                        <TableHead>{language === 'ar' ? 'اللون' : 'Color'}</TableHead>
                        <TableHead>{t.barcode}</TableHead>
                        <TableHead className="text-center">{t.quantity}</TableHead>
                        <TableHead className="text-center">{language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost'}</TableHead>
                        <TableHead className="text-center">{language === 'ar' ? 'الإجمالي' : 'Total'}</TableHead>
                        <TableHead className="text-center">{t.sourceBalance}</TableHead>
                        <TableHead className="text-center">{t.destBalance}</TableHead>
                        <TableHead>{t.note}</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {(historyDetails.items || []).map((item, index) => (
                          <TableRow key={item.id || index}>
                            <TableCell className="font-medium">{item.product_name || `#${item.product_id}`}</TableCell>
                            <TableCell>{item.unit_name || '-'}</TableCell>
                            <TableCell>{item.color_name || '-'}</TableCell>
                            <TableCell className="font-mono text-xs">{item.unit_barcode || item.product_barcode || '-'}</TableCell>
                            <TableCell className="text-center font-semibold">{item.quantity}</TableCell>
                            <TableCell className="text-center">{Number(item.unit_cost || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-center">{Number(item.total_cost || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-center"><span className="text-muted-foreground">{item.source_before}</span><ArrowRight className="inline h-3 w-3 mx-1" /><b>{item.source_after}</b></TableCell>
                            <TableCell className="text-center"><span className="text-muted-foreground">{item.destination_before}</span><ArrowRight className="inline h-3 w-3 mx-1" /><b>{item.destination_after}</b></TableCell>
                            <TableCell className="max-w-[180px] whitespace-normal">{item.note || '-'}</TableCell>
                          </TableRow>
                        ))}
                        {(!historyDetails.items || historyDetails.items.length === 0) && <TableRow><TableCell colSpan={10} className="text-center py-8">{t.noData}</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </div>
          ) : <div className="py-10 text-center text-muted-foreground">{language === 'ar' ? 'تعذر تحميل تفاصيل المستند' : 'Could not load document details'}</div>}
          <DialogFooter><Button variant="outline" onClick={() => { setShowHistoryDetailsModal(false); setSelectedHistoryTransferId(null); }}>{t.cancel}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ النافذة المنبثقة (Popup) لعرض تفاصيل التحويل بالكامل */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="w-[96vw] max-w-[1200px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              {t.transferDetails} - {lastTransferDocument?.transfer_number}
            </DialogTitle>
          </DialogHeader>

          {lastTransferDocument && (
            <div className="space-y-4">
              {/* ملخص علوي */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t.transferNumber}: </span>
                  <span className="font-bold font-mono">{lastTransferDocument.transfer_number}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t.fromLabel}: </span>
                  <Badge variant="outline">{getWarehouseName(lastTransferDocument.from_warehouse_id || '')}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">{t.toLabel}: </span>
                  <Badge variant="outline">{getWarehouseName(lastTransferDocument.to_warehouse_id || '')}</Badge>
                </div>
              </div>

              {/* الجدول التفصيلي داخل النافذة */}
              <div className="border rounded-lg overflow-hidden">
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>{t.transferNumber}</TableHead>
                        <TableHead>{t.product}</TableHead>
                        <TableHead>{language === 'ar' ? 'المقاس' : 'Size'}</TableHead>
                        <TableHead>{language === 'ar' ? 'اللون' : 'Color'}</TableHead>
                        <TableHead>{t.barcode}</TableHead>
                        <TableHead>{language === 'ar' ? 'المخزن (من)' : 'Warehouse (From)'}</TableHead>
                        <TableHead>{language === 'ar' ? 'المخزن (إلى)' : 'Warehouse (To)'}</TableHead>
                        <TableHead className="text-center">{language === 'ar' ? 'المخزون (الكمية)' : 'Stock (Qty)'}</TableHead>
                        <TableHead className="text-center">{t.sourceBalance}</TableHead>
                        <TableHead className="text-center">{t.destBalance}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lastTransferDocument.items?.map((item, idx) => {
                        const resolved = resolveItemDetails(item);
                        return (
                          <TableRow key={`modal-transfer-item-${idx}`}>
                            <TableCell className="font-mono text-xs text-primary font-bold">
                              {lastTransferDocument.transfer_number}
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {resolved.productName}
                            </TableCell>
                            <TableCell>
                              {resolved.unitName !== '-' ? (
                                <Badge variant="secondary" className="text-xs">
                                  {resolved.unitName}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {resolved.colorName !== '-' ? (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="inline-block w-4 h-4 rounded-full border border-border"
                                    style={{ backgroundColor: resolved.hexCode }}
                                  />
                                  <span className="text-xs">{resolved.colorName}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {resolved.barcode || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                {getWarehouseName(lastTransferDocument.from_warehouse_id || '')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-success/5 text-success border-success/20">
                                {getWarehouseName(lastTransferDocument.to_warehouse_id || '')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-primary text-primary-foreground font-bold text-sm">
                                {item.quantity}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="text-muted-foreground line-through text-xs">
                                  {item.source_before}
                                </span>
                                <ArrowRight className="h-3 w-3 text-destructive rotate-180" />
                                <span className="font-bold text-destructive text-sm">
                                  {item.source_after}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="text-muted-foreground line-through text-xs">
                                  {item.destination_before}
                                </span>
                                <ArrowRight className="h-3 w-3 text-success" />
                                <span className="font-bold text-success text-sm">
                                  {item.destination_after}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              {t.cancel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockTransfer;