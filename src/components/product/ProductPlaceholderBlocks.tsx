'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { MapPin, Heart, RotateCcw, Search, MessageCircleQuestion, ImageIcon, ChevronDown, CalendarDays, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PLACEHOLDER_LABEL,
  MONTHLY_SALES_PLACEHOLDER,
  COUPON_PLACEHOLDER,
  DELIVERY_ADDRESS_PLACEHOLDERS,
  RETURN_POLICY_PLACEHOLDER,
  PRODUCT_QA_PLACEHOLDERS,
  REVIEW_IMAGE_PLACEHOLDER_COUNT,
  PREORDER_PLACEHOLDER,
  SHOW_PLACEHOLDER_BLOCKS,
} from '@/data/product-detail-placeholders';

/**
 * Các khối giao diện theo bố cục Amazon mà TSF CHƯA có nghiệp vụ thật.
 * Dữ liệu lấy từ `src/data/product-detail-placeholders.ts`. Mọi tương tác chỉ đổi trạng thái UI,
 * không gọi API, không lưu, không báo thành công.
 */

function PlaceholderBadgeImpl({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border border-dashed border-copper-400 bg-copper-50 px-1.5 py-px text-[10px] font-medium text-copper-800 whitespace-nowrap',
        className
      )}
      title="Khối giao diện mẫu, dữ liệu chưa phải dữ liệu thật"
    >
      {PLACEHOLDER_LABEL}
    </span>
  );
}

/** Dòng "đã mua trong tháng trước" cạnh đánh giá */
function MonthlySalesPlaceholderImpl() {
  return (
    <p className="flex items-center gap-2 flex-wrap text-[13px] text-gray-600">
      <span>{MONTHLY_SALES_PLACEHOLDER.text}</span>
      <PlaceholderBadge />
    </p>
  );
}

/** Dòng mã giảm giá dưới khu vực giá */
function CouponPlaceholderImpl() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-amber-200 bg-ivory px-3 py-2 text-xs text-ink-950">
      <div className="flex items-start gap-2 flex-wrap">
        <span className="shrink-0 rounded bg-sale px-1.5 py-0.5 text-[12px] text-white">
          {COUPON_PLACEHOLDER.badge}
        </span>
        <span className="min-w-0 flex-1 leading-relaxed">
          <strong className="text-[1.125em]">{COUPON_PLACEHOLDER.title}</strong>: {COUPON_PLACEHOLDER.description}{' '}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-forest-700 hover:underline cursor-pointer"
          >
            {COUPON_PLACEHOLDER.termsLabel}
          </button>
        </span>
        <PlaceholderBadge />
      </div>
      {open && <p className="mt-1.5 text-gray-600">{COUPON_PLACEHOLDER.termsText}</p>}
    </div>
  );
}

/** "Giao đến" — chọn địa chỉ giao hàng (chỉ đổi hiển thị) */
function DeliveryAddressPlaceholderImpl() {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(DELIVERY_ADDRESS_PLACEHOLDERS[0]?.id);
  const selected = DELIVERY_ADDRESS_PLACEHOLDERS.find((a) => a.id === selectedId);

  return (
    <div className="text-[13px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        className="flex w-full items-start gap-2 text-left cursor-pointer group"
      >
        <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" aria-hidden />
        <span className="min-w-0 flex-1 leading-snug">
          <span className="text-gray-600">Giao đến: </span>
          <span className="text-forest-700 group-hover:underline">{selected?.line}</span>
        </span>
        <ChevronDown className={cn('w-4 h-4 text-gray-400 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <div className="pl-6 mt-1">
        <PlaceholderBadge />
      </div>
      {open && (
        <fieldset id={listId} className="mt-2 ml-6 space-y-1.5 rounded-lg border border-gray-200 p-2.5">
          <legend className="sr-only">Chọn địa chỉ giao hàng</legend>
          {DELIVERY_ADDRESS_PLACEHOLDERS.map((addr) => (
            <label key={addr.id} className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name={`${listId}-addr`}
                checked={addr.id === selectedId}
                onChange={() => setSelectedId(addr.id)}
                className="mt-0.5 accent-forest-700"
              />
              <span className="leading-snug">
                <strong className="text-[1.125em]">{addr.label}</strong>
                <span className="block text-xs text-gray-600">{addr.line}</span>
              </span>
            </label>
          ))}
          <p className="text-[11px] text-gray-500 pt-1">
            Sổ địa chỉ chưa kết nối tài khoản. Địa chỉ giao thật được nhập ở bước thanh toán.
          </p>
        </fieldset>
      )}
    </div>
  );
}

/** Chính sách đổi trả trong Buy Box */
function ReturnPolicyPlaceholderImpl() {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-xs text-gray-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 text-forest-700 hover:underline cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5 text-gray-500" aria-hidden />
        {RETURN_POLICY_PLACEHOLDER.title}
      </button>
      {open && (
        <div className="mt-1.5 pl-5.5 space-y-1">
          <p>{RETURN_POLICY_PLACEHOLDER.text}</p>
          <PlaceholderBadge />
        </div>
      )}
    </div>
  );
}

/** Nút "Lưu vào danh sách yêu thích" — chỉ đổi trạng thái hiển thị, không lưu */
function WishlistPlaceholderButtonImpl() {
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setSaved((v) => !v)}
        aria-pressed={saved}
        className="w-full h-9 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-[13px] text-ink-950 inline-flex items-center justify-center gap-2 cursor-pointer"
      >
        <Heart className={cn('w-4 h-4', saved ? 'fill-red-500 text-red-500' : 'text-gray-600')} aria-hidden />
        {saved ? 'Đã đánh dấu (chưa lưu vào tài khoản)' : 'Thêm vào danh sách yêu thích'}
      </button>
      <div className="text-center">
        <PlaceholderBadge />
      </div>
    </div>
  );
}

