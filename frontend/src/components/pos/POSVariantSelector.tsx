import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRegionalSettings } from '@/contexts/RegionalSettingsContext';
import { cn } from '@/lib/utils';
import { X, Check, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ColorItem {
  id: number;
  color_id: number;
  color: string;
  stock: number;
  hex_code?: string | null;
  // ✅ رصيد المخزن المحدد
  warehouse_stock?: number | null;
  warehouseStocks?: Array<{ warehouse_id: number; stock: number }>;
}

interface UnitItem {
  id: number;
  unit_id: number;
  unit_name: string;
  sell_price: string;
  barcode: string;
  colors: ColorItem[];
}

// تعريف الـ Product من usePOSData
interface Product {
  id: string;
  name: string;
  name_ar: string | null;
  price: number;
  stock?: number;
  sku: string;
  image_url?: string | null;
  imageUrl?: string | null;
  image?: {
    fullUrl?: string;
    previewUrl?: string;
  };
  units?: UnitItem[];
}

interface POSVariantSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  /** ✅ المخزن المختار في الكاشير */
  warehouseId?: number | string | null;
  onSelectVariant: (variant: {
    productId: string;
    unitId: number;
    colorId: number;
    size: string;
    color: string;
    price: number;
    sku: string;
    stock: number;
  }) => void;
}

// ✅ الرصيد الفعلي للون
// الأفضل تنقله لـ '@/lib/stock' وتستخدمه في كل الملفات
const getEffectiveColorStock = (
  color: ColorItem,
  warehouseId?: number | string | null,
): number => {
  const hasWarehouse =
    warehouseId != null && warehouseId !== '' && warehouseId !== 'all';
  const hasBreakdown =
    Array.isArray(color.warehouseStocks) && color.warehouseStocks.length > 0;

  if (hasWarehouse) {
    // 1) تفصيل المخازن للمخزن المحدد
    if (hasBreakdown) {
      const wid = Number(warehouseId);
      const hit = color.warehouseStocks!.find((w) => Number(w.warehouse_id) === wid);
      return hit ? Number(hit.stock) || 0 : 0;
    }
    // 2) warehouse_stock
    if (color.warehouse_stock != null) {
      const n = Number(color.warehouse_stock);
      if (!Number.isNaN(n)) return n;
    }
  }

  // 3) مجموع المخازن لو التفصيل موجود
  if (hasBreakdown) {
    return color.warehouseStocks!.reduce((s, w) => s + (Number(w.stock) || 0), 0);
  }

  // 4) الإجمالي
  return Number(color.stock) || 0;
};

