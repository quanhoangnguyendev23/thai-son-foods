import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ENABLE_COMBOS } from '@/config/features';
import ComboShowcase from '@/components/home/ComboShowcase';
import MemberComboTeaser from '@/components/product/MemberComboTeaser';

/**
 * Trang tất cả combo đang bán (20/11/2026): mục "Combo" ở menu đầu trang và các nút "Xem tất cả gói" trỏ về đây.
 * Danh sách lấy từ /api/combos (cùng nguồn trang chủ); hiện toàn bộ, không thu gọn.
 */
export const metadata: Metadata = {
  title: 'Tất cả combo',
  description: 'Các gói combo thức uống Thái Sơn Foods: sữa hạt, nước giải khát, trà sữa — tiết kiệm hơn mua lẻ.',
};

export default function AllCombosPage() {
  if (!ENABLE_COMBOS) redirect('/');
  return (
    <div className="max-w-[1500px] mx-auto px-2 sm:px-4 py-4 md:py-6">
      {/* Ưu đãi thành viên: 3 combo Member + nút Đăng ký (chỉ khách chưa đăng nhập, 21/11/2026) */}
      <MemberComboTeaser className="mb-4" />
      <div className="bg-white rounded-2xl border border-border shadow-xs [&_#combo]:py-7">
        <ComboShowcase showAll />
      </div>
    </div>
  );
}
