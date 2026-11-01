'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUserAuth } from '@/context/UserAuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { formatPrice, safeFetchJson } from '@/lib/utils';

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
 * Chỉ là con số hiển thị, không phải ví tiền: không rút, không dùng để thanh toán.
 */
export default function SavingsBagPage() {
  const { user, isLoading, openAuthModal } = useUserAuth();
  const { language } = useLanguage();
  const en = language === 'en';
  const [data, setData] = useState<SavingsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    safeFetchJson<SavingsResponse>('/api/user/savings')
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData({ success: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const statusLabel = (s: string) => {
    if (s === 'COMPLETED' || s === 'DELIVERED') return en ? 'Completed' : 'Hoàn thành';
    if (s === 'PENDING') return en ? 'Pending' : 'Chờ xác nhận';
    return en ? 'Processing' : 'Đang xử lý';
  };

  if (!user && !isLoading) {
    return (
      <div className="min-h-[60vh] bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center border border-gray-200">
          <h1 className="text-2xl text-gray-900 font-heading">{en ? 'Savings bag' : 'Túi tiết kiệm'}</h1>
          <p className="text-sm text-gray-600 mt-2 mb-6">
            {en
              ? 'Sign in to see how much you have saved across your orders.'
              : 'Đăng nhập để xem tổng số tiền bạn đã tiết kiệm qua các đơn hàng.'}
          </p>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="w-full py-3 rounded-xl bg-emerald-700 text-white text-base hover:bg-emerald-800 transition"
          >
            {en ? 'Sign in' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    );
  }

  const totalSaved = data?.totalSaved ?? 0;
  const orders = data?.orders ?? [];

  return (
    <div className="min-h-[60vh] bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-3xl text-gray-900 font-heading">{en ? 'Savings bag' : 'Túi tiết kiệm'}</h1>
        <p className="text-sm text-gray-600 mt-1">
          {en
            ? 'The total you have saved compared with list prices, across all your orders.'
            : 'Tổng số tiền bạn đã tiết kiệm so với giá gốc, cộng dồn qua tất cả đơn hàng.'}
        </p>

        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-sm text-gray-600">{en ? 'You have saved' : 'Bạn đã tiết kiệm được'}</p>
          <p className="text-4xl text-emerald-700 font-heading mt-1">
            {loading || isLoading ? '…' : `${formatPrice(totalSaved)}đ`}
          </p>
          {data?.success && (
            <p className="text-sm text-gray-600 mt-2">
              {en
                ? `From ${data.savedOrderCount ?? 0} of ${data.orderCount ?? 0} orders`
                : `Từ ${data.savedOrderCount ?? 0} trên ${data.orderCount ?? 0} đơn hàng`}
            </p>
          )}
          {data && !data.success && (
            <p className="text-sm text-crimson-700 mt-2">
              {data.error || (en ? 'Could not load your savings.' : 'Không tải được Túi tiết kiệm.')}
            </p>
          )}
        </div>

        {data?.success && orders.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200">
            <h2 className="px-6 pt-5 pb-3 text-base text-gray-900">{en ? 'Savings by order' : 'Tiết kiệm theo đơn'}</h2>
            <ul className="divide-y divide-gray-100">
              {orders.map((o) => (
                <li key={o.id} className="px-6 py-3 flex items-center justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-900">#{o.orderCode}</p>
                    <p className="text-gray-500 text-xs">
                      {new Date(o.createdAt).toLocaleDateString(en ? 'en-GB' : 'vi-VN')} · {statusLabel(o.status)} ·{' '}
                      {formatPrice(o.total)}đ
                    </p>
                  </div>
                  <span className="text-emerald-700 shrink-0">{formatPrice(o.saved)}đ</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data?.success && orders.length === 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-6 text-sm text-gray-600">
            {en
              ? 'Your bag is empty for now. Combos are priced below their list price, so each combo you buy adds to your savings.'
              : 'Túi đang trống. Combo có giá thấp hơn giá gốc, mỗi combo bạn mua sẽ được cộng vào Túi tiết kiệm.'}
            <div className="mt-4">
              <Link href="/combo" className="text-emerald-700 underline">
                {en ? 'See combos' : 'Xem combo'}
              </Link>
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-gray-500">
          {en
            ? 'Savings are for reference only and cannot be withdrawn or used as payment. Cancelled orders are not counted.'
            : 'Số tiền tiết kiệm chỉ để bạn theo dõi, không rút hay dùng để thanh toán. Đơn đã hủy không được tính.'}
        </p>
      </div>
    </div>
  );
}
