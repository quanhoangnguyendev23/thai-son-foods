/**
 * Đồng bộ tồn kho từ Google Sheet (tab INPUT DATA) vào CSDL.
 *
 * Nguyên tắc:
 *  - Web CHỈ ĐỌC sheet (link chỉ xem), không ghi ngược.
 *  - Sheet là nguồn gốc của tồn vật lý. Mỗi lần đồng bộ ghi:
 *      store_inventory.stock_quantity = tổng các lô còn hạn (không đụng tới reserved / safety_stock),
 *      inventory_lots (mã lô SHEET-<NSX>) theo từng ngày sản xuất,
 *      inventory_sheet_rows = ảnh chụp để trang admin hiển thị lô, hạn dùng, cờ nhập hàng NH.
 *  - Đọc lỗi (mất mạng, sheet đổi cấu trúc, số dòng giảm đột ngột) thì GIỮ NGUYÊN dữ liệu cũ và ghi lỗi để admin thấy.
 *  - Giữ chỗ cho đơn web vẫn dùng cơ chế reserved sẵn có; xem confirmStock/releaseStock trong inventory.ts.
 */

import { pool, query } from '@/lib/db';
import { ACTIVE_STORES } from '@/data/stores';
import {
  INVENTORY_SHEET_CONFIG as CFG,
  SHEET_LOT_PREFIX,
  SHEET_SYNC_ACTOR,
  isSheetInventoryMode,
} from '@/config/inventorySheet';
import {
  parseSheetInventory,
  splitSellable,
  todayInVietnam,
  daysBetweenIso,
  type SheetLot,
} from '@/lib/inventorySheetParser';

const ADVISORY_LOCK_KEY = 7301982;
const MAX_LOG_ROWS_PER_SYNC = 500;
const MAX_WARNINGS_IN_SUMMARY = 30;

export interface SheetSyncSummary {
  rowsInSheet: number;
  mappedRows: number;
  changedRows: number;
  lotsWritten: number;
  totalSellable: number;
  totalExpired: number;
  unmappedStores: string[];
  unmappedProducts: string[];
  webStoresMissingInSheet: string[];
  warningCount: number;
  warnings: string[];
  lotColumns: Array<{ nsx: string; hsd: string }>;
  durationMs: number;
}

export interface SheetSyncResult {
  ok: boolean;
  skipped?: 'locked' | 'not_sheet_mode';
  error?: string;
  summary?: SheetSyncSummary;
}

export interface SheetStatus {
  mode: 'sheet' | 'manual';
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  summary: SheetSyncSummary | null;
  stale: boolean;
  refreshIntervalMinutes: number;
  sheetUrl: string;
}

export interface SheetSnapshotLot {
  nsx: string;
  hsd: string;
  qty: number;
  expired: boolean;
  daysLeft: number;
}

export interface SheetSnapshotRow {
  productId: string;
  productName: string;
  sku: string | null;
  spCode: string;
  nh: 0 | 1 | null;
  sheetTotal: number;
  sellableFromSheet: number;
  expiredQty: number;
  lots: SheetSnapshotLot[];
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

class SheetFetchError extends Error {}
class SheetDataError extends Error {}

// ───────────────────────────── Bảng phụ ─────────────────────────────

let tablesReady: Promise<void> | null = null;

export function ensureSheetTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS inventory_sheet_state (
          id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
          last_attempt_at TIMESTAMP WITH TIME ZONE,
          last_success_at TIMESTAMP WITH TIME ZONE,
          last_error TEXT,
          last_summary JSONB,
          last_actor VARCHAR(100)
        );`);
      await query(`INSERT INTO inventory_sheet_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
      await query(`
        CREATE TABLE IF NOT EXISTS inventory_sheet_rows (
          store_code VARCHAR(50) NOT NULL,
          product_id VARCHAR(50) NOT NULL,
          nh SMALLINT,
          sheet_total INTEGER NOT NULL DEFAULT 0,
          sellable_total INTEGER NOT NULL DEFAULT 0,
          expired_total INTEGER NOT NULL DEFAULT 0,
          lots JSONB NOT NULL DEFAULT '[]'::jsonb,
          sheet_updated_at TIMESTAMP WITH TIME ZONE,
          synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (store_code, product_id)
        );`);
      await query(`
        CREATE TABLE IF NOT EXISTS inventory_stop_sale (
          store_code VARCHAR(50) NOT NULL,
          product_id VARCHAR(50) NOT NULL,
          reason TEXT,
          created_by VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (store_code, product_id)
        );`);
    })().catch((err) => {
      tablesReady = null;
      throw err;
    });
  }
  return tablesReady;
}

