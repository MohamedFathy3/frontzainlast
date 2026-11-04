import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRegionalSettings } from '@/contexts/RegionalSettingsContext';
import { cn } from '@/lib/utils';
import { Package, Layers, Edit2, Box, DollarSign, Barcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import StockMatrixGrid from './StockMatrixGrid';

// ========== Interfaces ==========
interface ColorStock {
  id: number;
  color_id: number;
  color: string;
  stock: number;
  hex_code?: string | null;
  // ✅ جديد: رصيد المخزن المحدد
  warehouse_stock?: number | null;
  warehouseStocks?: Array<{ warehouse_id: number; stock: number }>;
}

interface ProductVariant {
  id: number;
  unit_id: number;
  unit_name: string;
  cost_price: string;
  sell_price: string;
  barcode: string;
  colors: ColorStock[];
}

interface ProductVariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    nameAr: string;
    price: number;
    cost: number;
    sku: string;
    stock: number;
    image?: string;
    imageUrl?: string;
    image_url?: string;
    minStock?: number;
    units?: ProductVariant[];
  } | null;
  onEditProduct?: () => void;
  /** ✅ المخزن المختار حالياً — يمرَّر من الأب */
  warehouseId?: number | string | null;
}

// ✅ helper: الرصيد الفعلي للون
const getEffectiveColorStock = (
  color: ColorStock,
  warehouseId?: number | string | null,
): number => {
  // 1) warehouse_stock
  if (color.warehouse_stock != null) {
    const n = Number(color.warehouse_stock);
    if (!Number.isNaN(n)) return n;
  }

  // 2) warehouseStocks للمخزن المحدد
  if (
    warehouseId != null &&
    warehouseId !== '' &&
    warehouseId !== 'all' &&
    Array.isArray(color.warehouseStocks)
  ) {
    const wid = Number(warehouseId);
    const hit = color.warehouseStocks.find(
      (w) => Number(w.warehouse_id) === wid,
    );
    if (hit) return Number(hit.stock) || 0;
  }

  // 3) مجموع warehouseStocks
  if (Array.isArray(color.warehouseStocks) && color.warehouseStocks.length > 0) {
    return color.warehouseStocks.reduce(
      (s, w) => s + (Number(w.stock) || 0),
      0,
    );
  }

  // 4) fallback
  return Number(color.stock) || 0;
};

