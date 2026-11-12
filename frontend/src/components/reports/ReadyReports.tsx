// pages/ReadyReports.tsx
import React, { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useRegionalSettings } from '@/contexts/RegionalSettingsContext';
import {
  Printer,
  FileSpreadsheet,
  Eye,
  TrendingUp,
  Package,
  DollarSign,
  Users,
  ShoppingCart,
  Truck,
  Building2,
  Wallet,
  Receipt,
  RotateCcw,
  UserCheck,
  Calendar,
  Warehouse,
  User,
  FileText,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  Clock,
  HandCoins,
  BarChart3,
  ListChecks,
  UserPlus,
  Store,
  ArrowRightLeft,
  Scale,
  PieChart,
  Coins,
  Landmark,
  CircleDollarSign
} from 'lucide-react';
import { format, subMonths, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import CompanyHeader from '@/components/shared/CompanyHeader';
import {
  Branch,
  Warehouse as WarehouseType,
  User as UserType,
  Customer,
  Supplier,
  SalesRepresentative,
  Employee,
  Attendance,
  DeliveryMan,
  Product,
  Invoice,
  PurchaseInvoice,
  SalesInvoice,
  SalesReturn,
  PurchaseReturn,
  ReturnInvoice,
  Treasury,
  Finance,
  ReportDefinition,
  ReportData,
  ReportAccumulator
} from '@/types';

type ApiResponseLike = { data?: unknown };

const extractApiArray = <T,>(response: ApiResponseLike): T[] => {
  const payload = response?.data;
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
};

const relationName = (relation: unknown, fallback = '-') => {
  if (typeof relation === 'string' || typeof relation === 'number') return String(relation);
  if (relation && typeof relation === 'object' && 'name' in relation) {
    const name = (relation as { name?: unknown }).name;
    return name === null || name === undefined || name === '' ? fallback : String(name);
  }
  return fallback;
};

const formatReportDate = (value: unknown, withTime = false) => {
  if (!value) return '-';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return format(parsed, withTime ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
};

const numericValue = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const ReadyReports = () => {
  const { language, direction } = useLanguage();
  const { formatCurrency, settings } = useRegionalSettings();
  const printRef = useRef<HTMLDivElement>(null);
  const [activeModule, setActiveModule] = useState('sales');
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [timeFrom, setTimeFrom] = useState('00:00');
  const [timeTo, setTimeTo] = useState('23:59');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');

  // Fetch filter data
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await api.post('/branch/index');
      return extractApiArray(response);
    },
  });

  const { data: warehouses = [] } = useQuery<WarehouseType[]>({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await api.post('/warehouse/index');
      return extractApiArray(response);
    }
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.post('/user/index');
      return extractApiArray(response);
    }
  });

  // ==================== Sales Data ====================
  const { data: salesInvoices = [] } = useQuery<SalesInvoice[]>({
    queryKey: ['sales-invoices', dateFrom, dateTo, selectedBranch, selectedUser],
    queryFn: async () => {
      const response = await api.post('/sales-invoices/index', {
        paginate: false,
        filters: {
          date_from: dateFrom,
          date_to: dateTo,
          branch_id: selectedBranch === 'all' ? undefined : selectedBranch,
          sales_representative_id: selectedUser === 'all' ? undefined : selectedUser
        }
      });
      return extractApiArray(response);
    },
    enabled: activeModule === 'sales'
  });

  const { data: salesReturns = [] } = useQuery<SalesReturn[]>({
    queryKey: ['sales-returns', dateFrom, dateTo, selectedBranch, selectedUser],
    queryFn: async () => {
      const response = await api.post('/sales-return/index', {
        paginate: false,
        filters: {
          date_from: dateFrom,
          date_to: dateTo
        }
      });
      return extractApiArray(response);
    },
    enabled: activeModule === 'sales'
  });

  // ==================== Purchasing Data ====================
  const { data: purchaseInvoices = [] } = useQuery<PurchaseInvoice[]>({
    queryKey: ['purchase-invoices', dateFrom, dateTo, selectedBranch, selectedUser],
    queryFn: async () => {
      const response = await api.post('/purchases-invoices/index', {
        paginate: false,
        filters: {
          date_from: dateFrom,
          date_to: dateTo,
          branch_id: selectedBranch === 'all' ? undefined : selectedBranch,
          supplier_id: selectedUser === 'all' ? undefined : selectedUser
        }
      });
      return extractApiArray(response);
    },
    enabled: activeModule === 'purchasing'
  });

  const { data: purchaseReturns = [] } = useQuery<PurchaseReturn[]>({
    queryKey: ['purchase-returns', dateFrom, dateTo, selectedBranch, selectedUser],
    queryFn: async () => {
      const response = await api.post('/purchase-returns/index', {
        paginate: false,
        filters: {
          date_from: dateFrom,
          date_to: dateTo
        }
      });
      return extractApiArray(response);
    },
    enabled: activeModule === 'purchasing'
  });

  // ==================== Inventory Data ====================
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await api.post('/product/index');
      return extractApiArray(response);
    }
  });

  // ==================== CRM Data ====================
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await api.post('/customer/index');
      return extractApiArray(response);
    }
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await api.post('/suppliers/index');
      return extractApiArray(response);
    }
  });

  // ==================== HR Data ====================
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const response = await api.post('/employee/index');
      return extractApiArray(response);
    }
  });

  const { data: salesRepresentatives = [] } = useQuery<SalesRepresentative[]>({
    queryKey: ['sales-representatives'],
    queryFn: async () => {
      const response = await api.post('/sales-representative/index');
      return extractApiArray(response);
    }
  });

  const { data: attendance = [] } = useQuery<Attendance[]>({
    queryKey: ['attendance', dateFrom, dateTo],
    queryFn: async () => {
      const response = await api.post('/attendance/index', {
        paginate: false,
        date_from: dateFrom,
        date_to: dateTo
      });
      return extractApiArray(response);
    }
  });

  const { data: deliveryMen = [] } = useQuery<DeliveryMan[]>({
    queryKey: ['delivery-men'],
    queryFn: async () => {
      const response = await api.post('/delevery-man/index');
      return extractApiArray(response);
    }
  });

  // ==================== Finance Data ====================
  const { data: treasuries = [] } = useQuery<Treasury[]>({
    queryKey: ['treasuries'],
    queryFn: async () => {
      const response = await api.post('/treasury/index');
      return extractApiArray(response);
    }
  });

  const { data: finances = [] } = useQuery<Finance[]>({
    queryKey: ['finances', dateFrom, dateTo],
    queryFn: async () => {
      const response = await api.post('/finance/index', {
        date_from: dateFrom,
        date_to: dateTo
      });
      return extractApiArray(response);
    }
  });

  // ==================== Returns Data (المرتجعات الكاملة) ====================
  const { data: returnInvoices = [] } = useQuery<ReturnInvoice[]>({
    queryKey: ['return-invoices', dateFrom, dateTo],
    queryFn: async () => {
      const response = await api.post('/return-invoices/index', {
        paginate: false,
        filters: {
          date_from: dateFrom,
          date_to: dateTo
        }
      });
      return extractApiArray(response);
    }
  });

  const translations = {
    en: {
      title: 'Ready Reports',
      subtitle: 'Select a report to preview and print',
      filters: 'Filters',
      dateFrom: 'From',
      dateTo: 'To',
      timeFrom: 'From Time',
      timeTo: 'To Time',
      branch: 'Branch',
      warehouse: 'Warehouse',
      user: 'User',
      allBranches: 'All Branches',
      allWarehouses: 'All Warehouses',
      allUsers: 'All Users',
      preview: 'Preview',
      print: 'Print',
      exportExcel: 'Excel',
      noData: 'No data available',
      total: 'Total',
      selectReport: 'Select a report from the list',

      modules: {
        sales: 'Sales',
        purchasing: 'Purchasing',
        inventory: 'Inventory',
        finance: 'Finance',
        crm: 'CRM',
        hr: 'HR'
      },

      reports: {
        // Sales
        salesInvoices: 'Sales Invoices',
        salesInvoicesDesc: 'All sales invoices',
        salesByCustomer: 'Sales by Customer',
        salesByCustomerDesc: 'Sales grouped by customer',
        salesByRepresentative: 'Sales by Representative',
        salesByRepresentativeDesc: 'Sales grouped by sales rep',
        salesReturns: 'Sales Returns',
        salesReturnsDesc: 'All sales returns',
        unpaidInvoices: 'Unpaid Invoices',
        unpaidInvoicesDesc: 'Outstanding customer invoices',

        // Purchasing
        purchaseInvoices: 'Purchase Invoices',
        purchaseInvoicesDesc: 'All purchase invoices',
        purchaseBySupplier: 'Purchases by Supplier',
        purchaseBySupplierDesc: 'Purchases grouped by supplier',
        purchaseReturns: 'Purchase Returns',
        purchaseReturnsDesc: 'All purchase returns',
        supplierBalances: 'Supplier Balances',
        supplierBalancesDesc: 'Outstanding supplier amounts',
        returnInvoices: 'Return Invoices',
        returnInvoicesDesc: 'All return invoices',
checkOut: 'Check Out',
        // Inventory
        stockReport: 'Stock Report',
        stockReportDesc: 'Current stock levels',
        lowStock: 'Low Stock Report',
        lowStockDesc: 'Products below minimum',
        outOfStock: 'Out of Stock',
        outOfStockDesc: 'Products with zero stock',
        stockValuation: 'Stock Valuation',
        stockValuationDesc: 'Inventory value report',

        // Finance
        expenseReport: 'Expense Report',
        expenseReportDesc: 'All expenses',
        treasuryBalance: 'Treasury Balances',
        treasuryBalanceDesc: 'Current treasury balances',
        financeReport: 'Finance Report',
        financeReportDesc: 'All financial transactions',

        // CRM
        customerList: 'Customer List',
        customerListDesc: 'All registered customers',
        topCustomers: 'Top Customers',
        topCustomersDesc: 'By total purchases',
        customerBalances: 'Customer Balances',
        customerBalancesDesc: 'Outstanding amounts',
        supplierList: 'Supplier List',
        supplierListDesc: 'All suppliers',

        // HR
        employeeList: 'Employee List',
        employeeListDesc: 'All employees',
        attendanceReport: 'Attendance Report',
        attendanceReportDesc: 'Employee attendance records',
        attendanceSummary: 'Attendance Summary',
        attendanceSummaryDesc: 'Attendance summary by employee',
        salesRepresentatives: 'Sales Representatives',
        salesRepresentativesDesc: 'List of sales reps',
        deliveryMen: 'Delivery Men',
        deliveryMenDesc: 'List of delivery persons',
        salesCommissions: 'Sales Commissions',
        salesCommissionsDesc: 'Salesman commission report'
      },

      // Table headers
      date: 'Date',
      invoiceNo: 'Invoice #',
      customer: 'Customer',
      supplier: 'Supplier',
      amount: 'Amount',
      status: 'Status',
      product: 'Product',
      sku: 'SKU',
      quantity: 'Quantity',
      stock: 'Stock',
      minStock: 'Min',
      price: 'Price',
      cost: 'Cost',
      value: 'Value',
      category: 'Category',
      salesman: 'Salesman',
      paid: 'Paid',
      remaining: 'Remaining',
      name: 'Name',
      phone: 'Phone',
      email: 'Email',
      department: 'Department',
      position: 'Position',
      type: 'Type',
      number: 'Number',
      description: 'Description',
      balance: 'Balance',
      shift: 'Shift',
      opening: 'Opening',
      closing: 'Closing',
      totalSales: 'Total Sales',
      movement: 'Movement',
      warehouseCol: 'Warehouse',
      invoices: 'Invoices',
      products: 'Products',
      sales: 'Sales',
      commission: 'Commission',
      representative: 'Representative',
      returnNo: 'Return #',
      reason: 'Reason',
      method: 'Method',
      currency: 'Currency',
      checkIn: 'Check In',
      present: 'Present',
      absent: 'Absent',
      late: 'Late',
      leave: 'Leave',
      salary: 'Salary',
    },
    ar: {
      title: 'التقارير الجاهزة',
      subtitle: 'اختر تقريراً للمعاينة والطباعة',
      filters: 'الفلاتر',
      dateFrom: 'من',
      dateTo: 'إلى',
      timeFrom: 'من الساعة',
      timeTo: 'إلى الساعة',
      branch: 'الفرع',
      warehouse: 'المخزن',
      user: 'المستخدم',
      allBranches: 'كل الفروع',
      allWarehouses: 'كل المخازن',
      allUsers: 'كل المستخدمين',
      preview: 'معاينة',
      print: 'طباعة',
      exportExcel: 'Excel',
      noData: 'لا توجد بيانات',
      total: 'الإجمالي',
      selectReport: 'اختر تقريراً من القائمة',

      modules: {
        sales: 'المبيعات',
        purchasing: 'المشتريات',
        inventory: 'المخزون',
        finance: 'المالية',
        crm: 'العملاء',
        hr: 'الموارد البشرية'
      },

      reports: {
        // Sales
        salesInvoices: 'فواتير المبيعات',
        salesInvoicesDesc: 'جميع فواتير المبيعات',
        salesByCustomer: 'المبيعات حسب العميل',
        salesByCustomerDesc: 'المبيعات مجمعة حسب العميل',
        salesByRepresentative: 'المبيعات حسب المندوب',
        salesByRepresentativeDesc: 'المبيعات مجمعة حسب المندوب',
        salesReturns: 'مرتجعات المبيعات',
        salesReturnsDesc: 'جميع مرتجعات المبيعات',
        unpaidInvoices: 'الفواتير غير المسددة',
        unpaidInvoicesDesc: 'فواتير العملاء المستحقة',

        // Purchasing
        purchaseInvoices: 'فواتير المشتريات',
        purchaseInvoicesDesc: 'جميع فواتير المشتريات',
        purchaseBySupplier: 'المشتريات حسب المورد',
        purchaseBySupplierDesc: 'المشتريات مجمعة حسب المورد',
        purchaseReturns: 'مرتجعات المشتريات',
        purchaseReturnsDesc: 'جميع مرتجعات المشتريات',
        supplierBalances: 'أرصدة الموردين',
        supplierBalancesDesc: 'المبالغ المستحقة للموردين',
        returnInvoices: 'فواتير المرتجعات',
        returnInvoicesDesc: 'جميع فواتير المرتجعات الكاملة',

        // Inventory
        stockReport: 'تقرير المخزون',
        stockReportDesc: 'مستويات المخزون الحالية',
        lowStock: 'تقرير المخزون المنخفض',
        lowStockDesc: 'المنتجات أقل من الحد الأدنى',
        outOfStock: 'نفاذ المخزون',
        outOfStockDesc: 'المنتجات بدون مخزون',
        stockValuation: 'تقييم المخزون',
        stockValuationDesc: 'تقرير قيمة المخزون',

        // Finance
        expenseReport: 'تقرير المصروفات',
        expenseReportDesc: 'جميع المصروفات',
        treasuryBalance: 'أرصدة الخزائن',
        treasuryBalanceDesc: 'أرصدة الخزائن الحالية',
        financeReport: 'التقرير المالي',
        financeReportDesc: 'جميع المعاملات المالية',

        // CRM
        customerList: 'قائمة العملاء',
        customerListDesc: 'جميع العملاء المسجلين',
        topCustomers: 'أفضل العملاء',
        topCustomersDesc: 'حسب إجمالي المشتريات',
        customerBalances: 'أرصدة العملاء',
        customerBalancesDesc: 'المبالغ المستحقة',
        supplierList: 'قائمة الموردين',
        supplierListDesc: 'جميع الموردين',
checkOut: 'تسجيل الخروج',
        // HR
        employeeList: 'قائمة الموظفين',
        employeeListDesc: 'جميع الموظفين',
        attendanceReport: 'تقرير الحضور والانصراف',
        attendanceReportDesc: 'سجلات حضور الموظفين',
        attendanceSummary: 'ملخص الحضور',
        attendanceSummaryDesc: 'ملخص الحضور لكل موظف',
        salesRepresentatives: 'مندوبي المبيعات',
        salesRepresentativesDesc: 'قائمة مندوبي المبيعات',
        deliveryMen: 'مناديب التوصيل',
        deliveryMenDesc: 'قائمة مناديب التوصيل',
        salesCommissions: 'عمولات المبيعات',
        salesCommissionsDesc: 'تقرير عمولات مندوبي المبيعات'
      },

      // Table headers
      date: 'التاريخ',
      invoiceNo: 'رقم الفاتورة',
      customer: 'العميل',
      supplier: 'المورد',
      amount: 'المبلغ',
      status: 'الحالة',
      product: 'المنتج',
      sku: 'الكود',
      quantity: 'الكمية',
      stock: 'المخزون',
      minStock: 'الحد الأدنى',
      price: 'السعر',
      cost: 'التكلفة',
      value: 'القيمة',
      category: 'الفئة',
      salesman: 'المندوب',
      paid: 'المدفوع',
      remaining: 'المتبقي',
      name: 'الاسم',
      phone: 'الهاتف',
      email: 'البريد',
      department: 'القسم',
      position: 'المنصب',
      type: 'النوع',
      description: 'الوصف',
      balance: 'الرصيد',
      shift: 'الوردية',
      opening: 'الافتتاح',
      closing: 'الإغلاق',
      totalSales: 'إجمالي المبيعات',
      movement: 'الحركة',
      warehouseCol: 'المخزن',
      invoices: 'الفواتير',
      products: 'المنتجات',
      sales: 'المبيعات',
      commission: 'العمولة',
      representative: 'المندوب',
      returnNo: 'رقم المرتجع',
      reason: 'السبب',
      method: 'طريقة الرد',
      currency: 'العملة',
      reference: 'المرجع',
      referenceNo: 'رقم المرجع',
      checkIn: 'تسجيل الدخول',
      present: 'حاضر',
      absent: 'غائب',
      late: 'متأخر',
      leave: 'إجازة',
      salary: 'الراتب',
      checkOut: 'تسجيل الخروج',
      number: 'الرقم',
    }
  };

  const t = translations[language];

  // Module definitions with icons
  const modules = [
    { id: 'sales', icon: <Receipt size={18} />, label: t.modules.sales },
    { id: 'purchasing', icon: <Truck size={18} />, label: t.modules.purchasing },
    { id: 'inventory', icon: <Package size={18} />, label: t.modules.inventory },
    { id: 'finance', icon: <Wallet size={18} />, label: t.modules.finance },
    { id: 'crm', icon: <Users size={18} />, label: t.modules.crm },
    { id: 'hr', icon: <UserCheck size={18} />, label: t.modules.hr },
  ];

  // Reports by module
  const reportsByModule: Record<string, ReportDefinition[]> = {
    sales: [
      { id: 'salesInvoices', name: t.reports.salesInvoices, nameAr: t.reports.salesInvoices, description: t.reports.salesInvoicesDesc, descriptionAr: t.reports.salesInvoicesDesc, icon: <FileText size={20} />, module: 'sales' },
      { id: 'salesByCustomer', name: t.reports.salesByCustomer, nameAr: t.reports.salesByCustomer, description: t.reports.salesByCustomerDesc, descriptionAr: t.reports.salesByCustomerDesc, icon: <Users size={20} />, module: 'sales' },
      { id: 'salesByRepresentative', name: t.reports.salesByRepresentative, nameAr: t.reports.salesByRepresentative, description: t.reports.salesByRepresentativeDesc, descriptionAr: t.reports.salesByRepresentativeDesc, icon: <UserCheck size={20} />, module: 'sales' },
      { id: 'salesReturns', name: t.reports.salesReturns, nameAr: t.reports.salesReturns, description: t.reports.salesReturnsDesc, descriptionAr: t.reports.salesReturnsDesc, icon: <RotateCcw size={20} />, module: 'sales' },
      { id: 'unpaidInvoices', name: t.reports.unpaidInvoices, nameAr: t.reports.unpaidInvoices, description: t.reports.unpaidInvoicesDesc, descriptionAr: t.reports.unpaidInvoicesDesc, icon: <CreditCard size={20} />, module: 'sales' },
    ],
    purchasing: [
      { id: 'purchaseInvoices', name: t.reports.purchaseInvoices, nameAr: t.reports.purchaseInvoices, description: t.reports.purchaseInvoicesDesc, descriptionAr: t.reports.purchaseInvoicesDesc, icon: <FileText size={20} />, module: 'purchasing' },
      { id: 'purchaseBySupplier', name: t.reports.purchaseBySupplier, nameAr: t.reports.purchaseBySupplier, description: t.reports.purchaseBySupplierDesc, descriptionAr: t.reports.purchaseBySupplierDesc, icon: <Truck size={20} />, module: 'purchasing' },
      { id: 'purchaseReturns', name: t.reports.purchaseReturns, nameAr: t.reports.purchaseReturns, description: t.reports.purchaseReturnsDesc, descriptionAr: t.reports.purchaseReturnsDesc, icon: <RotateCcw size={20} />, module: 'purchasing' },
      { id: 'supplierBalances', name: t.reports.supplierBalances, nameAr: t.reports.supplierBalances, description: t.reports.supplierBalancesDesc, descriptionAr: t.reports.supplierBalancesDesc, icon: <DollarSign size={20} />, module: 'purchasing' },
      { id: 'returnInvoices', name: t.reports.returnInvoices, nameAr: t.reports.returnInvoices, description: t.reports.returnInvoicesDesc, descriptionAr: t.reports.returnInvoicesDesc, icon: <ArrowRightLeft size={20} />, module: 'purchasing' },
    ],
    inventory: [
      { id: 'stockReport', name: t.reports.stockReport, nameAr: t.reports.stockReport, description: t.reports.stockReportDesc, descriptionAr: t.reports.stockReportDesc, icon: <Package size={20} />, module: 'inventory' },
      { id: 'lowStock', name: t.reports.lowStock, nameAr: t.reports.lowStock, description: t.reports.lowStockDesc, descriptionAr: t.reports.lowStockDesc, icon: <TrendingUp size={20} />, module: 'inventory' },
      { id: 'outOfStock', name: t.reports.outOfStock, nameAr: t.reports.outOfStock, description: t.reports.outOfStockDesc, descriptionAr: t.reports.outOfStockDesc, icon: <Package size={20} />, module: 'inventory' },
      { id: 'stockValuation', name: t.reports.stockValuation, nameAr: t.reports.stockValuation, description: t.reports.stockValuationDesc, descriptionAr: t.reports.stockValuationDesc, icon: <DollarSign size={20} />, module: 'inventory' },
    ],
    finance: [
      { id: 'expenseReport', name: t.reports.expenseReport, nameAr: t.reports.expenseReport, description: t.reports.expenseReportDesc, descriptionAr: t.reports.expenseReportDesc, icon: <CreditCard size={20} />, module: 'finance' },
      { id: 'treasuryBalance', name: t.reports.treasuryBalance, nameAr: t.reports.treasuryBalance, description: t.reports.treasuryBalanceDesc, descriptionAr: t.reports.treasuryBalanceDesc, icon: <Wallet size={20} />, module: 'finance' },
      { id: 'financeReport', name: t.reports.financeReport, nameAr: t.reports.financeReport, description: t.reports.financeReportDesc, descriptionAr: t.reports.financeReportDesc, icon: <BarChart3 size={20} />, module: 'finance' },
    ],
    crm: [
      { id: 'customerList', name: t.reports.customerList, nameAr: t.reports.customerList, description: t.reports.customerListDesc, descriptionAr: t.reports.customerListDesc, icon: <Users size={20} />, module: 'crm' },
      { id: 'topCustomers', name: t.reports.topCustomers, nameAr: t.reports.topCustomers, description: t.reports.topCustomersDesc, descriptionAr: t.reports.topCustomersDesc, icon: <TrendingUp size={20} />, module: 'crm' },
      { id: 'customerBalances', name: t.reports.customerBalances, nameAr: t.reports.customerBalances, description: t.reports.customerBalancesDesc, descriptionAr: t.reports.customerBalancesDesc, icon: <DollarSign size={20} />, module: 'crm' },
      { id: 'supplierList', name: t.reports.supplierList, nameAr: t.reports.supplierList, description: t.reports.supplierListDesc, descriptionAr: t.reports.supplierListDesc, icon: <Truck size={20} />, module: 'crm' },
    ],
    hr: [
      { id: 'employeeList', name: t.reports.employeeList, nameAr: t.reports.employeeList, description: t.reports.employeeListDesc, descriptionAr: t.reports.employeeListDesc, icon: <Users size={20} />, module: 'hr' },
      { id: 'attendanceReport', name: t.reports.attendanceReport, nameAr: t.reports.attendanceReport, description: t.reports.attendanceReportDesc, descriptionAr: t.reports.attendanceReportDesc, icon: <Clock size={20} />, module: 'hr' },
      { id: 'attendanceSummary', name: t.reports.attendanceSummary, nameAr: t.reports.attendanceSummary, description: t.reports.attendanceSummaryDesc, descriptionAr: t.reports.attendanceSummaryDesc, icon: <Calendar size={20} />, module: 'hr' },
      { id: 'salesRepresentatives', name: t.reports.salesRepresentatives, nameAr: t.reports.salesRepresentatives, description: t.reports.salesRepresentativesDesc, descriptionAr: t.reports.salesRepresentativesDesc, icon: <UserPlus size={20} />, module: 'hr' },
      { id: 'deliveryMen', name: t.reports.deliveryMen, nameAr: t.reports.deliveryMen, description: t.reports.deliveryMenDesc, descriptionAr: t.reports.deliveryMenDesc, icon: <Truck size={20} />, module: 'hr' },
      { id: 'salesCommissions', name: t.reports.salesCommissions, nameAr: t.reports.salesCommissions, description: t.reports.salesCommissionsDesc, descriptionAr: t.reports.salesCommissionsDesc, icon: <Coins size={20} />, module: 'hr' },
    ],
  };

  // Get report data and render table based on selected report
  const getReportData = (): ReportData | null => {
    if (!selectedReport) return null;

    switch (selectedReport) {
      // ==================== Sales Reports ====================
      case 'salesInvoices': {
        return {
          headers: [t.date, t.invoiceNo, t.customer, t.representative, t.amount, t.currency, t.branch],
          rows: salesInvoices.map((inv) => [
            formatReportDate(inv.created_at, true),
            inv.invoice_number,
            relationName(inv.customer),
            relationName(inv.sales_representative) || '-',
            formatCurrency(numericValue(inv.total_amount)),
            inv.currency || '-',
            inv.branch
          ]),
          total: salesInvoices.reduce((sum, inv) => sum + numericValue(inv.total_amount), 0)
        };
      }

      case 'salesByCustomer': {
        const byCustomer = salesInvoices.reduce((acc: ReportAccumulator, inv) => {
          const name = relationName(inv.customer);
          if (!acc[name]) acc[name] = { name, invoices: 0, total: 0 };
          acc[name].invoices = (acc[name].invoices || 0) + 1;
          acc[name].total = (acc[name].total || 0) + numericValue(inv.total_amount);
          return acc;
        }, {});
        
        return {
          headers: [t.customer, t.invoices, t.amount],
          rows: Object.values(byCustomer).map((c: any) => [
            c.name,
            c.invoices,
            formatCurrency(c.total)
          ]),
          total: salesInvoices.reduce((sum, inv) => sum + numericValue(inv.total_amount), 0)
        };
      }

      case 'salesByRepresentative': {
        const byRep = salesInvoices.reduce((acc: ReportAccumulator, inv) => {
          const name = relationName(inv.sales_representative) || (language === 'ar' ? 'بدون مندوب' : 'No Representative');
          if (!acc[name]) acc[name] = { name, invoices: 0, total: 0 };
          acc[name].invoices = (acc[name].invoices || 0) + 1;
          acc[name].total = (acc[name].total || 0) + numericValue(inv.total_amount);
          return acc;
        }, {});
        
        return {
          headers: [t.representative, t.invoices, t.amount],
          rows: Object.values(byRep).map((r: any) => [
            r.name,
            r.invoices,
            formatCurrency(r.total)
          ]),
          total: salesInvoices.reduce((sum, inv) => sum + numericValue(inv.total_amount), 0)
        };
      }

      case 'salesReturns': {
        return {
          headers: [t.date, t.returnNo, t.invoiceNo, t.customer, t.amount, t.method, t.reason],
          rows: salesReturns.map((ret) => [
            formatReportDate(ret.created_at),
            ret.return_number,
            ret.invoice_number,
            relationName(ret.customer),
            formatCurrency(numericValue(ret.total_amount)),
            (ret as SalesReturn & { return_method_label?: string; return_method?: string }).return_method_label
              || (ret as SalesReturn & { return_method?: string }).return_method
              || '-',
            ret.reason || '-'
          ]),
          total: salesReturns.reduce((sum, ret) => sum + numericValue(ret.total_amount), 0)
        };
      }

      case 'unpaidInvoices': {
        // ملاحظة: API بتاعتك معندهاش paid_amount أو remaining_amount
        // هنستخدم البيانات المتاحة من invoices API لو موجودة
        return {
          headers: [t.date, t.invoiceNo, t.customer, t.amount],
          rows: salesInvoices.map((inv) => [
            formatReportDate(inv.created_at),
            inv.invoice_number,
            relationName(inv.customer),
            formatCurrency(numericValue(inv.total_amount))
          ]),
          total: salesInvoices.reduce((sum, inv) => sum + numericValue(inv.total_amount), 0)
        };
      }

      // ==================== Purchasing Reports ====================
      case 'purchaseInvoices': {
        return {
          headers: [t.date, t.invoiceNo, t.supplier, t.amount, t.currency, t.warehouseCol],
          rows: purchaseInvoices.map((inv) => [
            formatReportDate(inv.invoice_date),
            inv.invoice_number,
            relationName(inv.supplier) !== '-' ? relationName(inv.supplier) : (inv as PurchaseInvoice & { supplier_name?: string }).supplier_name || '-',
            formatCurrency(numericValue(inv.total_amount)),
            inv.currency || (inv as PurchaseInvoice & { currency_code?: string }).currency_code || '-',
            inv.warehouse || (inv as PurchaseInvoice & { warehouse_name?: string }).warehouse_name || '-'
          ]),
          total: purchaseInvoices.reduce((sum, inv) => sum + numericValue(inv.total_amount), 0)
        };
      }

      case 'purchaseBySupplier': {
        const bySupplier = purchaseInvoices.reduce((acc: ReportAccumulator, inv) => {
          const name = relationName(inv.supplier) !== '-'
            ? relationName(inv.supplier)
            : (inv as PurchaseInvoice & { supplier_name?: string }).supplier_name || (language === 'ar' ? 'غير معروف' : 'Unknown');
          if (!acc[name]) acc[name] = { name, invoices: 0, total: 0 };
          acc[name].invoices = (acc[name].invoices || 0) + 1;
          acc[name].total = (acc[name].total || 0) + numericValue(inv.total_amount);
          return acc;
        }, {});
        
        return {
          headers: [t.supplier, t.invoices, t.amount],
          rows: Object.values(bySupplier).map((s: any) => [
            s.name,
            s.invoices,
            formatCurrency(s.total)
          ]),
          total: purchaseInvoices.reduce((sum, inv) => sum + numericValue(inv.total_amount), 0)
        };
      }

      case 'purchaseReturns': {
        return {
          headers: [t.date, t.returnNo, t.invoiceNo, t.supplier, t.amount, t.method, t.reason],
          rows: purchaseReturns.map((ret) => [
            formatReportDate(ret.return_date || ret.created_at),
            ret.return_number,
            ret.invoice_number,
            (ret as PurchaseReturn & { supplier_name?: string }).supplier_name || '-',
            formatCurrency(numericValue(ret.total_amount)),
            (ret as PurchaseReturn & { payment_method?: string }).payment_method || '-',
            ret.reason || '-'
          ]),
          total: purchaseReturns.reduce((sum, ret) => sum + numericValue(ret.total_amount), 0)
        };
      }

      case 'supplierBalances': {
        const balances = purchaseInvoices.reduce((acc: Record<string, number>, inv) => {
          const name = relationName(inv.supplier) !== '-'
            ? relationName(inv.supplier)
            : (inv as PurchaseInvoice & { supplier_name?: string }).supplier_name || (language === 'ar' ? 'غير معروف' : 'Unknown');
          acc[name] = (acc[name] || 0) + numericValue(inv.total_amount);
          return acc;
        }, {});
        
        return {
          headers: [t.supplier, t.amount],
          rows: Object.entries(balances).map(([name, total]) => [
            name,
            formatCurrency(total)
          ]),
          total: Object.values(balances).reduce((sum, val) => sum + val, 0)
        };
      }

      case 'returnInvoices': {
        return {
          headers: [t.date, t.returnNo, t.invoiceNo, t.customer, t.amount, t.method, t.reason],
          rows: returnInvoices.map((ret) => [
            formatReportDate(ret.created_at, true),
            ret.return_number,
            (ret as ReturnInvoice & { invoice_number?: string }).invoice_number || ret.invoice?.invoice_number || '-',
            (ret as ReturnInvoice & { customer?: string }).customer || relationName(ret.invoice?.customer),
            formatCurrency(ret.total_amount),
            ret.refund_method === 'card' ? (language === 'ar' ? 'بطاقة' : 'Card') :
              ret.refund_method === 'cash' ? (language === 'ar' ? 'نقدي' : 'Cash') :
              ret.refund_method === 'wallet' ? (language === 'ar' ? 'محفظة' : 'Wallet') : ret.refund_method || '-',
            ret.reason
          ]),
          total: returnInvoices.reduce((sum, ret) => sum + numericValue(ret.total_amount), 0)
        };
      }

      // ==================== Inventory Reports ====================
      case 'stockReport': {
        return {
          headers: [t.sku, t.product, t.category, t.stock, t.price, t.cost, t.value],
          rows: products.map((p) => [
            p.sku,
            p.name,
            p.category?.name || '-',
            p.stock,
            formatCurrency(numericValue(p.price)),
            formatCurrency(numericValue(p.cost)),
            numericValue(p.stock) * numericValue(p.cost)
          ]),
          total: products.reduce((sum, p) => sum + (numericValue(p.stock) * numericValue(p.cost)), 0)
        };
      }

      case 'lowStock': {
        const lowStock = products.filter(p => numericValue(p.stock) > 0 && numericValue(p.stock) <= numericValue(p.reorder_level));
        return {
          headers: [t.sku, t.product, t.stock, t.minStock],
          rows: lowStock.map((p) => [
            p.sku,
            p.name,
            p.stock,
            p.reorder_level
          ]),
          total: lowStock.length
        };
      }

      case 'outOfStock': {
        const outOfStock = products.filter(p => numericValue(p.stock) === 0);
        return {
          headers: [t.sku, t.product, t.category],
          rows: outOfStock.map((p) => [
            p.sku,
            p.name,
            p.category?.name || '-'
          ]),
          total: outOfStock.length
        };
      }

      case 'stockValuation': {
        const byCategory = products.reduce((acc: ReportAccumulator, p) => {
          const cat = p.category?.name || (language === 'ar' ? 'غير مصنف' : 'Uncategorized');
          if (!acc[cat]) acc[cat] = { name: cat, count: 0, stock: 0, value: 0 };
          acc[cat].count = (acc[cat].count || 0) + 1;
          acc[cat].stock = (acc[cat].stock || 0) + p.stock;
          acc[cat].value = (acc[cat].value || 0) + (numericValue(p.stock) * numericValue(p.cost));
          return acc;
        }, {});
        
        return {
          headers: [t.category, t.products, t.stock, t.value],
          rows: Object.values(byCategory).map((c: any) => [
            c.name,
            c.count,
            c.stock,
            formatCurrency(c.value)
          ]),
          total: products.reduce((sum, p) => sum + (numericValue(p.stock) * numericValue(p.cost)), 0)
        };
      }

      // ==================== Finance Reports ====================
      case 'expenseReport': {
        const expenses = finances.filter(f => f.category === 'expense' || String(f.amount ?? '').startsWith('-'));
        return {
          headers: [t.date, t.category, t.description, t.amount, t.method],
          rows: expenses.map((f) => [
            f.date,
            f.category,
            f.description,
            f.formatted_amount,
            f.payment_method_arabic
          ]),
          total: expenses.reduce((sum, f) => sum + numericValue(f.amount), 0)
        };
      }

      case 'treasuryBalance': {
        return {
          headers: [t.name, t.code, t.branch, t.balance, t.currency],
          rows: treasuries.map((t) => [
            t.name,
            t.code,
            relationName(t.branch),
            formatCurrency(t.balance),
            t.currency
          ]),
          total: treasuries.reduce((sum, tr) => sum + numericValue(tr.balance), 0)
        };
      }

      case 'financeReport': {
        return {
          headers: [t.date, t.category, t.description, t.amount, t.method, t.reference],
          rows: finances.map((f) => [
            f.date,
            f.category,
            f.description,
            f.formatted_amount,
            f.payment_method_arabic,
            f.reference_number
          ]),
          total: finances.reduce((sum, f) => sum + numericValue(f.amount), 0)
        };
      }

      // ==================== CRM Reports ====================
      case 'customerList': {
        return {
          headers: [t.name, t.phone, t.email, 'نقاط', t.amount],
          rows: customers.map((c) => [
            c.name,
            c.phone,
            c.email || '-',
            c.point || 0,
            formatCurrency(c.last_paid_amount || 0)
          ]),
          total: customers.length
        };
      }

      case 'topCustomers': {
        const customerTotals = salesInvoices.reduce((acc: Record<string, number>, inv) => {
          const name = relationName(inv.customer);
          acc[name] = (acc[name] || 0) + numericValue(inv.total_amount);
          return acc;
        }, {});
        
        const topCustomers = Object.entries(customerTotals)
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 20);
        
        return {
          headers: [t.customer, t.amount],
          rows: topCustomers.map((c) => [
            c.name,
            formatCurrency(c.total)
          ]),
          total: topCustomers.reduce((sum, c) => sum + c.total, 0)
        };
      }

      case 'customerBalances': {
        // API معندهاش المتبقي، هنستخدم total amount
        const balances = salesInvoices.reduce((acc: Record<string, number>, inv) => {
          const name = relationName(inv.customer);
          acc[name] = (acc[name] || 0) + numericValue(inv.total_amount);
          return acc;
        }, {});
        
        return {
          headers: [t.customer, t.amount],
          rows: Object.entries(balances).map(([name, total]) => [
            name,
            formatCurrency(total)
          ]),
          total: Object.values(balances).reduce((sum, val) => sum + val, 0)
        };
      }

      case 'supplierList': {
        return {
          headers: [t.name, t.phone, t.email, t.amount, 'شروط الدفع'],
          rows: suppliers.map((s) => [
            s.name,
            s.phone,
            s.contact_person,
            formatCurrency(numericValue(s.credit_limit)),
            s.payment_terms
          ]),
          total: suppliers.length
        };
      }

      // ==================== HR Reports ====================
      case 'employeeList': {
        return {
          headers: [t.name, t.position, t.department, t.phone, t.email, t.salary],
          rows: employees.map((e) => [
            e.name,
            e.position,
            e.department || '-',
            e.phone,
            e.email,
            formatCurrency(numericValue(e.salary))
          ]),
          total: employees.reduce((sum, e) => sum + numericValue(e.salary), 0)
        };
      }

      case 'attendanceReport': {
        return {
          headers: [t.date, t.name, t.checkIn, t.checkOut, t.status],
          rows: attendance.map((a) => [
            a.date,
            relationName(a.employee) || '-',
            a.check_in || '-',
            a.check_out || '-',
            a.status === 'present' ? (language === 'ar' ? 'حاضر' : 'Present') :
              a.status === 'absent' ? (language === 'ar' ? 'غائب' : 'Absent') :
              a.status === 'late' ? (language === 'ar' ? 'متأخر' : 'Late') :
              a.status === 'leave' ? (language === 'ar' ? 'إجازة' : 'Leave') : a.status
          ]),
          total: attendance.length
        };
      }

      case 'attendanceSummary': {
        const summary = attendance.reduce((acc: Record<string, any>, a) => {
          const name = relationName(a.employee) || '-';
          if (!acc[name]) {
            acc[name] = { name, present: 0, absent: 0, late: 0, leave: 0 };
          }
          acc[name][a.status] = (acc[name][a.status] || 0) + 1;
          return acc;
        }, {});
        
        return {
          headers: [t.name, t.present, t.absent, t.late, t.leave],
          rows: Object.values(summary).map((s: any) => [
            s.name,
            s.present || 0,
            s.absent || 0,
            s.late || 0,
            s.leave || 0
          ]),
          total: attendance.length
        };
      }

      case 'salesRepresentatives': {
        return {
          headers: [t.name, t.phone, t.email, t.commission, t.branch],
          rows: salesRepresentatives.map((r) => [
            r.name,
            r.phone,
            r.email,
            `${r.commission_rate}%`,
            r.branch_name
          ]),
          total: salesRepresentatives.length
        };
      }

      case 'deliveryMen': {
        return {
          headers: [t.name, t.phone, t.type, t.number],
          rows: deliveryMen.map((d) => [
            d.name,
            d.phone,
            d.vehicle_type,
            d.vehicle_number
          ]),
          total: deliveryMen.length
        };
      }

      case 'salesCommissions': {
        const commissions = salesInvoices.reduce((acc: ReportAccumulator, inv) => {
          const repName = relationName(inv.sales_representative) || (language === 'ar' ? 'بدون مندوب' : 'No Rep');
          if (!acc[repName]) acc[repName] = { name: repName, sales: 0, commission: 0 };
          
          // البحث عن نسبة العمولة من قائمة المندوبين
          const rep = salesRepresentatives.find(r => r.name === relationName(inv.sales_representative));
          const rate = rep ? Number(rep.commission_rate) / 100 : 0.02; // 2% افتراضي
          
          acc[repName].sales = (acc[repName].sales || 0) + numericValue(inv.total_amount);
          acc[repName].commission = (acc[repName].commission || 0) + (numericValue(inv.total_amount) * rate);
          return acc;
        }, {});
        
        return {
          headers: [t.representative, t.sales, t.commission],
          rows: Object.values(commissions).map((c: any) => [
            c.name,
            formatCurrency(c.sales),
            formatCurrency(c.commission)
          ]),
          total: Object.values(commissions).reduce((sum: number, c: any) => sum + c.commission, 0)
        };
      }

      default:
        return null;
    }
  };

  const handlePrint = () => {
    const reportData = getReportData();
    const reportDef = reportsByModule[activeModule]?.find(r => r.id === selectedReport);
    if (!reportData || !reportDef) return;

    const printWindow = window.open('', '', 'height=800,width=1000');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>${reportDef.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; direction: ${direction}; }
            h1 { font-size: 18px; margin-bottom: 5px; }
            .subtitle { color: #666; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: ${direction === 'rtl' ? 'right' : 'left'}; }
            th { background: #f5f5f5; font-weight: bold; }
            .total { font-weight: bold; background: #f9f9f9; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>${reportDef.name}</h1>
          <div class="subtitle">${t.dateFrom}: ${dateFrom} ${timeFrom} - ${t.dateTo}: ${dateTo} ${timeTo}</div>
          <table>
            <thead>
              <tr>${reportData.headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${reportData.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
              <tr class="total">
                <td colspan="${reportData.headers.length - 1}">${t.total}</td>
                <td>${typeof reportData.total === 'number' ? formatCurrency(reportData.total) : reportData.total}</td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExportExcel = () => {
    const reportData = getReportData();
    const reportDef = reportsByModule[activeModule]?.find(r => r.id === selectedReport);
    if (!reportData || !reportDef) return;

    const ws = XLSX.utils.aoa_to_sheet([
      reportData.headers,
      ...reportData.rows,
      [t.total, ...Array(reportData.headers.length - 2).fill(''), 
       typeof reportData.total === 'number' ? reportData.total : reportData.total]
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportDef.name);
    XLSX.writeFile(wb, `${selectedReport}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const currentReports = reportsByModule[activeModule] || [];
  const reportData = selectedReport ? getReportData() : null;

  return (
    <div className="space-y-4" dir={direction}>
      {/* Filters Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[130px] h-9"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[130px] h-9"
              />
            </div>

            <Separator orientation="vertical" className="h-6 hidden sm:block" />

            <div className="flex items-center gap-2">
              <Clock size={16} className="text-muted-foreground" />
              <Input
                type="time"
                value={timeFrom}
                onChange={(e) => setTimeFrom(e.target.value)}
                className="w-[100px] h-9"
                title={t.timeFrom}
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="time"
                value={timeTo}
                onChange={(e) => setTimeTo(e.target.value)}
                className="w-[100px] h-9"
                title={t.timeTo}
              />
            </div>

            <Separator orientation="vertical" className="h-6 hidden sm:block" />

         

          
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar - Reports List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.title}</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {/* Module Tabs */}
            <div className="flex flex-wrap gap-1 mb-3 p-1 bg-muted/50 rounded-lg">
              {modules.map((mod) => (
                <Button
                  key={mod.id}
                  variant={activeModule === mod.id ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => { setActiveModule(mod.id); setSelectedReport(null); }}
                >
                  {mod.icon}
                  <span className="hidden xl:inline">{mod.label}</span>
                </Button>
              ))}
            </div>

            {/* Reports List */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-1">
                {currentReports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => setSelectedReport(report.id)}
                    className={`w-full p-3 rounded-lg text-start transition-colors ${
                      selectedReport === report.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={selectedReport === report.id ? 'text-primary-foreground' : 'text-muted-foreground'}>
                        {report.icon}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{report.name}</p>
                        <p className={`text-xs ${
                          selectedReport === report.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          {report.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Content - Report Preview */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {selectedReport && <Eye size={18} className="text-primary" />}
                {selectedReport
                  ? reportsByModule[activeModule]?.find(r => r.id === selectedReport)?.name
                  : t.selectReport}
              </CardTitle>
              {selectedReport && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t.dateFrom}: {dateFrom} {timeFrom} - {t.dateTo}: {dateTo} {timeTo}
                  {selectedBranch !== 'all' && ` | ${t.branch}: ${
                    branches.find((b: Branch) => b.id.toString() === selectedBranch)?.[
                      language === 'ar' ? 'name' : 'name'
                    ]
                  }`}
                </p>
              )}
            </div>
            {selectedReport && reportData && reportData.rows.length > 0 && (
              <div className="flex gap-2">
                <Badge variant="secondary" className="font-normal">
                  {reportData.rows.length} {language === 'ar' ? 'سجل' : 'records'}
                </Badge>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer size={16} className="me-1.5" />
                  {t.print}
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <FileSpreadsheet size={16} className="me-1.5" />
                  {t.exportExcel}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent ref={printRef}>
            {!selectedReport ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <Eye size={48} className="mb-3 opacity-50" />
                <p className="text-lg font-medium">{t.selectReport}</p>
                <p className="text-sm mt-1">
                  {language === 'ar' ? 'اختر تقريراً لعرضه مباشرة هنا' : 'Choose a report to preview it here'}
                </p>
              </div>
            ) : !reportData || reportData.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <Package size={48} className="mb-3 opacity-50" />
                <p>{t.noData}</p>
                <p className="text-sm mt-1">
                  {language === 'ar' ? 'جرب تغيير الفترة الزمنية أو الفلاتر' : 'Try changing the date range or filters'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Company Header - shown for print */}
                <div className="print:block hidden">
                  <CompanyHeader
                    variant="print"
                    branchId={selectedBranch !== 'all' ? parseInt(selectedBranch) : undefined}
                    showBranch={selectedBranch !== 'all'}
                  />
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-bold">
                      {reportsByModule[activeModule]?.find(r => r.id === selectedReport)?.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t.dateFrom}: {dateFrom} {timeFrom} - {t.dateTo}: {dateTo} {timeTo}
                    </p>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="flex flex-wrap gap-3 p-3 bg-muted/30 rounded-lg print:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">{language === 'ar' ? 'عدد السجلات:' : 'Records:'}</span>
                    <Badge variant="outline">{reportData.rows.length}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">{t.total}:</span>
                    <Badge variant="default">
                      {typeof reportData.total === 'number' 
                        ? formatCurrency(reportData.total)
                        : String(reportData.total ?? '')}
                    </Badge>
                  </div>
                </div>

                {/* Report Table */}
                <ScrollArea className="h-[450px] border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow className="bg-muted/50">
                        {reportData.headers.map((header, i) => (
                          <TableHead key={i} className="font-semibold whitespace-nowrap">{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.rows.map((row, i) => (
                        <TableRow key={i} className="hover:bg-muted/30">
                          {row.map((cell, j) => (
                            <TableCell key={j} className="whitespace-nowrap">{String(cell ?? '')}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                      <TableRow className="bg-primary/5 font-semibold sticky bottom-0">
                        <TableCell colSpan={reportData.headers.length - 1}>{t.total}</TableCell>
                        <TableCell className="text-primary font-bold whitespace-nowrap">
                          {typeof reportData.total === 'number' 
                            ? formatCurrency(reportData.total)
                            : String(reportData.total ?? '')}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReadyReports;
