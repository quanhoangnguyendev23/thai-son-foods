'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronUp, Mail, MapPin, Phone, Truck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useUserAuth } from '@/context/UserAuthContext';
import { INVENTORY_CONFIG } from '@/config/inventory';
import { ENABLE_COMBOS } from '@/config/features';
import { categories as catalogCategories } from '@/data/products';
import { formatPrice } from '@/lib/utils';
import { HAS_LEGAL_LINKS, LegalCompanyBlock, LegalPolicyLinks } from '@/components/layout/FooterLegal';

/**
 * FOOTER BIẾN THỂ AMAZON — chỉ dùng cho trang chủ mới. Footer.tsx gốc giữ nguyên cho các trang khác.
 * Giữ đủ nội dung Footer gốc: logo, Công ty (địa chỉ, hotline, email), Sản phẩm, Hỗ trợ,
 * Kết nối (Facebook / YouTube / Instagram), miễn phí vận chuyển, bản quyền.
 * Bổ sung theo bố cục Amazon: thanh "Về đầu trang", cột "Tài khoản của bạn", thanh đáy logo + ngôn ngữ.
 */

function FacebookIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function YoutubeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function InstagramIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TiktokIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}
const CATEGORY_ORDER = ['sua-hat', 'nuoc-giai-khat', 'tra-sua'];
const linkCls = 'hover:text-corn hover:underline transition-colors py-1.5 inline-block';
const headingCls = 'font-heading text-[17px] uppercase tracking-wider text-corn mb-3';

