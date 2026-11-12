import { query } from '@/lib/db';
import { ENABLE_DAILY_DEALS } from '@/config/features';

/**
 * Cài đặt chung của website (dạng khoá → giá trị), admin đổi được không cần sửa code hay build lại.
 * Bảng tự tạo khi cần (CREATE TABLE IF NOT EXISTS), cùng câu lệnh với scripts/migrations/site_settings_schema.sql.
 * Chỉ thêm bảng mới, không sửa hay xoá dữ liệu cũ. Chưa có dòng nào → dùng giá trị mặc định của từng khoá.
 */
export const SITE_SETTINGS_DDL = `
  CREATE TABLE IF NOT EXISTS site_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;

/** "Deal trong ngày": dải deal trang chủ, menu "Deal Sốc", đồng hồ ở trang combo, nhãn "Deal hôm nay". Mặc định TẮT. */
export const DAILY_DEALS_KEY = 'daily_deals_enabled';

/** Dòng "Hơn 10.000 chai được Thái Sơn Foods giao mỗi tuần" ở trang chi tiết combo: số chai và câu chữ admin tự sửa. */
export const WEEKLY_DELIVERY_KEY = 'weekly_delivery_line';

/** Các khoá admin được phép đổi qua API (danh sách trắng) */
export const EDITABLE_SITE_SETTING_KEYS = [DAILY_DEALS_KEY, WEEKLY_DELIVERY_KEY] as const;
export type EditableSiteSettingKey = (typeof EDITABLE_SITE_SETTING_KEYS)[number];

export interface SiteSettingRow {
  key: string;
  value: unknown;
  updatedBy: string | null;
  updatedAt: string | null;
}

let readyPromise: Promise<boolean> | null = null;

/** Tạo bảng nếu chưa có (một lần mỗi tiến trình). Lỗi → false, trang vẫn chạy với giá trị mặc định. */
export function ensureSiteSettings(): Promise<boolean> {
  if (!readyPromise) {
    readyPromise = query(SITE_SETTINGS_DDL)
      .then(() => true)
      .catch((err) => {
        console.error('[SiteSettings] Không tạo được bảng site_settings:', err);
        readyPromise = null; // cho thử lại ở request sau
        return false;
      });
  }
  return readyPromise;
}

export async function getSiteSetting(key: string): Promise<SiteSettingRow | null> {
  if (!(await ensureSiteSettings())) return null;
  try {
    const res = await query(`SELECT key, value, updated_by, updated_at FROM site_settings WHERE key = $1 LIMIT 1;`, [key]);
    const row = res.rows[0];
    if (!row) return null;
    return {
      key: row.key,
      value: row.value,
      updatedBy: row.updated_by ?? null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  } catch (err) {
    console.error('[SiteSettings] Không đọc được cài đặt:', key, err);
    return null;
  }
}

export async function setSiteSetting(key: EditableSiteSettingKey, value: unknown, updatedBy: string): Promise<SiteSettingRow> {
  if (!(await ensureSiteSettings())) throw new Error('Không tạo được bảng site_settings');
  const res = await query(
    `INSERT INTO site_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
     RETURNING key, value, updated_by, updated_at;`,
    [key, JSON.stringify(value), updatedBy]
  );
  const row = res.rows[0];
  return {
    key: row.key,
    value: row.value,
    updatedBy: row.updated_by ?? null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

/**
 * Deal trong ngày có đang bật không: cần CẢ cờ tổng trong code (ENABLE_DAILY_DEALS) VÀ công tắc admin = true.
 * Chưa có dòng / lỗi CSDL → tắt (giữ nguyên như khi chưa có công tắc).
 */
export async function isDailyDealsEnabled(): Promise<boolean> {
  if (!ENABLE_DAILY_DEALS) return false;
  const row = await getSiteSetting(DAILY_DEALS_KEY);
  return row?.value === true;
}

/**
 * Dòng năng lực giao hàng. {so} trong câu được thay bằng số chai (định dạng theo ngôn ngữ, VD 10.000 / 10,000).
 * Chưa có dòng / lỗi CSDL → dùng câu mặc định như trước khi có cài đặt.
 */
export interface WeeklyDeliveryLine {
  count: number;
  textVi: string;
  textEn: string;
}

export const WEEKLY_DELIVERY_PLACEHOLDER = '{so}';
export const WEEKLY_DELIVERY_MAX_COUNT = 100_000_000;
export const WEEKLY_DELIVERY_MAX_TEXT = 160;

export const DEFAULT_WEEKLY_DELIVERY: WeeklyDeliveryLine = {
  count: 10000,
  textVi: 'Hơn {so} chai được Thái Sơn Foods giao mỗi tuần',
  textEn: 'Thái Sơn Foods delivers {so}+ bottles every week',
};

/** Kiểm tra dữ liệu admin gửi lên. Trả về lỗi (tiếng Việt) hoặc giá trị đã làm sạch. */
export function parseWeeklyDelivery(input: unknown): { value: WeeklyDeliveryLine } | { error: string } {
  if (!input || typeof input !== 'object') return { error: 'Dữ liệu không hợp lệ.' };
  const raw = input as Record<string, unknown>;
  const count = typeof raw.count === 'number' ? raw.count : Number(raw.count);
  if (!Number.isInteger(count) || count < 0 || count > WEEKLY_DELIVERY_MAX_COUNT) {
    return { error: 'Số chai phải là số nguyên từ 0 đến 100.000.000.' };
  }
  const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
  const textVi = clean(raw.textVi) || DEFAULT_WEEKLY_DELIVERY.textVi;
  const textEn = clean(raw.textEn) || DEFAULT_WEEKLY_DELIVERY.textEn;
  if (textVi.length > WEEKLY_DELIVERY_MAX_TEXT || textEn.length > WEEKLY_DELIVERY_MAX_TEXT) {
    return { error: `Câu hiển thị tối đa ${WEEKLY_DELIVERY_MAX_TEXT} ký tự.` };
  }
  if (!textVi.includes(WEEKLY_DELIVERY_PLACEHOLDER) || !textEn.includes(WEEKLY_DELIVERY_PLACEHOLDER)) {
    return { error: 'Câu hiển thị phải có {so} ở chỗ cần hiện số chai.' };
  }
  return { value: { count, textVi, textEn } };
}

export async function getWeeklyDelivery(): Promise<WeeklyDeliveryLine & { updatedBy: string | null; updatedAt: string | null }> {
  const row = await getSiteSetting(WEEKLY_DELIVERY_KEY);
  const parsed = row ? parseWeeklyDelivery(row.value) : null;
  const value = parsed && 'value' in parsed ? parsed.value : DEFAULT_WEEKLY_DELIVERY;
  return { ...value, updatedBy: row?.updatedBy ?? null, updatedAt: row?.updatedAt ?? null };
}

/**
 * Số chai giao mỗi tuần RIÊNG cho từng sản phẩm / combo (admin nhập tay, không tính từ đơn trên web).
 * Chưa nhập → dùng số mặc định ở trên. Nhập 0 → ẩn dòng này ở trang của món đó.
 * Bảng riêng, tự tạo khi cần; không sửa bảng products / combos.
 */
export type WeeklyDeliveryItemType = 'product' | 'combo';

export const ITEM_WEEKLY_DELIVERY_DDL = `
  CREATE TABLE IF NOT EXISTS item_weekly_delivery (
    item_type VARCHAR(10) NOT NULL,
    item_id VARCHAR(100) NOT NULL,
    count INTEGER NOT NULL CHECK (count >= 0),
    updated_by VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (item_type, item_id)
  );
