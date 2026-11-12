'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'weekly_delivery_line';

interface WeeklyDeliveryState {
  count: number;
  textVi: string;
  textEn: string;
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
 * Câu chữ và số mặc định của dòng "Hơn 10.000 chai được Thái Sơn Foods giao mỗi tuần" (nằm trong WeeklyDeliveryPanel).
 * Lưu vào bảng site_settings (khoá weekly_delivery_line) — trang khách đọc lại ở lần tải sau, không cần build lại.
 */
export default function WeeklyDeliverySetting({ canManage }: { canManage: boolean }) {
  const [saved, setSaved] = useState<WeeklyDeliveryState | null>(null);
  const [count, setCount] = useState('');
  const [textVi, setTextVi] = useState('');
  const [textEn, setTextEn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = (data: WeeklyDeliveryState) => {
    setSaved(data);
    setCount(String(data.count));
    setTextVi(data.textVi);
    setTextEn(data.textEn);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/settings?key=${KEY}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) apply(json.data);
      else setError(json.error || 'Không tải được cài đặt.');
    } catch {
      setError('Không tải được cài đặt.');
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const countNum = Number(count.replace(/[.,\s]/g, ''));
  const countValid = count.trim() !== '' && Number.isInteger(countNum) && countNum >= 0 && countNum <= 100_000_000;
  const preview = (textVi || '').split('{so}').join(countValid ? countNum.toLocaleString('vi-VN') : '…');
  const dirty =
    saved !== null && (String(saved.count) !== String(countNum) || saved.textVi !== textVi.trim() || saved.textEn !== textEn.trim());

  const save = async () => {
    if (!canManage || saving) return;
    if (!countValid) {
      setError('Số chai phải là số nguyên từ 0 đến 100.000.000.');
      return;
    }
    if (!textVi.includes('{so}') || !textEn.includes('{so}')) {
      setError('Câu hiển thị phải có {so} ở chỗ cần hiện số chai.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: KEY, value: { count: countNum, textVi, textEn } }),
      });
      const json = await res.json();
      if (json.success) {
        apply(json.data);
        setNotice('Đã lưu. Trang khách hiện nội dung mới sau khoảng 1 phút.');
      } else setError(json.error || 'Không lưu được cài đặt.');
    } catch {
      setError('Không lưu được cài đặt.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-ink-50 border border-ink-200 rounded-xl px-3 py-2 text-sm text-ink-950 focus:outline-none focus:border-amber-500 disabled:opacity-60';

  return (
    <section aria-labelledby="weekly-delivery-title" className="rounded-xl border border-ink-200 bg-ink-50/50 px-4 py-3 space-y-3">
      <div>
        <h2 id="weekly-delivery-title" className="text-base text-ink-950">
          Câu hiển thị và số mặc định
        </h2>
        <p className="text-xs text-ink-700 mt-0.5">
          Dùng chung cho mọi sản phẩm và combo. Số mặc định dùng cho món chưa nhập số riêng. Viết {'{so}'} ở chỗ cần hiện số chai.
        </p>
        {saved?.updatedAt && (
          <p className="text-xs text-ink-700 mt-0.5">
            Đổi lần cuối bởi {saved.updatedBy || 'không rõ'} lúc {formatTime(saved.updatedAt)}
          </p>
        )}
        {!canManage && <p className="text-xs text-ink-700 mt-0.5">Bạn chỉ có quyền xem.</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_1fr]">
        <label className="block text-xs text-ink-800">
          Số mặc định
          <input
            type="text"
            inputMode="numeric"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            disabled={!saved || !canManage}
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="block text-xs text-ink-800">
          Câu tiếng Việt
          <input
            type="text"
            value={textVi}
            maxLength={160}
            onChange={(e) => setTextVi(e.target.value)}
            disabled={!saved || !canManage}
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="block text-xs text-ink-800">
          Câu tiếng Anh
          <input
            type="text"
            value={textEn}
            maxLength={160}
            onChange={(e) => setTextEn(e.target.value)}
            disabled={!saved || !canManage}
            className={`${inputCls} mt-1`}
          />
        </label>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-ink-800">
          <span className="text-xs text-ink-700">Xem trước: </span>
          {saved ? preview : 'Đang tải…'}
        </p>
        {canManage && (
          <button
            type="button"
            onClick={save}
            disabled={!saved || saving || !dirty}
            className="px-3.5 py-2 rounded-xl text-sm bg-amber-600 hover:bg-amber-700 text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {saving ? 'Đang lưu…' : 'Lưu'}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {notice && !error && <p className="text-xs text-emerald-700">{notice}</p>}
    </section>
  );
}
