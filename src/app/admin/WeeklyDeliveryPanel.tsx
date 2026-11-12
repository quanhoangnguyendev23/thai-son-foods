'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import WeeklyDeliverySetting from './WeeklyDeliverySetting';

type ItemType = 'product' | 'combo';

const MAX = 100_000_000;

/** Đọc ô nhập: '' → null (dùng số mặc định), số hợp lệ → number, sai → undefined */
function parseCount(v: string): number | null | undefined {
  const t = v.replace(/[.,\s]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 && n <= MAX ? n : undefined;
}

/**
 * "Số chai giao mỗi tuần" cho từng sản phẩm / combo, đặt ở đầu tab Sản phẩm và tab Combo.
 * Admin nhập tay số cho từng món (không tính từ đơn trên web). Để trống = dùng số mặc định, 0 = ẩn dòng.
 * Lưu vào bảng item_weekly_delivery qua /api/admin/weekly-delivery.
 */
export default function WeeklyDeliveryPanel({
  itemType,
  items,
  canManage,
  canManageDefault,
}: {
  itemType: ItemType;
  items: { id: string; name: string }[];
  canManage: boolean;
  canManageDefault: boolean;
}) {
  const label = itemType === 'product' ? 'sản phẩm' : 'combo';
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Record<string, number> | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/weekly-delivery?itemType=${itemType}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setSaved(json.data.counts || {});
        setDraft({});
      } else setError(json.error || 'Không tải được số chai.');
    } catch {
      setError('Không tải được số chai.');
    }
  }, [itemType]);

  // Chỉ tải khi mở khung
  useEffect(() => {
    if (!open || saved) return;
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [open, saved, load]);

  const valueOf = (id: string) => (id in draft ? draft[id] : saved && id in saved ? String(saved[id]) : '');

  const changes = useMemo(() => {
    if (!saved) return [];
    const out: { itemId: string; count: number | null | undefined }[] = [];
    for (const [id, v] of Object.entries(draft)) {
      const next = parseCount(v);
      const prev = id in saved ? saved[id] : null;
      if (next !== prev) out.push({ itemId: id, count: next });
    }
    return out;
  }, [draft, saved]);
  const invalid = changes.some((c) => c.count === undefined);
  const setCount = saved ? items.filter((i) => i.id in saved).length : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, search]);

  const save = async () => {
    if (!canManage || saving || changes.length === 0) return;
    if (invalid) {
      setError('Số chai phải là số nguyên từ 0 đến 100.000.000 (để trống = dùng số mặc định).');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/weekly-delivery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType, items: changes }),
      });
      const json = await res.json();
      if (json.success) {
        setSaved(json.data.counts || {});
        setDraft({});
        setNotice(`Đã lưu ${changes.length} ${label}. Trang khách hiện số mới sau khoảng 1 phút.`);
      } else setError(json.error || 'Không lưu được số chai.');
    } catch {
      setError('Không lưu được số chai.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-xl border border-ink-300 bg-white"
    >
      <summary className="cursor-pointer select-none px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="text-base text-ink-950">Số chai giao mỗi tuần</span>
          <span className="block text-xs text-ink-700 mt-0.5">
            Nhập tay số chai cho từng {label}, hiện ở trang chi tiết dạng “Hơn 10.000 chai được Thái Sơn Foods giao mỗi tuần”
          </span>
        </span>
        <span className="text-xs text-ink-700">
          {saved ? `${setCount} / ${items.length} ${label} đã nhập số riêng` : 'Bấm để mở'}
        </span>
      </summary>

      <div className="px-4 pb-4 space-y-3 border-t border-ink-200 pt-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <input
            type="text"
            placeholder={`Tìm ${label}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72 bg-ink-50 border border-ink-200 rounded-xl px-3 py-2 text-xs text-ink-950 focus:outline-none focus:border-amber-500"
          />
          <p className="text-xs text-ink-700">Để trống = dùng số mặc định. Nhập 0 = ẩn dòng này ở trang của {label} đó.</p>
        </div>

        <div className="max-h-80 overflow-y-auto rounded-lg border border-ink-200">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-xs text-ink-700 sticky top-0">
              <tr>
                <th className="text-left font-normal px-3 py-2">Tên {label}</th>
                <th className="text-right font-normal px-3 py-2 w-40">Số chai / tuần</th>
              </tr>
            </thead>
            <tbody>
              {!saved ? (
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-xs text-ink-700">
                    Đang tải…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-xs text-ink-700">
                    Không có {label} nào khớp.
                  </td>
                </tr>
              ) : (
                filtered.map((it) => {
                  const v = valueOf(it.id);
                  const bad = parseCount(v) === undefined;
                  return (
                    <tr key={it.id} className="border-t border-ink-100">
                      <td className="px-3 py-1.5 text-ink-950">{it.name}</td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`Số chai giao mỗi tuần của ${it.name}`}
                          placeholder="Mặc định"
                          value={v}
                          onChange={(e) => setDraft((d) => ({ ...d, [it.id]: e.target.value }))}
                          disabled={!canManage}
                          className={`w-full text-right bg-ink-50 border rounded-lg px-2 py-1 text-sm text-ink-950 focus:outline-none focus:border-amber-500 disabled:opacity-60 ${
                            bad ? 'border-red-400' : 'border-ink-200'
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {error && (
            <p className="text-xs text-red-600 mr-auto" role="alert">
              {error}
            </p>
          )}
          {notice && !error && <p className="text-xs text-emerald-700 mr-auto">{notice}</p>}
          {!canManage && <p className="text-xs text-ink-700 mr-auto">Bạn chỉ có quyền xem.</p>}
          {canManage && (
            <button
              type="button"
              onClick={save}
              disabled={saving || changes.length === 0}
              className="px-3.5 py-2 rounded-xl text-sm bg-amber-600 hover:bg-amber-700 text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Đang lưu…' : changes.length > 0 ? `Lưu ${changes.length} thay đổi` : 'Lưu'}
            </button>
          )}
        </div>

        {open && <WeeklyDeliverySetting canManage={canManageDefault} />}
      </div>
    </details>
  );
}
