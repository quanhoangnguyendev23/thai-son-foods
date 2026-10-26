'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LogIn, Package, ShoppingBag, Truck, UserRound } from 'lucide-react';
import { Combo, Product } from '@/types';
import { cn, formatPrice, safeFetchJson } from '@/lib/utils';
import { getProductImage, getShortProductName, MISSING_PRODUCT_IMAGE } from '@/lib/product-detail';
import { useLanguage } from '@/context/LanguageContext';
import { useUserAuth } from '@/context/UserAuthContext';
import { INVENTORY_CONFIG } from '@/config/inventory';
import { ENABLE_COMBOS } from '@/config/features';
import StorePromotionSidebar from '@/components/home/StorePromotionSidebar';
import { PlaceholderBadge } from '@/components/product/ProductPlaceholderBlocks';
import { BUY_AGAIN_PLACEHOLDER } from '@/data/homepage-placeholders';
import { SHOW_PLACEHOLDER_BLOCKS } from '@/data/product-detail-placeholders';

export interface HomeCategoryGroup {
  id: string;
  name: string;
  nameEn?: string;
  products: Product[];
}

interface AmazonCategoryCardsProps {
  categories: HomeCategoryGroup[];
  combos: Combo[];
}

/* ───────────────────────── Khung thẻ dùng chung ───────────────────────── */

function CardShell({
  title,
  children,
  footer,
  badge,
  className,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-border shadow-xs p-3.5 lg:p-4 flex flex-col',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h2 className="font-heading text-[18px] lg:text-[20px] text-text-dark leading-snug">{title}</h2>
        {badge}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
      {footer && <div className="pt-2 mt-auto">{footer}</div>}
    </div>
  );
}

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="relative before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] text-[15px] text-green-primary hover:text-green-dark hover:underline">
      {children}
    </Link>
  );
}

