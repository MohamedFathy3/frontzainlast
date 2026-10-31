import { Card, CardContent } from '@/components/ui/card';
import { Activity, Boxes, CheckCircle2, CircleAlert, Gauge, PackageCheck } from 'lucide-react';
import type { ManufacturingOverview } from '@/services/manufacturing.service';

export function ManufacturingKpis({ kpis, ar }: { kpis: ManufacturingOverview['kpis']; ar: boolean }) {
  const items = [
    { label: ar ? 'أوامر نشطة' : 'Active orders', value: kpis.active_orders, icon: Activity, tone: 'text-blue-600 bg-blue-50' },
    { label: ar ? 'الكمية المخططة' : 'Planned quantity', value: kpis.planned_qty, icon: Boxes, tone: 'text-violet-600 bg-violet-50' },
    { label: ar ? 'منجز اليوم' : 'Completed today', value: kpis.completed_today, icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50' },
    { label: ar ? 'نقص المواد' : 'Material shortage', value: kpis.material_shortage, icon: CircleAlert, tone: 'text-amber-600 bg-amber-50' },
    { label: 'OEE', value: `${kpis.oee}%`, icon: Gauge, tone: 'text-cyan-600 bg-cyan-50' },
    { label: ar ? 'نسبة الهالك' : 'Scrap rate', value: `${kpis.scrap_rate}%`, icon: PackageCheck, tone: 'text-rose-600 bg-rose-50' },
  ];
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{items.map(({ label, value, icon: Icon, tone }) => <Card key={label} className="border-border/70 shadow-sm"><CardContent className="flex items-center gap-3 p-4"><div className={`rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold tracking-tight">{value}</p></div></CardContent></Card>)}</div>;
}
