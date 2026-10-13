import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import AdvancedFilter, { FilterField, FilterValues } from '@/components/ui/advanced-filter';
import {
  Plus,
  Users,
  Star,
  ShoppingBag,
  Award,
  TrendingUp,
  Crown,
  Gift,
  Settings,
  Percent,
  Search,
  RefreshCw,
  Filter,
  X,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  FileSearch,
  Loader2
} from 'lucide-react';
import api from '@/lib/api';
import { Switch } from '@/components/ui/switch';


interface LoyaltySettings {
  id?: number;
  points: number;
  point_value: number;
  silver: number;
  gold: number;
  platinum: number;
}

interface Customer {
  id: string;
  name: string;
  name_ar: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  point: number;
  last_paid_amount: number | null;
  total_purchases?: number;
  created_at?: string;
  updated_at?: string;
    active?: boolean
}

interface CustomerStatementItem {
  product_id?: number;
  product_name?: string;
  name?: string;
  quantity: number;
  price: number | string;
  total?: number | string;
  cost_price: number | string;
  cost_is_estimated: boolean;
  color?: string | null;
  color_name?: string | null;
  size?: string | null;
  unit_name?: string | null;
}

interface CustomerStatementInvoice {
  id: number;
  invoice_number: string;
  source: 'pos' | 'sales';
  date: string | null;
  currency: string;
  total: number;
  paid: number;
  remaining: number;
  items: CustomerStatementItem[];
}

const CRM = () => {
  const { language, direction } = useLanguage();
  const queryClient = useQueryClient();

  // ========== State ==========
  const [activeTab, setActiveTab] = useState('customers');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showLoyaltySettings, setShowLoyaltySettings] = useState(false);
  const [showRedeemPoints, setShowRedeemPoints] = useState<string | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [customerFilters, setCustomerFilters] = useState<FilterValues>({});
  const [searchQuery, setSearchQuery] = useState('');
