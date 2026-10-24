'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Khung "Nguồn tồn kho: Google Sheet" ở tab Tồn kho của trang quản trị.
 * Web chỉ đọc sheet (quyền xem). Khung này cho admin cửa hàng:
 *  - xem tồn theo lô (ngày sản xuất / hạn dùng), cờ nhập hàng NH, số đang giữ chỗ, số bán được;
 *  - bấm "Cập nhật ngay" để đọc lại sheet;
 *  - bật/tắt "Tạm hết hàng" khi thực tế hết mà sheet chưa kịp sửa.
 */

interface SheetLot {
  nsx: string;
  hsd: string;
  qty: number;
  expired: boolean;
  daysLeft: number;
}

interface SheetRow {
  productId: string;
  productName: string;
  sku: string | null;
  spCode: string;
  nh: 0 | 1 | null;
  sheetTotal: number;
  sellableFromSheet: number;
  expiredQty: number;
  lots: SheetLot[];
  sheetUpdatedAt: string | null;
  stockQuantity: number;
  reserved: number;
  safetyStock: number;
  available: number;
  stopped: boolean;
  stopReason: string | null;
  stopBy: string | null;
  stopAt: string | null;
  hasSnapshot: boolean;
}

interface SheetStatus {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  stale: boolean;
  refreshIntervalMinutes: number;
  sheetUrl: string;
  summary: {
    rowsInSheet: number;
    mappedRows: number;
    changedRows: number;
    totalSellable: number;
    totalExpired: number;
    unmappedStores: string[];
    unmappedProducts: string[];
    webStoresMissingInSheet: string[];
    warningCount: number;
    warnings: string[];
  } | null;
}

interface PanelData {
  mode: 'sheet' | 'manual';
  storeCode?: string;
  sheetHasStore?: boolean;
  status?: SheetStatus;
  rows?: SheetRow[];
}

interface Props {
  storeCode: string;
  canUpdate: boolean;
  onModeResolved?: (isSheetMode: boolean) => void;
  onSynced?: () => void;
}

const fmtTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      })
    : '—';

const fmtDay = (isoDate: string) => {
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
};

