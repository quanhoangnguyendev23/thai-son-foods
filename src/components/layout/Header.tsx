'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  User,
  ShoppingBag,
  Menu,
  X,
  Flame,
  Sparkles,
  Truck,
  Headphones,
  Phone,
  MessageCircle,
  Clock,
  ChevronRight,
  Globe,
  ChevronDown,
  Check,
  LogOut,
  Crown,
  RefreshCw,
  MapPin,
} from 'lucide-react';
import { useBranchStore } from '@/store/branch';
import { PRODUCT_DETAIL_CONFIG } from '@/config/product-detail';
import { useCartStore } from '@/store/cart';
import { useLanguage } from '@/context/LanguageContext';
import { useUserAuth } from '@/context/UserAuthContext';
import { cn, formatPrice, safeFetchJson } from '@/lib/utils';
import { products } from '@/data/products';
import BranchTopBar from '@/components/layout/BranchTopBar';
import { MEMBERSHIP_CONFIG } from '@/config/membership';
import { ENABLE_COMBOS } from '@/config/features';

// Chuẩn hóa chuỗi tiếng Việt: bỏ dấu, đ→d, lowercase, gộp khoảng trắng
function normalizeVi(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Khớp khi MỌI từ khóa đều xuất hiện trong (tên, tên EN, mô tả ngắn, slug) — không phân biệt dấu
function matchesProductQuery(
  p: { name: string; nameEn?: string; shortDescription?: string; slug: string },
  rawQuery: string
): boolean {
  const q = normalizeVi(rawQuery);
  if (!q) return false;
  const haystack = normalizeVi(
    [p.name, p.nameEn || '', p.shortDescription || '', p.slug].join(' ')
  );
  return q.split(' ').every((token) => haystack.includes(token));
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedBranch, openBranchModal } = useBranchStore();

  // Ô "Giao đến" kiểu Amazon chỉ dành cho giao diện chi tiết sản phẩm mới (cờ hoặc ?giao-dien=moi)
  const [showDeliverTo, setShowDeliverTo] = useState(false);
  useEffect(() => {
    const isPdp = Boolean(pathname?.startsWith('/san-pham/'));
    const preview = new URLSearchParams(window.location.search).get('giao-dien') === 'moi';
    setShowDeliverTo(isPdp && (PRODUCT_DETAIL_CONFIG.ENABLE_NEW_LAYOUT || preview));
  }, [pathname]);
  const { language, setLanguage, toggleLanguage, t } = useLanguage();
  const { user, openAuthModal, logout } = useUserAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
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

  const taskbagItems = useMemo(
    () => [
      ...(ENABLE_COMBOS
        ? [
            {
              id: 'deal-soc',
              label: t('dealHot'),
              href: '/#combo',
              icon: Flame,
              color: 'text-red-500',
              badge: 'HOT',
            },
          ]
        : []),
      {
        id: 'ban-chay',
        label: t('bestSellers'),
        href: '/#san-pham',
        icon: Sparkles,
        color: 'text-amber-500',
      },
      ...(MEMBERSHIP_CONFIG.ENABLE_MEMBERSHIP
        ? [
            {
              id: 'member-prime',
              label: 'Thái Sơn Prime',
              href: '/member',
              icon: Crown,
              color: 'text-amber-500',
              badge: 'HOT',
            },
          ]
        : []),
      {
        id: 'dich-vu',
        label: t('wholesaleService'),
        href: '/#kho-si',
        icon: Truck,
        color: 'text-emerald-700',
      },
      {
        id: 'ho-tro',
        label: t('shoppingSupport'),
        href: '#ho-tro',
        action: 'open-support',
        icon: Headphones,
        color: 'text-forest-700',
      },
    ],
    [t]
  );

  const totalQuantity = useCartStore((s) => s.items.reduce((t, i) => t + i.quantity, 0));

  useEffect(() => {
    setIsMounted(true);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Click outside to close live search & language dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setIsLangDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setIsUserDropdownOpen(false);
      }
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)) {
        // do not auto close mobile search if clicking inside
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products for Live Search suggestions
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return liveProducts
      .filter((p) => matchesProductQuery(p, searchQuery))
      .slice(0, 4);
  }, [searchQuery, liveProducts]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchFocused(false);
    setIsMobileSearchOpen(false);
    // Nếu có kết quả tìm kiếm khớp chính xác, vào trang chi tiết luôn
    const match = liveProducts.find((p) => matchesProductQuery(p, searchQuery));
    if (match) {
      router.push(`/san-pham/${match.slug}`);
    } else {
      // Không tìm thấy → về trang chủ phần sản phẩm
      router.push('/#san-pham');
    }
    setSearchQuery('');
  };

  const handleSelectProduct = (slug: string) => {
    setIsSearchFocused(false);
    setIsMobileSearchOpen(false);
    setSearchQuery('');
    router.push(`/san-pham/${slug}`);
  };

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 transition-all duration-300 bg-white shadow-xs',
          isScrolled ? 'shadow-sm' : ''
        )}
      >
        {/* Thanh hiển thị chi nhánh đang chọn & đổi chi nhánh */}
        <BranchTopBar />

        {/* TẦNG 1: MAIN HEADER (Logo - Thanh Search đẹp - Tiện ích tài khoản & giỏ hàng) */}
        <div className="section-container">
          <div
            className={cn(
              'flex items-center justify-between transition-all duration-300',
              isScrolled ? 'h-[64px] md:h-[68px]' : 'h-[72px] md:h-[80px]'
            )}
          >
            {/* 1. Logo Thái Sơn Foods - Bấm logo load lại trang */}
            <Link
              href="/"
              onClick={(e) => {
                e.preventDefault();
                if (typeof window !== 'undefined') {
                  if (window.location.pathname === '/' && !window.location.search) {
                    window.location.reload();
                  } else {
                    window.location.href = '/';
                  }
                }
              }}
              className="flex items-center shrink-0 cursor-pointer"
              aria-label="Thái Sơn Foods - Trang chủ"
            >
              <div className="relative h-12 w-[140px] sm:h-14 sm:w-52 md:h-16 md:w-[230px]">
                <Image
                  src="/images/logo-vien-trang.png"
                  alt="Thái Sơn Foods - Món ngon quê Việt"
                  fill
                  sizes="230px"
                  className="object-contain object-left"
                  priority
                />
              </div>
            </Link>

            {/* 1b. "Giao đến" cạnh logo — CHỈ hiện ở trang chi tiết sản phẩm khi bật giao diện mới */}
            {showDeliverTo && (
              <button
                type="button"
                onClick={openBranchModal}
                className="hidden lg:flex items-end gap-1 shrink-0 max-w-[180px] px-2 py-1.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 text-left cursor-pointer"
                aria-label="Chọn chi nhánh giao hàng"
              >
                <MapPin className="w-4 h-4 text-green-primary shrink-0 mb-0.5" aria-hidden />
                <span className="min-w-0 leading-tight">
                  <span className="block text-[11px] text-gray-500">Giao từ chi nhánh</span>
                  <span className="block text-[15px] text-gray-900 truncate">
                    {selectedBranch?.name || 'Chọn chi nhánh'}
                  </span>
                </span>
              </button>
            )}

            {/* 2. Thanh Search đẹp mắt ở giữa (Thay thế vùng ô đỏ trước đây) */}
            <div
              ref={searchRef}
              className="hidden md:flex flex-1 max-w-md lg:max-w-xl mx-4 lg:mx-8 relative"
            >
              <form onSubmit={handleSearchSubmit} className="w-full relative">
                <div className="relative flex items-center w-full">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    placeholder={t('searchPlaceholder')}
                    className="w-full pl-10 pr-24 py-2.5 bg-gray-50/90 hover:bg-gray-100/70 focus:bg-white text-base sm:text-sm text-gray-800 rounded-full border border-gray-200/90 focus:border-forest-700 focus:ring-2 focus:ring-forest-700/15 focus:outline-none transition-all shadow-2xs placeholder:text-gray-400 font-medium"
                  />
                  <Search className="absolute left-3.5 w-4 h-4 text-emerald-700 pointer-events-none" />

                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-22 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                      title="Xóa tìm kiếm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="submit"
                    className="absolute right-1.5 px-3.5 py-1.5 bg-forest-700 hover:bg-forest-800 text-white text-sm rounded-full transition-all flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">{t('searchBtn')}</span>
                  </button>
                </div>
              </form>

              {/* Live Search Popup / Dropdown gợi ý sản phẩm */}
              {isSearchFocused && searchQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fade-in-up">
                  <div className="p-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between text-sm text-gray-700">
                    <span>{language === 'vi' ? 'Sản phẩm gợi ý cho' : 'Suggested products for'} &quot;{searchQuery}&quot;</span>
                    <span className="text-emerald-700 font-medium">{searchResults.length} {language === 'vi' ? 'kết quả' : 'results'}</span>
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="p-2 divide-y divide-gray-50">
                      {searchResults.map((item) => {
                        const itemVariant = item.variants && item.variants.length > 0
                          ? [...item.variants].sort((a, b) => (a.quantity || 0) - (b.quantity || 0))[0]
                          : null;
                        const isBigBottle = item.slug?.includes('yoo') || item.volume?.includes('568') || item.price === 25000;
                        const itemQty = itemVariant ? itemVariant.quantity : (isBigBottle ? 5 : 7);
                        const itemPrice = itemVariant ? itemVariant.price : (item.price * itemQty);
                        const itemUnitStr = language === 'en'
                          ? `Pack of ${itemQty}`
                          : `lốc ${itemQty} chai`;

                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectProduct(item.slug)}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-emerald-50/50 transition-colors cursor-pointer group"
                          >
                            <div className="relative w-12 h-12 rounded-lg bg-ivory border border-gray-200/80 p-1 overflow-hidden shrink-0">
                              <Image
                                src={item.thumbnail}
                                alt={language === 'en' && item.nameEn ? item.nameEn : item.name}
                                fill
                                className="object-contain transition-transform"
                                sizes="48px"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm sm:text-base text-gray-900 group-hover:text-forest-700 transition-colors leading-snug">
                                {language === 'en' && item.nameEn ? item.nameEn : item.name}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-sm text-emerald-700">
                                  {formatPrice(itemPrice)} ₫
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  /{itemUnitStr}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-forest-700 transition-colors" />
                          </div>
                        );
                      })}
                      <div className="pt-2 px-2 pb-1">
                        <button
                          onClick={handleSearchSubmit}
                          className="w-full py-2 bg-emerald-50 hover:bg-emerald-100/70 text-forest-700 text-sm rounded-xl transition-colors text-center"
                        >
                          {language === 'vi' ? 'Xem tất cả sản phẩm liên quan →' : 'View all related products →'}
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

            {/* 3. Tiện ích bên phải (Hotline, Language Switcher, Search mobile, User, Cart) */}
            <div className="flex items-center gap-1 min-[400px]:gap-1.5 sm:gap-2 min-w-0">
              {/* Nút tìm kiếm mobile */}
              <button
                onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                className="md:hidden p-2.5 text-gray-700 hover:text-green-primary hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                aria-label={language === 'en' ? 'Open search' : 'Mở tìm kiếm'}
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Nút Hotline / Hỗ trợ nhanh */}
              <button
                onClick={() => setIsSupportModalOpen(true)}
                className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/50 hover:bg-emerald-100/50 text-forest-700 text-sm transition-all cursor-pointer"
                title="Trung tâm hỗ trợ khách hàng"
              >
                <Headphones className="w-3.5 h-3.5 text-emerald-700" />
                <span>{t('support247')}</span>
              </button>

              {/* Nút Chuyển ngữ Tiếng Anh / Tiếng Việt (Language Switcher) */}
              <div ref={langDropdownRef} className="relative hidden min-[400px]:block">
                <button
                  type="button"
                  onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full border border-gray-200/90 bg-gray-50/90 hover:bg-emerald-50/70 hover:border-emerald-300 text-gray-800 text-sm transition-all cursor-pointer shadow-2xs group"
                  aria-label={t('changeLanguage')}
                  title={t('changeLanguage')}
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-700 transition-transform" />
                  <span className="text-[12px] sm:text-sm tracking-wider">
                    {language === 'vi' ? 'VI' : 'EN'}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-3 h-3 text-gray-400 transition-transform duration-200',
                      isLangDropdownOpen ? 'rotate-180 text-emerald-700' : ''
                    )}
                  />
                </button>

                {/* Dropdown Menu Ngôn ngữ */}
                {isLangDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-38 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setLanguage('vi');
                        setIsLangDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors cursor-pointer text-left',
                        language === 'vi'
                          ? 'bg-emerald-50/90 text-emerald-800'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-emerald-700'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm">🇻🇳</span>
                        <span>Tiếng Việt</span>
                      </span>
                      {language === 'vi' && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLanguage('en');
                        setIsLangDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors cursor-pointer text-left',
                        language === 'en'
                          ? 'bg-emerald-50/90 text-emerald-800'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-emerald-700'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm">🇬🇧</span>
                        <span>English</span>
                      </span>
                      {language === 'en' && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Nút Tài khoản / Đăng nhập */}
              <div ref={userDropdownRef} className="relative hidden sm:block">
                {!user ? (
                  <button
                    type="button"
                    onClick={() => openAuthModal('login')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200/90 bg-gray-50/90 hover:bg-emerald-50/70 hover:border-emerald-300 text-gray-800 text-sm transition-all cursor-pointer shadow-2xs group"
                    aria-label={language === 'en' ? 'Sign In / Register' : 'Đăng nhập / Đăng ký'}
                    title={language === 'en' ? 'Sign In / Register' : 'Đăng nhập / Đăng ký'}
                  >
                    <User className="w-3.5 h-3.5 text-emerald-700 transition-transform" />
                    <span className="hidden md:inline text-[1.125em]">
                      {language === 'en' ? 'Sign In' : 'Đăng nhập'}
                    </span>
                  </button>
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/60 text-emerald-900 text-sm transition-all cursor-pointer shadow-2xs"
                      aria-label="Tài khoản cá nhân"
                    >
                      <span className="w-6 h-6 rounded-full bg-forest-700 text-white flex items-center justify-center text-[12px] shadow-2xs">
                        {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                      </span>
                      <span className="hidden md:inline max-w-[110px] truncate">
                        {user.fullName.split(' ').slice(-1)[0]}
                      </span>
                      <ChevronDown
                        className={cn(
                          'w-3 h-3 text-emerald-700 transition-transform duration-200',
                          isUserDropdownOpen ? 'rotate-180' : ''
                        )}
                      />
                    </button>

                    {/* Dropdown Menu */}
                    {isUserDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm text-gray-900 line-clamp-1">{user.fullName}</p>
                          <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                        </div>
                        <Link
                          href="/tai-khoan?tab=orders"
                          onClick={() => setIsUserDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-forest-700 transition-colors"
                        >
                          <ShoppingBag className="w-4 h-4 text-emerald-700" />
                          <span>{language === 'en' ? 'My Orders' : 'Đơn hàng của tôi'}</span>
                        </Link>
                        <Link
                          href="/tai-khoan?tab=profile"
                          onClick={() => setIsUserDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-forest-700 transition-colors"
                        >
                          <User className="w-4 h-4 text-emerald-700" />
                          <span>{language === 'en' ? 'Account Details' : 'Thông tin tài khoản'}</span>
                        </Link>
                        {MEMBERSHIP_CONFIG.ENABLE_MEMBERSHIP && (
                          <Link
                            href="/member"
                            onClick={() => setIsUserDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-amber-800 hover:bg-amber-50 transition-colors"
                          >
                            <span>Thái Sơn Prime</span>
                          </Link>
                        )}
                        {MEMBERSHIP_CONFIG.ENABLE_SUBSCRIBE_SAVE && (
                          <Link
                            href="/tai-khoan/dinh-ky"
                            onClick={() => setIsUserDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-50 transition-colors"
                          >
                            <RefreshCw className="w-4 h-4 text-emerald-600" />
                            <span>Lịch Giao Định Kỳ</span>
                          </Link>
                        )}
                        <div className="pt-1 border-t border-gray-100 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsUserDropdownOpen(false);
                              logout();
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>{language === 'en' ? 'Log Out' : 'Đăng xuất'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Giỏ hàng — Chuyển hướng trực tiếp sang trang Giỏ hàng lớn (/gio-hang) */}
              <Link
                href="/gio-hang"
                id="cart-target-header"
                className={cn(
                  'relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-full border transition-all cursor-pointer shadow-2xs group',
                  isMounted && totalQuantity > 0
                    ? 'border-emerald-600/35 bg-emerald-50/90 hover:bg-emerald-100 hover:border-emerald-500 text-emerald-950'
                    : 'border-gray-200/90 bg-gray-50/90 hover:bg-emerald-50/70 hover:border-emerald-300 text-gray-800'
                )}
                aria-label={
                  language === 'en'
                    ? `Cart, ${isMounted ? totalQuantity : 0} items`
                    : `Giỏ hàng, ${isMounted ? totalQuantity : 0} sản phẩm`
                }
                title={language === 'en' ? 'Shopping Cart' : 'Giỏ hàng'}
              >
                <div className="relative flex items-center justify-center">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-700 transition-transform" />
                  {/* Badge số lượng trên Mobile (< sm) */}
                  {isMounted && totalQuantity > 0 && (
                    <span
                      key={`mobile-badge-${totalQuantity}`}
                      className="sm:hidden absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center px-1 text-[11px] text-white bg-sale rounded-full animate-pulse-badge shadow-2xs"
                    >
                      {totalQuantity > 99 ? '99+' : totalQuantity}
                    </span>
                  )}
                </div>

                <span className="hidden sm:inline text-sm">
                  {language === 'en' ? 'Cart' : 'Giỏ hàng'}
                </span>

                {/* Badge số lượng trên Desktop (>= sm) */}
                <span
                  key={`desktop-badge-${totalQuantity}`}
                  className={cn(
                    'hidden sm:inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[12px] transition-all',
                    isMounted && totalQuantity > 0
                      ? 'bg-forest-700 text-white shadow-2xs animate-pulse-badge'
                      : 'bg-gray-200/80 text-gray-600'
                  )}
                >
                  {isMounted ? (totalQuantity > 99 ? '99+' : totalQuantity) : 0}
                </span>
              </Link>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2.5 text-text-body hover:text-green-primary transition-colors rounded-lg cursor-pointer"
                aria-label={isMobileMenuOpen ? (language === 'en' ? 'Close menu' : 'Đóng menu') : (language === 'en' ? 'Open menu' : 'Mở menu')}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Ô Search mở rộng trên Mobile khi nhấn nút Search */}
        {isMobileSearchOpen && (
          <div ref={mobileSearchRef} className="md:hidden px-4 pb-3 pt-1 border-t border-gray-100 bg-white animate-fade-in-up">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'en' ? 'Search products...' : 'Tìm kiếm sản phẩm...'}
                className="w-full pl-9 pr-20 py-2.5 bg-gray-50 text-base text-gray-800 rounded-full border border-gray-200 focus:border-forest-700 focus:outline-none"
              />
              <Search className="absolute left-3 w-4 h-4 text-gray-400" />
              <button
                type="submit"
                className="absolute right-1 px-4 py-2 bg-forest-700 text-white text-sm rounded-full"
              >
                {language === 'en' ? 'Search' : 'Tìm'}
              </button>
            </form>
          </div>
        )}

        {/* TẦNG 2: THANH TASKBAG (Taskbag / Sub-navigation bar) */}
        <div className="border-t border-gray-100 bg-ivory">
          <div className="section-container">
            <div className="flex items-center justify-between h-11">
              {/* 4 Mục Taskbag chính */}
              <nav
                className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide py-1 -mx-2 px-2"
                aria-label="Thanh tác vụ điều hướng"
              >
                {taskbagItems.map((item) => {
                  if (item.action === 'open-support') {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setIsSupportModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-3 md:py-1.5 rounded-lg text-sm md:text-base text-gray-700 hover:text-forest-700 hover:bg-emerald-50/80 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                      >
                        <span>{item.label}</span>
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center gap-1.5 px-3 py-3 md:py-1.5 rounded-lg text-sm md:text-base text-gray-700 hover:text-green-primary hover:bg-ivory-dark/60 transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 text-[10px] text-white bg-red-500 rounded-full animate-pulse">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* Cam kết thương hiệu bên phải (desktop) */}
              <div className="hidden lg:flex items-center gap-3 text-xs text-gray-500 font-medium shrink-0">
                <span className="flex items-center gap-1 text-emerald-800">
                  {t('naturalIngredients')}
                </span>
                <span className="text-gray-300">•</span>
                <span className="flex items-center gap-1 text-gray-600">
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  {t('fastDelivery')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu Dropdown */}
        <div
          className={cn(
            'lg:hidden overflow-hidden transition-all duration-300 bg-white border-t border-border-light',
            isMobileMenuOpen ? 'max-h-[520px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <nav className="section-container py-4 flex flex-col gap-1" aria-label="Menu di động">
            {/* User Account Bar in Mobile */}
            {user ? (
              <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 mb-2 flex items-center justify-between">
                <Link
                  href="/tai-khoan"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 min-w-0 flex-1"
                >
                  <div className="w-9 h-9 rounded-xl bg-forest-700 text-white flex items-center justify-center text-base shrink-0">
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-gray-900 truncate">{user.fullName}</div>
                    <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
                  </div>
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href="/tai-khoan?tab=orders"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 text-emerald-800 hover:bg-emerald-100/70 rounded-lg text-xs"
                    title="Đơn hàng"
                  >
                    <ShoppingBag className="w-4 h-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      logout();
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs cursor-pointer"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-2 p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-800">
                    {language === 'en' ? 'Customer Account' : 'Tài khoản khách hàng'}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {language === 'en' ? 'Track orders & fast checkout' : 'Theo dõi đơn hàng & tích điểm'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    openAuthModal('login');
                  }}
                  className="px-4 py-2.5 bg-forest-700 hover:bg-forest-800 text-white text-sm rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  {language === 'en' ? 'Sign In' : 'Đăng nhập'}
                </button>
              </div>
            )}

            {taskbagItems.map((item) => {
              const Icon = item.icon;
              if (item.action === 'open-support') {
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsSupportModalOpen(true);
                    }}
                    className="flex items-center gap-2.5 px-4 py-3 text-lg text-text-body hover:text-green-primary hover:bg-ivory-dark/50 rounded-lg transition-colors text-left cursor-pointer"
                  >
                    <Icon className={cn('w-4.5 h-4.5', item.color)} />
                    <span>{item.label}</span>
                  </button>
                );
              }
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-3 text-lg text-text-body hover:text-green-primary hover:bg-ivory-dark/50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={cn('w-4.5 h-4.5', item.color)} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-[11px] text-white bg-red-500 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Chuyển ngữ trong Mobile Menu */}
            <div className="pt-3 mt-2 border-t border-gray-100 flex items-center justify-between px-4">
              <span className="text-sm text-gray-600 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-700" />
                <span>{t('changeLanguage')}</span>
              </span>
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setLanguage('vi')}
                  className={cn(
                    'px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer',
                    language === 'vi'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  )}
                >
                  🇻🇳 VI
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={cn(
                    'px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer',
                    language === 'en'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  )}
                >
                  🇬🇧 EN
                </button>
              </div>
            </div>
          </nav>
        </div>
      </header>

      {/* MODAL HỖ TRỢ MUA HÀNG (Khai mở khi bấm mục "Hỗ trợ mua hàng" trên thanh Taskbag) */}
      {isSupportModalOpen && isMounted && (
        <div
          onClick={() => setIsSupportModalOpen(false)}
          className="fixed inset-0 z-[99999] bg-ink-950/60 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in-up"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-forest-700 flex items-center justify-center">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-gray-900 text-lg leading-tight">
                    {t('supportTitle')}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {t('supportSubtitle')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSupportModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                aria-label={t('close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nội dung hỗ trợ */}
            <div className="p-5 space-y-3.5">
              {/* Kênh 1: Hotline gọi trực tiếp */}
              <a
                href="tel:02862915024"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 hover:bg-emerald-100/70 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-forest-700 text-white flex items-center justify-center shadow-xs">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">{t('hotlineConsult')}</div>
                    <div className="text-lg text-gray-900 group-hover:text-forest-700">
                      028 6291 5024
                    </div>
                  </div>
                </div>
                <span className="text-sm text-white bg-forest-700 px-3 py-1.5 rounded-xl shadow-2xs">
                  {t('callNow')}
                </span>
              </a>

              {/* Kênh 2: Tư vấn Zalo */}
              <a
                href="https://zalo.me/0903050568"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 hover:bg-blue-100/70 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0068FF] text-white flex items-center justify-center shadow-xs text-sm">
                    Zalo
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">{t('zaloChat')}</div>
                    <div className="text-base text-gray-900 group-hover:text-[#0068FF]">
                      Thái Sơn Foods Official
                    </div>
                  </div>
                </div>
                <span className="text-sm text-[#0068FF] bg-white border border-blue-200 px-3 py-1.5 rounded-xl shadow-2xs">
                  {t('chatImmediate')}
                </span>
              </a>

              {/* Thông tin giờ làm việc & Cam kết */}
              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 space-y-2 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span><strong className="text-[1.125em]">{language === 'vi' ? 'Thời gian phục vụ:' : 'Service hours:'}</strong> {language === 'vi' ? '07:30 - 21:30 hàng ngày' : '07:30 - 21:30 daily'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span><strong className="text-[1.125em]">{language === 'vi' ? 'Giao hàng:' : 'Delivery:'}</strong> {language === 'vi' ? 'Hỏa tốc trong 2 giờ tại TP.HCM & lân cận' : 'Express delivery in 2 hours in HCMC'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span><strong className="text-[1.125em]">{language === 'vi' ? 'Đổi trả:' : 'Returns:'}</strong> {language === 'vi' ? 'Đổi mới 100% nếu sản phẩm có bất kỳ lỗi nào' : '100% exchange if any issue'}</span>
                </div>
              </div>

              {/* Nút đóng */}
              <button
                onClick={() => setIsSupportModalOpen(false)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm transition-colors cursor-pointer"
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

