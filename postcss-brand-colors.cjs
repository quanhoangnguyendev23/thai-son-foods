/**
 * PostCSS plugin: KHÔNG CHO PHÉP MÀU ĐEN trong CSS đầu ra (kể cả CSS của thư viện như Leaflet, Swiper).
 * Mọi giá trị đen / gần đen (kênh sáng nhất < 58) bị đổi sang xanh rêu thương hiệu #143D38
 * (giữ nguyên độ trong suốt nếu có). Xem src/app/brand-tokens.css.
 */
const BRAND_DARK_HEX = '#143D38';
const BRAND_DARK_RGB = '20 61 56';
const BRAND_SHADOW_RGB = '34 84 76'; // brand-forest, dùng cho bóng đổ có độ trong suốt
const LIMIT = 58;

function skipProp(prop) {
  return /font|weight|src|content|animation|transition|grid|url/i.test(prop);
}

function alphaOut(alpha) {
  return 'rgb(' + BRAND_SHADOW_RGB + ' / ' + alpha + ')';
}

function fix(value) {
  if (value.indexOf('url(') !== -1) return value;
  let v = value;

  // rgb()/rgba()
  v = v.replace(/rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)/gi, (m, r, g, b, a) => {
    if (Math.max(+r, +g, +b) >= LIMIT) return m;
    return a === undefined ? BRAND_DARK_HEX : alphaOut(a);
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
    if (Math.max(r, g, b) >= LIMIT) return m;
    return a === null || a >= 0.999 ? BRAND_DARK_HEX : alphaOut(a.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));
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