// ───────────────────────────── Đọc sheet ─────────────────────────────

export function getSheetCsvUrl(): string {
  if (CFG.CSV_URL_OVERRIDE) return CFG.CSV_URL_OVERRIDE;
  return (
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(CFG.SPREADSHEET_ID)}/gviz/tq` +
    `?tqx=out:csv&headers=0&sheet=${encodeURIComponent(CFG.TAB_NAME)}`
  );
}

export function getSheetViewUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(CFG.SPREADSHEET_ID)}/edit`;
}

async function fetchSheetCsv(): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CFG.FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(getSheetCsvUrl(), {
      signal: ctrl.signal,
      cache: 'no-store',
      redirect: 'follow',
      headers: { Accept: 'text/csv,text/plain;q=0.9,*/*;q=0.5' },
    });
    if (!res.ok) {
      throw new SheetFetchError(
        res.status === 401 || res.status === 403 || res.status === 404
          ? `Google Sheet từ chối truy cập (HTTP ${res.status}). Kiểm tra file còn chia sẻ "Bất kỳ ai có đường liên kết đều xem được".`
          : `Google Sheet trả về lỗi HTTP ${res.status}.`
      );
    }
    const text = await res.text();
    if (/^\s*<(!doctype|html)/i.test(text)) {
      throw new SheetFetchError(
        'Google Sheet trả về trang đăng nhập thay vì dữ liệu. File cần chia sẻ "Bất kỳ ai có đường liên kết đều xem được".'
      );
    }
    return text;
  } catch (err: any) {
    if (err instanceof SheetFetchError) throw err;
    if (err?.name === 'AbortError') {
      throw new SheetFetchError(`Quá ${Math.round(CFG.FETCH_TIMEOUT_MS / 1000)} giây không đọc được Google Sheet.`);
    }
    throw new SheetFetchError(`Không kết nối được Google Sheet: ${err?.message || err}`);
  } finally {
    clearTimeout(timer);
  }
}

// ───────────────────────────── Đồng bộ ─────────────────────────────

interface Target {
  storeCode: string;
  productId: string;
  nh: 0 | 1 | null;
  lots: SheetLot[];
  sellable: number;
  expired: number;
  sheetTotal: number;
  sheetUpdatedAt: string | null;
}

let syncInflight: Promise<SheetSyncResult> | null = null;

/** Đọc sheet và ghi vào CSDL. Gọi song song nhiều lần cùng lúc chỉ chạy một lần. */
export function syncInventoryFromSheet(opts: { actor?: string } = {}): Promise<SheetSyncResult> {
  if (!isSheetInventoryMode()) return Promise.resolve({ ok: true, skipped: 'not_sheet_mode' });
  if (!syncInflight) {
    syncInflight = runSync(opts.actor || SHEET_SYNC_ACTOR).finally(() => {
      syncInflight = null;
    });
  }
  return syncInflight;
}