const [showEditCustomer, setShowEditCustomer] = useState<Customer | null>(null);
const [showDeleteDialog, setShowDeleteDialog] = useState<Customer | null>(null);
const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
const [isDeleting, setIsDeleting] = useState(false);
const [editCustomer, setEditCustomer] = useState({
  name: '',
  name_ar: '',
  phone: '',
  email: '',
  address: ''
});
  // New customer form state
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    name_ar: '',
    phone: '',
    email: '',
    address: ''
  });

  // Loyalty settings state
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>({
    points: 1000,
    point_value: 1,
    silver: 200,
    gold: 500,
    platinum: 1000
  });

  // Store original settings for cancel/reset
  const [originalSettings, setOriginalSettings] = useState<LoyaltySettings>({
    points: 1000,
    point_value: 1,
    silver: 200,
    gold: 500,
    platinum: 1000
  });

  // ========== Translations ==========
   const translations = {
    en: {
      title: 'Customers & Loyalty',
      newCustomer: 'New Customer',
      search: 'Search customers...',
      name: 'Name',
      nameAr: 'Name (Arabic)',
      phone: 'Phone',
        delete: 'Delete',
  deleteCustomer: 'Delete Customer',
  deleteConfirmation: 'Are you sure you want to delete this customer?',
  deleteWarning: 'This action cannot be undone.',
  active: 'Active',
  inactive: 'Inactive',
  activate: 'Activate',
  deactivate: 'Deactivate',
  status: 'Status',
  confirmDelete: 'Confirm Delete',
  customerDeleted: 'Customer deleted successfully',
  customerStatusChanged: 'Customer status changed successfully',
      email: 'Email',
      loyaltyPoints: 'Loyalty Points',
      totalPurchases: 'Total Purchases',
      actions: 'Actions',
      totalCustomers: 'Total Customers',
      activeCustomers: 'Active Customers',
      totalPoints: 'Total Points',
      avgPurchase: 'Avg Purchase',
      address: 'Address',
      notes: 'Notes',
      customers: 'Customers',
      loyaltyProgram: 'Loyalty Program',
      redeemPoints: 'Redeem Points',
      addPoints: 'Add Points',
      pointsHistory: 'Points History',
      tier: 'Tier',
      bronze: 'Bronze',
      silver: 'Silver',
      gold: 'Gold',
      platinum: 'Platinum',
      loyaltySettings: 'Loyalty Settings',
      pointsPerCurrency: 'Points per 1000 YER',
      pointsValuePercent: 'Point Value (%)',
      thresholds: 'Tier Thresholds',
      save: 'Save',
      cancel: 'Cancel',
      add: 'Add',
      pointsToRedeem: 'Points to Redeem',
      availablePoints: 'Available Points',
      earnedPoints: 'Earned Points',
      redeemedPoints: 'Redeemed Points',
      currentTier: 'Current Tier',
      customerStatement: 'Customer Statement',
      invoice: 'Invoice',
      invoiceCount: 'Invoices',
      salesInvoice: 'Sales Invoice',
      invoiceDate: 'Date',
      product: 'Product',
      quantity: 'Quantity',
      unitPrice: 'Sale Price',
      costPrice: 'Cost',
      salesTotal: 'Sales Total',
      costTotal: 'Total Cost',
      grossProfit: 'Gross Profit',
      paidAmount: 'Paid',
      remainingAmount: 'Remaining',
      invoiceItems: 'Products',
      estimatedCost: 'Estimated',
      estimatedCostNotice: 'Some older invoices do not have a saved cost. Their current product cost is shown as an estimate.',
      noStatement: 'No invoices found for this customer.'
    },
    ar: {
      title: 'العملاء والولاء',
      newCustomer: 'عميل جديد',
      search: 'بحث عن العملاء...',
      name: 'الاسم',
      nameAr: 'الاسم بالعربي',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      loyaltyPoints: 'نقاط الولاء',
      totalPurchases: 'إجمالي المشتريات',
      actions: 'الإجراءات',
      totalCustomers: 'إجمالي العملاء',
      activeCustomers: 'العملاء النشطين',
      totalPoints: 'إجمالي النقاط',
      avgPurchase: 'متوسط الشراء',
      address: 'العنوان',
      notes: 'ملاحظات',
      customers: 'العملاء',
      loyaltyProgram: 'برنامج الولاء',
      redeemPoints: 'استبدال النقاط',
      addPoints: 'إضافة نقاط',
      pointsHistory: 'سجل النقاط',
      tier: 'المستوى',
      bronze: 'برونزي',
      silver: 'فضي',
      gold: 'ذهبي',
      platinum: 'بلاتيني',
       delete: 'حذف',
  deleteCustomer: 'حذف العميل',
  deleteConfirmation: 'هل أنت متأكد من حذف هذا العميل؟',
  deleteWarning: 'هذا الإجراء لا يمكن التراجع عنه.',
  active: 'نشط',
  inactive: 'غير نشط',
  activate: 'تفعيل',
  deactivate: 'تعطيل',
  status: 'الحالة',
  confirmDelete: 'تأكيد الحذف',
  customerDeleted: 'تم حذف العميل بنجاح',
  customerStatusChanged: 'تم تغيير حالة العميل بنجاح',
      loyaltySettings: 'إعدادات الولاء',
      pointsPerCurrency: 'نقاط لكل 1000 ريال',
      pointsValuePercent: 'قيمة النقطة (%)',
      thresholds: 'حدود المستويات',
      save: 'حفظ',
      cancel: 'إلغاء',
      add: 'إضافة',
      pointsToRedeem: 'نقاط للاستبدال',
      availablePoints: 'النقاط المتاحة',
      earnedPoints: 'النقاط المكتسبة',
      redeemedPoints: 'النقاط المستبدلة',
      currentTier: 'المستوى الحالي',
      customerStatement: 'كشف العميل',
      invoice: 'الفاتورة',
      invoiceCount: 'عدد الفواتير',
      salesInvoice: 'فاتورة مبيعات',
      invoiceDate: 'التاريخ',
      product: 'المنتج',
      quantity: 'الكمية',
      unitPrice: 'سعر البيع',
      costPrice: 'التكلفة',
      salesTotal: 'إجمالي المبيعات',
      costTotal: 'إجمالي التكلفة',
      grossProfit: 'مجمل الربح',
      paidAmount: 'المدفوع',
      remainingAmount: 'المتبقي',
      invoiceItems: 'المنتجات',
      estimatedCost: 'تقديرية',
      estimatedCostNotice: 'بعض الفواتير القديمة لا تحتوي على تكلفة محفوظة، لذلك تظهر تكلفة المنتج الحالية كتقدير.',
      noStatement: 'لا توجد فواتير لهذا العميل.'
    }
  };

   const t = translations[language];
  // ========== Queries ==========

  // ✅ 1. جلب إعدادات الولاء - POST /loyalty-points/index
  const { data: loyaltyData, isLoading: loyaltyLoading, refetch: refetchLoyalty } = useQuery({
    queryKey: ['loyalty-settings'],
    queryFn: async () => {
      try {
        const response = await api.post('/loyalty-points/index', {
          filters: {},
          orderBy: 'id',
          orderByDirection: 'desc',
          perPage: 1,
          paginate: false
        });

        console.log('📦 Loyalty settings response:', response.data);

        if (response.data.result === 'Success') {
          const data = response.data.data;
          if (data && data.length > 0) {
            return data[0];
          }
        }
        return null;
      } catch (error) {
        console.error('Error fetching loyalty settings:', error);
        toast.error(language === 'ar' ? 'خطأ في جلب إعدادات الولاء' : 'Error fetching loyalty settings');
        return null;
      }
    }
  });

  // ✅ 2. تحديث loyalty settings عند جلب البيانات
  useEffect(() => {
    if (loyaltyData) {
      const newSettings = {
        id: loyaltyData.id,
        points: Number(loyaltyData.points) || 1000,
        point_value: Number(loyaltyData.point_value) || 1,
        silver: Number(loyaltyData.silver) || 200,
        gold: Number(loyaltyData.gold) || 500,
        platinum: Number(loyaltyData.platinum) || 1000
      };
      setLoyaltySettings(newSettings);
      setOriginalSettings(newSettings);
    }
  }, [loyaltyData]);

  // ✅ 3. جلب العملاء - POST /customer/index مع الفلاتر
  const { data: customers = [], isLoading: customersLoading, refetch: refetchCustomers } = useQuery({
    queryKey: ['customers', customerFilters, searchQuery],
    queryFn: async () => {
      try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = {
          orderBy: 'id',
          orderByDirection: 'desc',
          perPage: 100,
          paginate: false
        };

        // إضافة الفلاتر
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filters: any = {};

        if (searchQuery) {
          filters.name = searchQuery;
        }

        if (customerFilters.address) {
          filters.address = customerFilters.address;
        }

        if (customerFilters.points_min) {
          filters.point = Number(customerFilters.points_min);
        }
        if (customerFilters.points_max) {
          filters.point = Number(customerFilters.points_max);
        }

        if (customerFilters.purchases_min) {
          filters.last_paid_amount = Number(customerFilters.purchases_min);
        }
        if (customerFilters.purchases_max) {
          filters.last_paid_amount = Number(customerFilters.purchases_max);
        }

        if (Object.keys(filters).length > 0) {
          payload.filters = filters;
        }

        console.log('📦 Fetching customers with payload:', payload);

        const response = await api.post('/customer/index', payload);

        if (response.data.result === 'Success') {
          return response.data.data || [];
        }
        return [];
      } catch (error) {
        console.error('Error fetching customers:', error);
        toast.error(language === 'ar' ? 'خطأ في جلب العملاء' : 'Error fetching customers');
        return [];
      }
    }
  });

  const { data: statementInvoices = [], isLoading: statementLoading } = useQuery<CustomerStatementInvoice[]>({
    queryKey: ['customer-statement', statementCustomer?.id],
    enabled: Boolean(statementCustomer),
    queryFn: async () => {
      if (!statementCustomer) return [];

      try {
        const payload = {
          filters: { customer_id: Number(statementCustomer.id) },
          orderBy: 'id',
          orderByDirection: 'desc',
          paginate: false,
        };
        const [posResponse, salesResponse] = await Promise.all([
          api.post('/invoices/index', payload),
          api.post('/sales-invoices/index', payload),
        ]);

        if (posResponse.data.result !== 'Success' || salesResponse.data.result !== 'Success') {
          throw new Error(posResponse.data.message || salesResponse.data.message || 'Failed to load customer statement');
        }

        const posInvoices: CustomerStatementInvoice[] = (posResponse.data.data || []).map((invoice: any) => ({
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          source: 'pos',
          date: invoice.created_at || null,
          currency: 'YER',
          total: Number(invoice.amounts?.total ?? invoice.total_amount ?? 0),
          paid: Number(invoice.amounts?.paid ?? invoice.paid_amount ?? 0),
          remaining: Number(invoice.amounts?.remaining ?? invoice.remaining_amount ?? 0),
          items: (invoice.items || []).map((item: any) => ({
            ...item,
            cost_price: Number(item.cost_price ?? 0),
            cost_is_estimated: Boolean(item.cost_is_estimated),
          })),
        }));
        const salesInvoices: CustomerStatementInvoice[] = (salesResponse.data.data || []).map((invoice: any) => ({
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          source: 'sales',
          date: invoice.invoice_date || invoice.created_at || null,
          currency: invoice.currency || 'YER',
          total: Number(invoice.net_total ?? invoice.total_amount ?? 0),
          paid: Number(invoice.paid_amount ?? 0),
          remaining: Number(invoice.remaining_amount ?? (Number(invoice.net_total ?? invoice.total_amount ?? 0) - Number(invoice.paid_amount ?? 0))),
          items: (invoice.items || []).map((item: any) => ({
            ...item,
            cost_price: Number(item.cost_price ?? 0),
            cost_is_estimated: Boolean(item.cost_is_estimated),
          })),
        }));

        return [...posInvoices, ...salesInvoices].sort(
          (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        );
      } catch (error) {
        console.error('Error fetching customer statement:', error);
        toast.error(language === 'ar' ? 'تعذر تحميل كشف العميل' : 'Failed to load customer statement');
        throw error;
      }
    },
  });

  // ========== Mutations ==========

  // ✅ 4. إنشاء إعدادات ولاء جديدة - POST /loyalty-points
  const createLoyaltyMutation = useMutation({
    mutationFn: async (settings: LoyaltySettings) => {
      const payload = {
        points: settings.points,
        point_value: settings.point_value,
        silver: settings.silver,
        gold: settings.gold,
        platinum: settings.platinum
      };

      console.log('📤 Creating loyalty settings:', payload);

      const response = await api.post('/loyalty-points', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success(
        language === 'ar'
          ? 'تم إنشاء إعدادات الولاء بنجاح'
          : 'Loyalty settings created successfully'
      );
      queryClient.invalidateQueries({ queryKey: ['loyalty-settings'] });
      setShowLoyaltySettings(false);
    },
    onError: (error: any) => {
      console.error('❌ Error creating loyalty settings:', error);
      toast.error(
        language === 'ar'
          ? 'حدث خطأ أثناء إنشاء الإعدادات'
          : 'Error creating loyalty settings'
      );
    }
  });

  // ✅ 5. تحديث إعدادات الولاء - PATCH /loyalty-points/{id}
  const updateLoyaltyMutation = useMutation({
    mutationFn: async ({ id, settings }: { id: number; settings: LoyaltySettings }) => {
      const payload = {
        points: settings.points,
        point_value: settings.point_value,
        silver: settings.silver,
        gold: settings.gold,
        platinum: settings.platinum
      };

      console.log('📤 Updating loyalty settings:', id, payload);

      const response = await api.patch(`/loyalty-points/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success(
        language === 'ar'
          ? 'تم تحديث إعدادات الولاء بنجاح'
          : 'Loyalty settings updated successfully'
      );
      queryClient.invalidateQueries({ queryKey: ['loyalty-settings'] });
      setShowLoyaltySettings(false);
    },
    onError: (error: any) => {
      console.error('❌ Error updating loyalty settings:', error);
      toast.error(
        language === 'ar'
          ? 'حدث خطأ أثناء تحديث الإعدادات'
          : 'Error updating loyalty settings'
      );
    }
  });

  // ✅ 6. إضافة عميل جديد - POST /customer
  const addCustomerMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: newCustomer.name,
        name_ar: newCustomer.name_ar || null,
        phone: newCustomer.phone || null,
        email: newCustomer.email || null,
        address: newCustomer.address || null
      };

      console.log('📤 Creating customer:', payload);

      const response = await api.post('/customer', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success(
        language === 'ar'
          ? 'تم إضافة العميل بنجاح'
          : 'Customer added successfully'
      );
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowAddCustomer(false);
      setNewCustomer({ name: '', name_ar: '', phone: '', email: '', address: '' });
    },
    onError: (error: any) => {
      console.error('❌ Error creating customer:', error);
      toast.error(
        language === 'ar'
          ? 'حدث خطأ في إضافة العميل'
          : 'Error adding customer'
      );
    }
  });

const updateCustomerMutation = useMutation({
  mutationFn: async ({ id, data }: { id: string; data: any }) => {
    const payload = {
      name: data.name,
      name_ar: data.name_ar || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null
    };

    console.log('📤 Updating customer:', id, payload);

    const response = await api.patch(`/customer/${id}`, payload);
    return response.data;
  },
  onSuccess: () => {
    toast.success(
      language === 'ar'
        ? 'تم تحديث العميل بنجاح'
        : 'Customer updated successfully'
    );
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    setShowEditCustomer(null);
    setEditCustomer({ name: '', name_ar: '', phone: '', email: '', address: '' });
  },
  onError: (error: any) => {
    console.error('❌ Error updating customer:', error);
    toast.error(
      language === 'ar'
        ? 'حدث خطأ في تحديث العميل'
        : 'Error updating customer'
    );
  }
});
const handleEditCustomer = (customer: Customer) => {
  setEditCustomer({
    name: customer.name,
    name_ar: customer.name_ar || '',
    phone: customer.phone || '',
    email: customer.email || '',
    address: customer.address || ''
  });
  setShowEditCustomer(customer);
};

  const redeemPointsMutation = useMutation({
    mutationFn: async ({ customerId, points }: { customerId: string; points: number }) => {
      const payload = {
        points: points
      };

      console.log('📤 Redeeming points:', customerId, payload);

      const response = await api.patch(`/customer/${customerId}/redeem-points`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success(t.redeemSuccess);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowRedeemPoints(null);
      setRedeemAmount('');
    },
    onError: (error: any) => {
      console.error('❌ Error redeeming points:', error);
      toast.error(
        language === 'ar'
          ? error.response?.data?.message || t.redeemError
          : error.response?.data?.message || t.redeemError
      );
    }
  });

  // ========== Helper Functions ==========
// ✅ 9. تغيير حالة العميل (Active/Inactive) - POST /customers/{id}/active
const toggleCustomerStatusMutation = useMutation({
  mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
    const payload = {
      active: isActive
    };
    console.log('📤 Toggling customer status:', id, payload);
    const response = await api.put(`/customer/${id}/active`, payload);
    return response.data;
  },
  onSuccess: () => {
    toast.success(
      language === 'ar'
        ? 'تم تغيير حالة العميل بنجاح'
        : 'Customer status changed successfully'
    );
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError: (error: any) => {
    console.error('Error toggling customer status:', error);
    toast.error(
      language === 'ar'
        ? 'حدث خطأ في تغيير حالة العميل'
        : 'Error changing customer status'
    );
  }
});

// ✅ 10. حذف عميل - POST /category/delete
const deleteCustomerMutation = useMutation({
  mutationFn: async (customerId: string) => {
  
    const response = await api.delete('/customer/delete', {
        data: { items: [customerId] }    });
    return response.data;
  },
  onSuccess: () => {
    toast.success(
      language === 'ar'
        ? 'تم حذف العميل بنجاح'
        : 'Customer deleted successfully'
    );
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    setShowDeleteDialog(null);
  },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError: (error: any) => {
    console.error('Error deleting customer:', error);
    toast.error(
      language === 'ar'
        ? 'حدث خطأ في حذف العميل'
        : 'Error deleting customer'
    );
  }
});



// بعد الـ helper functions الموجودة، أضف:
const handleDeleteCustomer = (customer: Customer) => {
  setShowDeleteDialog(customer);
  handleConfirmDelete()
};

const handleConfirmDelete = () => {
  if (showDeleteDialog) {
    deleteCustomerMutation.mutate(showDeleteDialog.id);
  }
};

const handleToggleStatus = (customer: Customer) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentStatus = (customer as any).active !== false; // true if active
  toggleCustomerStatusMutation.mutate({
    id: customer.id,
    isActive: !currentStatus
  });
};
  const getLoyaltyTier = (points: number) => {
    if (points >= loyaltySettings.platinum) return {
      label: language === 'ar' ? 'بلاتيني' : 'Platinum',
      color: 'bg-gradient-to-r from-purple-500 to-pink-500',
      icon: <Crown size={14} />
    };
    if (points >= loyaltySettings.gold) return {
      label: language === 'ar' ? 'ذهبي' : 'Gold',
      color: 'bg-gradient-to-r from-yellow-400 to-amber-500',
      icon: <Star size={14} />
    };
    if (points >= loyaltySettings.silver) return {
      label: language === 'ar' ? 'فضي' : 'Silver',
      color: 'bg-gradient-to-r from-gray-300 to-gray-400',
      icon: <Award size={14} />
    };
    return {
      label: language === 'ar' ? 'برونزي' : 'Bronze',
      color: 'bg-gradient-to-r from-orange-300 to-orange-400',
      icon: <Gift size={14} />
    };
  };

  const handleSaveLoyaltySettings = () => {
    if (loyaltySettings.id) {
      updateLoyaltyMutation.mutate({
        id: loyaltySettings.id,
        settings: loyaltySettings
      });
    } else {
      createLoyaltyMutation.mutate(loyaltySettings);
    }
  };

  const handleResetFilters = () => {
    setCustomerFilters({});
    setSearchQuery('');
  };

  // ========== Filter Fields ==========
  const customerFilterFields: FilterField[] = [
 
    {
      key: 'address',
      label: 'Address',
      labelAr: 'العنوان',
      type: 'text',
      placeholder: 'Filter by address...',
      placeholderAr: 'البحث بالعنوان...'
    },
    {
      key: 'tier',
      label: 'Loyalty Tier',
      labelAr: 'مستوى الولاء',
      type: 'select',
      options: [
        { value: 'bronze', label: 'Bronze', labelAr: 'برونزي' },
        { value: 'silver', label: 'Silver', labelAr: 'فضي' },
        { value: 'gold', label: 'Gold', labelAr: 'ذهبي' },
        { value: 'platinum', label: 'Platinum', labelAr: 'بلاتيني' }
      ]
    },
    {
      key: 'points',
      label: 'Points',
      labelAr: 'النقاط',
      type: 'numberRange'
    },
    {
      key: 'purchases',
      label: 'Total Purchases',
      labelAr: 'إجمالي المشتريات',
      type: 'numberRange'
    }
  ];

  // ========== Filtered Customers (مع فلتر Tier يدوي) ==========
  const filteredCustomers = customers.filter((c: Customer) => {
    if (customerFilters.tier && customerFilters.tier !== 'all') {
      const tier = getLoyaltyTier(c.point || 0);
      const tierMap: Record<string, string> = {
        'Bronze': 'bronze',
        'Silver': 'silver',
        'Gold': 'gold',
        'Platinum': 'platinum',
        'برونزي': 'bronze',
        'فضي': 'silver',
        'ذهبي': 'gold',
        'بلاتيني': 'platinum'
      };
      if (tierMap[tier.label] !== customerFilters.tier) return false;
    }
    return true;
  });

  // ========== Stats ==========
  const totalPoints = customers.reduce((sum: number, c: Customer) => sum + (c.point || 0), 0);
  const totalPurchases = customers.reduce((sum: number, c: Customer) => sum + Number(c.last_paid_amount || 0), 0);
  const activeCustomers = customers.filter((c: Customer) => Number(c.last_paid_amount || 0) > 0).length;

  const stats = [
    {
      label: t.totalCustomers,
      value: customers.length,
      icon: <Users className="text-primary" size={24} />,
      color: 'bg-primary/10'
    },
    {
      label: t.activeCustomers,
      value: activeCustomers,
      icon: <TrendingUp className="text-accent" size={24} />,
      color: 'bg-accent/10'
    },
    {
      label: t.totalPoints,
      value: totalPoints.toLocaleString(),
      icon: <Crown className="text-warning" size={24} />,
      color: 'bg-warning/10'
    },
    {
      label: t.totalPurchases,
      value: `${totalPurchases.toLocaleString()} YER`,
      icon: <ShoppingBag className="text-info" size={24} />,
      color: 'bg-info/10'
    }
  ];

  const isLoading = customersLoading || loyaltyLoading;
  const statementTotalsByCurrency = statementInvoices.reduce<Record<string, {
    sales: number;
    cost: number;
    paid: number;
    remaining: number;
  }>>((totals, invoice) => {
    const currency = invoice.currency || 'YER';
    const currencyTotals = totals[currency] || { sales: 0, cost: 0, paid: 0, remaining: 0 };
    currencyTotals.sales += invoice.total;
    currencyTotals.cost += invoice.items.reduce(
      (sum, item) => sum + Number(item.cost_price || 0) * Number(item.quantity || 0),
      0
    );
    currencyTotals.paid += invoice.paid;
    currencyTotals.remaining += invoice.remaining;
    totals[currency] = currencyTotals;
    return totals;
  }, {});
  const formatStatementTotals = (key: 'sales' | 'cost' | 'paid' | 'remaining') =>
    Object.entries(statementTotalsByCurrency)
      .map(([currency, totals]) => `${formatStatementAmount(totals[key])} ${currency}`)
      .join(' · ') || `0.00 YER`;
  const statementHasEstimatedCosts = statementInvoices.some(invoice => invoice.items.some(item => item.cost_is_estimated));
  const formatStatementAmount = (amount: number) => amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // ========== Render ==========
  return (
    <MainLayout activeItem="crm">
      <div className="space-y-6" dir={direction}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Crown className="text-warning" size={28} />
            <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowLoyaltySettings(true)}
              className="gap-2"
            >
              <Settings size={18} />
              {loyaltySettings.id ? t.editSettings : t.createSettings}
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 gap-2"
              onClick={() => setShowAddCustomer(true)}
            >
              <Plus size={18} />
              {t.newCustomer}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} className="card-elevated">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users size={16} />
              {t.customers}
            </TabsTrigger>
            <TabsTrigger value="loyalty" className="flex items-center gap-2">
              <Crown size={16} />
              {t.loyaltyProgram}
            </TabsTrigger>
          </TabsList>

          {/* ========== Customers Tab ========== */}
          <TabsContent value="customers" className="mt-4">
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <AdvancedFilter
                      fields={customerFilterFields}
                      values={customerFilters}
                      onChange={setCustomerFilters}
                      onReset={handleResetFilters}
                      language={language}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-64">
                      <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                      <Input
                        placeholder={t.search}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="ps-9"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => refetchCustomers()}
                      title={t.reset}
                    >
                      <RefreshCw size={16} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.name}</TableHead>
                        <TableHead>{t.phone}</TableHead>
                        <TableHead>{t.address}</TableHead>
                        <TableHead>{t.email}</TableHead>
                        <TableHead>{t.loyaltyPoints}</TableHead>
                        <TableHead>{t.totalPurchases}</TableHead>
                        <TableHead className="text-end">{t.actions}</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
  {isLoading ? (
    <TableRow>
      <TableCell colSpan={7} className="text-center py-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </TableCell>
    </TableRow>
  ) : filteredCustomers.length === 0 ? (
    <TableRow>
      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
        <Users className="mx-auto h-12 w-12 mb-4 opacity-20" />
        <p>No customers found</p>
      </TableCell>
    </TableRow>
  ) : (
    filteredCustomers.map((customer: Customer) => {
      const tier = getLoyaltyTier(customer.point || 0);
      return (
        <TableRow key={customer.id}>
          <TableCell>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-semibold">
                  {(language === 'ar' ? customer.name_ar || customer.name : customer.name).charAt(0)}
                </span>
              </div>
              <div>
                <p className="font-medium">
                  {language === 'ar' ? customer.name_ar || customer.name : customer.name}
                </p>
              </div>
            </div>
          </TableCell>
          <TableCell dir="ltr">{customer.phone || '-'}</TableCell>
          <TableCell dir="ltr">{customer.address || '-'}</TableCell>
          <TableCell>{customer.email || '-'}</TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Star size={16} className="text-warning fill-warning" />
              <span className="font-semibold">{customer.point || 0}</span>
              <Badge className={`${tier.color} text-white text-xs flex items-center gap-1`}>
                {tier.icon}
                {tier.label}
              </Badge>
            </div>
          </TableCell>
          <TableCell>
            {Number(customer.last_paid_amount || 0).toLocaleString()} YER
          </TableCell>
          <TableCell className="text-end">
            <div className="flex items-center justify-end gap-2">
              {/* Switch Active/Inactive */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={customer.active === true}
                  onCheckedChange={() => handleToggleStatus(customer)}
                  disabled={toggleCustomerStatusMutation.isPending}
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                />
                <span className={`text-xs font-medium ${customer.active === true ? 'text-green-600' : 'text-red-600'}`}>
                  {customer.active === true ? 'active' : ' inactive'}
                </span>
              </div>

              {/* Edit Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEditCustomer(customer)}
                className="gap-1"
              >
                <Edit size={14} />
                {language === 'ar' ? 'تعديل' : 'Edit'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatementCustomer(customer)}
                className="gap-1"
              >
                <FileSearch size={14} />
                {t.customerStatement}
              </Button>

              {/* Redeem Points Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRedeemPoints(customer.id)}
                disabled={!customer.point || customer.point < 1}
                className="gap-1"
              >
                <Gift size={14} />
                {t.redeemPoints}
              </Button>

              {/* Delete Button */}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteCustomer(customer)}
                className="gap-1"
              >
                <Trash2 size={14} />
                {language === 'ar' ? 'حذف' : 'Delete'}
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );
    })
  )}
</TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== Loyalty Program Tab ========== */}
          <TabsContent value="loyalty" className="mt-4">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Loyalty Tiers */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="text-warning" />
                    {language === 'ar' ? 'مستويات الولاء' : 'Loyalty Tiers'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    {
                      name: t.bronze,
                      threshold: 0,
                      color: 'from-orange-300 to-orange-400',
                      icon: <Gift size={16} />
                    },
                    {
                      name: t.silver,
                      threshold: loyaltySettings.silver,
                      color: 'from-gray-300 to-gray-400',
                      icon: <Award size={16} />
                    },
                    {
                      name: t.gold,
                      threshold: loyaltySettings.gold,
                      color: 'from-yellow-400 to-amber-500',
                      icon: <Star size={16} />
                    },
                    {
                      name: t.platinum,
                      threshold: loyaltySettings.platinum,
                      color: 'from-purple-500 to-pink-500',
                      icon: <Crown size={16} />
                    }
                  ].map((tier, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${tier.color} flex items-center justify-center text-white`}>
                          {tier.icon}
                        </div>
                        <span className="font-medium">{tier.name}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {tier.threshold}+ {language === 'ar' ? 'نقطة' : 'points'}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Points Rules */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="text-primary" />
                    {language === 'ar' ? 'قواعد النقاط' : 'Points Rules'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-lg font-semibold text-primary">
                      {language === 'ar'
                        ? `نقطة واحدة لكل ${loyaltySettings.points} ريال`
                        : `1 point per ${loyaltySettings.points} YER`
                      }
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {language === 'ar' ? 'عند كل عملية شراء' : 'On every purchase'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-lg font-semibold text-success">
                      {language === 'ar'
                        ? `${loyaltySettings.point_value}% خصم لكل نقطة`
                        : `${loyaltySettings.point_value}% discount per point`
                      }
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {language === 'ar' ? 'عند الاستبدال' : 'When redeeming'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                    <div className="flex items-center gap-2 text-warning">
                      <Star className="fill-warning" size={20} />
                      <span className="font-semibold">
                        {language === 'ar' ? 'مزايا المستوى الذهبي' : 'Gold Tier Benefits'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {language === 'ar' ? 'خصم إضافي 5% على جميع المشتريات' : 'Extra 5% discount on all purchases'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={Boolean(statementCustomer)} onOpenChange={(open) => {
          if (!open) setStatementCustomer(null);
        }}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-primary" />
                {t.customerStatement}
                {statementCustomer && ` - ${language === 'ar' ? statementCustomer.name_ar || statementCustomer.name : statementCustomer.name}`}
              </DialogTitle>
            </DialogHeader>
            {statementLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                {language === 'ar' ? 'جاري تحميل كشف العميل...' : 'Loading customer statement...'}
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto pe-1">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {[
                    { label: t.invoiceCount, value: statementInvoices.length },
                    { label: t.salesTotal, value: formatStatementTotals('sales') },
                    { label: t.costTotal, value: formatStatementTotals('cost') },
                    { label: t.grossProfit, value: Object.entries(statementTotalsByCurrency)
                      .map(([currency, totals]) => `${formatStatementAmount(totals.sales - totals.cost)} ${currency}`)
                      .join(' · ') || `0.00 YER` },
                    { label: t.paidAmount, value: formatStatementTotals('paid') },
                    { label: t.remainingAmount, value: formatStatementTotals('remaining') },
                  ].map((metric) => (
                    <Card key={metric.label}>
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">{metric.label}</p>
                        <p className="font-semibold text-sm">{metric.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {statementHasEstimatedCosts && (
                  <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700">
                    {t.estimatedCostNotice}
                  </p>
                )}

                {statementInvoices.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">{t.noStatement}</div>
                ) : statementInvoices.map((invoice) => (
                  <Card key={`${invoice.source}-${invoice.id}`}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {t.invoice}: <span className="font-mono">{invoice.invoice_number}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {invoice.date || '-'} · {invoice.source === 'pos' ? 'POS' : t.salesInvoice}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <span>{t.salesTotal}: <strong>{formatStatementAmount(invoice.total)} {invoice.currency}</strong></span>
                          <span>{t.paidAmount}: <strong>{formatStatementAmount(invoice.paid)} {invoice.currency}</strong></span>
                          <span>{t.remainingAmount}: <strong>{formatStatementAmount(invoice.remaining)} {invoice.currency}</strong></span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t.product}</TableHead>
                              <TableHead>{language === 'ar' ? 'المقاس / اللون' : 'Variant'}</TableHead>
                              <TableHead className="text-end">{t.quantity}</TableHead>
                              <TableHead className="text-end">{t.unitPrice}</TableHead>
                              <TableHead className="text-end">{t.costPrice}</TableHead>
                              <TableHead className="text-end">{t.salesTotal}</TableHead>
                              <TableHead className="text-end">{t.costTotal}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoice.items.map((item, index) => {
                              const quantity = Number(item.quantity || 0);
                              const saleTotal = Number(item.total ?? Number(item.price || 0) * quantity);
                              const costTotal = Number(item.cost_price || 0) * quantity;
                              const variant = [item.unit_name || item.size, item.color_name || item.color]
                                .filter(Boolean)
                                .join(' / ');
                              return (
                                <TableRow key={`${item.product_id || 'product'}-${index}`}>
                                  <TableCell>{item.product_name || item.name || '-'}</TableCell>
                                  <TableCell>{variant || '-'}</TableCell>
                                  <TableCell className="text-end">{quantity}</TableCell>
                                  <TableCell className="text-end">{formatStatementAmount(Number(item.price || 0))} {invoice.currency}</TableCell>
                                  <TableCell className="text-end">
                                    {formatStatementAmount(Number(item.cost_price || 0))}
                                    {' '}{invoice.currency}
                                    {item.cost_is_estimated && (
                                      <Badge variant="outline" className="ms-1 text-[10px]">{t.estimatedCost}</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-end">{formatStatementAmount(saleTotal)} {invoice.currency}</TableCell>
                                  <TableCell className="text-end">{formatStatementAmount(costTotal)} {invoice.currency}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ))}

              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ========== Add Customer Dialog ========== */}
        <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.newCustomer}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t.name} *</Label>
                <Input
                  placeholder={t.name}
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                />
              </div>
            
              <div className="space-y-2">
                <Label>{t.phone}</Label>
                <Input
                  placeholder={t.phone}
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.email}</Label>
                <Input
                  placeholder={t.email}
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.address}</Label>
                <Input
                  placeholder={t.address}
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                />
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => addCustomerMutation.mutate()}
                disabled={!newCustomer.name || addCustomerMutation.isPending}
              >
                {addCustomerMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin me-2" />
                    {language === 'ar' ? 'جاري الإضافة...' : 'Adding...'}
                  </>
                ) : (
                  t.add
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ========== Loyalty Settings Dialog ========== */}
        <Dialog open={showLoyaltySettings} onOpenChange={setShowLoyaltySettings}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings size={20} />
                {loyaltySettings.id ? t.editSettings : t.createSettings}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t.pointsPerCurrency}</Label>
                <Input
                  type="number"
                  min="1"
                  value={loyaltySettings.points}
                  onChange={(e) => setLoyaltySettings({ ...loyaltySettings, points: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  {language === 'ar'
                    ? 'عدد الريالات لكل نقطة واحدة'
                    : 'Amount in YER per 1 point'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t.pointsValuePercent}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={loyaltySettings.point_value}
                  onChange={(e) => setLoyaltySettings({ ...loyaltySettings, point_value: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  {language === 'ar'
                    ? 'نسبة الخصم لكل نقطة'
                    : 'Discount percentage per point'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t.thresholds}</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">{t.silver}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={loyaltySettings.silver}
                      onChange={(e) => setLoyaltySettings({ ...loyaltySettings, silver: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t.gold}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={loyaltySettings.gold}
                      onChange={(e) => setLoyaltySettings({ ...loyaltySettings, gold: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t.platinum}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={loyaltySettings.platinum}
                      onChange={(e) => setLoyaltySettings({ ...loyaltySettings, platinum: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setLoyaltySettings(originalSettings);
                    setShowLoyaltySettings(false);
                  }}
                  className="flex-1"
                >
                  {t.cancel}
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={handleSaveLoyaltySettings}
                  disabled={updateLoyaltyMutation.isPending || createLoyaltyMutation.isPending}
                >
                  {updateLoyaltyMutation.isPending || createLoyaltyMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin me-2" />
                      {language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    t.save
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ========== Redeem Points Dialog ========== */}
        <Dialog open={!!showRedeemPoints} onOpenChange={() => setShowRedeemPoints(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift size={20} className="text-primary" />
                {t.redeemPoints}
              </DialogTitle>
            </DialogHeader>
            {showRedeemPoints && (() => {
              const customer = customers.find((c: Customer) => c.id === showRedeemPoints);
              if (!customer) return null;
              const tier = getLoyaltyTier(customer.point || 0);
              return (
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <span>{t.availablePoints}</span>
                    <div className="flex items-center gap-2">
                      <Star size={16} className="text-warning fill-warning" />
                      <span className="text-xl font-bold">{customer.point || 0}</span>
                      <Badge className={`${tier.color} text-white`}>
                        {tier.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.pointsToRedeem}</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      max={customer.point || 0}
                      min="1"
                    />
                    {redeemAmount && Number(redeemAmount) > 0 && (
                      <p className="text-sm text-success">
                        {language === 'ar'
                          ? `قيمة الخصم: ${(Number(redeemAmount) * loyaltySettings.point_value).toFixed(1)}%`
                          : `Discount value: ${(Number(redeemAmount) * loyaltySettings.point_value).toFixed(1)}%`
                        }
                      </p>
                    )}
                  </div>
                  <Button
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={() => redeemPointsMutation.mutate({
                      customerId: showRedeemPoints,
                      points: Number(redeemAmount)
                    })}
                    disabled={
                      !redeemAmount ||
                      Number(redeemAmount) < 1 ||
                      Number(redeemAmount) > (customer.point || 0) ||
                      redeemPointsMutation.isPending
                    }
                  >
                    {redeemPointsMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin me-2" />
                        {language === 'ar' ? 'جاري الاستبدال...' : 'Redeeming...'}
                      </>
                    ) : (
                      t.redeemPoints
                    )}
                  </Button>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

{/* ========== Edit Customer Dialog ========== */}
<Dialog open={!!showEditCustomer} onOpenChange={() => setShowEditCustomer(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>
        {language === 'ar' ? 'تعديل بيانات العميل' : 'Edit Customer'}
      </DialogTitle>
    </DialogHeader>
    {showEditCustomer && (
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>{t.name} *</Label>
          <Input
            placeholder={t.name}
            value={editCustomer.name}
            onChange={(e) => setEditCustomer({ ...editCustomer, name: e.target.value })}
          />
        </div>
        
        
        <div className="space-y-2">
          <Label>{t.phone}</Label>
          <Input
            placeholder={t.phone}
            value={editCustomer.phone}
            onChange={(e) => setEditCustomer({ ...editCustomer, phone: e.target.value })}
            dir="ltr"
          />
        </div>
        
        <div className="space-y-2">
          <Label>{t.email}</Label>
          <Input
            placeholder={t.email}
            type="email"
            value={editCustomer.email}
            onChange={(e) => setEditCustomer({ ...editCustomer, email: e.target.value })}
            dir="ltr"
          />
        </div>
        
        <div className="space-y-2">
          <Label>{t.address}</Label>
          <Input
            placeholder={t.address}
            value={editCustomer.address}
            onChange={(e) => setEditCustomer({ ...editCustomer, address: e.target.value })}
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowEditCustomer(null)}
            className="flex-1"
          >
            {t.cancel}
          </Button>
          <Button
            className="flex-1 bg-primary hover:bg-primary/90"
            onClick={() => {
              if (showEditCustomer && editCustomer.name) {
                updateCustomerMutation.mutate({
                  id: showEditCustomer.id,
                  data: editCustomer
                });
              }
            }}
            disabled={!editCustomer.name || updateCustomerMutation.isPending}
          >
            {updateCustomerMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin me-2" />
                {language === 'ar' ? 'جاري التحديث...' : 'Updating...'}
              </>
            ) : (
              t.save
            )}
          </Button>
        </div>
      </div>
    )}
  </DialogContent>
</Dialog>

      </div>
    </MainLayout>
  );
};

export default CRM;