const ago = (iso: string | null | undefined, now: number) => {
  if (!iso) return '';
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h} giờ trước` : `${Math.floor(h / 24)} ngày trước`;
};

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: `Máy chủ trả về dữ liệu không đọc được (HTTP ${res.status}).` };
  }
}

export default function SheetInventoryPanel({ storeCode, canUpdate, onModeResolved, onSynced }: Props) {
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [busyProduct, setBusyProduct] = useState<string | null>(null);
  const [stopForm, setStopForm] = useState<{ productId: string; reason: string } | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const reqSeq = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      const seq = ++reqSeq.current;
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`/api/admin/inventory/sheet?storeCode=${encodeURIComponent(storeCode)}`, { cache: 'no-store' });
        const json = await readJson(res);
        if (seq !== reqSeq.current) return;
        if (json?.success) {
          setData(json as PanelData);
          onModeResolved?.(json.mode === 'sheet');
        } else if (!silent) {
          setMessage({ type: 'error', text: json?.error || 'Không đọc được tồn kho theo sheet.' });
        }
      } catch (err: any) {
        if (!silent && seq === reqSeq.current) setMessage({ type: 'error', text: `Lỗi mạng: ${err?.message || err}` });
      } finally {
        if (seq === reqSeq.current && !silent) setLoading(false);
      }
    },
    [storeCode, onModeResolved]
  );

  useEffect(() => {
    setStopForm(null);
    setMessage(null);
    load();
  }, [load]);

  // Làm mới số liệu hiển thị mỗi 2 phút và cập nhật đồng hồ "cách đây ... phút" mỗi 30 giây
  useEffect(() => {
    const t1 = setInterval(() => load(true), 120_000);
    const t2 = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/inventory/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const json = await readJson(res);
      if (json?.success) {
        setMessage({ type: 'ok', text: json.message || 'Đã đọc lại sheet.' });
        await load(true);
        onSynced?.();
      } else {
        setMessage({ type: 'error', text: json?.error || 'Không đọc lại được sheet.' });
        await load(true);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Lỗi mạng: ${err?.message || err}` });
    } finally {
      setSyncing(false);
    }
  };

  const handleStopSale = async (productId: string, stopped: boolean, reason?: string) => {
    setBusyProduct(productId);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/inventory/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_sale', storeCode, productId, stopped, reason: reason || '' }),
      });
      const json = await readJson(res);
      if (json?.success) {
        setMessage({ type: 'ok', text: json.message || 'Đã cập nhật.' });
        setStopForm(null);
        await load(true);
        onSynced?.();
      } else {
        setMessage({ type: 'error', text: json?.error || 'Không thực hiện được thao tác.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Lỗi mạng: ${err?.message || err}` });
    } finally {
      setBusyProduct(null);
    }
  };

  if (!data) {
    return loading ? (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 px-5 py-4 text-xs text-slate-400">
        Đang nạp tồn kho từ Google Sheet...
      </div>
    ) : null;
  }
  if (data.mode !== 'sheet') return null;

  const status = data.status;
  const rows = data.rows || [];
  const summary = status?.summary || null;
  const issueCount = (summary?.warningCount || 0) + (summary?.unmappedStores.length || 0) + (summary?.unmappedProducts.length || 0);

  return (
    <section className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
      {/* Đầu khung */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-5 py-4 border-b border-slate-800">
        <div className="min-w-0">
          <h2 className="text-base text-white flex flex-wrap items-center gap-2">
            <span>Nguồn tồn kho: Google Sheet</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">Chỉ đọc</span>
          </h2>
          <p className="text-[12px] text-slate-400 mt-1">
            Cập nhật lúc{' '}
            <span className="text-slate-200 text-[1.125em]">{fmtTime(status?.lastSuccessAt)}</span>
            {status?.lastSuccessAt ? <span> ({ago(status.lastSuccessAt, now)})</span> : null}
            {'. '}
            Web tự đọc lại sau mỗi {status?.refreshIntervalMinutes ?? 15} phút. Số lượng và lô sửa trực tiếp trong sheet, không sửa trên web.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status?.sheetUrl && (
            <a
              href={status.sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              Mở sheet
            </a>
          )}
          {canUpdate && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Đang đọc sheet...' : 'Cập nhật ngay'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Thông báo */}
      {message && (
        <div
          className={`px-5 py-2.5 text-xs border-b ${
            message.type === 'ok'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
          }`}
        >
          {message.text}
        </div>
      )}
      {status?.lastError && (
        <div className="px-5 py-2.5 text-xs bg-rose-500/10 text-rose-300 border-b border-rose-500/20">
          Lần đọc sheet gần nhất bị lỗi, web đang dùng dữ liệu của lần đọc tốt trước đó. Lý do: {status.lastError}
        </div>
      )}
      {!status?.lastError && status?.stale && (
        <div className="px-5 py-2.5 text-xs bg-amber-500/10 text-amber-300 border-b border-amber-500/20">
          {status.lastSuccessAt
            ? 'Dữ liệu đã quá 60 phút chưa được làm mới. Bấm "Cập nhật ngay" hoặc kiểm tra file sheet.'
            : 'Chưa đọc được sheet lần nào. Bấm "Cập nhật ngay" để nạp tồn kho.'}
        </div>
      )}
      {data.sheetHasStore === false && (
        <div className="px-5 py-2.5 text-xs bg-amber-500/10 text-amber-300 border-b border-amber-500/20">
          Sheet chưa có dòng nào cho cửa hàng {storeCode}, nên tồn hiển thị là 0. Kiểm tra mã cửa hàng (cột CH) trong sheet.
        </div>
      )}

      {/* Bảng tồn theo lô */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Sản phẩm</th>
              <th className="py-3 px-3 text-center">Nhập hàng hôm nay</th>
              <th className="py-3 px-3">Lô theo hạn dùng (số chai)</th>
              <th className="py-3 px-3 text-center">Tồn còn hạn</th>
              <th className="py-3 px-3 text-center">Đang giữ</th>
              <th className="py-3 px-3 text-center">Bán được</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((r) => {
              const isBusy = busyProduct === r.productId;
              const formOpen = stopForm?.productId === r.productId;
              return (
                <React.Fragment key={r.productId}>
                  <tr className="hover:bg-slate-800/40 transition-colors align-top">
                    <td className="py-3 px-4">
                      <p className="text-white text-sm">{r.productName}</p>
                      <p className="text-[11px] font-mono text-slate-400">
                        Mã sheet: <span className="text-amber-400 text-[1.125em]">{r.spCode}</span>
                      </p>
                    </td>

                    <td className="py-3 px-3 text-center">
                      {r.nh === 1 ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          Đã nhập hàng
                        </span>
                      ) : r.nh === 0 ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] bg-slate-800 text-slate-400 border border-slate-700">
                          Chưa nhập
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {r.lots.length === 0 ? (
                        <span className="text-slate-500">Không có lô nào</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {r.lots.map((l) => {
                            const tone = l.expired
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 line-through'
                              : l.daysLeft <= 2
                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                                : l.daysLeft <= 5
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                  : 'bg-slate-950 text-slate-200 border-slate-700';
                            return (
                              <span
                                key={`${l.nsx}-${l.hsd}`}
                                className={`inline-flex flex-col px-2 py-1 rounded-lg border font-mono text-[11px] leading-tight ${tone}`}
                                title={`Sản xuất ${fmtDay(l.nsx)} · hạn dùng ${fmtDay(l.hsd)}${l.expired ? ' · đã hết hạn, không bán' : ` · còn ${l.daysLeft} ngày`}`}
                              >
                                <span>
                                  HSD {fmtDay(l.hsd)} · <span className="text-[1.125em]">{l.qty}</span>
                                </span>
                                <span className="text-[10px] opacity-70">
                                  {l.expired ? 'hết hạn' : l.daysLeft === 0 ? 'hết hạn hôm nay' : `còn ${l.daysLeft} ngày`}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {r.expiredQty > 0 && (
                        <p className="text-[11px] text-rose-300 mt-1">{r.expiredQty} chai đã hết hạn, không tính vào tồn bán được.</p>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-slate-200 text-sm">
                        {r.sellableFromSheet}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-xl font-mono text-sm border ${
                          r.reserved > 0
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : 'bg-slate-950/60 text-slate-500 border-slate-800'
                        }`}
                      >
                        {r.reserved}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      {r.stopped ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] bg-rose-500/10 text-rose-300 border border-rose-500/30">
                          Tạm hết hàng
                        </span>
                      ) : (
                        <span
                          className={`inline-block px-3 py-1 rounded-xl font-mono text-sm border ${
                            r.available === 0
                              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              : r.available <= 5
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {r.available}
                        </span>
                      )}
                      {r.stopped && r.stopReason && <p className="text-[10px] text-slate-500 mt-1 max-w-[160px] mx-auto">{r.stopReason}</p>}
                      {r.stopped && r.stopBy && (
                        <p className="text-[10px] text-slate-500">
                          bởi {r.stopBy} lúc {fmtTime(r.stopAt)}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {canUpdate ? (
                        r.stopped ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStopSale(r.productId, false)}
                            className="px-3 py-1.5 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white transition-all cursor-pointer"
                          >
                            {isBusy ? 'Đang xử lý...' : 'Mở bán lại'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setStopForm(formOpen ? null : { productId: r.productId, reason: '' })}
                            className="px-3 py-1.5 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                          >
                            {formOpen ? 'Đóng' : 'Tạm hết hàng'}
                          </button>
                        )
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>

                  {formOpen && (
                    <tr className="bg-slate-950/50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-xs text-slate-300">
                            Chặn bán {r.productName} tại {storeCode} cho tới khi mở bán lại. Lý do (không bắt buộc):
                          </span>
                          <input
                            type="text"
                            value={stopForm?.reason || ''}
                            maxLength={300}
                            onChange={(e) => setStopForm({ productId: r.productId, reason: e.target.value })}
                            placeholder="Ví dụ: vỡ hàng, chờ xe giao"
                            className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStopSale(r.productId, true, stopForm?.reason)}
                            className="px-3.5 py-1.5 rounded-xl text-xs bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white transition-all cursor-pointer"
                          >
                            {isBusy ? 'Đang xử lý...' : 'Xác nhận tạm hết hàng'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-500">
                  Chưa có dữ liệu. Bấm "Cập nhật ngay" để đọc sheet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Chi tiết lần đọc gần nhất */}
      {summary && (
        <div className="px-5 py-3 border-t border-slate-800 text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Lần đọc gần nhất: {summary.mappedRows}/{summary.rowsInSheet} dòng khớp cửa hàng và sản phẩm của web, {summary.changedRows} dòng thay đổi.
            </span>
            {issueCount > 0 && (
              <button
                type="button"
                onClick={() => setShowWarnings((v) => !v)}
                className="text-amber-300 hover:text-amber-200 underline underline-offset-2 cursor-pointer"
              >
                {showWarnings ? 'Ẩn lưu ý' : `Xem ${issueCount} lưu ý về dữ liệu`}
              </button>
            )}
          </div>
          {showWarnings && (
            <ul className="mt-2 space-y-1 list-disc pl-5 text-slate-300">
              {summary.unmappedStores.length > 0 && (
                <li>Mã cửa hàng trên sheet chưa có trên web (bỏ qua): {summary.unmappedStores.join(', ')}.</li>
              )}
              {summary.unmappedProducts.length > 0 && (
                <li>Mã sản phẩm trên sheet chưa có trên web (bỏ qua): {summary.unmappedProducts.join(', ')}.</li>
              )}
              {summary.webStoresMissingInSheet.length > 0 && (
                <li>Cửa hàng trên web chưa có dòng nào trong sheet: {summary.webStoresMissingInSheet.join(', ')}.</li>
              )}
              {summary.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {summary.warningCount > summary.warnings.length && (
                <li>... và {summary.warningCount - summary.warnings.length} lưu ý khác.</li>
              )}
            </ul>
          )}
        </div>
      )}
      {loading && <div className="sr-only">Đang tải</div>}
    </section>
  );
}
