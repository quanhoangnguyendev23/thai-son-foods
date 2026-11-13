'use client';

/**
 * 2 khối biểu đồ ở trang Tổng quan admin (shadcn/ui chart + recharts):
 *  - RevenueCard: "Biểu Đồ Doanh Thu" — cột KPI bên trái + area chart tương tác bên phải, chọn nhanh 7/14/30/90 ngày
 *  - TopProductsCard / TopCombosCard: "Sản Phẩm Bán Chạy" và "Combo Bán Chạy" — 1 cột Hoàn thành mỗi mã, ghi số trên đầu cột
 * Nghiệp vụ theo API /api/admin/stats?section=range:
 *  "Đặt hàng" = mọi đơn không bị huỷ (placed_*), "Hoàn thành" = đơn COMPLETED (daily_revenue / total_* / order_count).
 * Màu chỉ dùng token trong brand-tokens.css.
 */

import * as React from 'react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts';
import { AlertCircle, BarChart3, CalendarDays, Gift, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { safeFetchJson } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
  type ChartTooltipItem,
} from '@/components/ui/chart';

// ---------------------------------------------------------------------------
// Kiểu dữ liệu
// ---------------------------------------------------------------------------

export type TrendRow = {
  date_iso?: string;
  date_label?: string;
  order_count?: number | string;
  daily_revenue?: number | string;
  placed_count?: number | string;
  placed_revenue?: number | string;
};

export type TopItemRow = {
  id?: string;
  name?: string;
  sku?: string | null;
  thumbnail?: string | null;
  unit?: string | null;
  total_sold?: number | string;
  total_earned?: number | string;
  order_count?: number | string;
  placed_sold?: number | string;
  placed_earned?: number | string;
  placed_order_count?: number | string;
};

export type RangePreset = '7' | '14' | '30' | '90' | 'custom';
export type FixedPreset = Exclude<RangePreset, 'custom'>;
const PRESETS: { value: FixedPreset; label: string }[] = [
  { value: '7', label: '7 ngày' },
  { value: '14', label: '14 ngày' },
  { value: '30', label: '30 ngày' },
  { value: '90', label: '90 ngày' },
];

// ---------------------------------------------------------------------------
// Định dạng ngày / số (vi-VN, giờ Việt Nam)
// ---------------------------------------------------------------------------

const DAY_MS = 86400000;
const WEEKDAY_LONG = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const isoTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const isoAddDays = (iso: string, n: number) => new Date(isoTime(iso) + n * DAY_MS).toISOString().slice(0, 10);
export const daysInclusive = (from: string, to: string) => Math.round((isoTime(to) - isoTime(from)) / DAY_MS) + 1;
const vnToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dmy = (iso: string) => `${dm(iso)}/${iso.slice(0, 4)}`;
const longDate = (iso: string) => `${WEEKDAY_LONG[new Date(isoTime(iso)).getUTCDay()]}, ${dmy(iso)}`;

