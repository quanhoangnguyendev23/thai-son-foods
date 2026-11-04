'use client';

/**
 * Popup thông báo / xác nhận dùng chung cho toàn site (thay alert() và confirm() của trình duyệt).
 *
 * Cách dùng ở bất kỳ component client nào:
 *   import { showAlert, showConfirm } from '@/components/ui/AppDialog';
 *   showAlert('Đã lưu!', { tone: 'success' });
 *   if (!(await showConfirm('Xóa sản phẩm này?', { tone: 'danger', okText: 'Xóa' }))) return;
 *
 * <AppDialogHost /> được gắn một lần ở src/app/layout.tsx nên dùng được ở cả trang khách lẫn trang admin.
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { AlertTriangle, CheckCircle2, Info, Trash2, XCircle } from 'lucide-react';

export type DialogTone = 'info' | 'success' | 'warning' | 'error' | 'danger';

export interface DialogOptions {
  /** Tiêu đề in đậm phía trên nội dung. Bỏ trống → tự chọn theo tone. */
  title?: string;
  tone?: DialogTone;
  /** Chữ trên nút đồng ý. Mặc định "Đã hiểu" (thông báo) / "Đồng ý" (xác nhận). */
  okText?: string;
  /** Chữ trên nút hủy của hộp xác nhận. Mặc định "Hủy". */
  cancelText?: string;
}

interface DialogRequest extends Required<Omit<DialogOptions, 'title'>> {
  id: number;
  kind: 'alert' | 'confirm';
  title: string;
  message: string;
  resolve: (ok: boolean) => void;
}

// ===== Kho hàng đợi nhỏ ở cấp module (không cần Provider) =====
let queue: DialogRequest[] = [];
let nextId = 1;
let hostCount = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
function getSnapshot() {
  return queue;
}
const EMPTY: DialogRequest[] = [];
function getServerSnapshot() {
  return EMPTY;
}

const DEFAULT_TITLE: Record<DialogTone, string> = {
  info: 'Thông báo',
  success: 'Thành công',
  warning: 'Lưu ý',
  error: 'Có lỗi xảy ra',
  danger: 'Xác nhận',
};

function enqueue(kind: 'alert' | 'confirm', message: string, opts: DialogOptions = {}): Promise<boolean> {
  // Chưa có host (hiếm: lỗi gắn layout) → dùng hộp thoại trình duyệt để không mất thông báo
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (hostCount === 0) {
    if (kind === 'confirm') return Promise.resolve(window.confirm(message));
    window.alert(message);
    return Promise.resolve(true);
  }
  const tone: DialogTone = opts.tone ?? (kind === 'confirm' ? 'warning' : 'info');
  return new Promise<boolean>((resolve) => {
    queue = [
      ...queue,
      {
        id: nextId++,
        kind,
        message: String(message ?? ''),
        tone,
        title: opts.title ?? (kind === 'confirm' && tone !== 'danger' ? 'Xác nhận' : DEFAULT_TITLE[tone]),
        okText: opts.okText ?? (kind === 'confirm' ? 'Đồng ý' : 'Đã hiểu'),
        cancelText: opts.cancelText ?? 'Hủy',
        resolve,
      },
    ];
    emit();
  });
}

/** Popup thông báo (thay alert). Trả về Promise xong khi người dùng đóng popup. */
export function showAlert(message: string, opts?: DialogOptions): Promise<void> {
  return enqueue('alert', message, opts).then(() => undefined);
}

/** Popup xác nhận (thay confirm). Trả về true khi bấm đồng ý, false khi hủy / đóng. */
export function showConfirm(message: string, opts?: DialogOptions): Promise<boolean> {
  return enqueue('confirm', message, opts);
}

function close(id: number, ok: boolean) {
  const req = queue.find((r) => r.id === id);
  if (!req) return;
  queue = queue.filter((r) => r.id !== id);
  emit();
  req.resolve(ok);
}

// ===== Giao diện =====
const TONE_STYLE: Record<DialogTone, { icon: React.ElementType; iconWrap: string; okBtn: string }> = {
  info: {
    icon: Info,
    iconWrap: 'bg-green-primary/10 text-green-primary',
    okBtn: 'bg-green-primary hover:bg-green-dark text-white',
  },
  success: {
    icon: CheckCircle2,
    iconWrap: 'bg-green-primary/10 text-green-primary',
    okBtn: 'bg-green-primary hover:bg-green-dark text-white',
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: 'bg-amber-100 text-amber-600',
    okBtn: 'bg-green-primary hover:bg-green-dark text-white',
  },
  error: {
    icon: XCircle,
    iconWrap: 'bg-sale/10 text-sale',
    okBtn: 'bg-green-primary hover:bg-green-dark text-white',
  },
  danger: {
    icon: Trash2,
    iconWrap: 'bg-sale/10 text-sale',
    okBtn: 'bg-sale hover:brightness-95 text-white',
  },
};

export function AppDialogHost() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const current = items[0];
  const okRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    hostCount++;
    return () => {
      hostCount--;
    };
  }, []);

  // Focus nút chính khi mở; Esc = hủy / đóng
  useEffect(() => {
    if (!current) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    // Hộp xác nhận xóa: focus nút Hủy cho an toàn
    const target = current.kind === 'confirm' && current.tone === 'danger' ? cancelRef.current : okRef.current;
    target?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(current.id, current.kind === 'alert');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [current]);

  if (!current) return null;

  const style = TONE_STYLE[current.tone];
  const Icon = style.icon;
  const titleId = `app-dialog-title-${current.id}`;
  const descId = `app-dialog-desc-${current.id}`;

  return (
    <div
      className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-ink-950/50 backdrop-blur-sm animate-[appDialogFade_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close(current.id, current.kind === 'alert');
      }}
    >
      <style>{`
        @keyframes appDialogFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes appDialogPop { from { opacity: 0; transform: translateY(8px) scale(0.97) } to { opacity: 1; transform: none } }
      `}</style>
      <div
        role={current.kind === 'confirm' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-border-light overflow-hidden animate-[appDialogPop_180ms_ease-out]"
      >
        <div className="h-1.5 bg-green-primary" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${style.iconWrap}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id={titleId} className="text-lg text-text-dark font-heading font-semibold leading-snug">
                {current.title}
              </h2>
              <p id={descId} className="mt-1.5 text-sm text-text-body leading-relaxed whitespace-pre-line break-words">
                {current.message}
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            {current.kind === 'confirm' && (
              <button
                ref={cancelRef}
                type="button"
                onClick={() => close(current.id, false)}
                className="px-5 py-2.5 rounded-xl border border-border text-sm text-text-dark bg-white hover:bg-ivory-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-primary/40"
              >
                {current.cancelText}
              </button>
            )}
            <button
              ref={okRef}
              type="button"
              onClick={() => close(current.id, true)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-primary/50 ${style.okBtn}`}
            >
              {current.okText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AppDialogHost;
