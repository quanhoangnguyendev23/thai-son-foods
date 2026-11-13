'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { PiggyBank, X } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { useUserAuth } from '@/context/UserAuthContext';
import { cn, formatPrice, safeFetchJson } from '@/lib/utils';
import {
  SAVINGS_BAG_PATH,
  formatShortVND,
  getCartSavings,
  getComboSaving,
  hasSeenSavingsIntro,
  markSavingsIntroSeen,
  useComboCatalog,
} from '@/lib/savings';

/**
 * NÚT TÚI TIẾT KIỆM trên header (cạnh Giỏ hàng).
 * - Huy hiệu "+40K" khi giỏ đang có món giảm giá; chấm "Mới" khi khách chưa từng mở túi
 * - Bấm mở bảng xem nhanh: đã tiết kiệm qua các đơn, giỏ hiện tại, combo giảm nhiều nhất
 * - Giới thiệu một lần cho khách mới; thông báo "+X đ vào túi" mỗi khi thêm món giảm giá vào giỏ
 */
type Callout = { kind: 'intro' } | { kind: 'added'; amount: number } | null;

export default function SavingsBagButton({ isEn, navBtn }: { isEn: boolean; navBtn: string }) {
  const pathname = usePathname() || '';
  const { user, openAuthModal } = useUserAuth();
  const items = useCartStore((s) => s.items);
  const catalog = useComboCatalog();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [callout, setCallout] = useState<Callout>(null);
  const [isNew, setIsNew] = useState(false);
  const [totalSaved, setTotalSaved] = useState<number | null>(null);
  const [bump, setBump] = useState(0);
  const [pos, setPos] = useState<{ top: number; right: number; width: number } | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const cartSavings = mounted ? getCartSavings(items, catalog) : 0;
  const cartQty = items.reduce((s, i) => s + i.quantity, 0);
  const bestCombo = [...catalog].sort((a, b) => getComboSaving(b) - getComboSaving(a))[0];
  const bestSaving = bestCombo ? getComboSaving(bestCombo) : 0;

  useEffect(() => {
    setMounted(true);
    setIsNew(!hasSeenSavingsIntro());
  }, []);

  // Tổng đã tiết kiệm qua các đơn (chỉ khi đăng nhập); tải lại khi mở bảng để luôn mới
  const loadTotal = useCallback(() => {
    if (!user) {
      setTotalSaved(null);
      return;
    }
    safeFetchJson<{ success: boolean; totalSaved?: number }>('/api/user/savings')
      .then((d) => d?.success && setTotalSaved(Number(d.totalSaved) || 0))
      .catch(() => {});
  }, [user]);
  useEffect(loadTotal, [loadTotal]);

  // Vị trí bảng/thông báo: neo dưới nút, không tràn màn hình điện thoại
  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const width = Math.min(360, vw - 24);
    const right = Math.min(Math.max(12, vw - r.right - 8), vw - width - 12);
    setPos({ top: r.bottom + 10, right, width });
  }, []);
  useLayoutEffect(() => {
    if (!open && !callout) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place);
    };
  }, [open, callout, place]);

  const dismissIntro = useCallback(() => {
    markSavingsIntroSeen();
    setIsNew(false);
  }, []);

  // Giới thiệu một lần (không làm phiền ở trang thanh toán, trang túi và trang quản trị)
  const quietPage = pathname.startsWith('/thanh-toan') || pathname.startsWith(SAVINGS_BAG_PATH) || pathname.startsWith('/admin');
  useEffect(() => {
    if (!mounted || !isNew || quietPage) return;
    const t = window.setTimeout(() => setCallout((c) => c ?? { kind: 'intro' }), 3500);
    return () => window.clearTimeout(t);
  }, [mounted, isNew, quietPage]);

  // Thông báo khi tiền tiết kiệm trong giỏ tăng do khách vừa thêm món (bỏ qua lần nạp giỏ đầu tiên)
  const prev = useRef<{ savings: number; qty: number } | null>(null);
  useEffect(() => {
    if (!mounted) return;
    const last = prev.current;
    prev.current = { savings: cartSavings, qty: cartQty };
    if (!last) return;
    if (cartQty > last.qty && cartSavings > last.savings) {
      setCallout({ kind: 'added', amount: cartSavings - last.savings });
      setBump((b) => b + 1);
      dismissIntro();
    }
  }, [mounted, cartSavings, cartQty, dismissIntro]);

  useEffect(() => {
    if (callout?.kind !== 'added') return;
    const t = window.setTimeout(() => setCallout(null), 5000);
    return () => window.clearTimeout(t);
  }, [callout]);

  // Đóng bảng khi bấm ra ngoài / nhấn Esc / đổi trang
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);

  const openPanel = () => {
    setCallout(null);
    dismissIntro();
    loadTotal();
    setOpen((o) => !o);
  };

  const vnd = (n: number) => `${formatPrice(n)}đ`;
  const showAmount = totalSaved !== null && totalSaved > 0;
  const label = isEn ? 'Savings bag' : 'Túi tiết kiệm';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openPanel}
        className={cn(navBtn, 'relative gap-1.5 px-1.5 lg:px-2 py-1 max-lg:min-h-11 max-lg:min-w-11 max-lg:justify-center')}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          cartSavings > 0
            ? isEn ? `${label}, this cart saves ${vnd(cartSavings)}` : `${label}, giỏ này tiết kiệm ${vnd(cartSavings)}`
            : label
        }
      >
        <span className={cn('relative', cartSavings > 0 && 'xl:mr-3')}>
          <PiggyBank className="w-6 h-6" strokeWidth={1.75} />
          {cartSavings > 0 ? (
            <span
              key={`bag-${bump}`}
              className="absolute -top-2 -right-3 h-[18px] px-1 rounded-full bg-corn text-text-dark text-2xs leading-[18px] tabular-nums animate-pulse-badge"
            >
              +{formatShortVND(cartSavings)}
            </span>
          ) : (
            isNew && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-corn ring-2 ring-green-primary" />
          )}
        </span>
        <span className="hidden xl:block leading-tight text-left">
          <span className="block text-2xs text-white/70">{label}</span>
          <span className="block text-base tabular-nums max-w-[120px] truncate">
            {showAmount ? vnd(totalSaved!) : isNew ? (isEn ? 'New' : 'Mới') : isEn ? 'View' : 'Xem ngay'}
          </span>
        </span>
      </button>

      {/* Thông báo và bảng xem nhanh gắn vào body: header có transform/sticky nên không đặt fixed bên trong */}
      {mounted &&
        createPortal(
          <>
      {/* Thông báo nhỏ: giới thiệu lần đầu hoặc "+X đ vào túi" */}
      {callout && !open && pos && (
        <div
          role="status"
          className="fixed z-[70] animate-fade-in-up"
          style={{ top: pos.top, right: pos.right, width: Math.min(pos.width, 320) }}
        >
          <div className="relative bg-white text-text-dark rounded-2xl shadow-xl border border-border-light p-4">
            <button
              type="button"
              onClick={() => {
                setCallout(null);
                dismissIntro();
              }}
              className="absolute top-2.5 right-2.5 p-1 rounded-full text-text-muted hover:bg-ivory"
              aria-label={isEn ? 'Close' : 'Đóng'}
            >
              <X className="w-4 h-4" />
            </button>
            {callout.kind === 'intro' ? (
              <>
                <p className="text-2xs uppercase tracking-wide text-green-primary">{isEn ? 'New' : 'Mới'}</p>
                <p className="text-base mt-0.5 pr-6">{label}</p>
                <p className="text-sm text-text-body mt-1.5">
                  {isEn
                    ? 'See how much you save versus list price. Every discounted bundle you order is added up here.'
                    : 'Xem bạn tiết kiệm được bao nhiêu so với giá gốc. Mỗi gói giảm giá bạn đặt đều được cộng dồn vào đây.'}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={openPanel}
                    className="flex-1 h-9 rounded-full bg-green-primary text-white text-sm hover:bg-green-dark"
                  >
                    {isEn ? 'Open the bag' : 'Mở túi'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCallout(null);
                      dismissIntro();
                    }}
                    className="h-9 px-4 rounded-full text-sm text-text-body hover:bg-ivory"
                  >
                    {isEn ? 'Later' : 'Để sau'}
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={openPanel} className="block w-full text-left pr-6">
                <p className="text-base">
                  <span className="text-green-primary tabular-nums">+{vnd(callout.amount)}</span>{' '}
                  {isEn ? 'added to your savings bag' : 'vào Túi tiết kiệm'}
                </p>
                <p className="text-sm text-text-body mt-1">
                  {isEn ? 'This cart saves ' : 'Giỏ hàng này đang tiết kiệm '}
                  <span className="tabular-nums">{vnd(cartSavings)}</span>
                  {isEn ? ' versus list price.' : ' so với giá gốc.'}
                </p>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bảng xem nhanh */}
      {open && pos && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={label}
          className="fixed z-[70] bg-white text-text-dark rounded-2xl shadow-xl border border-border-light overflow-hidden animate-fade-in-up"
          style={{ top: pos.top, right: pos.right, width: pos.width }}
        >
          <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-base">{label}</p>
              <p className="text-xs text-text-muted mt-0.5">
                {isEn ? 'What you save versus list price, across every order.' : 'Số tiền bạn tiết kiệm so với giá gốc, cộng dồn qua mọi đơn.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 -mr-1 rounded-full text-text-muted hover:bg-ivory"
              aria-label={isEn ? 'Close' : 'Đóng'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Đã tiết kiệm qua các đơn */}
          <div className="mx-5 rounded-xl bg-green-primary text-white px-4 py-3.5">
            <p className="text-xs text-white/75">{isEn ? 'Saved so far' : 'Đã tiết kiệm'}</p>
            {user ? (
              <p className="text-2xl tabular-nums mt-0.5">{totalSaved === null ? '…' : vnd(totalSaved)}</p>
            ) : (
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-sm text-white/90">
                  {isEn ? 'Sign in so your savings add up.' : 'Đăng nhập để tiền tiết kiệm được cộng dồn.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openAuthModal('login');
                  }}
                  className="shrink-0 h-8 px-3 rounded-full bg-white text-green-primary text-sm hover:bg-ivory"
                >
                  {isEn ? 'Sign in' : 'Đăng nhập'}
                </button>
              </div>
            )}
          </div>

          {/* Giỏ hiện tại hoặc gợi ý combo */}
          <div className="px-5 py-4 text-sm">
            {cartSavings > 0 ? (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p>{isEn ? 'In your cart now' : 'Giỏ hàng hiện tại'}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {isEn ? 'Added to the bag when you place the order.' : 'Được cộng vào túi khi bạn đặt hàng.'}
                  </p>
                </div>
                <p className="text-green-primary tabular-nums shrink-0">+{vnd(cartSavings)}</p>
              </div>
            ) : bestCombo && bestSaving > 0 ? (
              <Link href={`/combo/${bestCombo.slug}`} className="group block" onClick={() => setOpen(false)}>
                <p className="text-xs text-text-muted">{isEn ? 'Biggest saving right now' : 'Đang tiết kiệm nhiều nhất'}</p>
                <p className="mt-1 line-clamp-1 group-hover:underline">
                  {(isEn && bestCombo.nameEn) || bestCombo.name}
                </p>
                <p className="mt-0.5 text-text-body">
                  <span className="tabular-nums">{vnd(bestCombo.salePrice)}</span>{' '}
                  <span className="text-text-muted line-through tabular-nums">{vnd(bestCombo.originalPrice)}</span>{' '}
                  <span className="text-green-primary">
                    · {isEn ? 'save' : 'tiết kiệm'} {vnd(bestSaving)}
                  </span>
                </p>
              </Link>
            ) : (
              <p className="text-text-body">
                {isEn ? 'Discounted bundles fill your bag.' : 'Gói giảm giá sẽ làm đầy túi của bạn.'}
              </p>
            )}
          </div>

          <div className="px-5 pb-4 flex gap-2">
            <Link
              href={SAVINGS_BAG_PATH}
              onClick={() => setOpen(false)}
              className="flex-1 h-10 rounded-full bg-green-primary text-white text-sm flex items-center justify-center hover:bg-green-dark"
            >
              {isEn ? 'View my bag' : 'Xem chi tiết túi'}
            </Link>
            {cartSavings > 0 ? (
              <Link
                href="/gio-hang"
                onClick={() => setOpen(false)}
                className="h-10 px-4 rounded-full border border-border text-sm flex items-center hover:bg-ivory"
              >
                {isEn ? 'Cart' : 'Giỏ hàng'}
              </Link>
            ) : (
              <Link
                href="/#combo"
                onClick={() => setOpen(false)}
                className="h-10 px-4 rounded-full border border-border text-sm flex items-center hover:bg-ivory"
              >
                {isEn ? 'Bundles' : 'Xem gói'}
              </Link>
            )}
          </div>
        </div>
      )}
          </>,
          document.body
        )}
    </>
  );
}
