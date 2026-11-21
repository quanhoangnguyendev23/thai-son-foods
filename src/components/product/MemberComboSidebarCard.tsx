'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Info, Lock, UserPlus } from 'lucide-react';
import { Combo } from '@/types';
import { formatPrice } from '@/lib/utils';
import { useUserAuth } from '@/context/UserAuthContext';
import { loadMemberCombos } from '@/components/product/MemberComboTeaser';

/**
 * Thẻ "Gói thành viên" ở cột phải trang chi tiết sản phẩm & combo, dưới thẻ "Được tài trợ" (21/11/2026).
 * Mỗi lần mở trang chọn NGẪU NHIÊN 1 combo Member (bỏ combo đang xem). Khách chưa đăng nhập: nút "Đăng ký để mở khoá"
 * (mở hộp Đăng ký); đã đăng nhập: "Xem gói". Chọn sau khi mount để không lệch HTML server / trình duyệt.
 */
export default function MemberComboSidebarCard({ currentComboId, className }: { currentComboId?: string; className?: string }) {
  const { user, openAuthModal } = useUserAuth();
  const [combo, setCombo] = useState<Combo | null>(null);

  useEffect(() => {
    let active = true;
    loadMemberCombos().then((list) => {
      const pool = list.filter((c) => c.id !== currentComboId && c.slug);
      if (active && pool.length > 0) setCombo(pool[Math.floor(Math.random() * pool.length)]);
    });
    return () => {
      active = false;
    };
  }, [currentComboId]);

  if (!combo) return null;
  const saving = Math.max(0, combo.originalPrice - combo.salePrice);

  return (
    <div className={className}>
      <Link
        href={`/combo/${combo.slug}`}
        className="group block rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-forest-200"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-ivory">
          <Image src={combo.image} alt={combo.name} fill sizes="(max-width: 1280px) 90vw, 320px" className="object-cover" />
          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-brand-forest px-1.5 py-0.5 text-2xs text-white">
            <Lock className="w-3 h-3" aria-hidden />
            Thành viên
          </span>
        </div>
        <div className="pt-2">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-2xs uppercase tracking-tight text-amber-900">
              Gói thành viên
            </span>
            <span className="text-2xs text-gray-500">{combo.totalItems} chai</span>
          </div>
          <p className="text-sm sm:text-base text-gray-900 leading-snug group-hover:text-forest-700">
            Giá riêng cho thành viên Thái Sơn Foods
          </p>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-base sm:text-lg leading-none text-gray-900">{formatPrice(combo.salePrice)}đ</span>
            {combo.originalPrice > combo.salePrice && (
              <span className="text-xs text-gray-400 line-through">{formatPrice(combo.originalPrice)}đ</span>
            )}
            {saving > 0 && (
              <span className="rounded-xs bg-crimson-600 px-1.5 py-0.5 text-2xs uppercase tracking-tight text-white">
                Tiết kiệm {formatPrice(saving)}đ
              </span>
            )}
          </div>
          {user ? (
            <span className="mt-2 inline-flex text-sm text-forest-700 group-hover:underline">Xem gói →</span>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openAuthModal('register');
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-emerald px-3 py-1.5 text-sm text-white shadow-xs transition-colors hover:bg-brand-forest cursor-pointer"
            >
              <UserPlus className="w-4 h-4" aria-hidden />
              Đăng ký để mở khoá
            </button>
          )}
        </div>
      </Link>
      <div className="mt-1 flex items-center justify-end gap-1 pr-1 text-2xs text-gray-400 select-none">
        <span>Dành cho thành viên</span>
        <Info className="w-3 h-3 text-gray-400" aria-hidden />
      </div>
    </div>
  );
}
