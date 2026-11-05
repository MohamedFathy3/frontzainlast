// components/purchase/PurchaseVariantSelector.tsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Ruler, Palette, DollarSign } from 'lucide-react';
import { Product, ProductUnit, ProductColor } from '@/types/purchaseform';
import { cn } from '@/lib/utils';

// ✅ ProductColor + حقول رصيد المخزن
type ColorWithWarehouse = ProductColor & {
  warehouse_stock?: number | null;
  warehouseStocks?: Array<{ warehouse_id: number; stock: number }>;
};

// ✅ الرصيد الفعلي للون
// الأفضل تنقله لـ '@/lib/stock' وتستورده في الـ modal كمان
export const getEffectiveColorStock = (
  color: {
    stock: number;
    warehouse_stock?: number | null;
    warehouseStocks?: Array<{ warehouse_id: number; stock: number }>;
  },
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

interface PurchaseVariantSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  /** ✅ المخزن المختار في فاتورة الشراء */
  warehouseId?: number | string | null;
  onSelectVariant: (variant: {
    product_id: string;
    variant_id: string;
    product_name: string;
    product_sku: string;
    unit_cost: number;
    size_name?: string;
    color_name?: string;
    product_unit_id?: number;
    color_id?: number;
    stock?: number;
  }) => void;
}

const PurchaseVariantSelector: React.FC<PurchaseVariantSelectorProps> = ({
  isOpen,
  onClose,
  product,
  warehouseId,
  onSelectVariant,
}) => {
  const { language } = useLanguage();
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null);
  const [selectedColor, setSelectedColor] = useState<ColorWithWarehouse | null>(null);

  const hasWarehouse =
    warehouseId != null && warehouseId !== '' && warehouseId !== 'all';

  // ✅ جيب المنتج بالمخزن المختار عشان أرصدة الألوان تبقى بتاعة المخزن ده
  const { data: productDetails } = useQuery({
    queryKey: ['purchase-variant-selector', product?.id, warehouseId],
    queryFn: async () => {
      const url = hasWarehouse
        ? `/product/${product.id}?warehouse_id=${Number(warehouseId)}`
        : `/product/${product.id}`;
      const response = await api.get(url);
      return response.data.data;
    },
    enabled: isOpen && !!product?.id && hasWarehouse,
  });

  // ✅ الوحدات: من الـ API (بالمخزن) أو من المنتج الأصلي
  const units: ProductUnit[] = (productDetails?.units || product.units || []) as ProductUnit[];

  // ✅ أحدث نسخة من الوحدة/اللون المختارين (بعد وصول الداتا)
  const activeUnit = selectedUnit
    ? units.find((u) => u.id === selectedUnit.id) ?? selectedUnit
    : null;
  const activeColor: ColorWithWarehouse | null = selectedColor
    ? ((activeUnit?.colors as ColorWithWarehouse[] | undefined)?.find(
      (c) => c.id === selectedColor.id,
    ) ?? selectedColor)
    : null;

  const handleUnitSelect = (unit: ProductUnit) => {
    setSelectedUnit(unit);
    setSelectedColor(null);
  };

  const handleColorSelect = (color: ColorWithWarehouse) => {
    setSelectedColor(color);
  };

  const handleConfirm = () => {
    if (activeUnit) {
      onSelectVariant({
        product_id: product.id.toString(),
        variant_id: activeUnit.id.toString(), // id من الجدول
        product_name: language === 'ar' ? product.name_ar || product.name : product.name,
        product_sku: product.sku,
        unit_cost: Number(activeUnit.cost_price),
        size_name: activeUnit.unit_name,
        color_name: activeColor?.color,
        product_unit_id: activeUnit.unit_id, // ✅ unit_id الحقيقي
        color_id: activeColor?.color_id, // ✅ color_id الحقيقي
        // ✅ الرصيد الفعلي حسب المخزن
        stock: activeColor ? getEffectiveColorStock(activeColor, warehouseId) : 0,
      });
    }
    onClose();
  };

  const productName = language === 'ar' ? product.name_ar || product.name : product.name;

  const activeColorStock = activeColor
    ? getEffectiveColorStock(activeColor, warehouseId)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package size={18} />
            {language === 'ar' ? 'اختر الوحدة واللون' : 'Select Unit & Color'} - {productName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Units Section */}
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Ruler size={14} />
              {language === 'ar' ? 'الوحدات المتاحة' : 'Available Units'}
            </h4>
            <ScrollArea className="h-32 border rounded-md p-2">
              <div className="space-y-1">
                {units.map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => handleUnitSelect(unit)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                      activeUnit?.id === unit.id
                        ? 'bg-primary/10 text-primary border border-primary/30'
                        : 'hover:bg-muted border border-transparent',
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <span>{unit.unit_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {Number(unit.cost_price).toLocaleString()}{' '}
                        {language === 'ar' ? 'ر.س' : 'SAR'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Colors Section */}
          {activeUnit?.colors && activeUnit.colors.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Palette size={14} />
                {language === 'ar' ? 'الألوان المتاحة' : 'Available Colors'}
              </h4>
              <ScrollArea className="h-32 border rounded-md p-2">
                <div className="flex flex-wrap gap-2">
                  {(activeUnit.colors as ColorWithWarehouse[]).map((color) => {
                    const stock = getEffectiveColorStock(color, warehouseId);
                    const isLowStock = stock <= 5;
                    const isOutOfStock = stock === 0;

                    return (
                      <button
                        key={color.id}
                        onClick={() => handleColorSelect(color)}
                        className={cn(
                          'px-3 py-1.5 rounded-md text-sm transition-all flex items-center gap-1',
                          activeColor?.id === color.id
                            ? 'bg-primary text-white'
                            : 'border border-border hover:bg-muted/80',
                        )}
                        title={
                          isOutOfStock
                            ? language === 'ar'
                              ? 'نفد المخزون'
                              : 'Out of stock'
                            : `${language === 'ar' ? 'المخزون' : 'Stock'}: ${stock}`
                        }
                      >
                        <span>{color.color}</span>
                        <span
                          className={cn(
                            'text-xs font-mono',
                            isLowStock && !isOutOfStock ? 'text-destructive' : '',
                          )}
                        >
                          ({stock})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Price Summary */}
          {activeUnit && (
            <div className="bg-primary/5 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium flex items-center gap-1">
                  <DollarSign size={14} />
                  {language === 'ar' ? 'سعر الشراء' : 'Purchase Price'}:
                </span>
                <span className="text-lg font-bold text-primary">
                  {Number(activeUnit.cost_price).toLocaleString()}{' '}
                  {language === 'ar' ? 'ر.س' : 'SAR'}
                </span>
              </div>
              {activeColor && (
                <div className="text-xs mt-1 space-y-0.5">
                  <div className="text-muted-foreground">
                    {language === 'ar' ? 'اللون:' : 'Color:'} {activeColor.color}
                  </div>
                  <div
                    className={cn(
                      'text-xs font-mono',
                      activeColorStock <= 5 && activeColorStock > 0
                        ? 'text-destructive font-bold'
                        : 'text-muted-foreground',
                    )}
                  >
                    {language === 'ar'
                      ? `المخزون: ${activeColorStock}`
                      : `Stock: ${activeColorStock}`}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose} size="sm">
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleConfirm} disabled={!activeUnit} size="sm">
              {language === 'ar' ? 'تأكيد' : 'Confirm'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseVariantSelector;