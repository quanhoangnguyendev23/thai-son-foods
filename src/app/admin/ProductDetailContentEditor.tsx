'use client';

import { useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import {
  DEFAULT_PRODUCT_DETAIL,
  type ProductDetailContent,
  type ProductHighlightItem,
  type NutritionRow,
} from '@/data/product-detail-content';

/**
 * Form nhập "Thông tin sản phẩm" (cột products.detail_content) trong hộp thoại sửa sản phẩm.
 * Ô để trống → trang chi tiết dùng nội dung trong code (src/data/product-detail-content.ts), rồi tới câu mặc định
 * (hiện ở placeholder). Máy chủ làm sạch lại toàn bộ khi lưu (sanitizeProductDetailContent).
 */
interface Props {
  value: ProductDetailContent | null | undefined;
  onChange: (next: ProductDetailContent) => void;
  onNotify?: (message: string, type?: 'success' | 'error') => void;
}

const inputCls =
  'w-full bg-ink-50 border border-ink-300 rounded-xl px-3.5 py-2 text-xs text-ink-950 focus:outline-none focus:border-emerald-500';
const labelCls = 'block text-sm text-ink-800 mb-1';
const MAX_HIGHLIGHTS = 6;
const MAX_NUTRITION_ROWS = 20;

const TEXT_FIELDS: { key: keyof ProductDetailContent; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: 'usage', label: 'Hướng dẫn sử dụng', placeholder: DEFAULT_PRODUCT_DETAIL.usage, multiline: true },
  { key: 'storage', label: 'Hướng dẫn bảo quản', placeholder: DEFAULT_PRODUCT_DETAIL.storage },
  { key: 'expiry', label: 'Hạn sử dụng', placeholder: DEFAULT_PRODUCT_DETAIL.expiry },
  { key: 'manufacturer', label: 'Nhà sản xuất', placeholder: 'Trống = ẩn dòng này' },
  { key: 'origin', label: 'Xuất xứ', placeholder: DEFAULT_PRODUCT_DETAIL.origin },
  { key: 'certification', label: 'Chứng nhận', placeholder: DEFAULT_PRODUCT_DETAIL.certification },
  { key: 'packagingMaterial', label: 'Chất liệu bao bì', placeholder: DEFAULT_PRODUCT_DETAIL.packagingMaterial },
];