`;

export function isWeeklyDeliveryItemType(v: unknown): v is WeeklyDeliveryItemType {
  return v === 'product' || v === 'combo';
}

let itemReadyPromise: Promise<boolean> | null = null;
function ensureItemWeeklyDelivery(): Promise<boolean> {
  if (!itemReadyPromise) {
    itemReadyPromise = query(ITEM_WEEKLY_DELIVERY_DDL)
      .then(() => true)
      .catch((err) => {
        console.error('[SiteSettings] Không tạo được bảng item_weekly_delivery:', err);
        itemReadyPromise = null;
        return false;
      });
  }
  return itemReadyPromise;
}

/** Số chai đã nhập cho từng món của một loại: { itemId: count } */
export async function listItemWeeklyDelivery(itemType: WeeklyDeliveryItemType): Promise<Record<string, number>> {
  if (!(await ensureItemWeeklyDelivery())) return {};
  try {
    const res = await query(`SELECT item_id, count FROM item_weekly_delivery WHERE item_type = $1;`, [itemType]);
    const out: Record<string, number> = {};
    for (const row of res.rows) out[row.item_id] = Number(row.count);
    return out;
  } catch (err) {
    console.error('[SiteSettings] Không đọc được item_weekly_delivery:', err);
    return {};
  }
}

export async function getItemWeeklyCount(itemType: WeeklyDeliveryItemType, itemId: string): Promise<number | null> {
  if (!(await ensureItemWeeklyDelivery())) return null;
  try {
    const res = await query(
      `SELECT count FROM item_weekly_delivery WHERE item_type = $1 AND item_id = $2 LIMIT 1;`,
      [itemType, itemId]
    );
    return res.rows[0] ? Number(res.rows[0].count) : null;
  } catch (err) {
    console.error('[SiteSettings] Không đọc được số chai của', itemType, itemId, err);
    return null;
  }
}

/** count = null → xoá số riêng (quay về số mặc định) */
export async function setItemWeeklyCount(
  itemType: WeeklyDeliveryItemType,
  itemId: string,
  count: number | null,
  updatedBy: string
): Promise<void> {
  if (!(await ensureItemWeeklyDelivery())) throw new Error('Không tạo được bảng item_weekly_delivery');
  if (count === null) {
    await query(`DELETE FROM item_weekly_delivery WHERE item_type = $1 AND item_id = $2;`, [itemType, itemId]);
    return;
  }
  await query(
    `INSERT INTO item_weekly_delivery (item_type, item_id, count, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (item_type, item_id) DO UPDATE SET count = EXCLUDED.count, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP;`,
    [itemType, itemId, count, updatedBy]
  );
}