/** Ảnh vuông có dự phòng khi ảnh lỗi/thiếu */
function TileImage({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
  const [current, setCurrent] = useState(src || MISSING_PRODUCT_IMAGE);
  return (
    <Image
      src={current}
      alt={alt}
      fill
      sizes={sizes}
      className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
      onError={() => setCurrent(MISSING_PRODUCT_IMAGE)}
    />
  );
}

/* ───────────────────────── Thẻ danh mục 4 ảnh ───────────────────────── */

function CategoryQuadCard({ group }: { group: HomeCategoryGroup }) {
  const { language } = useLanguage();
  const items = group.products.slice(0, 4);
  const title = language === 'en' && group.nameEn ? group.nameEn : group.name;

  return (
    <CardShell
      title={title}
      footer={
        <MoreLink href={`/#danh-muc-${group.id}`}>
          {language === 'en' ? 'See more' : 'Xem thêm'} ({group.products.length})
        </MoreLink>
      }
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {items.map((p) => {
          const name = getShortProductName(p, language);
          return (
            <Link key={p.id} href={`/san-pham/${p.slug}`} className="group min-w-0">
              <div className="relative aspect-[4/3] rounded-lg bg-ivory overflow-hidden">
                <TileImage src={getProductImage(p)} alt={name} sizes="(max-width: 640px) 40vw, 160px" />
              </div>
              <p className="mt-1 text-[13px] leading-tight text-text-body line-clamp-1 group-hover:text-green-primary" title={name}>
                {name}
              </p>
            </Link>
          );
        })}
      </div>
    </CardShell>
  );
}

/* ───────────────────────── Đơn gần nhất (khách đã đăng nhập) ───────────────────────── */

interface LatestOrder {
  order_code?: string;
  id: string;
  status: string;
  total: number | string;
  created_at: string;
}

function orderStatusLabel(status: string, isEn: boolean): { label: string; className: string } {
  const s = (status || '').toUpperCase();
  if (s === 'COMPLETED' || s === 'DELIVERED') return { label: isEn ? 'Completed' : 'Hoàn thành', className: 'bg-emerald-100 text-emerald-800' };
  if (s === 'PROCESSING' || s === 'SHIPPING') return { label: isEn ? 'Shipping' : 'Đang giao hàng', className: 'bg-blue-100 text-blue-800' };
  if (s === 'CANCELLED') return { label: isEn ? 'Cancelled' : 'Đã hủy', className: 'bg-rose-100 text-rose-800' };
  return { label: isEn ? 'Pending' : 'Chờ xác nhận', className: 'bg-amber-100 text-amber-800' };
}

/**
 * Đơn hàng gần nhất — dữ liệu thật từ GET /api/user/orders (API sẵn có của trang Tài khoản, chỉ đọc).
 * Điểm tích lũy: chưa hiển thị vì phân hệ hội viên đang tắt (MEMBERSHIP_CONFIG.ENABLE_MEMBERSHIP = false).
 * Khung giữ chiều cao cố định trong lúc tải để không gây nhảy bố cục.
 */
function LatestOrderSummary() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [state, setState] = useState<{ loading: boolean; order: LatestOrder | null }>({ loading: true, order: null });

  useEffect(() => {
    let active = true;
    safeFetchJson<{ success: boolean; orders?: LatestOrder[] }>('/api/user/orders').then((json) => {
      if (!active) return;
      setState({ loading: false, order: json?.success && json.orders?.length ? json.orders[0] : null });
    });
    return () => {
      active = false;
    };
  }, []);

  const box = 'mb-2.5 h-[62px] rounded-xl bg-ivory px-3 py-2 flex flex-col justify-center';

  if (state.loading) {
    return <div className={cn(box, 'animate-pulse')} aria-hidden />;
  }

  if (!state.order) {
    return (
      <div className={box}>
        <p className="text-[13px] text-text-muted">{isEn ? 'No orders yet' : 'Bạn chưa có đơn hàng nào'}</p>
        <Link href="/#san-pham" className="text-[14px] text-green-primary hover:underline self-start">
          {isEn ? 'Start shopping' : 'Bắt đầu mua sắm'}
        </Link>
      </div>
    );
  }

  const o = state.order;
  const status = orderStatusLabel(o.status, isEn);
  const date = o.created_at ? new Date(o.created_at).toLocaleDateString(isEn ? 'en-GB' : 'vi-VN') : '';
  return (
    <Link href="/tai-khoan?tab=orders" className={cn(box, 'hover:bg-ivory-dark transition-colors')}>
      <span className="flex items-center justify-between gap-2 text-[13px] text-text-muted">
        <span className="truncate">
          {isEn ? 'Latest order' : 'Đơn gần nhất'} {o.order_code ? `#${o.order_code}` : ''}
        </span>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[12px]', status.className)}>{status.label}</span>
      </span>
      <span className="flex items-center justify-between gap-2 text-[14px] text-text-dark">
        <strong className="font-normal">{formatPrice(Number(o.total) || 0)}đ</strong>
        <span className="text-[13px] text-text-muted">{date}</span>
      </span>
    </Link>
  );
}

/* ───────────────────────── Thẻ đăng nhập / chào khách + miễn phí giao ───────────────────────── */