async function runSync(actor: string): Promise<SheetSyncResult> {
  const started = Date.now();
  await ensureSheetTables();
  await query(`UPDATE inventory_sheet_state SET last_attempt_at = CURRENT_TIMESTAMP WHERE id = 1;`);

  try {
    const csv = await fetchSheetCsv();
    const parsed = parseSheetInventory(csv, { shelfLifeDays: CFG.SHELF_LIFE_DAYS });
    if (!parsed.ok) throw new SheetDataError(parsed.fatal || 'Không đọc được dữ liệu sheet.');

    // Chặn đọc nhầm file/tab rỗng: số dòng giảm đột ngột so với lần đọc tốt gần nhất
    const prev = await query(`SELECT (last_summary->>'rowsInSheet')::int AS n FROM inventory_sheet_state WHERE id = 1;`);
    const prevRows = Number(prev.rows[0]?.n) || 0;
    if (prevRows >= 20 && parsed.rows.length < prevRows * CFG.MIN_ROW_RATIO_VS_PREVIOUS) {
      throw new SheetDataError(
        `Số dòng trong sheet giảm đột ngột (${prevRows} -> ${parsed.rows.length}). Giữ nguyên dữ liệu cũ, vui lòng kiểm tra sheet.`
      );
    }

    const today = todayInVietnam();

    // Ánh xạ mã cửa hàng / sản phẩm sang CSDL
    const storeRes = await query(`SELECT code FROM stores;`);
    const storeCodes: string[] =
      storeRes.rows.length > 0 ? storeRes.rows.map((r) => String(r.code)) : ACTIVE_STORES.map((s) => s.code);
    const storeMap = new Map(storeCodes.map((c) => [c.toUpperCase(), c]));

    const productIds = Array.from(new Set(Object.values(CFG.SP_TO_PRODUCT_ID)));
    const prodRes = await query(`SELECT id FROM products WHERE id = ANY($1::text[]);`, [productIds]);
    const productSet = new Set(prodRes.rows.map((r) => String(r.id)));

    const stopRes = await query(`SELECT store_code, product_id FROM inventory_stop_sale;`);
    const stopped = new Set(stopRes.rows.map((r) => `${r.store_code}|${r.product_id}`));

    const unmappedStores = new Set<string>();
    const unmappedProducts = new Set<string>();
    const targets: Target[] = [];
    for (const row of parsed.rows) {
      const storeCode = storeMap.get(row.ch);
      const productId = CFG.SP_TO_PRODUCT_ID[row.sp];
      if (!storeCode) unmappedStores.add(row.ch);
      if (!productId || !productSet.has(productId)) unmappedProducts.add(row.sp);
      if (!storeCode || !productId || !productSet.has(productId)) continue;
      const { sellable, expired } = splitSellable(row.lots, today);
      targets.push({
        storeCode,
        productId,
        nh: row.nh,
        lots: row.lots,
        sellable,
        expired,
        sheetTotal: row.lots.reduce((a, l) => a + l.qty, 0),
        sheetUpdatedAt: row.lastUpdate,
      });
    }
    if (targets.length === 0) {
      throw new SheetDataError('Không có dòng nào khớp mã cửa hàng/sản phẩm của web. Giữ nguyên dữ liệu cũ.');
    }
    targets.sort((a, b) => (a.storeCode + a.productId).localeCompare(b.storeCode + b.productId));

    const syncedStores = Array.from(new Set(targets.map((t) => t.storeCode)));
    const syncedProducts = Array.from(new Set(targets.map((t) => t.productId)));
    const sheetStoreSet = new Set(syncedStores);
    const webStoresMissingInSheet = ACTIVE_STORES.filter((s) => s.type === 'store' && !sheetStoreSet.has(s.code)).map((s) => s.code);

    const client = await pool.connect();
    const changed: Array<{ t: Target; oldStock: number; oldReserved: number; newStock: number }> = [];
    let lotsWritten = 0;
    try {
      await client.query('BEGIN;');
      const lock = await client.query(`SELECT pg_try_advisory_xact_lock($1) AS ok;`, [ADVISORY_LOCK_KEY]);
      if (!lock.rows[0]?.ok) {
        await client.query('ROLLBACK;');
        return { ok: true, skipped: 'locked' };
      }

      // 1) Tồn vật lý theo cửa hàng/sản phẩm
      const oldRes = await client.query(
        `SELECT store_code, product_id, stock_quantity, reserved
         FROM store_inventory
         WHERE store_code = ANY($1::text[]) AND product_id = ANY($2::text[])
         ORDER BY store_code ASC, product_id ASC
         FOR UPDATE;`,
        [syncedStores, syncedProducts]
      );
      const oldMap = new Map(oldRes.rows.map((r) => [`${r.store_code}|${r.product_id}`, r]));

      for (const t of targets) {
        const key = `${t.storeCode}|${t.productId}`;
        const newStock = stopped.has(key) ? 0 : t.sellable;
        const old = oldMap.get(key);
        const oldStock = old ? Number(old.stock_quantity) || 0 : -1;
        if (oldStock !== newStock) {
          changed.push({ t, oldStock: Math.max(0, oldStock), oldReserved: Number(old?.reserved) || 0, newStock });
        }
      }
      if (changed.length > 0) {
        await client.query(
          `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, updated_by, updated_at)
           SELECT 'inv_' || x.s || '_' || x.p, x.s, x.p, x.q, $4::text, CURRENT_TIMESTAMP
           FROM unnest($1::text[], $2::text[], $3::int[]) AS x(s, p, q)
           ON CONFLICT (store_code, product_id) DO UPDATE
           SET stock_quantity = EXCLUDED.stock_quantity,
               updated_by = EXCLUDED.updated_by,
               updated_at = CURRENT_TIMESTAMP;`,
          [changed.map((c) => c.t.storeCode), changed.map((c) => c.t.productId), changed.map((c) => c.newStock), actor]
        );
      }

      // 2) Lô hàng theo ngày sản xuất: đưa mọi lô SHEET-* của các dòng đã đọc về 0 rồi ghi lại lô hiện có
      await client.query(
        `UPDATE inventory_lots
         SET stock_quantity = 0, updated_at = CURRENT_TIMESTAMP
         WHERE lot_code LIKE $1 AND store_code = ANY($2::text[]) AND product_id = ANY($3::text[]) AND stock_quantity <> 0;`,
        [`${SHEET_LOT_PREFIX}%`, syncedStores, syncedProducts]
      );
      const lotRows: Array<{ s: string; p: string; c: string; n: string; h: string; q: number }> = [];
      for (const t of targets) {
        for (const l of t.lots) {
          lotRows.push({ s: t.storeCode, p: t.productId, c: `${SHEET_LOT_PREFIX}${l.nsx.replace(/-/g, '')}`, n: l.nsx, h: l.hsd, q: l.qty });
        }
      }
      if (lotRows.length > 0) {
        await client.query(
          `INSERT INTO inventory_lots (id, store_code, product_id, lot_code, manufacturing_date, expiry_date, stock_quantity, reserved_quantity, updated_at)
           SELECT 'lot_' || x.s || '_' || x.p || '_' || x.c, x.s, x.p, x.c, x.n, x.h, x.q, 0, CURRENT_TIMESTAMP
           FROM unnest($1::text[], $2::text[], $3::text[], $4::date[], $5::date[], $6::int[]) AS x(s, p, c, n, h, q)
           ON CONFLICT (store_code, product_id, lot_code) DO UPDATE
           SET manufacturing_date = EXCLUDED.manufacturing_date,
               expiry_date = EXCLUDED.expiry_date,
               stock_quantity = EXCLUDED.stock_quantity,
               updated_at = CURRENT_TIMESTAMP;`,
          [
            lotRows.map((r) => r.s),
            lotRows.map((r) => r.p),
            lotRows.map((r) => r.c),
            lotRows.map((r) => r.n),
            lotRows.map((r) => r.h),
            lotRows.map((r) => r.q),
          ]
        );
      }
      lotsWritten = lotRows.length;

      // 3) Ảnh chụp cho trang admin (lô, hạn dùng, cờ NH)
      const snapshot = targets.map((t) => ({
        store_code: t.storeCode,
        product_id: t.productId,
        nh: t.nh,
        sheet_total: t.sheetTotal,
        sellable_total: t.sellable,
        expired_total: t.expired,
        lots: t.lots,
        sheet_updated_at: t.sheetUpdatedAt,
      }));
      await client.query(
        `INSERT INTO inventory_sheet_rows (store_code, product_id, nh, sheet_total, sellable_total, expired_total, lots, sheet_updated_at, synced_at)
         SELECT x.store_code, x.product_id, x.nh, x.sheet_total, x.sellable_total, x.expired_total, x.lots, x.sheet_updated_at, CURRENT_TIMESTAMP
         FROM jsonb_to_recordset($1::jsonb) AS x(
           store_code text, product_id text, nh int, sheet_total int, sellable_total int, expired_total int, lots jsonb, sheet_updated_at timestamptz
         )
         ON CONFLICT (store_code, product_id) DO UPDATE
         SET nh = EXCLUDED.nh,
             sheet_total = EXCLUDED.sheet_total,
             sellable_total = EXCLUDED.sellable_total,
             expired_total = EXCLUDED.expired_total,
             lots = EXCLUDED.lots,
             sheet_updated_at = EXCLUDED.sheet_updated_at,
             synced_at = CURRENT_TIMESTAMP;`,
        [JSON.stringify(snapshot)]
      );

      // 4) Tổng tồn của sản phẩm = tổng các cửa hàng
      if (changed.length > 0) {
        await client.query(
          `UPDATE products p
           SET stock_quantity = COALESCE((SELECT SUM(si.stock_quantity) FROM store_inventory si WHERE si.product_id = p.id), 0)
           WHERE p.id = ANY($1::text[]);`,
          [Array.from(new Set(changed.map((c) => c.t.productId)))]
        );
      }

      await client.query('COMMIT;');
    } catch (txErr) {
      await client.query('ROLLBACK;').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    // Nhật ký biến động (không làm hỏng lần đồng bộ nếu bảng log lỗi)
    await writeSyncLogs(changed, actor);

    const { invalidateGatekeeperCache } = await import('@/lib/inventoryGatekeeper');
    invalidateGatekeeperCache();

    const summary: SheetSyncSummary = {
      rowsInSheet: parsed.rows.length,
      mappedRows: targets.length,
      changedRows: changed.length,
      lotsWritten,
      totalSellable: targets.reduce((a, t) => a + t.sellable, 0),
      totalExpired: targets.reduce((a, t) => a + t.expired, 0),
      unmappedStores: Array.from(unmappedStores).sort(),
      unmappedProducts: Array.from(unmappedProducts).sort(),
      webStoresMissingInSheet,
      warningCount: parsed.warnings.length,
      warnings: parsed.warnings.slice(0, MAX_WARNINGS_IN_SUMMARY).map((w) => w.message),
      lotColumns: parsed.lotColumns.map((l) => ({ nsx: l.nsx, hsd: l.hsd })),
      durationMs: Date.now() - started,
    };
    await query(
      `UPDATE inventory_sheet_state
       SET last_success_at = CURRENT_TIMESTAMP, last_error = NULL, last_summary = $1::jsonb, last_actor = $2
       WHERE id = 1;`,
      [JSON.stringify(summary), actor]
    );
    return { ok: true, summary };
  } catch (err: any) {
    const message = err instanceof SheetFetchError || err instanceof SheetDataError ? err.message : `Lỗi đồng bộ: ${err?.message || err}`;
    console.error('[InventorySheet] Đồng bộ thất bại, giữ nguyên dữ liệu cũ:', message);
    try {
      await query(`UPDATE inventory_sheet_state SET last_error = $1, last_actor = $2 WHERE id = 1;`, [message, actor]);
    } catch {
      /* bỏ qua */
    }
    return { ok: false, error: message };
  }
}

async function writeSyncLogs(
  changed: Array<{ t: Target; oldStock: number; oldReserved: number; newStock: number }>,
  actor: string
): Promise<void> {
  const list = changed.filter((c) => c.oldStock !== c.newStock).slice(0, MAX_LOG_ROWS_PER_SYNC);
  if (list.length === 0) return;
  try {
    const stamp = Date.now();
    await query(
      `INSERT INTO inventory_logs (id, store_code, product_id, old_stock, new_stock, old_reserved, new_reserved, change_type, actor, note)
       SELECT x.id, x.s, x.p, x.o, x.n, x.r, x.r, 'manual_update', $7::text, 'Đồng bộ từ Google Sheet: ' || x.o || ' -> ' || x.n || ' chai'
       FROM unnest($1::text[], $2::text[], $3::text[], $4::int[], $5::int[], $6::int[]) AS x(id, s, p, o, n, r);`,
      [
        list.map((_, i) => `invlog_${stamp}_${i}_${Math.floor(1000 + Math.random() * 9000)}`),
        list.map((c) => c.t.storeCode),
        list.map((c) => c.t.productId),
        list.map((c) => c.oldStock),
        list.map((c) => c.newStock),
        list.map((c) => c.oldReserved),
        actor,
      ]
    );
  } catch (err) {
    console.error('[InventorySheet] Không ghi được nhật ký đồng bộ:', err);
  }
}

// ───────────────────────────── Trạng thái, tự làm mới ─────────────────────────────

export async function getSheetStatus(): Promise<SheetStatus> {
  await ensureSheetTables();
  const res = await query(
    `SELECT last_attempt_at, last_success_at, last_error, last_summary FROM inventory_sheet_state WHERE id = 1;`
  );
  const row = res.rows[0] || {};
  const lastSuccess = row.last_success_at ? new Date(row.last_success_at).getTime() : 0;
  const stale = !lastSuccess || Date.now() - lastSuccess > CFG.STALE_WARNING_MS;
  return {
    mode: isSheetInventoryMode() ? 'sheet' : 'manual',
    lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at).toISOString() : null,
    lastSuccessAt: row.last_success_at ? new Date(row.last_success_at).toISOString() : null,
    lastError: row.last_error || null,
    summary: (row.last_summary as SheetSyncSummary) || null,
    stale,
    refreshIntervalMinutes: Math.round(CFG.REFRESH_INTERVAL_MS / 60000),
    sheetUrl: getSheetViewUrl(),
  };
}

