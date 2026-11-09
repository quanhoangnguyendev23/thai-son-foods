/**
 * Chuẩn hóa chữ và tách số nhà / tên đường cho ô nhập địa chỉ.
 * Mọi hàm ở đây thuần (không gọi mạng, không đụng DOM) nên chạy được cả ở server, trình duyệt và test.
 *
 * Nguyên tắc: các hàm "normalize..." chỉ dùng để SO KHỚP, tuyệt đối không dùng để hiển thị hay ghi đè chữ khách gõ.
 */

/** Bỏ dấu tiếng Việt (đ → d), giữ nguyên chữ hoa/thường. */
export function stripDiacritics(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đð]/g, 'd') // ð (eth) hay lẫn vào dữ liệu OSM thay cho đ
    .replace(/[ĐÐ]/g, 'D');
}

/**
 * Dạng so khớp: NFC → bỏ dấu → chữ thường → chỉ còn a-z, 0-9 và 1 khoảng trắng giữa các từ.
 * "P. Hạnh  Thông" → "p hanh thong"
 */
export function normalizeForMatch(input: string): string {
  return stripDiacritics((input || '').normalize('NFC'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const TOKEN_EXPANSION: Record<string, string> = {
  p: 'phuong',
  f: 'phuong',
  phg: 'phuong',
  q: 'quan',
  tp: 'thanh pho',
  tx: 'thi xa',
  tt: 'thi tran',
  tphcm: 'thanh pho ho chi minh',
  hcm: 'ho chi minh',
  hcmc: 'ho chi minh',
  sg: 'ho chi minh',
  saigon: 'sai gon',
};

/**
 * Mở viết tắt trên chuỗi đã qua normalizeForMatch:
 * "p 5" / "p5" → "phuong 5", "q 1" → "quan 1", "tp hcm" → "thanh pho ho chi minh", "d le loi" → "duong le loi".
 */
export function expandAbbreviations(norm: string): string {
  if (!norm) return '';
  const spaced = norm.replace(/\b([pqf])(\d+)\b/g, '$1 $2');
  const tokens = spaced.split(' ');
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'd') {
      // "đ. Lê Lợi" → đường; không đụng tới tên đường kiểu "D2", "D 5" (số liền sau)
      const next = tokens[i + 1] || '';
      if (/^[a-z]{2,}$/.test(next)) {
        out.push('duong');
        continue;
      }
    }
    out.push(TOKEN_EXPANSION[t] ?? t);
  }
  return out.join(' ');
}

/** Bỏ tiền tố hành chính ở đầu chuỗi đã chuẩn hóa: "phuong hanh thong" → "hanh thong". */
export function stripAdminPrefix(norm: string): string {
  return norm.replace(/^(phuong|xa|thi tran|quan|huyen|thi xa|thanh pho|tinh)\s+/, '').trim();
}

/** Tiền tố hành chính ở đầu chuỗi đã chuẩn hóa (nếu có). */
export function adminPrefixOf(norm: string): 'ward' | 'district' | 'city' | null {
  if (/^(phuong|xa|thi tran)\s/.test(norm)) return 'ward';
  if (/^(quan|huyen|thi xa)\s/.test(norm)) return 'district';
  if (/^(thanh pho|tinh)\s/.test(norm)) return 'city';
  return null;
}

/** Bỏ chữ "Đường/Phố/Đại lộ" ở đầu tên đường, nhưng giữ "Đường số 1", "Đường D2", "Đường 3 Tháng 2". */
export function cleanStreetDisplay(name: string): string {
  // OSM đôi khi dùng Ð/ð (eth) thay cho Đ/đ: "Trần Hưng Ðạo" → "Trần Hưng Đạo"
  const t = (name || '').trim().replace(/\s+/g, ' ').replace(/Ð/g, 'Đ').replace(/ð/g, 'đ');
  const m = t.match(/^(?:đường|đ\.|phố|đại\s*lộ)\s+(.+)$/i);
  if (!m) return t;
  const rest = m[1];
  // "Đường số 1", "Đường 3/2", "Đường D2": phần theo sau mới là tên đường thật, giữ nguyên chữ "Đường"
  if (/^(số\s*)?\d/i.test(rest) || /^[a-zđ]\d/i.test(rest)) return t;
  return rest;
}

/** Khóa so khớp tên đường: không dấu, bỏ "Đường/Phố/Đại lộ" ở đầu ("Đường Lê Lợi" ≡ "le loi"). */
export function streetKeyOf(name: string): string {
  const n = normalizeForMatch(cleanStreetDisplay(name));
  return n.replace(/^(duong|pho|dai lo)\s+/, '').trim();
}

const NUMBER_PATTERN = '\\d+[A-Za-z]?(?:\\s*[\\/\\-]\\s*\\d+[A-Za-z]?)*';
const HOUSE_RE = new RegExp(
  '^\\s*(?:(?:số|so|nhà\\s*số|nha\\s*so)\\.?\\s*)?' + // "Số", "Nhà số" (bỏ đi khi hiển thị)
    '(?:(hẻm|hem|ngõ|ngo|ngách|ngach|kiệt|kiet)\\s*)?' + // số hẻm/ngõ
    '(' + NUMBER_PATTERN + ')(?=\\s|,|$)\\s*,?\\s*(.*)$',
  'i'
);

export interface HouseStreetSplit {
  houseNumber: string;
  houseLabel: string;
  isAlley: boolean;
  street: string;
}

/**
 * Tách "số nhà + tên đường" từ ĐOẠN ĐẦU của địa chỉ (trước dấu phẩy đầu tiên).
 * Hiểu: "101", "101A", "101/5", "12/34/5", "Số 101", "Nhà số 2C", "Hẻm 76 Lê Lợi" (76 là số hẻm).
 * Không có số nhà ở đầu thì houseNumber = "" và toàn bộ đoạn là tên đường.
 */
export function splitHouseAndStreet(firstSegment: string): HouseStreetSplit {
  const seg = (firstSegment || '').trim().replace(/\s+/g, ' ');
  const m = seg.match(HOUSE_RE);
  if (m && (m[3] || '').trim()) {
    const alleyWord = m[1] || '';
    const number = m[2].replace(/\s*([\/\-])\s*/g, '$1').toUpperCase();
    // Giữ chữ Hẻm/Ngõ đúng như khách viết (viết hoa chữ đầu); số nhà thường thì chỉ giữ số
    const label = alleyWord ? `${alleyWord.charAt(0).toUpperCase()}${alleyWord.slice(1).toLowerCase()} ${number}` : number;
    return {
      houseNumber: number,
      houseLabel: label,
      isAlley: !!alleyWord,
      street: cleanStreetDisplay(m[3].trim()),
    };
  }
  return { houseNumber: '', houseLabel: '', isAlley: false, street: cleanStreetDisplay(seg) };
}

const ALLEY_NAME_RE = /^(?:đường\s+)?(hẻm|hem|ngõ|ngo|ngách|ngach|kiệt|kiet)\s+([\w\/\-]+)\s+(?:đường\s+)?(.+)$/i;

export interface AlleySplit {
  alleyWord: string;
  alleyNumber: string;
  baseStreet: string;
}

/**
 * Tên đường của nhà cung cấp có dạng "Hẻm 116 Đường Lê Lợi" thì thực chất là hẻm 116 của đường Lê Lợi.
 * Trả về null nếu không phải tên hẻm.
 */
export function splitAlleyName(name: string): AlleySplit | null {
  const m = (name || '').trim().match(ALLEY_NAME_RE);
  if (!m) return null;
  return { alleyWord: m[1], alleyNumber: m[2].toUpperCase(), baseStreet: cleanStreetDisplay(m[3].trim()) };
}

/** Hai số nhà giống nhau (bỏ khoảng trắng, không phân biệt hoa/thường): "12/34/5a" ≡ "12/34/5A". */
export function sameHouseNumber(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const n = (s: string) => s.replace(/\s+/g, '').toUpperCase();
  return n(a) === n(b);
}

/**
 * Hai dòng địa chỉ là cùng một nơi nếu cùng tên đường và (khi cả hai đều có số nhà) cùng số nhà.
 * "101 Lê Lợi" ≡ "101 Đường Lê Lợi, Gò Vấp"; "1 Lê Lợi" ≠ "2 Lê Lợi"; "Lê Lợi" ≡ "2 Lê Lợi" (một bên chưa có số).
 */
export function sameAddressLine(a: string, b: string): boolean {
  const first = (t: string) => (t || '').split(',')[0] || '';
  const sa = splitHouseAndStreet(first(a));
  const sb = splitHouseAndStreet(first(b));
  const ka = streetKeyOf(sa.street);
  if (!ka || ka !== streetKeyOf(sb.street)) return false;
  if (sa.houseNumber && sb.houseNumber && !sameHouseNumber(sa.houseNumber, sb.houseNumber)) return false;
  return true;
}

/** Ghép dòng "Số nhà, tên đường" để hiển thị / điền vào ô. */
export function composeAddressLine(houseLabel: string | undefined, street: string | undefined): string {
  return [houseLabel, street].map((p) => (p || '').trim()).filter(Boolean).join(' ');
}

/** Khoảng cách đường chim bay tới từng mét (hàm trong lib/geo làm tròn tới 0,1 km nên không dùng được cho ghim). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

/**
 * Tọa độ có thật không: thiếu (null/undefined/NaN) hoặc đúng (0, 0) đều coi là THIẾU. (0, 0) nằm giữa biển Đại Tây Dương,
 * thường là giá trị mặc định do lỗi ghi, không bao giờ là địa chỉ giao hàng. Dùng ở mọi chỗ đọc tọa độ (phí ship, kiểm tra
 * phường, quản trị, script quét).
 */
export function hasRealCoords(lat: unknown, lng: unknown): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined || lat === '' || lng === '') return false;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === 0 && b === 0) return false;
  return a >= -90 && a <= 90 && b >= -180 && b <= 180;
}

/** Bản chụp chuỗi địa chỉ (để biết địa chỉ đã lưu có bị sửa sau khi xác nhận ghim không): không dấu, gọn khoảng trắng. */
export function addressSnapshot(a: { address?: string | null; ward?: string | null; district?: string | null; province?: string | null }): string {
  return [a.address, a.ward, a.district, a.province].map((p) => normalizeForMatch(String(p || ''))).join('|');
}