const POSVariantSelector: React.FC<POSVariantSelectorProps> = ({
  isOpen,
  onClose,
  product,
  warehouseId,
  onSelectVariant,
}) => {
  const { language } = useLanguage();
  const { formatCurrency } = useRegionalSettings();
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');

  const hasWarehouse =
    warehouseId != null && warehouseId !== '' && warehouseId !== 'all';

  // ✅ جيب المنتج بالمخزن المختار عشان أرصدة الألوان تبقى بتاعة المخزن ده
  const { data: productDetails } = useQuery({
    queryKey: ['pos-variant-selector', product?.id, warehouseId],
    queryFn: async () => {
      const response = await api.get(
        `/product/${product.id}?warehouse_id=${Number(warehouseId)}`,
      );
      return response.data.data;
    },
    enabled: isOpen && !!product?.id && hasWarehouse,
  });

  // ✅ الوحدات: من الـ API (بالمخزن) أو من المنتج الأصلي
  const units: UnitItem[] = useMemo(
    () => (productDetails?.units || product.units || []) as UnitItem[],
    [productDetails?.units, product.units],
  );

  // ✅ رصيد المنتج الأساسي (للوحدات بدون ألوان)
  const baseStock = Number(productDetails?.stock ?? product.stock) || 0;

  // استخراج المقاسات والألوان المتاحة
  const availableSizes = useMemo(
    () =>
      units.map((unit) => ({
        id: unit.unit_id,
        name: unit.unit_name,
        label: unit.unit_name,
      })),
    [units],
  );

  const availableColors = useMemo(() => {
    if (!selectedSize) return [];

    const unit = units.find((u) => u.unit_name === selectedSize);
    if (!unit) return [];

    return unit.colors.map((color) => ({
      id: color.color_id,
      name: color.color,
      stock: getEffectiveColorStock(color, warehouseId), // ✅ الرصيد الفعلي
      hexCode: color.hex_code || getColorHex(color.color),
    }));
  }, [units, selectedSize, warehouseId]);

  // ✅ الحصول على تفاصيل الـ variant المحدد (مع أو بدون لون)
  const selectedVariantDetails = useMemo(() => {
    if (!selectedSize) return null;

    const unit = units.find((u) => u.unit_name === selectedSize);
    if (!unit) return null;

    // المنتجات اللي ليها ألوان لازم تختار اللون
    if (!selectedColor) {
      if (unit.colors.length > 0) return null;
      return {
        unitId: unit.unit_id,
        colorId: 0,
        price: parseFloat(unit.sell_price || '0'),
        stock: baseStock,
        sku: unit.barcode || product.sku,
      };
    }

    const color = unit.colors.find((c) => c.color === selectedColor);
    if (!color) return null;

    return {
      unitId: unit.unit_id,
      colorId: color.color_id,
      price: parseFloat(unit.sell_price || '0'),
      stock: getEffectiveColorStock(color, warehouseId), // ✅ الرصيد الفعلي
      sku: unit.barcode || product.sku,
    };
  }, [units, product.sku, baseStock, selectedSize, selectedColor, warehouseId]);

  const handleClose = () => {
    onClose();
    setSelectedSize('');
    setSelectedColor('');
  };

  const handleAddToCart = () => {
    if (selectedVariantDetails) {
      onSelectVariant({
        productId: product.id,
        unitId: selectedVariantDetails.unitId,
        colorId: selectedVariantDetails.colorId,
        size: selectedSize,
        color: selectedColor || '',
        price: selectedVariantDetails.price,
        sku: selectedVariantDetails.sku,
        stock: selectedVariantDetails.stock,
      });
    }
    handleClose();
  };

  if (!isOpen) return null;

  const t = {
    en: {
      size: 'Size',
      colors: 'Colors',
      addToCart: 'Add to Cart',
      tapToSelect: 'Choose size',
      noVariants: 'No variants available',
      noVariantsDesc: 'This product has no configured variants.',
    },
    ar: {
      size: 'المقاس',
      colors: 'الألوان',
      addToCart: 'إضافة للسلة',
      tapToSelect: 'اختر المقاس',
      noVariants: 'لا توجد متغيرات متاحة',
      noVariantsDesc: 'هذا المنتج ليس له متغيرات',
    },
  }[language];

  // إذا مافيش units
  if (units.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative w-full max-w-md mx-4 bg-card rounded-2xl shadow-2xl overflow-hidden p-6 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📦</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">{t.noVariants}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t.noVariantsDesc}</p>
          <Button onClick={handleClose} className="w-full">
            {language === 'ar' ? 'حسناً' : 'OK'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-2xl mx-4 bg-card rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
              {product.image?.fullUrl || product.imageUrl || product.image_url ? (
                <img
                  src={product.image?.fullUrl || product.imageUrl || product.image_url || ''}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                  }}
                />
              ) : (
                <span className="text-xl">👕</span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {language === 'ar' ? product.name_ar || product.name : product.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(product.price)}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {/* Size Selection - إجباري */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-primary rounded-full" />
              {t.size} <span className="text-xs text-destructive">*</span>
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableSizes.map((size) => (
                <button
                  key={size.id}
                  onClick={() => {
                    setSelectedSize(size.name);
                    setSelectedColor(''); // مسح اللون عند تغيير المقاس
                  }}
                  className={cn(
                    'p-3 rounded-lg border-2 transition-all text-center',
                    selectedSize === size.name
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  <span className="font-medium text-sm">{size.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection - مطلوب للمنتجات اللي ليها ألوان */}
          {selectedSize && availableColors.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-primary rounded-full" />
                {t.colors}{' '}
                <span className="text-xs text-destructive">
                  ({language === 'ar' ? 'مطلوب' : 'Required'})
                </span>
              </h3>

              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                {availableColors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setSelectedColor(color.name)}
                    disabled={color.stock === 0}
                    className={cn(
                      'relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all',
                      selectedColor === color.name
                        ? 'ring-2 ring-primary ring-offset-2'
                        : 'hover:ring-1 hover:ring-primary/50',
                      color.stock === 0 && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full border-2 flex items-center justify-center',
                        selectedColor === color.name ? 'border-primary' : 'border-border',
                      )}
                      style={{ backgroundColor: color.hexCode }}
                    >
                      {selectedColor === color.name && (
                        <Check size={16} className="text-white drop-shadow-md" />
                      )}
                    </div>
                    <span className="text-xs font-medium truncate w-full text-center">
                      {color.name}
                    </span>
                    {color.stock === 0 && (
                      <Badge variant="destructive" className="absolute -top-2 -right-2 text-[10px] px-1">
                        0
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Variant Summary */}
          {selectedVariantDetails && selectedSize && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  {language === 'ar' ? 'التفاصيل' : 'Details'}
                </span>
                <Badge variant="outline" className="bg-background">
                  {selectedSize} {selectedColor && `- ${selectedColor}`}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    SKU: {selectedVariantDetails.sku}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'المخزون' : 'Stock'}: {selectedVariantDetails.stock}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'السعر' : 'Price'}
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(selectedVariantDetails.price)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-background flex-shrink-0">
          {selectedSize ? (
            <Button
              onClick={handleAddToCart}
              disabled={!selectedVariantDetails}
              className="w-full h-12 text-base gap-2"
            >
              <ShoppingCart size={20} />
              {t.addToCart}
              {selectedVariantDetails && (
                <span className="ms-2 opacity-90">
                  {formatCurrency(selectedVariantDetails.price)}
                </span>
              )}
            </Button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">{t.tapToSelect}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// دالة مساعدة للـ fallback (لو hex_code مش موجود)
function getColorHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    أسود: '#000000',
    أبيض: '#FFFFFF',
    أحمر: '#FF0000',
    أخضر: '#00FF00',
    أزرق: '#0000FF',
    أصفر: '#FFFF00',
    بنفسجي: '#800080',
    وردي: '#FFC0CB',
    رمادي: '#808080',
    بني: '#8B4513',
    برتقالي: '#FFA500',
    name: '#666666',
  };

  return colorMap[colorName] || '#CCCCCC';
}

export default POSVariantSelector;