let lastFreshCheckAt = 0;
let freshInflight: Promise<void> | null = null;

/**
 * Gọi ở các đường đọc tồn kho: nếu đã quá chu kỳ (hoặc sang ngày mới theo giờ Việt Nam) thì đọc lại sheet.
 * Không bao giờ ném lỗi; chờ tối đa vài giây để không làm chậm khách.
 */
export function ensureFreshSheetInventory(): Promise<void> {
  if (!isSheetInventoryMode()) return Promise.resolve();
  const now = Date.now();
  if (freshInflight) return freshInflight;
  if (now - lastFreshCheckAt < 30_000) return Promise.resolve();
  lastFreshCheckAt = now;

  freshInflight = (async () => {
    try {
      await ensureSheetTables();
      const res = await query(`SELECT last_attempt_at, last_success_at FROM inventory_sheet_state WHERE id = 1;`);
      const lastSuccess = res.rows[0]?.last_success_at ? new Date(res.rows[0].last_success_at) : null;
      const lastAttempt = res.rows[0]?.last_attempt_at ? new Date(res.rows[0].last_attempt_at) : null;

      const newDay = !!lastSuccess && todayInVietnam(lastSuccess) !== todayInVietnam(new Date(now));
      const expired = !lastSuccess || now - lastSuccess.getTime() > CFG.REFRESH_INTERVAL_MS;
      const justFailed =
        !!lastAttempt && (!lastSuccess || lastAttempt > lastSuccess) && now - lastAttempt.getTime() < CFG.FAILURE_RETRY_MS;

      if ((expired || newDay) && !justFailed) {
        await Promise.race([syncInventoryFromSheet({ actor: SHEET_SYNC_ACTOR }), new Promise((r) => setTimeout(r, 6000))]);
      }
    } catch (err) {
      console.error('[InventorySheet] ensureFresh lỗi (bỏ qua):', err);
    } finally {
      freshInflight = null;
    }
  })();
  return freshInflight;
}