function SignInColumn() {
  const { language } = useLanguage();
  const { user, openAuthModal } = useUserAuth();
  const threshold = INVENTORY_CONFIG.SHIPPING.FREE_SHIPPING_THRESHOLD;

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="bg-white rounded-2xl border border-border shadow-xs p-3.5 lg:p-4">
        {user ? (
          <>
            <div className="flex items-center gap-3 mb-2.5">
              <span className="w-10 h-10 rounded-full bg-green-primary text-white flex items-center justify-center text-[1.125em]">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : <UserRound className="w-5 h-5" />}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] text-text-muted">{language === 'en' ? 'Hello,' : 'Xin chào,'}</p>
                <p className="font-heading text-[19px] text-text-dark truncate">{user.fullName}</p>
              </div>
            </div>
            <LatestOrderSummary />
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/tai-khoan?tab=orders"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-2 py-2 text-[15px] text-text-dark hover:bg-ivory"
              >
                <Package className="w-4 h-4 text-green-primary" />
                {language === 'en' ? 'Orders' : 'Đơn hàng'}
              </Link>
              <Link
                href="/tai-khoan?tab=profile"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-2 py-2 text-[15px] text-text-dark hover:bg-ivory"
              >
                <UserRound className="w-4 h-4 text-green-primary" />
                {language === 'en' ? 'Account' : 'Tài khoản'}
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-heading text-[18px] lg:text-[20px] text-text-dark leading-snug mb-2.5">
              {language === 'en' ? 'Sign in for a better shopping experience' : 'Đăng nhập để mua sắm thuận tiện hơn'}
            </h2>
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-corn hover:bg-corn-dark text-text-dark text-base py-2.5 shadow-xs cursor-pointer transition-colors"
            >
              <LogIn className="w-4 h-4" />
              {language === 'en' ? 'Sign in securely' : 'Đăng nhập'}
            </button>
            <p className="mt-2.5 text-[12px] text-text-muted text-center">
              {language === 'en' ? 'New customer?' : 'Khách hàng mới?'}{' '}
              <button
                type="button"
                onClick={() => openAuthModal('register')}
                className="text-green-primary hover:underline cursor-pointer text-[1.125em]"
              >
                {language === 'en' ? 'Create an account' : 'Tạo tài khoản'}
              </button>
            </p>
          </>
        )}
      </div>

      {/* Chính sách miễn phí giao hàng — số liệu thật từ INVENTORY_CONFIG.SHIPPING (đồng bộ với Footer) */}
      <div className="flex-1 bg-leaf-900 text-white rounded-2xl p-3.5 lg:p-4 flex flex-col justify-between gap-2.5 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-corn" />
          </span>
          <p className="text-[14px] leading-snug">
            {language === 'en'
              ? 'Free shipping in HCMC, Bien Hoa, Long Thanh on orders from '
              : 'Miễn phí vận chuyển trong khu vực HCM, Biên Hòa, Long Thành cho đơn hàng từ '}
            <strong className="text-corn text-[1.125em]">{formatPrice(threshold)}đ</strong>
          </p>
        </div>
        <Link
          href="/gio-hang"
          className="inline-flex items-center gap-1.5 self-start text-[15px] text-corn hover:underline"
        >
          <ShoppingBag className="w-4 h-4" />
          {language === 'en' ? 'Go to cart' : 'Xem giỏ hàng'}
        </Link>
      </div>
    </div>
  );
}

/* ───────────────────────── Thẻ combo 4 ảnh (dữ liệu thật) ───────────────────────── */

function ComboQuadCard({ combos }: { combos: Combo[] }) {
  const { language } = useLanguage();
  const items = combos.slice(0, 4);
  if (items.length === 0) return null;

  return (
    <CardShell
      title={language === 'en' ? 'Value combos' : 'Combo tiết kiệm'}
      footer={<MoreLink href="/#combo">{language === 'en' ? 'See all combos' : 'Xem tất cả combo'}</MoreLink>}
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {items.map((c) => {
          const name = (language === 'en' && c.nameEn ? c.nameEn : c.name).split(',')[0].trim();
          return (
            <Link key={c.id} href={`/combo/${c.slug}`} className="group min-w-0">
              <div className="relative aspect-[4/3] rounded-lg bg-ivory overflow-hidden">
                <TileImage src={c.image} alt={name} sizes="(max-width: 640px) 40vw, 160px" />
                {c.discount > 0 && (
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[11px] bg-sale text-white rounded">
                    -{c.discount}%
                  </span>
                )}
              </div>
              <p className="mt-1 text-[13px] leading-tight text-text-body line-clamp-1 group-hover:text-green-primary" title={name}>
                {name}
              </p>
            </Link>
          );
        })}
      </div>
    </CardShell>
  );
}

/* ───────────────────────── Thẻ "Mua lại" (PLACEHOLDER) ───────────────────────── */