/** "24/10 – 30/10/2026" (cùng năm) hoặc "24/12/2025 – 05/01/2026" */
export const formatRangeLabel = (from: string, to: string) => {
  if (from === to) return dmy(to);
  return from.slice(0, 4) === to.slice(0, 4) ? `${dm(from)} – ${dmy(to)}` : `${dmy(from)} – ${dmy(to)}`;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Số tiền đầy đủ: 156.000 ₫ */
const fmtVND = (v: number) => `${Math.round(v).toLocaleString('vi-VN')} ₫`;

/** Rút gọn cho trục / nhãn nhỏ: 0, 500k, 1tr, 1,5tr, 1,25 tỷ */
const fmtShort = (v: number) => {
  const a = Math.abs(v);
  if (a >= 999_950_000) return `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  if (a >= 999_500) return `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr`;
  if (a >= 1000) return `${Math.round(v / 1000).toLocaleString('vi-VN')}k`;
  return `${Math.round(v)}`;
};

/** KPI: đầy đủ dưới 1 tỷ, từ 1 tỷ rút gọn "1,23 tỷ ₫" (title giữ số đầy đủ) */
const fmtKpiMoney = (v: number) =>
  Math.abs(v) >= 999_950_000 ? `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ ₫` : fmtVND(v);

const fmtPct = (p: number) => `${p.toLocaleString('vi-VN', { maximumFractionDigits: p >= 10 ? 0 : 1 })}%`;

/** So sánh với kỳ trước; kỳ trước = 0 → "Mới" / "—", không bao giờ ra Infinity/NaN */
function compareDelta(cur: number, prev: number | null | undefined): { kind: 'up' | 'down' | 'flat' | 'new' | 'none'; text: string } {
  if (prev === null || prev === undefined || !Number.isFinite(prev)) return { kind: 'none', text: '—' };
  if (prev === 0) return cur > 0 ? { kind: 'new', text: 'Mới' } : { kind: 'none', text: '—' };
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) < 0.5) return { kind: 'flat', text: '0%' };
  const abs = Math.abs(pct);
  const text = abs >= 1000 ? `${Math.round(abs / 100) / 10}k%` : fmtPct(abs);
  return pct > 0 ? { kind: 'up', text: `▲ ${text}` } : { kind: 'down', text: `▼ ${text}` };
}

/** Mốc trục Y "đẹp" (4–5 mốc): bước 1 / 2 / 2,5 / 5 × 10^n → 0, 500k, 1tr, 1,5tr… */
function niceTicks(max: number, target = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / target;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
  const n = Math.max(1, Math.ceil(max / step - 1e-9));
  return Array.from({ length: n + 1 }, (_, i) => i * step);
}

/** Dữ liệu đang hiển thị có còn là của khoảng ngày cũ không (để hiện skeleton khi đổi khoảng) */
export const isTrendStale = (trend: TrendRow[], from: string, to: string) =>
  trend.length === 0 || trend[0]?.date_iso !== from || trend[trend.length - 1]?.date_iso !== to;

/** Tên ngắn: bỏ phần mô tả sau dấu "-" / "," (tên SP trong DB thường kèm mô tả dài) */
const shortName = (name: string) => {
  const s = name.split(/\s[-–,]\s|,\s/)[0]?.trim() || name;
  return s.length > 48 ? `${s.slice(0, 46)}…` : s;
};
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ---------------------------------------------------------------------------
// prefers-reduced-motion
// ---------------------------------------------------------------------------

const RM_QUERY = '(prefers-reduced-motion: reduce)';
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(RM_QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(RM_QUERY).matches,
    () => false
  );
}

// ---------------------------------------------------------------------------
// Bộ chọn khoảng ngày: nút chọn nhanh 7 / 14 / 30 / 90 ngày + "Tuỳ chọn" mở popover chọn ngày
// ---------------------------------------------------------------------------

const MAX_RANGE_DAYS = 366;

function RangeSelect({
  preset,
  from,
  to,
  maxDate,
  onPreset,
  onCustomRange,
}: {
  preset: RangePreset;
  from: string;
  to: string;
  maxDate: string;
  onPreset: (p: FixedPreset) => void;
  onCustomRange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openCustom = () => {
    setDraftFrom(from);
    setDraftTo(to);
    setOpen(true);
  };

  const invalid =
    !draftFrom || !draftTo
      ? 'Chọn đủ 2 ngày'
      : draftFrom > draftTo
        ? 'Ngày bắt đầu phải trước ngày kết thúc'
        : draftTo > maxDate
          ? 'Không chọn ngày trong tương lai'
          : daysInclusive(draftFrom, draftTo) > MAX_RANGE_DAYS
            ? `Tối đa ${MAX_RANGE_DAYS} ngày`
            : '';

  return (
    <div ref={boxRef} className="relative flex items-center gap-2 sm:ml-auto">
      {/* Nút chọn nhanh khoảng thời gian (mặc định 14 ngày); "Tuỳ chọn" mở bảng chọn ngày */}
      <div role="group" aria-label="Chọn khoảng thời gian" className="flex flex-wrap overflow-hidden rounded-lg border border-ink-300 bg-ink-50">
        {PRESETS.map((p, i) => {
          const on = preset === p.value;
          return (
            <button
              key={p.value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setOpen(false);
                if (!on) onPreset(p.value);
              }}
              className={`h-9 px-3 text-xs transition-colors cursor-pointer ${i > 0 ? 'border-l border-ink-200' : ''} ${
                on ? 'bg-emerald-600 text-white' : 'text-ink-800 hover:bg-ink-100 hover:text-ink-950'
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={preset === 'custom'}
          aria-expanded={open}
          onClick={openCustom}
          title="Chọn khoảng ngày bất kỳ"
          className={`inline-flex h-9 items-center gap-1.5 border-l border-ink-200 px-3 text-xs transition-colors cursor-pointer ${
            preset === 'custom' ? 'bg-emerald-600 text-white' : 'text-ink-800 hover:bg-ink-100 hover:text-ink-950'
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          <span className="tabular-nums">{preset === 'custom' ? formatRangeLabel(from, to) : 'Tuỳ chọn…'}</span>
        </button>
      </div>
      {open && (
        <div
          role="dialog"
          aria-label="Chọn khoảng ngày"
          className="absolute right-0 top-full z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-ink-300 bg-white p-3 shadow-xl shadow-ink-900/10"
        >
          <div className="grid grid-cols-2 gap-2 text-xs text-ink-800">
            <label className="space-y-1">
              <span>Từ ngày</span>
              <input
                type="date"
                value={draftFrom}
                max={draftTo || maxDate}
                onChange={(e) => setDraftFrom(e.target.value)}
                className="w-full rounded-lg border border-ink-300 bg-ink-50 px-2 py-1.5 text-ink-950 [color-scheme:light]"
              />
            </label>
            <label className="space-y-1">
              <span>Đến ngày</span>
              <input
                type="date"
                value={draftTo}
                min={draftFrom}
                max={maxDate}
                onChange={(e) => setDraftTo(e.target.value)}
                className="w-full rounded-lg border border-ink-300 bg-ink-50 px-2 py-1.5 text-ink-950 [color-scheme:light]"
              />
            </label>
          </div>
          <p className={`mt-2 text-2xs ${invalid ? 'text-crimson-600' : 'text-ink-800'}`}>
            {invalid || `${daysInclusive(draftFrom, draftTo)} ngày · tối đa ${MAX_RANGE_DAYS} ngày`}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs text-ink-800 hover:text-ink-950 cursor-pointer">
              Huỷ
            </button>
            <button
              type="button"
              disabled={!!invalid}
              onClick={() => {
                onCustomRange(draftFrom, draftTo);
                setOpen(false);
              }}
              className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-medium text-forest-950 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI strip
// ---------------------------------------------------------------------------

type Kpi = { label: string; value: string; title: string; cur: number; prev: number | null | undefined };

function DeltaBadge({ cur, prev, loading }: { cur: number; prev: number | null | undefined; loading: boolean }) {
  if (loading) return <span className="inline-block h-4 w-10 rounded-full bg-ink-100 animate-pulse motion-reduce:animate-none" />;
  const d = compareDelta(cur, prev);
  const cls =
    d.kind === 'up'
      ? 'bg-emerald-500/15 text-emerald-700'
      : d.kind === 'down'
        ? 'bg-crimson-500/15 text-crimson-600'
        : d.kind === 'new'
          ? 'bg-amber-300/15 text-amber-800'
          : 'bg-ink-100 text-ink-800';
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-medium tabular-nums ${cls}`} title="So với kỳ trước cùng độ dài">
      {d.text}
    </span>
  );
}

function KpiStrip({ items, prevLoading, loading }: { items: Kpi[]; prevLoading: boolean; loading: boolean }) {
  return (
    <dl className="grid grid-cols-2 content-start gap-2 sm:grid-cols-4 lg:grid-cols-1">
      {items.map((k) => (
        <div key={k.label} className="min-w-0 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2.5">
          <dt className="truncate text-2xs text-ink-800">{k.label}</dt>
          <dd className="mt-1 flex flex-col items-start gap-1 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            {loading ? (
              <span className="my-1 inline-block h-4 w-24 rounded bg-ink-100 animate-pulse motion-reduce:animate-none" />
            ) : (
              <span className="max-w-full truncate text-base font-semibold tracking-tight text-ink-950 tabular-nums" title={k.title}>
                {k.value}
              </span>
            )}
            <DeltaBadge cur={k.cur} prev={k.prev} loading={prevLoading} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Trạng thái: skeleton / empty / error
// ---------------------------------------------------------------------------

const SKELETON_BARS = [38, 62, 24, 80, 46, 30, 66, 52, 20, 72, 40, 58];

function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-end gap-2 border-b border-ink-200 pl-10 pr-2 animate-pulse motion-reduce:animate-none ${className}`} role="status" aria-label="Đang tải biểu đồ">
      {SKELETON_BARS.map((h, i) => (
        <div key={i} className="flex-1 rounded-t-md bg-ink-100" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function EmptyIllustration() {
  return (
    <svg width="96" height="56" viewBox="0 0 96 56" aria-hidden>
      {[14, 26, 18, 34, 22].map((h, i) => (
        <rect key={i} x={8 + i * 17} y={48 - h} width={10} height={h} rx={3} fill="none" stroke="var(--color-ink-500)" strokeDasharray="3 3" />
      ))}
      <line x1="2" x2="94" y1="48.5" y2="48.5" stroke="var(--color-ink-500)" />
    </svg>
  );
}

function ChartMessage({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink-200 px-4 text-center ${className}`}>{children}</div>;
}

function ErrorState({ text, onRetry, className }: { text: string; onRetry: () => void; className?: string }) {
  return (
    <ChartMessage className={className}>
      <AlertCircle className="h-6 w-6 text-crimson-600" aria-hidden />
      <p className="text-sm text-ink-950">{text}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 px-3 py-1.5 text-xs text-ink-950 hover:border-ink-400 cursor-pointer"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Thử lại
      </button>
    </ChartMessage>
  );
}

// Dòng trong tooltip: tên series · số tiền đầy đủ · số đơn
function TooltipValueRow({ name, value, sub, stacked = false }: { name: string; value: string; sub?: string; stacked?: boolean }) {
  if (stacked) {
    // Khung hẹp (card bán chạy): số phụ xuống dòng để tooltip không rộng quá card
    return (
      <div className="flex flex-1 items-start justify-between gap-3">
        <span className="whitespace-nowrap text-ink-800">{name}</span>
        <span className="text-right tabular-nums">
          <span className="block whitespace-nowrap font-medium text-ink-950">{value}</span>
          {sub && <span className="block whitespace-nowrap text-ink-800">{sub}</span>}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-1 items-center justify-between gap-4">
      <span className="whitespace-nowrap text-ink-800">{name}</span>
      <span className="whitespace-nowrap text-right font-medium tabular-nums text-ink-950">
        {value}
        {sub && <span className="font-normal text-ink-800"> · {sub}</span>}
      </span>
    </div>
  );
}

const AXIS_TICK = { fontSize: 12 };
const GRID_PROPS = { vertical: false, stroke: 'var(--color-ink-200)', strokeOpacity: 1 } as const;

// ---------------------------------------------------------------------------
// Card "Biểu Đồ Doanh Thu" — area chart tương tác
// ---------------------------------------------------------------------------

const revenueConfig = {
  placed: { label: 'Đặt hàng', color: 'var(--color-leaf-500)' },
  done: { label: 'Hoàn thành', color: 'var(--color-amber-500)' },
} satisfies ChartConfig;

type RevenuePoint = { date: string; placed: number; done: number; placedCount: number; doneCount: number };

export function RevenueCard({
  className = '',
  trend,
  from,
  to,
  preset,
  maxDate,
  loading,
  error,
  onRetry,
  onPreset,
  onCustomRange,
}: {
  className?: string;
  trend: TrendRow[];
  from: string;
  to: string;
  preset: RangePreset;
  maxDate: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onPreset: (p: FixedPreset) => void;
  onCustomRange: (from: string, to: string) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [hidden, setHidden] = useState<string[]>([]);

  // Kỳ trước cùng độ dài, ngay trước "from" — chỉ dùng cho badge KPI
  const prevRange = useMemo(() => {
    const len = daysInclusive(from, to);
    return { from: isoAddDays(from, -len), to: isoAddDays(from, -1) };
  }, [from, to]);
  const prevKey = `${prevRange.from}_${prevRange.to}`;
  const [prev, setPrev] = useState<{ key: string; trend: TrendRow[] | null } | null>(null);
  useEffect(() => {
    let alive = true;
    safeFetchJson<{ success?: boolean; revenueTrend?: TrendRow[] }>(`/api/admin/stats?section=range&from=${prevRange.from}&to=${prevRange.to}`, {
      cache: 'no-store',
    }).then((d) => {
      if (alive) setPrev({ key: prevKey, trend: d?.success ? d.revenueTrend || [] : null });
    });
    return () => {
      alive = false;
    };
  }, [prevRange.from, prevRange.to, prevKey]);
  const prevTrend = prev?.key === prevKey ? prev.trend : undefined;

  const stale = isTrendStale(trend, from, to);
  const showSkeleton = loading && stale;
  const showError = error && stale;

  const data = useMemo<RevenuePoint[]>(
    () =>
      trend.map((r, i) => ({
        date: r.date_iso || isoAddDays(from, i),
        placed: num(r.placed_revenue),
        done: num(r.daily_revenue),
        placedCount: num(r.placed_count),
        doneCount: num(r.order_count),
      })),
    [trend, from]
  );

  const sum = (rows: TrendRow[], k: keyof TrendRow) => rows.reduce((s, r) => s + num(r[k]), 0);
  const cur = { done: sum(trend, 'daily_revenue'), placed: sum(trend, 'placed_revenue'), orders: sum(trend, 'placed_count'), doneOrders: sum(trend, 'order_count') };
  const pv = prevTrend ? { done: sum(prevTrend, 'daily_revenue'), placed: sum(prevTrend, 'placed_revenue'), orders: sum(prevTrend, 'placed_count') } : null;
  const avg = cur.orders > 0 ? cur.placed / cur.orders : 0;
  const pvAvg = pv ? (pv.orders > 0 ? pv.placed / pv.orders : 0) : null;
  const kpis: Kpi[] = showError
    ? ['Doanh thu hoàn thành', 'Doanh số đặt hàng', 'Số đơn đặt', 'Giá trị TB/đơn'].map((label) => ({ label, value: '—', title: 'Chưa tải được dữ liệu', cur: 0, prev: null }))
    : [
        { label: 'Doanh thu hoàn thành', value: fmtKpiMoney(cur.done), title: fmtVND(cur.done), cur: cur.done, prev: pv?.done },
        { label: 'Doanh số đặt hàng', value: fmtKpiMoney(cur.placed), title: fmtVND(cur.placed), cur: cur.placed, prev: pv?.placed },
        {
          label: 'Số đơn đặt',
          value: cur.orders.toLocaleString('vi-VN'),
          title: `${cur.orders} đơn không huỷ · ${cur.doneOrders} đơn hoàn thành`,
          cur: cur.orders,
          prev: pv?.orders,
        },
        { label: 'Giá trị TB/đơn', value: fmtKpiMoney(avg), title: fmtVND(avg), cur: avg, prev: pvAvg },
      ];

  const isEmpty = !showSkeleton && data.every((p) => p.placed === 0 && p.done === 0);
  const yTicks = niceTicks(Math.max(0, ...data.flatMap((p) => [hidden.includes('placed') ? 0 : p.placed, hidden.includes('done') ? 0 : p.done])));
  const sparse = data.length <= 14;
  const todayIso = vnToday();

  const toggle = (key: string) =>
    setHidden((h) => {
      if (h.includes(key)) return h.filter((k) => k !== key);
      // Luôn giữ ít nhất 1 series
      return h.length + 1 >= Object.keys(revenueConfig).length ? h : [...h, key];
    });

  const chartHeight = 'h-[230px] sm:h-[260px] lg:h-[320px]';

  return (
    <Card className={`min-w-0 ${className}`}>
      <CardHeader className="flex flex-col gap-3 border-b border-ink-200 pb-4 sm:flex-row sm:items-center">
        <div className="grid flex-1 gap-1">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-700" aria-hidden />
            <span>Biểu Đồ Doanh Thu</span>
            {loading && !showSkeleton && <RefreshCw className="h-3.5 w-3.5 animate-spin text-ink-800" aria-label="Đang cập nhật" />}
          </CardTitle>
          <CardDescription className="tabular-nums">{formatRangeLabel(from, to)} · GMT+7</CardDescription>
        </div>
        <RangeSelect preset={preset} from={from} to={to} maxDate={maxDate} onPreset={onPreset} onCustomRange={onCustomRange} />
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start">
        <KpiStrip items={kpis} loading={showSkeleton} prevLoading={!showError && (prevTrend === undefined || showSkeleton)} />

        <div className="min-w-0">
        {showError ? (
          <ErrorState text="Không tải được dữ liệu doanh thu." onRetry={onRetry} className={chartHeight} />
        ) : showSkeleton ? (
          <ChartSkeleton className={chartHeight} />
        ) : isEmpty ? (
          <ChartMessage className={chartHeight}>
            <EmptyIllustration />
            <p className="text-sm text-ink-950">Chưa có doanh thu trong khoảng này</p>
            <p className="text-xs text-ink-800">Thử chọn khoảng thời gian dài hơn</p>
          </ChartMessage>
        ) : (
          <ChartContainer
            config={revenueConfig}
            className={`aspect-auto w-full transition-opacity ${chartHeight} ${loading ? 'opacity-60' : ''}`}
            aria-label={`Biểu đồ doanh thu ${formatRangeLabel(from, to)}: hoàn thành ${fmtVND(cur.done)}, đặt hàng ${fmtVND(cur.placed)}. Dùng phím mũi tên để xem từng ngày.`}
          >
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
              <defs>
                <linearGradient id="fillPlaced" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-placed)" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="var(--color-placed)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="fillDone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-done)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-done)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={28}
                tick={({ x, y, payload }) => {
                  const iso = String(payload.value);
                  const today = iso === todayIso;
                  return (
                    <text
                      x={x}
                      y={y}
                      dy={12}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={today ? 600 : 400}
                      fill={today ? 'var(--color-amber-700)' : 'var(--color-ink-600)'}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {today ? 'Hôm nay' : dm(iso)}
                    </text>
                  );
                }}
              />
              <YAxis tickLine={false} axisLine={false} width={48} domain={[0, yTicks[yTicks.length - 1]]} ticks={yTicks} interval={0} tick={AXIS_TICK} tickFormatter={(v: number) => fmtShort(v)} />
              <ChartTooltip
                cursor={{ stroke: 'var(--color-ink-400)', strokeOpacity: 0.6 }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(label) => longDate(String(label))}
                    formatter={(value, name, item) => {
                      const p = item.payload as RevenuePoint | undefined;
                      const count = item.dataKey === 'placed' ? p?.placedCount : p?.doneCount;
                      return <TooltipValueRow name={item.dataKey === 'placed' ? 'Doanh số đặt hàng' : 'Doanh thu hoàn thành'} value={fmtVND(num(value))} sub={`${count ?? 0} đơn`} />;
                    }}
                    footer={(payload: ReadonlyArray<ChartTooltipItem>) => {
                      const p = payload[0]?.payload as RevenuePoint | undefined;
                      const rate = p && p.placed > 0 ? fmtPct((p.done / p.placed) * 100) : '—';
                      return (
                        <>
                          Tỷ lệ hoàn thành: <span className="font-medium text-ink-950 tabular-nums">{rate}</span>
                        </>
                      );
                    }}
                  />
                }
              />
              {/* Không xếp chồng: "Hoàn thành" là một phần của "Đặt hàng". Nét monotone để không tạo đỉnh giả. */}
              <Area
                dataKey="placed"
                type="monotone"
                fill="url(#fillPlaced)"
                stroke="var(--color-placed)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                hide={hidden.includes('placed')}
                dot={sparse ? { r: 2.5, fill: 'var(--color-placed)', strokeWidth: 0 } : false}
                activeDot={{ r: 4, fill: 'var(--color-placed)', stroke: '#FFFFFF', strokeWidth: 2 }}
                isAnimationActive={!reducedMotion}
                animationDuration={500}
                animationEasing="ease-out"
              />
              <Area
                dataKey="done"
                type="monotone"
                fill="url(#fillDone)"
                stroke="var(--color-done)"
                strokeWidth={2}
                hide={hidden.includes('done')}
                dot={sparse ? { r: 2.5, fill: 'var(--color-done)', strokeWidth: 0 } : false}
                activeDot={{ r: 4.5, fill: 'var(--color-done)', stroke: '#FFFFFF', strokeWidth: 2 }}
                isAnimationActive={!reducedMotion}
                animationDuration={500}
                animationEasing="ease-out"
              />
              <ChartLegend content={<ChartLegendContent shape="line" hiddenKeys={hidden} onItemClick={toggle} />} />
            </AreaChart>
          </ChartContainer>
        )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card "Sản Phẩm Bán Chạy" / "Combo Bán Chạy" — cùng một bar chart nhiều cột
// ---------------------------------------------------------------------------

type Kind = 'product' | 'combo';

const topConfig = {
  done: { label: 'Hoàn thành', color: 'var(--color-amber-500)' },
} satisfies ChartConfig;

type TopPoint = {
  key: string;
  label: string;
  name: string;
  unit: string;
  placed: number;
  done: number;
  placedQty: number;
  doneQty: number;
  placedOrders: number;
  doneOrders: number;
};

const TOP_N = 5;
const minBar = (v: unknown) => (num(v) > 0 ? 3 : 0);

type TopSellersProps = {
  className?: string;
  items: TopItemRow[];
  rangeLabel: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
};

export function TopProductsCard(props: TopSellersProps & { codeOf: (id?: string | null, sku?: string | null, fallback?: string) => string }) {
  return <TopSellersCard kind="product" {...props} />;
}

export function TopCombosCard(props: TopSellersProps) {
  return <TopSellersCard kind="combo" {...props} />;
}

function TopSellersCard({
  kind,
  className = '',
  items,
  rangeLabel,
  loading,
  error,
  onRetry,
  codeOf,
}: TopSellersProps & { kind: Kind; codeOf?: (id?: string | null, sku?: string | null, fallback?: string) => string }) {
  const reducedMotion = usePrefersReducedMotion();

  const all = useMemo<TopPoint[]>(() => {
    return items
      .map((p, i) => {
        const name = shortName(p.name || '—');
        const label = kind === 'product' && codeOf ? codeOf(p.id, p.sku, p.name) : truncate(name.replace(/^combo\s+/i, ''), 12);
        return {
          key: p.id || `${p.name}-${i}`,
          label,
          name,
          unit: kind === 'product' ? (p.unit || 'chai').replace(/^1\s+/, '') : 'gói',
          placed: num(p.placed_earned ?? p.total_earned),
          done: num(p.total_earned),
          placedQty: num(p.placed_sold ?? p.total_sold),
          doneQty: num(p.total_sold),
          placedOrders: num(p.placed_order_count ?? p.order_count),
          doneOrders: num(p.order_count),
        };
      })
      .sort((a, b) => b.done - a.done || b.placed - a.placed || b.doneQty - a.doneQty);
  }, [kind, items, codeOf]);

  const data = all.slice(0, TOP_N);
  const yTicks = niceTicks(Math.max(0, ...data.map((p) => p.done)));
  const totalDone = all.reduce((s, r) => s + r.done, 0);
  const totalPlaced = all.reduce((s, r) => s + r.placed, 0);
  const leader = data[0];
  const kindLabel = kind === 'product' ? 'sản phẩm' : 'gói';
  const showSkeleton = loading && items.length === 0;
  const showError = error && items.length === 0;
  const isEmpty = !showSkeleton && data.length === 0;
  const chartBox = 'min-h-[230px] flex-1';

  return (
    <Card className={`min-w-0 ${className}`}>
      <CardHeader>
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            {kind === 'product' ? <Sparkles className="h-4 w-4 text-amber-800" aria-hidden /> : <Gift className="h-4 w-4 text-amber-800" aria-hidden />}
            <span>{kind === 'product' ? 'Sản Phẩm Bán Chạy' : 'Gói Bán Chạy'}</span>
            {loading && !showSkeleton && <RefreshCw className="h-3.5 w-3.5 animate-spin text-ink-800" aria-label="Đang cập nhật" />}
          </CardTitle>
          <CardDescription className="tabular-nums">
            Top {TOP_N} theo doanh thu hoàn thành · {rangeLabel}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {showError ? (
          <ErrorState text="Không tải được danh sách bán chạy." onRetry={onRetry} className={chartBox} />
        ) : showSkeleton ? (
          <ChartSkeleton className={chartBox} />
        ) : isEmpty ? (
          <ChartMessage className={chartBox}>
            <EmptyIllustration />
            <p className="text-sm text-ink-950">Chưa có {kindLabel} nào được bán trong khoảng này</p>
          </ChartMessage>
        ) : (
          <ChartContainer
            config={topConfig}
            className={`aspect-auto w-full transition-opacity ${chartBox} ${loading ? 'opacity-60' : ''}`}
            aria-label={`Top ${data.length} ${kindLabel} bán chạy ${rangeLabel}. Dùng phím mũi tên để xem từng ${kindLabel}.`}
          >
            <BarChart data={data} margin={{ top: 22, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%" accessibilityLayer>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" tickLine={false} tickMargin={10} axisLine={false} interval={0} tick={AXIS_TICK} tickFormatter={(v: string) => truncate(String(v), 10)} />
              <YAxis tickLine={false} axisLine={false} width={44} domain={[0, yTicks[yTicks.length - 1]]} ticks={yTicks} interval={0} tick={AXIS_TICK} tickFormatter={(v: number) => fmtShort(v)} />
              <ChartTooltip
                cursor={{ fill: 'var(--color-ink-200)', fillOpacity: 0.5 }}
                content={
                  <ChartTooltipContent
                    indicator="dashed"
                    labelFormatter={(_, payload) => <span className="block max-w-[14rem]">{(payload[0]?.payload as TopPoint | undefined)?.name ?? ''}</span>}
                    formatter={(value, name, item) => {
                      const p = item.payload as TopPoint | undefined;
                      return (
                        <div className="grid gap-1.5">
                          <TooltipValueRow
                            stacked
                            name="Hoàn thành"
                            value={fmtVND(num(value))}
                            sub={`${(p?.doneQty ?? 0).toLocaleString('vi-VN')} ${p?.unit ?? ''} · ${p?.doneOrders ?? 0} đơn`}
                          />
                          <TooltipValueRow
                            stacked
                            name="Đặt hàng (gồm cả đơn chưa xong)"
                            value={fmtVND(p?.placed ?? 0)}
                            sub={`${(p?.placedQty ?? 0).toLocaleString('vi-VN')} ${p?.unit ?? ''} · ${p?.placedOrders ?? 0} đơn`}
                          />
                        </div>
                      );
                    }}
                    footer={(payload: ReadonlyArray<ChartTooltipItem>) => {
                      const p = payload[0]?.payload as TopPoint | undefined;
                      const share = p && totalDone > 0 ? fmtPct((p.done / totalDone) * 100) : '—';
                      return (
                        <>
                          Tỷ trọng doanh thu hoàn thành: <span className="font-medium text-ink-950 tabular-nums">{share}</span>
                        </>
                      );
                    }}
                  />
                }
              />
              <Bar dataKey="done" fill="var(--color-done)" radius={4} maxBarSize={56} minPointSize={minBar} isAnimationActive={!reducedMotion} animationDuration={500}>
                {/* Mã dẫn đầu tô đậm hơn */}
                {data.map((p, i) => (
                  <Cell key={p.key} fill={i === 0 && p.done > 0 ? 'var(--color-amber-700)' : 'var(--color-done)'} />
                ))}
                <LabelList dataKey="done" position="top" offset={6} fontSize={12} fill="var(--color-ink-950)" formatter={(v: unknown) => (num(v) > 0 ? fmtShort(num(v)) : '')} />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>

      {!showError && !showSkeleton && !isEmpty && leader && (
        <CardFooter className="flex-col items-start gap-2 border-t border-ink-200 pt-4 text-sm">
          <div className="flex min-w-0 max-w-full items-center gap-2 font-medium leading-snug text-ink-950">
            <span className="truncate" title={leader.name}>
              Dẫn đầu: {leader.name}
            </span>
            <span className="shrink-0 tabular-nums text-amber-800">{totalDone > 0 ? fmtPct((leader.done / totalDone) * 100) : '—'}</span>
            <TrendingUp className="h-4 w-4 shrink-0 text-amber-800" aria-hidden />
          </div>
          <div className="text-xs leading-snug text-ink-800 tabular-nums">
            {all.length} {kindLabel} · hoàn thành {fmtVND(totalDone)} · đặt hàng {fmtVND(totalPlaced)}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