// ───────────────────────────── Dữ liệu cho trang admin ─────────────────────────────

export async function getSheetSnapshot(storeCode: string): Promise<SheetSnapshotRow[]> {
  await ensureSheetTables();
  const spByProduct = new Map<string, string>();
  for (const [sp, pid] of Object.entries(CFG.SP_TO_PRODUCT_ID)) spByProduct.set(pid, sp);
  const productIds = Array.from(spByProduct.keys());
  const today = todayInVietnam();

  const res = await query(
    `SELECT p.id AS product_id, p.name AS product_name, p.sku,
            r.nh, r.sheet_total, r.sellable_total, r.expired_total, r.lots, r.sheet_updated_at,
            (r.store_code IS NOT NULL) AS has_snapshot,
            COALESCE(si.stock_quantity, 0) AS stock_quantity,
            COALESCE(si.reserved, 0) AS reserved,
            COALESCE(si.safety_stock, 0) AS safety_stock,
            (ss.product_id IS NOT NULL) AS stopped, ss.reason AS stop_reason, ss.created_by AS stop_by, ss.created_at AS stop_at
     FROM products p
     LEFT JOIN inventory_sheet_rows r ON r.product_id = p.id AND r.store_code = $1
     LEFT JOIN store_inventory si ON si.product_id = p.id AND si.store_code = $1
     LEFT JOIN inventory_stop_sale ss ON ss.product_id = p.id AND ss.store_code = $1
     WHERE p.id = ANY($2::text[])
     ORDER BY array_position($2::text[], p.id);`,
    [storeCode, productIds]
  );

  return res.rows.map((r) => {
    const lotsRaw: SheetLot[] = Array.isArray(r.lots) ? r.lots : [];
    const lots: SheetSnapshotLot[] = lotsRaw.map((l) => ({
      nsx: l.nsx,
      hsd: l.hsd,
      qty: l.qty,
      expired: l.hsd < today,
      daysLeft: daysBetweenIso(today, l.hsd),
    }));
    const { sellable, expired } = splitSellable(lotsRaw, today);
    const stock = Number(r.stock_quantity) || 0;
    const reserved = Number(r.reserved) || 0;
    const safety = Number(r.safety_stock) || 0;
    return {
      productId: r.product_id,
      productName: r.product_name,
      sku: r.sku || null,
      spCode: spByProduct.get(r.product_id) || '',
      nh: r.nh === 1 ? 1 : r.nh === 0 ? 0 : null,
      sheetTotal: Number(r.sheet_total) || 0,
      sellableFromSheet: sellable,
      expiredQty: expired,
      lots,
      sheetUpdatedAt: r.sheet_updated_at ? new Date(r.sheet_updated_at).toISOString() : null,
      stockQuantity: stock,
      reserved,
      safetyStock: safety,
      available: Math.max(0, stock - reserved - safety),
      stopped: !!r.stopped,
      stopReason: r.stop_reason || null,
      stopBy: r.stop_by || null,
      stopAt: r.stop_at ? new Date(r.stop_at).toISOString() : null,
      hasSnapshot: !!r.has_snapshot,
    };
  });
}

