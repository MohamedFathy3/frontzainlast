import api from '@/lib/api';

export type ManufacturingUnit = 'piece' | 'service' | 'meter' | 'quantity';
export type ManufacturingOrderStatus = 'draft' | 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'closed';

export interface ManufacturingProduct { id: number; name: string; name_ar?: string; sku?: string; unit: ManufacturingUnit; stock?: number; }
export interface BomVersion { id: number; product_id: number; product_name?: string; revision: string; status: 'active' | 'draft' | 'archived'; components_count: number; output_qty: number; updated_at?: string; }
export interface ManufacturingOrder { id: number; number: string; product_name: string; product_id?: number; bom_revision?: string; quantity: number; unit: ManufacturingUnit; status: ManufacturingOrderStatus; branch_name?: string; warehouse_name?: string; planned_date?: string; progress?: number; }
export interface ManufacturingOverview { kpis: { active_orders: number; planned_qty: number; completed_today: number; material_shortage: number; oee: number; scrap_rate: number }; orders: ManufacturingOrder[]; boms: BomVersion[]; products: ManufacturingProduct[]; }
export interface ManufacturingOrderPayload { product_id: number; bom_revision?: string; quantity: number; unit: ManufacturingUnit; branch_id?: number; warehouse_id?: number; sales_order_id?: number; notes?: string; }

const unwrap = <T>(response: { data: unknown }, fallback: T): T => {
  const body = response.data as { data?: T } | T | null | undefined;
  if (body && typeof body === 'object' && 'data' in body && (body as { data?: T }).data !== undefined) return (body as { data: T }).data;
  return (body as T) ?? fallback;
};
const request = async <T>(fn: () => Promise<{ data: unknown }>, fallback: T): Promise<T> => {
  try { return unwrap(await fn(), fallback); } catch (error) { console.warn('[manufacturing] API fallback', error); return fallback; }
};

export const manufacturingService = {
  getOverview: () => request<ManufacturingOverview>(() => api.get('/manufacturing/overview'), { kpis: { active_orders: 0, planned_qty: 0, completed_today: 0, material_shortage: 0, oee: 0, scrap_rate: 0 }, orders: [], boms: [], products: [] }),
  getOrders: () => request<ManufacturingOrder[]>(() => api.get('/manufacturing/orders'), []),
  getBoms: () => request<BomVersion[]>(() => api.get('/manufacturing/boms'), []),
  getProducts: () => request<ManufacturingProduct[]>(() => api.get('/manufacturing/products'), []),
  createOrder: (payload: ManufacturingOrderPayload) => api.post('/manufacturing/orders', payload),
  updateOrder: (id: number, payload: Partial<ManufacturingOrderPayload> & { status?: ManufacturingOrderStatus }) => api.put(`/manufacturing/orders/${id}`, payload),
  transitionOrder: (id: number, action: 'reserve' | 'start' | 'complete' | 'cancel' | 'reverse' | 'close') => api.post(`/manufacturing/orders/${id}/${action}`),
};

export const manufacturingQueryKeys = { overview: ['manufacturing', 'overview'], orders: ['manufacturing', 'orders'], boms: ['manufacturing', 'boms'] } as const;
