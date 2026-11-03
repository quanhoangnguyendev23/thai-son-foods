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

/**
 * MÀU CHỮ CHỈ ĐƯỢC LÀ 1 TRONG 7 MÀU GỐC (hoặc trắng), không pha nhạt, không trong suốt.
 * Áp cho thuộc tính `color` / `-webkit-text-fill-color`: màu pha trắng (tint) của màu gốc X
 *  - nền sáng: pha ít → đúng màu X (xanh rêu/ink: t <= 0.78, màu khác: t <= 0.5); pha nhiều → trắng.
 *  - nền tối (selector có lớp nền tối, xem DARK_CTX): mọi màu pha nhạt (t > 0.3) → trắng.
 * Màu khác (không phải tint) → màu gốc gần nhất. Bỏ độ trong suốt (trừ ::placeholder, :disabled).
 */
const BRAND7 = [[34, 84, 76], [35, 110, 69], [124, 162, 80], [224, 146, 69], [181, 99, 34], [130, 66, 45], [238, 53, 92]];
const TEXT_PROPS = /^(color|-webkit-text-fill-color)$/i;
// Lớp nền tối: chữ nhạt bên trong phải thành trắng (quy tắc ngữ cảnh viết ở cuối brand-tokens.css)
const DARK_CTX = /admin-theme|bg-(forest|emerald|ink|slate|gray|teal|green)-(700|800|900|950)|bg-green-primary|bg-brand-(forest|emerald)|from-(emerald|forest|slate|teal)-9/;
function snapText([r, g, b], dark) {
  if (r >= 250 && g >= 250 && b >= 250) return [255, 255, 255];
  for (const t of THIRD_PARTY) if (t === r + ',' + g + ',' + b) return null;
  for (const base of BRAND7) {
    if (base.every((c, i) => Math.abs(c - [r, g, b][i]) <= 2)) return null; // đã đúng màu gốc
  }
  let best = null, bt = 0, err = Infinity;
  for (const base of BRAND7) {
    const ts = base.map((c, i) => ([r, g, b][i] - c) / (255 - c));
    const t = ts.reduce((a, x) => a + x, 0) / 3;
    if (t < -0.02 || t > 1) continue;
    const e = Math.max(...base.map((c, i) => Math.abs(c + (255 - c) * t - [r, g, b][i])));
    if (e < err) { err = e; best = base; bt = t; }
  }
  if (best && err <= 8) {
    const limit = dark ? 0.3 : best === BRAND7[0] ? 0.78 : 0.5;
    return bt > limit ? [255, 255, 255] : best;
  }
  let nb = BRAND7[0], nd = Infinity;
  for (const base of BRAND7) {
    const d = (base[0] - r) ** 2 + (base[1] - g) ** 2 + (base[2] - b) ** 2;
    if (d < nd) { nd = d; nb = base; }
  }
  return nb;
}
function parseColor(s) {
  s = s.trim();
  let m = s.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/i);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
    return [+m[1], +m[2], +m[3], a];
  }
  if (/^white$/i.test(s)) return [255, 255, 255, 1];
  return null;
}

module.exports = () => {
  const vars = new Map();
  const seed = () => {
    try {
      const t = require('fs').readFileSync(require('path').join(__dirname, 'src/app/brand-tokens.css'), 'utf8');
      for (const m of t.matchAll(/(--color-[\w-]+)\s*:\s*([^;]+);/g)) if (!vars.has(m[1])) vars.set(m[1], fix(m[2].trim()));
    } catch {}
  };
  const resolve = (name, depth = 0) => {
    const v = vars.get(name);
    if (v === undefined || depth > 10) return null;
    const ref = v.match(/^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/);
    return ref ? resolve(ref[1], depth + 1) : parseColor(v);
  };
  return {
    postcssPlugin: 'brand-no-black',
    Once(root) {
      // Gom giá trị các biến --color-* (theme Tailwind + brand-tokens) để giải màu chữ.
      root.walkDecls(/^--color-/, (d) => { vars.set(d.prop, fix(d.value.trim())); });
      seed();
      root.walkDecls(TEXT_PROPS, (decl) => {
        const v = decl.value.trim();
        if (/^(inherit|initial|unset|currentcolor|transparent|revert)$/i.test(v)) return;
        const sel = decl.parent && decl.parent.selector ? decl.parent.selector : '';
        const keepAlpha = /placeholder|:disabled/i.test(sel);
        let rgb = null, alpha = 1;
        const mix = v.match(/^color-mix\(\s*in\s+[\w-]+\s*,\s*(var\(\s*(--color-[\w-]+)\s*\)|#[0-9a-f]{3,8}|rgba?\([^)]*\))\s*([\d.]+)%\s*,\s*transparent\s*\)$/i);
        const single = v.match(/^var\(\s*(--color-[\w-]+)\s*\)$/);
        if (mix) { rgb = mix[2] ? resolve(mix[2]) : parseColor(mix[1]); alpha = +mix[3] / 100; }
        else if (single) rgb = resolve(single[1]);
        else rgb = parseColor(fix(v));
        if (!rgb) return;
        if (rgb.length === 4) alpha *= rgb[3];
        if (alpha === 0) return;
        const snapped = snapText(rgb.slice(0, 3), DARK_CTX.test(sel)) || rgb.slice(0, 3);
        const out = keepAlpha && alpha < 1 ? 'rgb(' + snapped.join(' ') + ' / ' + alpha + ')' : toHex(snapped);
        if (out.toLowerCase() !== v.toLowerCase()) decl.value = out;
      });
    },
    Declaration(decl) {
      if (skipProp(decl.prop)) return;
      if (TEXT_PROPS.test(decl.prop) && /^#[0-9A-F]{6}$/.test(decl.value)) return;
      const next = fix(decl.value);
      if (next !== decl.value) decl.value = next;
    },
  };
};
module.exports.postcss = true;