function BuyAgainPlaceholderCard() {
  const { language } = useLanguage();
  const { user, openAuthModal } = useUserAuth();

  return (
    <CardShell
      title={language === 'en' ? 'Buy again' : BUY_AGAIN_PLACEHOLDER.title}
      badge={<PlaceholderBadge />}
      footer={
        user ? (
          <MoreLink href="/tai-khoan?tab=orders">{BUY_AGAIN_PLACEHOLDER.ctaLabel}</MoreLink>
        ) : (
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="text-[15px] text-green-primary hover:underline cursor-pointer"
          >
            {language === 'en' ? 'Sign in to see your orders' : 'Đăng nhập để xem đơn hàng'}
          </button>
        )
      }
    >
      <p className="text-[12px] text-text-muted mb-2.5">{BUY_AGAIN_PLACEHOLDER.description}</p>
      <div className="grid grid-cols-2 gap-3" aria-hidden>
        {Array.from({ length: BUY_AGAIN_PLACEHOLDER.slotCount }).map((_, i) => (
          <div
            key={i}
            className="aspect-[4/3] rounded-lg border-2 border-dashed border-border bg-ivory/60 flex items-center justify-center"
          >
            <Package className="w-7 h-7 text-border" />
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/* ───────────────────────── Lưới thẻ ───────────────────────── */

/**
 * Lưới thẻ danh mục theo bố cục Amazon: hàng 1 nằm ngay dưới hero (thẻ đã thu gọn để lọt màn hình đầu).
 * Toàn bộ ảnh/tên/giá là dữ liệu thật,
 * trừ thẻ "Mua lại" (placeholder, có nhãn).
 */
export default function AmazonCategoryCards({ categories, combos }: AmazonCategoryCardsProps) {
  const { language } = useLanguage();
  const track =
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4';
  const whySolo = !ENABLE_COMBOS && !SHOW_PLACEHOLDER_BLOCKS;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* HÀNG 1: 3 danh mục + đăng nhập/miễn phí giao */}
      <div className={track}>
        {categories.slice(0, 3).map((g) => (
          <CategoryQuadCard key={g.id} group={g} />
        ))}
        <SignInColumn />
      </div>

      {/* HÀNG 2: combo · deal sốc cửa hàng · mua lại · vì sao chọn TSF */}
      <div className={track}>
        {ENABLE_COMBOS && <ComboQuadCard combos={combos} />}

        {ENABLE_COMBOS && (
          <CardShell
            title={language === 'en' ? 'Store hot deals' : 'Deal sốc cửa hàng'}
            footer={<MoreLink href="/#combo">{language === 'en' ? 'See more' : 'Xem thêm'}</MoreLink>}
          >
            {/* Tái sử dụng nguyên khối 6 huy hiệu combo khuyến mãi của trang chủ cũ */}
            <StorePromotionSidebar />
          </CardShell>
        )}

        {SHOW_PLACEHOLDER_BLOCKS && <BuyAgainPlaceholderCard />}

        {/* Tắt combo và không có thẻ "Mua lại" → thẻ "Vì sao chọn" đứng một mình: trải hết hàng, ảnh tỉ lệ ngang */}
        <CardShell
          title={language === 'en' ? 'Why choose Thai Son Foods?' : 'Vì sao chọn Thái Sơn Foods?'}
          footer={<MoreLink href="/#kho-si">{language === 'en' ? 'Learn more' : 'Tìm hiểu thêm'}</MoreLink>}
          className={whySolo ? 'sm:col-span-2 lg:col-span-4' : undefined}
        >
          <Link
            href="/#kho-si"
            className={cn(
              'group block relative rounded-lg overflow-hidden bg-ivory',
              whySolo ? 'aspect-[4/3] sm:aspect-[1920/850] lg:aspect-[1920/600]' : 'aspect-[4/3] sm:aspect-auto sm:h-full min-h-[180px]'
            )}
          >
            <Image
              src="/images/warehouse/1920x850-3.png"
              alt={language === 'en' ? 'Thai Son Foods customer care' : 'Thái Sơn Foods chăm sóc khách hàng'}
              fill
              sizes="(max-width: 640px) 82vw, 700px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </Link>
        </CardShell>
      </div>
    </div>
  );
}
