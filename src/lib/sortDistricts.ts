/**
 * Sắp xếp danh sách Quận/Huyện cho đúng thực tế:
 * (Dùng cho cả Phường/Xã: Phường 1, 2, ... rồi tới phường/xã tên chữ.)
 * 1. Quận có số đứng trước, theo số tăng dần (Quận 1, 3, ... 9, 10, 12).
 * 2. Sau đó các quận/huyện/thành phố tên chữ, theo bảng chữ cái tiếng Việt
 *    (bỏ qua tiền tố "Quận", "Huyện", "TP.", "TX."... khi so sánh).
 */

const PREFIX_RE = /^(quận|q\.|huyện|h\.|thị xã|tx\.?|thành phố|tp\.?|phường|p\.|xã|thị trấn|tt\.?)\s*/i;

function districtNumber(name: string): number | null {
  const m = name.trim().match(/^(?:quận|q\.?|phường|p\.?)\s*(\d+)(?!\d)/i) || name.trim().match(/^(\d+)$/);
  return m ? Number(m[1]) : null;
}

function districtLabel(name: string): string {
  return name.trim().replace(PREFIX_RE, '').trim();
}

export function compareDistrictNames(a: string, b: string): number {
  const na = districtNumber(a);
  const nb = districtNumber(b);
  if (na !== null && nb !== null) return na - nb;
  if (na !== null) return -1;
  if (nb !== null) return 1;
  return (
    districtLabel(a).localeCompare(districtLabel(b), 'vi', { sensitivity: 'base' }) ||
    a.localeCompare(b, 'vi')
  );
}

export function sortDistrictsByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((x, y) => compareDistrictNames(x.name, y.name));
}
