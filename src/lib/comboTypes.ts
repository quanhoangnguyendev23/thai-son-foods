/**
 * Loại combo (cột combos.combo_type), theo cột "Mô tả" của "Bảng tính giá Combo" (sheet "Bảng tính combo", 15/11/2026).
 * Chỉ dùng để quản lý / lọc trong trang admin; không đổi cách tính giá hay hiển thị ở trang bán hàng.
 * Member giữ lại để dùng sau (19/11/2026 đã bỏ các combo Member khỏi web).
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

/** Giá trị client gửi → loại hợp lệ, '' / null → null (chưa phân loại), sai → undefined (báo lỗi) */
export function parseComboType(raw: unknown): ComboTypeKey | null | undefined {
  if (raw === null || raw === undefined || raw === '') return null;
  const v = String(raw).trim().toUpperCase();
  return (COMBO_TYPES as readonly { key: string }[]).some((t) => t.key === v) ? (v as ComboTypeKey) : undefined;
}
