'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Search,
  ShoppingBag,
  Menu,
  X,
  Flame,
  Sparkles,
  Truck,
  Headphones,
  Phone,
  Clock,
  ChevronRight,
  ChevronDown,
  Globe,
  Check,
  LogOut,
  Crown,
  RefreshCw,
  MapPin,
  User,
  Package,
} from 'lucide-react';
import { useBranchStore } from '@/store/branch';
import { useCartStore } from '@/store/cart';
import { useLanguage } from '@/context/LanguageContext';
import { useUserAuth } from '@/context/UserAuthContext';
import { cn, formatPrice, safeFetchJson } from '@/lib/utils';
import { products, categories as catalogCategories } from '@/data/products';
import { MEMBERSHIP_CONFIG } from '@/config/membership';
import { DELIVER_TO_PLACEHOLDER } from '@/data/homepage-placeholders';
import CategorySidebar from '@/components/home/CategorySidebar';

/**
 * HEADER BIẾN THỂ AMAZON — chỉ dùng cho trang chủ mới (AppLayout chọn khi ở "/" và cờ bật).
 * Header gốc (Header.tsx + BranchTopBar.tsx) giữ nguyên cho mọi trang khác.
 *
 * Giữ đủ chức năng Header gốc: logo (bấm tải lại), chi nhánh đang chọn + đổi chi nhánh, hotline,
 * tìm kiếm sống (live search) + gợi ý, đổi ngôn ngữ VI/EN, đăng nhập / menu tài khoản, đơn hàng,
 * giỏ hàng (#cart-target-header cho hiệu ứng bay vào giỏ), thanh tác vụ (Deal sốc, Bán chạy,
 * Prime theo cờ, Dịch vụ bán hàng, Hỗ trợ mua hàng), modal hỗ trợ, menu di động.
 * Bổ sung theo bố cục Amazon: chọn danh mục khi tìm kiếm, nút "Tất cả" mở ngăn danh mục.
 */

