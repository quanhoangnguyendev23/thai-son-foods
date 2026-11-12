'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface DailyDealsState {
  enabled: boolean;
  masterEnabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Công tắc "Deal trong ngày (trang chủ)" ở đầu tab Combo.
 * Lưu vào bảng site_settings (khoá daily_deals_enabled) — trang khách đọc lại ở lần tải sau, không cần build lại.
 */
export default function DailyDealsSwitch({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<DailyDealsState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setState(json.data);
      else setError(json.error || 'Không tải được cài đặt.');
    } catch {
      setError('Không tải được cài đặt.');
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const toggle = async () => {
    if (!state || saving || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'daily_deals_enabled', enabled: !state.enabled }),
      });
      const json = await res.json();
      if (json.success) setState(json.data);
      else setError(json.error || 'Không lưu được cài đặt.');
    } catch {
      setError('Không lưu được cài đặt.');
    } finally {
      setSaving(false);
    }
  };

  const on = Boolean(state?.enabled);
  const disabled = !state || saving || !canManage || state.masterEnabled === false;

  return (
    <section
      aria-labelledby="daily-deals-switch-title"
      className="rounded-xl border border-ink-300 bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div className="min-w-0">
        <h2 id="daily-deals-switch-title" className="text-base text-ink-950">
          Deal trong ngày (trang chủ)
        </h2>
        <p className="text-xs text-ink-700 mt-0.5">Bật để hiện dải deal, đồng hồ và nhãn Deal hôm nay</p>
        {state?.updatedAt && (
          <p className="text-xs text-ink-700 mt-0.5">
            Đổi lần cuối bởi {state.updatedBy || 'không rõ'} lúc {formatTime(state.updatedAt)}
          </p>
        )}
        {state && state.masterEnabled === false && (
          <p className="text-xs text-amber-700 mt-0.5">Đang khoá trong code (ENABLE_DAILY_DEALS = false) nên công tắc không có tác dụng.</p>
        )}
        {!canManage && <p className="text-xs text-ink-700 mt-0.5">Bạn chỉ có quyền xem.</p>}
        {error && (
          <p className="text-xs text-red-600 mt-0.5" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('text-sm', on ? 'text-emerald-700' : 'text-ink-700')}>{state ? (on ? 'Đang bật' : 'Đang tắt') : 'Đang tải…'}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="daily-deals-switch-title"
          onClick={toggle}
          disabled={disabled}
          className={cn(
            'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 motion-reduce:transition-none',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-green-primary/40',
            on ? 'bg-green-primary' : 'bg-ink-300',
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          )}
        >
          <span
            aria-hidden
            className={cn(
              'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none',
              on ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>
    </section>
  );
}
