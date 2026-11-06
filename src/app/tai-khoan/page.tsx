'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  User,
  Package,
  MapPin,
  Phone,
  Mail,
  LogOut,
  Calendar,
  CheckCircle,
  Clock,
  Truck,
  ArrowRight,
  ShoppingBag,
  AlertCircle,
  Save,
  Star,
  MessageCircle,
  Heart,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Navigation,
} from 'lucide-react';
import { useUserAuth } from '@/context/UserAuthContext';
import WishlistPanel from '@/components/product/WishlistPanel';
import { useLanguage } from '@/context/LanguageContext';
import { cn, formatPrice, safeFetchJson } from '@/lib/utils';
import { removeKhuPho } from '@/lib/geo';
import {
  getProvinceNames,
  getDistrictsByProvince,
  getWardsByDistrict,
  findPreciseCoordinates,
} from '@/data/vietnam-addresses';
import LocationConfirmMapModal from '@/components/checkout/LocationConfirmMapModal';
import AddressSuggestionList from '@/components/checkout/AddressSuggestionList';
import { useAddressSearch } from '@/hooks/useAddressSearch';
import { sameAddressLine } from '@/lib/address/normalize';

/** Địa chỉ tại điểm ghim / GPS (kết quả reverse geocode) */
interface ProfilePinParts {
  street?: string;
  ward?: string;
  district?: string;
  province?: string;
  formatted?: string;
}

interface OrderItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  thumbnail?: string;
}

interface OrderRecord {
  id: string;
  order_code: string;
  full_name: string;
  phone: string;
  email?: string;
  address: string;
  province: string;
  district: string;
  ward: string;
  payment_method: string;
  shipping_fee: number;
  subtotal: number;
  total: number;
  status: string;
  created_at: string;
  items: OrderItem[];
}

interface UserReviewRecord {
  id: string;
  productId: string;
  variantInfo: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedBuyer: boolean;
  status: 'APPROVED' | 'PENDING' | 'HIDDEN';
  helpfulCount: number;
  adminReply?: string;
  adminRepliedAt?: string;
  createdAt: string;
}

const PAGE_SIZE = 5;

