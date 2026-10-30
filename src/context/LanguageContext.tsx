'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Language = 'vi' | 'en';

export const translations = {
  vi: {
    // Header
    searchPlaceholder: 'Tìm kiếm theo bắp, sữa hạt sen, combo đồ uống...',
    searchBtn: 'Tìm kiếm',
    searchHints: 'Gợi ý tìm kiếm:',
    support247: 'Hỗ trợ (07:00–21:30)',
    account: 'Tài khoản',
    cart: 'Giỏ hàng',
    menu: 'Menu',
    close: 'Đóng',
    changeLanguage: 'Chuyển đổi ngôn ngữ',
    vietnamese: 'Tiếng Việt',
    english: 'English',

    // Taskbar Navigation
    dealHot: 'Deal Sốc',
    bestSellers: 'Sản phẩm bán chạy',
    wholesaleService: 'Dịch vụ bán hàng',
    shoppingSupport: 'Hỗ trợ mua hàng',
    naturalIngredients: 'Nguyên liệu tự nhiên',
    fastDelivery: 'Giao hàng nhanh',

    // Support Modal
    supportTitle: 'Trung Tâm Hỗ Trợ Khách Hàng',
    supportSubtitle: 'Đội ngũ Thái Sơn Foods luôn sẵn sàng hỗ trợ bạn từ 7:30 đến 21:30 hàng ngày.',
    hotlineConsult: 'Hotline đặt hàng & tư vấn',
    zaloChat: 'Nhắn tin Zalo Official',
    chatImmediate: 'Trò chuyện ngay',
    callNow: 'Gọi ngay',
    workHours: 'Thời gian làm việc: 7:30 - 21:30 (Thứ 2 - Chủ Nhật)',
    freeShippingNotice: 'Giao hàng nhanh nội thành TP.HCM • Miễn phí vận chuyển cho đơn từ 200.000đ',

    // Live search
    noProductsFound: 'Không tìm thấy sản phẩm nào khớp với từ khóa',
    tryAnotherKeyword: 'Hãy thử từ khóa khác!',
    unitChai: 'chai',

    // Product Section & Card
    productsTitle: 'Sản phẩm Thái Sơn',
    viewAll: 'Xem tất cả',
    bestSellerBadge: 'Bán chạy',
    newBadge: 'Mới',
    addToCart: 'Thêm vào giỏ',
    addedToCart: 'Đã thêm vào giỏ hàng!',
    perUnitBottle: 'chai',
    perUnitPack: 'lốc',
    perUnitCarton: 'thùng',
    prevProducts: 'Xem sản phẩm trước',
    nextProducts: 'Xem thêm sản phẩm',

    // Combo Section
    combosTitle: 'Combo tiết kiệm',
    viewAllCombos: 'Xem tất cả combo',
    customizeCombo: 'Tùy chọn vị combo',
    addComboToCart: 'Thêm combo vào giỏ hàng',
    viewComboDetails: 'Xem chi tiết',
    bottles: 'chai',

    // Warehouse & Why Choose Us
    whyChooseTitle: 'VÌ SAO THÁI SƠN FOODS ĐƯỢC TIN CHỌN?',
    wholesaleHotline: 'Hotline sỉ: 028 6291 5024',
    viewProducts: 'Xem sản phẩm',

    // Footer
    footerCompany: 'Công ty',
    footerProducts: 'Sản phẩm',
    footerNutMilk: 'Sữa hạt',
    footerRefreshments: 'Nước giải khát',
    footerMilkTea: 'Trà sữa',
    footerSupport: 'Hỗ trợ',
    footerShipping: 'Chính sách giao hàng',
    footerContact: 'Liên hệ',
    footerConnect: 'Kết nối',
    footerFreeShipping: 'Miễn phí vận chuyển nội thành TP.HCM cho đơn hàng từ',
    footerRights: '© 2026 Thái Sơn Foods. All rights reserved.',

    // Cart & Drawer
    cartTitle: 'Giỏ hàng',
    yourCart: 'Giỏ hàng của bạn',
    cartEmptyTitle: 'Giỏ hàng của bạn đang trống',
    cartEmptyDesc: 'Hãy chọn những sản phẩm thơm ngon từ Thái Sơn Foods nhé!',
    exploreProducts: 'Khám phá sản phẩm',
    subtotal: 'Tạm tính:',
    quickOrderCod: 'Đặt hàng',
    viewCartDetails: 'Xem chi tiết giỏ hàng',
    clearAll: 'Xóa tất cả',
    codPaymentNotice: 'Thanh toán khi nhận hàng (COD)',
    freeShippingUnlocked: 'Bạn được MIỄN PHÍ VẬN CHUYỂN!',
    freeShippingAddMore: 'Mua thêm',
    forFreeShipping: 'để được freeship',
    nameInputPlaceholder: 'Họ và tên của bạn *',
    phoneInputPlaceholder: 'Số điện thoại *',
    addressInputPlaceholder: 'Địa chỉ giao hàng chi tiết *',
    backBtn: 'Quay lại',
    confirmOrderBtn: 'Xác nhận đặt hàng',
    submittingBtn: 'Đang gửi...',
  },
  en: {
    // Header
    searchPlaceholder: 'Search by corn milk, lotus milk, drink combos...',
    searchBtn: 'Search',
    searchHints: 'Popular searches:',
    support247: 'Support (7:00–21:30)',
    account: 'Account',
    cart: 'Cart',
    menu: 'Menu',
    close: 'Close',
    changeLanguage: 'Change Language',
    vietnamese: 'Tiếng Việt',
    english: 'English',

    // Taskbar Navigation
    dealHot: 'Hot Deals',
    bestSellers: 'Best Sellers',
    wholesaleService: 'Wholesale & B2B',
    shoppingSupport: 'Customer Care',
    naturalIngredients: '100% Natural',
    fastDelivery: 'Express Delivery',

    // Support Modal
    supportTitle: 'Customer Support Center',
    supportSubtitle: 'Thai Son Foods team is always ready to assist you daily from 7:30 AM to 9:30 PM.',
    hotlineConsult: 'Ordering Hotline & Consulting',
    zaloChat: 'Zalo Official Chat',
    chatImmediate: 'Chat Now',
    callNow: 'Call Now',
    workHours: 'Working hours: 7:30 AM - 9:30 PM (Mon - Sun)',
    freeShippingNotice: 'Fast delivery in HCMC • Free shipping on orders from 200,000 VND',

    // Live search
    noProductsFound: 'No products found matching',
    tryAnotherKeyword: 'Please try another keyword!',
    unitChai: 'bottle',

    // Product Section & Card
    productsTitle: 'Thai Son Products',
    viewAll: 'View all',
    bestSellerBadge: 'Best Seller',
    newBadge: 'New',
    addToCart: 'Add to Cart',
    addedToCart: 'Added to cart!',
    perUnitBottle: 'bottle',
    perUnitPack: 'pack',
    perUnitCarton: 'carton',
    prevProducts: 'Previous products',
    nextProducts: 'Next products',

    // Combo Section
    combosTitle: 'Value Combos',
    viewAllCombos: 'View all combos',
    customizeCombo: 'Customize Combo',
    addComboToCart: 'Add combo to cart',
    viewComboDetails: 'View details',
    bottles: 'bottles',

    // Warehouse & Why Choose Us
    whyChooseTitle: 'WHY CHOOSE THAI SON FOODS?',
    wholesaleHotline: 'Wholesale Hotline: 028 6291 5024',
    viewProducts: 'Explore Products',

    // Footer
    footerCompany: 'Company',
    footerProducts: 'Products',
    footerNutMilk: 'Nut Milk',
    footerRefreshments: 'Refreshments',
    footerMilkTea: 'Milk Tea',
    footerSupport: 'Support',
    footerShipping: 'Shipping Policy',
    footerContact: 'Contact Us',
    footerConnect: 'Follow Us',
    footerFreeShipping: 'Free shipping within Ho Chi Minh City for orders from',
    footerRights: '© 2026 Thai Son Foods. All rights reserved.',

    // Cart & Drawer
    cartTitle: 'Shopping Cart',
    yourCart: 'Your Cart',
    cartEmptyTitle: 'Your cart is empty',
    cartEmptyDesc: 'Discover fresh & delicious healthy drinks from Thai Son Foods!',
    exploreProducts: 'Explore Products',
    subtotal: 'Subtotal:',
    quickOrderCod: 'Place Order',
    viewCartDetails: 'View Full Cart',
    clearAll: 'Clear all',
    codPaymentNotice: 'Cash on Delivery (COD)',
    freeShippingUnlocked: 'You have unlocked FREE SHIPPING!',
    freeShippingAddMore: 'Add',
    forFreeShipping: 'more for free shipping',
    nameInputPlaceholder: 'Your full name *',
    phoneInputPlaceholder: 'Phone number *',
    addressInputPlaceholder: 'Detailed delivery address *',
    backBtn: 'Back',
    confirmOrderBtn: 'Confirm Order',
    submittingBtn: 'Submitting...',
  },
} as const;

export type TranslationKey = keyof typeof translations['vi'];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'vi',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => translations.vi[key] || key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('vi');

  // Load language preference from localStorage
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('tsf_language') as Language;
      if (savedLang === 'vi' || savedLang === 'en') {
        setLanguageState(savedLang);
        document.documentElement.lang = savedLang;
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('tsf_language', lang);
      document.documentElement.lang = lang;
    } catch {
      // Ignore
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next: Language = prev === 'vi' ? 'en' : 'vi';
      try {
        localStorage.setItem('tsf_language', next);
        document.documentElement.lang = next;
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      const langDict = translations[language] || translations.vi;
      return (langDict as any)[key] || translations.vi[key] || key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
