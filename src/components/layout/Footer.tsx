'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Phone, Mail, MapPin, Truck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { HAS_LEGAL_LINKS, LegalCompanyBlock, LegalPolicyLinks } from '@/components/layout/FooterLegal';

function FacebookIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function YoutubeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function InstagramIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

export default function Footer() {
  const { language } = useLanguage();

  return (
    <footer className="bg-green-primary text-white">
      <div>
        {/* Info */}
        <div className="p-8 md:p-10 lg:p-14">
          {/* Logo */}
          <div className="flex items-center gap-3.5 mb-8">
            <div className="bg-white px-4 py-2.5 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
              <div className="relative h-11 w-36 sm:h-12 sm:w-40">
                <Image
                  src="/images/logo-vien-trang.png"
                  alt="Thái Sơn Foods - Món ngon quê Việt"
                  fill
                  sizes="160px"
                  className="object-contain"
                />
              </div>
            </div>
            <div>

            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
            {/* Company Info */}
            <div>
              <h3
                className="text-lg uppercase tracking-wider text-amber-500 font-sans mb-4"
                style={{ color: 'var(--color-amber-500)' }}
              >
                {language === 'en' ? 'Company' : 'Công ty'}
              </h3>
              <div className="space-y-3.5 text-[15px] sm:text-base text-white/90">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 mt-0.5 shrink-0 text-amber-500" />
                  <p className="leading-snug">{language === 'en' ? '2C Pho Quang, Tan Son Hoa Ward, Ho Chi Minh City' : '2C Phổ Quang, Phường Tân Sơn Hòa, TP. Hồ Chí Minh'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 shrink-0 text-amber-500" />
                  <a href="tel:02862915024" className="hover:text-amber-500 transition-colors font-medium py-2 -my-2 inline-block">
                    Hotline: 028 6291 5024
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 shrink-0 text-amber-500" />
                  <a
                    href="mailto:sbnts.htkd@tsf.com.vn"
                    className="hover:text-amber-500 transition-colors break-all py-2 -my-2 inline-block"
                  >
                    sbnts.htkd@tsf.com.vn
                  </a>
                </div>
              </div>
            </div>

            {/* Products */}
            <div>
              <h3
                className="text-lg uppercase tracking-wider text-amber-500 font-sans mb-4"
                style={{ color: 'var(--color-amber-500)' }}
              >
                {language === 'en' ? 'Products' : 'Sản phẩm'}
              </h3>
              <ul className="space-y-1 text-[15px] sm:text-base text-white/90">
                <li>
                  <Link href="/#san-pham" className="hover:text-amber-500 transition-colors font-medium hover:underline py-2 -my-1 inline-block">
                    {language === 'en' ? 'Nut Milk' : 'Sữa hạt'}
                  </Link>
                </li>
                <li>
                  <Link href="/#san-pham" className="hover:text-amber-500 transition-colors font-medium hover:underline py-2 -my-1 inline-block">
                    {language === 'en' ? 'Refreshments' : 'Nước giải khát'}
                  </Link>
                </li>
                <li>
                  <Link href="/#san-pham" className="hover:text-amber-500 transition-colors font-medium hover:underline py-2 -my-1 inline-block">
                    {language === 'en' ? 'Milk Tea' : 'Trà sữa'}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support + Social */}
            <div>
              {/* Link chính sách lấy từ src/config/legal.ts — chỉ hiện link đã điền (thay cho link "/#" tạm) */}
              {HAS_LEGAL_LINKS && (
                <>
                  <h3
                    className="text-lg uppercase tracking-wider text-amber-500 font-sans mb-4"
                    style={{ color: 'var(--color-amber-500)' }}
                  >
                    {language === 'en' ? 'Support' : 'Hỗ trợ'}
                  </h3>
                  <ul className="space-y-1 text-[15px] sm:text-base text-white/90 mb-6">
                    <LegalPolicyLinks
                      isEn={language === 'en'}
                      className="hover:text-amber-500 transition-colors font-medium hover:underline py-2 -my-1 inline-block"
                    />
                  </ul>
                </>
              )}

              {/* Social */}
              <h3
                className="text-lg uppercase tracking-wider text-amber-500 font-sans mb-3.5"
                style={{ color: 'var(--color-amber-500)' }}
              >
                {language === 'en' ? 'Follow Us' : 'Kết nối'}
              </h3>
              <div className="flex items-center gap-3.5">
                <a
                  href="https://www.facebook.com/suabapnepthaison"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 flex items-center justify-center bg-white/10 rounded-xl hover:bg-amber-500 hover:text-forest-950 transition-all "
                  aria-label="Facebook"
                >
                  <FacebookIcon className="w-5 h-5" />
                </a>
                <a
                  href="https://www.youtube.com/channel/UCiyHE1-nGSmHRaFb-OgZfMA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 flex items-center justify-center bg-white/10 rounded-xl hover:bg-amber-500 hover:text-forest-950 transition-all "
                  aria-label="YouTube"
                >
                  <YoutubeIcon className="w-5 h-5" />
                </a>
                <a
                  href="https://instagram.com/suabapnepthaison"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 flex items-center justify-center bg-white/10 rounded-xl hover:bg-amber-500 hover:text-forest-950 transition-all "
                  aria-label="Instagram"
                >
                  <InstagramIcon className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          {/* Free shipping notice */}
          <div className="mt-8 p-4 sm:p-5 bg-white/10 rounded-xl text-[15px] sm:text-base text-white/95 flex items-center gap-3 border border-white/10">
            <Truck className="w-5 h-5 text-amber-500 shrink-0" />
            <span className="font-medium">
              {language === 'en'
                ? 'Free shipping within Ho Chi Minh City on orders from '
                : 'Miễn phí vận chuyển nội thành TP.HCM cho đơn hàng từ '}
              <span className="text-amber-500 text-[1.125em]">200.000đ</span>
            </span>
          </div>

          {/* Thông tin pháp lý doanh nghiệp + logo Bộ Công Thương (src/config/legal.ts, trống thì ẩn) */}
          <LegalCompanyBlock isEn={language === 'en'} className="mt-8" />

          {/* Copyright */}
          <div className="mt-8 pt-6 border-t border-white/10 text-sm text-white/70">
            © 2026 Thái Sơn Foods. {language === 'en' ? 'All rights reserved.' : 'Tất cả các quyền được bảo lưu.'}
          </div>
        </div>
      </div>
    </footer>
  );
}