// ───────────────────────────── Tạm hết hàng ─────────────────────────────

/**
 * Bật/tắt "tạm hết hàng" cho một sản phẩm tại một cửa hàng (chỉ chặn bán, không nhập số lượng).
 * Áp dụng ngay bằng ảnh chụp gần nhất, không cần gọi Google; lần đồng bộ sau giữ nguyên trạng thái này.
 */
export async function setStopSale(params: {
  storeCode: string;
  productId: string;
  stopped: boolean;
  reason?: string | null;
  actor: string;
}): Promise<{ stockQuantity: number | null }> {
  await ensureSheetTables();
  const { storeCode, productId, stopped, actor } = params;
  const reason = (params.reason || '').trim().slice(0, 300) || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    let newStock: number | null = null;

    if (stopped) {
      await client.query(
        `INSERT INTO inventory_stop_sale (store_code, product_id, reason, created_by, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (store_code, product_id) DO UPDATE SET reason = EXCLUDED.reason, created_by = EXCLUDED.created_by, created_at = CURRENT_TIMESTAMP;`,
        [storeCode, productId, reason, actor]
      );
      newStock = 0;
    } else {
      await client.query(`DELETE FROM inventory_stop_sale WHERE store_code = $1 AND product_id = $2;`, [storeCode, productId]);
      const snap = await client.query(
        `SELECT lots FROM inventory_sheet_rows WHERE store_code = $1 AND product_id = $2;`,
        [storeCode, productId]
      );
      if (snap.rows.length > 0) {
        const lots: SheetLot[] = Array.isArray(snap.rows[0].lots) ? snap.rows[0].lots : [];
        newStock = splitSellable(lots, todayInVietnam()).sellable;
      }
    }

    if (newStock !== null) {
      const old = await client.query(
        `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2 FOR UPDATE;`,
        [storeCode, productId]
      );
      const oldStock = old.rows.length > 0 ? Number(old.rows[0].stock_quantity) || 0 : 0;
      await client.query(
        `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (store_code, product_id) DO UPDATE
         SET stock_quantity = EXCLUDED.stock_quantity, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP;`,
        [`inv_${storeCode}_${productId}`, storeCode, productId, newStock, actor]
      );
      await client.query(
        `UPDATE products SET stock_quantity = COALESCE((SELECT SUM(stock_quantity) FROM store_inventory WHERE product_id = $1), 0) WHERE id = $1;`,
        [productId]
      );
      if (oldStock !== newStock) {
        // Ghi nhật ký trong nhánh riêng: lỗi bảng log không được làm hỏng thao tác chính
        await client.query('SAVEPOINT log_sp;');
        try {
          await client.query(
            `INSERT INTO inventory_logs (id, store_code, product_id, old_stock, new_stock, old_reserved, new_reserved, change_type, actor, note)
             VALUES ($1, $2, $3, $4, $5, $6, $6, 'manual_update', $7::text, $8::text);`,
            [
              `invlog_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
              storeCode,
              productId,
              oldStock,
              newStock,
              Number(old.rows[0]?.reserved) || 0,
              actor,
              stopped ? `Tạm hết hàng${reason ? `: ${reason}` : ''}` : 'Mở bán lại theo tồn trên sheet',
            ]
          );
          await client.query('RELEASE SAVEPOINT log_sp;');
        } catch {
          await client.query('ROLLBACK TO SAVEPOINT log_sp;');
        }
      }
    }

    await client.query('COMMIT;');
    const { invalidateGatekeeperCache } = await import('@/lib/inventoryGatekeeper');
    invalidateGatekeeperCache(storeCode);
    return { stockQuantity: newStock };
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