/** Hỏi & đáp sản phẩm */
function ProductQAPlaceholderImpl() {
  const [keyword, setKeyword] = useState('');
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const items = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return k ? PRODUCT_QA_PLACEHOLDERS.filter((q) => q.question.toLowerCase().includes(k)) : PRODUCT_QA_PLACEHOLDERS;
  }, [keyword]);

  return (
    <section className="max-w-[1456px] mx-auto px-4 sm:px-6 py-8 md:py-10" aria-labelledby="qa-title">
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <h2 id="qa-title" className="text-2xl md:text-2xl text-ink-950">
          Câu hỏi & trả lời
        </h2>
        <PlaceholderBadge />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 max-w-3xl">
        <label className="relative flex-1">
          <span className="sr-only">Tìm câu hỏi</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden />
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm câu hỏi về sản phẩm…"
            className="w-full h-10 rounded-lg border border-gray-300 pl-9 pr-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30"
          />
        </label>
        <button
          type="button"
          onClick={() => setAsking((v) => !v)}
          aria-expanded={asking}
          className="h-10 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <MessageCircleQuestion className="w-4 h-4" aria-hidden />
          Đặt câu hỏi
        </button>
      </div>

      {asking && (
        <div className="mt-3 max-w-3xl rounded-lg border border-gray-200 p-3 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Nhập câu hỏi của bạn…"
            className="w-full rounded-md border border-gray-300 p-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-500">Chức năng gửi câu hỏi chưa được triển khai, câu hỏi sẽ không được gửi đi.</p>
            <button type="button" disabled className="h-9 px-4 rounded-full bg-gray-200 text-gray-500 text-sm cursor-not-allowed">
              Gửi câu hỏi
            </button>
          </div>
        </div>
      )}

      <ul className="mt-5 max-w-3xl divide-y divide-gray-100 border-y border-gray-100">
        {items.length === 0 && <li className="py-4 text-sm text-gray-600">Không tìm thấy câu hỏi phù hợp.</li>}
        {items.map((qa) => {
          const isOpen = expanded === qa.id;
          return (
            <li key={qa.id} className="py-3">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : qa.id)}
                aria-expanded={isOpen}
                className="flex w-full items-start justify-between gap-3 text-left cursor-pointer"
              >
                <span className="text-sm">
                  <strong className="text-[1.125em]">Hỏi: </strong>
                  {qa.question}
                </span>
                <ChevronDown className={cn('w-4 h-4 text-gray-400 shrink-0 mt-0.5 transition-transform', isOpen && 'rotate-180')} aria-hidden />
              </button>
              {isOpen && (
                <div className="mt-2 text-sm text-gray-700">
                  <p>
                    <strong className="text-[1.125em]">Đáp: </strong>
                    {qa.answer}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {qa.answeredBy} · {qa.dateLabel}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Ảnh từ khách hàng (đặt phía trên danh sách đánh giá) */
function ReviewImagesPlaceholderImpl() {
  return (
    <section className="max-w-[1456px] mx-auto px-4 sm:px-6 pt-8" aria-labelledby="review-images-title">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h2 id="review-images-title" className="text-xl text-ink-950">
          Hình ảnh từ khách hàng
        </h2>
        <PlaceholderBadge />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: REVIEW_IMAGE_PLACEHOLDER_COUNT }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center"
            aria-label="Ảnh mẫu"
            role="img"
          >
            <ImageIcon className="w-6 h-6 text-gray-300" aria-hidden />
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">Hệ thống đánh giá hiện chưa hỗ trợ khách hàng đính kèm ảnh.</p>
    </section>
  );
}

/** "Chọn cách nhận hàng": Giao hôm nay / Đặt trước (chọn ngày giao) — chỉ đổi trạng thái giao diện */
const WEEKDAY_VI = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function PreorderSchedulePlaceholderImpl() {
  const groupId = useId();
  const [mode, setMode] = useState<'now' | 'preorder'>('now');
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null);
  // Ngày chỉ tính ở trình duyệt sau khi tải xong để tránh lệch giữa server và client
  const [baseDate, setBaseDate] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBaseDate(new Date());
  }, []);

  const days = useMemo(
    () =>
      PREORDER_PLACEHOLDER.days.map((d) => {
        let weekday = '';
        let dateLabel = '';
        if (baseDate) {
          const dt = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + d.offset);
          weekday = d.offset === 1 ? 'Ngày mai' : WEEKDAY_VI[dt.getDay()];
          dateLabel = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
        }
        const full = d.remaining <= 0;
        const low = !full && d.remaining <= PREORDER_PLACEHOLDER.lowThreshold;
        return { ...d, weekday, dateLabel, full, low };
      }),
    [baseDate]
  );
  const selected = days.find((d) => d.offset === selectedOffset) || null;

  const modeBtn = (value: 'now' | 'preorder', label: string, hint: string) => {
    const active = mode === value;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => setMode(value)}
        className={cn(
          'min-w-0 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer',
          active ? 'border-2 border-green-primary bg-white' : 'border-gray-300 bg-white hover:border-gray-500'
        )}
      >
        <span className="block text-[13px] text-ink-950">{label}</span>
        <span className="block text-[11px] leading-tight text-gray-600 mt-0.5">{hint}</span>
      </button>
    );
  };

  return (
    <div className="rounded-lg border border-dashed border-copper-400 bg-ivory p-3 space-y-2.5 text-[13px]">
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarDays className="w-4 h-4 text-gray-600 shrink-0" aria-hidden />
        <strong className="text-[1.125em] text-ink-950">{PREORDER_PLACEHOLDER.title}</strong>
        <PlaceholderBadge />
      </div>

      <div role="radiogroup" aria-label={PREORDER_PLACEHOLDER.title} className="grid grid-cols-2 gap-2">
        {modeBtn('now', PREORDER_PLACEHOLDER.nowLabel, PREORDER_PLACEHOLDER.nowHint)}
        {modeBtn('preorder', PREORDER_PLACEHOLDER.preorderLabel, PREORDER_PLACEHOLDER.preorderHint)}
      </div>

      {mode === 'preorder' && (
        <div className="space-y-2">
          <div role="radiogroup" aria-label="Chọn ngày giao" className="grid grid-cols-3 gap-2">
            {days.map((d) => {
              const active = selectedOffset === d.offset;
              return (
                <button
                  key={`${groupId}-${d.offset}`}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-disabled={d.full}
                  disabled={d.full}
                  onClick={() => setSelectedOffset(d.offset)}
                  className={cn(
                    'min-w-0 rounded-lg border px-1.5 py-2 text-center transition-colors',
                    d.full
                      ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                      : active
                        ? 'border-2 border-green-primary bg-white cursor-pointer'
                        : 'border-gray-300 bg-white hover:border-gray-500 cursor-pointer'
                  )}
                >
                  <span className="block text-[12px] leading-tight">{d.weekday || '\u00A0'}</span>
                  <span className="block text-[13px] leading-tight text-ink-950">{d.dateLabel || '\u00A0'}</span>
                  <span
                    className={cn(
                      'block text-[11px] leading-tight mt-1',
                      d.full ? 'text-gray-400' : d.low ? 'text-amber-700' : 'text-green-primary'
                    )}
                  >
                    {d.full ? 'Đã đủ suất' : d.low ? `Còn ít (${d.remaining})` : `Còn ${d.remaining} suất`}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="flex items-start gap-1.5 text-xs text-gray-700" aria-live="polite">
            <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-px" aria-hidden />
            <span>
              {selected
                ? `Giao ngày ${selected.weekday.toLowerCase()} ${selected.dateLabel}. `
                : 'Chọn một ngày giao ở trên. '}
              {PREORDER_PLACEHOLDER.cutOffText}
            </span>
          </p>
          <p className="text-[11px] text-gray-500">{PREORDER_PLACEHOLDER.quotaNote}</p>
        </div>
      )}

      <p className="text-[11px] text-gray-500">{PREORDER_PLACEHOLDER.footnote}</p>
    </div>
  );
}

// Khối mẫu chỉ hiển thị khi bật NEXT_PUBLIC_SHOW_PLACEHOLDERS=true (mặc định ẩn khi go-live)
export function PlaceholderBadge(props: { className?: string }) {
  return SHOW_PLACEHOLDER_BLOCKS ? <PlaceholderBadgeImpl {...(props as object)} /> : null;
}
export function MonthlySalesPlaceholder(props: { className?: string }) {
  return SHOW_PLACEHOLDER_BLOCKS ? <MonthlySalesPlaceholderImpl {...(props as object)} /> : null;
}
export function CouponPlaceholder(props: { className?: string }) {
  return SHOW_PLACEHOLDER_BLOCKS ? <CouponPlaceholderImpl {...(props as object)} /> : null;
}
export function DeliveryAddressPlaceholder(props: { className?: string }) {
  return SHOW_PLACEHOLDER_BLOCKS ? <DeliveryAddressPlaceholderImpl {...(props as object)} /> : null;
}
export function ReturnPolicyPlaceholder(props: { className?: string }) {
  return SHOW_PLACEHOLDER_BLOCKS ? <ReturnPolicyPlaceholderImpl {...(props as object)} /> : null;
}
export function WishlistPlaceholderButton(props: { className?: string }) {
  return SHOW_PLACEHOLDER_BLOCKS ? <WishlistPlaceholderButtonImpl {...(props as object)} /> : null;
}
export function ProductQAPlaceholder(props: { className?: string }) {
  return SHOW_PLACEHOLDER_BLOCKS ? <ProductQAPlaceholderImpl {...(props as object)} /> : null;
}
export function ReviewImagesPlaceholder(props: { className?: string }) {
  return SHOW_PLACEHOLDER_BLOCKS ? <ReviewImagesPlaceholderImpl {...(props as object)} /> : null;
}
export function PreorderSchedulePlaceholder(props: { className?: string }) {
  return SHOW_PLACEHOLDER_BLOCKS ? <PreorderSchedulePlaceholderImpl {...(props as object)} /> : null;
}
