/**
 * PostCSS plugin: CHỈ CHO PHÉP MÀU THƯƠNG HIỆU trong CSS đầu ra (kể cả CSS của thư viện như Leaflet, Swiper).
 * - Đen / gần đen (kênh sáng nhất < 58) → xanh rêu thương hiệu #22544C (giữ độ trong suốt nếu có).
 * - Xám trung tính → màu pha trắng của #22544C cùng độ sáng; xanh dương → #236E45.
 * Xem src/app/brand-tokens.css và .agents/rules/brand-colors.md.
 */
const BRAND_DARK_HEX = '#22544C';
const BRAND_DARK_RGB = '34 84 76';
const BRAND_SHADOW_RGB = '34 84 76'; // brand-forest, dùng cho bóng đổ có độ trong suốt
const LIMIT = 58;

function skipProp(prop) {
  return /font|weight|src|content|animation|transition|grid|url/i.test(prop);
}

function alphaOut(alpha) {
  return 'rgb(' + BRAND_SHADOW_RGB + ' / ' + alpha + ')';
}

/**
 * Màu ngoài bảng thương hiệu thường gặp trong CSS thư viện (Leaflet, Swiper):
 *  - xám trung tính (#666, #ccc...) → màu pha trắng của brand-forest có cùng độ sáng;
 *  - xanh dương (link/khung bản đồ #0078A8, #3388FF, #007AFF) → brand-emerald #236E45.
 * Trả về [r, g, b] mới, hoặc null nếu giữ nguyên.
 */
const FOREST = [34, 84, 76];
// Màu nhận diện bên thứ ba bắt buộc giữ (Google, Facebook, Zalo) — xem mục 5 trong brand-colors.md
const THIRD_PARTY = new Set(['66,133,244', '52,168,83', '251,188,5', '234,67,53', '24,119,242', '0,104,255']);
function brandRemap(r, g, b) {
  if (THIRD_PARTY.has(r + ',' + g + ',' + b)) return null;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max < LIMIT) return FOREST;
  if (max - min <= 6 && (r + g + b) / 3 < 240) {
    const avg = (r + g + b) / 3;
    const fAvg = (FOREST[0] + FOREST[1] + FOREST[2]) / 3;
    const t = Math.min(1, Math.max(0, (avg - fAvg) / (255 - fAvg)));
    return FOREST.map((c) => Math.round(c + (255 - c) * t));
  }
  if (b >= r + 40 && b >= g + 10) return [35, 110, 69];
  return null;
}
const toHex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();

function fix(value) {
  if (value.indexOf('url(') !== -1) return value;
  let v = value;

  // rgb()/rgba()
  v = v.replace(/rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)/gi, (m, r, g, b, a) => {
    if (Math.max(+r, +g, +b) < LIMIT) return a === undefined ? BRAND_DARK_HEX : alphaOut(a);
    const re = brandRemap(+r, +g, +b);
    if (!re) return m;
    return a === undefined ? toHex(re) : 'rgb(' + re.join(' ') + ' / ' + a + ')';
  });

  // hex 3/4/6/8 chữ số
  v = v.replace(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g, (m, h) => {
    let r, g, b, a = null;
    if (h.length === 3 || h.length === 4) {
      r = parseInt(h[0] + h[0], 16); g = parseInt(h[1] + h[1], 16); b = parseInt(h[2] + h[2], 16);
      if (h.length === 4) a = parseInt(h[3] + h[3], 16) / 255;
    } else {
      r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
      if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
    }
    if (Math.max(r, g, b) < LIMIT) {
      return a === null || a >= 0.999 ? BRAND_DARK_HEX : alphaOut(a.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));
    }
    const re = brandRemap(r, g, b);
    if (!re) return m;
    return a === null || a >= 0.999 ? toHex(re) : 'rgb(' + re.join(' ') + ' / ' + a.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + ')';
  });

  // từ khóa black
  v = v.replace(/(^|[\s,(])black(?![A-Za-z0-9_-])/gi, (m, pre) => pre + BRAND_DARK_HEX);
  return v;
}

module.exports = () => ({
  postcssPlugin: 'brand-no-black',
  Declaration(decl) {
    if (skipProp(decl.prop)) return;
    const next = fix(decl.value);
    if (next !== decl.value) decl.value = next;
  },
});
module.exports.postcss = true;
