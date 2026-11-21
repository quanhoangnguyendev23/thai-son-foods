/**
 * Loại combo (cột combos.combo_type), theo cột "Mô tả" của "Bảng tính giá Combo" (sheet "Bảng tính combo", 15/11/2026).
 * Dùng để quản lý / lọc trong trang admin; không đổi cách tính giá.
 * MEMBER (thêm lại 21/11/2026): khách chưa đăng nhập vẫn thấy nhưng bị khoá, phải đăng ký / đăng nhập mới mua được;
 * API đặt hàng cũng chặn combo MEMBER khi không có phiên đăng nhập.
 */
export const COMBO_TYPES = [
  { key: 'DA_DANG', label: 'Đa dạng', hint: 'Tối thiểu 3 loại sản phẩm' },
  { key: 'CHI_DINH', label: 'Chỉ định', hint: 'Một sản phẩm chiếm từ 50% số chai' },
  { key: 'TANG_SO_LUONG', label: 'Tăng số lượng', hint: 'Gói nhỏ, mua nhiều giá tốt' },
  { key: 'GIA', label: 'Giá', hint: 'Combo giá tốt cho gia đình' },
  { key: 'MEMBER', label: 'Member', hint: 'Dành cho thành viên' },
] as const;

export type ComboTypeKey = (typeof COMBO_TYPES)[number]['key'];

export const COMBO_TYPE_LABEL: Record<string, string> = Object.fromEntries(COMBO_TYPES.map((t) => [t.key, t.label]));

/** Combo chỉ dành cho thành viên đã đăng nhập */
export function isMemberCombo(c: { comboType?: string | null; combo_type?: string | null } | null | undefined): boolean {
  return String(c?.comboType ?? c?.combo_type ?? '').toUpperCase() === 'MEMBER';
}

/** Giá trị client gửi → loại hợp lệ, '' / null → null (chưa phân loại), sai → undefined (báo lỗi) */
export function parseComboType(raw: unknown): ComboTypeKey | null | undefined {
  if (raw === null || raw === undefined || raw === '') return null;
  const v = String(raw).trim().toUpperCase();
  return (COMBO_TYPES as readonly { key: string }[]).some((t) => t.key === v) ? (v as ComboTypeKey) : undefined;
}