// Chuẩn hóa chuỗi tiếng Việt: bỏ dấu, đ→d, lowercase, gộp khoảng trắng (giống Header gốc)
function normalizeVi(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesProductQuery(
  p: { name: string; nameEn?: string; shortDescription?: string; slug: string },
  rawQuery: string
): boolean {
  const q = normalizeVi(rawQuery);
  if (!q) return false;
  const haystack = normalizeVi([p.name, p.nameEn || '', p.shortDescription || '', p.slug].join(' '));
  return q.split(' ').every((token) => haystack.includes(token));
}

const CATEGORY_ORDER = ['sua-hat', 'nuoc-giai-khat', 'tra-sua'];
const SEARCH_CATEGORIES = [...catalogCategories].sort(
  (a, b) => CATEGORY_ORDER.indexOf(a.id) - CATEGORY_ORDER.indexOf(b.id)
);
const normalizeCategoryId = (id?: string) => (id || '').replace(/^cat-/, '');

export default function HeaderAmazon() {
  const router = useRouter();
  const { selectedBranch, openBranchModal, fetchBranches } = useBranchStore();
  const { language, setLanguage, t } = useLanguage();
  const { user, openAuthModal, logout } = useUserAuth();
  const isEn = language === 'en';

  const [isMounted, setIsMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const [liveProducts, setLiveProducts] = useState(products);

  useEffect(() => {
    let active = true;
    safeFetchJson<{ success: boolean; data: any[] }>('/api/products').then((json) => {
      if (!active || !json?.success) return;
      if (Array.isArray(json.data) && json.data.length > 0) {
        setLiveProducts(json.data.filter((p: any) => p.isActive !== false));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const totalQuantity = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));

  useEffect(() => {
    setIsMounted(true);
    fetchBranches();
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchBranches]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inSearch = [desktopSearchRef, mobileSearchRef].some((r) => r.current?.contains(target));
      if (!inSearch) setIsSearchFocused(false);
      if (langRef.current && !langRef.current.contains(target)) setIsLangOpen(false);
      if (userRef.current && !userRef.current.contains(target)) setIsUserOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ngăn danh mục: Esc để đóng + khoá cuộn nền
  useEffect(() => {
    if (!isDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsDrawerOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isDrawerOpen]);

  const taskbagItems = useMemo(
    () => [
      { id: 'deal-soc', label: t('dealHot'), href: '/#combo', icon: Flame, color: 'text-corn', badge: 'HOT' },
      { id: 'ban-chay', label: t('bestSellers'), href: '/#san-pham', icon: Sparkles, color: 'text-corn' },
      ...(MEMBERSHIP_CONFIG.ENABLE_MEMBERSHIP
        ? [{ id: 'member-prime', label: 'Thái Sơn Prime', href: '/member', icon: Crown, color: 'text-corn', badge: 'HOT' }]
        : []),
      { id: 'dich-vu', label: t('wholesaleService'), href: '/#kho-si', icon: Truck, color: 'text-leaf-300' },
      { id: 'ho-tro', label: t('shoppingSupport'), href: '#ho-tro', action: 'open-support', icon: Headphones, color: 'text-leaf-300' },
    ],
    [t]
  );

  const categoryLinks = SEARCH_CATEGORIES.map((c) => ({
    id: c.id,
    label: isEn && c.nameEn ? c.nameEn : c.name,
    href: `/#danh-muc-${c.id}`,
  }));

  const searchPool = useMemo(
    () =>
      searchCategory === 'all'
        ? liveProducts
        : liveProducts.filter((p) => normalizeCategoryId(p.categoryId) === searchCategory),
    [liveProducts, searchCategory]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchPool.filter((p) => matchesProductQuery(p, searchQuery)).slice(0, 4);
  }, [searchQuery, searchPool]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      // Chỉ chọn danh mục, chưa gõ từ khoá → tới hàng sản phẩm của danh mục đó
      if (searchCategory !== 'all') router.push(`/#danh-muc-${searchCategory}`);
      return;
    }
    setIsSearchFocused(false);
    const match = searchPool.find((p) => matchesProductQuery(p, searchQuery));
    if (match) {
      router.push(`/san-pham/${match.slug}`);
    } else {
      router.push(searchCategory === 'all' ? '/#san-pham' : `/#danh-muc-${searchCategory}`);
    }
    setSearchQuery('');
  };

  const handleSelectProduct = (slug: string) => {
    setIsSearchFocused(false);
    setSearchQuery('');
    router.push(`/san-pham/${slug}`);
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.location.pathname === '/' && !window.location.search) {
      window.location.reload();
    } else {
      window.location.href = '/';
    }
  };

  const openOrders = () => {
    if (user) router.push('/tai-khoan?tab=orders');
    else openAuthModal('login');
  };

  const branchName = selectedBranch?.name || 'Cửa Hàng NH - Phú Thọ Hòa';
  const firstName = user?.fullName ? user.fullName.split(' ').slice(-1)[0] : '';
  const cartCount = isMounted ? totalQuantity : 0;

  /* ─────────── Khối con ─────────── */

  // Hai ô tìm kiếm (desktop / mobile) dùng chung trạng thái nhưng ref + id riêng
  const renderSearchForm = (variant: 'desktop' | 'mobile') => (
    <div ref={variant === 'desktop' ? desktopSearchRef : mobileSearchRef} className="relative w-full">
      <form
        onSubmit={handleSearchSubmit}
        role="search"
        className="flex h-11 w-full rounded-xl overflow-hidden bg-white ring-2 ring-transparent focus-within:ring-corn"
      >
        <label className="sr-only" htmlFor={`home-search-category-${variant}`}>
          {isEn ? 'Search in category' : 'Tìm trong danh mục'}
        </label>
        <div className="relative shrink-0 bg-ivory-dark border-r border-border">
          <select
            id={`home-search-category-${variant}`}
            value={searchCategory}
            onChange={(e) => setSearchCategory(e.target.value)}
            className="appearance-none h-full max-w-[96px] sm:max-w-[150px] pl-2.5 pr-6 bg-transparent text-[12px] sm:text-[13px] text-text-body font-medium cursor-pointer focus:outline-none"
          >
            <option value="all">{isEn ? 'All' : 'Tất cả'}</option>
            {SEARCH_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {isEn && c.nameEn ? c.nameEn : c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
        </div>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          placeholder={t('searchPlaceholder')}
          aria-label={isEn ? 'Search products' : 'Tìm kiếm sản phẩm'}
          className="flex-1 min-w-0 px-3 text-base sm:text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="px-2 text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label={isEn ? 'Clear search' : 'Xóa tìm kiếm'}
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="submit"
          className="shrink-0 w-12 lg:w-14 flex items-center justify-center bg-corn hover:bg-corn-dark text-text-dark transition-colors cursor-pointer"
          aria-label={t('searchBtn')}
          title={t('searchBtn')}
        >
          <Search className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </form>

      {/* Gợi ý sản phẩm (live search) */}
      {isSearchFocused && searchQuery.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[60]">
          <div className="p-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between gap-2 text-sm text-gray-700">
            <span className="truncate">
              {isEn ? 'Suggested products for' : 'Sản phẩm gợi ý cho'} &quot;{searchQuery}&quot;
            </span>
            <span className="text-emerald-700 font-medium shrink-0">
              {searchResults.length} {isEn ? 'results' : 'kết quả'}
            </span>
          </div>
          {searchResults.length > 0 ? (
            <div className="p-2 divide-y divide-gray-50">
              {searchResults.map((item) => {
                const v = item.variants && item.variants.length > 0
                  ? [...item.variants].sort((a, b) => (a.quantity || 0) - (b.quantity || 0))[0]
                  : null;
                const isBigBottle = item.slug?.includes('yoo') || item.volume?.includes('568') || item.price === 25000;
                const qty = v ? v.quantity : isBigBottle ? 5 : 7;
                const price = v ? v.price : item.price * qty;
                const name = isEn && item.nameEn ? item.nameEn : item.name;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectProduct(item.slug)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-emerald-50/50 transition-colors cursor-pointer group text-left"
                  >
                    <span className="relative w-12 h-12 rounded-lg bg-ivory border border-gray-200/80 overflow-hidden shrink-0">
                      <Image src={item.thumbnail || '/images/logo-clean-1000.png'} alt={name} fill className="object-contain p-1" sizes="48px" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm sm:text-base text-gray-900 group-hover:text-green-primary leading-snug line-clamp-2">
                        {name}
                      </span>
                      <span className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm text-emerald-700">{formatPrice(price)} ₫</span>
                        <span className="text-[10px] text-gray-400">/{isEn ? `Pack of ${qty}` : `lốc ${qty} chai`}</span>
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-primary" />
                  </button>
                );
              })}
              <div className="pt-2 px-2 pb-1">
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="w-full py-2 bg-emerald-50 hover:bg-emerald-100/70 text-green-primary text-sm rounded-xl transition-colors cursor-pointer"
                >
                  {isEn ? 'View all related products →' : 'Xem tất cả sản phẩm liên quan →'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-gray-500">
              {t('noProductsFound')} &quot;{searchQuery}&quot;. {t('tryAnotherKeyword')}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const deliverTo = (compact = false) => (
    <button
      type="button"
      onClick={openBranchModal}
      title="Bấm để đổi chi nhánh nhận hàng"
      className={cn(
        'flex items-end gap-1 text-left rounded-md border border-transparent hover:border-white/70 cursor-pointer min-w-0',
        compact ? "relative before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] px-0 py-0" : 'px-2 py-1.5'
      )}
    >
      <MapPin className="w-4 h-4 text-corn shrink-0 mb-0.5" aria-hidden />
      <span className="min-w-0 leading-tight">
        {!compact && <span className="block text-[11px] text-white/70">{isEn ? 'Delivering from' : 'Giao từ chi nhánh'}</span>}
        <span className={cn('block text-white truncate', compact ? 'text-[12px]' : 'text-[13px] max-w-[170px]')}>
          {compact && <span className="font-normal text-white/75">{isEn ? 'Delivering from ' : 'Giao từ '}</span>}
          {isMounted ? branchName : DELIVER_TO_PLACEHOLDER.guestHint}
          {compact && <span className="ml-1 underline text-corn text-[1.125em]">{isEn ? 'Change' : 'Đổi'}</span>}
        </span>
      </span>
    </button>
  );

  const userMenu = isUserOpen && user && (
    <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[60] text-left">
      <div className="px-4 py-2 border-b border-gray-100">
        <p className="text-sm text-gray-900 line-clamp-1">{user.fullName}</p>
        <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
      </div>
      <Link href="/tai-khoan?tab=orders" onClick={() => setIsUserOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-green-primary">
        <ShoppingBag className="w-4 h-4 text-emerald-700" />
        {isEn ? 'My Orders' : 'Đơn hàng của tôi'}
      </Link>
      <Link href="/tai-khoan?tab=profile" onClick={() => setIsUserOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-green-primary">
        <User className="w-4 h-4 text-emerald-700" />
        {isEn ? 'Account Details' : 'Thông tin tài khoản'}
      </Link>
      {MEMBERSHIP_CONFIG.ENABLE_MEMBERSHIP && (
        <Link href="/member" onClick={() => setIsUserOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-amber-800 hover:bg-amber-50">
          Thái Sơn Prime
        </Link>
      )}
      {MEMBERSHIP_CONFIG.ENABLE_SUBSCRIBE_SAVE && (
        <Link href="/tai-khoan/dinh-ky" onClick={() => setIsUserOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-50">
          <RefreshCw className="w-4 h-4 text-emerald-600" />
          Lịch Giao Định Kỳ
        </Link>
      )}
      <div className="pt-1 border-t border-gray-100 mt-1">
        <button
          type="button"
          onClick={() => {
            setIsUserOpen(false);
            logout();
          }}
          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          {isEn ? 'Log Out' : 'Đăng xuất'}
        </button>
      </div>
    </div>
  );

  const navBtn = 'flex items-center rounded-md border border-transparent hover:border-white/70 cursor-pointer text-white';

  return (
    <>
      {/* Mobile/tablet: header dùng display:contents để chỉ TẦNG 1 dính trên cùng, các hàng phụ cuộn đi tự nhiên (không đổi chiều cao khi cuộn → hết giật). Từ lg: header dính như cũ. */}
      <header className={cn('z-50 bg-green-primary text-white max-lg:contents lg:sticky lg:top-0', isScrolled ? 'shadow-md' : '')}>
        {/* ── TẦNG 1 ── */}
        <div className={cn('max-lg:sticky max-lg:top-0 max-lg:z-50 max-lg:bg-green-primary', isScrolled && 'max-lg:shadow-md')}>
        <div className="max-w-[1500px] mx-auto px-3 sm:px-4 lg:px-5">
          <div className="flex items-center gap-2 lg:gap-3 h-14 lg:h-16">
            {/* Nút "Tất cả" (mobile/tablet) */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className={cn(navBtn, 'lg:hidden p-1.5 -ml-1 max-lg:min-h-11 max-lg:min-w-11 max-lg:justify-center')}
              aria-label={isEn ? 'Open menu' : 'Mở menu'}
              aria-expanded={isDrawerOpen}
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Logo — bấm để tải lại trang chủ (giống Header gốc) */}
            <Link href="/" onClick={handleLogoClick} className={cn(navBtn, 'shrink-0 px-1 py-1')} aria-label="Thái Sơn Foods - Trang chủ">
              <span className="relative block h-10 w-[118px] sm:h-11 sm:w-[140px] lg:h-12 lg:w-[160px]">
                <Image src="/images/logo-vien-trang.png" alt="Thái Sơn Foods - Món ngon quê Việt" fill sizes="160px" className="object-contain object-left" priority />
              </span>
            </Link>

            {/* Giao từ chi nhánh (desktop) */}
            <div className="hidden xl:block shrink-0">{deliverTo()}</div>

            {/* Tìm kiếm (desktop) */}
            <div className="hidden lg:block flex-1 min-w-[280px] mx-1">{renderSearchForm('desktop')}</div>

            <div className="flex-1 lg:hidden" />

            {/* Ngôn ngữ */}
            <div ref={langRef} className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setIsLangOpen((o) => !o)}
                className={cn(navBtn, 'gap-1 px-2 py-2 text-[15px] max-lg:min-h-11')}
                aria-label={t('changeLanguage')}
                aria-expanded={isLangOpen}
                title={t('changeLanguage')}
              >
                <Globe className="w-4 h-4 text-corn" />
                {language === 'vi' ? 'VI' : 'EN'}
                <ChevronDown className={cn('w-3 h-3 text-white/70 transition-transform', isLangOpen && 'rotate-180')} />
              </button>
              {isLangOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-40 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-[60] text-gray-800">
                  {(['vi', 'en'] as const).map((lng) => (
                    <button
                      key={lng}
                      type="button"
                      onClick={() => {
                        setLanguage(lng);
                        setIsLangOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-sm text-left cursor-pointer',
                        language === lng ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-gray-50'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm">{lng === 'vi' ? '🇻🇳' : '🇬🇧'}</span>
                        {lng === 'vi' ? 'Tiếng Việt' : 'English'}
                      </span>
                      {language === lng && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tài khoản */}
            <div ref={userRef} className="relative">
              <button
                type="button"
                onClick={() => (user ? setIsUserOpen((o) => !o) : openAuthModal('login'))}
                className={cn(navBtn, 'gap-1.5 px-1.5 lg:px-2 py-1 text-left max-lg:min-h-11 max-lg:min-w-11 max-lg:justify-center')}
                aria-label={user ? (isEn ? 'Account menu' : 'Menu tài khoản') : isEn ? 'Sign In / Register' : 'Đăng nhập / Đăng ký'}
                aria-expanded={user ? isUserOpen : undefined}
              >
                <User className="w-5 h-5 lg:hidden" />
                <span className="hidden min-[400px]:block lg:block leading-tight">
                  <span className="block text-[11px] text-white/70 max-w-[110px] truncate">
                    {user ? `${isEn ? 'Hello' : 'Xin chào'}, ${firstName}` : isEn ? 'Hello, sign in' : 'Xin chào, đăng nhập'}
                  </span>
                  <span className="hidden lg:flex items-center gap-0.5 text-[15px]">
                    {isEn ? 'Account' : 'Tài khoản'}
                    <ChevronDown className="w-3 h-3 text-white/70" />
                  </span>
                </span>
              </button>
              {userMenu}
            </div>

            {/* Đơn hàng */}
            <button
              type="button"
              onClick={openOrders}
              className={cn(navBtn, 'hidden xl:block px-2 py-1 text-left leading-tight')}
            >
              <span className="block text-[11px] text-white/70">{isEn ? 'Track' : 'Theo dõi'}</span>
              <span className="block text-[15px]">{isEn ? 'Orders' : 'Đơn hàng'}</span>
            </button>

            {/* Giỏ hàng — giữ id cho hiệu ứng bay vào giỏ */}
            <Link
              href="/gio-hang"
              id="cart-target-header"
              className={cn(navBtn, 'relative gap-1 px-1.5 lg:px-2 py-1 items-end max-lg:min-h-11 max-lg:min-w-11 max-lg:justify-center')}
              aria-label={isEn ? `Cart, ${cartCount} items` : `Giỏ hàng, ${cartCount} sản phẩm`}
              title={isEn ? 'Shopping Cart' : 'Giỏ hàng'}
            >
              <span className="relative">
                <ShoppingBag className="w-7 h-7" />
                <span
                  key={`cart-badge-${cartCount}`}
                  className={cn(
                    'absolute -top-1.5 -right-2 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full text-[12px]',
                    cartCount > 0 ? 'bg-corn text-text-dark animate-pulse-badge' : 'bg-white/20 text-white'
                  )}
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              </span>
              <span className="hidden xl:block text-[15px]">{isEn ? 'Cart' : 'Giỏ hàng'}</span>
            </Link>
          </div>

          {/* Tìm kiếm (mobile/tablet) — luôn hiện, dễ dùng */}
          <div className="lg:hidden pb-2.5">{renderSearchForm('mobile')}</div>
        </div>
        </div>

        {/* Giao từ chi nhánh (mobile/tablet) — cuộn đi cùng nội dung, không ẩn bằng JS (tránh đổi chiều cao khi cuộn) */}
        <div className="xl:hidden bg-green-dark px-3 sm:px-4 lg:px-5 py-1.5">{deliverTo(true)}</div>

        {/* ── TẦNG 2: THANH ĐIỀU HƯỚNG PHỤ ── */}
        <div className="bg-leaf-900">
          <div className="max-w-[1500px] mx-auto px-3 sm:px-4 lg:px-5 flex items-center gap-2 min-h-11 py-0.5 lg:py-0 lg:h-10">
            <nav className="grid grid-cols-2 w-full gap-x-1 md:flex md:flex-wrap md:w-auto lg:flex-nowrap items-center gap-0.5 lg:overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0" aria-label="Thanh tác vụ điều hướng">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className={cn(navBtn, 'hidden lg:flex gap-1.5 px-2 py-1 text-[15px] shrink-0')}
                aria-expanded={isDrawerOpen}
              >
                <Menu className="w-5 h-5" />
                {isEn ? 'All' : 'Tất cả'}
              </button>
              {taskbagItems.map((item) => {
                const cls = cn(navBtn, 'gap-1.5 px-2 py-1 text-[15px] whitespace-nowrap shrink-0 max-lg:min-h-11 max-md:justify-center max-md:px-1 max-md:text-[14px]');
                if (item.action === 'open-support') {
                  return (
                    <button key={item.id} type="button" onClick={() => setIsSupportModalOpen(true)} className={cls}>
                      {item.label}
                    </button>
                  );
                }
                return (
                  <Link key={item.id} href={item.href} className={cls}>
                    {item.label}
                    {item.badge && (
                      <span className="px-1.5 text-[10px] text-white bg-red-500 rounded-full animate-pulse">{item.badge}</span>
                    )}
                  </Link>
                );
              })}
              <span className="hidden md:block w-px h-5 bg-white/25 mx-1 shrink-0" aria-hidden />
              {categoryLinks.map((c) => (
                <Link key={c.id} href={c.href} className={cn(navBtn, 'hidden md:flex px-2 py-1 text-[13px] whitespace-nowrap shrink-0 max-lg:min-h-11')}>
                  {c.label}
                </Link>
              ))}
            </nav>

            {/* Cam kết + hotline (từ Header gốc & BranchTopBar) */}
            <div className="hidden xl:flex items-center gap-3 ml-auto text-[12px] text-white/85 shrink-0">
              <span className="flex items-center gap-1">
                {t('naturalIngredients')}
              </span>
              <span className="text-white/40">•</span>
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-corn" />
                {t('fastDelivery')}
              </span>
              <span className="text-white/40">•</span>
              <button type="button" onClick={() => setIsSupportModalOpen(true)} className="flex items-center gap-1 hover:text-corn cursor-pointer text-[1.125em]">
                <Headphones className="w-3.5 h-3.5 text-corn" />
                {t('support247')}: <strong className="text-white text-[1.125em]">028 6291 5024</strong>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── NGĂN "TẤT CẢ" (danh mục + tiện ích + tài khoản + ngôn ngữ) ── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[9990]" role="dialog" aria-modal="true" aria-label={isEn ? 'All categories' : 'Tất cả danh mục'}>
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/60 cursor-default"
            aria-label={t('close')}
            onClick={() => setIsDrawerOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[86%] max-w-[360px] bg-white shadow-2xl flex flex-col animate-[tsfDrawerIn_.22s_ease-out]">
            <style>{`@keyframes tsfDrawerIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
            <div className="bg-green-primary text-white px-4 py-3.5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    setIsDrawerOpen(false);
                    openAuthModal('login');
                  }
                }}
                className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
              >
                <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 text-[1.125em]">
                  {user?.fullName ? user.fullName.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                </span>
                <span className="text-[17px] truncate">
                  {user ? `${isEn ? 'Hello' : 'Xin chào'}, ${user.fullName}` : isEn ? 'Hello, sign in' : 'Xin chào, đăng nhập'}
                </span>
              </button>
              <button type="button" onClick={() => setIsDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer" aria-label={t('close')}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <section className="px-4 py-4 border-b border-gray-200">
                <h3 className="text-[17px] text-text-dark mb-3">{isEn ? 'Shop by category' : 'Mua theo danh mục'}</h3>
                {/* Tái sử dụng nguyên CategorySidebar của trang chủ cũ (12 sản phẩm theo 3 nhóm, đồng bộ API) */}
                <div onClick={(e) => (e.target as HTMLElement).closest('a') && setIsDrawerOpen(false)}>
                  <CategorySidebar />
                </div>
              </section>

              <section className="px-2 py-3 border-b border-gray-200">
                <h3 className="px-2 text-[17px] text-text-dark mb-1">{isEn ? 'Shortcuts' : 'Tiện ích'}</h3>
                {taskbagItems.map((item) => {
                  const Icon = item.icon;
                  const cls = 'w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-[16px] text-text-body hover:bg-ivory hover:text-green-primary text-left cursor-pointer';
                  if (item.action === 'open-support') {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={cls}
                        onClick={() => {
                          setIsDrawerOpen(false);
                          setIsSupportModalOpen(true);
                        }}
                      >
                        <Icon className="w-4 h-4 text-green-primary" />
                        {item.label}
                      </button>
                    );
                  }
                  return (
                    <Link key={item.id} href={item.href} className={cls} onClick={() => setIsDrawerOpen(false)}>
                      <Icon className="w-4 h-4 text-green-primary" />
                      {item.label}
                      {item.badge && <span className="ml-auto px-2 py-0.5 text-[11px] text-white bg-red-500 rounded-full">{item.badge}</span>}
                    </Link>
                  );
                })}
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-[16px] text-text-body hover:bg-ivory hover:text-green-primary text-left cursor-pointer"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    openBranchModal();
                  }}
                >
                  <MapPin className="w-4 h-4 text-green-primary" />
                  <span className="min-w-0 truncate">
                    {isEn ? 'Branch' : 'Chi nhánh'}: {isMounted ? branchName : DELIVER_TO_PLACEHOLDER.guestHint}
                  </span>
                </button>
              </section>

              <section className="px-2 py-3 border-b border-gray-200">
                <h3 className="px-2 text-[17px] text-text-dark mb-1">{isEn ? 'Account' : 'Tài khoản'}</h3>
                {user ? (
                  <>
                    <Link href="/tai-khoan?tab=orders" onClick={() => setIsDrawerOpen(false)} className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-[16px] text-text-body hover:bg-ivory">
                      <Package className="w-4 h-4 text-green-primary" />
                      {isEn ? 'My Orders' : 'Đơn hàng của tôi'}
                    </Link>
                    <Link href="/tai-khoan?tab=profile" onClick={() => setIsDrawerOpen(false)} className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-[16px] text-text-body hover:bg-ivory">
                      <User className="w-4 h-4 text-green-primary" />
                      {isEn ? 'Account Details' : 'Thông tin tài khoản'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-[16px] text-red-600 hover:bg-red-50 text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      {isEn ? 'Log Out' : 'Đăng xuất'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      openAuthModal('login');
                    }}
                    className="mx-2 mt-1 px-4 py-2.5 bg-green-primary hover:bg-green-dark text-white text-base rounded-xl cursor-pointer"
                  >
                    {isEn ? 'Sign In' : 'Đăng nhập'}
                  </button>
                )}
              </section>

              <section className="px-4 py-4 flex items-center justify-between">
                <span className="text-[15px] text-gray-600 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-700" />
                  {t('changeLanguage')}
                </span>
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                  {(['vi', 'en'] as const).map((lng) => (
                    <button
                      key={lng}
                      type="button"
                      onClick={() => setLanguage(lng)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm cursor-pointer',
                        language === lng ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                      )}
                    >
                      {lng === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}

      {/* ── MODAL HỖ TRỢ MUA HÀNG (nội dung giống Header gốc) ── */}
      {isSupportModalOpen && isMounted && (
        <div
          onClick={() => setIsSupportModalOpen(false)}
          className="fixed inset-0 z-[99999] bg-ink-950/60 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in-up"
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-green-primary flex items-center justify-center">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-gray-900 text-lg leading-tight">{t('supportTitle')}</h3>
                  <p className="text-[11px] text-gray-500">{t('supportSubtitle')}</p>
                </div>
              </div>
              <button
                onClick={() => setIsSupportModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer"
                aria-label={t('close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              <a href="tel:02862915024" className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 hover:bg-emerald-100/70 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-primary text-white flex items-center justify-center shadow-xs">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">{t('hotlineConsult')}</div>
                    <div className="text-lg text-gray-900 group-hover:text-green-primary">028 6291 5024</div>
                  </div>
                </div>
                <span className="text-sm text-white bg-green-primary px-3 py-1.5 rounded-xl shadow-2xs">{t('callNow')}</span>
              </a>
              <a
                href="https://zalo.me/0903050568"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 hover:bg-blue-100/70 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0068FF] text-white flex items-center justify-center shadow-xs text-sm">Zalo</div>
                  <div>
                    <div className="text-sm text-gray-600">{t('zaloChat')}</div>
                    <div className="text-base text-gray-900 group-hover:text-[#0068FF]">Thái Sơn Foods Official</div>
                  </div>
                </div>
                <span className="text-sm text-[#0068FF] bg-white border border-blue-200 px-3 py-1.5 rounded-xl shadow-2xs">{t('chatImmediate')}</span>
              </a>
              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 space-y-2 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    <strong className="text-[1.125em]">{isEn ? 'Service hours:' : 'Thời gian phục vụ:'}</strong> {isEn ? '07:30 - 21:30 daily' : '07:30 - 21:30 hàng ngày'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    <strong className="text-[1.125em]">{isEn ? 'Delivery:' : 'Giao hàng:'}</strong> {isEn ? 'Express delivery in 2 hours in HCMC' : 'Hỏa tốc trong 2 giờ tại TP.HCM & lân cận'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>
                    <strong className="text-[1.125em]">{isEn ? 'Returns:' : 'Đổi trả:'}</strong> {isEn ? '100% exchange if any issue' : 'Đổi mới 100% nếu sản phẩm có bất kỳ lỗi nào'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsSupportModalOpen(false)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm cursor-pointer"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
