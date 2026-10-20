'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FolderTree,
  BarChart3,
  Database,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Download,
  ExternalLink,
  CheckCircle2,
  Clock,
  Truck,
  AlertCircle,
  XCircle,
  Printer,
  Phone,
  Mail,
  MapPin,
  Check,
  X,
  Sparkles,
  TrendingUp,
  DollarSign,
  Boxes,
  Users,
  Menu,
  FileSpreadsheet,
  Layers,
  ChevronDown,
  LogOut,
  UserCheck,
  UserPlus,
  ShieldCheck,
  Lock,
  Store,
  Save,
  PackageCheck,
  SlidersHorizontal,
  Key,
  History,
  ArrowRightLeft,
  Upload,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Star,
  EyeOff,
  GripVertical,
  ShieldAlert,
  Copy
} from 'lucide-react';
import { hasPermission, Role, Permission } from '@/lib/rbac';
import { FEATURES } from '@/config/features';
import { canDeleteOrder, canTransitionOrderStatus } from '@/lib/order-status';
import { safeFetchJson } from '@/lib/utils';

// ==================== INTERFACES ====================
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  full_name?: string | null;
  role: 'SUPER_ADMIN' | 'MARKETING' | 'STORE_STAFF' | 'ADMIN';
  store_code?: string | null;
  must_change_password?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface MemberUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  address?: string | null;
  province?: string | null;
  district?: string | null;
  ward?: string | null;
  provider?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  total_orders: number;
  total_spent: number;
  last_order_date?: string | null;
}

export interface InventoryItem {
  product_id: string;
  product_name: string;
  sku: string;
  price: number;
  unit: string;
  thumbnail: string;
  is_active: boolean;
  category_name?: string;
  stock_quantity: number;
  reserved?: number;
  available_quantity?: number;
  sellable_quantity?: number;
  safety_stock?: number;
  updated_at?: string;
  updated_by?: string;
}

export interface InventoryLogItem {
  id: string;
  store_code: string;
  store_name?: string;
  product_id: string;
  product_name?: string;
  thumbnail?: string;
  unit?: string;
  old_stock: number;
  new_stock: number;
  old_reserved: number;
  new_reserved: number;
  change_type: string;
  order_id?: string;
  actor: string;
  note?: string;
  created_at: string;
}

interface Category {
  id: string;
  slug: string;
  name: string;
  product_count?: number;
  created_at?: string;
}

interface ProductVariant {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  unit: string;
}

interface Product {
  sold_offset?: number | null;
  id: string;
  slug: string;
  name: string;
  sku: string | null;
  short_description: string | null;
  description: string | null;
  price: number;
  cost_price?: number | null;
  unit: string;
  thumbnail: string;
  category_id: string | null;
  category_name?: string;
  category_slug?: string;
  is_featured: boolean;
  is_new: boolean;
  is_best_seller: boolean;
  is_active: boolean;
  variants?: ProductVariant[];
  images?: { id?: string; url: string; alt?: string; sortOrder?: number; imageType?: string; isActive?: boolean }[];
  created_at?: string;
}

interface OrderItem {
  id: string;
  order_id?: string;
  product_id: string | null;
  name: string;
  price: number;
  cost_price?: number | null;
  quantity: number;
  unit: string;
  thumbnail: string | null;
}

interface Order {
  id: string;
  order_code: string;
  full_name: string;
  phone: string;
  email: string | null;
  province: string;
  district: string;
  ward: string;
  address: string;
  note: string | null;
  payment_method: string;
  shipping_fee: number;
  subtotal: number;
  total: number;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';
  item_count?: number;
  items?: OrderItem[];
  store_code?: string | null;
  store_address?: string | null;
  inventory_deducted?: boolean | null;
  cod_reconciled?: boolean | null;
  cod_collected_amount?: number | null;
  cod_reconciled_at?: string | null;
  cod_reconciled_by?: string | null;
  payment_status?: string | null;
  payment_reference?: string | null;
  payment_reconciled_by?: string | null;
  return_reason?: string | null;
  return_disposition?: string | null;
  return_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_confirmed?: boolean | null;
  location_confirmed_by?: string | null;
  address_new?: string | null;
  created_at: string;
}

interface ComboItem {
  id?: string;
  product_id: string;
  quantity: number;
  unit?: string;
}

interface Combo {
  sold_offset?: number | null;
  id: string;
  slug: string;
  name: string;
  name_en?: string | null;
  description: string | null;
  description_en?: string | null;
  original_price: number;
  sale_price: number;
  cost_price?: number | null;
  total_items: number;
  discount: number;
  image: string | null;
  is_featured: boolean;
  is_best_seller: boolean;
  is_active: boolean;
  items?: ComboItem[];
  images?: { id?: string; url: string; alt?: string; sortOrder?: number; imageType?: string; isActive?: boolean }[];
  created_at?: string;
}

export interface AdminBanner {
  id: string;
  slug: string;
  title: string | null;
  subtitle: string | null;
  tag: string | null;
  image: string;
  mobile_image: string | null;
  alt: string | null;
  link: string | null;
  placement: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface AdminBrandSlide {
  id: string;
  tag: string;
  title: string;
  description: string;
  image: string;
  cta_text: string;
  cta_link: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

interface StatsData {
  summary: {
    total_orders: string | number;
    total_revenue: string | number;
    completed_orders: string | number;
    pending_orders: string | number;
    processing_orders: string | number;
    shipping_orders: string | number;
    cancelled_orders: string | number;
  };
  products: {
    total_products: string | number;
    active_products: string | number;
    featured_products: string | number;
    best_seller_products: string | number;
  };
  combos?: {
    total_combos: string | number;
    active_combos: string | number;
    featured_combos: string | number;
  };
  categories: {
    total_categories: string | number;
  };
  members?: {
    total_members: string | number;
    google_members?: string | number;
    active_members?: string | number;
  };
  statusBreakdown: { status: string; count: string | number; total_amount: string | number }[];
  recentOrders: Order[];
  topProducts: any[];
  revenueTrend: { date_label: string; order_count: number; daily_revenue: number }[];
  dbStatus: { connected: boolean; database: string; timestamp: string };
}

export type AdminTab =
  | 'overview'
  | 'inventory'
  | 'products'
  | 'combos'
  | 'orders'
  | 'categories'
  | 'analytics'
  | 'database'
  | 'users'
  | 'members'
  | 'banners'
  | 'audit';

export default function AdminPage() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data states
  const [stats, setStats] = useState<StatsData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [orderPaymentCounts, setOrderPaymentCounts] = useState<Record<string, number>>({});
  // Tab Đơn hàng: phân trang + lọc + tìm kiếm phía máy chủ
  const [orderRows, setOrderRows] = useState<Order[]>([]);
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageInfo, setOrderPageInfo] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [orderStatusCounts, setOrderStatusCounts] = useState<Record<string, number>>({ ALL: 0 });
  const [orderListLoading, setOrderListLoading] = useState(false);
  const [debouncedOrderSearch, setDebouncedOrderSearch] = useState('');
  const [orderListVersion, setOrderListVersion] = useState(0);
  // Thông báo đơn mới: số đơn mới chưa xem (tự làm mới định kỳ)
  const [newOrderCount, setNewOrderCount] = useState(0);
  // Nhận diện đơn mới theo mã đơn + thời điểm tạo (không phụ thuộc tổng số đơn: vẫn đúng khi có đơn vừa thêm vừa xóa)
  const knownOrderIdsRef = useRef<Set<string> | null>(null);
  const knownLatestOrderMsRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Image & Gallery Management
  const [productImages, setProductImages] = useState<any[]>([]);
  const [comboImages, setComboImages] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');

  // Banners & Brand Showcase Management
  const [bannersList, setBannersList] = useState<AdminBanner[]>([]);
  const [brandSlidesList, setBrandSlidesList] = useState<AdminBrandSlide[]>([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Partial<AdminBanner> | null>(null);
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<Partial<AdminBrandSlide> | null>(null);

  // Authenticated Admin User
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    fullName?: string | null;
    role: Role;
    email: string;
    storeCode?: string | null;
    permissions?: Permission[];
    mustChangePassword?: boolean;
  } | null>(null);

  // Review & Social Proof Management
  const [pendingReviewsCount, setPendingReviewsCount] = useState<number>(0);

  // Admin Users Management (Super Admin only)
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<'create' | 'edit'>('create');
  const [userFormData, setUserFormData] = useState({
    id: '',
    username: '',
    email: '',
    fullName: '',
    password: '',
    role: 'STORE_STAFF' as Role,
    storeCode: 'NH',
    isActive: true,
  });
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');

  // Password Change Modal (Mandatory first-time or manual)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [showPwdFields, setShowPwdFields] = useState(false);

  // Audit Logs (Super Admin only)
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditStoreFilter, setAuditStoreFilter] = useState('ALL');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Profit Reporting (Super Admin only - profit.view)
  const [profitGroupBy, setProfitGroupBy] = useState<'day' | 'month' | 'product' | 'store'>('day');
  const [profitStoreFilter, setProfitStoreFilter] = useState('ALL');
  const [profitData, setProfitData] = useState<any>(null);
  const [profitLoading, setProfitLoading] = useState(false);

  // Customer Member Management
  const [members, setMembers] = useState<MemberUser[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberProviderFilter, setMemberProviderFilter] = useState('ALL');
  const [memberStatusFilter, setMemberStatusFilter] = useState('ALL');
  const [selectedMember, setSelectedMember] = useState<MemberUser | null>(null);
  const [memberOrders, setMemberOrders] = useState<any[]>([]);
  const [isMemberDetailModalOpen, setIsMemberDetailModalOpen] = useState(false);
  const [memberDetailLoading, setMemberDetailLoading] = useState(false);

  // Store Inventory Management (Store Accounts & Super Admin)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [selectedStoreCode, setSelectedStoreCode] = useState('NH');
  const [storeList, setStoreList] = useState<{
    code: string;
    name: string;
    address?: string;
    phone?: string;
    district?: string;
    province?: string;
    ward?: string;
    map_url?: string;
  }[]>([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStockFilter, setInventoryStockFilter] = useState('ALL');
  const [editedStock, setEditedStock] = useState<Record<string, number>>({});
  const [inventorySaving, setInventorySaving] = useState(false);

  // Lịch sử biến động tồn kho & Chuyển chi nhánh đơn hàng
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLogItem[]>([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [isTransferringOrder, setIsTransferringOrder] = useState(false);
  const [transferTargetStore, setTransferTargetStore] = useState('');

  // Quản lý thông tin địa chỉ cửa hàng
  const [isStoreAddressModalOpen, setIsStoreAddressModalOpen] = useState(false);
  const [storeAddressForm, setStoreAddressForm] = useState({
    code: 'NH',
    name: 'Cửa Hàng NH - Phú Thọ Hòa',
    address: '298/4 Vườn Lài, P.Phú Thọ Hòa, TP.HCM',
    phone: '0911812425',
    district: 'Tân Phú',
    province: 'Hồ Chí Minh',
    ward: 'Phú Thọ Hòa',
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.7882898,106.6251124',
  });

  // Pop-up cập nhật số lượng chai cho mặt hàng
  const [stockModalItem, setStockModalItem] = useState<{
    product_id: string;
    product_name: string;
    sku: string;
    thumbnail: string;
    unit: string;
    current_stock: number;
    new_stock: number;
    updated_at?: string;
  } | null>(null);

  // Filters & Search
  const [prodSearch, setProdSearch] = useState('');
  const [prodCatFilter, setProdCatFilter] = useState('ALL');
  const [prodStatusFilter, setProdStatusFilter] = useState('ALL');

  const [comboSearch, setComboSearch] = useState('');
  const [comboFilter, setComboFilter] = useState('ALL');

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [productFormVariants, setProductFormVariants] = useState<ProductVariant[]>([]);

  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Partial<Combo> | null>(null);

  const [isOrderDetailModalOpen, setIsOrderDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    orderId: string;
    orderCode: string;
    customerName: string;
    currentStatus: Order['status'];
    newStatus: Order['status'];
  } | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id?: string; name: string; slug: string } | null>(null);

  // Show Toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Format currency
  const formatVND = (num: number | string | undefined) => {
    if (!num) return '0 ₫';
    return Number(num).toLocaleString('vi-VN') + ' ₫';
  };

  // Fetch all initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, prodsRes, combosRes, catsRes, ordersRes, membersRes] = await Promise.all([
        safeFetchJson('/api/admin/stats', { cache: 'no-store' }),
        safeFetchJson('/api/admin/products', { cache: 'no-store' }),
        safeFetchJson('/api/admin/combos', { cache: 'no-store' }),
        safeFetchJson('/api/admin/categories', { cache: 'no-store' }),
        safeFetchJson('/api/admin/orders?page=1&limit=50', { cache: 'no-store' }),
        safeFetchJson('/api/admin/members', { cache: 'no-store' }),
      ]);

