  import React from 'react';
  import { useLanguage } from '@/contexts/LanguageContext';
  import { cn } from '@/lib/utils';
  import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from '@/components/ui/tooltip';
  import {
    ScrollArea,
    ScrollBar,
  } from '@/components/ui/scroll-area';

  interface WarehouseStockEntry {
    warehouse_id: number;
    stock: number;
  }

  interface VariantData {
    id: string;
    sku: string;
    barcode: string | null;

    stock: number;                              // ← إجمالي كل المخازن
    warehouse_stock?: number | string | null;   // ← رصيد المخزن المحدد (قد يكون 0)
    warehouseStocks?: WarehouseStockEntry[];    // ← توزيع الرصيد على المخازن

    price_adjustment: number | null;
    cost_adjustment: number | null;
    is_active: boolean | null;
    size: { id: string; name: string; name_ar: string | null; code: string } | null;
    color: { id: string; name: string; name_ar: string | null; hex_code: string | null } | null;
  }

  interface StockMatrixGridProps {
    variants: VariantData[];
    basePrice: number;
    baseCost: number;
    mode: 'stock' | 'price' | 'barcode';
    /** المخزن المختار حالياً (رقم / 'all' / null) */
    selectedWarehouseId?: number | string | null;
  }

  /**
   * حساب الرصيد المعروض:
   * - وضع "كل المخازن" الصريح ('all')      → stock الإجمالي
   * - مخزن محدد + warehouseStocks موجودة    → نبحث فيه على warehouse_id
   * - warehouse_stock موجود                → نستخدمه (حتى لو 0)
   * - مجموع warehouseStocks                → لو اللي فوق مش موجود
   * - fallback أخير                        → stock الإجمالي
   */
  const getEffectiveStock = (
    variant: VariantData | undefined,
    selectedWarehouseId?: number | string | null,
  ): number => {
    if (!variant) return 0;

    // ========== 1) warehouse_stock ← الأولوية القصوى دايماً ==========
    // (لو الـ API رجّعه، يبقى ده رصيد المخزن الحالي — استخدمه فوراً)
    if (variant.warehouse_stock != null) {
      const n = Number(variant.warehouse_stock);
      if (!Number.isNaN(n)) return n;
    }

    // ========== 2) warehouseStocks للمخزن المحدد ==========
    if (
      selectedWarehouseId != null &&
      selectedWarehouseId !== '' &&
      selectedWarehouseId !== 'all'
    ) {
      const wid = Number(selectedWarehouseId);
      if (!Number.isNaN(wid) && Array.isArray(variant.warehouseStocks)) {
        const entry = variant.warehouseStocks.find(
          (w) => Number(w.warehouse_id) === wid,
        );
        if (entry) return Number(entry.stock) || 0;
      }
    }

    // ========== 3) warehouseStocks فيها عنصر واحد → رصيد المخزن الوحيد ==========
    if (
      Array.isArray(variant.warehouseStocks) &&
      variant.warehouseStocks.length === 1
    ) {
      return Number(variant.warehouseStocks[0].stock) || 0;
    }

    // ========== 4) fallback أخير: الإجمالي ==========
    return Number(variant.stock) || 0;
  };

  const hasWarehouseSpecificStock = (variant?: VariantData): boolean => {
    if (!variant) return false;
    if (variant.warehouse_stock != null) {
      return !Number.isNaN(Number(variant.warehouse_stock));
    }
    return Array.isArray(variant.warehouseStocks);
  };

  const getStockColor = (stock: number, isActive: boolean | null) => {
    if (!isActive) return 'bg-muted text-muted-foreground';
    if (stock === 0) return 'bg-destructive/20 text-destructive';
    if (stock <= 10) return 'bg-warning/20 text-warning';
    return 'bg-success/20 text-success';
  };

  const getStockTextColor = (stock: number) => {
    if (stock === 0) return 'text-destructive';
    if (stock <= 10) return 'text-warning';
    return 'text-success';
  };

  const StockMatrixGrid: React.FC<StockMatrixGridProps> = ({
    variants,
    basePrice,
    baseCost,
    mode,
    selectedWarehouseId,
  }) => {
    const { language } = useLanguage();

    // Extract unique colors and sizes
    const uniqueColors = React.useMemo(() => {
      const colors = new Map<string, VariantData['color']>();
      variants.forEach((v) => {
        if (v.color && !colors.has(v.color.id)) {
          colors.set(v.color.id, v.color);
        }
      });
      return Array.from(colors.values());
    }, [variants]);

    const uniqueSizes = React.useMemo(() => {
      const sizes = new Map<string, VariantData['size']>();
      variants.forEach((v) => {
        if (v.size && !sizes.has(v.size.id)) {
          sizes.set(v.size.id, v.size);
        }
      });
      return Array.from(sizes.values());
    }, [variants]);

    // Build matrix lookup
    const matrixLookup = React.useMemo(() => {
      const lookup = new Map<string, VariantData>();
      variants.forEach((v) => {
        const key = `${v.color?.id || 'no-color'}-${v.size?.id || 'no-size'}`;
        lookup.set(key, v);
      });
      return lookup;
    }, [variants]);

    const getVariant = (
      colorId: string | undefined,
      sizeId: string | undefined,
    ): VariantData | undefined => {
      const key = `${colorId || 'no-color'}-${sizeId || 'no-size'}`;
      return matrixLookup.get(key);
    };

    const getCellContent = (variant: VariantData | undefined) => {
      if (!variant)
        return { content: '-', className: 'bg-muted/30 text-muted-foreground' };

      switch (mode) {
        case 'stock': {
          const effectiveStock = getEffectiveStock(variant, selectedWarehouseId);
          return {
            content: effectiveStock.toString(),
            className: getStockColor(effectiveStock, variant.is_active),
          };
        }
        case 'price': {
          const priceAdj = Number(variant.price_adjustment ?? 0);
          const finalPrice = Number(basePrice) + priceAdj;
          return {
            content: finalPrice.toLocaleString(),
            className: 'bg-primary/10 text-primary',
          };
        }
        case 'barcode':
          return {
            content: variant.barcode || variant.sku.slice(-6),
            className: 'bg-muted/30 text-foreground font-mono text-xs',
          };
        default:
          return { content: '-', className: '' };
      }
    };

    const renderTooltipContent = (variant: VariantData) => {
      const finalPrice = basePrice + (variant.price_adjustment || 0);
      const finalCost = baseCost + (variant.cost_adjustment || 0);

      // ✅ مرّر selectedWarehouseId
      const effectiveStock = getEffectiveStock(variant, selectedWarehouseId);

      const isWarehouseSpecific =
        variant.warehouse_stock != null ||
        (Array.isArray(variant.warehouseStocks) &&
          variant.warehouseStocks.length > 0);

      const showTotal =
        isWarehouseSpecific &&
        Number(variant.stock) !== Number(effectiveStock);

      return (
        <div className="space-y-2 text-sm min-w-48">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            {variant.color?.hex_code && (
              <span
                className="w-4 h-4 rounded-full border border-border"
                style={{ backgroundColor: variant.color.hex_code }}
              />
            )}
            <span className="font-medium">
              {variant.color &&
                (language === 'ar'
                  ? variant.color.name_ar || variant.color.name
                  : variant.color.name)}
              {variant.color && variant.size && ' - '}
              {variant.size &&
                (language === 'ar'
                  ? variant.size.name_ar || variant.size.name
                  : variant.size.name)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">
              {language === 'ar' ? 'SKU:' : 'SKU:'}
            </span>
            <span className="font-mono text-xs">{variant.sku}</span>

            {variant.barcode && (
              <>
                <span className="text-muted-foreground">
                  {language === 'ar' ? 'الباركود:' : 'Barcode:'}
                </span>
                <span className="font-mono text-xs">{variant.barcode}</span>
              </>
            )}

            {/* ← الرصيد الفعلي للمخزن المحدد */}
            <span className="text-muted-foreground">
              {isWarehouseSpecific
                ? language === 'ar'
                  ? 'رصيد المخزن:'
                  : 'Warehouse Stock:'
                : language === 'ar'
                  ? 'المخزون:'
                  : 'Stock:'}
            </span>
            <span className={cn('font-bold', getStockTextColor(effectiveStock))}>
              {effectiveStock}
            </span>

            {/* ← الإجمالي (لو مختلف عن رصيد المخزن) */}
            {showTotal && (
              <>
                <span className="text-muted-foreground">
                  {language === 'ar' ? 'إجمالي المخازن:' : 'Total Stock:'}
                </span>
                <span className="text-muted-foreground">{variant.stock}</span>
              </>
            )}

            <span className="text-muted-foreground">
              {language === 'ar' ? 'السعر:' : 'Price:'}
            </span>
            <span className="text-primary font-medium">
              {finalPrice.toLocaleString()}
            </span>

            <span className="text-muted-foreground">
              {language === 'ar' ? 'التكلفة:' : 'Cost:'}
            </span>
            <span>{finalCost.toLocaleString()}</span>

            <span className="text-muted-foreground">
              {language === 'ar' ? 'الحالة:' : 'Status:'}
            </span>
            <span
              className={
                variant.is_active ? 'text-success' : 'text-muted-foreground'
              }
            >
              {variant.is_active
                ? language === 'ar'
                  ? 'نشط'
                  : 'Active'
                : language === 'ar'
                  ? 'غير نشط'
                  : 'Inactive'}
            </span>
          </div>

          {/* ← تفصيل توزيع المخازن (اختياري، لو الـ API رجّعه) */}
          {Array.isArray(variant.warehouseStocks) &&
            variant.warehouseStocks.length > 1 && (
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground mb-1">
                  {language === 'ar' ? 'توزيع المخازن:' : 'Per warehouse:'}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {variant.warehouseStocks.map((w) => (
                    <React.Fragment key={w.warehouse_id}>
                      <span className="text-xs text-muted-foreground">
                        {language === 'ar'
                          ? `مخزن #${w.warehouse_id}`
                          : `Warehouse #${w.warehouse_id}`}
                      </span>
                      <span className="text-xs font-mono">{w.stock}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
        </div>
      );
    };

    // Handle case where there are no colors or sizes
    const hasColors = uniqueColors.length > 0;
    const hasSizes = uniqueSizes.length > 0;

    if (!hasColors && !hasSizes) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {language === 'ar' ? 'لا توجد متغيرات' : 'No variants'}
        </div>
      );
    }

    // If only colors (no sizes)
    if (hasColors && !hasSizes) {
      return (
        <TooltipProvider>
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {uniqueColors.map((color) => {
                const variant = getVariant(color?.id, undefined);
                const { content, className } = getCellContent(variant);

                return (
                  <Tooltip key={color?.id}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-3 p-2 rounded-lg border border-border hover:border-primary/30 transition-colors cursor-default">
                        {color?.hex_code && (
                          <span
                            className="w-6 h-6 rounded-full border-2 border-background shadow-sm flex-shrink-0"
                            style={{ backgroundColor: color.hex_code }}
                          />
                        )}
                        <span className="flex-1 font-medium">
                          {language === 'ar'
                            ? color?.name_ar || color?.name
                            : color?.name}
                        </span>
                        <span
                          className={cn(
                            'px-3 py-1 rounded-lg font-bold min-w-16 text-center',
                            className,
                          )}
                        >
                          {content}
                        </span>
                      </div>
                    </TooltipTrigger>
                    {variant && (
                      <TooltipContent side="left" className="p-3">
                        {renderTooltipContent(variant)}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          </ScrollArea>
        </TooltipProvider>
      );
    }

    // If only sizes (no colors)
    if (!hasColors && hasSizes) {
      return (
        <TooltipProvider>
          <ScrollArea className="max-h-64">
            <div className="flex flex-wrap gap-2">
              {uniqueSizes.map((size) => {
                const variant = getVariant(undefined, size?.id);
                const { content, className } = getCellContent(variant);

                return (
                  <Tooltip key={size?.id}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'flex flex-col items-center p-3 rounded-lg border border-border hover:border-primary/30 transition-colors cursor-default min-w-16',
                          className,
                        )}
                      >
                        <span className="text-xs text-muted-foreground mb-1">
                          {language === 'ar'
                            ? size?.name_ar || size?.name
                            : size?.name}
                        </span>
                        <span className="font-bold">{content}</span>
                      </div>
                    </TooltipTrigger>
                    {variant && (
                      <TooltipContent side="bottom" className="p-3">
                        {renderTooltipContent(variant)}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          </ScrollArea>
        </TooltipProvider>
      );
    }

    // Full matrix (colors × sizes)
    return (
      <TooltipProvider>
        <ScrollArea
          className="w-full h-80 rounded-md border"
          dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
          <table className="w-max min-w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-start text-sm font-medium text-muted-foreground border-b border-border sticky start-0 top-0 bg-background z-30 min-w-32">
                  {language === 'ar' ? 'اللون / المقاس' : 'Color / Size'}
                </th>

                {uniqueSizes.map((size) => (
                  <th
                    key={size?.id}
                    className="p-2 text-center text-sm font-medium text-muted-foreground border-b border-border min-w-24 whitespace-nowrap sticky top-0 bg-background z-20"
                  >
                    {language === 'ar'
                      ? size?.name_ar || size?.name
                      : size?.name}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {uniqueColors.map((color) => (
                <tr key={color?.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-2 border-b border-border sticky start-0 bg-background z-10 min-w-32">
                    <div className="flex items-center gap-2">
                      {color?.hex_code && (
                        <span
                          className="w-6 h-6 rounded-full border-2 border-slate-400 ring-1 ring-white shadow-sm flex-shrink-0"
                          style={{ backgroundColor: color.hex_code }}
                          title={`${color.name}: ${color.hex_code}`}
                          aria-label={`${color.name} (${color.hex_code})`}
                        />
                      )}
                      <span className="text-sm font-medium whitespace-nowrap">
                        {language === 'ar'
                          ? color?.name_ar || color?.name
                          : color?.name}
                      </span>
                    </div>
                  </td>

                  {uniqueSizes.map((size) => {
                    const variant = getVariant(color?.id, size?.id);
                    const { content, className } = getCellContent(variant);

                    return (
                      <td
                        key={size?.id}
                        className="p-1 border-b border-border text-center min-w-24"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'px-2 py-2 rounded-md font-semibold text-sm cursor-default transition-all hover:ring-2 hover:ring-primary/30 whitespace-nowrap',
                                className,
                              )}
                            >
                              {content}
                            </div>
                          </TooltipTrigger>

                          {variant && (
                            <TooltipContent side="top" className="p-3">
                              {renderTooltipContent(variant)}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <ScrollBar orientation="vertical" />
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </TooltipProvider>
    );
  };

  export default StockMatrixGrid;