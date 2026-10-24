'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MapPin, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserAuth } from '@/context/UserAuthContext';
import { useLanguage } from '@/context/LanguageContext';

/**
 * Các khối DỮ LIỆU THẬT trên trang chi tiết sản phẩm / combo (thay cho khối "Bản mẫu"):
 *  - MonthlySalesInfo : tổng số đã bán (số bán ngoài website do admin nhập + đơn đặt trên web)
 *  - DeliveryAddressInfo : "Giao đến" theo địa chỉ đã lưu của tài khoản
 *  - WishlistButton : danh sách yêu thích lưu theo tài khoản
 *  - ProductViewTracker : ghi nhận lượt xem ẩn danh để gợi ý "khách cũng xem"
 */

type ItemType = 'product' | 'combo';

/** Chỉ hiện khi đủ lớn, làm tròn xuống để không phóng đại */
const MIN_SALES_TO_SHOW = 10;
function roundDown(n: number): number {
  if (n < 100) return Math.floor(n / 10) * 10;
  if (n < 500) return Math.floor(n / 50) * 50;
  return Math.floor(n / 100) * 100;
}

export function MonthlySalesInfo({
  itemId,
  itemType = 'product',
  slug,
}: {
  itemId: string;
  itemType?: ItemType;
  slug?: string;
}) {
  const { language } = useLanguage();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const slugParam = slug ? `&slug=${encodeURIComponent(slug)}` : '';
    fetch(`/api/products/sales?itemId=${encodeURIComponent(itemId)}&itemType=${itemType}${slugParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (active && data.success) setCount(Number(data.count) || 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [itemId, itemType, slug]);

  if (count === null || count < MIN_SALES_TO_SHOW) return null;
  const shown = roundDown(count).toLocaleString('vi-VN');
  return (
    <p className="text-[13px] text-gray-600">
      {language === 'en'
        ? `${shown}+ sold`
        : `Hơn ${shown} ${itemType === 'combo' ? 'combo' : 'sản phẩm'} đã được bán`}
    </p>
  );
}

export function DeliveryAddressInfo() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const { user, isLoading, openAuthModal } = useUserAuth();

  if (isLoading) return null;

  const addressLine = user
    ? [user.address, user.ward, user.district, user.province].filter((p) => p && String(p).trim()).join(', ')
    : '';

  return (
    <div className="flex items-start gap-2 text-[13px]">
      <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" aria-hidden />
      <span className="min-w-0 flex-1 leading-snug">
        <span className="text-gray-600">{isEn ? 'Deliver to: ' : 'Giao đến: '}</span>
        {user && addressLine ? (
          <>
            <span className="text-ink-950">{addressLine}</span>{' '}
            <Link href="/tai-khoan?tab=profile" className="text-copper-600 font-medium underline underline-offset-2 hover:text-copper-800">
              {isEn ? 'Change' : 'Đổi'}
            </Link>
          </>
        ) : user ? (
          <Link href="/tai-khoan?tab=profile" className="text-forest-700 hover:text-copper-600 hover:underline">
            {isEn ? 'Add a delivery address' : 'Thêm địa chỉ giao hàng'}
          </Link>
        ) : (
          <>
            <span className="text-ink-950">{isEn ? 'No address yet. ' : 'Chưa có địa chỉ. '}</span>
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="text-forest-700 hover:text-copper-600 hover:underline cursor-pointer"
            >
              {isEn ? 'Sign in to use your saved address' : 'Đăng nhập để dùng địa chỉ đã lưu'}
            </button>
            <span className="block text-[11px] text-gray-500 mt-0.5">
              {isEn ? 'Or enter it at checkout.' : 'Hoặc nhập địa chỉ ở bước thanh toán.'}
            </span>
          </>
        )}
      </span>
    </div>
  );
}

export function WishlistButton({ itemId, itemType = 'product' }: { itemId: string; itemType?: ItemType }) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const { user, isLoading, openAuthModal } = useUserAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    setSaved(false);
    setError(null);
    if (!userId) return;
    let active = true;
    fetch(`/api/user/wishlist?itemType=${itemType}&itemId=${encodeURIComponent(itemId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (active && data.success) setSaved(Boolean(data.saved));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId, itemId, itemType]);

  const toggle = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    const next = !saved;
    setSaved(next); // cập nhật ngay, hoàn lại nếu lỗi
    try {
      const res = next
        ? await fetch('/api/user/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemType, itemId }),
          })
        : await fetch(`/api/user/wishlist?itemType=${itemType}&itemId=${encodeURIComponent(itemId)}`, {
            method: 'DELETE',
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setSaved(!next);
        setError(data.error || (isEn ? 'Could not update your wishlist' : 'Không thể cập nhật danh sách yêu thích'));
      }
    } catch {
      setSaved(!next);
      setError(isEn ? 'Connection error' : 'Lỗi kết nối, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={toggle}
        disabled={isLoading || busy}
        aria-pressed={saved}
        className="w-full h-9 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-[13px] text-ink-950 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
      >
        <Heart className={cn('w-4 h-4', saved ? 'fill-sale text-sale' : 'text-gray-600')} aria-hidden />
        {saved
          ? isEn ? 'Saved to your wishlist' : 'Đã lưu vào danh sách yêu thích'
          : isEn ? 'Add to wishlist' : 'Thêm vào danh sách yêu thích'}
      </button>
      {!user && !isLoading && (
        <p className="text-[11px] text-gray-500 text-center">
          {isEn ? 'Sign in to save products to your wishlist.' : 'Đăng nhập để lưu sản phẩm vào danh sách yêu thích.'}
        </p>
      )}
      {error && <p className="text-[11px] text-red-600 text-center">{error}</p>}
    </div>
  );
}

/** Ghi nhận lượt xem ẩn danh (id phiên ngẫu nhiên lưu trên trình duyệt, không chứa thông tin cá nhân) */
export function ProductViewTracker({ productId }: { productId: string }) {
  const sentRef = useRef<string | null>(null);

  useEffect(() => {
    if (sentRef.current === productId) return;
    sentRef.current = productId;
    try {
      let sid = window.localStorage.getItem('tsf_view_sid');
      if (!sid) {
        sid =
          (typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID().replace(/-/g, '')
            : Math.random().toString(36).slice(2) + Date.now().toString(36)) || 'anon' + Date.now();
        window.localStorage.setItem('tsf_view_sid', sid);
      }
      const key = `tsf_viewed_${productId}`;
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
      fetch('/api/products/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, sessionId: sid }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Trình duyệt chặn lưu trữ — bỏ qua, tính năng chỉ phục vụ gợi ý
    }
  }, [productId]);

  return null;
}