      if (statsRes?.success) setStats(statsRes);
      if (prodsRes?.success) setProducts(prodsRes.data || []);
      if (combosRes?.success) setCombos(combosRes.data || []);
      if (catsRes?.success) setCategories(catsRes.data || []);
      if (ordersRes?.success) {
        setOrders(ordersRes.data || []);
        setOrdersTotal(ordersRes.pagination?.total ?? (ordersRes.data || []).length);
        setOrderPaymentCounts(ordersRes.paymentCounts || {});
        knownOrderIdsRef.current = new Set((ordersRes.data || []).map((o: Order) => o.id));
        knownLatestOrderMsRef.current = (ordersRes.data || []).reduce(
          (max: number, o: Order) => Math.max(max, new Date(o.created_at).getTime() || 0),
          0
        );
      }
      if (membersRes?.success) setMembers(membersRes.members || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      showToast('Lỗi kết nối cơ sở dữ liệu: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Tải danh sách khách hàng thành viên
  const fetchMembers = async () => {
    setMembersLoading(true);
    try {
      const res = await fetch('/api/admin/members', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setMembers(data.members || []);
      }
    } catch (err: any) {
      console.error('Error fetching members:', err);
    } finally {
      setMembersLoading(false);
    }
  };

  // 1-Click Sync from Store Website to Database
  const handleSyncStore = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch('/api/admin/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Đã đồng bộ toàn bộ sản phẩm và combo vào DB thành công!');
        fetchData();
      } else {
        showToast(data.error || 'Lỗi khi đồng bộ dữ liệu', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Fetch current authenticated admin user
    safeFetchJson<any>('/api/admin/auth/me')
      .then((data) => {
        if (data?.authenticated && data.user) {
          setCurrentUser(data.user);
          if (data.user.mustChangePassword) {
            setIsPasswordModalOpen(true);
          }
          // Tab mặc định theo vai trò:
          if (data.user.role === 'MARKETING') {
            setActiveTab('products');
          } else if (data.user.role === 'STORE_STAFF') {
            setActiveTab('orders');
          } else {
            setActiveTab('overview');
          }

          if (hasPermission(data.user, 'reviews.view')) {
            safeFetchJson<any>('/api/admin/reviews?limit=1')
              .then((rData) => {
                if (rData?.success && rData.counts?.pendingCount !== undefined) {
                  setPendingReviewsCount(rData.counts.pendingCount);
                }
              })
              .catch((err) => console.warn('Error fetching pending reviews count:', err));
          }
        }
      })
      .catch((err) => console.error('Failed to load current admin user', err));
  }, []);

  // Kiểm tra quyền truy cập tab
  const canAccessTab = (tab: AdminTab): boolean => {
    if (!currentUser) return true;
    switch (tab) {
      case 'overview':
        return hasPermission(currentUser, 'dashboard.view_company') || hasPermission(currentUser, 'dashboard.view_store');
      case 'inventory':
        return hasPermission(currentUser, 'inventory.view_own_store') || hasPermission(currentUser, 'inventory.view_all');
      case 'products':
        return hasPermission(currentUser, 'products.view');
      case 'combos':
        return hasPermission(currentUser, 'combos.view');
      case 'categories':
        return hasPermission(currentUser, 'categories.view');
      case 'orders':
        return hasPermission(currentUser, 'orders.view_own_store') || hasPermission(currentUser, 'orders.view_all');
      case 'banners':
        return hasPermission(currentUser, 'content.manage');
      case 'members':
        return hasPermission(currentUser, 'members.view_full') || hasPermission(currentUser, 'members.view_masked');
      case 'analytics':
        return hasPermission(currentUser, 'profit.view') || hasPermission(currentUser, 'dashboard.view_company');
      case 'database':
        return hasPermission(currentUser, 'system.sync') || hasPermission(currentUser, 'system.seed');
      case 'users':
        return hasPermission(currentUser, 'users.manage');
      case 'audit':
        return hasPermission(currentUser, 'audit.view');
      default:
        return true;
    }
  };

  const getDefaultTab = (): AdminTab => {
    if (currentUser?.role === 'MARKETING') return 'products';
    if (currentUser?.role === 'STORE_STAFF') return 'orders';
    return 'overview';
  };

  // ==================== ĐƠN HÀNG: PHÂN TRANG PHÍA MÁY CHỦ ====================
  // Gõ tìm kiếm → chờ 350ms rồi mới gọi API; đổi từ khóa/bộ lọc → về trang 1
  useEffect(() => {
    const t = setTimeout(() => setDebouncedOrderSearch(orderSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [orderSearch]);

  useEffect(() => {
    setOrderPage(1);
  }, [orderStatusFilter, debouncedOrderSearch]);

  const refreshOrderList = () => setOrderListVersion((v) => v + 1);

  useEffect(() => {
    if (activeTab !== 'orders') return;
    let cancelled = false;
    const params = new URLSearchParams({ page: String(orderPage), limit: '20' });
    if (orderStatusFilter !== 'ALL') params.set('status', orderStatusFilter);
    if (debouncedOrderSearch) params.set('q', debouncedOrderSearch);
    setOrderListLoading(true);
    safeFetchJson<any>(`/api/admin/orders?${params.toString()}`, { cache: 'no-store' })
      .then((res) => {
        if (cancelled || !res?.success) return;
        setOrderRows(res.data || []);
        setOrderPageInfo(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
        setOrderStatusCounts(res.statusCounts || { ALL: 0 });
        // Máy chủ có thể kéo về trang cuối nếu trang yêu cầu vượt quá tổng số trang
        if (res.pagination && res.pagination.page !== orderPage) setOrderPage(res.pagination.page);
      })
      .finally(() => {
        if (!cancelled) setOrderListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, orderPage, orderStatusFilter, debouncedOrderSearch, orderListVersion]);

  // ==================== THÔNG BÁO ĐƠN MỚI (tự làm mới mỗi 30 giây) ====================
  useEffect(() => {
    if (!currentUser) return;
    if (!(hasPermission(currentUser, 'orders.view_all') || hasPermission(currentUser, 'orders.view_own_store'))) return;
    let stopped = false;

    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      const res = await safeFetchJson<any>('/api/admin/orders?page=1&limit=20', { cache: 'no-store' });
      if (stopped || !res?.success || !res.pagination) return;
      setOrdersTotal(res.pagination.total);
      setOrderPaymentCounts(res.paymentCounts || {});

      const known = knownOrderIdsRef.current;
      if (!known) return; // chưa có mốc ban đầu (lần tải đầu thất bại) → chỉ lấy mốc ở lần này
      const rows: Order[] = res.data || [];
      const knownLatest = knownLatestOrderMsRef.current;
      const fresh = rows.filter((o) => !known.has(o.id) && (new Date(o.created_at).getTime() || 0) >= knownLatest);
      rows.forEach((o) => known.add(o.id));
      knownLatestOrderMsRef.current = rows.reduce((max, o) => Math.max(max, new Date(o.created_at).getTime() || 0), knownLatest);
      if (fresh.length === 0) return;

      const newest = fresh[0];
      const countLabel = fresh.length >= rows.length ? `${fresh.length}+` : String(fresh.length);
      setNewOrderCount((c) => c + fresh.length);
      showToast(
        fresh.length === 1
          ? `🔔 Đơn mới #${newest.order_code} — ${newest.full_name} (${formatVND(newest.total)})`
          : `🔔 Có ${countLabel} đơn hàng mới! Mới nhất #${newest.order_code} — ${newest.full_name}`,
        'info'
      );
      // Làm mới số liệu tổng quan, danh sách đơn gần đây và tab Đơn hàng
      safeFetchJson<any>('/api/admin/orders?page=1&limit=50', { cache: 'no-store' }).then((r) => {
        if (!stopped && r?.success) setOrders(r.data || []);
      });
      safeFetchJson<any>('/api/admin/stats', { cache: 'no-store' }).then((d) => {
        if (!stopped && d?.success) setStats(d);
      });
      refreshOrderList();
    };

    const timer = setInterval(poll, 30000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Vào tab Đơn hàng → coi như đã xem các đơn mới; tiêu đề tab trình duyệt hiện số đơn mới
  useEffect(() => {
    if (activeTab === 'orders') setNewOrderCount(0);
  }, [activeTab]);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = newOrderCount > 0 ? `(${newOrderCount}) ${base}` : base;
  }, [newOrderCount]);

  // Fetch admin accounts (Super Admin only)
  const fetchAdminUsers = async () => {
    setAdminUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setAdminUsers(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching admin users:', err);
    } finally {
      setAdminUsersLoading(false);
    }
  };

  // Tải danh sách nhật ký hoạt động (Audit Logs)
  const fetchAuditLogs = async (page = 1) => {
    setAuditLogsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(auditPagination.limit));
      if (auditActionFilter !== 'ALL') params.set('action', auditActionFilter);
      if (auditStoreFilter !== 'ALL') params.set('storeCode', auditStoreFilter);
      if (auditSearch.trim()) params.set('search', auditSearch.trim());

      const res = await fetch(`/api/admin/audit?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.data || []);
        if (data.pagination) {
          setAuditPagination(data.pagination);
        }
      } else {
        showToast(data.error || 'Lỗi khi tải nhật ký hoạt động', 'error');
      }
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      showToast('Lỗi khi tải nhật ký hoạt động: ' + err.message, 'error');
    } finally {
      setAuditLogsLoading(false);
    }
  };

  // Xuất file CSV danh sách nhật ký hoạt động
  const handleExportAuditCSV = () => {
    if (auditLogs.length === 0) {
      showToast('Chưa có dữ liệu nhật ký để xuất', 'info');
      return;
    }
    const headers = ['Mã Log', 'Thời Gian', 'Tài Khoản', 'Vai Trò', 'Hành Động', 'Loại Đối Tượng', 'Mã Đối Tượng', 'Cửa Hàng', 'IP'];
    const rows = auditLogs.map((log) => [
      log.id,
      new Date(log.created_at).toLocaleString('vi-VN'),
      log.admin_username,
      log.role,
      log.action,
      log.entity_type,
      log.entity_id || '',
      log.store_code || 'ALL',
      log.ip || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WebTSF_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Đã xuất ${auditLogs.length} dòng nhật ký sang CSV!`);
  };

  // Tải báo cáo lợi nhuận gộp (Chỉ SUPER_ADMIN với profit.view)
  const fetchProfitReport = async () => {
    if (!currentUser || !hasPermission(currentUser, 'profit.view')) return;
    setProfitLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('groupBy', profitGroupBy);
      if (profitStoreFilter !== 'ALL') params.set('storeCode', profitStoreFilter);
      const res = await fetch(`/api/admin/reports/profit?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setProfitData(data);
      }
    } catch (err) {
      console.error('Error fetching profit report:', err);
    } finally {
      setProfitLoading(false);
    }
  };

  // Xuất file CSV báo cáo lợi nhuận
  const handleExportProfitCSV = () => {
    if (!profitData?.breakdown || profitData.breakdown.length === 0) {
      showToast('Không có dữ liệu lợi nhuận để xuất CSV', 'error');
      return;
    }
    const headers = ['Tiêu chí / Đối tượng', 'Số đơn / Số lượng bán', 'Doanh thu (VNĐ)', 'Giá vốn (VNĐ)', 'Lợi nhuận gộp (VNĐ)', 'Tỷ suất (%)', 'Số mục chưa có giá vốn'];
    const rows = profitData.breakdown.map((r: any) => [
      `"${r.label || r.name || r.store_name || r.period || ''}"`,
      r.orders_count !== undefined ? r.orders_count : r.quantity_sold,
      r.revenue,
      r.cost,
      r.profit,
      `${r.margin}%`,
      r.missing_cost_items || 0,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e: any[]) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WebTSF_Loi_Nhuan_${profitGroupBy}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Đã xuất báo cáo lợi nhuận sang CSV thành công!');
  };

  // Fetch inventory for store
  const fetchInventory = async (storeCode?: string) => {
    setInventoryLoading(true);
    try {
      const targetStore = storeCode || selectedStoreCode;
      const res = await fetch(`/api/admin/inventory?storeCode=${targetStore}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setInventoryItems(data.data || []);
        if (data.stores) setStoreList(data.stores);
        if (data.currentStore) setSelectedStoreCode(data.currentStore);
        const stockMap: Record<string, number> = {};
        (data.data || []).forEach((item: InventoryItem) => {
          stockMap[item.product_id] = item.stock_quantity;
        });
        setEditedStock(stockMap);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setInventoryLoading(false);
    }
  };

  // ==================== LÔ HÀNG & HẠN SỬ DỤNG ====================
  const [inventoryLots, setInventoryLots] = useState<any[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lotFormOpen, setLotFormOpen] = useState(false);
  const [lotForm, setLotForm] = useState({ productId: '', lotCode: '', manufacturingDate: '', expiryDate: '', quantity: '' });

  const fetchInventoryLots = async (storeCode?: string) => {
    setLotsLoading(true);
    try {
      const code = storeCode || selectedStoreCode;
      const res = await safeFetchJson<any>(`/api/admin/inventory/lots?storeCode=${encodeURIComponent(code)}`, { cache: 'no-store' });
      if (res?.success) setInventoryLots(res.lots || []);
    } finally {
      setLotsLoading(false);
    }
  };

  const handleSaveLot = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = Math.round(Number(lotForm.quantity));
    if (!lotForm.productId || !lotForm.lotCode.trim() || !lotForm.manufacturingDate || !lotForm.expiryDate) {
      showToast('Vui lòng nhập đủ sản phẩm, mã lô, ngày sản xuất và hạn sử dụng', 'error');
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      showToast('Số lượng phải là số nguyên từ 1 trở lên', 'error');
      return;
    }
    if (lotForm.expiryDate <= lotForm.manufacturingDate) {
      showToast('Hạn sử dụng phải sau ngày sản xuất', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/inventory/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lotForm, lotCode: lotForm.lotCode.trim(), quantity, storeCode: selectedStoreCode }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Đã nhập lô hàng!');
        setLotForm({ productId: lotForm.productId, lotCode: '', manufacturingDate: '', expiryDate: '', quantity: '' });
        setLotFormOpen(false);
        fetchInventoryLots(selectedStoreCode);
      } else {
        showToast(data.error || 'Không thể nhập lô hàng', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Lô hàng của chi nhánh đang chọn: tải lại khi vào tab Tồn kho hoặc đổi chi nhánh
  useEffect(() => {
    if (activeTab === 'inventory') fetchInventoryLots(selectedStoreCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedStoreCode]);

  // Nạp lịch sử biến động tồn kho
  const fetchInventoryLogs = async (storeCode?: string) => {
    setLogsLoading(true);
    try {
      const code = storeCode || selectedStoreCode;
      const res = await fetch(`/api/admin/inventory/logs?storeCode=${code}&limit=50`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setInventoryLogs(data.data);
      }
    } catch (err) {
      console.error('Error fetching inventory logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Chuyển đơn sang chi nhánh khác (Chỉ SUPER_ADMIN)
  const handleTransferOrderStore = async (orderId: string, newStoreCode: string) => {
    if (!orderId || !newStoreCode) return;
    const storeName = storeList.find((s) => s.code === newStoreCode)?.name || newStoreCode;
    if (!confirm(`Bạn có chắc chắn muốn chuyển đơn hàng này sang chi nhánh: ${storeName}?`)) {
      return;
    }
    setIsTransferringOrder(true);
    try {
      const res = await fetch('/api/admin/orders/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, targetStoreCode: newStoreCode }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Đã chuyển chi nhánh thành công!');
        fetchData();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder({
            ...selectedOrder,
            store_code: newStoreCode,
            store_address: data.order?.store_address,
            note: data.order?.note,
          });
        }
      } else {
        alert(data.error || 'Lỗi khi chuyển chi nhánh');
      }
    } catch (err) {
      console.error('Error transferring order:', err);
      alert('Không thể kết nối đến máy chủ khi chuyển chi nhánh.');
    } finally {
      setIsTransferringOrder(false);
    }
  };

  // Fetch Banners and Brand Slides
  const fetchBannersAndSlides = async () => {
    setBannersLoading(true);
    try {
      const [banRes, sliRes] = await Promise.all([
        fetch('/api/admin/banners', { cache: 'no-store' }),
        fetch('/api/admin/brand-slides', { cache: 'no-store' }),
      ]);
      const banData = await banRes.json();
      const sliData = await sliRes.json();
      if (banData.success) setBannersList(banData.data || []);
      if (sliData.success) setBrandSlidesList(sliData.data || []);
    } catch (err) {
      console.error('Error fetching banners/slides:', err);
    } finally {
      setBannersLoading(false);
    }
  };

  // Nạp danh sách chi nhánh khi mở chi tiết đơn (storeList trước đây chỉ được nạp ở tab Tồn kho,
  // nên ô chọn "Chuyển đơn sang chi nhánh khác" bị rỗng nếu chưa từng mở tab đó)
  useEffect(() => {
    if (!selectedOrder || storeList.length > 0) return;
    let cancelled = false;
    fetch('/api/admin/stores', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success && Array.isArray(data.stores)) setStoreList(data.stores);
      })
      .catch((err) => console.error('Error loading stores for order transfer:', err));
    return () => {
      cancelled = true;
    };
  }, [selectedOrder?.id, storeList.length]);

  // Đồng bộ nạp dữ liệu khi chuyển tab sang Users, Inventory, Banners, hoặc Audit
  useEffect(() => {
    if (activeTab === 'users' && hasPermission(currentUser, 'users.manage')) {
      fetchAdminUsers();
    } else if (activeTab === 'inventory') {
      fetchInventory(selectedStoreCode);
    } else if (activeTab === 'banners') {
      fetchBannersAndSlides();
    } else if (activeTab === 'audit' && hasPermission(currentUser, 'audit.view')) {
      fetchAuditLogs(1);
    } else if (activeTab === 'analytics' && hasPermission(currentUser, 'profit.view')) {
      fetchProfitReport();
    }
  }, [activeTab]);

  // Tự động tải lại audit logs khi đổi bộ lọc
  useEffect(() => {
    if (activeTab === 'audit' && hasPermission(currentUser, 'audit.view')) {
      fetchAuditLogs(1);
    }
  }, [auditActionFilter, auditStoreFilter]);

  // Tự động tải lại báo cáo lợi nhuận khi đổi bộ lọc
  useEffect(() => {
    if (activeTab === 'analytics' && hasPermission(currentUser, 'profit.view')) {
      fetchProfitReport();
    }
  }, [profitGroupBy, profitStoreFilter]);

  // Helper tải ảnh lên máy chủ qua /api/admin/upload
  const handleUploadImageFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'products' | 'combos' | 'banners' | 'slides'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    formData.append('folder', type === 'slides' ? 'banners' : type);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setUploadingImage(true);
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || 'Tải ảnh lên thất bại', 'error');
        return;
      }

      const uploadedUrls: string[] = data.urls || [data.url];

      if (type === 'products') {
        const newImgs = uploadedUrls.map((url, idx) => ({
          id: `new_${Date.now()}_${idx}`,
          url,
          alt: editingProduct?.name || 'Sản phẩm Thái Sơn',
          sortOrder: productImages.length + idx + 1,
          is_active: true,
          imageType: 'gallery',
        }));
        setProductImages((prev) => [...prev, ...newImgs]);
        if (!editingProduct?.thumbnail && uploadedUrls.length > 0) {
          setEditingProduct((prev: any) => ({ ...prev, thumbnail: uploadedUrls[0] }));
        }
        showToast(`Đã tải lên ${uploadedUrls.length} ảnh sản phẩm thành công!`);
      } else if (type === 'combos') {
        const newImgs = uploadedUrls.map((url, idx) => ({
          id: `new_${Date.now()}_${idx}`,
          url,
          alt: editingCombo?.name || 'Combo Thái Sơn',
          sortOrder: comboImages.length + idx + 1,
          is_active: true,
          imageType: 'gallery',
        }));
        setComboImages((prev) => [...prev, ...newImgs]);
        if (!editingCombo?.image && uploadedUrls.length > 0) {
          setEditingCombo((prev: any) => ({ ...prev, image: uploadedUrls[0] }));
        }
        showToast(`Đã tải lên ${uploadedUrls.length} ảnh combo thành công!`);
      } else if (type === 'banners') {
        if (uploadedUrls.length > 0) {
          setEditingBanner((prev: any) => ({ ...prev, image: uploadedUrls[0] }));
          showToast('Đã tải ảnh banner lên thành công!');
        }
      } else if (type === 'slides') {
        if (uploadedUrls.length > 0) {
          setEditingSlide((prev: any) => ({ ...prev, image: uploadedUrls[0] }));
          showToast('Đã tải ảnh slide lên thành công!');
        }
      }
    } catch (err: any) {
      showToast('Lỗi khi tải ảnh: ' + err.message, 'error');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleAddImageUrl = (type: 'products' | 'combos') => {
    if (!newImageUrl.trim()) return;
    const url = newImageUrl.trim();
    if (type === 'products') {
      const newImg = {
        id: `url_${Date.now()}`,
        url,
        alt: editingProduct?.name || 'Sản phẩm',
        sortOrder: productImages.length + 1,
        is_active: true,
        imageType: 'gallery',
      };
      setProductImages((prev) => [...prev, newImg]);
      if (!editingProduct?.thumbnail) {
        setEditingProduct((prev: any) => ({ ...prev, thumbnail: url }));
      }
    } else {
      const newImg = {
        id: `url_${Date.now()}`,
        url,
        alt: editingCombo?.name || 'Combo',
        sortOrder: comboImages.length + 1,
        is_active: true,
        imageType: 'gallery',
      };
      setComboImages((prev) => [...prev, newImg]);
      if (!editingCombo?.image) {
        setEditingCombo((prev: any) => ({ ...prev, image: url }));
      }
    }
    setNewImageUrl('');
    showToast('Đã thêm ảnh vào danh sách');
  };

  const handleMoveProductImage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= productImages.length) return;
    const newList = [...productImages];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;
    newList.forEach((img, i) => {
      img.sortOrder = i + 1;
    });
    setProductImages(newList);
  };

  const handleDeleteProductImage = (index: number) => {
    const imgToDelete = productImages[index];
    const newList = productImages.filter((_, i) => i !== index);
    newList.forEach((img, i) => {
      img.sortOrder = i + 1;
    });
    setProductImages(newList);
    if (editingProduct?.thumbnail === imgToDelete.url) {
      setEditingProduct((prev: any) => ({ ...prev, thumbnail: newList[0]?.url || '' }));
    }
  };

  const handleMoveComboImage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= comboImages.length) return;
    const newList = [...comboImages];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;
    newList.forEach((img, i) => {
      img.sortOrder = i + 1;
    });
    setComboImages(newList);
  };

  const handleDeleteComboImage = (index: number) => {
    const imgToDelete = comboImages[index];
    const newList = comboImages.filter((_, i) => i !== index);
    newList.forEach((img, i) => {
      img.sortOrder = i + 1;
    });
    setComboImages(newList);
    if (editingCombo?.image === imgToDelete.url) {
      setEditingCombo((prev: any) => ({ ...prev, image: newList[0]?.url || '' }));
    }
  };

  // Banner CRUD handlers
  const handleOpenCreateBanner = () => {
    setEditingBanner({
      title: '',
      subtitle: '',
      tag: '',
      image: '',
      link: '/#san-pham',
      placement: 'hero',
      sort_order: bannersList.length + 1,
      is_active: true,
    });
    setIsBannerModalOpen(true);
  };

  const handleOpenEditBanner = (ban: AdminBanner) => {
    setEditingBanner({ ...ban });
    setIsBannerModalOpen(true);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner?.image) {
      showToast('Vui lòng chọn hoặc nhập hình ảnh banner', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const isUpdating = Boolean(editingBanner.id);
      const url = '/api/admin/banners';
      const method = isUpdating ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBanner),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isUpdating ? 'Đã cập nhật banner thành công!' : 'Đã tạo banner mới thành công!');
        setIsBannerModalOpen(false);
        fetchBannersAndSlides();
      } else {
        showToast(data.error || 'Lỗi khi lưu banner', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa banner này?')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/banners?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Đã xóa banner thành công');
        fetchBannersAndSlides();
      } else {
        showToast(data.error || 'Không thể xóa banner', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBannerActive = async (ban: AdminBanner) => {
    try {
      const res = await fetch('/api/admin/banners', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ban.id, is_active: !ban.is_active }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã ${!ban.is_active ? 'bật' : 'tắt'} hiển thị banner`);
        fetchBannersAndSlides();
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  // Brand Slide CRUD Handlers
  const handleOpenEditSlide = (slide: AdminBrandSlide) => {
    setEditingSlide({ ...slide });
    setIsSlideModalOpen(true);
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlide?.title || !editingSlide?.image) {
      showToast('Vui lòng nhập tiêu đề và hình ảnh slide', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const isUpdating = Boolean(editingSlide.id);
      const url = '/api/admin/brand-slides';
      const method = isUpdating ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSlide),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã cập nhật slide thành công!');
        setIsSlideModalOpen(false);
        fetchBannersAndSlides();
      } else {
        showToast(data.error || 'Lỗi khi lưu slide', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };


  // Handler mở modal tạo tài khoản admin mới
  const handleOpenCreateUser = () => {
    setUserModalMode('create');
    setUserFormData({
      id: '',
      username: '',
      email: '',
      fullName: '',
      password: '',
      role: 'STORE_STAFF',
      storeCode: storeList[0]?.code || 'NH',
      isActive: true,
    });
    setIsUserModalOpen(true);
  };

  // Handler mở modal sửa tài khoản admin
  const handleOpenEditUser = (user: AdminUser) => {
    setUserModalMode('edit');
    setUserFormData({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name || '',
      password: '',
      role: (user.role === 'ADMIN' ? 'STORE_STAFF' : user.role) as Role,
      storeCode: user.store_code || storeList[0]?.code || 'NH',
      isActive: user.is_active,
    });
    setIsUserModalOpen(true);
  };

  // Lưu tài khoản admin (Tạo mới hoặc Sửa)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (userModalMode === 'create') {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: userFormData.username,
            email: userFormData.email,
            fullName: userFormData.fullName,
            password: userFormData.password,
            role: userFormData.role,
            storeCode: userFormData.role === 'STORE_STAFF' ? userFormData.storeCode : null,
          }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Tạo tài khoản quản trị thành công!');
          setIsUserModalOpen(false);
          fetchAdminUsers();
        } else {
          showToast(data.error || 'Lỗi khi tạo tài khoản', 'error');
        }
      } else {
        const res = await fetch('/api/admin/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: userFormData.id,
            fullName: userFormData.fullName,
            email: userFormData.email,
            role: userFormData.role,
            storeCode: userFormData.role === 'STORE_STAFF' ? userFormData.storeCode : null,
            isActive: userFormData.isActive,
            password: userFormData.password || undefined,
          }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Cập nhật tài khoản thành công!');
          setIsUserModalOpen(false);
          fetchAdminUsers();
        } else {
          showToast(data.error || 'Lỗi khi cập nhật tài khoản', 'error');
        }
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Khóa / Mở khóa tài khoản admin
  const handleToggleUserStatus = async (user: AdminUser) => {
    if (currentUser?.id === user.id) {
      showToast('Bạn không thể tự khóa tài khoản của chính mình', 'error');
      return;
    }
    const nextStatus = !user.is_active;
    const confirmMsg = nextStatus
      ? `Kích hoạt lại tài khoản "${user.username}"?`
      : `Tạm khóa tài khoản "${user.username}"? Tài khoản này sẽ không thể đăng nhập.`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, isActive: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(nextStatus ? `Đã kích hoạt tài khoản ${user.username}` : `Đã tạm khóa tài khoản ${user.username}`);
        fetchAdminUsers();
      } else {
        showToast(data.error || 'Không thể cập nhật trạng thái', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  // Xóa tài khoản admin
  const handleDeleteUser = async (user: AdminUser) => {
    if (currentUser?.id === user.id) {
      showToast('Bạn không thể xóa tài khoản của chính mình', 'error');
      return;
    }
    if (!confirm(`Bạn có chắc muốn xóa tài khoản "${user.username}" (${user.full_name})? Hành động này không thể hoàn tác.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Đã xóa tài khoản thành công!');
        fetchAdminUsers();
      } else {
        showToast(data.error || 'Không thể xóa tài khoản', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  // ==================== MEMBER ACTIONS ====================
  // Xem chi tiết khách hàng thành viên & nạp danh sách đơn hàng
  const handleOpenMemberDetail = async (member: MemberUser) => {
    setSelectedMember(member);
    setIsMemberDetailModalOpen(true);
    setMemberDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/members?id=${member.id}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setSelectedMember(data.member);
        setMemberOrders(data.orders || []);
      }
    } catch (err: any) {
      showToast('Lỗi khi tải thông tin chi tiết: ' + err.message, 'error');
    } finally {
      setMemberDetailLoading(false);
    }
  };

  // Khóa / Mở khóa tài khoản thành viên
  const handleToggleMemberStatus = async (member: MemberUser) => {
    const nextStatus = !member.is_active;
    const confirmMsg = nextStatus
      ? `Kích hoạt lại tài khoản thành viên "${member.full_name}" (${member.email})?`
      : `Tạm khóa tài khoản thành viên "${member.full_name}" (${member.email})? Khách hàng này sẽ không thể đăng nhập hoặc đặt đơn bằng tài khoản.`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/admin/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id, isActive: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(nextStatus ? `Đã kích hoạt tài khoản ${member.full_name}` : `Đã tạm khóa tài khoản ${member.full_name}`);
        fetchMembers();
        if (selectedMember && selectedMember.id === member.id) {
          setSelectedMember({ ...selectedMember, is_active: nextStatus });
        }
      } else {
        showToast(data.error || 'Không thể cập nhật trạng thái', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  // Xóa tài khoản thành viên
  const handleDeleteMember = async (member: MemberUser) => {
    if (!confirm(`Bạn có chắc muốn xóa tài khoản thành viên "${member.full_name}" (${member.email})? Dữ liệu lịch sử đơn hàng của khách vẫn được lưu giữ.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/members?id=${member.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Đã xóa tài khoản thành viên thành công!');
        fetchMembers();
        if (selectedMember?.id === member.id) setIsMemberDetailModalOpen(false);
      } else {
        showToast(data.error || 'Không thể xóa thành viên', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  // Xuất file CSV danh sách thành viên
  const handleExportMembersCSV = () => {
    if (members.length === 0) {
      showToast('Chưa có thành viên nào để xuất', 'info');
      return;
    }
    const headers = ['Mã TV', 'Họ Và Tên', 'Email', 'Điện Thoại', 'Đăng Ký Qua', 'Địa Chỉ', 'Tỉnh/TP', 'Số Đơn', 'Tổng Chi Tiêu (VNĐ)', 'Trạng Thái', 'Ngày Đăng Ký'];
    const rows = members.map((m) => [
      m.id,
      `"${m.full_name}"`,
      `"${m.email}"`,
      `"${m.phone || ''}"`,
      m.provider || 'local',
      `"${m.address || ''}"`,
      `"${m.province || ''}"`,
      m.total_orders,
      m.total_spent,
      m.is_active ? 'Hoạt động' : 'Tạm khóa',
      new Date(m.created_at).toLocaleDateString('vi-VN'),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Thanh_Vien_Thai_Son_Foods_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Đã xuất danh sách thành viên ra file CSV!');
  };

  // Thay đổi số lượng mặt hàng trong state
  const handleStockChange = (productId: string, value: number) => {
    setEditedStock((prev) => ({
      ...prev,
      [productId]: Math.max(0, value),
    }));
  };

  // Thêm nhanh số lượng (+1, +5, +10, -1, -5)
  const handleQuickStockAdd = (productId: string, amount: number) => {
    setEditedStock((prev) => {
      const current = prev[productId] !== undefined ? prev[productId] : 100;
      return {
        ...prev,
        [productId]: Math.max(0, current + amount),
      };
    });
  };

  // Lưu số lượng của 1 mặt hàng
  const handleSaveInventoryItem = async (productId: string) => {
    const qty = editedStock[productId];
    if (qty === undefined) return;
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeCode: selectedStoreCode,
          productId,
          stockQuantity: qty,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Đã cập nhật số lượng mặt hàng!');
        fetchInventory(selectedStoreCode);
      } else {
        showToast(data.error || 'Lỗi khi cập nhật tồn kho', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  // Mở Pop-up cập nhật số lượng chai cho mặt hàng
  const handleOpenStockModal = (item: InventoryItem) => {
    const currentQty = editedStock[item.product_id] !== undefined ? editedStock[item.product_id] : item.stock_quantity;
    setStockModalItem({
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku || 'N/A',
      thumbnail: item.thumbnail,
      unit: item.unit || '1 chai',
      current_stock: currentQty,
      new_stock: currentQty,
      updated_at: item.updated_at,
    });
  };

  // Xác nhận cập nhật số lượng từ Pop-up
  const handleConfirmStockUpdate = async () => {
    if (!stockModalItem) return;
    const qty = Math.max(0, parseInt(String(stockModalItem.new_stock), 10) || 0);
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeCode: selectedStoreCode,
          productId: stockModalItem.product_id,
          stockQuantity: qty,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã cập nhật số lượng ${stockModalItem.product_name} thành ${qty} chai!`);
        setEditedStock((prev) => ({
          ...prev,
          [stockModalItem.product_id]: qty,
        }));
        setStockModalItem(null);
        fetchInventory(selectedStoreCode);
      } else {
        showToast(data.error || 'Lỗi khi cập nhật số lượng', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Lưu tất cả số lượng của tất cả mặt hàng
  const handleSaveAllInventory = async () => {
    setInventorySaving(true);
    try {
      const itemsToUpdate = Object.entries(editedStock).map(([productId, stockQuantity]) => ({
        productId,
        stockQuantity,
      }));

      const res = await fetch('/api/admin/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeCode: selectedStoreCode,
          items: itemsToUpdate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Đã lưu tất cả số lượng mặt hàng thành công!');
        fetchInventory(selectedStoreCode);
      } else {
        showToast(data.error || 'Lỗi khi lưu số lượng', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setInventorySaving(false);
    }
  };

  const handleOpenStoreAddressModal = (store?: any) => {
    const target =
      store ||
      storeList.find((s) => s.code === selectedStoreCode) || {
        code: selectedStoreCode,
        name: `Cửa hàng ${selectedStoreCode}`,
        address: '',
        phone: '',
        district: '',
        province: 'Hồ Chí Minh',
        ward: '',
        map_url: '',
      };
    setStoreAddressForm({
      code: target.code || selectedStoreCode,
      name: target.name || `Cửa hàng ${target.code || selectedStoreCode}`,
      address: target.address || '',
      phone: target.phone || '',
      district: target.district || '',
      province: target.province || 'Hồ Chí Minh',
      ward: target.ward || '',
      map_url: target.map_url || '',
    });
    setIsStoreAddressModalOpen(true);
  };

  const handleSaveStoreAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/stores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeAddressForm),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Đã cập nhật thông tin địa chỉ cửa hàng thành công!');
        setIsStoreAddressModalOpen(false);
        fetchInventory(selectedStoreCode);
      } else {
        showToast(data.error || 'Cập nhật thất bại', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Mở hộp thoại đổi mật khẩu (nút chìa khóa và nút chữ ở chân thanh bên dùng chung)
  const openPasswordModal = () => {
    setPwdError('');
    setPwdSuccess('');
    setPwdCurrent('');
    setPwdNew('');
    setPwdConfirm('');
    setIsPasswordModalOpen(true);
  };

  const handleLogout = async () => {
    if (!confirm('Bạn có chắc muốn đăng xuất khỏi hệ thống quản trị?')) return;
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
      window.location.href = '/admin/login';
    } catch {
      window.location.href = '/admin/login';
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!pwdCurrent) {
      setPwdError('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (pwdNew.length < 8) {
      setPwdError('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    const regex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
    if (!regex.test(pwdNew)) {
      setPwdError('Mật khẩu mới phải bao gồm cả chữ cái và chữ số');
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setPwdError('Mật khẩu xác nhận không khớp');
      return;
    }
    if (pwdNew === pwdCurrent) {
      setPwdError('Mật khẩu mới không được trùng với mật khẩu hiện tại');
      return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch('/api/admin/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: pwdCurrent,
          newPassword: pwdNew,
          confirmPassword: pwdConfirm,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPwdError(data.error || 'Đổi mật khẩu thất bại');
        setPwdLoading(false);
        return;
      }

      setPwdSuccess('Đổi mật khẩu thành công! Thông tin đăng nhập đã được cập nhật an toàn.');
      if (currentUser) {
        setCurrentUser({ ...currentUser, mustChangePassword: false });
      }
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPwdCurrent('');
        setPwdNew('');
        setPwdConfirm('');
        setPwdSuccess('');
        showToast('Mật khẩu mới đã được cập nhật an toàn!');
        fetchData();
      }, 1200);
    } catch (err: any) {
      setPwdError('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      setPwdLoading(false);
    }
  };

  // Quick seed demo orders
  const handleSeedDemoOrders = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Đã tạo dữ liệu đơn hàng mẫu thành công!');
        fetchData();
      } else {
        showToast(data.error || 'Không thể tạo đơn mẫu', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== PRODUCT CRUD ====================
  const handleOpenCreateProduct = () => {
    setEditingProduct({
      name: '',
      sku: 'TSF-' + Math.floor(100 + Math.random() * 900),
      category_id: categories.length > 0 ? categories[0].id : '',
      price: 18000,
      unit: '1 chai',
      thumbnail: '',
      short_description: '',
      description: '',
      is_featured: false,
      is_new: true,
      is_best_seller: false,
      is_active: true,
    });
    setProductFormVariants([
      { name: '1 chai', quantity: 1, price: 18000, unit: 'chai' },
      { name: 'Lốc 6 chai', quantity: 6, price: 108000, unit: 'lốc' },
    ]);
    setProductImages([]);
    setNewImageUrl('');
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct({ ...prod });
    setProductFormVariants(prod.variants && prod.variants.length > 0 ? [...prod.variants] : []);
    const initialImages =
      Array.isArray((prod as any).images) && (prod as any).images.length > 0
        ? [...(prod as any).images]
        : prod.thumbnail
        ? [{ id: 'thumb-1', url: prod.thumbnail, alt: prod.name, sortOrder: 1, is_active: true }]
        : [];
    setProductImages(initialImages);
    setNewImageUrl('');
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.price) {
      showToast('Vui lòng nhập tên và giá sản phẩm', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const isUpdating = Boolean(editingProduct.id);
      const url = '/api/admin/products';
      const method = isUpdating ? 'PUT' : 'POST';

      const resolvedThumbnail = editingProduct?.thumbnail || (productImages[0]?.url || '');

      const payload = {
        ...editingProduct,
        thumbnail: resolvedThumbnail,
        variants: productFormVariants,
        images: productImages,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        showToast(isUpdating ? 'Cập nhật sản phẩm thành công!' : 'Thêm sản phẩm mới thành công!');
        setIsProductModalOpen(false);
        fetchData();
      } else {
        showToast(data.error || 'Thao tác thất bại', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleProductActive = async (prod: Product) => {
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: prod.id, is_active: !prod.is_active }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã ${!prod.is_active ? 'kích hoạt' : 'ẩn'} sản phẩm "${prod.name}"`);
        setProducts((prev) =>
          prev.map((p) => (p.id === prod.id ? { ...p, is_active: !prod.is_active } : p))
        );
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa sản phẩm "${name}"?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã xóa sản phẩm "${name}"`);
        fetchData();
      } else {
        showToast(data.error || 'Không thể xóa sản phẩm', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== ORDER ACTIONS ====================
  const handleRequestStatusChange = (order: Order, newStatus: Order['status']) => {
    if (order.status === newStatus) return;
    setPendingStatusChange({
      orderId: order.id,
      orderCode: order.order_code,
      customerName: order.full_name,
      currentStatus: order.status,
      newStatus,
    });
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          data.message ||
            `Đã cập nhật trạng thái đơn thành ${statusMap[newStatus]?.label}`
        );
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: newStatus,
                  inventory_deducted: data.data?.inventory_deducted ?? o.inventory_deducted,
                  store_code: data.data?.store_code ?? o.store_code,
                }
              : o
          )
        );
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder({
            ...selectedOrder,
            status: newStatus,
            inventory_deducted: data.data?.inventory_deducted ?? selectedOrder.inventory_deducted,
            store_code: data.data?.store_code ?? selectedOrder.store_code,
          });
        }
        refreshOrderList();
        // Làm mới tồn kho nếu đang quản lý kho
        fetchInventory(selectedStoreCode);
        // Refresh stats
        safeFetchJson('/api/admin/stats').then((d) => d?.success && setStats(d));
      } else {
        showToast(data.error || 'Cập nhật thất bại', 'error');
        refreshOrderList(); // đồng bộ lại nếu trạng thái đơn đã bị người khác đổi
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Đối soát tiền thu COD
  const handleReconcileCod = async (orderId: string, amount: number) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/orders/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reconcile_cod',
          orderId,
          amount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Đã đối soát COD thành công!');
        refreshOrderList();
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  cod_reconciled: true,
                  cod_collected_amount: amount,
                  cod_reconciled_at: new Date().toISOString(),
                }
              : o
          )
        );
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder({
            ...selectedOrder,
            cod_reconciled: true,
            cod_collected_amount: amount,
            cod_reconciled_at: new Date().toISOString(),
          });
        }
      } else {
        showToast(data.error || 'Lỗi đối soát COD', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Xác nhận đã nhận tiền chuyển khoản cho đơn không phải COD (nhập mã giao dịch ngân hàng)
  const [paymentRefInput, setPaymentRefInput] = useState('');
  const handleConfirmPayment = async (orderId: string) => {
    const ref = paymentRefInput.trim();
    if (!ref) {
      showToast('Vui lòng nhập mã giao dịch ngân hàng', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: ref }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Đã xác nhận thanh toán chuyển khoản!');
        setPaymentRefInput('');
        if (data.order) setSelectedOrder((prev) => (prev && prev.id === orderId ? { ...prev, ...data.order, items: prev.items } : prev));
        refreshOrderList();
        fetchData();
        fetchInventory(selectedStoreCode);
      } else {
        showToast(data.error || 'Không thể xác nhận thanh toán', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOrder = async (id: string, code: string) => {
    if (!confirm(`Bạn có chắc muốn xóa đơn hàng #${code}? Hành động này không thể hoàn tác.`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/orders?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã xóa đơn hàng #${code}`);
        refreshOrderList();
        if (selectedOrder?.id === id) setIsOrderDetailModalOpen(false);
        fetchData();
      } else {
        showToast(data.error || 'Không thể xóa đơn hàng', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenOrderDetail = async (order: Order) => {
    setSelectedOrder(order);
    setIsOrderDetailModalOpen(true);
    // Fetch full order details
    try {
      const res = await safeFetchJson<any>(`/api/admin/orders?id=${order.id}`);
      if (res?.success && res.order) {
        setSelectedOrder(res.order);
      }
    } catch (err) {
      console.error('Error fetching order items:', err);
    }
  };

  // ==================== CATEGORY CRUD ====================
  const handleOpenCreateCategory = () => {
    setEditingCategory({ name: '', slug: '' });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory({ id: cat.id, name: cat.name, slug: cat.slug });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory?.name) {
      showToast('Vui lòng nhập tên danh mục', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const isUpdating = Boolean(editingCategory.id);
      const url = '/api/admin/categories';
      const method = isUpdating ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCategory),
      });
      const data = await res.json();

      if (data.success) {
        showToast(isUpdating ? 'Cập nhật danh mục thành công!' : 'Tạo danh mục mới thành công!');
        setIsCategoryModalOpen(false);
        fetchData();
      } else {
        showToast(data.error || 'Thao tác thất bại', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Xóa danh mục "${name}"? Các sản phẩm thuộc danh mục này sẽ chuyển về chưa phân loại.`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/categories?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã xóa danh mục "${name}"`);
        fetchData();
      } else {
        showToast(data.error || 'Không thể xóa', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== COMBO CRUD ====================
  const handleOpenCreateCombo = () => {
    setEditingCombo({
      name: '',
      description: '',
      original_price: 180000,
      sale_price: 160000,
      total_items: 10,
      discount: 11,
      image: '',
      is_featured: true,
      is_best_seller: false,
      is_active: true,
    });
    setComboImages([]);
    setNewImageUrl('');
    setIsComboModalOpen(true);
  };

  const handleOpenEditCombo = (c: Combo) => {
    setEditingCombo({ ...c });
    const initialImages =
      Array.isArray((c as any).images) && (c as any).images.length > 0
        ? [...(c as any).images]
        : c.image
        ? [{ id: 'cthumb-1', url: c.image, alt: c.name, sortOrder: 1, is_active: true }]
        : [];
    setComboImages(initialImages);
    setNewImageUrl('');
    setIsComboModalOpen(true);
  };

  const handleSaveCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCombo?.name || editingCombo?.sale_price === undefined) {
      showToast('Vui lòng nhập tên combo và giá bán', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const isUpdating = Boolean(editingCombo.id);
      const url = '/api/admin/combos';
      const method = isUpdating ? 'PUT' : 'POST';

      const resolvedImage = editingCombo?.image || (comboImages[0]?.url || '');

      const payload = {
        ...editingCombo,
        image: resolvedImage,
        images: comboImages,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isUpdating ? 'Đã cập nhật combo thành công!' : 'Đã tạo combo mới thành công!');
        setIsComboModalOpen(false);
        fetchData();
      } else {
        showToast(data.error || 'Không thể lưu combo', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleComboActive = async (c: Combo) => {
    try {
      const res = await fetch('/api/admin/combos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, is_active: !c.is_active }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã ${!c.is_active ? 'bật bán' : 'tạm dừng'} combo "${c.name.slice(0, 30)}..."`);
        fetchData();
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  const handleDeleteCombo = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa combo "${name}" khỏi cơ sở dữ liệu?`)) return;
    try {
      const res = await fetch(`/api/admin/combos?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã xóa combo "${name.slice(0, 30)}..."`);
        fetchData();
      } else {
        showToast(data.error || 'Không thể xóa combo', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  // ==================== CSV EXPORT ====================
  const handleExportOrdersCSV = () => {
    if (orderStatusCounts.ALL === 0) {
      showToast('Chưa có đơn hàng nào để xuất', 'info');
      return;
    }
    // Xuất TOÀN BỘ đơn khớp bộ lọc hiện tại (không chỉ trang đang xem) — máy chủ sinh file, thoát ký tự an toàn
    const params = new URLSearchParams({ export: 'csv' });
    if (orderStatusFilter !== 'ALL') params.set('status', orderStatusFilter);
    if (debouncedOrderSearch) params.set('q', debouncedOrderSearch);
    const link = document.createElement('a');
    link.href = `/api/admin/orders?${params.toString()}`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Đang tải file CSV...');
  };

  // ==================== FILTER LOGIC ====================
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(prodSearch.toLowerCase()));
      const matchCat = prodCatFilter === 'ALL' || p.category_id === prodCatFilter;
      const matchStatus =
        prodStatusFilter === 'ALL' ||
        (prodStatusFilter === 'ACTIVE' && p.is_active) ||
        (prodStatusFilter === 'INACTIVE' && !p.is_active) ||
        (prodStatusFilter === 'FEATURED' && p.is_featured) ||
        (prodStatusFilter === 'BEST_SELLER' && p.is_best_seller);
      return matchSearch && matchCat && matchStatus;
    });
  }, [products, prodSearch, prodCatFilter, prodStatusFilter]);

  const filteredCombos = useMemo(() => {
    return combos.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(comboSearch.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(comboSearch.toLowerCase()));
      const matchFilter =
        comboFilter === 'ALL' ||
        (comboFilter === 'ACTIVE' && c.is_active) ||
        (comboFilter === 'INACTIVE' && !c.is_active) ||
        (comboFilter === 'FEATURED' && c.is_featured) ||
        (comboFilter === 'BEST_SELLER' && c.is_best_seller);
      return matchSearch && matchFilter;
    });
  }, [combos, comboSearch, comboFilter]);

  // Bộ lọc danh sách tồn kho mặt hàng
  const filteredInventory = useMemo(() => {
    return inventoryItems.filter((item) => {
      const matchSearch =
        item.product_name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        item.sku.toLowerCase().includes(inventorySearch.toLowerCase());
      if (!matchSearch) return false;

      const qty = editedStock[item.product_id] !== undefined ? editedStock[item.product_id] : item.stock_quantity;
      if (inventoryStockFilter === 'IN_STOCK') return qty > 30;
      if (inventoryStockFilter === 'LOW_STOCK') return qty > 0 && qty <= 30;
      if (inventoryStockFilter === 'OUT_OF_STOCK') return qty === 0;
      return true;
    });
  }, [inventoryItems, inventorySearch, inventoryStockFilter, editedStock]);

  // Bộ lọc danh sách tài khoản admin
  const filteredAdminUsers = useMemo(() => {
    return adminUsers.filter((u) => {
      const matchSearch =
        u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.full_name && u.full_name.toLowerCase().includes(userSearch.toLowerCase()));
      if (!matchSearch) return false;

      if (userRoleFilter === 'SUPER_ADMIN') return u.role === 'SUPER_ADMIN';
      if (userRoleFilter === 'ADMIN') return u.role === 'ADMIN';
      return true;
    });
  }, [adminUsers, userSearch, userRoleFilter]);

  // Bộ lọc danh sách khách hàng thành viên
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const q = memberSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.phone && m.phone.toLowerCase().includes(q)) ||
        (m.address && m.address.toLowerCase().includes(q)) ||
        (m.province && m.province.toLowerCase().includes(q));

      const matchProvider =
        memberProviderFilter === 'ALL' ||
        (memberProviderFilter === 'local' && (m.provider === 'local' || !m.provider)) ||
        m.provider === memberProviderFilter;

      const matchStatus =
        memberStatusFilter === 'ALL' ||
        (memberStatusFilter === 'ACTIVE' && m.is_active) ||
        (memberStatusFilter === 'LOCKED' && !m.is_active);

      return matchSearch && matchProvider && matchStatus;
    });
  }, [members, memberSearch, memberProviderFilter, memberStatusFilter]);

  // Status mapping colors & labels
  const statusMap: Record<string, { label: string; bg: string; text: string; icon: any }> = {
    PENDING: { label: 'Chờ xử lý', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', text: 'text-amber-400', icon: Clock },
    CONFIRMED: { label: 'Đã xác nhận', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20', text: 'text-blue-400', icon: CheckCircle2 },
    PROCESSING: { label: 'Đang chuẩn bị', bg: 'bg-leaf-500/10 text-leaf-400 border-leaf-500/20', text: 'text-leaf-400', icon: Boxes },
    SHIPPING: { label: 'Đang giao hàng', bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', text: 'text-cyan-400', icon: Truck },
    COMPLETED: { label: 'Hoàn thành', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', text: 'text-emerald-400', icon: CheckCircle2 },
    CANCELLED: { label: 'Đã hủy', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', text: 'text-rose-400', icon: XCircle },
  };

  return (
    <div
      style={{ '--color-slate-400': '#e0ebe5' } as React.CSSProperties}
      className="admin-theme fixed inset-0 z-[999] bg-forest-950 text-slate-100 flex flex-col font-sans overflow-hidden [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white"
    >
      <style>{`
        @layer utilities {
          :where(.admin-theme) .text-slate-400 {
            color: #e0ebe5;
          }
          :where(.admin-theme) .to-teal-400 {
            --tw-gradient-to: #dee7e6;
          }
          :where(.admin-theme) .border-slate-800 {
            border-color: #7ca250;
          }
        }
      `}</style>
      {/* ==================== TOAST NOTIFICATION ==================== */}
      {toast && (
        <div className="fixed top-5 right-5 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-medium backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-blue-950/90 border-blue-500/40 text-blue-200'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
            {toast.type === 'info' && <Sparkles className="w-5 h-5 text-blue-400" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ==================== TOP NAVIGATION BAR ==================== */}
      <header className="h-16 bg-forest-950/95 border-b border-slate-800 flex items-center justify-between px-4 lg:px-6 shrink-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 lg:hidden rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/admin" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/30">
              <span className="text-white text-lg tracking-tighter">TSF</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white text-lg tracking-tight group-hover:text-emerald-400 transition-colors">
                  Thái Sơn Foods
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                  Admin Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Hệ thống quản trị & Cơ sở dữ liệu WebTSF</p>
            </div>
          </Link>
        </div>

        {/* Center: DB Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/60 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-300 font-medium">PostgreSQL:</span>
          <span className="text-emerald-400 font-mono text-[1.125em]">WebTSF</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400 text-[11px]">Port 5432 (127.0.0.1)</span>
        </div>

        {/* Right action tools */}
        <div className="flex items-center gap-2.5">
          {hasPermission(currentUser, 'system.sync') && (
            <button
              onClick={handleSyncStore}
              disabled={syncLoading}
              title="Đồng bộ toàn bộ sản phẩm và combo từ website vào cơ sở dữ liệu PostgreSQL WebTSF"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${syncLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncLoading ? 'Đang đồng bộ...' : 'Đồng bộ Store -> DB'}</span>
              <span className="sm:hidden">{syncLoading ? 'Đồng bộ...' : 'Sync DB'}</span>
            </button>
          )}

          {hasPermission(currentUser, 'system.seed') && (
            <button
              onClick={handleSeedDemoOrders}
              disabled={actionLoading}
              title="Tạo đơn hàng mẫu để kiểm tra tính năng biểu đồ & danh sách đơn"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-leaf-600/20 text-leaf-300 border border-leaf-500/30 hover:bg-leaf-600/30 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-leaf-400" />
              <span>Nạp Đơn Mẫu</span>
            </button>
          )}

          <button
            onClick={fetchData}
            disabled={loading}
            title="Làm mới dữ liệu từ Database WebTSF"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-900/20 transition-all"
          >
            <span>Xem Website</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          {/* Admin User Badge & Logout in Header */}
          <div className="hidden md:flex items-center pl-1.5 border-l border-slate-800">
            <button
              onClick={handleLogout}
              title="Đăng xuất tài khoản quản trị"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600/30 border border-rose-500/20 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* ==================== MAIN WORKSPACE ==================== */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR */}
        <aside
          className={`fixed inset-y-16 left-0 z-40 w-64 bg-forest-950 border-r border-slate-800 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 space-y-6 overflow-y-auto">
            {/* Nav links */}
            <div className="space-y-1">
              <p className="px-3 text-[12px] uppercase tracking-wider text-slate-400">
                Menu Quản Trị
              </p>
              {(hasPermission(currentUser, 'dashboard.view_company') || hasPermission(currentUser, 'dashboard.view_store')) && (
                <button
                  onClick={() => {
                    setActiveTab('overview');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'overview'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Tổng quan</span>
                  </div>
                </button>
              )}

              {/* MỤC DÀNH CHO CỬA HÀNG & QUẢN TRỊ: CẬP NHẬT SỐ LƯỢNG MẶT HÀNG */}
              {(hasPermission(currentUser, 'inventory.view_own_store') || hasPermission(currentUser, 'inventory.view_all')) && (
                <button
                  onClick={() => {
                    setActiveTab('inventory');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'inventory'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PackageCheck className="w-4 h-4 text-amber-400" />
                    <span>Cập nhật số lượng</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {currentUser?.role === 'STORE_STAFF' ? 'Cửa hàng' : 'Kho hàng'}
                  </span>
                </button>
              )}

              {hasPermission(currentUser, 'products.view') && (
                <button
                  onClick={() => {
                    setActiveTab('products');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'products'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4" />
                    <span>Sản phẩm</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                    {products.length}
                  </span>
                </button>
              )}

              {hasPermission(currentUser, 'combos.view') && (
                <button
                  onClick={() => {
                    setActiveTab('combos');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'combos'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Boxes className="w-4 h-4" />
                    <span>Gói Combo</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                    {combos.length}
                  </span>
                </button>
              )}

              {(hasPermission(currentUser, 'orders.view_own_store') || hasPermission(currentUser, 'orders.view_all')) && (
                <button
                  onClick={() => {
                    setActiveTab('orders');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'orders'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-4 h-4" />
                    <span>Đơn hàng</span>
                  </div>
                  <span className="flex items-center gap-1.5">
                    {newOrderCount > 0 && (
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[11px] bg-rose-500 text-white animate-pulse"
                        title={`${newOrderCount} đơn hàng mới chưa xem`}
                      >
                        +{newOrderCount} mới
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      {ordersTotal}
                    </span>
                  </span>
                </button>
              )}

              {(hasPermission(currentUser, 'members.view_full') || hasPermission(currentUser, 'members.view_masked')) && (
                <button
                  onClick={() => {
                    setActiveTab('members');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'members'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>Khách thành viên</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-emerald-300 border border-slate-700">
                    {members.length}
                  </span>
                </button>
              )}

              {hasPermission(currentUser, 'categories.view') && (
                <button
                  onClick={() => {
                    setActiveTab('categories');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'categories'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FolderTree className="w-4 h-4" />
                    <span>Danh mục</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                    {categories.length}
                  </span>
                </button>
              )}

              {hasPermission(currentUser, 'content.manage') && (
                <button
                  onClick={() => {
                    setActiveTab('banners');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'banners'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    <span>Banner & Slider</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-amber-300 border border-slate-700">
                    {bannersList.length + brandSlidesList.length}
                  </span>
                </button>
              )}

              {(hasPermission(currentUser, 'profit.view') || hasPermission(currentUser, 'dashboard.view_company')) && (
                <button
                  onClick={() => {
                    setActiveTab('analytics');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'analytics'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4" />
                    <span>Báo cáo & Phân tích</span>
                  </div>
                </button>
              )}

              {(hasPermission(currentUser, 'system.sync') || hasPermission(currentUser, 'system.seed')) && (
                <button
                  onClick={() => {
                    setActiveTab('database');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'database'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4" />
                    <span>Cơ sở dữ liệu</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                </button>
              )}

              {/* CHỨC NĂNG DÀNH CHO SUPER ADMIN: QUẢN LÝ & TẠO TÀI KHOẢN ADMIN */}
              {hasPermission(currentUser, 'users.manage') && (
                <button
                  onClick={() => {
                    setActiveTab('users');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'users'
                      ? 'bg-leaf-600 text-white shadow-lg shadow-leaf-900/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-leaf-400" />
                    <span>Quản lý tài khoản</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-leaf-500/20 text-leaf-300 border border-leaf-500/30 font-mono">
                    Super
                  </span>
                </button>
              )}

              {/* CHỨC NĂNG DÀNH CHO SUPER ADMIN: NHẬT KÝ HOẠT ĐỘNG (AUDIT LOGS) */}
              {hasPermission(currentUser, 'audit.view') && (
                <button
                  onClick={() => {
                    setActiveTab('audit');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'audit'
                      ? 'bg-leaf-600 text-white shadow-lg shadow-leaf-900/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <History className="w-4 h-4 text-amber-400" />
                    <span>Nhật ký hoạt động</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                    Audit
                  </span>
                </button>
              )}

              {/* PHÂN HỆ ĐÁNH GIÁ SẢN PHẨM & SOCIAL PROOF */}
              {hasPermission(currentUser, 'reviews.view') && (
                <Link
                  href="/admin/reviews"
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                >
                  <div className="flex items-center gap-3">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                    <span>Đánh giá khách hàng</span>
                  </div>
                  {pendingReviewsCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono animate-pulse">
                      {pendingReviewsCount} chờ duyệt
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                      Reviews
                    </span>
                  )}
                </Link>
              )}

              {/* GIAI ĐOẠN 2: CTV & Đại lý, Duyệt chi trả — chỉ mở khi NEXT_PUBLIC_ENABLE_PARTNER_PROGRAM=true */}
              {FEATURES.PARTNER_PROGRAM ? (
                <>
                  <Link
                    href="/admin/partners"
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>Đối tác CTV & Đại lý</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                      Partner
                    </span>
                  </Link>
                  <Link
                    href="/admin/payouts"
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-4 h-4 text-amber-400" />
                      <span>Duyệt chi trả (Payouts)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                      Ví
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  <div
                    aria-disabled="true"
                    title="Chức năng thuộc giai đoạn 2 — chưa mở sử dụng"
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 opacity-45 cursor-not-allowed select-none"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4" />
                      <span>Đối tác CTV & Đại lý</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                      Giai đoạn 2
                    </span>
                  </div>

                  <div
                    aria-disabled="true"
                    title="Chức năng thuộc giai đoạn 2 — chưa mở sử dụng"
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 opacity-45 cursor-not-allowed select-none"
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-4 h-4" />
                      <span>Duyệt chi trả (Payouts)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                      Giai đoạn 2
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Quick Summary Card */}
            {(hasPermission(currentUser, 'dashboard.view_company') || hasPermission(currentUser, 'dashboard.view_store')) && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-b from-slate-800/60 to-slate-900/60 border border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="text-slate-300 text-[1.125em]">
                    {currentUser?.role === 'STORE_STAFF' ? 'Doanh thu cửa hàng' : 'Doanh thu tuần này'}
                  </span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl text-emerald-400 tracking-tight">
                  {formatVND(stats?.summary?.total_revenue || 0)}
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full w-[78%]"></div>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                  <span>{stats?.summary?.total_orders || 0} đơn đã tạo</span>
                  <span className="text-emerald-400 font-medium">94% thành công</span>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-400/30 flex items-center justify-center text-white text-sm shrink-0 shadow-md">
                  {currentUser?.fullName
                    ? currentUser.fullName.slice(0, 2).toUpperCase()
                    : currentUser?.username
                    ? currentUser.username.slice(0, 2).toUpperCase()
                    : 'TS'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-slate-200 truncate">
                      {currentUser?.fullName || currentUser?.username || 'Admin Quản Lý'}
                    </p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                      {currentUser?.role === 'SUPER_ADMIN' ? 'Super' : currentUser?.role === 'MARKETING' ? 'Marketing' : 'Cửa hàng'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {currentUser?.email || 'admin@thaisonfoods.vn'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={openPasswordModal}
                  aria-label="Đổi mật khẩu"
                  title="Đổi mật khẩu tài khoản"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                >
                  <Key className="w-4 h-4" />
                </button>
                <button
                  onClick={handleLogout}
                  title="Đăng xuất"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={openPasswordModal}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-slate-300 bg-slate-800/60 hover:bg-amber-500/10 hover:text-amber-300 border border-slate-700/70 transition-colors cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Đổi mật khẩu</span>
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto bg-forest-950 p-4 lg:p-6 space-y-6">
          {currentUser && !canAccessTab(activeTab) ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-slate-900/60 rounded-3xl border border-slate-800">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-400">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-2xl text-white mb-2">Bạn không có quyền truy cập mục này</h2>
              <p className="text-sm text-slate-400 max-w-md mb-6">
                Vai trò hiện tại của bạn (<span className="text-amber-400 text-[1.125em]">{currentUser.role}</span>) không được cấp quyền xem hoặc quản lý phân hệ này. Vui lòng liên hệ Quản trị viên cấp cao nếu cần hỗ trợ.
              </p>
              <button
                onClick={() => setActiveTab(getDefaultTab())}
                className="px-5 py-2.5 rounded-xl text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
              >
                Quay về trang được phân quyền ({getDefaultTab() === 'products' ? 'Sản phẩm' : getDefaultTab() === 'orders' ? 'Đơn hàng' : 'Tổng quan'})
              </button>
            </div>
          ) : (
            <>
              {/* ======================================================== */}
              {/* TAB 1: OVERVIEW DASHBOARD */}
              {/* ======================================================== */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Page header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h1 className="text-2xl text-white tracking-tight flex items-center gap-2.5">
                        <span>Tổng Quan Bán Hàng</span>
                        <span className="text-xs font-normal px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Thời gian thực
                        </span>
                      </h1>
                      <p className="text-xs text-slate-400 mt-1">
                        Dữ liệu được cập nhật trực tiếp từ PostgreSQL cơ sở dữ liệu WebTSF
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportOrdersCSV}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-sm transition-all"
                      >
                        <Download className="w-4 h-4 text-slate-400" />
                        <span>Xuất Báo Cáo CSV</span>
                      </button>
                      {hasPermission(currentUser, 'products.manage') && (
                        <button
                          onClick={handleOpenCreateProduct}
                          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Thêm Sản Phẩm</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 5 KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Total Revenue */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign className="w-16 h-16 text-emerald-400" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">
                          {currentUser?.role === 'STORE_STAFF' ? 'Doanh Thu Cửa Hàng' : 'Tổng Doanh Thu'}
                        </span>
                        <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                          <TrendingUp className="w-4 h-4" />
                        </span>
                      </div>
                  <div className="text-2xl text-white mt-2 tracking-tight">
                    {formatVND(stats?.summary?.total_revenue || 0)}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mt-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đã ghi nhận trong WebTSF</span>
                  </div>
                </div>

                {/* Total Orders */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800 relative overflow-hidden group hover:border-blue-500/40 transition-all">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <ShoppingCart className="w-16 h-16 text-blue-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Tổng Đơn Hàng</span>
                    <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                      <ShoppingCart className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl text-white mt-2 tracking-tight">
                    {stats?.summary?.total_orders || ordersTotal || 0}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2">
                    <span className="text-amber-400 text-[1.125em]">{stats?.summary?.pending_orders || 0} chờ duyệt</span>
                    <span>•</span>
                    <span className="text-emerald-400 text-[1.125em]">{stats?.summary?.completed_orders || 0} hoàn tất</span>
                  </div>
                </div>

                {/* Products Count */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800 relative overflow-hidden group hover:border-leaf-500/40 transition-all">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Package className="w-16 h-16 text-leaf-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Sản Phẩm Đang Bán</span>
                    <span className="p-2 rounded-xl bg-leaf-500/10 text-leaf-400">
                      <Package className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl text-white mt-2 tracking-tight">
                    {products.length}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2">
                    <span className="text-leaf-400 text-[1.125em]">{categories.length} danh mục</span>
                    <span>•</span>
                    <span className="text-emerald-400 text-[1.125em]">{products.filter((p) => p.is_active).length} kích hoạt</span>
                  </div>
                </div>

                {/* Combos Count */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800 relative overflow-hidden group hover:border-amber-500/40 transition-all">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Boxes className="w-16 h-16 text-amber-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Gói Combo Tiết Kiệm</span>
                    <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <Boxes className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl text-white mt-2 tracking-tight">
                    {combos.length}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2">
                    <span className="text-amber-400 text-[1.125em]">{combos.filter((c) => c.is_active).length} đang bán</span>
                    <span>•</span>
                    <span className="text-emerald-400 text-[1.125em]">100% Khớp Store</span>
                  </div>
                </div>

                {/* DB Health */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800 relative overflow-hidden group hover:border-teal-500/40 transition-all">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Database className="w-16 h-16 text-teal-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Cơ Sở Dữ Liệu</span>
                    <span className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
                      <Database className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl text-emerald-400 mt-2 tracking-tight flex items-center gap-2">
                    <span>Kết Nối Tốt</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2">
                    <span className="text-slate-300 font-mono">WebTSF @ localhost</span>
                  </div>
                </div>
              </div>

              {/* Chart & Top Products Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 7 Days Revenue Trend (Visual SVG Bar Chart) */}
                <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base text-white flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-400" />
                        <span>Biểu Đồ Doanh Thu 7 Ngày Gần Nhất</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Xu hướng đặt hàng thực tế trong tuần</p>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      7 ngày qua
                    </span>
                  </div>

                  {/* SVG interactive visual chart */}
                  <div className="pt-4 pb-2">
                    <div className="h-48 flex items-end justify-between gap-2 sm:gap-4 px-2">
                      {(stats?.revenueTrend || [
                        { date_label: '15/09', daily_revenue: 120000, order_count: 2 },
                        { date_label: '16/09', daily_revenue: 250000, order_count: 3 },
                        { date_label: '17/09', daily_revenue: 180000, order_count: 2 },
                        { date_label: '18/09', daily_revenue: 340000, order_count: 4 },
                        { date_label: '19/09', daily_revenue: 210000, order_count: 3 },
                        { date_label: '20/09', daily_revenue: 430000, order_count: 5 },
                        { date_label: '21/09', daily_revenue: 320000, order_count: 4 },
                      ]).map((item, idx) => {
                        const maxRev = Math.max(
                          ...(stats?.revenueTrend?.map((r) => Number(r.daily_revenue)) || [500000]),
                          100000
                        );
                        const heightPct = Math.max(
                          Math.round((Number(item.daily_revenue || 0) / maxRev) * 100),
                          12
                        );

                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                            {/* Tooltip on hover */}
                            <div className="absolute -top-12 bg-slate-950 text-white text-[10px] py-1 px-2 rounded-md shadow-xl border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                              <p className="text-emerald-400 text-[1.125em]">{formatVND(item.daily_revenue)}</p>
                              <p className="text-slate-400">{item.order_count} đơn hàng</p>
                            </div>

                            {/* Bar element */}
                            <div className="w-full max-w-[48px] bg-slate-800/80 rounded-t-xl overflow-hidden flex flex-col justify-end p-1 h-36">
                              <div
                                style={{ height: `${heightPct}%` }}
                                className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-teal-400 group-hover:from-emerald-500 group-hover:to-teal-300 transition-all duration-300"
                              ></div>
                            </div>
                            <span className="text-[11px] font-medium text-slate-400 group-hover:text-slate-200">
                              {item.date_label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Top Selling Products */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Sản Phẩm Bán Chạy</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Top sản phẩm được ưa chuộng</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {(stats?.topProducts && stats.topProducts.length > 0
                      ? stats.topProducts
                      : products.slice(0, 5)
                    ).map((p: any, idx: number) => (
                      <div
                        key={p.id || idx}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 relative shrink-0">
                          {p.thumbnail ? (
                            <Image
                              src={p.thumbnail}
                              alt={p.name}
                              fill
                              className="object-contain p-1"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate">{p.name}</p>
                          <p className="text-[12px] text-emerald-400">{formatVND(p.price)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="px-2 py-0.5 rounded-md text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            #{idx + 1}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Orders Table */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base text-white flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-emerald-400" />
                      <span>Đơn Hàng Mới Nhất</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Danh sách các đơn đặt hàng mới cập nhật</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <span>Xem tất cả đơn hàng ({ordersTotal})</span>
                    <span>→</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Mã Đơn</th>
                        <th className="py-3 px-4">Khách Hàng</th>
                        <th className="py-3 px-4">Số Điện Thoại</th>
                        <th className="py-3 px-4">Tổng Tiền</th>
                        <th className="py-3 px-4">Trạng Thái</th>
                        <th className="py-3 px-4">Thời Gian</th>
                        <th className="py-3 px-4 text-right">Hành Động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {orders.slice(0, 6).map((order) => {
                        const st = statusMap[order.status] || statusMap['PENDING'];
                        return (
                          <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-mono text-emerald-400 text-[1.125em]">
                              #{order.order_code}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-100">{order.full_name}</td>
                            <td className="py-3 px-4 text-slate-400 font-mono">{order.phone}</td>
                            <td className="py-3 px-4 text-white text-[1.125em]">{formatVND(order.total)}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border ${st.bg}`}
                              >
                                <st.icon className="w-3 h-3" />
                                <span>{st.label}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-[11px]">
                              {new Date(order.created_at).toLocaleDateString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit',
                              })}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleOpenOrderDetail(order)}
                                className="px-2.5 py-1 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                              >
                                Chi tiết
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {orders.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            Chưa có đơn hàng nào trong cơ sở dữ liệu. Hãy bấm &quot;Nạp Đơn Mẫu&quot; ở trên góc phải để thử nghiệm!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: PRODUCT MANAGEMENT */}
          {/* ======================================================== */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl text-white tracking-tight flex items-center gap-2">
                    <span>Quản Lý Sản Phẩm</span>
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                      {products.length} món
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Thêm mới, sửa thông tin giá, biến thể và trạng thái hiển thị trên website
                  </p>
                </div>

                {hasPermission(currentUser, 'products.manage') && (
                  <button
                    onClick={handleOpenCreateProduct}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm Sản Phẩm Mới</span>
                  </button>
                )}
              </div>

              {/* Filters toolbar */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên sản phẩm hoặc mã SKU..."
                    value={prodSearch}
                    onChange={(e) => setProdSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* Category filter */}
                <select
                  value={prodCatFilter}
                  onChange={(e) => setProdCatFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">Tất cả danh mục ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Status filter */}
                <select
                  value={prodStatusFilter}
                  onChange={(e) => setProdStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang kích hoạt</option>
                  <option value="INACTIVE">Đang ẩn</option>
                  <option value="FEATURED">Nổi bật ⭐</option>
                  <option value="BEST_SELLER">Bán chạy 🔥</option>
                </select>
              </div>

              {/* Products Table */}
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Ảnh & Sản Phẩm</th>
                        <th className="py-3 px-4">SKU</th>
                        <th className="py-3 px-4">Danh Mục</th>
                        <th className="py-3 px-4">Giá Bán</th>
                        <th className="py-3 px-4">Huy Hiệu</th>
                        <th className="py-3 px-4">Trạng Thái</th>
                        <th className="py-3 px-4 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-800 relative shrink-0 border border-slate-700">
                                {p.thumbnail ? (
                                  <Image
                                    src={p.thumbnail}
                                    alt={p.name}
                                    fill
                                    className="object-contain p-1"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                                    <Package className="w-5 h-5" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-slate-100 text-base">{p.name}</p>
                                <p className="text-[11px] text-slate-400">Đơn vị: {p.unit}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400">{p.sku || '—'}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-800 text-slate-300 border border-slate-700">
                              {p.category_name || 'Chưa phân loại'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-emerald-400 text-base">
                              {formatVND(p.price)}
                            </div>
                            {hasPermission(currentUser, 'cost_price.view') && (
                              <div className="text-[10px] text-amber-400/90 font-mono mt-0.5">
                                Vốn: {p.cost_price ? formatVND(p.cost_price) : '0 ₫'}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {p.is_featured && (
                                <span className="px-1.5 py-0.5 rounded text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  ⭐ Nổi bật
                                </span>
                              )}
                              {p.is_best_seller && (
                                <span className="px-1.5 py-0.5 rounded text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  🔥 Bán chạy
                                </span>
                              )}
                              {p.is_new && (
                                <span className="px-1.5 py-0.5 rounded text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  🆕 Mới
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              disabled={!hasPermission(currentUser, 'products.manage')}
                              onClick={() => handleToggleProductActive(p)}
                              className={`px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                                !hasPermission(currentUser, 'products.manage') ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                              } ${
                                p.is_active
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'
                              }`}
                            >
                              {p.is_active ? '● Đang Bán' : '○ Tạm Ẩn'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {(hasPermission(currentUser, 'products.manage') || hasPermission(currentUser, 'products.manage_price')) && (
                                <button
                                  onClick={() => handleOpenEditProduct(p)}
                                  title="Chỉnh sửa sản phẩm"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {hasPermission(currentUser, 'products.manage') && (
                                <button
                                  onClick={() => handleDeleteProduct(p.id, p.name)}
                                  title="Xóa sản phẩm"
                                  className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredProducts.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            Không tìm thấy sản phẩm nào khớp với điều kiện lọc.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2b: COMBO MANAGEMENT */}
          {/* ======================================================== */}
          {activeTab === 'combos' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl text-white tracking-tight flex items-center gap-2.5">
                    <span>Quản Lý Gói Combo Tiết Kiệm</span>
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                      {filteredCombos.length} / {combos.length} gói
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Toàn bộ gói ưu đãi được đồng bộ trực tiếp từ website cửa hàng vào CSDL PostgreSQL WebTSF
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {hasPermission(currentUser, 'system.sync') && (
                    <button
                      onClick={handleSyncStore}
                      disabled={syncLoading}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 transition-all cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 text-emerald-400 ${syncLoading ? 'animate-spin' : ''}`} />
                      <span>{syncLoading ? 'Đang đồng bộ...' : 'Đồng Bộ Store -> DB'}</span>
                    </button>
                  )}

                  {hasPermission(currentUser, 'combos.manage') && (
                    <button
                      onClick={handleOpenCreateCombo}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm bg-amber-600 hover:bg-amber-700 text-ink-950 shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm Combo Mới</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filters & Search */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm tên combo, chi tiết chai..."
                    value={comboSearch}
                    onChange={(e) => setComboSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={comboFilter}
                    onChange={(e) => setComboFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="ACTIVE">Đang mở bán ({combos.filter((c) => c.is_active).length})</option>
                    <option value="INACTIVE">Tạm dừng ({combos.filter((c) => !c.is_active).length})</option>
                    <option value="FEATURED">Nổi bật ⭐ ({combos.filter((c) => c.is_featured).length})</option>
                    <option value="BEST_SELLER">Bán chạy 🔥 ({combos.filter((c) => c.is_best_seller).length})</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Gói Combo & Ảnh</th>
                        <th className="py-3 px-4">Quy Cách & Chi Tiết</th>
                        <th className="py-3 px-4 text-right">Giá Gốc</th>
                        <th className="py-3 px-4 text-right">Giá Bán</th>
                        <th className="py-3 px-4 text-center">Tiết Kiệm</th>
                        <th className="py-3 px-4 text-center">Trạng Thái</th>
                        <th className="py-3 px-4 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredCombos.map((c) => {
                        const savings = (c.original_price || 0) - (c.sale_price || 0);
                        return (
                          <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                            {/* Image & Name */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/60 overflow-hidden relative shrink-0">
                                  {c.image ? (
                                    <Image
                                      src={c.image}
                                      alt={c.name}
                                      fill
                                      className="object-cover"
                                      sizes="48px"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                                      <Boxes className="w-5 h-5" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-white text-sm hover:text-amber-400 transition-colors flex items-center gap-1.5 flex-wrap">
                                    <span>{c.name}</span>
                                    {c.is_featured && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        Nổi bật
                                      </span>
                                    )}
                                    {c.is_best_seller && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                        Bán chạy
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                    slug: {c.slug}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Quy cách */}
                            <td className="py-3 px-4 max-w-xs">
                              <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[12px] mb-1">
                                {c.total_items} chai
                              </span>
                              <p className="text-[11px] text-slate-400 line-clamp-2" title={c.description || ''}>
                                {c.description || 'Không có mô tả'}
                              </p>
                            </td>

                            {/* Original Price */}
                            <td className="py-3 px-4 text-right font-mono text-slate-500 line-through">
                              {formatVND(c.original_price)}
                            </td>

                            {/* Sale Price */}
                            <td className="py-3 px-4 text-right">
                              <div className="font-mono text-emerald-400 text-base">
                                {formatVND(c.sale_price)}
                              </div>
                              {hasPermission(currentUser, 'cost_price.view') && (
                                <div className="text-[10px] text-amber-400/90 font-mono mt-0.5">
                                  Vốn: {c.cost_price ? formatVND(c.cost_price) : '0 ₫'}
                                </div>
                              )}
                            </td>

                            {/* Savings */}
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <span>-{c.discount}%</span>
                                {savings > 0 && <span className="font-mono">({formatVND(savings)})</span>}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleToggleComboActive(c)}
                                className={`px-2.5 py-1 rounded-full text-[11px] border cursor-pointer transition-all ${
                                  c.is_active
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                }`}
                              >
                                {c.is_active ? '● Đang mở bán' : '○ Tạm ẩn'}
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href="/san-pham"
                                  target="_blank"
                                  title="Xem trên trang cửa hàng"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                                {hasPermission(currentUser, 'combos.manage') && (
                                  <button
                                    onClick={() => handleOpenEditCombo(c)}
                                    title="Chỉnh sửa combo"
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {hasPermission(currentUser, 'combos.manage') && (
                                  <button
                                    onClick={() => handleDeleteCombo(c.id, c.name)}
                                    title="Xóa combo"
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredCombos.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            Không tìm thấy gói combo nào khớp với điều kiện lọc.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: ORDER MANAGEMENT */}
          {/* ======================================================== */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl text-white tracking-tight flex items-center gap-2">
                    <span>Quản Lý Đơn Hàng</span>
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                      {orderStatusCounts.ALL} đơn
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Theo dõi tiến độ giao nhận, xử lý trạng thái và in hóa đơn đơn hàng
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportOrdersCSV}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Xuất File Excel/CSV</span>
                  </button>
                </div>
              </div>

              {/* Status Tab Filter Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800">
                {[
                  { key: 'ALL', label: 'Tất cả đơn', count: orderStatusCounts.ALL || 0 },
                  { key: 'PENDING', label: 'Chờ xử lý', count: orderStatusCounts.PENDING || 0 },
                  { key: 'CONFIRMED', label: 'Đã xác nhận', count: orderStatusCounts.CONFIRMED || 0 },
                  { key: 'PROCESSING', label: 'Đang chuẩn bị', count: orderStatusCounts.PROCESSING || 0 },
                  { key: 'SHIPPING', label: 'Đang giao', count: orderStatusCounts.SHIPPING || 0 },
                  { key: 'COMPLETED', label: 'Hoàn thành', count: orderStatusCounts.COMPLETED || 0 },
                  { key: 'CANCELLED', label: 'Đã hủy', count: orderStatusCounts.CANCELLED || 0 },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setOrderStatusFilter(t.key)}
                    className={`px-3 py-1.5 rounded-xl text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
                      orderStatusFilter === t.key
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span>{t.label}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/60 font-mono">
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search bar */}
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo Mã đơn (#TSF...), Tên khách hàng, Số điện thoại..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Orders Table */}
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Mã Đơn</th>
                        <th className="py-3 px-4">Khách Hàng</th>
                        <th className="py-3 px-4">Khu Vực Giao</th>
                        <th className="py-3 px-4">Số Tiền</th>
                        <th className="py-3 px-4">Hình Thức</th>
                        <th className="py-3 px-4">Trạng Thái</th>
                        <th className="py-3 px-4">Thời Gian Đặt</th>
                        <th className="py-3 px-4 text-right">Hành Động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {orderRows.map((order) => {
                        const st = statusMap[order.status] || statusMap['PENDING'];
                        return (
                          <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-mono text-emerald-400 text-[1.125em]">
                                #{order.order_code}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20" title="Chi nhánh tiếp nhận">
                                  {order.store_code || 'NH'}
                                </span>
                                {order.status === 'PENDING' ? (
                                  (() => {
                                    const hoursAgo = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
                                    if (hoursAgo >= 20) {
                                      return (
                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1" title={`Đã tạo ${Math.floor(hoursAgo)} giờ trước, sắp quá hạn giữ chỗ 24h!`}>
                                          <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                                          <span>Sắp hết hạn 24h</span>
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                                        Đang giữ chỗ
                                      </span>
                                    );
                                  })()
                                ) : order.inventory_deducted ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                                    Đã trừ kho
                                  </span>
                                ) : order.status === 'CANCELLED' ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                                    Đã nhả
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-slate-100 text-[1.125em]">{order.full_name}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{order.phone}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-slate-200 text-xs truncate max-w-[180px]">{order.address}</p>
                              <p className="text-[11px] text-slate-400">{order.province}</p>
                            </td>
                            <td className="py-3 px-4 text-white text-base">
                              {formatVND(order.total)}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                                {order.payment_method}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {/* Quick status dropdown */}
                              <select
                                disabled={!(hasPermission(currentUser, 'orders.update_status_own_store') || hasPermission(currentUser, 'orders.update_status_all'))}
                                value={order.status}
                                onChange={(e) =>
                                  handleRequestStatusChange(order, e.target.value as Order['status'])
                                }
                                className={`text-[12px] rounded-lg px-2.5 py-1 border focus:outline-none ${
                                  !(hasPermission(currentUser, 'orders.update_status_own_store') || hasPermission(currentUser, 'orders.update_status_all'))
                                    ? 'opacity-60 cursor-not-allowed'
                                    : 'cursor-pointer'
                                } ${st.bg}`}
                              >
                                {/* Chỉ hiện trạng thái hiện tại + các bước hợp lệ tiếp theo (xem lib/order-status.ts) */}
                                {([
                                  ['PENDING', 'text-amber-400', 'Chờ xử lý'],
                                  ['CONFIRMED', 'text-blue-400', 'Đã xác nhận'],
                                  ['PROCESSING', 'text-leaf-400', 'Đang chuẩn bị'],
                                  ['SHIPPING', 'text-cyan-400', 'Đang giao hàng'],
                                  ['COMPLETED', 'text-emerald-400', 'Hoàn thành'],
                                  ['CANCELLED', 'text-rose-400', 'Đã hủy'],
                                ] as const)
                                  .filter(([value]) => value === order.status || canTransitionOrderStatus(order.status, value))
                                  .map(([value, color, label]) => (
                                    <option key={value} value={value} className={`bg-slate-900 ${color}`}>
                                      {label}
                                    </option>
                                  ))}
                              </select>
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-[11px]">
                              {new Date(order.created_at).toLocaleDateString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit',
                              })}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenOrderDetail(order)}
                                  className="px-2.5 py-1 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                                >
                                  Chi tiết
                                </button>
                                {hasPermission(currentUser, 'orders.update_status_all') && canDeleteOrder(order.status) && (
                                  <button
                                    onClick={() => handleDeleteOrder(order.id, order.order_code)}
                                    title="Xóa đơn hàng"
                                    className="p-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {orderRows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            {orderListLoading
                              ? 'Đang tải danh sách đơn hàng...'
                              : 'Không có đơn hàng nào khớp với tìm kiếm hoặc bộ lọc trạng thái.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Phân trang */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-800 bg-slate-950/50 text-xs text-slate-400">
                  <span>
                    {orderPageInfo.total === 0
                      ? 'Không có đơn hàng'
                      : `Hiển thị ${(orderPageInfo.page - 1) * orderPageInfo.limit + 1}–${Math.min(
                          orderPageInfo.page * orderPageInfo.limit,
                          orderPageInfo.total
                        )} / ${orderPageInfo.total} đơn`}
                    {orderListLoading && <span className="ml-2 text-emerald-400">• đang tải…</span>}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={orderPageInfo.page <= 1 || orderListLoading}
                      onClick={() => setOrderPage(1)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="Trang đầu"
                    >
                      «
                    </button>
                    <button
                      disabled={orderPageInfo.page <= 1 || orderListLoading}
                      onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      ‹ Trước
                    </button>
                    <span className="px-3 font-mono text-slate-300">
                      {orderPageInfo.page} / {orderPageInfo.totalPages}
                    </span>
                    <button
                      disabled={orderPageInfo.page >= orderPageInfo.totalPages || orderListLoading}
                      onClick={() => setOrderPage((p) => Math.min(orderPageInfo.totalPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Sau ›
                    </button>
                    <button
                      disabled={orderPageInfo.page >= orderPageInfo.totalPages || orderListLoading}
                      onClick={() => setOrderPage(orderPageInfo.totalPages)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="Trang cuối"
                    >
                      »
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: CATEGORY MANAGEMENT */}
          {/* ======================================================== */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl text-white tracking-tight flex items-center gap-2">
                    <span>Quản Lý Danh Mục</span>
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                      {categories.length} danh mục
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Cấu trúc phân loại sản phẩm trong cơ sở dữ liệu WebTSF
                  </p>
                </div>

                {hasPermission(currentUser, 'categories.manage') && (
                  <button
                    onClick={handleOpenCreateCategory}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm Danh Mục Mới</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                          <FolderTree className="w-5 h-5" />
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                          {cat.product_count || 0} sản phẩm
                        </span>
                      </div>
                      <h3 className="text-lg text-white mt-3">{cat.name}</h3>
                      <p className="text-xs font-mono text-slate-400 mt-1">slug: /{cat.slug}</p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
                      {hasPermission(currentUser, 'categories.manage') && (
                        <>
                          <button
                            onClick={() => handleOpenEditCategory(cat)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5 text-slate-400" />
                            <span>Sửa</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: BANNER & BRAND SLIDER MANAGEMENT */}
          {/* ======================================================== */}
          {activeTab === 'banners' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl text-white tracking-tight flex items-center gap-2">
                    <span>Quản Lý Banner & Thương Hiệu</span>
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                      {bannersList.length} banner • {brandSlidesList.length} slide
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Cập nhật hình ảnh Hero banner trang chủ, Scroll showcase banner, và các slide Giới thiệu thương hiệu mà không cần sửa code
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchBannersAndSlides}
                    disabled={bannersLoading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${bannersLoading ? 'animate-spin' : ''}`} />
                    <span>Làm mới</span>
                  </button>
                  <button
                    onClick={handleOpenCreateBanner}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-amber-600 hover:bg-amber-700 text-ink-950 shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm Banner Mới</span>
                  </button>
                </div>
              </div>

              {/* SECTION 1: HERO & SCROLL BANNERS */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h2 className="text-base text-white flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                      <span>Banner Trang Chủ & Banner Cuộn (Hero & Scroll Showcase)</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Hiển thị tại đầu trang chủ (Hero) và phân đoạn hiệu ứng cuộn (Scroll Showcase)
                    </p>
                  </div>
                </div>

                {bannersLoading ? (
                  <div className="p-8 text-center text-slate-400 text-xs">Đang tải danh sách banner...</div>
                ) : bannersList.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                    Chưa có banner nào trong cơ sở dữ liệu. Bấm &quot;Thêm Banner Mới&quot; để tạo.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bannersList.map((ban) => (
                      <div
                        key={ban.id}
                        className="rounded-xl bg-slate-950/80 border border-slate-800 overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all"
                      >
                        <div className="relative aspect-[16/9] w-full bg-slate-900 overflow-hidden">
                          {ban.image ? (
                            <Image
                              src={ban.image}
                              alt={ban.alt || 'Banner'}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                              Chưa có ảnh
                            </div>
                          )}
                          <div className="absolute top-2 left-2 flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider bg-slate-900/90 text-amber-300 border border-slate-700">
                              {ban.placement === 'hero' ? 'Hero Banner' : ban.placement === 'scroll' ? 'Scroll Showcase' : ban.placement}
                            </span>
                          </div>
                          <div className="absolute top-2 right-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] ${
                                ban.is_active
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              }`}
                            >
                              {ban.is_active ? 'Đang bật' : 'Tạm ẩn'}
                            </span>
                          </div>
                        </div>

                        <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                          <div>
                            {ban.tag && (
                              <span className="text-[11px] text-emerald-400 uppercase tracking-wider">
                                {ban.tag}
                              </span>
                            )}
                            <h3 className="text-sm text-white line-clamp-1 mt-0.5">
                              {ban.title || 'Không có tiêu đề'}
                            </h3>
                            {ban.subtitle && (
                              <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                                {ban.subtitle}
                              </p>
                            )}
                            {ban.link && (
                              <p className="text-[10px] font-mono text-slate-500 truncate mt-1">
                                Link: {ban.link}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                            <button
                              onClick={() => handleToggleBannerActive(ban)}
                              className={`text-[11px] px-2 py-1 rounded transition-colors cursor-pointer ${
                                ban.is_active
                                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                  : 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60'
                              }`}
                            >
                              {ban.is_active ? 'Ẩn banner' : 'Bật hiển thị'}
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditBanner(ban)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                                title="Chỉnh sửa banner"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteBanner(ban.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-colors cursor-pointer"
                                title="Xóa banner"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 2: BRAND SHOWCASE SLIDES */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h2 className="text-base text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Slide Giới Thiệu Thương Hiệu (Brand Showcase — &quot;Về Chúng Tôi&quot;)</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      4 khối nội dung và hình ảnh thể hiện câu chuyện thương hiệu Thái Sơn Foods
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {brandSlidesList.map((slide) => (
                    <div
                      key={slide.id}
                      className="rounded-xl bg-slate-950/80 border border-slate-800 overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all"
                    >
                      <div className="relative aspect-[3/4] w-full bg-slate-900 overflow-hidden">
                        {slide.image ? (
                          <Image
                            src={slide.image}
                            alt={slide.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                            Chưa có ảnh
                          </div>
                        )}
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] bg-slate-900/90 text-amber-300 border border-slate-700">
                          {slide.tag}
                        </span>
                      </div>

                      <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm text-white whitespace-pre-line line-clamp-2">
                            {slide.title}
                          </h3>
                          <p className="text-[11px] text-slate-400 line-clamp-3 mt-1.5">
                            {slide.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-mono">
                            Nút: {slide.cta_text}
                          </span>
                          <button
                            onClick={() => handleOpenEditSlide(slide)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors cursor-pointer"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Sửa</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: ANALYTICS & REPORTS */}
          {/* ======================================================== */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl text-white tracking-tight">
                    Báo Cáo & Thống Kê Chi Tiết
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Báo cáo số liệu kinh doanh, doanh thu và hành vi mua hàng
                  </p>
                </div>
                <button
                  onClick={handleExportOrdersCSV}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Xuất Toàn Bộ Báo Cáo CSV</span>
                </button>
              </div>

              {/* Status Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats?.statusBreakdown?.map((sb: any) => {
                  const st = statusMap[sb.status] || statusMap['PENDING'];
                  return (
                    <div
                      key={sb.status}
                      className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border ${st.bg}`}>
                          <st.icon className="w-3.5 h-3.5" />
                          <span>{st.label}</span>
                        </span>
                        <span className="text-xs font-mono text-slate-400">{sb.count} đơn</span>
                      </div>
                      <div className="text-2xl text-white mt-2">
                        {formatVND(sb.total_amount)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Revenue & Growth Insights */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-emerald-500/20 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg text-white">Chỉ Số Tăng Trưởng Thái Sơn Foods</h3>
                    <p className="text-xs text-slate-400">Tính toán dựa trên các đơn hàng hoàn tất thực tế</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <p className="text-xs text-slate-400">Đơn trung bình (AOV)</p>
                    <p className="text-lg text-white mt-1">
                      {ordersTotal > 0
                        ? formatVND(Math.round(Number(stats?.summary?.total_revenue || 0) / ordersTotal))
                        : '0 ₫'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <p className="text-xs text-slate-400">Tỷ lệ hoàn thành</p>
                    <p className="text-lg text-emerald-400 mt-1">
                      {ordersTotal > 0
                        ? Math.round(
                            (Number(stats?.summary?.completed_orders || 0) / ordersTotal) * 100
                          )
                        : 0}
                      %
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <p className="text-xs text-slate-400">Số lượng SKU bán</p>
                    <p className="text-lg text-white mt-1">{products.length} SKU</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <p className="text-xs text-slate-400">Thanh toán COD</p>
                    <p className="text-lg text-blue-400 mt-1">
                      {orderPaymentCounts.cod || 0} đơn
                    </p>
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* BÁO CÁO LỢI NHUẬN GỘP & GIÁ VỐN (CHỈ DÀNH CHO SUPER_ADMIN) */}
              {/* ======================================================== */}
              {hasPermission(currentUser, 'profit.view') && (
                <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/20 via-slate-900 to-leaf-950/20 border border-amber-500/30 space-y-6">
                  {/* Header & Controls */}
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg text-white">Báo Cáo Lợi Nhuận Gộp & Phân Tích Giá Vốn</h3>
                          <span className="px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            Super Admin
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Tự động tính từ snapshot giá vốn tại thời điểm đặt hàng. Đơn cũ chưa có vốn được ghi nhận minh bạch riêng.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Group By Selector */}
                      <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                        {[
                          { id: 'day', label: 'Theo Ngày' },
                          { id: 'month', label: 'Theo Tháng' },
                          { id: 'product', label: 'Theo Sản Phẩm' },
                          { id: 'store', label: 'Theo Cửa Hàng' },
                        ].map((gb) => (
                          <button
                            key={gb.id}
                            type="button"
                            onClick={() => setProfitGroupBy(gb.id as any)}
                            className={`px-3 py-1 text-sm rounded-lg transition-colors cursor-pointer ${
                              profitGroupBy === gb.id
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {gb.label}
                          </button>
                        ))}
                      </div>

                      {/* Store Filter */}
                      <select
                        value={profitStoreFilter}
                        onChange={(e) => setProfitStoreFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="ALL">Toàn công ty</option>
                        {storeList.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.code} - {s.name}
                          </option>
                        ))}
                      </select>

                      {/* Refresh */}
                      <button
                        type="button"
                        onClick={fetchProfitReport}
                        disabled={profitLoading}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Tải lại báo cáo"
                      >
                        <RefreshCw className={`w-4 h-4 text-amber-400 ${profitLoading ? 'animate-spin' : ''}`} />
                      </button>

                      {/* Export CSV */}
                      <button
                        type="button"
                        onClick={handleExportProfitCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm bg-amber-600 hover:bg-amber-700 text-ink-950 shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Xuất CSV Lợi Nhuận</span>
                      </button>
                    </div>
                  </div>

                  {/* Profit Overview Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                      <p className="text-[11px] font-medium text-slate-400">Doanh Thu Ghi Nhận</p>
                      <p className="text-xl text-white mt-1">
                        {formatVND(profitData?.summary?.totalRevenue || 0)}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">{profitData?.summary?.totalOrders || 0} đơn hàng thành công</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-900/30">
                      <p className="text-[11px] font-medium text-amber-400/90">Tổng Giá Vốn (COGS)</p>
                      <p className="text-xl text-amber-300 mt-1">
                        {formatVND(profitData?.summary?.totalCost || 0)}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">{profitData?.summary?.itemsWithCost || 0} mục có giá vốn</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-900/30">
                      <p className="text-[11px] font-medium text-emerald-400">Lợi Nhuận Gộp (Gross Profit)</p>
                      <p className="text-xl text-emerald-400 mt-1">
                        {formatVND(profitData?.summary?.grossProfit || 0)}
                      </p>
                      <p className="text-[10px] text-emerald-400/70 mt-1">Doanh thu - Giá vốn</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-900/30">
                      <p className="text-[11px] font-medium text-cyan-400">Tỷ Suất Lợi Nhuận Gộp</p>
                      <p className="text-xl text-cyan-300 mt-1">
                        {profitData?.summary?.marginPercent || 0}%
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">Trên danh mục có giá vốn</p>
                    </div>
                  </div>

                  {/* Alert banner if historical items lack cost data */}
                  {profitData?.summary?.hasMissingCostData && (
                    <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <div className="text-xs text-amber-200">
                        <span className="text-amber-300 text-[1.125em]">Lưu ý dữ liệu lịch sử: </span>
                        <span>{profitData?.summary?.note} </span>
                        <span>Doanh thu các mục này: <strong className="font-mono text-white text-[1.125em]">{formatVND(profitData?.summary?.revenueWithoutCost || 0)}</strong>.</span>
                      </div>
                    </div>
                  )}

                  {/* Breakdown Table */}
                  <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                    <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
                      <span className="text-sm text-slate-200">
                        Chi Tiết Lợi Nhuận {
                          profitGroupBy === 'day' ? 'Theo Ngày' :
                          profitGroupBy === 'month' ? 'Theo Tháng' :
                          profitGroupBy === 'product' ? 'Theo Sản Phẩm' : 'Theo Cửa Hàng'
                        }
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {profitData?.breakdown?.length || 0} bản ghi
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-4">
                              {profitGroupBy === 'product' ? 'Sản Phẩm' : profitGroupBy === 'store' ? 'Chi Nhánh' : 'Thời Gian'}
                            </th>
                            <th className="py-2.5 px-4 text-center">
                              {profitGroupBy === 'product' ? 'Số Lượng Bán' : 'Số Đơn'}
                            </th>
                            <th className="py-2.5 px-4 text-right">Doanh Thu</th>
                            <th className="py-2.5 px-4 text-right">Giá Vốn</th>
                            <th className="py-2.5 px-4 text-right">Lợi Nhuận Gộp</th>
                            <th className="py-2.5 px-4 text-center">Tỷ Suất (%)</th>
                            <th className="py-2.5 px-4 text-center">Dữ Liệu Giá Vốn</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {profitLoading ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-500">
                                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-400 mb-2" />
                                <span>Đang tính toán báo cáo lợi nhuận...</span>
                              </td>
                            </tr>
                          ) : !profitData?.breakdown || profitData.breakdown.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-500">
                                Không có dữ liệu đơn hàng trong phạm vi được chọn.
                              </td>
                            </tr>
                          ) : (
                            profitData.breakdown.map((row: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                                <td className="py-3 px-4 text-white text-[1.125em]">
                                  {row.label || row.name || row.store_name || row.period}
                                  {row.store_code && profitGroupBy === 'store' && (
                                    <span className="ml-2 font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                      {row.store_code}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center font-mono text-slate-300">
                                  {row.orders_count !== undefined ? row.orders_count : row.quantity_sold}
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-white text-[1.125em]">
                                  {formatVND(row.revenue)}
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-amber-300">
                                  {formatVND(row.cost)}
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-emerald-400 text-[1.125em]">
                                  {formatVND(row.profit)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                                    row.margin >= 30 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    row.margin > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                    'bg-slate-800 text-slate-400'
                                  }`}>
                                    {row.margin}%
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {row.missing_cost_items > 0 ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950/60 text-amber-400 border border-amber-800/40" title={`${row.missing_cost_items} mục chưa có vốn`}>
                                      Chưa đủ ({row.missing_cost_items})
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                                      ✓ Đầy đủ
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: DATABASE & SYSTEM */}
          {/* ======================================================== */}
          {activeTab === 'database' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl text-white tracking-tight flex items-center gap-2.5">
                    <span>Quản Lý CSDL PostgreSQL WebTSF</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Trạng thái kết nối pgAdmin 4 / PostgreSQL cục bộ và thông số các bảng
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSeedDemoOrders}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm bg-leaf-600 hover:bg-leaf-700 text-ink-950 shadow-lg shadow-leaf-900/30 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Nạp Thêm Đơn Hàng Mẫu</span>
                  </button>
                  <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                    <span>Kiểm Tra Lại Kết Nối</span>
                  </button>
                </div>
              </div>

              {/* Connection Status Card */}
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg text-white">PostgreSQL Local Server</h3>
                      <p className="text-sm text-emerald-400 flex items-center gap-1.5 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Trạng thái: Hoạt động bình thường (ONLINE)</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Port: 5432
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <p className="text-xs text-slate-400">Database Name</p>
                    <p className="text-base font-mono text-white mt-1">WebTSF</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <p className="text-xs text-slate-400">Host / IP</p>
                    <p className="text-base font-mono text-white mt-1">127.0.0.1:5432</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <p className="text-xs text-slate-400">User / Schema</p>
                    <p className="text-base font-mono text-white mt-1">postgres / public</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <p className="text-xs text-slate-400">Connection Pool</p>
                    <p className="text-base font-mono text-emerald-400 mt-1">Active (pg-pool 10)</p>
                  </div>
                </div>
              </div>

              {/* Store to DB Sync Control Center */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-amber-950/40 border border-emerald-500/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
                      <RefreshCw className={`w-6 h-6 ${syncLoading ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <h3 className="text-lg text-white">Đồng Bộ Dữ Liệu Store Website Vào CSDL WebTSF</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Lưu trữ toàn bộ 12 sản phẩm chuẩn (tên, giá mới, dung tích chai 330ml/568ml, đạt chuẩn HACCP, phân loại, biến thể) và 12 gói combo ưu đãi lên PostgreSQL
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleSyncStore}
                    disabled={syncLoading}
                    className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/40 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
                    <span>{syncLoading ? 'Đang thực thi đồng bộ...' : 'Đồng Bộ Toàn Bộ Dữ Liệu Ngay'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-slate-400">Sản phẩm trên Store</p>
                      <p className="text-base text-white mt-0.5">{products.length} sản phẩm</p>
                    </div>
                    <span className="text-[12px] text-emerald-400">100% Khớp CSDL</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-slate-400">Gói Combo trên Store</p>
                      <p className="text-base text-amber-400 mt-0.5">{combos.length} gói combo</p>
                    </div>
                    <span className="text-[12px] text-emerald-400">100% Khớp CSDL</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-slate-400">Trạng thái CSDL</p>
                      <p className="text-base text-emerald-400 mt-0.5">Sẵn sàng phục vụ</p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  </div>
                </div>
              </div>

              {/* Table Metrics */}
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 bg-slate-950/40">
                  <h3 className="text-base text-white">Thống Kê Các Bảng Trong Cơ Sở Dữ Liệu WebTSF</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Tên Bảng (Table Name)</th>
                        <th className="py-3 px-4">Mục Đích Dữ Liệu</th>
                        <th className="py-3 px-4">Số Lượng Bản Ghi</th>
                        <th className="py-3 px-4">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      <tr>
                        <td className="py-3 px-4 font-mono text-emerald-400 text-[1.125em]">products</td>
                        <td className="py-3 px-4">Sản phẩm đồ uống, giá bán, ảnh, thuộc tính</td>
                        <td className="py-3 px-4 font-mono text-[1.125em]">{products.length} dòng</td>
                        <td className="py-3 px-4 text-emerald-400 text-[1.125em]">Đã đồng bộ</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-emerald-400 text-[1.125em]">categories</td>
                        <td className="py-3 px-4">Phân loại sản phẩm (Sữa hạt, Trà sữa...)</td>
                        <td className="py-3 px-4 font-mono text-[1.125em]">{categories.length} dòng</td>
                        <td className="py-3 px-4 text-emerald-400 text-[1.125em]">Đã đồng bộ</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-amber-400 text-[1.125em]">combos</td>
                        <td className="py-3 px-4">Gói combo sản phẩm ưu đãi & tiết kiệm</td>
                        <td className="py-3 px-4 font-mono text-[1.125em]">{combos.length} dòng</td>
                        <td className="py-3 px-4 text-emerald-400 text-[1.125em]">Đã đồng bộ</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-amber-400 text-[1.125em]">combo_items</td>
                        <td className="py-3 px-4">Chi tiết các chai đồ uống trong từng gói combo</td>
                        <td className="py-3 px-4 font-mono text-[1.125em]">Tự động liên kết</td>
                        <td className="py-3 px-4 text-emerald-400 text-[1.125em]">Đã đồng bộ</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-emerald-400 text-[1.125em]">orders</td>
                        <td className="py-3 px-4">Đơn đặt hàng từ website khách hàng</td>
                        <td className="py-3 px-4 font-mono text-[1.125em]">{ordersTotal} dòng</td>
                        <td className="py-3 px-4 text-emerald-400 text-[1.125em]">Đã đồng bộ</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-emerald-400 text-[1.125em]">order_items</td>
                        <td className="py-3 px-4">Chi tiết các món trong từng đơn hàng</td>
                        <td className="py-3 px-4 font-mono text-[1.125em]">
                          {ordersTotal > orders.length ? '≥ ' : ''}{orders.reduce((acc, o) => acc + (o.item_count || 1), 0)} dòng
                        </td>
                        <td className="py-3 px-4 text-emerald-400 text-[1.125em]">Đã đồng bộ</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-emerald-400 text-[1.125em]">product_variants</td>
                        <td className="py-3 px-4">Biến thể số lượng (1 chai, lốc 6, thùng 24)</td>
                        <td className="py-3 px-4 font-mono text-[1.125em]">Tự động liên kết</td>
                        <td className="py-3 px-4 text-emerald-400 text-[1.125em]">Đã đồng bộ</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 8: CẬP NHẬT SỐ LƯỢNG MẶT HÀNG (CỬA HÀNG & ADMIN) */}
          {/* ======================================================== */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              {/* Page header */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h1 className="text-2xl text-white tracking-tight flex items-center gap-2.5">
                    <PackageCheck className="w-7 h-7 text-amber-400" />
                    <span>Cập Nhật Số Lượng Mặt Hàng</span>
                    <span className="text-sm px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Kho Cửa Hàng
                    </span>
                  </h1>

                  {/* Chi nhánh / Cửa hàng đang chọn */}
                  {hasPermission(currentUser, 'inventory.view_all') ? (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-xs text-slate-400">Chọn chi nhánh cửa hàng:</span>
                      <select
                        value={selectedStoreCode}
                        onChange={(e) => {
                          setSelectedStoreCode(e.target.value);
                          fetchInventory(e.target.value);
                        }}
                        className="bg-slate-900 border border-amber-500/40 text-amber-300 text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer shadow-sm"
                      >
                        {storeList.map((st) => (
                          <option key={st.code} value={st.code}>
                            {st.name} ({st.code})
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-slate-500 hidden sm:inline">
                        (Quản trị viên Super Admin có thể xem và cập nhật kho cho tất cả các chi nhánh)
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-400 mt-2 font-medium flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Đang quản lý kho cho:{' '}
                        <strong className="text-white text-[1.125em]">
                          {storeList.find((s) => s.code === selectedStoreCode)?.name || currentUser?.fullName || currentUser?.username}
                        </strong>
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => fetchInventory(selectedStoreCode)}
                    disabled={inventoryLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${inventoryLoading ? 'animate-spin' : ''}`} />
                    <span>Làm mới dữ liệu</span>
                  </button>
                </div>
              </div>

              {/* THÔNG TIN & ĐỊA CHỈ CHI NHÁNH CỬA HÀNG */}
              {(() => {
                const currentStore = storeList.find((s) => s.code === selectedStoreCode);
                return (
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950 border border-amber-500/30 shadow-lg">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-sm bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5" />
                            {currentStore?.name || selectedStoreCode}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">({selectedStoreCode})</span>
                        </div>

                        <div className="text-sm text-slate-200 flex items-start gap-2 pt-1">
                          <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-slate-400 font-normal text-[1.125em]">Địa chỉ cửa hàng: </strong>
                            <span className="text-white text-[1.125em]">
                              {currentStore?.address || 'Chưa cập nhật địa chỉ'}
                            </span>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-300 pt-0.5">
                          <span className="flex items-center gap-1.5 text-red-400 text-[1.125em]">
                            <Phone className="w-3.5 h-3.5" />
                            <span>Hotline: {currentStore?.phone || '028 6291 5024'}</span>
                          </span>
                          <span className="text-slate-500">•</span>
                          <span>
                            Khu vực:{' '}
                            <strong className="text-[1.125em]">
                              {currentStore?.district || 'Chưa rõ'}, {currentStore?.province || 'Hồ Chí Minh'}
                            </strong>
                          </span>
                          {currentStore?.map_url && (
                            <>
                              <span className="text-slate-500">•</span>
                              <a
                                href={currentStore.map_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Bản đồ</span>
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
                        <button
                          onClick={() => {
                            setIsLogModalOpen(true);
                            fetchInventoryLogs(selectedStoreCode);
                          }}
                          className="px-4 py-2.5 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-md transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-amber-400" />
                          <span>Lịch sử biến động kho</span>
                        </button>
                        <button
                          onClick={() => handleOpenStoreAddressModal(currentStore)}
                          className="px-4 py-2.5 rounded-xl text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Cập nhật địa chỉ cửa hàng</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* KPI Summary Cards for Inventory */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400">Tổng Số Mặt Hàng</span>
                  <div className="text-2xl sm:text-2xl text-white mt-1">
                    {inventoryItems.length} sản phẩm
                  </div>
                  <span className="text-[10px] text-slate-500">100% thức uống chính hãng</span>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400">Tổng Tồn Thực</span>
                  <div className="text-2xl sm:text-2xl text-amber-400 mt-1">
                    {Object.values(editedStock).reduce((a, b) => a + (Number(b) || 0), 0)} chai
                  </div>
                  <span className="text-[10px] text-slate-400">Kho thực tế tại {selectedStoreCode}</span>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400">Đang Giữ Chỗ (Reserved)</span>
                  <div className="text-2xl sm:text-2xl text-amber-300 mt-1">
                    {inventoryItems.reduce((acc, i) => acc + (Number(i.reserved) || 0), 0)} chai
                  </div>
                  <span className="text-[10px] text-amber-400/80">Từ các đơn hàng PENDING</span>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400">Tồn Khả Dụng Bán</span>
                  <div className="text-2xl sm:text-2xl text-emerald-400 mt-1">
                    {inventoryItems.reduce((acc, i) => {
                      const cur = editedStock[i.product_id] !== undefined ? editedStock[i.product_id] : i.stock_quantity;
                      return acc + Math.max(0, cur - (Number(i.reserved) || 0) - (Number(i.safety_stock) || 0));
                    }, 0)} chai
                  </div>
                  <span className="text-[10px] text-emerald-400/80">Khách có thể đặt mua</span>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Tìm kiếm mặt hàng theo tên hoặc mã SKU..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={inventoryStockFilter}
                    onChange={(e) => setInventoryStockFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="ALL">Tất cả trạng thái kho</option>
                    <option value="IN_STOCK">Còn hàng dồi dào (&gt;30 chai)</option>
                    <option value="LOW_STOCK">Sắp hết hàng (1 - 30 chai)</option>
                    <option value="OUT_OF_STOCK">Hết hàng (0 chai)</option>
                  </select>
                </div>
              </div>

              {/* Product Inventory Table */}
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3.5 px-4">Mặt hàng</th>
                        <th className="py-3.5 px-4">Danh mục</th>
                        <th className="py-3.5 px-4">Giá bán</th>
                        <th className="py-3.5 px-3 text-center">Tồn vật lý</th>
                        <th className="py-3.5 px-3 text-center">Đang giữ</th>
                        <th className="py-3.5 px-3 text-center">Tồn an toàn</th>
                        <th className="py-3.5 px-3 text-center">Tồn bán được</th>
                        <th className="py-3.5 px-4 text-center">Trạng thái & Cập nhật</th>
                        <th className="py-3.5 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {inventoryLoading ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-500">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400 mb-2" />
                            <span>Đang nạp dữ liệu tồn kho...</span>
                          </td>
                        </tr>
                      ) : filteredInventory.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-500">
                            Không tìm thấy mặt hàng nào phù hợp
                          </td>
                        </tr>
                      ) : (
                        filteredInventory.map((item) => {
                          const currentQty = editedStock[item.product_id] !== undefined ? editedStock[item.product_id] : item.stock_quantity;
                          const reservedQty = Number(item.reserved) || 0;
                          const safetyQty = Number(item.safety_stock) || 0;
                          const availableQty = Math.max(0, currentQty - reservedQty - safetyQty);
                          const isLow = availableQty > 0 && availableQty <= 5;
                          const isOut = availableQty === 0;

                          return (
                            <tr key={item.product_id} className="hover:bg-slate-800/40 transition-colors">
                              {/* Thông tin mặt hàng */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 relative overflow-hidden shrink-0 flex items-center justify-center p-1">
                                    <Image
                                      src={item.thumbnail}
                                      alt={item.product_name}
                                      fill
                                      className="object-contain p-0.5"
                                      unoptimized
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-white text-sm truncate max-w-[240px]" title={item.product_name}>
                                      {item.product_name}
                                    </p>
                                    <p className="text-[11px] font-mono text-slate-400">
                                      SKU: <span className="text-amber-400 text-[1.125em]">{item.sku || 'N/A'}</span> • {item.unit || '1 chai'}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              {/* Danh mục */}
                              <td className="py-3 px-4">
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                  {item.category_name || 'Đồ uống'}
                                </span>
                              </td>

                              {/* Giá bán */}
                              <td className="py-3 px-4 text-emerald-400 font-mono text-[1.125em]">
                                {formatVND(item.price)}
                              </td>

                              {/* Cột 1: Tồn vật lý */}
                              <td className="py-3 px-3 text-center">
                                <span className="inline-block px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-slate-200 text-sm shadow-xs">
                                  {currentQty} <span className="text-[10px] text-slate-500 font-normal">chai</span>
                                </span>
                              </td>

                              {/* Cột 2: Đang giữ */}
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-block px-2.5 py-1 rounded-xl font-mono text-sm border ${
                                  reservedQty > 0
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-xs'
                                    : 'bg-slate-950/60 text-slate-500 border-slate-800'
                                }`}>
                                  {reservedQty} <span className="text-[10px] font-normal">chai</span>
                                </span>
                              </td>

                              {/* Cột 3: Tồn an toàn */}
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-block px-2.5 py-1 rounded-xl font-mono text-sm border ${
                                  safetyQty > 0
                                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/30 shadow-xs'
                                    : 'bg-slate-950/60 text-slate-500 border-slate-800'
                                }`}>
                                  {safetyQty} <span className="text-[10px] font-normal">chai</span>
                                </span>
                              </td>

                              {/* Cột 4: Tồn bán được */}
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-block px-3 py-1 rounded-xl font-mono text-sm border shadow-xs ${
                                  isOut
                                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                    : isLow
                                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                }`}>
                                  {availableQty} <span className="text-[10px] font-normal">chai</span>
                                </span>
                              </td>

                              {/* Trạng thái kho & Thời gian cập nhật */}
                              <td className="py-3 px-4 text-center">
                                <div className="flex flex-col items-center justify-center gap-1">
                                  {isOut ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                      <AlertCircle className="w-3 h-3" />
                                      <span>Hết hàng</span>
                                    </span>
                                  ) : isLow ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                      <Clock className="w-3 h-3" />
                                      <span>Sắp hết (≤ 5)</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Còn hàng</span>
                                    </span>
                                  )}

                                  {/* Dòng hiển thị thời gian cập nhật lần cuối */}
                                  {item.updated_at ? (
                                    <span
                                      className="text-[10px] text-slate-400 font-mono whitespace-nowrap flex items-center justify-center gap-1"
                                      title={`Cập nhật lần cuối: ${new Date(item.updated_at).toLocaleString('vi-VN')}${item.updated_by ? ` bởi ${item.updated_by}` : ''}`}
                                    >
                                      <Clock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                      <span>
                                        Cập nhật:{' '}
                                        {new Date(item.updated_at).toLocaleTimeString('vi-VN', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}{' '}
                                        {new Date(item.updated_at).toLocaleDateString('vi-VN', {
                                          day: '2-digit',
                                          month: '2-digit',
                                        })}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 italic">
                                      Chưa cập nhật
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Nút Cập nhật duy nhất - Mở Pop-up nhập số lượng */}
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleOpenStockModal(item)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-950/30 transition-all cursor-pointer active:scale-95"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>Cập nhật</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* LÔ HÀNG & HẠN SỬ DỤNG */}
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-base text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>Lô hàng &amp; hạn sử dụng</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {inventoryLots.length} lô
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Theo dõi từng lô theo ngày sản xuất / hạn dùng (xuất theo lô hết hạn trước — FEFO). Chi nhánh:{' '}
                      <strong className="text-slate-200 text-[1.125em]">{selectedStoreCode}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fetchInventoryLots(selectedStoreCode)}
                      disabled={lotsLoading}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${lotsLoading ? 'animate-spin' : ''}`} />
                      <span>Làm mới</span>
                    </button>
                    {(hasPermission(currentUser, 'inventory.update_own_store') || hasPermission(currentUser, 'dealer.manage')) && (
                      <button
                        type="button"
                        onClick={() => setLotFormOpen((o) => !o)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lotFormOpen ? 'Đóng biểu mẫu' : 'Nhập lô mới'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {lotFormOpen && (
                  <form onSubmit={handleSaveLot} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 px-5 py-4 border-b border-slate-800 bg-slate-950/50">
                    <label className="text-[12px] text-slate-300 lg:col-span-2">
                      Sản phẩm *
                      <select
                        value={lotForm.productId}
                        onChange={(e) => setLotForm({ ...lotForm, productId: e.target.value })}
                        required
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">— Chọn sản phẩm —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name.length > 60 ? `${p.name.slice(0, 58)}…` : p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[12px] text-slate-300">
                      Mã lô *
                      <input
                        type="text"
                        value={lotForm.lotCode}
                        onChange={(e) => setLotForm({ ...lotForm, lotCode: e.target.value })}
                        maxLength={100}
                        required
                        placeholder="VD: LOT-2610-01"
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label className="text-[12px] text-slate-300">
                      Ngày sản xuất *
                      <input
                        type="date"
                        value={lotForm.manufacturingDate}
                        onChange={(e) => setLotForm({ ...lotForm, manufacturingDate: e.target.value })}
                        required
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label className="text-[12px] text-slate-300">
                      Hạn sử dụng *
                      <input
                        type="date"
                        value={lotForm.expiryDate}
                        min={lotForm.manufacturingDate || undefined}
                        onChange={(e) => setLotForm({ ...lotForm, expiryDate: e.target.value })}
                        required
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label className="text-[12px] text-slate-300">
                      Số lượng (chai) *
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={lotForm.quantity}
                        onChange={(e) => setLotForm({ ...lotForm, quantity: e.target.value })}
                        required
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </label>
                    <div className="sm:col-span-2 lg:col-span-4 flex items-end text-[11px] text-slate-500">
                      Nhập trùng mã lô và đúng ngày sẽ cộng thêm số lượng vào lô đó; trùng mã lô nhưng khác ngày sẽ bị từ chối.
                    </div>
                    <div className="flex items-end justify-end">
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm cursor-pointer"
                      >
                        Lưu lô hàng
                      </button>
                    </div>
                  </form>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Sản phẩm</th>
                        <th className="py-3 px-4">Mã lô</th>
                        <th className="py-3 px-4">NSX</th>
                        <th className="py-3 px-4">HSD</th>
                        <th className="py-3 px-4 text-right">Tồn</th>
                        <th className="py-3 px-4 text-right">Giữ chỗ</th>
                        <th className="py-3 px-4 text-right">Còn bán</th>
                        <th className="py-3 px-4">Tình trạng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {inventoryLots.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            {lotsLoading
                              ? 'Đang tải lô hàng...'
                              : 'Chi nhánh này chưa có lô hàng nào. Bấm "Nhập lô mới" để bắt đầu theo dõi hạn sử dụng.'}
                          </td>
                        </tr>
                      )}
                      {inventoryLots.map((lot) => {
                        const badge =
                          lot.expiryStatus === 'EXPIRED'
                            ? { cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30', text: `Đã hết hạn ${Math.abs(lot.daysRemaining)} ngày` }
                            : lot.expiryStatus === 'CRITICAL'
                            ? { cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30 animate-pulse', text: `Còn ${lot.daysRemaining} ngày` }
                            : lot.expiryStatus === 'NEAR_EXPIRY'
                            ? { cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30', text: `Sắp hết hạn · ${lot.daysRemaining} ngày` }
                            : { cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', text: `Còn ${lot.daysRemaining} ngày` };
                        const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN');
                        return (
                          <tr key={lot.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 text-slate-100 max-w-[240px] truncate text-[1.125em]" title={lot.product_name}>
                              {lot.product_name}
                            </td>
                            <td className="py-3 px-4 font-mono text-emerald-400">{lot.lot_code}</td>
                            <td className="py-3 px-4 text-slate-400">{fmtDate(lot.manufacturing_date)}</td>
                            <td className="py-3 px-4 text-slate-200">{fmtDate(lot.expiry_date)}</td>
                            <td className="py-3 px-4 text-right font-mono">{lot.stock_quantity}</td>
                            <td className="py-3 px-4 text-right font-mono text-amber-300">{lot.reserved_quantity}</td>
                            <td className="py-3 px-4 text-right font-mono text-white text-[1.125em]">{lot.available_quantity}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] border ${badge.cls}`}>{badge.text}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 9: QUẢN LÝ & TẠO TÀI KHOẢN ADMIN (SUPER ADMIN ONLY) */}
          {/* ======================================================== */}
          {activeTab === 'users' && hasPermission(currentUser, 'users.manage') && (
            <div className="space-y-6">
              {/* Page header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl text-white tracking-tight flex items-center gap-2.5">
                    <ShieldCheck className="w-7 h-7 text-leaf-400" />
                    <span>Quản Lý Tài Khoản Quản Trị</span>
                    <span className="text-sm px-2.5 py-1 rounded-full bg-leaf-500/10 text-leaf-400 border border-leaf-500/20">
                      Super Admin
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Cấp tài khoản, phân quyền quản lý cho các cửa hàng chi nhánh Thái Sơn Foods
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchAdminUsers}
                    disabled={adminUsersLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-leaf-400 ${adminUsersLoading ? 'animate-spin' : ''}`} />
                    <span>Làm mới</span>
                  </button>

                  <button
                    onClick={handleOpenCreateUser}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-leaf-600 hover:bg-leaf-700 text-ink-950 shadow-lg shadow-leaf-900/30 transition-all cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Tạo Tài Khoản Mới</span>
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Tổng Quản Trị Viên</span>
                  <div className="text-2xl text-white mt-1">{adminUsers.length} tài khoản</div>
                  <span className="text-[10px] text-slate-500">Trong CSDL WebTSF</span>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Quản Trị Cấp Cao</span>
                  <div className="text-2xl text-leaf-400 mt-1">
                    {adminUsers.filter((u) => u.role === 'SUPER_ADMIN').length} Super Admin
                  </div>
                  <span className="text-[10px] text-leaf-400/80">Toàn quyền hệ thống</span>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Admin Cửa Hàng</span>
                  <div className="text-2xl text-emerald-400 mt-1">
                    {adminUsers.filter((u) => u.role === 'ADMIN').length} Cửa hàng
                  </div>
                  <span className="text-[10px] text-emerald-400/80">TCH, TN, THB, NH, D1...</span>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Đang Hoạt Động</span>
                  <div className="text-2xl text-teal-400 mt-1">
                    {adminUsers.filter((u) => u.is_active).length} / {adminUsers.length}
                  </div>
                  <span className="text-[10px] text-teal-400/80">Sẵn sàng đăng nhập</span>
                </div>
              </div>

              {/* Search & Filter */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Tìm theo Username, Email, Họ tên quản trị..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-leaf-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-leaf-500 cursor-pointer"
                  >
                    <option value="ALL">Tất cả vai trò</option>
                    <option value="SUPER_ADMIN">Quản trị cấp cao (Super Admin)</option>
                    <option value="ADMIN">Quản trị viên cửa hàng (ADMIN)</option>
                  </select>
                </div>
              </div>

              {/* Admin Users Table */}
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3.5 px-4">Tài khoản &amp; Họ tên</th>
                        <th className="py-3.5 px-4">Email đăng nhập</th>
                        <th className="py-3.5 px-4">Vai trò (Role)</th>
                        <th className="py-3.5 px-4">Trạng thái</th>
                        <th className="py-3.5 px-4">Ngày khởi tạo</th>
                        <th className="py-3.5 px-4 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {adminUsersLoading ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-leaf-400 mb-2" />
                            <span>Đang nạp danh sách tài khoản quản trị...</span>
                          </td>
                        </tr>
                      ) : filteredAdminUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500">
                            Không tìm thấy tài khoản quản trị nào
                          </td>
                        </tr>
                      ) : (
                        filteredAdminUsers.map((user) => {
                          const isSelf = currentUser?.id === user.id;

                          return (
                            <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                              {/* Username & Avatar */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm text-white shadow-sm shrink-0 ${
                                      user.role === 'SUPER_ADMIN'
                                        ? 'bg-gradient-to-tr from-leaf-600 to-leaf-500'
                                        : 'bg-gradient-to-tr from-emerald-600 to-teal-500'
                                    }`}
                                  >
                                    {user.username.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-white text-sm flex items-center gap-1.5">
                                      <span>{user.username}</span>
                                      {isSelf && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                          (Tôi)
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-[11px] text-slate-400">{user.full_name || 'Quản trị viên'}</p>
                                  </div>
                                </div>
                              </td>

                              {/* Email */}
                              <td className="py-3 px-4 font-mono text-slate-300">
                                {user.email}
                              </td>

                              {/* Role */}
                              <td className="py-3 px-4">
                                {user.role === 'SUPER_ADMIN' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/30 uppercase">
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Super Admin</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                                    <Store className="w-3 h-3" />
                                    <span>Admin Cửa Hàng</span>
                                  </span>
                                )}
                              </td>

                              {/* Trạng thái */}
                              <td className="py-3 px-4">
                                {user.is_active ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                    <span>Hoạt động</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                    <span>Tạm khóa</span>
                                  </span>
                                )}
                              </td>

                              {/* Ngày tạo */}
                              <td className="py-3 px-4 text-slate-400 text-[11px]">
                                {new Date(user.created_at).toLocaleDateString('vi-VN')}
                              </td>

                              {/* Thao tác */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditUser(user)}
                                    title="Sửa thông tin / Đổi mật khẩu"
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {!isSelf && (
                                    <>
                                      <button
                                        onClick={() => handleToggleUserStatus(user)}
                                        title={user.is_active ? 'Khóa tài khoản này' : 'Mở khóa tài khoản'}
                                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                          user.is_active
                                            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400'
                                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                        }`}
                                      >
                                        <Lock className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        onClick={() => handleDeleteUser(user)}
                                        title="Xóa tài khoản này"
                                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: QUẢN LÝ KHÁCH HÀNG THÀNH VIÊN (MEMBERS) */}
          {/* ======================================================== */}
          {activeTab === 'members' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl text-white tracking-tight flex items-center gap-2.5">
                    <span>Khách Hàng Thành Viên</span>
                    <span className="text-xs font-normal px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      {members.length} tài khoản
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Quản lý danh sách hội viên đăng ký trên website, theo dõi đơn hàng và trạng thái tài khoản
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportMembersCSV}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-400" />
                    <span>Xuất CSV Thành Viên</span>
                  </button>

                  <button
                    onClick={fetchMembers}
                    disabled={membersLoading}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${membersLoading ? 'animate-spin' : ''}`} />
                    <span>{membersLoading ? 'Đang tải...' : 'Làm mới'}</span>
                  </button>
                </div>
              </div>

              {/* 4 Thẻ KPI Thành viên */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Tổng Thành Viên */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Tổng Thành Viên</span>
                    <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Users className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl text-white mt-2 tracking-tight">
                    {members.length}
                  </div>
                  <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{members.filter((m) => m.provider === 'google').length} tài khoản Google</span>
                  </p>
                </div>

                {/* 2. Thành viên có đơn */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Thành Viên Mua Hàng</span>
                    <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                      <ShoppingCart className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl text-white mt-2 tracking-tight">
                    {members.filter((m) => Number(m.total_orders) > 0).length}
                  </div>
                  <p className="text-[11px] text-blue-400 mt-1.5">
                    {members.length > 0
                      ? `${Math.round((members.filter((m) => Number(m.total_orders) > 0).length / members.length) * 100)}% đã phát sinh đơn`
                      : 'Chưa có đơn hàng'}
                  </p>
                </div>

                {/* 3. Tổng chi tiêu của thành viên */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Tổng Chi Tiêu Tích Lũy</span>
                    <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <DollarSign className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl text-white mt-2 tracking-tight">
                    {formatVND(members.reduce((acc, m) => acc + (Number(m.total_spent) || 0), 0))}
                  </div>
                  <p className="text-[11px] text-amber-400 mt-1.5">Doanh thu từ các đơn thành viên</p>
                </div>

                {/* 4. Tài khoản hoạt động */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Trạng Thái Hoạt Động</span>
                    <span className="p-2 rounded-xl bg-leaf-500/10 text-leaf-400">
                      <UserCheck className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl text-white mt-2 tracking-tight">
                    {members.filter((m) => m.is_active).length} / {members.length}
                  </div>
                  <p className="text-[11px] text-leaf-400 mt-1.5">
                    {members.filter((m) => !m.is_active).length > 0
                      ? `${members.filter((m) => !m.is_active).length} tài khoản đang bị khóa`
                      : '100% tài khoản hoạt động tốt'}
                  </p>
                </div>
              </div>

              {/* Bảng Danh Sách Thành Viên & Bộ Lọc */}
              <div className="bg-forest-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                {/* Search & Filter Toolbar */}
                <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/40">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Tìm theo họ tên, email, số điện thoại, địa chỉ..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Lọc theo Nguồn đăng ký */}
                    <select
                      value={memberProviderFilter}
                      onChange={(e) => setMemberProviderFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ALL">Tất cả nguồn đăng ký</option>
                      <option value="local">Đăng ký Trực tiếp (Web)</option>
                      <option value="google">Đăng nhập Google</option>
                      <option value="facebook">Đăng nhập Facebook</option>
                    </select>

                    {/* Lọc theo Trạng thái */}
                    <select
                      value={memberStatusFilter}
                      onChange={(e) => setMemberStatusFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ALL">Tất cả trạng thái</option>
                      <option value="ACTIVE">Đang hoạt động</option>
                      <option value="LOCKED">Đã tạm khóa</option>
                    </select>
                  </div>
                </div>

                {/* Table Data */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[12px] uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-4">Thành Viên</th>
                        <th className="py-3 px-4">Liên Hệ</th>
                        <th className="py-3 px-4">Địa Chỉ Nhận Hàng</th>
                        <th className="py-3 px-4">Đơn Hàng & Chi Tiêu</th>
                        <th className="py-3 px-4">Trạng Thái</th>
                        <th className="py-3 px-4">Ngày Đăng Ký</th>
                        <th className="py-3 px-4 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                      {membersLoading ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                              <span>Đang tải danh sách thành viên...</span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Users className="w-8 h-8 text-slate-600" />
                              <p className="text-slate-300 text-[1.125em]">Không tìm thấy khách hàng nào</p>
                              <p className="text-[11px] text-slate-500">
                                Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((member) => (
                          <tr
                            key={member.id}
                            className="hover:bg-slate-800/40 transition-colors group"
                          >
                            {/* Cột 1: Thông tin khách hàng */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-400/30 flex items-center justify-center text-white text-sm shrink-0 shadow-md">
                                  {member.full_name
                                    ? member.full_name.slice(0, 2).toUpperCase()
                                    : 'KH'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-white group-hover:text-emerald-400 transition-colors text-[1.125em]">
                                      {member.full_name || 'Khách vãng lai'}
                                    </p>
                                    {member.provider === 'google' && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                        Google
                                      </span>
                                    )}
                                    {member.provider === 'facebook' && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                        Facebook
                                      </span>
                                    )}
                                    {(!member.provider || member.provider === 'local') && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                                        Web
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-mono truncate">
                                    ID: {member.id}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Cột 2: Liên hệ (Email + SĐT) */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-slate-200">
                                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[200px]" title={member.email}>
                                    {member.email}
                                  </span>
                                </div>
                                {member.phone ? (
                                  <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                                    <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span>{member.phone}</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic">
                                    Chưa cập nhật SĐT
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Cột 3: Địa chỉ nhận hàng */}
                            <td className="py-3.5 px-4 max-w-[220px]">
                              {member.address || member.province ? (
                                <div className="space-y-0.5">
                                  <p className="text-slate-300 truncate" title={member.address || ''}>
                                    {member.address || 'Địa chỉ chưa cập nhật'}
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-slate-600 shrink-0" />
                                    <span>
                                      {[member.ward, member.district, member.province]
                                        .filter(Boolean)
                                        .join(', ')}
                                    </span>
                                  </p>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-500 italic">
                                  Chưa lưu địa chỉ
                                </span>
                              )}
                            </td>

                            {/* Cột 4: Đơn hàng & Chi tiêu */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    {member.total_orders || 0} đơn
                                  </span>
                                  <span className="text-white text-[1.125em]">
                                    {formatVND(member.total_spent || 0)}
                                  </span>
                                </div>
                                {member.last_order_date && (
                                  <p className="text-[10px] text-slate-500">
                                    Gần nhất: {new Date(member.last_order_date).toLocaleDateString('vi-VN')}
                                  </p>
                                )}
                              </div>
                            </td>

                            {/* Cột 5: Trạng thái */}
                            <td className="py-3.5 px-4">
                              {member.is_active ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                  <span>Hoạt động</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                  <span>Đã tạm khóa</span>
                                </span>
                              )}
                            </td>

                            {/* Cột 6: Ngày đăng ký */}
                            <td className="py-3.5 px-4 text-slate-400 text-[11px] font-mono">
                              {new Date(member.created_at).toLocaleDateString('vi-VN')}
                            </td>

                            {/* Cột 7: Thao tác */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenMemberDetail(member)}
                                  title="Xem chi tiết hồ sơ & lịch sử đơn hàng"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {hasPermission(currentUser, 'members.manage') && (
                                  <>
                                    <button
                                      onClick={() => handleToggleMemberStatus(member)}
                                      title={member.is_active ? 'Khóa tài khoản thành viên này' : 'Mở khóa tài khoản'}
                                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                        member.is_active
                                          ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400'
                                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                      }`}
                                    >
                                      <Lock className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      onClick={() => handleDeleteMember(member)}
                                      title="Xóa tài khoản thành viên"
                                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: NHẬT KÝ HOẠT ĐỘNG (AUDIT LOGS) */}
          {/* ======================================================== */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl text-white tracking-tight flex items-center gap-2.5">
                    <History className="w-6 h-6 text-amber-400" />
                    <span>Nhật Ký Hoạt Động Hệ Thống</span>
                    <span className="text-xs font-normal px-2.5 py-1 rounded-full bg-leaf-500/10 text-leaf-400 border border-leaf-500/20 font-mono">
                      Audit Trail
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Lưu vết bảo mật: thời gian, người thực hiện, thao tác, đối tượng và dữ liệu trước/sau thay đổi
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportAuditCSV}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-400" />
                    <span>Xuất CSV Nhật Ký</span>
                  </button>
                  <button
                    onClick={() => fetchAuditLogs(auditPagination.page)}
                    disabled={auditLogsLoading}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm bg-leaf-600 hover:bg-leaf-700 text-ink-950 shadow-lg shadow-leaf-900/30 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${auditLogsLoading ? 'animate-spin' : ''}`} />
                    <span>{auditLogsLoading ? 'Đang tải...' : 'Làm mới'}</span>
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') fetchAuditLogs(1);
                    }}
                    placeholder="Tìm theo username, hành động, ID đối tượng..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-leaf-500"
                  />
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <select
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-leaf-500 cursor-pointer"
                  >
                    <option value="ALL">Tất cả hành động</option>
                    <option value="auth.login">Đăng nhập (auth.login)</option>
                    <option value="orders.status_update">Cập nhật đơn (orders.status_update)</option>
                    <option value="orders.transfer">Chuyển chi nhánh (orders.transfer)</option>
                    <option value="inventory.update">Cập nhật tồn kho (inventory.update)</option>
                    <option value="products.create">Tạo sản phẩm (products.create)</option>
                    <option value="products.update">Sửa sản phẩm (products.update)</option>
                    <option value="products.delete">Xóa sản phẩm (products.delete)</option>
                    <option value="combos.create">Tạo combo (combos.create)</option>
                    <option value="combos.update">Sửa combo (combos.update)</option>
                    <option value="combos.delete">Xóa combo (combos.delete)</option>
                    <option value="users.create">Tạo tài khoản (users.create)</option>
                    <option value="users.update">Sửa tài khoản (users.update)</option>
                    <option value="users.delete">Xóa tài khoản (users.delete)</option>
                  </select>

                  <select
                    value={auditStoreFilter}
                    onChange={(e) => setAuditStoreFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-leaf-500 cursor-pointer"
                  >
                    <option value="ALL">Tất cả cửa hàng</option>
                    {storeList.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.name} ({st.code})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => fetchAuditLogs(1)}
                    className="px-3.5 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  >
                    Lọc
                  </button>
                </div>
              </div>

              {/* Audit Logs Table */}
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[12px] uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-4">Thời Gian</th>
                        <th className="py-3 px-4">Người Thực Hiện</th>
                        <th className="py-3 px-4">Hành Động</th>
                        <th className="py-3 px-4">Đối Tượng</th>
                        <th className="py-3 px-4">Cửa Hàng</th>
                        <th className="py-3 px-4">Địa Chỉ IP</th>
                        <th className="py-3 px-4 text-right">Chi Tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {auditLogsLoading ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <RefreshCw className="w-6 h-6 animate-spin text-leaf-400" />
                              <span>Đang tải nhật ký hoạt động...</span>
                            </div>
                          </td>
                        </tr>
                      ) : auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <History className="w-8 h-8 text-slate-600" />
                              <p className="text-slate-300 text-[1.125em]">Chưa có nhật ký hoạt động nào</p>
                              <p className="text-[11px] text-slate-500">
                                Mọi thao tác thêm, sửa, xóa, chuyển đơn, đăng nhập sẽ tự động hiển thị tại đây
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => {
                          const isCreate = log.action.includes('create');
                          const isDelete = log.action.includes('delete');
                          const isUpdate = log.action.includes('update') || log.action.includes('transfer');
                          const isAuth = log.action.includes('login') || log.action.includes('auth');

                          return (
                            <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                              {/* Thời gian */}
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                                {new Date(log.created_at).toLocaleString('vi-VN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </td>

                              {/* Người thực hiện */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-mono text-[1.125em]">{log.admin_username}</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                                      log.role === 'SUPER_ADMIN'
                                        ? 'bg-leaf-500/20 text-leaf-300 border border-leaf-500/30'
                                        : log.role === 'MARKETING'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    }`}
                                  >
                                    {log.role === 'SUPER_ADMIN' ? 'Super' : log.role === 'MARKETING' ? 'MKT' : 'CH'}
                                  </span>
                                </div>
                              </td>

                              {/* Hành động */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border ${
                                    isCreate
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                      : isDelete
                                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                      : isUpdate
                                      ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                                      : isAuth
                                      ? 'bg-leaf-500/10 text-leaf-400 border-leaf-500/30'
                                      : 'bg-slate-800 text-slate-300 border-slate-700'
                                  }`}
                                >
                                  {log.action}
                                </span>
                              </td>

                              {/* Đối tượng */}
                              <td className="py-3 px-4">
                                <div className="text-slate-300 font-mono text-[11px] truncate max-w-[200px]" title={log.entity_id || ''}>
                                  <span className="text-slate-400">{log.entity_type}</span>
                                  {log.entity_id && <span className="text-slate-200"> #{log.entity_id}</span>}
                                </div>
                              </td>

                              {/* Cửa hàng */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                {log.store_code ? (
                                  <span className="px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                                    {log.store_code}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[11px]">Toàn HT</span>
                                )}
                              </td>

                              {/* IP */}
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                                {log.ip || '—'}
                              </td>

                              {/* Nút xem JSON */}
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setSelectedAuditLog(log);
                                    setIsAuditModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-[12px] bg-slate-800 hover:bg-slate-700 text-leaf-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                                >
                                  Xem thay đổi
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {auditPagination.totalPages > 1 && (
                  <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Trang {auditPagination.page} / {auditPagination.totalPages} (Tổng {auditPagination.total} bản ghi)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={auditPagination.page <= 1 || auditLogsLoading}
                        onClick={() => fetchAuditLogs(auditPagination.page - 1)}
                        className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Trang trước
                      </button>
                      <button
                        disabled={auditPagination.page >= auditPagination.totalPages || auditLogsLoading}
                        onClick={() => fetchAuditLogs(auditPagination.page + 1)}
                        className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Trang sau
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  </div>

      {/* ======================================================== */}
      {/* MODAL: THÊM / SỬA SẢN PHẨM */}
      {/* ======================================================== */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-[1001] bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-forest-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg text-white">
                  {editingProduct.id ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
                </h2>
                <p className="text-xs text-slate-400">Lưu thông tin trực tiếp vào CSDL WebTSF</p>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tên sản phẩm */}
                <div className="sm:col-span-2">
                  <label className="block text-sm text-slate-300 mb-1">
                    Tên sản phẩm *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    placeholder="Ví dụ: Sữa Bắp Nếp Thái Sơn"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Mã SKU</label>
                  <input
                    type="text"
                    value={editingProduct.sku || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    placeholder="TSF-01"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Danh mục */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Danh mục *</label>
                  <select
                    value={editingProduct.category_id || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, category_id: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Giá bán */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm text-slate-300">
                      Giá bán (VNĐ) *
                    </label>
                    {!hasPermission(currentUser, 'products.manage_price') && (
                      <span className="text-[10px] text-amber-400 font-medium">Chỉ xem (không có quyền sửa giá)</span>
                    )}
                  </div>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    disabled={!hasPermission(currentUser, 'products.manage_price')}
                    value={editingProduct.price || 0}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, price: parseInt(e.target.value, 10) })
                    }
                    className={`w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 ${
                      !hasPermission(currentUser, 'products.manage_price') ? 'opacity-60 cursor-not-allowed bg-slate-900' : ''
                    }`}
                  />
                </div>

                {/* Giá vốn */}
                {hasPermission(currentUser, 'cost_price.view') && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm text-amber-300">
                        Giá vốn (VNĐ)
                      </label>
                      {!hasPermission(currentUser, 'cost_price.edit') && (
                        <span className="text-[10px] text-slate-400 font-medium">Chỉ xem</span>
                      )}
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      disabled={!hasPermission(currentUser, 'cost_price.edit')}
                      value={editingProduct.cost_price || 0}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, cost_price: parseInt(e.target.value, 10) || 0 })
                      }
                      placeholder="0"
                      className={`w-full bg-slate-950 border border-amber-900/50 rounded-xl px-3.5 py-2 text-xs text-amber-200 focus:outline-none focus:border-amber-500 ${
                        !hasPermission(currentUser, 'cost_price.edit') ? 'opacity-60 cursor-not-allowed bg-slate-900' : ''
                      }`}
                    />
                  </div>
                )}

                {/* Đơn vị tính */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Đơn vị tính</label>
                  <input
                    type="text"
                    value={editingProduct.unit || '1 chai'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                    placeholder="1 chai, chai, lon..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Quản lý Thư viện Hình ảnh Sản phẩm */}
                <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div>
                      <h4 className="text-sm text-white flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-emerald-400" />
                        <span>Quản Lý Hình Ảnh & Thư Viện Sản Phẩm</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                          {productImages.length} ảnh
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tải ảnh mới từ máy tính hoặc dán URL. Admin có thể kéo/chọn ảnh đại diện, sắp xếp thứ tự và sửa Alt text.
                      </p>
                    </div>

                    {/* Upload button */}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all shadow-sm">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingImage ? 'Đang tải lên...' : 'Tải ảnh từ máy'}</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/mp4"
                          disabled={uploadingImage}
                          onChange={(e) => handleUploadImageFile(e, 'products')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Thêm từ URL nhanh */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Dán đường dẫn ảnh: /images/products/... hoặc https://..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddImageUrl('products')}
                      className="px-3 py-1.5 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                    >
                      Thêm URL
                    </button>
                  </div>

                  {/* Danh sách ảnh trong Gallery */}
                  {productImages.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                      Chưa có hình ảnh nào trong thư viện. Bấm &quot;Tải ảnh từ máy&quot; để thêm ảnh cho sản phẩm.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {productImages.map((img, idx) => {
                        const isThumb = editingProduct.thumbnail === img.url;
                        return (
                          <div
                            key={img.id || img.url || idx}
                            className={`p-2.5 rounded-xl bg-slate-900 border transition-all flex flex-col gap-2 ${
                              isThumb
                                ? 'border-emerald-500/80 shadow-md shadow-emerald-950/40 bg-emerald-950/10'
                                : 'border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="relative aspect-[4/3] w-full rounded-lg bg-slate-950 border border-slate-800/80 overflow-hidden flex items-center justify-center">
                              {img.url && img.url.endsWith('.mp4') ? (
                                <video src={img.url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                              ) : img.url ? (
                                <Image
                                  src={img.url}
                                  alt={img.alt || 'Ảnh sản phẩm'}
                                  fill
                                  className="object-contain p-1"
                                  unoptimized
                                />
                              ) : null}

                              {/* Badge Đại diện */}
                              {isThumb && (
                                <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[11px] bg-emerald-600 text-white shadow-sm flex items-center gap-1">
                                  <Star className="w-2.5 h-2.5 fill-white" />
                                  <span>Đại diện</span>
                                </span>
                              )}

                              {/* Thứ tự */}
                              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-900/90 text-slate-300 border border-slate-700">
                                #{idx + 1}
                              </span>
                            </div>

                            {/* Alt input */}
                            <input
                              type="text"
                              value={img.alt || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setProductImages((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, alt: val } : item))
                                );
                              }}
                              placeholder="Mô tả ảnh (Alt text)..."
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                            />

                            {/* Action Toolbar */}
                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/60">
                              <div className="flex items-center gap-1">
                                {!isThumb && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingProduct({ ...editingProduct, thumbnail: img.url })}
                                    className="px-2 py-1 rounded text-[11px] bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 transition-all flex items-center gap-1 cursor-pointer"
                                    title="Chọn làm ảnh đại diện chính"
                                  >
                                    <Star className="w-3 h-3 text-amber-400" />
                                    <span>Đặt đại diện</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveProductImage(idx, 'up')}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title="Chuyển lên trước"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === productImages.length - 1}
                                  onClick={() => handleMoveProductImage(idx, 'down')}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title="Chuyển xuống sau"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteProductImage(idx)}
                                className="p-1 rounded bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all cursor-pointer"
                                title="Xóa ảnh này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Mô tả ngắn */}
                <div className="sm:col-span-2">
                  <label className="block text-sm text-slate-300 mb-1">Mô tả ngắn</label>
                  <input
                    type="text"
                    value={editingProduct.short_description || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, short_description: e.target.value })
                    }
                    placeholder="Mô tả tóm tắt sản phẩm trong 1 câu..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Mô tả chi tiết */}
                <div className="sm:col-span-2">
                  <label className="block text-sm text-slate-300 mb-1">Mô tả chi tiết</label>
                  <textarea
                    rows={3}
                    value={editingProduct.description || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, description: e.target.value })
                    }
                    placeholder="Nguyên liệu, công dụng, bảo quản..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  ></textarea>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <p className="text-sm text-slate-300">Thuộc tính hiển thị</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.is_active)}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, is_active: e.target.checked })
                      }
                      className="accent-emerald-600 rounded"
                    />
                    <span>Kích hoạt bán</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.is_featured)}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, is_featured: e.target.checked })
                      }
                      className="accent-emerald-600 rounded"
                    />
                    <span>Nổi bật ⭐</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.is_best_seller)}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, is_best_seller: e.target.checked })
                      }
                      className="accent-emerald-600 rounded"
                    />
                    <span>Bán chạy 🔥</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.is_new)}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, is_new: e.target.checked })
                      }
                      className="accent-emerald-600 rounded"
                    />
                    <span>Mới 🆕</span>
                  </label>
                </div>
              </div>

              {/* Số đã bán ở kênh ngoài website — hiển thị "Hơn N sản phẩm đã được bán" ở trang chi tiết */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <p className="text-sm text-slate-300">Đã bán ngoài website (tổng cộng)</p>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={editingProduct.sold_offset ?? 0}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, sold_offset: Math.max(0, parseInt(e.target.value, 10) || 0) })
                  }
                  className="w-full sm:w-64 bg-slate-950 border border-slate-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500">
                  Nhập số lượng thật đã bán ở cửa hàng/đại lý/kênh khác. Website tự cộng thêm đơn đặt trên web và chỉ hiện khi tổng từ 10 trở lên.
                </p>
              </div>

              {/* Variants */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-300">Biến thể đóng gói (Variants)</p>
                  <button
                    type="button"
                    onClick={() =>
                      setProductFormVariants([
                        ...productFormVariants,
                        { name: 'Thùng 24 chai', quantity: 24, price: 432000, unit: 'thùng' },
                      ])
                    }
                    className="text-[12px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm biến thể</span>
                  </button>
                </div>

                {productFormVariants.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={v.name}
                      placeholder="Tên (VD: 6 chai)"
                      onChange={(e) => {
                        const next = [...productFormVariants];
                        next[i].name = e.target.value;
                        setProductFormVariants(next);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                    <input
                      type="number"
                      value={v.quantity}
                      placeholder="Số lượng"
                      onChange={(e) => {
                        const next = [...productFormVariants];
                        next[i].quantity = parseInt(e.target.value, 10);
                        setProductFormVariants(next);
                      }}
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-center"
                    />
                    <input
                      type="number"
                      value={v.price}
                      placeholder="Giá tiền"
                      disabled={!hasPermission(currentUser, 'products.manage_price')}
                      onChange={(e) => {
                        const next = [...productFormVariants];
                        next[i].price = parseInt(e.target.value, 10);
                        setProductFormVariants(next);
                      }}
                      className={`w-28 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white ${
                        !hasPermission(currentUser, 'products.manage_price') ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setProductFormVariants(productFormVariants.filter((_, idx) => idx !== i))
                      }
                      className="p-1 text-rose-400 hover:bg-rose-950 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingProduct.id ? 'Cập Nhật Sản Phẩm' : 'Tạo Sản Phẩm'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: THÊM / SỬA GÓI COMBO */}
      {/* ======================================================== */}
      {isComboModalOpen && editingCombo && (
        <div className="fixed inset-0 z-[1001] bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-forest-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg text-white flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-amber-400" />
                  <span>{editingCombo.id ? 'Chỉnh Sửa Gói Combo' : 'Thêm Gói Combo Mới'}</span>
                </h2>
                <p className="text-xs text-slate-400">Lưu dữ liệu trực tiếp vào CSDL PostgreSQL WebTSF</p>
              </div>
              <button
                onClick={() => setIsComboModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCombo} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tên combo */}
                <div className="sm:col-span-2">
                  <label className="block text-sm text-slate-300 mb-1">
                    Tên Gói Combo *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingCombo.name || ''}
                    onChange={(e) => setEditingCombo({ ...editingCombo, name: e.target.value })}
                    placeholder="VD: Combo 10 Chai Sữa Hạt Sen"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Đường dẫn Slug */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Đường dẫn (Slug)
                  </label>
                  <input
                    type="text"
                    value={editingCombo.slug || ''}
                    onChange={(e) => setEditingCombo({ ...editingCombo, slug: e.target.value })}
                    placeholder="combo-10-chai-sua-hat-sen"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                {/* Tổng số chai */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Tổng số chai (Quy cách) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editingCombo.total_items || 10}
                    onChange={(e) =>
                      setEditingCombo({ ...editingCombo, total_items: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Giá gốc */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm text-slate-300">
                      Giá Gốc Niêm Yết (VNĐ) *
                    </label>
                    {!hasPermission(currentUser, 'products.manage_price') && (
                      <span className="text-[10px] text-amber-400 font-medium">Chỉ xem</span>
                    )}
                  </div>
                  <input
                    type="number"
                    required
                    step={1000}
                    disabled={!hasPermission(currentUser, 'products.manage_price')}
                    value={editingCombo.original_price || 0}
                    onChange={(e) => {
                      const orig = parseInt(e.target.value, 10) || 0;
                      const sale = editingCombo.sale_price || 0;
                      const disc = orig > 0 ? Math.round(((orig - sale) / orig) * 100) : 0;
                      setEditingCombo({ ...editingCombo, original_price: orig, discount: disc > 0 ? disc : 0 });
                    }}
                    className={`w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 ${
                      !hasPermission(currentUser, 'products.manage_price') ? 'opacity-60 cursor-not-allowed bg-slate-900' : ''
                    }`}
                  />
                </div>

                {/* Giá bán */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm text-slate-300">
                      Giá Bán Ưu Đãi (VNĐ) *
                    </label>
                    {!hasPermission(currentUser, 'products.manage_price') && (
                      <span className="text-[10px] text-amber-400 font-medium">Chỉ xem</span>
                    )}
                  </div>
                  <input
                    type="number"
                    required
                    step={1000}
                    disabled={!hasPermission(currentUser, 'products.manage_price')}
                    value={editingCombo.sale_price || 0}
                    onChange={(e) => {
                      const sale = parseInt(e.target.value, 10) || 0;
                      const orig = editingCombo.original_price || 0;
                      const disc = orig > 0 ? Math.round(((orig - sale) / orig) * 100) : 0;
                      setEditingCombo({ ...editingCombo, sale_price: sale, discount: disc > 0 ? disc : 0 });
                    }}
                    className={`w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500 text-emerald-400 ${
                      !hasPermission(currentUser, 'products.manage_price') ? 'opacity-60 cursor-not-allowed bg-slate-900' : ''
                    }`}
                  />
                </div>

                {/* Giá vốn combo */}
                {hasPermission(currentUser, 'cost_price.view') && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm text-amber-300">
                        Giá Vốn Combo (VNĐ)
                      </label>
                      {!hasPermission(currentUser, 'cost_price.edit') && (
                        <span className="text-[10px] text-slate-400 font-medium">Chỉ xem</span>
                      )}
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      disabled={!hasPermission(currentUser, 'cost_price.edit')}
                      value={editingCombo.cost_price || 0}
                      onChange={(e) =>
                        setEditingCombo({ ...editingCombo, cost_price: parseInt(e.target.value, 10) || 0 })
                      }
                      placeholder="0"
                      className={`w-full bg-slate-950 border border-amber-900/50 rounded-xl px-3.5 py-2 text-xs text-amber-200 focus:outline-none focus:border-amber-500 ${
                        !hasPermission(currentUser, 'cost_price.edit') ? 'opacity-60 cursor-not-allowed bg-slate-900' : ''
                      }`}
                    />
                  </div>
                )}

                {/* Tỷ lệ giảm giá % */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Phần Trăm Giảm Giá (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editingCombo.discount || 0}
                    onChange={(e) =>
                      setEditingCombo({ ...editingCombo, discount: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Quản lý Thư viện Hình ảnh Combo */}
                <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div>
                      <h4 className="text-sm text-white flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-amber-400" />
                        <span>Quản Lý Hình Ảnh Gói Combo</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                          {comboImages.length} ảnh
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tải ảnh combo từ máy hoặc dán URL. Admin có thể kéo/chọn ảnh đại diện chính, sắp xếp thứ tự và sửa Alt text.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm bg-amber-600 hover:bg-amber-700 text-ink-950 cursor-pointer transition-all shadow-sm">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingImage ? 'Đang tải lên...' : 'Tải ảnh từ máy'}</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          disabled={uploadingImage}
                          onChange={(e) => handleUploadImageFile(e, 'combos')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Thêm từ URL */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Dán đường dẫn ảnh: /images/combos/... hoặc https://..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddImageUrl('combos')}
                      className="px-3 py-1.5 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                    >
                      Thêm URL
                    </button>
                  </div>

                  {/* Danh sách ảnh trong Gallery Combo */}
                  {comboImages.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                      Chưa có hình ảnh nào cho combo. Bấm &quot;Tải ảnh từ máy&quot; để thêm ảnh cho combo này.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {comboImages.map((img, idx) => {
                        const isThumb = editingCombo.image === img.url;
                        return (
                          <div
                            key={img.id || img.url || idx}
                            className={`p-2.5 rounded-xl bg-slate-900 border transition-all flex flex-col gap-2 ${
                              isThumb
                                ? 'border-amber-500/80 shadow-md shadow-amber-950/40 bg-amber-950/10'
                                : 'border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="relative aspect-[4/3] w-full rounded-lg bg-slate-950 border border-slate-800/80 overflow-hidden flex items-center justify-center">
                              {img.url ? (
                                <Image
                                  src={img.url}
                                  alt={img.alt || 'Ảnh combo'}
                                  fill
                                  className="object-contain p-1"
                                  unoptimized
                                />
                              ) : null}

                              {isThumb && (
                                <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[11px] bg-amber-600 text-white shadow-sm flex items-center gap-1">
                                  <Star className="w-2.5 h-2.5 fill-white" />
                                  <span>Ảnh chính</span>
                                </span>
                              )}

                              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-900/90 text-slate-300 border border-slate-700">
                                #{idx + 1}
                              </span>
                            </div>

                            <input
                              type="text"
                              value={img.alt || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setComboImages((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, alt: val } : item))
                                );
                              }}
                              placeholder="Mô tả ảnh combo..."
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                            />

                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/60">
                              <div className="flex items-center gap-1">
                                {!isThumb && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingCombo({ ...editingCombo, image: img.url })}
                                    className="px-2 py-1 rounded text-[11px] bg-slate-800 hover:bg-amber-600 hover:text-white text-slate-300 transition-all flex items-center gap-1 cursor-pointer"
                                    title="Chọn làm ảnh combo chính"
                                  >
                                    <Star className="w-3 h-3 text-amber-400" />
                                    <span>Đặt làm ảnh chính</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveComboImage(idx, 'up')}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title="Chuyển lên trước"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === comboImages.length - 1}
                                  onClick={() => handleMoveComboImage(idx, 'down')}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title="Chuyển xuống sau"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteComboImage(idx)}
                                className="p-1 rounded bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all cursor-pointer"
                                title="Xóa ảnh này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Mô tả chi tiết */}
                <div className="sm:col-span-2">
                  <label className="block text-sm text-slate-300 mb-1">
                    Mô Tả & Danh Sách Chai Trong Gói
                  </label>
                  <textarea
                    rows={3}
                    value={editingCombo.description || ''}
                    onChange={(e) => setEditingCombo({ ...editingCombo, description: e.target.value })}
                    placeholder="VD: 5 Sữa Hạt Sen + 5 Sữa Gạo Lứt..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  ></textarea>
                </div>
              </div>

              {/* Thuộc tính hiển thị */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <p className="text-sm text-slate-300">Thuộc tính hiển thị</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingCombo.is_active)}
                      onChange={(e) =>
                        setEditingCombo({ ...editingCombo, is_active: e.target.checked })
                      }
                      className="accent-emerald-600 rounded"
                    />
                    <span>Kích hoạt bán</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingCombo.is_featured)}
                      onChange={(e) =>
                        setEditingCombo({ ...editingCombo, is_featured: e.target.checked })
                      }
                      className="accent-amber-600 rounded"
                    />
                    <span>Gói nổi bật ⭐</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingCombo.is_best_seller)}
                      onChange={(e) =>
                        setEditingCombo({ ...editingCombo, is_best_seller: e.target.checked })
                      }
                      className="accent-rose-600 rounded"
                    />
                    <span>Gói bán chạy 🔥</span>
                  </label>
                </div>
              </div>

              {/* Số đã bán ở kênh ngoài website — hiển thị "Hơn N sản phẩm đã được bán" ở trang chi tiết */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <p className="text-sm text-slate-300">Đã bán ngoài website (tổng cộng)</p>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={editingCombo.sold_offset ?? 0}
                  onChange={(e) =>
                    setEditingProduct({ ...editingCombo, sold_offset: Math.max(0, parseInt(e.target.value, 10) || 0) })
                  }
                  className="w-full sm:w-64 bg-slate-950 border border-slate-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500">
                  Nhập số lượng thật đã bán ở cửa hàng/đại lý/kênh khác. Website tự cộng thêm đơn đặt trên web và chỉ hiện khi tổng từ 10 trở lên.
                </p>
              </div>

              {/* Modal Footer */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsComboModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-sm bg-amber-600 hover:bg-amber-700 text-ink-950 shadow-lg shadow-amber-900/30 transition-all cursor-pointer flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingCombo.id ? 'Cập Nhật Combo' : 'Tạo Combo Mới'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TẠO / SỬA BANNER */}
      {/* ======================================================== */}
      {isBannerModalOpen && editingBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>{editingBanner.id ? 'Chỉnh Sửa Banner' : 'Thêm Banner Mới'}</span>
              </h3>
              <button
                onClick={() => setIsBannerModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBanner} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-3">
                {/* Vị trí hiển thị */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Vị trí hiển thị (Placement) *</label>
                  <select
                    value={editingBanner.placement || 'hero'}
                    onChange={(e) => setEditingBanner({ ...editingBanner, placement: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="hero">Hero Banner (Đầu trang chủ)</option>
                    <option value="scroll">Scroll Showcase Banner (Cuộn giới thiệu sản phẩm)</option>
                    <option value="promo">Khuyến mãi / Khác</option>
                  </select>
                </div>

                {/* Tiêu đề */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Tiêu đề Banner</label>
                  <input
                    type="text"
                    value={editingBanner.title || ''}
                    onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                    placeholder="Ví dụ: UỐNG MỘT BỮA ĂN NGON LÀNH"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Tag / Nhãn */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Nhãn / Tag nhỏ</label>
                  <input
                    type="text"
                    value={editingBanner.tag || ''}
                    onChange={(e) => setEditingBanner({ ...editingBanner, tag: e.target.value })}
                    placeholder="Ví dụ: Bản sắc & Tự nhiên"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Phụ đề (Subtitle) */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Mô tả / Phụ đề</label>
                  <textarea
                    rows={2}
                    value={editingBanner.subtitle || ''}
                    onChange={(e) => setEditingBanner({ ...editingBanner, subtitle: e.target.value })}
                    placeholder="Mô tả bổ sung xuất hiện bên dưới banner..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Hình ảnh */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-white">Hình Ảnh Banner *</label>
                    <label className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm bg-amber-600 hover:bg-amber-700 text-ink-950 cursor-pointer transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingImage ? 'Đang tải...' : 'Tải ảnh từ máy'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImage}
                        onChange={(e) => handleUploadImageFile(e, 'banners')}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <input
                    type="text"
                    value={editingBanner.image || ''}
                    onChange={(e) => setEditingBanner({ ...editingBanner, image: e.target.value })}
                    placeholder="/images/banners/... hoặc https://..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                  />

                  {editingBanner.image && (
                    <div className="relative aspect-[16/9] w-full rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
                      <Image
                        src={editingBanner.image}
                        alt="Preview"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                </div>

                {/* Đường link liên kết */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Đường dẫn khi click (Link)</label>
                  <input
                    type="text"
                    value={editingBanner.link || ''}
                    onChange={(e) => setEditingBanner({ ...editingBanner, link: e.target.value })}
                    placeholder="/#san-pham hoặc /combo"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                {/* Thứ tự và Kích hoạt */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Thứ tự ưu tiên</label>
                    <input
                      type="number"
                      value={editingBanner.sort_order || 0}
                      onChange={(e) => setEditingBanner({ ...editingBanner, sort_order: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingBanner.is_active)}
                        onChange={(e) => setEditingBanner({ ...editingBanner, is_active: e.target.checked })}
                        className="accent-amber-600 rounded"
                      />
                      <span>Kích hoạt hiển thị</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBannerModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-sm bg-amber-600 hover:bg-amber-700 text-ink-950 shadow-lg shadow-amber-900/30 transition-all cursor-pointer flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingBanner.id ? 'Cập Nhật Banner' : 'Tạo Banner Mới'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CHỈNH SỬA BRAND SLIDE */}
      {/* ======================================================== */}
      {isSlideModalOpen && editingSlide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Chỉnh Sửa Slide Thương Hiệu (Về Chúng Tôi)</span>
              </h3>
              <button
                onClick={() => setIsSlideModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlide} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-3">
                {/* Tag */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Tag / Phân loại *</label>
                  <input
                    type="text"
                    required
                    value={editingSlide.tag || ''}
                    onChange={(e) => setEditingSlide({ ...editingSlide, tag: e.target.value })}
                    placeholder="Ví dụ: Nguyên liệu, Sản xuất, Hương vị, Gia đình"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Tiêu đề */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Tiêu đề Slide *</label>
                  <textarea
                    rows={2}
                    required
                    value={editingSlide.title || ''}
                    onChange={(e) => setEditingSlide({ ...editingSlide, title: e.target.value })}
                    placeholder="Ví dụ: NGUYÊN LIỆU&#10;CHỌN LỌC"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Mô tả chi tiết */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Nội dung câu chuyện *</label>
                  <textarea
                    rows={3}
                    required
                    value={editingSlide.description || ''}
                    onChange={(e) => setEditingSlide({ ...editingSlide, description: e.target.value })}
                    placeholder="Mô tả câu chuyện thương hiệu..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Hình ảnh Slide */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-white">Hình Ảnh Slide (Tỉ lệ 3:4 hoặc 490x740) *</label>
                    <label className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm bg-amber-600 hover:bg-amber-700 text-ink-950 cursor-pointer transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingImage ? 'Đang tải...' : 'Tải ảnh từ máy'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImage}
                        onChange={(e) => handleUploadImageFile(e, 'slides')}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <input
                    type="text"
                    required
                    value={editingSlide.image || ''}
                    onChange={(e) => setEditingSlide({ ...editingSlide, image: e.target.value })}
                    placeholder="/images/banners/490x740-SGL.jpg"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                  />

                  {editingSlide.image && (
                    <div className="relative aspect-[3/4] max-w-[200px] mx-auto rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
                      <Image
                        src={editingSlide.image}
                        alt="Preview Slide"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                </div>

                {/* CTA Nút bấm & Liên kết */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Chữ trên nút (CTA)</label>
                    <input
                      type="text"
                      value={editingSlide.cta_text || 'Khám phá Thái Sơn'}
                      onChange={(e) => setEditingSlide({ ...editingSlide, cta_text: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Liên kết nút (Link)</label>
                    <input
                      type="text"
                      value={editingSlide.cta_link || '/#san-pham'}
                      onChange={(e) => setEditingSlide({ ...editingSlide, cta_link: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSlideModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-sm bg-amber-600 hover:bg-amber-700 text-ink-950 shadow-lg shadow-amber-900/30 transition-all cursor-pointer flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Lưu Thay Đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CHI TIẾT ĐƠN HÀNG */}
      {/* ======================================================== */}
      {isOrderDetailModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[1001] bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-forest-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg text-white">
                    Đơn Hàng #{selectedOrder.order_code}
                  </h2>
                  {(() => {
                    const st = statusMap[selectedOrder.status] || statusMap['PENDING'];
                    return (
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] border ${st.bg}`}>
                        {st.label}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ngày đặt:{' '}
                  {new Date(selectedOrder.created_at).toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <button
                onClick={() => setIsOrderDetailModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Customer Info Card */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <h4 className="text-sm text-emerald-400 uppercase tracking-wider">
                    Thông Tin Khách Hàng
                  </h4>
                  <a
                    href={`tel:${selectedOrder.phone}`}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Gọi {selectedOrder.phone}</span>
                  </a>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Họ và tên:</span>{' '}
                    <span className="text-slate-100 text-[1.125em]">{selectedOrder.full_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Số điện thoại:</span>{' '}
                    <span className="font-mono text-slate-100 text-[1.125em]">{selectedOrder.phone}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400">Địa chỉ giao hàng:</span>{' '}
                    <span className="text-slate-200">
                      {[selectedOrder.address, selectedOrder.ward, selectedOrder.district, selectedOrder.province]
                        .filter((p) => p && p.trim() && p !== 'Đặt hàng nhanh' && p !== 'Chưa cập nhật')
                        .join(', ') || selectedOrder.address}
                    </span>
                  </div>

                  {/* Tọa độ GPS & Liên kết mở bản đồ giao hàng an toàn */}
                  <div className="sm:col-span-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                    {(() => {
                      const hasValidCoords =
                        typeof selectedOrder.latitude === 'number' &&
                        typeof selectedOrder.longitude === 'number' &&
                        Number.isFinite(selectedOrder.latitude) &&
                        Number.isFinite(selectedOrder.longitude) &&
                        selectedOrder.latitude >= -90 &&
                        selectedOrder.latitude <= 90 &&
                        selectedOrder.longitude >= -180 &&
                        selectedOrder.longitude <= 180;

                      if (hasValidCoords) {
                        const lat = selectedOrder.latitude!;
                        const lng = selectedOrder.longitude!;
                        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${lat},${lng}`
                        )}`;
                        const osmUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(
                          lat
                        )}&mlon=${encodeURIComponent(lng)}#map=17/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}`;

                        return (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-slate-400">Vị trí giao hàng:</span>
                              <span className="font-mono text-emerald-400 text-[1.125em]">
                                {lat.toFixed(5)}, {lng.toFixed(5)}
                              </span>
                              {selectedOrder.location_confirmed ? (
                                <span className="px-2 py-0.5 rounded-md text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  ✓ Đã xác nhận ghim trên bản đồ
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  📍 Tọa độ ước tính / gợi ý
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={googleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[12px] border border-emerald-500/30 transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Mở Google Maps</span>
                              </a>
                              <a
                                href={osmUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[12px] border border-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>OpenStreetMap</span>
                              </a>
                            </div>
                          </>
                        );
                      }

                      return (
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
                          <span>Chưa có tọa độ GPS (Giao theo địa chỉ chữ viết)</span>
                        </div>
                      );
                    })()}
                  </div>
                  {selectedOrder.note && (
                    <div className="sm:col-span-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                      <span className="text-[1.125em]">Ghi chú của khách:</span> {selectedOrder.note}
                    </div>
                  )}
                  <div className="sm:col-span-2 pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-slate-400">Chi nhánh xử lý:</span>{' '}
                      <span className="text-amber-300 text-[1.125em]">
                        {storeList.find((s) => s.code === selectedOrder.store_code)?.name ||
                          selectedOrder.store_code ||
                          'Chưa gán (Tự động CH1)'}
                      </span>
                      {selectedOrder.store_address && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{selectedOrder.store_address}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedOrder.inventory_deducted ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          ✓ Đã trừ kho hàng
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Chưa trừ kho
                          </span>
                          {selectedOrder.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              onClick={() => handleRequestStatusChange(selectedOrder, 'CONFIRMED')}
                              className="px-2.5 py-1 rounded-lg text-[12px] bg-amber-600 hover:bg-amber-700 text-ink-950 shadow-sm transition-colors cursor-pointer"
                            >
                              Xác nhận xuất kho ngay
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items List */}
              <div className="space-y-3">
                <h4 className="text-sm text-slate-300 uppercase tracking-wider">
                  Sản Phẩm Đã Đặt
                </h4>
                <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/80">
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((item, idx) => (
                      <div key={item.id || idx} className="p-3 bg-slate-950/40 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 relative overflow-hidden shrink-0">
                          {item.thumbnail ? (
                            <Image
                              src={item.thumbnail}
                              alt={item.name}
                              fill
                              className="object-contain p-1"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-100 truncate">{item.name}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <p className="text-[11px] text-slate-400">
                              {formatVND(item.price)} × {item.quantity} {item.unit}
                            </p>
                            {(item as any).total_bottles && (item as any).total_bottles > 0 && (
                              <span className="text-[11px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                                📦 Xuất kho: {(item as any).total_bottles} chai
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-emerald-400">
                            {formatVND(item.price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      {selectedOrder.item_count || 1} món hàng trong đơn
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Tiền hàng:</span>
                  <span className="text-slate-200 text-[1.125em]">
                    {formatVND(selectedOrder.subtotal || selectedOrder.total)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Phí giao hàng:</span>
                  <span className="text-slate-200 text-[1.125em]">
                    {formatVND(selectedOrder.shipping_fee || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Phương thức:</span>
                  <span className="uppercase text-slate-200 text-[1.125em]">
                    {selectedOrder.payment_method}
                  </span>
                </div>
                {selectedOrder.payment_method === 'cod' && (
                  <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-900">
                    <span>Đối soát tiền COD:</span>
                    {selectedOrder.cod_reconciled ? (
                      <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[12px]">
                        ✓ Đã thu {formatVND(selectedOrder.cod_collected_amount || selectedOrder.total)}
                      </span>
                    ) : (
                      <span className="text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[12px]">
                        ⏳ Chờ thu tiền mặt
                      </span>
                    )}
                  </div>
                )}
                {selectedOrder.status === 'CANCELLED' && selectedOrder.return_disposition && (
                  <div className="p-2.5 bg-red-950/40 border border-red-900/50 rounded-xl space-y-1 mt-1 text-[11px]">
                    <div className="flex justify-between text-red-300">
                      <span className="text-[1.125em]">Lý do hủy/hoàn:</span>
                      <span>{selectedOrder.return_reason || 'Không rõ'}</span>
                    </div>
                    <div className="flex justify-between text-red-300">
                      <span className="text-[1.125em]">Xử lý tồn kho:</span>
                      <span className={selectedOrder.return_disposition === 'restocked' ? 'text-emerald-400' : 'text-amber-300'}>
                        {selectedOrder.return_disposition === 'restocked' ? '✓ Đã nhập lại kho' : '⚠️ Ghi nhận hủy/hư hỏng'}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-base text-white pt-2 border-t border-slate-800">
                  <span>Tổng tiền thanh toán:</span>
                  <span className="text-emerald-400 text-base">
                    {formatVND(selectedOrder.total)}
                  </span>
                </div>
                {selectedOrder.payment_method === 'cod' && !selectedOrder.cod_reconciled && selectedOrder.status === 'COMPLETED' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleReconcileCod(selectedOrder.id, selectedOrder.total)}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận đã thu COD ({formatVND(selectedOrder.total)})</span>
                  </button>
                )}
                {/* Thanh toán chuyển khoản (đơn không phải COD) */}
                {selectedOrder.payment_method !== 'cod' && selectedOrder.status !== 'CANCELLED' && (
                  <div className="mt-2 pt-2 border-t border-slate-900 space-y-2">
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Thanh toán chuyển khoản:</span>
                      {selectedOrder.payment_status === 'PAID' ? (
                        <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[12px]">
                          ✓ Đã nhận · GD: {selectedOrder.payment_reference || '—'}
                        </span>
                      ) : (
                        <span className="text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[12px]">
                          ⏳ Chưa xác nhận
                        </span>
                      )}
                    </div>
                    {selectedOrder.payment_status !== 'PAID' &&
                      (hasPermission(currentUser, 'cod.reconcile') || hasPermission(currentUser, 'orders.update_status_all')) && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={paymentRefInput}
                            onChange={(e) => setPaymentRefInput(e.target.value)}
                            maxLength={100}
                            placeholder="Mã giao dịch ngân hàng..."
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            disabled={actionLoading || !paymentRefInput.trim()}
                            onClick={() => handleConfirmPayment(selectedOrder.id)}
                            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Xác nhận đã nhận tiền</span>
                          </button>
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Chuyển đơn sang chi nhánh khác (Chỉ SUPER_ADMIN khi đơn PENDING) */}
              {hasPermission(currentUser, 'orders.transfer') && selectedOrder.status === 'PENDING' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-leaf-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm text-leaf-300">
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Chuyển đơn sang chi nhánh khác</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tự động kiểm tra tồn kho chi nhánh đích, nhả giữ chỗ kho cũ và chuyển giữ chỗ kho mới
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={transferTargetStore}
                      onChange={(e) => setTransferTargetStore(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-leaf-500 cursor-pointer"
                    >
                      <option value="">-- Chọn chi nhánh đích --</option>
                      {storeList
                        .filter((s) => s.code !== selectedOrder.store_code)
                        .map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!transferTargetStore || isTransferringOrder}
                      onClick={() => handleTransferOrderStore(selectedOrder.id, transferTargetStore)}
                      className="px-3.5 py-2 rounded-xl text-sm bg-leaf-600 hover:bg-leaf-700 disabled:opacity-50 text-ink-950 shadow-md shadow-leaf-950/40 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {isTransferringOrder ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      )}
                      <span>Chuyển kho</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Status Update Quick Action */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-200">Cập nhật trạng thái đơn</p>
                  <p className="text-[11px] text-slate-400">Thay đổi và lưu vào CSDL WebTSF</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedOrder.status}
                    onChange={(e) =>
                      handleRequestStatusChange(selectedOrder, e.target.value as Order['status'])
                    }
                    className="bg-slate-950 border border-slate-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="PENDING">Chờ xử lý</option>
                    <option value="CONFIRMED">Đã xác nhận</option>
                    <option value="PROCESSING">Đang chuẩn bị hàng</option>
                    <option value="SHIPPING">Đang giao hàng</option>
                    <option value="COMPLETED">Hoàn tất thành công</option>
                    <option value="CANCELLED">Đã hủy đơn</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <Printer className="w-4 h-4 text-slate-400" />
                <span>In Hóa Đơn</span>
              </button>
              <button
                onClick={() => setIsOrderDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: THÊM / SỬA DANH MỤC */}
      {/* ======================================================== */}
      {isCategoryModalOpen && editingCategory && (
        <div className="fixed inset-0 z-[1001] bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-forest-950 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg text-white">
                {editingCategory.id ? 'Chỉnh Sửa Danh Mục' : 'Thêm Danh Mục Mới'}
              </h2>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Tên danh mục *
                </label>
                <input
                  type="text"
                  required
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="Ví dụ: Nước Trái Cây Lên Men"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Đường dẫn (Slug)
                </label>
                <input
                  type="text"
                  value={editingCategory.slug}
                  onChange={(e) => setEditingCategory({ ...editingCategory, slug: e.target.value })}
                  placeholder="nuoc-trai-cay-len-men (tự động tạo nếu để trống)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30"
                >
                  {editingCategory.id ? 'Lưu Thay Đổi' : 'Tạo Danh Mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: XÁC NHẬN ĐỔI TRẠNG THÁI ĐƠN HÀNG */}
      {/* ======================================================== */}
      {pendingStatusChange && (
        <div className="fixed inset-0 z-[1005] bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-forest-950 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base text-white">Xác nhận đổi trạng thái</h3>
                  <p className="text-[11px] text-slate-400">Đơn hàng #{pendingStatusChange.orderCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingStatusChange(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Bạn có chắc chắn muốn chuyển trạng thái đơn hàng của khách hàng{' '}
                <span className="text-white text-[1.125em]">{pendingStatusChange.customerName}</span>?
              </p>

              {/* Status Comparison */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex-1 text-center">
                  <span className="block text-[11px] uppercase text-slate-400 mb-1">Hiện tại</span>
                  {(() => {
                    const cur = statusMap[pendingStatusChange.currentStatus] || statusMap['PENDING'];
                    return (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm border ${cur.bg}`}>
                        {cur.label}
                      </span>
                    );
                  })()}
                </div>

                <div className="text-slate-500 text-base">➔</div>

                <div className="flex-1 text-center">
                  <span className="block text-[11px] uppercase text-slate-400 mb-1">Chuyển sang</span>
                  {(() => {
                    const next = statusMap[pendingStatusChange.newStatus] || statusMap['PENDING'];
                    return (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm border ${next.bg}`}>
                        {next.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {['CONFIRMED', 'PROCESSING', 'SHIPPING', 'COMPLETED'].includes(pendingStatusChange.newStatus) && (
                <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                  <p className="flex items-center gap-1.5 text-amber-400 text-[1.125em]">
                    <PackageCheck className="w-4 h-4" />
                    <span>Lưu ý xuất kho chi nhánh:</span>
                  </p>
                  <p className="mt-1 text-slate-300 leading-relaxed">
                    Khi chuyển sang trạng thái <strong className="text-[1.125em]">{statusMap[pendingStatusChange.newStatus]?.label}</strong>, hệ thống sẽ tự động trừ hàng hoá thực tế từ kho cửa hàng xử lý đơn này (nếu chưa trừ) theo đúng số lượng chai vật lý.
                  </p>
                </div>
              )}
            </div>

            {/* Footer với 2 button: Hủy & Xác nhận */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/30 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setPendingStatusChange(null)}
                className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={async () => {
                  if (!pendingStatusChange) return;
                  const { orderId, newStatus } = pendingStatusChange;
                  await handleUpdateOrderStatus(orderId, newStatus);
                  setPendingStatusChange(null);
                }}
                className="px-4 py-2 rounded-xl text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-950/40 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              >
                {actionLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Xác nhận</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TẠO / SỬA TÀI KHOẢN ADMIN (SUPER ADMIN) */}
      {/* ======================================================== */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[1001] bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-forest-950 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-leaf-500/20 text-leaf-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg text-white">
                    {userModalMode === 'create' ? 'Tạo Tài Khoản Quản Trị Mới' : 'Chỉnh Sửa Tài Khoản Quản Trị'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {userModalMode === 'create'
                      ? 'Cấp quyền quản lý hệ thống cho nhân sự hoặc chi nhánh'
                      : `Cập nhật thông tin tài khoản: ${userFormData.username}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {/* Tên đăng nhập */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Tên đăng nhập (Username) *
                </label>
                <input
                  type="text"
                  required
                  disabled={userModalMode === 'edit'}
                  value={userFormData.username}
                  onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                  placeholder="VD: NH, TCH, quanly_ch..."
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-leaf-500 font-mono ${
                    userModalMode === 'edit' ? 'opacity-60 border-slate-800 cursor-not-allowed' : 'border-slate-700'
                  }`}
                />
                {userModalMode === 'edit' && (
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Không thể đổi username sau khi đã khởi tạo</span>
                )}
              </div>

              {/* Họ và tên hiển thị */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Họ và tên hiển thị *
                </label>
                <input
                  type="text"
                  required
                  value={userFormData.fullName}
                  onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                  placeholder="VD: Quản lý Cửa Hàng NH - Phú Thọ Hòa"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-leaf-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Email đăng nhập / liên hệ *
                </label>
                <input
                  type="email"
                  required
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="VD: nh@thaisonfoods.vn"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-leaf-500"
                />
              </div>

              {/* Mật khẩu */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  {userModalMode === 'create' ? 'Mật khẩu khởi tạo *' : 'Đổi mật khẩu mới (Bỏ trống nếu giữ nguyên)'}
                </label>
                <input
                  type="password"
                  required={userModalMode === 'create'}
                  minLength={8}
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder={userModalMode === 'create' ? 'Tối thiểu 8 ký tự, gồm chữ và số' : 'Nhập mật khẩu mới nếu muốn đổi...'}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-leaf-500"
                />
              </div>

              {/* Vai trò */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Phân quyền vai trò (Role) *
                </label>
                <select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-leaf-500 cursor-pointer"
                >
                  <option value="SUPER_ADMIN">Quản lý cấp cao (Super Admin - Toàn quyền hệ thống)</option>
                  <option value="MARKETING">Marketing (Quản lý sản phẩm, combo, danh mục, banner)</option>
                  <option value="STORE_STAFF">Nhân viên Cửa hàng (Quản lý tồn kho &amp; đơn hàng theo cửa hàng)</option>
                </select>
              </div>

              {/* Chọn cửa hàng phụ trách nếu là STORE_STAFF */}
              {userFormData.role === 'STORE_STAFF' && (
                <div>
                  <label className="block text-sm text-amber-400 mb-1">
                    Cửa hàng phụ trách (Bắt buộc) *
                  </label>
                  <select
                    required
                    value={userFormData.storeCode}
                    onChange={(e) => setUserFormData({ ...userFormData, storeCode: e.target.value })}
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    {storeList.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.name} ({st.code})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Tài khoản này chỉ có quyền xem/sửa đơn hàng và tồn kho thuộc cửa hàng đã chọn. Có thể tạo nhiều tài khoản cùng một cửa hàng.
                  </span>
                </div>
              )}

              {/* Trạng thái hoạt động */}
              {userModalMode === 'edit' && (
                <div className="pt-2">
                  <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.isActive}
                      onChange={(e) => setUserFormData({ ...userFormData, isActive: e.target.checked })}
                      className="accent-leaf-600 rounded w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[1.125em]">Cho phép tài khoản này đăng nhập hệ thống (Kích hoạt)</span>
                  </label>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-sm text-ink-950 bg-leaf-600 hover:bg-leaf-700 shadow-md shadow-leaf-950/40 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{userModalMode === 'create' ? 'Tạo Tài Khoản' : 'Lưu Thay Đổi'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* POP-UP: CẬP NHẬT SỐ LƯỢNG CHAI CHO MẶT HÀNG */}
      {/* ======================================================== */}
      {stockModalItem && (
        <div className="fixed inset-0 z-[1002] bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-forest-950 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Pop-up Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg text-white">Cập Nhật Số Lượng Chai</h2>
                  <p className="text-xs text-slate-400">
                    Chi nhánh: <span className="text-amber-400 text-[1.125em]">{storeList.find((s) => s.code === selectedStoreCode)?.name || selectedStoreCode}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockModalItem(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pop-up Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmStockUpdate();
              }}
              className="p-6 space-y-4"
            >
              {/* Product preview */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 relative overflow-hidden shrink-0 flex items-center justify-center p-1">
                  <Image
                    src={stockModalItem.thumbnail}
                    alt={stockModalItem.product_name}
                    fill
                    className="object-contain p-0.5"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm leading-snug line-clamp-2">
                    {stockModalItem.product_name}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-1">
                    SKU: <span className="text-amber-400 text-[1.125em]">{stockModalItem.sku}</span> • {stockModalItem.unit}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Số lượng hiện tại: <strong className="text-emerald-400 font-mono text-[1.125em]">{stockModalItem.current_stock} chai</strong>
                  </p>
                  {stockModalItem.updated_at ? (
                    <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>
                        Cập nhật lần cuối:{' '}
                        <strong className="text-slate-200 text-[1.125em]">
                          {new Date(stockModalItem.updated_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                          {new Date(stockModalItem.updated_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </strong>
                      </span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic mt-0.5">
                      Chưa cập nhật lần nào
                    </p>
                  )}
                </div>
              </div>

              {/* Number of bottles input */}
              <div>
                <label className="block text-sm text-slate-200 mb-1.5">
                  Nhập số chai tồn kho mới *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    required
                    autoFocus
                    value={stockModalItem.new_stock}
                    onChange={(e) =>
                      setStockModalItem({
                        ...stockModalItem,
                        new_stock: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    placeholder="Nhập số chai..."
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-4 py-3 text-2xl text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/40 font-mono shadow-inner"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 uppercase">
                    chai
                  </span>
                </div>
              </div>

              {/* Quick adjustment buttons */}
              <div>
                <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">Tăng / Giảm nhanh:</span>
                <div className="grid grid-cols-5 gap-2">
                  {[-10, -5, +5, +10, +50].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() =>
                        setStockModalItem({
                          ...stockModalItem,
                          new_stock: Math.max(0, stockModalItem.new_stock + delta),
                        })
                      }
                      className="py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer active:scale-95 transition-all text-center"
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons: Hủy & Xác nhận */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setStockModalItem(null)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-sm text-slate-950 bg-amber-500 hover:bg-amber-400 shadow-md shadow-amber-950/40 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Xác nhận</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CẬP NHẬT THÔNG TIN & ĐỊA CHỈ CỬA HÀNG */}
      {/* ======================================================== */}
      {isStoreAddressModalOpen && (
        <div className="fixed inset-0 z-[1003] bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-forest-950 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg text-white">Cập Nhật Địa Chỉ Cửa Hàng</h2>
                  <p className="text-xs text-slate-400 font-mono">Mã chi nhánh: {storeAddressForm.code}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStoreAddressModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveStoreAddress} className="p-6 space-y-4">
              {/* Tên hiển thị chi nhánh */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Tên hiển thị cửa hàng / chi nhánh *
                </label>
                <input
                  type="text"
                  required
                  value={storeAddressForm.name}
                  onChange={(e) => setStoreAddressForm({ ...storeAddressForm, name: e.target.value })}
                  placeholder="VD: Chi nhánh 1 (Tân Phú)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Địa chỉ chi tiết */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Địa chỉ chi tiết (Số nhà, tên đường, phường/xã, quận, TP) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={storeAddressForm.address}
                  onChange={(e) => setStoreAddressForm({ ...storeAddressForm, address: e.target.value })}
                  placeholder="VD: 472 - 474 Lê Trọng Tấn, P. Tây Thạnh, Q. Tân Phú, TP. HCM"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                />
              </div>

              {/* Hotline và Quận huyện */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Số điện thoại Hotline *
                  </label>
                  <input
                    type="text"
                    required
                    value={storeAddressForm.phone}
                    onChange={(e) => setStoreAddressForm({ ...storeAddressForm, phone: e.target.value })}
                    placeholder="02871000472"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Quận / Huyện *
                  </label>
                  <input
                    type="text"
                    required
                    value={storeAddressForm.district}
                    onChange={(e) => setStoreAddressForm({ ...storeAddressForm, district: e.target.value })}
                    placeholder="Tân Phú"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Tỉnh thành và Google Maps */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Tỉnh / Thành phố
                  </label>
                  <input
                    type="text"
                    value={storeAddressForm.province}
                    onChange={(e) => setStoreAddressForm({ ...storeAddressForm, province: e.target.value })}
                    placeholder="Hồ Chí Minh"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Link Google Maps (Tùy chọn)
                  </label>
                  <input
                    type="url"
                    value={storeAddressForm.map_url}
                    onChange={(e) => setStoreAddressForm({ ...storeAddressForm, map_url: e.target.value })}
                    placeholder="https://maps.google.com/?q=..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsStoreAddressModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-sm text-slate-950 bg-amber-500 hover:bg-amber-400 shadow-md shadow-amber-950/40 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Lưu Địa Chỉ Cửa Hàng</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CHI TIẾT KHÁCH HÀNG THÀNH VIÊN (CUSTOMER 360) */}
      {/* ======================================================== */}
      {isMemberDetailModalOpen && selectedMember && (
        <div className="fixed inset-0 z-[1002] bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-forest-950 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-400/30 flex items-center justify-center text-white text-base shadow-md">
                  {selectedMember.full_name ? selectedMember.full_name.slice(0, 2).toUpperCase() : 'KH'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg text-white">
                      {selectedMember.full_name || 'Khách hàng thành viên'}
                    </h2>
                    {selectedMember.is_active ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Hoạt động
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Tạm khóa
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    Mã TV: {selectedMember.id} &bull; Đăng ký ngày {new Date(selectedMember.created_at).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMemberDetailModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Grid 2 Cột: Thông tin cá nhân & Thống kê đơn */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Khối 1: Thông tin liên hệ & Địa chỉ */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <h3 className="text-sm uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" />
                    <span>Hồ Sơ Thành Viên</span>
                  </h3>

                  <div className="space-y-2 text-slate-300">
                    <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Email:</span>
                      <span className="text-white truncate max-w-[200px] text-[1.125em]">{selectedMember.email}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Điện thoại:</span>
                      <span className="font-mono text-emerald-400 text-[1.125em]">{selectedMember.phone || 'Chưa cung cấp'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Phương thức đăng ký:</span>
                      <span className="capitalize text-slate-200 text-[1.125em]">
                        {selectedMember.provider === 'google' ? 'Google OAuth' : selectedMember.provider === 'facebook' ? 'Facebook' : 'Email & Mật khẩu'}
                      </span>
                    </div>

                    <div className="py-1">
                      <span className="text-slate-400 block mb-1">Địa chỉ giao hàng mặc định:</span>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
                        {selectedMember.address ? (
                          <>
                            <p className="font-medium">{selectedMember.address}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {[selectedMember.ward, selectedMember.district, selectedMember.province].filter(Boolean).join(', ')}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-500 italic">Khách hàng chưa lưu sổ địa chỉ giao hàng</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Khối 2: Thống kê chi tiêu */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4" />
                      <span>Tổng Quan Chi Tiêu</span>
                    </h3>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block">Tổng số đơn</span>
                        <span className="text-xl text-white mt-0.5 block">{selectedMember.total_orders || 0}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block">Tổng tích lũy</span>
                        <span className="text-xl text-emerald-400 mt-0.5 block">{formatVND(selectedMember.total_spent || 0)}</span>
                      </div>
                    </div>

                    <div className="mt-3 p-3 rounded-lg bg-slate-900/40 border border-slate-800/80 text-slate-400 text-[11px] space-y-1">
                      <p>
                        Giá trị trung bình/đơn:{' '}
                        <strong className="text-white text-[1.125em]">
                          {selectedMember.total_orders > 0
                            ? formatVND(Math.round(selectedMember.total_spent / selectedMember.total_orders))
                            : '0 ₫'}
                        </strong>
                      </p>
                      {selectedMember.last_order_date && (
                        <p>
                          Đơn gần nhất:{' '}
                          <strong className="text-slate-300 text-[1.125em]">
                            {new Date(selectedMember.last_order_date).toLocaleDateString('vi-VN')}
                          </strong>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Nút hành động trạng thái tài khoản */}
                  <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleMemberStatus(selectedMember)}
                      className={`flex-1 py-2 px-3 rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        selectedMember.is_active
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{selectedMember.is_active ? 'Tạm khóa tài khoản' : 'Kích hoạt lại tài khoản'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Khối 3: Danh sách các đơn hàng đã đặt */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4 text-blue-400" />
                    <span>Lịch Sử Đơn Hàng ({memberOrders.length})</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">Tự động đồng bộ theo ID thành viên</span>
                </div>

                {memberDetailLoading ? (
                  <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Đang nạp lịch sử đơn hàng...</span>
                  </div>
                ) : memberOrders.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-slate-400">
                    <p className="font-medium text-slate-300">Khách hàng chưa có đơn hàng nào</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Các đơn hàng phát sinh sau khi đăng nhập sẽ hiển thị tại đây</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {memberOrders.map((ord: any) => {
                      const st = statusMap[ord.status] || statusMap['PENDING'];
                      return (
                        <div
                          key={ord.id}
                          className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                              <PackageCheck className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-white text-[1.125em]">#{ord.order_code}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[11px] border ${st.bg}`}>
                                  {st.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Ngày đặt: {new Date(ord.created_at).toLocaleString('vi-VN')} &bull; Thanh toán:{' '}
                                <span className="uppercase text-slate-300 text-[1.125em]">{ord.payment_method || 'COD'}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 block">Tổng tiền</span>
                              <span className="text-emerald-400 text-base">{formatVND(ord.total)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsMemberDetailModalOpen(false);
                                setActiveTab('orders');
                                setOrderSearch(ord.order_code);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[12px] transition-colors cursor-pointer"
                            >
                              Xem đơn
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsMemberDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: LỊCH SỬ BIẾN ĐỘNG TỒN KHO */}
      {/* ======================================================== */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-[1001] bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-forest-950 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg text-white flex items-center gap-2">
                    <span>Lịch Sử Biến Động Tồn Kho</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                      {selectedStoreCode}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ghi nhận từng giao dịch nhập kho, giữ chỗ khi đặt đơn, trừ kho thật khi duyệt và nhả chỗ khi hủy/chuyển đơn
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchInventoryLogs(selectedStoreCode)}
                  disabled={logsLoading}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  title="Tải lại dữ liệu"
                >
                  <RefreshCw className={`w-4 h-4 text-amber-400 ${logsLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Table */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {logsLoading ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400 mb-2" />
                  <span>Đang tải lịch sử biến động kho...</span>
                </div>
              ) : inventoryLogs.length === 0 ? (
                <div className="p-12 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-slate-400">
                  <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="font-medium text-slate-300">Chưa có lịch sử biến động nào cho chi nhánh này</p>
                  <p className="text-xs text-slate-500 mt-1">Các lượt cập nhật kho hoặc đơn hàng mới sẽ tự động lưu vết tại đây</p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-3.5">Thời gian</th>
                          <th className="py-3 px-3.5">Mặt hàng</th>
                          <th className="py-3 px-3.5">Hành động</th>
                          <th className="py-3 px-3.5 text-center">Tồn thực tế</th>
                          <th className="py-3 px-3.5 text-center">Đang giữ</th>
                          <th className="py-3 px-3.5">Người thực hiện / Đơn</th>
                          <th className="py-3 px-3.5">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {inventoryLogs.map((log) => {
                          const actionConfig: Record<string, { label: string; bg: string; text: string }> = {
                            manual_update: { label: 'Chỉnh sửa kho', bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
                            order_reserved: { label: 'Đặt đơn giữ chỗ', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' },
                            order_confirmed: { label: 'Xác nhận trừ kho', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
                            order_cancelled: { label: 'Hủy đơn nhả kho', bg: 'bg-leaf-500/10 border-leaf-500/30', text: 'text-leaf-400' },
                            order_transferred_out: { label: 'Chuyển đi kho khác', bg: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-400' },
                            order_transferred_in: { label: 'Nhận chuyển từ kho khác', bg: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-400' },
                            reservation_expired: { label: 'Quá hạn nhả chỗ', bg: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-400' },
                          };
                          const act = actionConfig[log.change_type] || {
                            label: log.change_type,
                            bg: 'bg-slate-800 border-slate-700',
                            text: 'text-slate-300',
                          };

                          return (
                            <tr key={log.id} className="hover:bg-slate-900/60 transition-colors">
                              <td className="py-3 px-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                                {new Date(log.created_at).toLocaleString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                              </td>
                              <td className="py-3 px-3.5">
                                <div className="text-slate-100 max-w-[180px] truncate text-[1.125em]" title={log.product_name}>
                                  {log.product_name || log.product_id}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {log.unit || '1 chai'}
                                </div>
                              </td>
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${act.bg} ${act.text}`}>
                                  {act.label}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 text-center font-mono whitespace-nowrap">
                                <span className="text-slate-400">{log.old_stock}</span>
                                <span className="text-slate-600 mx-1">→</span>
                                <span className={`${log.new_stock > log.old_stock ? 'text-emerald-400' : log.new_stock < log.old_stock ? 'text-rose-400' : 'text-slate-200'}`}>
                                  {log.new_stock}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 text-center font-mono whitespace-nowrap">
                                <span className="text-slate-400">{log.old_reserved}</span>
                                <span className="text-slate-600 mx-1">→</span>
                                <span className={`${log.new_reserved > log.old_reserved ? 'text-amber-400' : log.new_reserved < log.old_reserved ? 'text-leaf-400' : 'text-slate-400'}`}>
                                  {log.new_reserved}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 text-[11px]">
                                <p className="font-medium text-slate-200">{log.actor || 'Hệ thống'}</p>
                                {log.order_id && (
                                  <p className="text-[10px] font-mono text-emerald-400 truncate max-w-[120px]" title={log.order_id}>
                                    Đơn #{log.order_id.slice(0, 8)}
                                  </p>
                                )}
                              </td>
                              <td className="py-3 px-3.5 text-[11px] text-slate-400 max-w-[200px] truncate" title={log.note || ''}>
                                {log.note || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">
                Hiển thị {inventoryLogs.length} bản ghi gần nhất
              </span>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CHI TIẾT NHẬT KÝ HOẠT ĐỘNG (AUDIT LOG DIFF) */}
      {/* ======================================================== */}
      {isAuditModalOpen && selectedAuditLog && (
        <div className="fixed inset-0 z-[1001] bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-forest-950 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-leaf-500/10 border border-leaf-500/20 flex items-center justify-center text-leaf-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg text-white flex items-center gap-2">
                    <span>Chi Tiết Nhật Ký Hoạt Động</span>
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-leaf-400 border border-slate-700">
                      ID #{selectedAuditLog.id}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>{new Date(selectedAuditLog.created_at).toLocaleString('vi-VN')}</span>
                    {selectedAuditLog.store_code && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-400 text-[1.125em]">Chi nhánh: {selectedAuditLog.store_code}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[11px] text-slate-400 font-medium mb-1">Người thực hiện</div>
                  <div className="text-sm text-white flex items-center gap-1.5">
                    <span>{selectedAuditLog.admin_username}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-leaf-950/80 text-leaf-300 border border-leaf-800/50">
                      {selectedAuditLog.role}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[11px] text-slate-400 font-medium mb-1">Hành động</div>
                  <div className="text-sm font-mono text-emerald-400">
                    {selectedAuditLog.action}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[11px] text-slate-400 font-medium mb-1">Đối tượng (Entity)</div>
                  <div className="text-xs font-medium text-slate-300 flex items-center gap-1 truncate">
                    <span className="text-amber-400 text-[1.125em]">{selectedAuditLog.entity_type}</span>
                    {selectedAuditLog.entity_id && (
                      <span className="text-slate-400 font-mono text-[11px]">#{selectedAuditLog.entity_id}</span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[11px] text-slate-400 font-medium mb-1">IP & Thiết bị</div>
                  <div className="text-xs font-mono text-slate-300 truncate" title={selectedAuditLog.user_agent || ''}>
                    {selectedAuditLog.ip || '—'}
                  </div>
                </div>
              </div>

              {/* JSON Diff (Before vs After) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Before JSON */}
                <div className="flex flex-col rounded-xl bg-slate-950 border border-rose-900/30 overflow-hidden">
                  <div className="px-4 py-2.5 bg-rose-950/20 border-b border-rose-900/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="text-sm text-rose-300">Dữ liệu Trước (Before)</span>
                    </div>
                    {selectedAuditLog.before_json && (
                      <button
                        type="button"
                        onClick={() => {
                          const text = typeof selectedAuditLog.before_json === 'string'
                            ? selectedAuditLog.before_json
                            : JSON.stringify(selectedAuditLog.before_json, null, 2);
                          navigator.clipboard.writeText(text);
                          setCopiedField('before');
                          setTimeout(() => setCopiedField(null), 2000);
                        }}
                        className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedField === 'before' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'before' ? 'Đã chép' : 'Sao chép'}</span>
                      </button>
                    )}
                  </div>
                  <div className="p-4 flex-1 overflow-x-auto max-h-[360px]">
                    <pre className="text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap break-all">
                      {selectedAuditLog.before_json
                        ? (typeof selectedAuditLog.before_json === 'string'
                            ? (() => {
                                try { return JSON.stringify(JSON.parse(selectedAuditLog.before_json), null, 2); }
                                catch { return selectedAuditLog.before_json; }
                              })()
                            : JSON.stringify(selectedAuditLog.before_json, null, 2))
                        : '<Không có dữ liệu trước thay đổi (Tạo mới hoặc không áp dụng)>'}
                    </pre>
                  </div>
                </div>

                {/* After JSON */}
                <div className="flex flex-col rounded-xl bg-slate-950 border border-emerald-900/30 overflow-hidden">
                  <div className="px-4 py-2.5 bg-emerald-950/20 border-b border-emerald-900/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-sm text-emerald-300">Dữ liệu Sau (After)</span>
                    </div>
                    {selectedAuditLog.after_json && (
                      <button
                        type="button"
                        onClick={() => {
                          const text = typeof selectedAuditLog.after_json === 'string'
                            ? selectedAuditLog.after_json
                            : JSON.stringify(selectedAuditLog.after_json, null, 2);
                          navigator.clipboard.writeText(text);
                          setCopiedField('after');
                          setTimeout(() => setCopiedField(null), 2000);
                        }}
                        className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedField === 'after' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'after' ? 'Đã chép' : 'Sao chép'}</span>
                      </button>
                    )}
                  </div>
                  <div className="p-4 flex-1 overflow-x-auto max-h-[360px]">
                    <pre className="text-[11px] font-mono text-emerald-200 leading-relaxed whitespace-pre-wrap break-all">
                      {selectedAuditLog.after_json
                        ? (typeof selectedAuditLog.after_json === 'string'
                            ? (() => {
                                try { return JSON.stringify(JSON.parse(selectedAuditLog.after_json), null, 2); }
                                catch { return selectedAuditLog.after_json; }
                              })()
                            : JSON.stringify(selectedAuditLog.after_json, null, 2))
                        : '<Không có dữ liệu sau thay đổi (Đã xóa hoặc không áp dụng)>'}
                    </pre>
                  </div>
                </div>
              </div>

              {/* User Agent Detailed view if long */}
              {selectedAuditLog.user_agent && (
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-[11px] text-slate-400">
                  <span className="text-slate-300 text-[1.125em]">Trình duyệt / Client: </span>
                  <span className="font-mono text-slate-400 break-all">{selectedAuditLog.user_agent}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="px-5 py-2 rounded-xl text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ĐỔI MẬT KHẨU (BẮT BUỘC HOẶC TỰ NGUYỆN) ==================== */}
      {isPasswordModalOpen && (
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md animate-in fade-in duration-200 ${
            currentUser?.mustChangePassword ? 'pointer-events-auto' : ''
          }`}
          onClick={(e) => {
            // Không cho đóng bằng cách click ngoài nếu bắt buộc đổi mật khẩu
            if (!currentUser?.mustChangePassword && e.target === e.currentTarget && !pwdLoading) {
              setIsPasswordModalOpen(false);
            }
          }}
        >
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl shadow-ink-950/90 overflow-hidden relative">
            {/* Modal Header */}
            <div className={`p-6 border-b ${currentUser?.mustChangePassword ? 'border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-rose-500/10' : 'border-slate-800 bg-slate-950/40'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${currentUser?.mustChangePassword ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                    {currentUser?.mustChangePassword ? <ShieldAlert className="w-6 h-6 text-amber-400" /> : <Key className="w-6 h-6 text-emerald-400" />}
                  </div>
                  <div>
                    <h3 className="text-lg text-white">
                      {currentUser?.mustChangePassword ? 'Bắt Buộc Đổi Mật Khẩu' : 'Đổi Mật Khẩu Quản Trị'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {currentUser?.mustChangePassword
                        ? 'Yêu cầu bảo mật cho lần đăng nhập đầu tiên'
                        : `Tài khoản: ${currentUser?.username || 'Admin'}`}
                    </p>
                  </div>
                </div>

                {/* Nút đóng: chỉ hiển thị nếu KHÔNG phải đổi bắt buộc */}
                {!currentUser?.mustChangePassword && (
                  <button
                    type="button"
                    disabled={pwdLoading}
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {currentUser?.mustChangePassword && (
                <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed">
                  ⚠️ Vì lý do an toàn bảo mật, tài khoản của bạn được đánh dấu bắt buộc phải cập nhật mật khẩu mới trước khi có thể truy cập các tính năng quản lý chi nhánh.
                </div>
              )}
            </div>

            {/* Modal Body */}
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {/* Error Message */}
              {pwdError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{pwdError}</span>
                </div>
              )}

              {/* Success Message */}
              {pwdSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{pwdSuccess}</span>
                </div>
              )}

              {/* Current Password */}
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">
                  Mật khẩu hiện tại <span className="text-rose-400">*</span>
                </label>
                <input
                  type={showPwdFields ? 'text' : 'password'}
                  required
                  disabled={pwdLoading}
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                />
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">
                  Mật khẩu mới <span className="text-rose-400">*</span>
                </label>
                <input
                  type={showPwdFields ? 'text' : 'password'}
                  required
                  disabled={pwdLoading}
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự (chữ & số)"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                />
                <p className="text-[10px] text-slate-400 mt-1">Độ dài tối thiểu 8 ký tự, bao gồm ít nhất 1 chữ cái và 1 chữ số.</p>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">
                  Xác nhận mật khẩu mới <span className="text-rose-400">*</span>
                </label>
                <input
                  type={showPwdFields ? 'text' : 'password'}
                  required
                  disabled={pwdLoading}
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                />
              </div>

              {/* Show/Hide password toggle */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setShowPwdFields(!showPwdFields)}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer text-[11px]"
                >
                  {showPwdFields ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPwdFields ? 'Ẩn ký tự mật khẩu' : 'Hiện ký tự mật khẩu'}</span>
                </button>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                {!currentUser?.mustChangePassword && (
                  <button
                    type="button"
                    disabled={pwdLoading}
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                )}
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-5 py-2.5 rounded-xl text-sm text-white bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-950/50 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {pwdLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang cập nhật...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Xác Nhận Đổi Mật Khẩu</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