/** Bản đồ nhỏ xem trước vị trí giao hàng cố định (chạm để mở bản đồ lớn chỉnh ghim) */
function ProfileLocationPreview({
  coords,
  onOpen,
}: {
  coords: { lat: number; lng: number } | null;
  onOpen: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const coordsRef = useRef(coords);
  const pinLat = coords?.lat;
  const pinLng = coords?.lng;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      const start = coordsRef.current;
      const map = L.map(containerRef.current, {
        center: [start?.lat || 10.7769, start?.lng || 106.7009],
        zoom: start ? 17 : 12,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        attributionControl: true,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>' }).addTo(map);
      mapRef.current = map;
      setTimeout(() => !cancelled && mapRef.current?.invalidateSize(), 250);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Đổi vị trí: ghim nhảy tới chỗ mới
  useEffect(() => {
    coordsRef.current = pinLat !== undefined && pinLng !== undefined ? { lat: pinLat, lng: pinLng } : null;
    const map = mapRef.current;
    if (!map) return;
    if (pinLat !== undefined && pinLng !== undefined) {
      map.flyTo([pinLat, pinLng], 17, { duration: 0.6 });
    } else {
      map.setView([10.7769, 106.7009], 12);
    }
  }, [pinLat, pinLng]);

  return (
    <div className="relative w-full h-44 rounded-2xl border border-gray-200 overflow-hidden isolate z-0">
      <div ref={containerRef} onClick={onOpen} className="relative z-0 w-full h-full cursor-pointer" />
      {coords ? (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10">
          <MapPin className="w-8 h-8 text-forest-700 fill-white drop-shadow-md" />
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-sm text-forest-700 cursor-pointer"
        >
          Chạm để chấm ghim vị trí nhà bạn
        </button>
      )}
    </div>
  );
}

/** Dãy số trang rút gọn: 1 … 4 5 6 … 20 */
function buildPageList(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = Array.from(pages).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

function Pagination({
  page,
  totalItems,
  onChange,
  language,
}: {
  page: number;
  totalItems: number;
  onChange: (p: number) => void;
  language: string;
}) {
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  if (totalPages <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalItems);
  const btn =
    'min-w-9 h-9 px-2 inline-flex items-center justify-center rounded-xl border text-sm transition-colors cursor-pointer';
  return (
    <nav
      className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2"
      aria-label={language === 'en' ? 'Pagination' : 'Phân trang'}
    >
      <p className="text-xs text-gray-500">
        {language === 'en' ? `Showing ${from}-${to} of ${totalItems}` : `Hiển thị ${from}-${to} / ${totalItems}`}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className={cn(btn, 'border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed')}
          aria-label={language === 'en' ? 'Previous page' : 'Trang trước'}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {buildPageList(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-gray-400">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                btn,
                p === page
                  ? 'bg-emerald-800 border-emerald-800 text-white'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className={cn(btn, 'border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed')}
          aria-label={language === 'en' ? 'Next page' : 'Trang sau'}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, logout, updateProfile, openAuthModal } = useUserAuth();
  const { language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'orders' | 'profile' | 'reviews' | 'wishlist'>('orders');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const changeOrderPage = (p: number) => {
    setOrderPage(p);
    if (typeof window !== 'undefined') window.scrollTo({ top: 300, behavior: 'smooth' });
  };
  const changeReviewPage = (p: number) => {
    setReviewPage(p);
    if (typeof window !== 'undefined') window.scrollTo({ top: 300, behavior: 'smooth' });
  };
  const [userReviews, setUserReviews] = useState<UserReviewRecord[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    province: '',
    district: '',
    ward: '',
  });
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Vị trí giao hàng cố định (tọa độ) + gợi ý địa chỉ cho form hồ sơ.
  // Gợi ý dùng chung useAddressSearch với trang thanh toán: không tự chọn, không tự đổi chữ khách gõ, chọn xong thì hết gợi ý.
  const [profileCoords, setProfileCoords] = useState<{ lat: number; lng: number } | null>(null);
  // Khách vừa xác nhận ghim trên bản đồ cho địa chỉ đang sửa (server lưu xác nhận theo bản chụp địa chỉ + tọa độ)
  const [profilePinConfirmed, setProfilePinConfirmed] = useState(false);
  const [isLocatingProfile, setIsLocatingProfile] = useState(false);
  const [isProfileMapOpen, setIsProfileMapOpen] = useState(false);
  // Ghim/GPS cho ra địa chỉ khác chữ khách đã nhập: hỏi "Dùng địa chỉ này?", không tự đè
  const [profilePinReview, setProfilePinReview] = useState<ProfilePinParts | null>(null);
  const profileFormRef = useRef(profileForm);
  useEffect(() => {
    profileFormRef.current = profileForm;
  });

  const addr = useAddressSearch({
    getContext: () => ({ ward: profileForm.ward || undefined, district: profileForm.district || undefined }),
    onSelect: (sel) => {
      const s = sel.suggestion;
      setProfilePinReview(null);
      setProfileForm((prev) => ({
        ...prev,
        province: s.province || prev.province || 'TP. Hồ Chí Minh',
        district: s.district || prev.district,
        ward: s.ward ? removeKhuPho(s.ward) : prev.ward,
        address: sel.text,
      }));
      if (typeof s.lat === 'number' && typeof s.lng === 'number') setProfileCoords({ lat: s.lat, lng: s.lng });
      setProfilePinConfirmed(false);
    },
    onTextChange: (text) => {
      setProfileForm((prev) => ({ ...prev, address: text }));
      setProfilePinConfirmed(false);
    },
  });

  // Ghim còn đúng khi chữ trong ô vẫn là địa chỉ đã chốt (hoặc chỉ đổi số nhà trên cùng đường).
  // Khách gõ sang đường khác (stale) thì không lưu tọa độ cũ để khỏi lệch.
  const activeProfileCoords = profileCoords && addr.state.anchor !== 'stale' ? profileCoords : null;

  // Danh mục hành chính giống trang thanh toán (hiện chỉ giao tại TP. Hồ Chí Minh)
  const profileProvinces = getProvinceNames().filter((p) => p === 'TP. Hồ Chí Minh');
  const profileDistricts = getDistrictsByProvince(profileForm.province);
  const profileWards = getWardsByDistrict(profileForm.province, profileForm.district);

  // Điền địa chỉ tại ghim/GPS vào form (ô còn trống hoặc khách bấm "Dùng địa chỉ này")
  const applyProfilePin = (pin: ProfilePinParts) => {
    const street = pin.street ? removeKhuPho(pin.street) : profileFormRef.current.address;
    setProfileForm((prev) => ({
      ...prev,
      province: pin.province || prev.province || 'TP. Hồ Chí Minh',
      district: pin.district || prev.district,
      ward: pin.ward ? removeKhuPho(pin.ward) : prev.ward,
      address: street || prev.address,
    }));
    if (street) addr.controller.commitText(street, 'pin');
    setProfilePinReview(null);
  };

  // Đã có chữ thì giữ nguyên, chỉ điền ô hành chính còn trống; địa chỉ tại ghim khác chữ thì hỏi
  const reviewProfilePin = (pin: ProfilePinParts) => {
    const current = profileFormRef.current;
    const typed = current.address.trim();
    if (!typed) {
      applyProfilePin(pin);
      return;
    }
    setProfileForm((prev) => ({
      ...prev,
      province: prev.province || pin.province || '',
      district: prev.district || pin.district || '',
      ward: prev.ward || (pin.ward ? removeKhuPho(pin.ward) : ''),
    }));
    addr.controller.commitText(current.address, 'pin');
    const pinLine = pin.street ? removeKhuPho(pin.street) : '';
    setProfilePinReview(pinLine && !sameAddressLine(typed, pinLine) ? pin : null);
  };

  // Lấy vị trí GPS của thiết bị rồi điền địa chỉ (không đè chữ khách đã nhập)
  const handleProfileGPS = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setProfileMsg({ text: 'Trình duyệt không hỗ trợ định vị GPS.', type: 'error' });
      return;
    }
    setIsLocatingProfile(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setProfileCoords(c);
        setProfilePinConfirmed(false);
        try {
          const rev = await safeFetchJson<{ success: boolean; formattedAddress?: string; components?: ProfilePinParts }>(
            `/api/geo/reverse?lat=${c.lat}&lng=${c.lng}`
          );
          if (rev?.success && rev.components) reviewProfilePin({ ...rev.components, formatted: rev.formattedAddress });
        } catch {
          // vẫn giữ tọa độ GPS
        } finally {
          setIsLocatingProfile(false);
        }
      },
      () => {
        setIsLocatingProfile(false);
        setProfileMsg({
          text: 'Không lấy được vị trí GPS. Bạn hãy bật quyền vị trí hoặc chấm ghim trên bản đồ.',
          type: 'error',
        });
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Sync tab from query param if available
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'profile') {
      setActiveTab('profile');
    } else if (tabParam === 'orders') {
      setActiveTab('orders');
    } else if (tabParam === 'reviews') {
      setActiveTab('reviews');
    } else if (tabParam === 'wishlist') {
      setActiveTab('wishlist');
    }
  }, [searchParams]);

  // Populate profile form when user loads
  useEffect(() => {
    if (user) {
      setProfileForm({
        fullName: user.fullName || '',
        phone: user.phone || '',
        address: user.address || '',
        province: user.province || '',
        district: user.district || '',
        ward: user.ward || '',
      });
      // Địa chỉ đã lưu: không bật gợi ý cho đúng dòng đó; có tọa độ thì hiện ghim trên bản đồ
      if (user.address) addr.controller.commitText(user.address, 'saved');
      setProfileCoords(
        user.latitude && user.longitude ? { lat: Number(user.latitude), lng: Number(user.longitude) } : null
      );
    }
  }, [user]);

  // Load orders and reviews when authenticated
  useEffect(() => {
    if (user) {
      setIsLoadingOrders(true);
      safeFetchJson<{ success: boolean; orders: OrderRecord[] }>('/api/user/orders')
        .then((data) => {
          if (data?.success && Array.isArray(data.orders)) {
            setOrders(data.orders);
          }
        })
        .catch((err) => console.error('Error fetching orders:', err))
        .finally(() => setIsLoadingOrders(false));

      setIsLoadingReviews(true);
      safeFetchJson<{ success: boolean; reviews: any[] }>('/api/user/reviews')
        .then((data) => {
          if (data?.success && Array.isArray(data.reviews)) {
            setUserReviews(data.reviews);
          }
        })
        .catch((err) => console.error('Error fetching reviews:', err))
        .finally(() => setIsLoadingReviews(false));
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setIsSavingProfile(true);

    // Luôn gửi tọa độ hiện tại; null = đã đổi địa chỉ mà chưa ghim lại → xóa tọa độ cũ
    const res = await updateProfile({
      ...profileForm,
      latitude: activeProfileCoords ? activeProfileCoords.lat : null,
      longitude: activeProfileCoords ? activeProfileCoords.lng : null,
      pinConfirmed: !!activeProfileCoords && profilePinConfirmed,
    });
    setIsSavingProfile(false);

    if (res.success) {
      setProfileMsg({
        text: language === 'en' ? 'Profile updated successfully!' : 'Cập nhật thông tin thành công!',
        type: 'success',
      });
    } else {
      setProfileMsg({
        text: res.error || (language === 'en' ? 'Failed to update' : 'Không thể lưu thông tin'),
        type: 'error',
      });
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  // Loading indicator
  if (isLoading) {
    return (
      <div className="section-container py-20 text-center">
        <div className="w-12 h-12 border-3 border-forest-700/20 border-t-forest-700 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">
          {language === 'en' ? 'Loading account details...' : 'Đang tải thông tin tài khoản...'}
        </p>
      </div>
    );
  }

  // Guest view (not logged in)
  if (!user) {
    return (
      <div className="section-container py-16 md:py-24 text-center">
        <div className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
          <div className="w-20 h-20 bg-emerald-50 text-forest-700 rounded-full flex items-center justify-center mx-auto mb-5">
            <User className="w-10 h-10" />
          </div>
          <h1 className="text-2xl text-gray-900 font-heading mb-2">
            {language === 'en' ? 'Customer Account' : 'Tài Khoản Khách Hàng'}
          </h1>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            {language === 'en'
              ? 'Please sign in to view your orders, save delivery addresses, and enjoy faster checkout next time.'
              : 'Vui lòng đăng nhập để xem lịch sử đơn hàng, cập nhật địa chỉ giao hàng và trải nghiệm mua sắm nhanh hơn.'}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => openAuthModal('login')}
              className="w-full py-3.5 bg-forest-700 hover:bg-forest-800 text-white rounded-xl transition-all text-base shadow-xs cursor-pointer active:scale-[0.98]"
            >
              {language === 'en' ? 'Sign In' : 'Đăng nhập ngay'}
            </button>
            <button
              onClick={() => openAuthModal('register')}
              className="w-full py-3.5 bg-emerald-50 hover:bg-emerald-100/70 text-forest-700 rounded-xl transition-all text-base cursor-pointer"
            >
              {language === 'en' ? 'Register New Account' : 'Tạo tài khoản mới'}
            </button>
            <Link
              href="/"
              className="w-full py-3 text-gray-500 hover:text-gray-800 text-sm transition-colors mt-2"
            >
              ← {language === 'en' ? 'Continue Shopping as Guest' : 'Tiếp tục mua hàng không cần đăng nhập'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Format Status Badge
  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'COMPLETED' || s === 'DELIVERED') {
      return (
        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5" />
          {language === 'en' ? 'Completed' : 'Hoàn thành'}
        </span>
      );
    }
    if (s === 'PROCESSING' || s === 'SHIPPING') {
      return (
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1">
          <Truck className="w-3.5 h-3.5" />
          {language === 'en' ? 'Shipping' : 'Đang giao hàng'}
        </span>
      );
    }
    if (s === 'CANCELLED') {
      return (
        <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-sm flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          {language === 'en' ? 'Cancelled' : 'Đã hủy'}
        </span>
      );
    }
    return (
      <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" />
        {language === 'en' ? 'Pending' : 'Chờ xác nhận'}
      </span>
    );
  };

  return (
    <div className="section-container py-6 md:py-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-1.5 text-xs text-gray-500">
          <li>
            <Link href="/" className="hover:text-forest-700 transition-colors">
              {language === 'en' ? 'Home' : 'Trang chủ'}
            </Link>
          </li>
          <li>/</li>
          <li className="text-gray-900 text-[1.125em]">
            {language === 'en' ? 'My Account' : 'Tài khoản của tôi'}
          </li>
        </ol>
      </nav>

      {/* Account Header Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xs mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-forest-700 to-emerald-600 text-white flex items-center justify-center text-2xl shadow-sm">
            {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h1 className="text-2xl md:text-2xl text-gray-900 font-heading">
              {user.fullName}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                {user.email}
              </span>
              {user.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {user.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <Link
            href="/#san-pham"
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100/70 text-forest-700 rounded-xl text-sm transition-colors flex items-center gap-1.5"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{language === 'en' ? 'Shop More' : 'Mua sắm'}</span>
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2.5 bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-700 rounded-xl text-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{language === 'en' ? 'Log Out' : 'Đăng xuất'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Tabs & Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1 space-y-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={cn(
              'w-full flex items-center justify-between p-4 rounded-2xl text-base transition-all text-left cursor-pointer',
              activeTab === 'orders'
                ? 'bg-forest-700 text-white shadow-xs'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
            )}
          >
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5" />
              <span>{language === 'en' ? 'Order History' : 'Đơn hàng của tôi'}</span>
            </div>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-sm',
                activeTab === 'orders' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              )}
            >
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-2xl text-base transition-all text-left cursor-pointer',
              activeTab === 'profile'
                ? 'bg-forest-700 text-white shadow-xs'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
            )}
          >
            <User className="w-5 h-5" />
            <span>{language === 'en' ? 'Account Details' : 'Thông tin tài khoản'}</span>
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={cn(
              'w-full flex items-center justify-between p-4 rounded-2xl text-base transition-all text-left cursor-pointer',
              activeTab === 'reviews'
                ? 'bg-forest-700 text-white shadow-xs'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
            )}
          >
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5" />
              <span>{language === 'en' ? 'My Reviews' : 'Đánh giá của tôi'}</span>
            </div>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-sm',
                activeTab === 'reviews' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              )}
            >
              {userReviews.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('wishlist')}
            className={cn(
              'w-full flex items-center justify-between p-4 rounded-2xl text-base transition-all text-left cursor-pointer',
              activeTab === 'wishlist'
                ? 'bg-forest-700 text-white shadow-xs'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
            )}
          >
            <div className="flex items-center gap-3">
              <Heart className="w-5 h-5" />
              <span>{language === 'en' ? 'Wishlist' : 'Yêu thích'}</span>
            </div>
          </button>
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-3">
          {activeTab === 'orders' ? (
            /* TAB: ORDERS */
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl text-gray-900 font-heading">
                  {language === 'en' ? 'Your Orders' : 'Danh sách đơn hàng'}
                </h2>
                <span className="text-xs text-gray-500">
                  {orders.length} {language === 'en' ? 'orders placed' : 'đơn hàng đã đặt'}
                </span>
              </div>

              {isLoadingOrders ? (
                <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center">
                  <div className="w-8 h-8 border-2 border-forest-700/20 border-t-forest-700 rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-500">
                    {language === 'en' ? 'Loading orders...' : 'Đang tải danh sách đơn hàng...'}
                  </p>
                </div>
              ) : orders.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg text-gray-800 mb-1">
                    {language === 'en' ? 'No orders yet' : 'Bạn chưa có đơn hàng nào'}
                  </h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">
                    {language === 'en'
                      ? 'Explore our natural corn milk, lotus seed milk, and beverage combos!'
                      : 'Khám phá ngay các dòng sữa bắp nếp, sữa hạt sen và combo đồ uống dinh dưỡng thơm ngon của Thái Sơn Foods!'}
                  </p>
                  <Link
                    href="/#san-pham"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-forest-700 text-white text-sm rounded-xl hover:bg-forest-800 transition-colors"
                  >
                    <span>{language === 'en' ? 'Shop Drinks Now' : 'Mua sắm ngay'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <>
                {orders.slice((Math.min(orderPage, Math.max(1, Math.ceil(orders.length / PAGE_SIZE))) - 1) * PAGE_SIZE, Math.min(orderPage, Math.max(1, Math.ceil(orders.length / PAGE_SIZE))) * PAGE_SIZE).map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-3xl border border-gray-100 shadow-2xs p-5 md:p-6 transition-all hover:border-emerald-200"
                  >
                    {/* Order Top Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-forest-700 text-lg">
                            #{order.order_code}
                          </span>
                          {getStatusBadge(order.status)}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {new Date(order.created_at).toLocaleString('vi-VN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          {language === 'en' ? 'Total Amount' : 'Tổng thanh toán'}
                        </div>
                        <div className="text-xl text-forest-700">
                          {formatPrice(order.total)} ₫
                        </div>
                      </div>
                    </div>

                    {/* Order Items List */}
                    <div className="py-4 divide-y divide-gray-50">
                      {order.items &&
                        order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 text-xs">
                            <div className="flex items-center gap-3">
                              {item.thumbnail ? (
                                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                                  <Image
                                    src={item.thumbnail}
                                    alt={item.name}
                                    fill
                                    className="object-contain"
                                  />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-forest-700 flex items-center justify-center text-sm shrink-0">
                                  TSF
                                </div>
                              )}
                              <div>
                                <span className="text-gray-800 line-clamp-1 text-[1.125em]">
                                  {item.name}
                                </span>
                                <span className="text-gray-400 text-[11px]">
                                  {formatPrice(item.price)} ₫ x {item.quantity} {item.unit}
                                </span>
                              </div>
                            </div>
                            <span className="text-gray-900 shrink-0 text-[1.125em]">
                              {formatPrice(item.price * item.quantity)} ₫
                            </span>
                          </div>
                        ))}
                    </div>

                    {/* Order Footer Info */}
                    <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 bg-gray-50/70 p-3 rounded-2xl">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="line-clamp-1">
                          {order.address}, {order.ward}, {order.district}, {order.province}
                        </span>
                      </div>
                      <div className="text-gray-600 font-medium">
                        {order.payment_method === 'banking' ? 'Chuyển khoản' : 'COD (Tiền mặt)'}
                      </div>
                    </div>
                  </div>
                ))}
                <Pagination
                  page={Math.min(orderPage, Math.max(1, Math.ceil(orders.length / PAGE_SIZE)))}
                  totalItems={orders.length}
                  onChange={changeOrderPage}
                  language={language}
                />
                </>
              )}
            </div>
          ) : activeTab === 'profile' ? (
            /* TAB: PROFILE */
            <div className="bg-white rounded-3xl border border-gray-100 shadow-2xs p-6 md:p-8">
              <h2 className="text-xl text-gray-900 font-heading mb-1">
                {language === 'en' ? 'Personal Information' : 'Thông tin cá nhân & Địa chỉ giao hàng'}
              </h2>
              <p className="text-xs text-gray-500 mb-6">
                {language === 'en'
                  ? 'Information will be automatically prefilled in your checkout form.'
                  : 'Thông tin này sẽ được tự động điền sẵn tại trang thanh toán giúp bạn mua sắm nhanh chóng hơn.'}
              </p>

              {profileMsg && (
                <div
                  className={cn(
                    'mb-6 p-4 rounded-2xl text-xs flex items-center gap-2.5',
                    profileMsg.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  )}
                >
                  {profileMsg.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{profileMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      {language === 'en' ? 'Full Name' : 'Họ và tên'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={profileForm.fullName}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, fullName: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-base sm:text-sm focus:outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      Email ({language === 'en' ? 'cannot be changed' : 'cố định'})
                    </label>
                    <input
                      type="email"
                      disabled
                      value={user.email}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-base sm:text-sm cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      {language === 'en' ? 'Phone Number' : 'Số điện thoại'}
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, phone: e.target.value })
                      }
                      placeholder="0123456789"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-base sm:text-sm focus:outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      {language === 'en' ? 'Province / City' : 'Tỉnh / Thành phố'}
                    </label>
                    {/* Ô chọn theo danh mục hành chính giống trang thanh toán để tự điền khớp khi đặt hàng */}
                    <select
                      value={profileForm.province}
                      onChange={(e) => {
                        setProfileForm({ ...profileForm, province: e.target.value, district: '', ward: '' });
                        setProfileCoords(null);
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-base sm:text-sm focus:outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10"
                    >
                      <option value="">{language === 'en' ? '-- Select province --' : '-- Chọn Tỉnh / Thành phố --'}</option>
                      {profileForm.province && !profileProvinces.some((p) => p === profileForm.province) && (
                        <option value={profileForm.province}>{profileForm.province}</option>
                      )}
                      {profileProvinces.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      {language === 'en' ? 'District' : 'Quận / Huyện'}
                    </label>
                    <select
                      value={profileForm.district}
                      disabled={!profileForm.province}
                      onChange={(e) => {
                        setProfileForm({ ...profileForm, district: e.target.value, ward: '' });
                        setProfileCoords(null);
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-base sm:text-sm focus:outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10 disabled:bg-gray-50"
                    >
                      <option value="">{language === 'en' ? '-- Select district --' : '-- Chọn Quận / Huyện --'}</option>
                      {profileForm.district && !profileDistricts.some((d) => d.name === profileForm.district) && (
                        <option value={profileForm.district}>{profileForm.district}</option>
                      )}
                      {profileDistricts.map((d) => (
                        <option key={d.name} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      {language === 'en' ? 'Ward' : 'Phường / Xã'}
                    </label>
                    <select
                      value={profileForm.ward}
                      disabled={!profileForm.district && !profileForm.ward}
                      onChange={(e) => setProfileForm({ ...profileForm, ward: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-base sm:text-sm focus:outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10 disabled:bg-gray-50"
                    >
                      <option value="">{language === 'en' ? '-- Select ward --' : '-- Chọn Phường / Xã --'}</option>
                      {profileForm.ward && !profileWards.some((w) => w.name === profileForm.ward) && (
                        <option value={profileForm.ward}>{profileForm.ward}</option>
                      )}
                      {profileWards.map((w) => (
                        <option key={w.name} value={w.name}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 relative">
                    <label htmlFor="profile-address" className="block text-sm text-gray-700 mb-1.5">
                      {language === 'en' ? 'Street Address' : 'Địa chỉ chi tiết (Số nhà, tên đường)'}
                    </label>
                    <div className="relative">
                      <input
                        {...addr.inputProps}
                        id="profile-address"
                        type="text"
                        value={profileForm.address}
                        placeholder={language === 'en' ? '123 Le Van Sy...' : '123 Lê Văn Sỹ...'}
                        className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-gray-200 text-base sm:text-sm focus:outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10"
                      />
                      {addr.state.status === 'loading' && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-forest-700" />
                      )}
                    </div>

                    {addr.panelOpen && (
                      <AddressSuggestionList
                        id={addr.listboxId}
                        optionId={addr.optionId}
                        suggestions={addr.state.suggestions}
                        activeIndex={addr.state.activeIndex}
                        status={addr.state.status}
                        degraded={addr.state.degraded}
                    outOfZone={addr.state.outOfZone}
                        query={addr.state.inputText}
                        language={language === 'en' ? 'en' : 'vi'}
                        onPick={(i) => addr.controller.select(i)}
                        onPickMap={() => {
                          addr.controller.close();
                          setIsProfileMapOpen(true);
                        }}
                      />
                    )}

                    {/* Ghim/GPS cho ra địa chỉ khác chữ đã nhập: hỏi, không tự đè */}
                    {profilePinReview && (
                      <div className="mt-2 p-2.5 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-900" role="status">
                        <p className="mb-0.5 text-emph">
                          {language === 'en' ? 'The pin shows a different address. Use it?' : 'Vị trí ghim cho ra địa chỉ khác. Dùng địa chỉ này?'}
                        </p>
                        <p className="text-2xs leading-snug">
                          {language === 'en' ? 'Pin location: ' : 'Vị trí ghim: '}
                          {profilePinReview.formatted ||
                            [profilePinReview.street, profilePinReview.ward, profilePinReview.district].filter(Boolean).join(', ')}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => applyProfilePin(profilePinReview)}
                            className="px-2.5 py-1 rounded-lg bg-forest-700 text-white text-xs cursor-pointer"
                          >
                            {language === 'en' ? 'Use pin address' : 'Dùng địa chỉ này'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setProfilePinReview(null)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-amber-400 text-amber-900 text-xs cursor-pointer"
                          >
                            {language === 'en' ? 'Keep my address' : 'Giữ địa chỉ của tôi'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Vị trí giao hàng cố định trên bản đồ: dùng sẵn ở trang thanh toán */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                      <label className="block text-sm text-gray-700">
                        {language === 'en' ? 'Delivery location on map' : 'Vị trí giao hàng trên bản đồ'}
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleProfileGPS}
                          disabled={isLocatingProfile}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs text-forest-700 cursor-pointer disabled:opacity-60"
                        >
                          <Navigation className={cn('w-3.5 h-3.5', isLocatingProfile && 'animate-spin')} />
                          <span>
                            {isLocatingProfile
                              ? language === 'en' ? 'Locating...' : 'Đang lấy vị trí...'
                              : language === 'en' ? 'Use my GPS' : 'Lấy vị trí GPS'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsProfileMapOpen(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-forest-700 hover:bg-forest-800 text-xs text-white cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{language === 'en' ? 'Pin on map' : 'Chọn trên bản đồ'}</span>
                        </button>
                      </div>
                    </div>
                    <ProfileLocationPreview coords={activeProfileCoords} onOpen={() => setIsProfileMapOpen(true)} />
                    <p className={cn('mt-1.5 text-xs', activeProfileCoords ? 'text-forest-700' : 'text-amber-700')}>
                      {activeProfileCoords
                        ? language === 'en'
                          ? 'Location set. Checkout will fill in this address and pin automatically.'
                          : 'Đã có vị trí. Khi thanh toán sẽ tự điền địa chỉ và ghim này, không cần nhập lại.'
                        : language === 'en'
                        ? 'No map pin yet: pick a suggestion above, use GPS or pin on the map so the shipper finds you easily.'
                        : 'Chưa có ghim: chọn 1 gợi ý ở trên, lấy vị trí GPS hoặc chấm trên bản đồ để shipper tìm nhà dễ hơn.'}
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-6 py-3 bg-forest-700 hover:bg-forest-800 text-white rounded-xl text-sm transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-60 active:scale-[0.98]"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {isSavingProfile
                        ? language === 'en'
                          ? 'Saving...'
                          : 'Đang lưu...'
                        : language === 'en'
                        ? 'Save Changes'
                        : 'Lưu thay đổi'}
                    </span>
                  </button>
                </div>
              </form>

              {/* Bản đồ lớn để chấm ghim vị trí nhà: ghim xong tự điền số nhà, tên đường */}
              <LocationConfirmMapModal
                isOpen={isProfileMapOpen}
                onClose={() => setIsProfileMapOpen(false)}
                initialCoords={
                  activeProfileCoords ||
                  findPreciseCoordinates(
                    profileForm.province || 'TP. Hồ Chí Minh',
                    profileForm.district,
                    profileForm.ward
                  )
                }
                initialAddress={profileForm.address}
                onConfirm={(confirmed) => {
                  setProfileCoords({ lat: confirmed.lat, lng: confirmed.lng });
                  setProfilePinConfirmed(true);
                  if (confirmed.components) {
                    reviewProfilePin({ ...confirmed.components, formatted: confirmed.formattedAddress });
                  }
                }}
              />
            </div>
          ) : null}

          {activeTab === 'wishlist' && <WishlistPanel />}

          {/* TAB 3: ĐÁNH GIÁ CỦA TÔI */}
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl md:text-2xl text-gray-900 font-heading">
                      {language === 'en' ? 'My Product Reviews' : 'Đánh giá của tôi'}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      {language === 'en'
                        ? 'Track moderation status and brand responses for your reviews'
                        : 'Theo dõi trạng thái kiểm duyệt và phản hồi chính thức từ Thái Sơn Foods'}
                    </p>
                  </div>
                  <Link
                    href="/#san-pham"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-forest-700 text-sm transition"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>{language === 'en' ? 'Review more products' : 'Đánh giá sản phẩm khác'}</span>
                  </Link>
                </div>

                {isLoadingReviews ? (
                  <div className="py-16 text-center text-xs text-gray-500">
                    <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <span>Đang tải danh sách đánh giá của bạn...</span>
                  </div>
                ) : userReviews.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
                      <Star className="w-8 h-8 fill-amber-400" />
                    </div>
                    <h3 className="text-lg text-gray-800">
                      {language === 'en' ? 'No reviews submitted yet' : 'Bạn chưa gửi đánh giá nào'}
                    </h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-6">
                      {language === 'en'
                        ? 'Share your thoughts on products you enjoyed and get verified badges!'
                        : 'Hãy chia sẻ cảm nhận chân thực về các sản phẩm bạn đã thưởng thức tại Thái Sơn Foods nhé!'}
                    </p>
                    <Link
                      href="/#san-pham"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-forest-700 text-white rounded-xl text-sm hover:bg-forest-800 transition shadow-xs"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>{language === 'en' ? 'Explore Products' : 'Khám phá sản phẩm'}</span>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userReviews.slice((Math.min(reviewPage, Math.max(1, Math.ceil(userReviews.length / PAGE_SIZE))) - 1) * PAGE_SIZE, Math.min(reviewPage, Math.max(1, Math.ceil(userReviews.length / PAGE_SIZE))) * PAGE_SIZE).map((rev) => (
                      <article
                        key={rev.id}
                        className="border border-gray-100 rounded-2xl p-5 bg-gray-50/40 hover:bg-white hover:border-gray-200 transition-all space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900 text-base">
                                {rev.productId}
                              </span>
                              {rev.isVerifiedBuyer && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] border border-emerald-200">
                                  <CheckCircle className="w-2.5 h-2.5" /> Đã mua hàng
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                              <span>{rev.variantInfo}</span>
                              <span>•</span>
                              <span>{new Date(rev.createdAt).toLocaleDateString('vi-VN')}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'px-2.5 py-1 rounded-full text-[12px] border',
                                rev.status === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : rev.status === 'PENDING'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-gray-100 text-gray-500 border-gray-200'
                              )}
                            >
                              {rev.status === 'APPROVED' && 'Đã đăng'}
                              {rev.status === 'PENDING' && 'Chờ duyệt'}
                              {rev.status === 'HIDDEN' && 'Bị ẩn'}
                            </span>
                          </div>
                        </div>

                        {/* Stars */}
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn(
                                'w-4 h-4',
                                s <= rev.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'fill-gray-200 text-gray-200'
                              )}
                            />
                          ))}
                        </div>

                        {/* Title and comment */}
                        {rev.title && <h4 className="text-gray-900 text-base">{rev.title}</h4>}
                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                          {rev.comment}
                        </p>

                        {/* Brand official response if exists */}
                        {rev.adminReply && (
                          <div className="bg-emerald-50/70 border-l-4 border-emerald-600 p-3 rounded-r-xl text-xs space-y-1">
                            <div className="flex items-center gap-1 text-emerald-900 text-[1.125em]">
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Phản hồi từ Thái Sơn Foods</span>
                            </div>
                            <p className="text-gray-700 leading-relaxed">{rev.adminReply}</p>
                          </div>
                        )}
                      </article>
                    ))}
                    <Pagination
                      page={Math.min(reviewPage, Math.max(1, Math.ceil(userReviews.length / PAGE_SIZE)))}
                      totalItems={userReviews.length}
                      onChange={changeReviewPage}
                      language={language}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="section-container py-20 text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-text-muted">Đang tải thông tin tài khoản...</p>
        </div>
      }
    >
      <AccountContent />
    </Suspense>
  );
}
