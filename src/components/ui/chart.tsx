'use client';

/**
 * Chart kiểu shadcn/ui (bọc recharts), chỉnh cho dự án Thái Sơn Foods:
 *  - Màu lấy từ `config[key].color` (truyền biến token như `var(--color-amber-300)`), không viết mã màu cứng.
 *  - Tooltip / legend dùng tông tối của trang admin.
 *  - Legend có thể bấm để ẩn/hiện từng series (onItemClick + hiddenKeys).
 */

import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
  }
>;

type ChartContextProps = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextProps | null>(null);

export function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error('useChart phải nằm trong <ChartContainer />');
  return ctx;
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${(id || uniqueId).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          'flex justify-center text-xs',
          '[&_.recharts-cartesian-axis-tick_text]:fill-ink-800 [&_.recharts-text]:tabular-nums',
          '[&_.recharts-surface]:outline-none [&_.recharts-layer]:outline-none [&_.recharts-sector]:outline-none [&_.recharts-wrapper]:outline-none',
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

/** Khai báo --color-<key> cho từng series để dùng `var(--color-<key>)` trong chart */
function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const vars = Object.entries(config)
    .filter(([, c]) => c.color)
    .map(([key, c]) => `  --color-${key}: ${c.color};`)
    .join('\n');
  if (!vars) return null;
  return <style dangerouslySetInnerHTML={{ __html: `[data-chart=${id}] {\n${vars}\n}` }} />;
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

export type ChartTooltipItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string | ReadonlyArray<number | string>;
  color?: string;
  fill?: string;
  payload?: Record<string, unknown>;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  indicator = 'dot',
  hideLabel = false,
  labelFormatter,
  formatter,
  footer,
}: {
  active?: boolean;
  payload?: ReadonlyArray<ChartTooltipItem>;
  label?: string | number;
  className?: string;
  indicator?: 'dot' | 'line' | 'dashed';
  hideLabel?: boolean;
  labelFormatter?: (label: string | number | undefined, payload: ReadonlyArray<ChartTooltipItem>) => React.ReactNode;
  formatter?: (value: ChartTooltipItem['value'], name: string, item: ChartTooltipItem) => React.ReactNode;
  footer?: (payload: ReadonlyArray<ChartTooltipItem>) => React.ReactNode;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;
  return (
    <div
      className={cn(
        'grid min-w-[11rem] max-w-[min(22rem,calc(100vw-2rem))] gap-1.5 rounded-xl border border-ink-300 bg-white px-3 py-2.5 text-[11.5px] leading-snug text-ink-950 shadow-xl shadow-ink-900/10',
        className
      )}
    >
      {!hideLabel && <div className="font-medium text-ink-950">{labelFormatter ? labelFormatter(label, payload) : label}</div>}
      <div className="grid gap-1">
        {payload.map((item, i) => {
          const key = String(item.dataKey ?? item.name ?? i);
          const cfg = config[key];
          const color = cfg?.color || item.color || item.fill;
          const name = String(cfg?.label ?? item.name ?? key);
          return (
            <div key={key} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  'shrink-0',
                  indicator === 'dot' && 'h-2.5 w-2.5 rounded-[3px]',
                  indicator === 'line' && 'h-0.5 w-3 rounded-full',
                  indicator === 'dashed' && 'w-3 border-t-2 border-dashed bg-transparent'
                )}
                style={indicator === 'dashed' ? { borderColor: color } : { background: color }}
              />
              {formatter ? (
                formatter(item.value, name, item)
              ) : (
                <div className="flex flex-1 items-center justify-between gap-4">
                  <span className="text-ink-800">{name}</span>
                  <span className="font-medium tabular-nums text-ink-950">{String(item.value ?? '')}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {footer && <div className="border-t border-ink-300 pt-1.5 text-ink-800">{footer(payload)}</div>}
    </div>
  );
}

export const ChartLegend = RechartsPrimitive.Legend;

type LegendItem = { value?: string | number; dataKey?: unknown; color?: string };

export function ChartLegendContent({
  payload,
  className,
  hiddenKeys,
  onItemClick,
  shape = 'square',
}: {
  payload?: ReadonlyArray<LegendItem>;
  className?: string;
  hiddenKeys?: ReadonlyArray<string>;
  onItemClick?: (key: string) => void;
  shape?: 'square' | 'line';
}) {
  const { config } = useChart();
  if (!payload?.length) return null;
  // Giữ đúng thứ tự khai báo trong config (recharts mặc định sắp theo tên)
  const order = Object.keys(config);
  const rank = (item: LegendItem) => {
    const i = order.indexOf(String(item.dataKey ?? item.value ?? ''));
    return i < 0 ? order.length : i;
  };
  const items = [...payload].sort((a, b) => rank(a) - rank(b));
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-2 pt-3', className)}>
      {items.map((item) => {
        const key = String(item.dataKey ?? item.value ?? '');
        const cfg = config[key];
        const hidden = hiddenKeys?.includes(key);
        const color = cfg?.color || item.color;
        const content = (
          <>
            <span
              aria-hidden
              className={shape === 'square' ? 'h-2.5 w-2.5 rounded-[3px]' : 'h-0.5 w-3.5 rounded-full'}
              style={{ background: color }}
            />
            <span className={hidden ? 'line-through decoration-ink-800' : ''}>{cfg?.label ?? item.value}</span>
          </>
        );
        const base = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors';
        if (!onItemClick) {
          return (
            <span key={key} className={cn(base, 'border-ink-200 text-ink-950')}>
              {content}
            </span>
          );
        }
        return (
          <button
            key={key}
            type="button"
            aria-pressed={!hidden}
            onClick={() => onItemClick(key)}
            title={hidden ? 'Bấm để hiện' : 'Bấm để ẩn'}
            className={cn(
              base,
              'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200',
              hidden ? 'border-ink-200 text-ink-800 opacity-60 hover:opacity-90' : 'border-ink-300 bg-ink-50 text-ink-950'
            )}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
