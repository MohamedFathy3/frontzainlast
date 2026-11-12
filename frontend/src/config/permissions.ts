// config/permissions.ts
export type UserRole = 'admin' | 'Cashier' | 'Manager' | 'Accountant' | 'Sales' | 'purchasing' | 'warehouse' | 'HR' | 'viewer';

export interface PagePermission {
  id: string;
  path: string;
  label: string;
  labelAr: string;
  icon: string;
  allowedRoles: UserRole[];
}

/** Convert API role labels such as "Admin" to the canonical UI role. */
export const normalizeUserRole = (role: UserRole | string | null | undefined): UserRole | undefined => {
  if (!role) return undefined;

  const normalized = role.trim().toLowerCase();
  const roleMap: Record<string, UserRole> = {
    admin: 'admin',
    cashier: 'Cashier',
    manager: 'Manager',
    accountant: 'Accountant',
    sales: 'Sales',
    purchasing: 'purchasing',
    warehouse: 'warehouse',
    hr: 'HR',
    viewer: 'viewer',
  };

  return roleMap[normalized];
};

export const PAGES: PagePermission[] = [
  {
    id: 'dashboard',
    path: '/',
    label: 'Dashboard',
    labelAr: 'لوحة التحكم',
    icon: 'LayoutDashboard',
    allowedRoles: ['admin', 'Manager', 'Accountant', 'Sales', 'purchasing', 'warehouse', 'viewer'],
  },
  {
    id: 'pos',
    path: '/pos',
    label: 'POS',
    labelAr: 'نقطة البيع',
    icon: 'ShoppingCart',
    allowedRoles: ['admin', 'Cashier', 'Manager', 'Sales'],
  },
  {
    id: 'posreturn',
    path: '/POSRetrun',
    label: 'POS Return',
    labelAr: 'مرتجع نقاط البيع',
    icon: 'RefreshCcw',
    allowedRoles: ['admin', 'Cashier', 'Manager', 'Sales'],
  },
  {
    id: 'inventory',
    path: '/inventory',
    label: 'Inventory',
    labelAr: 'المخزون',
    icon: 'Package',
    allowedRoles: ['admin', 'Manager', 'purchasing', 'warehouse'],
  },
  {
    id: 'sales',
    path: '/sales',
    label: 'Advanced Sales',
    labelAr: 'المبيعات المتقدمة',
    icon: 'Receipt',
    allowedRoles: ['admin', 'Manager', 'Sales', 'Cashier', 'Accountant'],
  },
  // {
  //   id: 'manufacturing',
  //   path: '/manufacturing',
  //   label: 'Manufacturing',
  //   labelAr: 'التصنيع',
  //   icon: 'Factory',
  //   allowedRoles: ['admin', 'Manager', 'purchasing', 'warehouse'],
  // },
  {
    id: 'purchasing',
    path: '/purchasing',
    label: 'Purchasing',
    labelAr: 'المشتريات',
    icon: 'Truck',
    allowedRoles: ['admin', 'Manager', 'purchasing'],
  },
  {
    id: 'finance',
    path: '/finance',
    label: 'Finance',
    labelAr: 'المالية',
    icon: 'Wallet',
    allowedRoles: ['admin', 'Manager', 'Accountant'],
  },
  {
    id: 'hr',
    path: '/hr',
    label: 'HR',
    labelAr: 'الموارد البشرية',
    icon: 'Users',
    allowedRoles: ['admin', 'Manager', 'HR'],
  },
  {
    id: 'crm',
    path: '/crm',
    label: 'CRM',
    labelAr: 'العملاء',
    icon: 'Crown',
    allowedRoles: ['admin', 'Manager', 'Sales'],
  },
  {
    id: 'reports',
    path: '/reports',
    label: 'Reports',
    labelAr: 'التقارير',
    icon: 'FileBarChart',
    allowedRoles: ['admin', 'Manager', 'Accountant', 'Sales', 'purchasing', 'warehouse', 'HR', 'viewer'],
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    labelAr: 'الإعدادات',
    icon: 'Settings',
    allowedRoles: ['admin'],
  },
];

// ✅ دالة للتحقق من صلاحية الوصول للصفحة
export const canAccessPage = (role: UserRole | string | undefined, path: string): boolean => {
  const canonicalRole = normalizeUserRole(role);
  if (!canonicalRole) return false;
  if (canonicalRole === 'admin') return true; // الأدمن كل حاجة

  const page = PAGES.find(p => p.path === path);
  if (!page) return false;

  return page.allowedRoles.includes(canonicalRole);
};

// ✅ دالة لجلب الصفحات المسموحة للمستخدم
export const getAllowedPages = (role: UserRole | string | undefined): PagePermission[] => {
  const canonicalRole = normalizeUserRole(role);
  if (!canonicalRole) return [];
  if (canonicalRole === 'admin') return PAGES; // الأدمن كل حاجة

  return PAGES.filter(page => page.allowedRoles.includes(canonicalRole));
};
