'use client';

import React, { useEffect, useState } from 'react';

/**
 * Kích thước ảnh chuẩn cho từng chỗ tải ảnh trong trang quản trị.
 * Số liệu lấy theo khung hiển thị thật trên website (xem chú thích "Khung trên web" của từng mục).
 * Khi đổi layout ở front-end (ví dụ đổi chiều cao hero), cập nhật lại bảng này để admin thấy đúng cỡ ảnh.
 */
export type ImageSpecKey =
  | 'product'
  | 'combo'
  | 'banner_hero'
  | 'banner_hero_mobile'
  | 'banner_scroll'
  | 'banner_scroll_mobile'
  | 'banner_promo';

export interface ImageSpec {
  /** Tên ngắn của vị trí ảnh */
  label: string;
  /** Kích thước nên xuất (px) */
  width: number;
  height: number;
  /** Tỉ lệ hiển thị cho người đọc, ví dụ "4:3" */
  ratioLabel: string;
  /** Chiều rộng tối thiểu để không bị mờ trên màn hình thường */
  minWidth: number;
  /** Dung lượng nên đạt (KB). Máy chủ chặn ở 5MB. */
  maxKb: number;
  /** Khung hiển thị thật trên web */
  frame: string;
  /** Lưu ý cho người thiết kế / người thay ảnh */
  note: string;
}

export const UPLOAD_MAX_MB = 5;

export const IMAGE_SPECS: Record<ImageSpecKey, ImageSpec> = {
  product: {
    label: 'Ảnh sản phẩm',
    width: 1200,
    height: 900,
    ratioLabel: '4:3',
    minWidth: 800,
    maxKb: 200,
    frame:
      'Khung 4:3 ở trang chi tiết sản phẩm (ảnh chính khoảng 490×366 px, có phóng to), thẻ sản phẩm, giỏ hàng, bảng so sánh.',
    note: 'Ảnh hiển thị trọn khung (không cắt). Đặt chai/sản phẩm ở giữa, chừa lề khoảng 8% mỗi cạnh vì ảnh còn được cắt vuông ở giỏ hàng và tìm kiếm.',
  },
  combo: {
    label: 'Ảnh combo',
    width: 1200,
    height: 900,
    ratioLabel: '4:3',
    minWidth: 800,
    maxKb: 200,
    frame:
      'Khung 4:3 ở trang chi tiết combo (dùng chung bộ xem ảnh với trang sản phẩm), thẻ combo trang chủ, deal trong ngày.',
    note: 'Cùng cỡ với ảnh sản phẩm để hai trang chi tiết hiển thị giống nhau. Giữ nhóm chai ở giữa, chừa lề khoảng 8% mỗi cạnh.',
  },
  banner_hero: {
    label: 'Hero trang chủ (máy tính)',
    width: 1930,
    height: 680,
    ratioLabel: '≈2,84:1',
    minWidth: 1280,
    maxKb: 300,
    frame:
      'Khung cao cố định: khoảng 965×340 px ở màn hình lớn, 655×266 px ở laptop 1024px, cao 240 px trên máy tính bảng.',
    note: 'Ảnh phủ kín khung và bị cắt bớt trên dưới ở máy tính bảng, nên đặt chữ và sản phẩm trong dải giữa cao khoảng 2/3 ảnh.',
  },
  banner_hero_mobile: {
    label: 'Hero trang chủ (điện thoại)',
    width: 1080,
    height: 630,
    ratioLabel: '≈1,71:1',
    minWidth: 720,
    maxKb: 200,
    frame: 'Khung khoảng 343×200 px trên điện thoại (màn hình dưới 640 px).',
    note: 'Không bắt buộc. Để trống thì điện thoại dùng ảnh máy tính, cắt lấy phần giữa (mất khoảng 40% chiều ngang).',
  },
  banner_scroll: {
    label: 'Banner cuộn (máy tính)',
    width: 1920,
    height: 1080,
    ratioLabel: '16:9',
    minWidth: 1600,
    maxKb: 400,
    frame: 'Phủ toàn màn hình trình duyệt (rộng 100%, cao 100% màn hình) khi cuộn trang chủ.',
    note: 'Nhãn, tiêu đề, phụ đề hiện chồng lên ảnh, nên để vùng giữa và phía dưới ảnh đơn giản, không có chữ.',
  },
  banner_scroll_mobile: {
    label: 'Banner cuộn (điện thoại)',
    width: 1080,
    height: 1920,
    ratioLabel: '9:16',
    minWidth: 720,
    maxKb: 300,
    frame: 'Phủ toàn màn hình điện thoại (ảnh dọc).',
    note: 'Không bắt buộc. Để trống thì điện thoại dùng ảnh máy tính, cắt mất nhiều hai bên.',
  },
  banner_promo: {
    label: 'Banner khuyến mãi / khác',
    width: 1920,
    height: 850,
    ratioLabel: '≈2,26:1',
    minWidth: 1280,
    maxKb: 300,
    frame: 'Vị trí này hiện chưa hiển thị ở đâu trên website.',
    note: 'Nên chuyển sang Hero hoặc Banner cuộn và dùng cỡ ảnh của vị trí đó.',
  },
};

