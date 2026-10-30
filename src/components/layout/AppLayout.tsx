'use client';

import React, { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeaderAmazon from '@/components/layout/HeaderAmazon';
import FooterAmazon from '@/components/layout/FooterAmazon';
import { HOMEPAGE_CONFIG } from '@/config/homepage';
import ReferralTracker from '@/components/common/ReferralTracker';
import { FlyToCartProvider } from '@/context/FlyToCartContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { UserAuthProvider } from '@/context/UserAuthContext';
import AuthModal from '@/components/auth/AuthModal';
import BranchSelectorModal from '@/components/store/BranchSelectorModal';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();

  if (pathname?.startsWith('/admin')) {
    return <>{children}</>;
  }

  // Trang quà tặng riêng /2010: toàn màn hình, không header/footer của cửa hàng
  if (pathname === '/2010') {
    return <>{children}</>;
  }

  // Header/Footer biến thể Amazon CHỈ dùng cho trang chủ mới; mọi trang khác giữ Header/Footer gốc
  const useAmazonChrome = pathname === '/' && HOMEPAGE_CONFIG.USE_AMAZON_HOMEPAGE;
  // Header mới dùng thống nhất cho MỌI trang khách (trang chủ, sản phẩm, giỏ hàng, thanh toán, tài khoản...).
  // Footer mới vẫn chỉ ở trang chủ. Tắt cờ USE_AMAZON_HOMEPAGE → mọi trang quay về Header gốc.
  const useAmazonHeader = HOMEPAGE_CONFIG.USE_AMAZON_HOMEPAGE;

  return (
    <LanguageProvider>
      <UserAuthProvider>
        <FlyToCartProvider>
          <Suspense fallback={null}>
            <ReferralTracker />
          </Suspense>
          <div className="min-h-screen flex flex-col">
            {useAmazonHeader ? <HeaderAmazon /> : <Header />}
            <main className="min-h-screen flex-1">{children}</main>
            {useAmazonChrome ? <FooterAmazon /> : <Footer />}
            <AuthModal />
            <BranchSelectorModal />
          </div>
        </FlyToCartProvider>
      </UserAuthProvider>
    </LanguageProvider>
  );
}