export default function ProductDetailContentEditor({ value, onChange, onNotify }: Props) {
  const content: ProductDetailContent = value || {};
  const [uploading, setUploading] = useState(false);
  const highlights = content.highlights || [];
  const nutrition = content.nutrition || { basis: '', rows: [], source: '' };

  const set = (patch: Partial<ProductDetailContent>) => onChange({ ...content, ...patch });
  const setHighlight = (idx: number, patch: Partial<ProductHighlightItem>) =>
    set({ highlights: highlights.map((h, i) => (i === idx ? { ...h, ...patch } : h)) });
  const setNutrition = (patch: Partial<NonNullable<ProductDetailContent['nutrition']>>) =>
    set({ nutrition: { ...nutrition, ...patch } });
  const setRow = (idx: number, patch: Partial<NutritionRow>) =>
    setNutrition({ rows: nutrition.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });

  const handleUploadLabel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const formData = new FormData();
    formData.append('folder', 'products');
    formData.append('files', file);
    setUploading(true);
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const data = await res.json();
      const url = (data.urls && data.urls[0]) || data.url;
      if (!data.success || !url) {
        onNotify?.(data.error || 'Tải ảnh nhãn thất bại', 'error');
        return;
      }
      set({ labelImage: url });
    } catch {
      onNotify?.('Tải ảnh nhãn thất bại', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-3.5 rounded-xl bg-white border border-ink-200 space-y-4">
      <div>
        <p className="text-sm text-ink-950">Thông tin chi tiết (khung “Thông tin sản phẩm” ở trang chi tiết)</p>
        <p className="text-xs text-ink-600 mt-0.5">
          Ô để trống sẽ dùng nội dung mặc định (chữ mờ trong ô). Chỉ nhập số liệu đúng theo nhãn sản phẩm.
        </p>
      </div>

      {/* Thành phần */}
      <div>
        <label className={labelCls}>Thành phần</label>
        <textarea
          rows={3}
          value={content.ingredients || ''}
          onChange={(e) => set({ ingredients: e.target.value })}
          placeholder="Trống = hiện “đang cập nhật”"
          maxLength={2000}
          className={inputCls}
        />
      </div>

      {/* Sử dụng, bảo quản, thông tin chung */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TEXT_FIELDS.map((f) => (
          <div key={f.key} className={f.multiline ? 'sm:col-span-2' : ''}>
            <label className={labelCls}>{f.label}</label>
            {f.multiline ? (
              <textarea
                rows={2}
                value={(content[f.key] as string) || ''}
                onChange={(e) => set({ [f.key]: e.target.value } as Partial<ProductDetailContent>)}
                placeholder={f.placeholder}
                className={inputCls}
              />
            ) : (
              <input
                type="text"
                value={(content[f.key] as string) || ''}
                onChange={(e) => set({ [f.key]: e.target.value } as Partial<ProductDetailContent>)}
                placeholder={f.placeholder}
                className={inputCls}
              />
            )}
          </div>
        ))}
      </div>

      {/* Điểm nổi bật */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-ink-800">Điểm nổi bật ({highlights.length}/{MAX_HIGHLIGHTS})</p>
          <button
            type="button"
            disabled={highlights.length >= MAX_HIGHLIGHTS}
            onClick={() => set({ highlights: [...highlights, { labelVi: '', contentVi: '', labelEn: '', contentEn: '' }] })}
            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline disabled:opacity-40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm ý
          </button>
        </div>
        {highlights.length === 0 && (
          <p className="text-xs text-ink-600">
            Chưa có — trang sẽ hiện 3 ý mặc định ({DEFAULT_PRODUCT_DETAIL.highlights.map((h) => h.labelVi).join(', ')}).
          </p>
        )}
        {highlights.map((h, idx) => (
          <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-start p-2 rounded-lg bg-ink-50">
            <input type="text" value={h.labelVi} onChange={(e) => setHighlight(idx, { labelVi: e.target.value })} placeholder="Tiêu đề (VD: Chứng nhận HACCP)" maxLength={80} className={inputCls} />
            <input type="text" value={h.contentVi} onChange={(e) => setHighlight(idx, { contentVi: e.target.value })} placeholder="Nội dung" maxLength={300} className={inputCls} />
            <button type="button" onClick={() => set({ highlights: highlights.filter((_, i) => i !== idx) })} title="Xóa ý này" className="p-2 text-brand-crimson hover:bg-white rounded-lg cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <input type="text" value={h.labelEn} onChange={(e) => setHighlight(idx, { labelEn: e.target.value })} placeholder="Title (English, tuỳ chọn)" maxLength={80} className={inputCls} />
            <input type="text" value={h.contentEn} onChange={(e) => setHighlight(idx, { contentEn: e.target.value })} placeholder="Content (English, tuỳ chọn)" maxLength={300} className={inputCls} />
          </div>
        ))}
      </div>

      {/* Dinh dưỡng */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-ink-800">Bảng dinh dưỡng ({nutrition.rows.length} dòng)</p>
          <button
            type="button"
            disabled={nutrition.rows.length >= MAX_NUTRITION_ROWS}
            onClick={() => setNutrition({ rows: [...nutrition.rows, { label: '', value: '' }] })}
            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline disabled:opacity-40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm dòng
          </button>
        </div>
        <input
          type="text"
          value={nutrition.basis}
          onChange={(e) => setNutrition({ basis: e.target.value })}
          placeholder="Cơ sở tính (VD: Giá trị dinh dưỡng trung bình trong 100ml)"
          maxLength={200}
          className={inputCls}
        />
        {nutrition.rows.map((r, idx) => (
          <div key={idx} className="grid grid-cols-[2fr_1fr_auto] gap-2 items-center">
            <input type="text" value={r.label} onChange={(e) => setRow(idx, { label: e.target.value })} placeholder="Chỉ tiêu (VD: Năng lượng)" maxLength={80} className={inputCls} />
            <input type="text" value={r.value} onChange={(e) => setRow(idx, { value: e.target.value })} placeholder="Giá trị (VD: 31 kcal)" maxLength={40} className={inputCls} />
            <button type="button" onClick={() => setNutrition({ rows: nutrition.rows.filter((_, i) => i !== idx) })} title="Xóa dòng này" className="p-2 text-brand-crimson hover:bg-ink-50 rounded-lg cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <input
          type="text"
          value={nutrition.source}
          onChange={(e) => setNutrition({ source: e.target.value })}
          placeholder="Nguồn số liệu (VD: Theo nhãn sản phẩm)"
          maxLength={300}
          className={inputCls}
        />
        <p className="text-xs text-ink-600">Không có dòng nào → tab Dinh dưỡng chỉ hiện năng lượng (kcal) ở trên, nếu có.</p>
      </div>

      {/* Ảnh nhãn */}
      <div>
        <label className={labelCls}>Ảnh nhãn thông tin sản phẩm</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={content.labelImage || ''}
            onChange={(e) => set({ labelImage: e.target.value })}
            placeholder="/uploads/products/... hoặc tải ảnh lên"
            className={inputCls}
          />
          <label className={`shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Đang tải...' : 'Tải ảnh'}
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadLabel} />
          </label>
        </div>
        {content.labelImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={content.labelImage} alt="Ảnh nhãn" className="mt-2 h-24 w-auto rounded-lg border border-ink-200 object-contain bg-ink-50" />
        )}
      </div>
    </div>
  );
}