/** Chọn bộ kích thước theo vị trí banner đang sửa */
export function bannerSpecKey(placement: string | undefined, mobile: boolean): ImageSpecKey {
  if (placement === 'scroll') return mobile ? 'banner_scroll_mobile' : 'banner_scroll';
  if (placement === 'promo') return 'banner_promo';
  return mobile ? 'banner_hero_mobile' : 'banner_hero';
}

type Fit = 'ok' | 'ratio' | 'small' | 'large';

/** So kích thước thật của ảnh với chuẩn: lệch tỉ lệ quá 5%, nhỏ hơn mức tối thiểu, hoặc quá lớn */
export function judgeImageSize(w: number, h: number, spec: ImageSpec): Fit {
  const target = spec.width / spec.height;
  const ratio = w / h;
  if (Math.abs(ratio - target) / target > 0.05) return 'ratio';
  if (w < spec.minWidth) return 'small';
  if (w > spec.width * 2) return 'large';
  return 'ok';
}

const FIT_TEXT: Record<Fit, string> = {
  ok: 'Đúng chuẩn',
  ratio: 'Lệch tỉ lệ, sẽ bị cắt hoặc chừa viền',
  small: 'Ảnh nhỏ, có thể bị mờ',
  large: 'Ảnh quá lớn, nên thu nhỏ cho nhẹ',
};

function readNaturalSize(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? { w: img.naturalWidth, h: img.naturalHeight } : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function isVideo(url: string) {
  return /\.mp4(\?|#|$)/i.test(url);
}

/** Khung gợi ý kích thước chuẩn, đặt ngay cạnh nút "Tải ảnh từ máy" */
export function ImageSizeHint({ spec: key, className = '' }: { spec: ImageSpecKey; className?: string }) {
  const spec = IMAGE_SPECS[key];
  return (
    <div className={`rounded-xl border border-ink-200 bg-white px-3 py-2 text-2xs text-ink-700 space-y-0.5 ${className}`}>
      <p className="text-xs text-ink-950">
        Kích thước chuẩn: <span className="font-mono">{spec.width}×{spec.height} px</span> (tỉ lệ {spec.ratioLabel}) · JPG/PNG/WebP · nên dưới{' '}
        {spec.maxKb}KB, tối đa {UPLOAD_MAX_MB}MB
      </p>
      <p>Khung trên web: {spec.frame}</p>
      <p>{spec.note}</p>
    </div>
  );
}

/** Nhãn nhỏ hiện kích thước thật của ảnh đang dùng và so với chuẩn */
export function ImageDimensionBadge({
  src,
  spec: key,
  className = '',
}: {
  src?: string | null;
  spec: ImageSpecKey;
  className?: string;
}) {
  // Kết quả đọc gắn với đúng src đã đọc; đổi src thì kết quả cũ tự bị bỏ qua
  const [result, setResult] = useState<{ src: string; size: { w: number; h: number } | null } | null>(null);
  const current = result && result.src === src ? result : null;
  const size = current?.size ?? null;
  const failed = current !== null && current.size === null;

  useEffect(() => {
    let cancelled = false;
    if (!src || isVideo(src)) return;
    readNaturalSize(src).then((s) => {
      if (cancelled) return;
      setResult({ src, size: s ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!src || isVideo(src)) return null;
  if (failed) {
    return <span className={`text-2xs text-ink-600 ${className}`}>Không đọc được kích thước ảnh</span>;
  }
  if (!size) {
    return <span className={`text-2xs text-ink-600 ${className}`}>Đang đọc kích thước...</span>;
  }
  const spec = IMAGE_SPECS[key];
  const fit = judgeImageSize(size.w, size.h, spec);
  const ok = fit === 'ok';
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-1 px-2 py-0.5 rounded-full text-2xs border ${
        ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
      } ${className}`}
      title={`Chuẩn: ${spec.width}×${spec.height} px (${spec.ratioLabel})`}
    >
      <span className="font-mono">
        {size.w}×{size.h} px
      </span>
      <span>· {FIT_TEXT[fit]}</span>
    </span>
  );
}

/**
 * Kiểm tra các tệp vừa chọn trước khi tải lên. Không chặn tải lên, chỉ trả về câu nhắc
 * (rỗng nếu mọi ảnh đều đúng chuẩn) để admin biết ảnh nào lệch cỡ.
 */
export async function checkImageFilesAgainstSpec(files: File[], key: ImageSpecKey): Promise<string> {
  const spec = IMAGE_SPECS[key];
  const problems: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    try {
      const size = await readNaturalSize(url);
      const kb = Math.round(file.size / 1024);
      const issues: string[] = [];
      if (size) {
        const fit = judgeImageSize(size.w, size.h, spec);
        if (fit !== 'ok') issues.push(`${size.w}×${size.h} px, ${FIT_TEXT[fit].toLowerCase()}`);
      }
      if (kb > spec.maxKb) issues.push(`nặng ${kb}KB`);
      if (issues.length) problems.push(`${file.name}: ${issues.join(', ')}`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (!problems.length) return '';
  return `Lưu ý ${problems.join('; ')}. Chuẩn ${spec.width}×${spec.height} px (${spec.ratioLabel}), dưới ${spec.maxKb}KB.`;
}
