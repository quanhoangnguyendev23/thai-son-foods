'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useUserAuth } from '@/context/UserAuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCartStore } from '@/store/cart';
import { formatPrice, safeFetchJson } from '@/lib/utils';
import { getCartSavings, getComboSaving, markSavingsIntroSeen, useComboCatalog } from '@/lib/savings';

interface SavingsOrder {
  id: string;
  orderCode: string;
  status: string;
  createdAt: string;
  total: number;
  saved: number;
}

interface SavingsResponse {
  success: boolean;
  totalSaved?: number;
  orderCount?: number;
  savedOrderCount?: number;
  orders?: SavingsOrder[];
  error?: string;
}

/**
 * TÚI TIẾT KIỆM — tổng số tiền khách đã tiết kiệm qua các đơn (giá gốc - giá bán).
 * Chỉ là con số để theo dõi, không phải ví tiền: không rút, không dùng để thanh toán.
 * Khách chưa đăng nhập vẫn xem được giỏ hiện tại và combo đang giảm.
 */
export default function SavingsBagPage() {
  const { user, isLoading, openAuthModal } = useUserAuth();
  const { language } = useLanguage();
  const en = language === 'en';
  const items = useCartStore((s) => s.items);
  const catalog = useComboCatalog();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<SavingsResponse | null>(null);

  useEffect(() => {
    setMounted(true);
    markSavingsIntroSeen();
  }, []);

  useEffect(() => {
    if (!user) {
      setData(null);
      return;
    }
    let cancelled = false;
    safeFetchJson<SavingsResponse>('/api/user/savings')
      .then((json) => !cancelled && setData(json ?? { success: false }))
      .catch(() => !cancelled && setData({ success: false }));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const vnd = (n: number) => `${formatPrice(n)}đ`;
  const cartSavings = mounted ? getCartSavings(items, catalog) : 0;
  const deals = [...catalog].filter((c) => getComboSaving(c) > 0).sort((a, b) => getComboSaving(b) - getComboSaving(a)).slice(0, 6);
  const orders = data?.orders ?? [];
  const loadingTotal = isLoading || (!!user && data === null);

  const statusLabel = (s: string) => {
    if (s === 'COMPLETED' || s === 'DELIVERED') return en ? 'Completed' : 'Hoàn thành';
    if (s === 'PENDING') return en ? 'Pending' : 'Chờ xác nhận';
    return en ? 'Processing' : 'Đang xử lý';
  };

  const steps = en
    ? [
        ['Pick a discounted combo', 'Combos are priced below their list price.'],
        ['Order while signed in', 'Savings are linked to your account.'],
        ['Watch your bag grow', 'Each order adds what you saved, automatically.'],
      ]
    : [
        ['Chọn combo đang giảm', 'Combo có giá bán thấp hơn giá gốc.'],
        ['Đặt hàng khi đã đăng nhập', 'Tiền tiết kiệm được ghi vào tài khoản của bạn.'],
        ['Túi tự đầy lên', 'Mỗi đơn tự cộng số tiền bạn đã tiết kiệm.'],
      ];

  return (
    <div className="bg-ivory/40 min-h-[70vh] py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <nav className="text-xs text-text-muted mb-3">
          <Link href="/tai-khoan" className="hover:underline">
            {en ? 'Account' : 'Tài khoản'}
          </Link>{' '}
          / {en ? 'Savings bag' : 'Túi tiết kiệm'}
        </nav>

        {/* Tổng quan */}
        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl bg-green-primary text-white p-6 sm:p-8">
            <h1 className="text-lg text-white/85">{en ? 'Savings bag' : 'Túi tiết kiệm'}</h1>
            <p className="text-sm text-white/70 mt-1">
              {en ? 'You have saved, versus list price' : 'Bạn đã tiết kiệm được so với giá gốc'}
            </p>
            {user ? (
              <>
                <p className="mt-3 text-4xl sm:text-4xl tabular-nums tracking-tight">
                  {loadingTotal ? '…' : vnd(data?.totalSaved ?? 0)}
                </p>
                {data?.success && (
                  <p className="mt-3 text-sm text-white/75">
                    {en
                      ? `Across ${data.savedOrderCount ?? 0} of your ${data.orderCount ?? 0} orders`
                      : `Từ ${data.savedOrderCount ?? 0} trên ${data.orderCount ?? 0} đơn hàng của bạn`}
                  </p>
                )}
                {data && !data.success && (
                  <p className="mt-3 text-sm text-white/90">
                    {data.error || (en ? 'Could not load your savings.' : 'Không tải được Túi tiết kiệm, vui lòng thử lại.')}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mt-3 text-4xl sm:text-4xl tabular-nums tracking-tight text-white/50">0đ</p>
                <p className="mt-3 text-sm text-white/80 max-w-sm">
                  {en
                    ? 'Sign in and every discounted order is added up here.'
                    : 'Đăng nhập để mọi đơn có giảm giá được cộng dồn vào túi của bạn.'}
                </p>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  disabled={isLoading}
                  className="mt-5 h-11 px-6 rounded-full bg-white text-green-primary text-sm hover:bg-ivory disabled:opacity-60"
                >
                  {en ? 'Sign in to start' : 'Đăng nhập để bắt đầu'}
                </button>
              </>
            )}
          </div>

          {/* Giỏ hiện tại */}
          <div className="rounded-3xl bg-white border border-border-light p-6 sm:p-8 flex flex-col">
            <p className="text-sm text-text-muted">{en ? 'Waiting in your cart' : 'Đang chờ trong giỏ hàng'}</p>
            {cartSavings > 0 ? (
              <>
                <p className="mt-2 text-3xl text-green-primary tabular-nums">+{vnd(cartSavings)}</p>
                <p className="mt-2 text-sm text-text-body">
                  {en ? 'Added to your bag once you place the order.' : 'Sẽ được cộng vào túi khi bạn đặt hàng.'}
                </p>
                <Link
                  href="/thanh-toan"
                  className="mt-auto pt-5 inline-flex"
                >
                  <span className="h-11 px-6 rounded-full bg-green-primary text-white text-sm inline-flex items-center hover:bg-green-dark">
                    {en ? 'Check out now' : 'Thanh toán ngay'}
                  </span>
                </Link>
              </>
            ) : (
              <>
                <p className="mt-2 text-3xl text-text-muted tabular-nums">0đ</p>
                <p className="mt-2 text-sm text-text-body">
                  {en ? 'No discounted items in your cart yet.' : 'Giỏ hàng chưa có món đang giảm giá.'}
                </p>
                <a href="#combo-tiet-kiem" className="mt-auto pt-5 text-sm text-green-primary hover:underline">
                  {en ? 'See combos that save you money' : 'Xem combo giúp bạn tiết kiệm'}
                </a>
              </>
            )}
          </div>
        </section>

        {/* Cách hoạt động */}
        <section className="mt-10">
          <h2 className="text-xl text-text-dark font-heading">{en ? 'How your bag fills up' : 'Túi được làm đầy thế nào'}</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {steps.map(([title, desc], i) => (
              <li key={title} className="rounded-2xl bg-white border border-border-light p-5">
                <span className="text-sm text-green-primary tabular-nums">0{i + 1}</span>
                <p className="mt-1 text-base text-text-dark">{title}</p>
                <p className="mt-1 text-sm text-text-body">{desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Combo đang giảm */}
        {deals.length > 0 && (
          <section id="combo-tiet-kiem" className="mt-10 scroll-mt-28">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-xl text-text-dark font-heading">{en ? 'Combos that save you money' : 'Combo giúp bạn tiết kiệm'}</h2>
              <Link href="/#combo" className="text-sm text-green-primary hover:underline shrink-0">
                {en ? 'All combos' : 'Tất cả combo'}
              </Link>
            </div>
            <ul className="mt-4 grid gap-3 grid-cols-2 lg:grid-cols-3">
              {deals.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/combo/${c.slug}`}
                    className="group block h-full rounded-2xl bg-white border border-border-light overflow-hidden hover:border-green-primary/40 transition-colors"
                  >
                    <div className="relative aspect-[4/3] bg-ivory">
                      <Image src={c.image} alt={c.name} fill sizes="(min-width:1024px) 320px, 50vw" className="object-cover" />
                    </div>
                    <div className="p-3 sm:p-4">
                      <p className="text-sm text-green-primary">
                        {en ? 'Save' : 'Tiết kiệm'} {vnd(getComboSaving(c))}
                      </p>
                      <p className="mt-1 text-sm text-text-dark line-clamp-2 group-hover:underline">
                        {(en && c.nameEn) || c.name}
                      </p>
                      <p className="mt-1.5 text-sm">
                        <span className="text-text-dark tabular-nums">{vnd(c.salePrice)}</span>{' '}
                        <span className="text-text-muted line-through tabular-nums text-xs">{vnd(c.originalPrice)}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Lịch sử theo đơn */}
        {user && data?.success && (
          <section className="mt-10">
            <h2 className="text-xl text-text-dark font-heading">{en ? 'Savings by order' : 'Tiết kiệm theo đơn hàng'}</h2>
            {orders.length > 0 ? (
              <ul className="mt-4 rounded-2xl bg-white border border-border-light divide-y divide-border-light">
                {orders.map((o) => (
                  <li key={o.id} className="px-5 py-4 flex items-center justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="text-text-dark">#{o.orderCode}</p>
                      <p className="text-text-muted text-xs mt-0.5">
                        {new Date(o.createdAt).toLocaleDateString(en ? 'en-GB' : 'vi-VN')} · {statusLabel(o.status)} · {vnd(o.total)}
                      </p>
                    </div>
                    <span className="text-green-primary tabular-nums shrink-0">+{vnd(o.saved)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-text-body">
                {en
                  ? 'No savings recorded yet. Your next discounted order will appear here.'
                  : 'Chưa có đơn nào được cộng vào túi. Đơn có giảm giá tiếp theo của bạn sẽ hiện ở đây.'}
              </p>
            )}
          </section>
        )}

        <p className="mt-10 text-xs text-text-muted">
          {en
            ? 'Savings are for tracking only and cannot be withdrawn or used as payment. Cancelled orders are not counted.'
            : 'Số tiền trong túi chỉ để bạn theo dõi, không rút hay dùng để thanh toán. Đơn đã hủy không được tính.'}
        </p>
      </div>
    </div>
  );
}