const ProductVariantsModal: React.FC<ProductVariantsModalProps> = ({
  isOpen,
  onClose,
  product,
  onEditProduct,
  warehouseId,
}) => {
  const { language } = useLanguage();
  const { formatCurrency } = useRegionalSettings();

  // ✅ نضيف warehouseId للـ queryKey عشان يتعمل refetch عند تغيير المخزن
  const { data: productDetails, isLoading } = useQuery({
    queryKey: ['product-variants-inventory', product?.id, warehouseId],
    queryFn: async () => {
      if (!product?.id) return null;

      try {
        // ✅ مرّر ?warehouse_id= لو موجود
        const url =
          warehouseId != null && warehouseId !== '' && warehouseId !== 'all'
            ? `/product/${product.id}?warehouse_id=${Number(warehouseId)}`
            : `/product/${product.id}`;

        const response = await api.get(url);
        return response.data.data;
      } catch (error) {
        console.error('Error fetching product details:', error);
        return null;
      }
    },
    enabled: isOpen && !!product?.id,
  });

  // ✅ variants من API
  const variants: ProductVariant[] = productDetails?.units || product?.units || [];

  // ✅ transform مع تمرير warehouse_stock و warehouseStocks
  const transformedVariants = variants
    .map((unit) => {
      if (unit.colors && unit.colors.length > 0) {
        return unit.colors.map((color) => ({
          id: `${unit.unit_id}-${color.color_id}`,
          sku: `${product?.sku || ''}-${unit.unit_id}-${color.color_id}`,
          barcode: unit.barcode || null,

          // ✅ الإجمالي
          stock: color.stock || 0,

          // ✅✅✅ الأهم: تمرير رصيد المخزن
          warehouse_stock: color.warehouse_stock ?? null,
          warehouseStocks: Array.isArray(color.warehouseStocks)
            ? color.warehouseStocks
            : [],

          price_adjustment:
            parseFloat(unit.sell_price || '0') - (product?.price || 0),
          cost_adjustment:
            parseFloat(unit.cost_price || '0') - (product?.cost || 0),
          is_active: true,
          size: {
            id: unit.unit_id.toString(),
            name: unit.unit_name,
            name_ar: unit.unit_name,
            code: unit.unit_name,
          },
          color: {
            id: color.color_id.toString(),
            name: color.color,
            name_ar: color.color,
            hex_code: color.hex_code || getColorHex(color.color),
          },
        }));
      }

      // منتج بدون ألوان
      return [
        {
          id: unit.unit_id.toString(),
          sku: `${product?.sku || ''}-${unit.unit_id}`,
          barcode: unit.barcode || null,

          // لو الـ API اتبعت مع warehouse_id، product.stock = رصيد المخزن
          stock: productDetails?.stock ?? product?.stock ?? 0,

          // ✅ احتياطي (لو الـ API رجّع warehouse_stock على المنتج نفسه — نادراً)
          warehouse_stock: null,
          warehouseStocks: [],

          price_adjustment:
            parseFloat(unit.sell_price || '0') - (product?.price || 0),
          cost_adjustment:
            parseFloat(unit.cost_price || '0') - (product?.cost || 0),
          is_active: true,
          size: {
            id: unit.unit_id.toString(),
            name: unit.unit_name,
            name_ar: unit.unit_name,
            code: unit.unit_name,
          },
          color: null,
        },
      ];
    })
    .flat();

  // ✅ variantsStock بالرصيد الفعلي
  const variantsStock = transformedVariants.reduce((sum, v) => {
    const eff =
      v.warehouse_stock != null
        ? Number(v.warehouse_stock)
        : v.stock;
    return sum + (Number(eff) || 0);
  }, 0);

  // ✅ baseStock من API (لو اتبعت مع warehouse_id، هي رصيد المخزن)
  const baseStock = productDetails?.stock ?? product?.stock ?? 0;

  // ✅ لو فيه variants، متضفش baseStock تاني (تفادي العد المزدوج)
  const totalStock = transformedVariants.length > 0 ? variantsStock : baseStock;

  const activeVariants = transformedVariants.filter((v) => v.is_active);
  const lowStockVariants = transformedVariants.filter((v) => {
    const s = v.warehouse_stock != null ? Number(v.warehouse_stock) : v.stock;
    return s > 0 && s <= 10;
  });
  const outOfStockVariants = transformedVariants.filter((v) => {
    const s = v.warehouse_stock != null ? Number(v.warehouse_stock) : v.stock;
    return s === 0;
  });

  const minStock = product?.minStock || 10;
  const maxExpectedStock = Math.max(totalStock, minStock * 10, 100);
  const stockPercentage = Math.min((totalStock / maxExpectedStock) * 100, 100);

  const getStockStatus = () => {
    if (totalStock === 0)
      return {
        label: language === 'ar' ? 'نفد المخزون' : 'Out of Stock',
        color: 'destructive' as const,
      };
    if (totalStock <= minStock)
      return {
        label: language === 'ar' ? 'مخزون منخفض' : 'Low Stock',
        color: 'warning' as const,
      };
    return {
      label: language === 'ar' ? 'متوفر' : 'In Stock',
      color: 'success' as const,
    };
  };
  const stockStatus = getStockStatus();

  if (!product) return null;

  function getColorHex(colorName: string): string {
    const colorMap: Record<string, string> = {
      أسود: '#000000',
      اسود: '#000000',
      أبيض: '#FFFFFF',
      ابيض: '#FFFFFF',
      أحمر: '#FF0000',
      احمر: '#FF0000',
      أخضر: '#00FF00',
      اخضر: '#00FF00',
      أزرق: '#0000FF',
      ازرق: '#0000FF',
      أصفر: '#FFFF00',
      اصفر: '#FFFF00',
      بنفسجي: '#800080',
      وردي: '#FFC0CB',
      رمادي: '#808080',
      بني: '#8B4513',
      برتقالي: '#FFA500',
      name: '#666666',
      dsa: '#4CAF50',
    };
    return colorMap[colorName] || '#CCCCCC';
  }

  const getProductImage = () =>
    product.image || product.imageUrl || product.image_url || null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-gradient-to-r from-primary/5 via-primary/10 to-transparent">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-muted rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 border border-border shadow-sm">
              {getProductImage() ? (
                <img
                  src={getProductImage()!}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.classList.add(
                      'flex',
                      'items-center',
                      'justify-center',
                    );
                  }}
                />
              ) : (
                <Package size={32} className="text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Layers className="text-primary" size={20} />
                    {language === 'ar'
                      ? product.nameAr || product.name
                      : product.name}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                    {product.sku}
                  </p>
                </div>
                <Badge
                  variant={
                    stockStatus.color === 'success'
                      ? 'default'
                      : stockStatus.color === 'warning'
                        ? 'secondary'
                        : 'destructive'
                  }
                  className="flex-shrink-0"
                >
                  {stockStatus.label}
                </Badge>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-primary font-bold text-lg">
                    {formatCurrency(product.price)}
                  </span>
                  <span className="text-muted-foreground">
                    {language === 'ar' ? 'إجمالي المخزون:' : 'Total Stock:'}{' '}
                    <span className="font-bold text-foreground">
                      {totalStock}
                    </span>
                  </span>
                </div>
                <Progress
                  value={stockPercentage}
                  className={cn(
                    'h-2',
                    stockStatus.color === 'destructive' &&
                    '[&>div]:bg-destructive',
                    stockStatus.color === 'warning' && '[&>div]:bg-warning',
                  )}
                />
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-3 bg-muted/30 border-b border-border">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-primary">{baseStock}</div>
              <div className="text-xs text-muted-foreground">
                {language === 'ar' ? 'الأساسي' : 'Base'}
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">
                {variantsStock}
              </div>
              <div className="text-xs text-muted-foreground">
                {language === 'ar' ? 'المتغيرات' : 'Variants'}
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-success">
                {activeVariants.length}
              </div>
              <div className="text-xs text-muted-foreground">
                {language === 'ar' ? 'نشط' : 'Active'}
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-warning">
                {lowStockVariants.length}
              </div>
              <div className="text-xs text-muted-foreground">
                {language === 'ar' ? 'منخفض' : 'Low'}
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-destructive">
                {outOfStockVariants.length}
              </div>
              <div className="text-xs text-muted-foreground">
                {language === 'ar' ? 'نفد' : 'Out'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : variants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package size={56} className="mb-4 opacity-30" />
              <p className="text-lg font-medium mb-1">
                {language === 'ar' ? 'لا توجد متغيرات' : 'No Variants'}
              </p>
              <p className="text-sm text-center max-w-xs">
                {language === 'ar'
                  ? 'هذا المنتج ليس لديه متغيرات (ألوان/مقاسات) حتى الآن'
                  : 'This product has no variants (colors/sizes) yet'}
              </p>
              {onEditProduct && (
                <Button variant="outline" className="mt-4" onClick={onEditProduct}>
                  <Edit2 size={16} className="me-2" />
                  {language === 'ar' ? 'إضافة متغيرات' : 'Add Variants'}
                </Button>
              )}
            </div>
          ) : (
            <Tabs defaultValue="stock" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="stock" className="flex items-center gap-2">
                  <Box size={16} />
                  {language === 'ar' ? 'المخزون' : 'Stock'}
                </TabsTrigger>
                <TabsTrigger value="price" className="flex items-center gap-2">
                  <DollarSign size={16} />
                  {language === 'ar' ? 'الأسعار' : 'Prices'}
                </TabsTrigger>
                <TabsTrigger value="barcode" className="flex items-center gap-2">
                  <Barcode size={16} />
                  {language === 'ar' ? 'الباركود' : 'Barcode/SKU'}
                </TabsTrigger>
              </TabsList>

              {/* ✅ مرّر selectedWarehouseId لكل تاب */}
              <TabsContent value="stock" className="flex-1 m-0">
                <StockMatrixGrid
                  variants={transformedVariants}
                  basePrice={product.price}
                  baseCost={product.cost}
                  mode="stock"
                  selectedWarehouseId={warehouseId}
                />
              </TabsContent>

              <TabsContent value="price" className="flex-1 m-0">
                <StockMatrixGrid
                  variants={transformedVariants}
                  basePrice={product.price}
                  baseCost={product.cost}
                  mode="price"
                  selectedWarehouseId={warehouseId}
                />
              </TabsContent>

              <TabsContent value="barcode" className="flex-1 m-0">
                <StockMatrixGrid
                  variants={transformedVariants}
                  basePrice={product.price}
                  baseCost={product.cost}
                  mode="barcode"
                  selectedWarehouseId={warehouseId}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="border-t border-border p-4 flex items-center justify-between bg-muted/20">
          <div className="text-sm text-muted-foreground">
            {transformedVariants.length > 0 &&
              (language === 'ar'
                ? `${transformedVariants.length} متغير • ${totalStock} وحدة إجمالي`
                : `${transformedVariants.length} variants • ${totalStock} total units`)}
          </div>
          <div className="flex gap-2">
            {onEditProduct && transformedVariants.length > 0 && (
              <Button variant="outline" onClick={onEditProduct}>
                <Edit2 size={16} className="me-2" />
                {language === 'ar' ? 'تعديل' : 'Edit'}
              </Button>
            )}
            <Button variant="default" onClick={onClose}>
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductVariantsModal;