export default function FooterAmazon() {
  const { language, setLanguage } = useLanguage();
  const { user, openAuthModal } = useUserAuth();
  const isEn = language === 'en';
  const categoryLinks = [...catalogCategories].sort((a, b) => CATEGORY_ORDER.indexOf(a.id) - CATEGORY_ORDER.indexOf(b.id));

  const scrollToTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <footer className="text-white">
      {/* VỀ ĐẦU TRANG */}
      <button
        type="button"
        onClick={scrollToTop}
        className="w-full flex items-center justify-center gap-1.5 bg-green-light hover:bg-emerald-600 py-3.5 text-[15px] transition-colors cursor-pointer"
      >
        <ChevronUp className="w-4 h-4" />
        {isEn ? 'Back to top' : 'Về đầu trang'}
      </button>

      {/* CÁC CỘT */}
      <div className="bg-green-primary">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10 grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-8 text-[14px] text-white/90">
          <div>
            <h3 className={headingCls}>{isEn ? 'Company' : 'Công ty'}</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4.5 h-4.5 mt-0.5 shrink-0 text-corn" />
                <p className="leading-snug">
                  {isEn ? '2C Pho Quang, Tan Son Hoa Ward, Ho Chi Minh City' : '2C Phổ Quang, Phường Tân Sơn Hòa, TP. Hồ Chí Minh'}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4.5 h-4.5 shrink-0 text-corn" />
                <a href="tel:02862915024" className={linkCls}>Hotline: 028 6291 5024</a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4.5 h-4.5 shrink-0 text-corn" />
                <a href="mailto:sbnts.htkd@tsf.com.vn" className={`${linkCls} break-all`}>sbnts.htkd@tsf.com.vn</a>
              </div>
            </div>
          </div>

          <div>
            <h3 className={headingCls}>{isEn ? 'Products' : 'Sản phẩm'}</h3>
            <ul>
              {categoryLinks.map((c) => (
                <li key={c.id}>
                  <Link href={`/#danh-muc-${c.id}`} className={linkCls}>
                    {isEn && c.nameEn ? c.nameEn : c.name}
                  </Link>
                </li>
              ))}
              {ENABLE_COMBOS && (
                <li>
                  <Link href="/#combo" className={linkCls}>{isEn ? 'Value combos' : 'Combo tiết kiệm'}</Link>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h3 className={headingCls}>{isEn ? 'Your account' : 'Tài khoản của bạn'}</h3>
            <ul>
              <li>
                {user ? (
                  <Link href="/tai-khoan?tab=profile" className={linkCls}>{isEn ? 'Account details' : 'Thông tin tài khoản'}</Link>
                ) : (
                  <button type="button" onClick={() => openAuthModal('login')} className={`${linkCls} cursor-pointer`}>
                    {isEn ? 'Sign in / Register' : 'Đăng nhập / Đăng ký'}
                  </button>
                )}
              </li>
              <li>
                {user ? (
                  <Link href="/tai-khoan?tab=orders" className={linkCls}>{isEn ? 'Your orders' : 'Đơn hàng của tôi'}</Link>
                ) : (
                  <button type="button" onClick={() => openAuthModal('login')} className={`${linkCls} cursor-pointer`}>
                    {isEn ? 'Your orders' : 'Đơn hàng của tôi'}
                  </button>
                )}
              </li>
              <li>
                <Link href="/gio-hang" className={linkCls}>{isEn ? 'Shopping cart' : 'Giỏ hàng'}</Link>
              </li>
            </ul>
          </div>

          <div>
            {/* Link chính sách lấy từ src/config/legal.ts — chỉ hiện link đã điền (thay cho link "/#" tạm) */}
            {HAS_LEGAL_LINKS && (
              <>
                <h3 className={headingCls}>{isEn ? 'Support' : 'Hỗ trợ'}</h3>
                <ul className="mb-5">
                  <LegalPolicyLinks isEn={isEn} className={linkCls} />
                </ul>
              </>
            )}
            <h3 className={headingCls}>{isEn ? 'Follow Us' : 'Kết nối'}</h3>
            <div className="flex items-center gap-3">
              <a href="https://www.facebook.com/suabapnepthaison" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl hover:bg-corn hover:text-text-dark transition-colors">
                <FacebookIcon />
              </a>
              <a href="https://www.youtube.com/channel/UCiyHE1-nGSmHRaFb-OgZfMA" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl hover:bg-corn hover:text-text-dark transition-colors">
                <YoutubeIcon />
              </a>
              <a href="https://instagram.com/suabapnepthaison" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl hover:bg-corn hover:text-text-dark transition-colors">
                <InstagramIcon />
              </a>
              <a href="https://www.tiktok.com/@thaisonsuabap" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl hover:bg-corn hover:text-text-dark transition-colors">
                <TiktokIcon />
              </a>
            </div>
          </div>
        </div>

        {/* Thông tin pháp lý doanh nghiệp + logo Bộ Công Thương (src/config/legal.ts, trống thì ẩn) */}
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 empty:hidden">
          <LegalCompanyBlock isEn={isEn} className="pb-6" />
        </div>

        {/* Miễn phí vận chuyển — ngưỡng lấy từ INVENTORY_CONFIG (cùng giá trị 200.000đ với Footer gốc) */}
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 pb-8">
          <div className="p-4 bg-white/10 rounded-xl text-[14px] sm:text-[15px] flex items-center gap-3 border border-white/10">
            <Truck className="w-5 h-5 text-corn shrink-0" />
            <span className="font-medium">
              {isEn
                ? 'Free shipping within Ho Chi Minh City on orders from '
                : 'Miễn phí vận chuyển nội thành TP.HCM cho đơn hàng từ '}
              <span className="text-corn text-[1.125em]">{formatPrice(INVENTORY_CONFIG.SHIPPING.FREE_SHIPPING_THRESHOLD)}đ</span>
            </span>
          </div>
        </div>
      </div>

      {/* THANH ĐÁY: logo + ngôn ngữ + bản quyền */}
      <div className="bg-forest-800">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
          <Link href="/" className="bg-white px-3 py-1.5 rounded-xl shrink-0" aria-label="Thái Sơn Foods - Trang chủ">
            <span className="relative block h-9 w-32">
              <Image src="/images/logo-vien-trang.png" alt="Thái Sơn Foods - Món ngon quê Việt" fill sizes="128px" className="object-contain" />
            </span>
          </Link>
          <div className="flex items-center gap-1 rounded-lg border border-white/25 p-1 text-[13px]">
            {(['vi', 'en'] as const).map((lng) => (
              <button
                key={lng}
                type="button"
                onClick={() => setLanguage(lng)}
                aria-pressed={language === lng}
                className={`px-2.5 py-1 rounded-md cursor-pointer ${language === lng ? 'bg-white text-text-dark' : 'text-white/80 hover:text-white'}`}
              >
                {lng === 'vi' ? 'Tiếng Việt' : 'English'}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-white/70 text-center">
            © 2026 Thái Sơn Foods. {isEn ? 'All rights reserved.' : 'Tất cả các quyền được bảo lưu.'}
          </p>
        </div>
      </div>
    </footer>
  );
}
