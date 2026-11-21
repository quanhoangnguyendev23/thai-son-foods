'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Lock, UserPlus } from 'lucide-react';
import { Combo } from '@/types';
import { cn, formatPrice, safeFetchJson } from '@/lib/utils';
import { useUserAuth } from '@/context/UserAuthContext';
import { isMemberCombo } from '@/lib/comboTypes';

/**
 * Khối "Ưu đãi chỉ dành cho thành viên" (21/11/2026): 3 combo Member + nút "Đăng ký miễn phí".
 * Rải ở trang chủ, /combo, trang chi tiết sản phẩm & combo, giỏ hàng — CHỈ hiện cho khách chưa đăng nhập
 * (đăng nhập rồi thì ẩn, khách mua combo Member như combo thường trong các dải combo).
 * Danh sách lấy từ /api/combos, nhớ trong trang để nhiều khối trên cùng trang chỉ gọi một lần.
 */
let cached: Promise<Combo[]> | null = null;
/** Dùng chung với MemberComboSidebarCard */
export function loadMemberCombos(): Promise<Combo[]> {
  if (!cached) {
    cached = safeFetchJson<{ success: boolean; data: Combo[] }>('/api/combos')
      .then((res) => (res?.success && Array.isArray(res.data) ? res.data.filter((c) => isMemberCombo(c)) : []))
      .catch(() => {
        cached = null;
        return [];
      });
  }
  return cached;
}

export default function MemberComboTeaser({ className }: { className?: string }) {
  const { user, isLoading, openAuthModal } = useUserAuth();
  const [combos, setCombos] = useState<Combo[]>([]);

  useEffect(() => {
    if (isLoading || user) return;
    let active = true;
    loadMemberCombos().then((list) => {
      if (active) setCombos(list.slice(0, 3));
    });
    return () => {
      active = false;
    };
  }, [isLoading, user]);

  if (isLoading || user || combos.length === 0) return null;
  const maxSaving = Math.max(...combos.map((c) => Math.max(0, c.originalPrice - c.salePrice)));

  return (
    <section
      aria-label="Ưu đãi chỉ dành cho thành viên"
      className={cn('rounded-2xl border border-forest-200 bg-forest-50 p-3 sm:p-4', className)}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
        <div className="md:w-64 md:shrink-0">
          <p className="inline-flex items-center gap-1.5 text-lg text-forest-700 font-heading">
            <Lock className="w-4 h-4" aria-hidden />
            Ưu đãi chỉ dành cho thành viên
          </p>
          <p className="mt-1 text-sm text-forest-700">
            Đăng ký tài khoản miễn phí để mở khoá {combos.length} gói giá tốt
            {maxSaving > 0 ? `, tiết kiệm đến ${formatPrice(maxSaving)}đ mỗi gói` : ''}.
          </p>
          <button
            type="button"
            onClick={() => openAuthModal('register')}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-emerald px-4 py-2 text-sm text-white shadow-xs transition-colors hover:bg-brand-forest cursor-pointer"
          >
            <UserPlus className="w-4 h-4" aria-hidden />
            Đăng ký miễn phí
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 flex-1 min-w-0">
          {combos.map((c) => (
            <Link key={c.id} href={`/combo/${c.slug}`} className="group flex flex-col rounded-xl bg-white border border-gray-200 overflow-hidden">
              <div className="relative aspect-[4/3] w-full bg-ivory">
                <Image src={c.image} alt={c.name} fill sizes="(max-width: 768px) 33vw, 200px" className="object-cover" />
                <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded bg-brand-forest px-1.5 py-0.5 text-2xs text-white">
                  <Lock className="w-2.5 h-2.5" aria-hidden />
                  Thành viên
                </span>
              </div>
              <div className="p-1.5 sm:p-2">
                <p className="text-sm sm:text-base text-leaf-900 leading-tight">{formatPrice(c.salePrice)}đ</p>
                {c.originalPrice > c.salePrice && (
                  <p className="text-2xs sm:text-xs text-text-muted line-through">{formatPrice(c.originalPrice)}đ</p>
                )}
                <p className="text-2xs sm:text-xs text-text-muted">{c.totalItems} chai</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
