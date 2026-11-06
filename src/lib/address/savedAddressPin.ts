/**
 * Xác nhận ghim cho địa chỉ ĐÃ LƯU ở tài khoản (cột users.address_pin_*; migration address_round4_schema.sql).
 * Địa chỉ đã lưu chỉ được tin (không bắt xác nhận ghim lại ở trang thanh toán) khi:
 *   - khách đã xác nhận ghim trên bản đồ lúc lưu, VÀ
 *   - chữ địa chỉ + Phường/Quận/Tỉnh và tọa độ hiện tại vẫn đúng như lúc xác nhận (so bản chụp).
 * Sửa bất kỳ phần nào thì xác nhận bị xóa. Lỗi đọc/ghi (vd chưa chạy migration) thì coi như chưa xác nhận.
 */
import { addressSnapshot, hasRealCoords } from './normalize';

type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

export interface SavedAddress {
  address?: string | null;
  ward?: string | null;
  district?: string | null;
  province?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface SavedPinRow {
  address_pin_confirmed_at?: unknown;
  address_pin_lat?: unknown;
  address_pin_lng?: unknown;
  address_pin_snapshot?: unknown;
}

const sameCoord = (a: unknown, b: unknown) => Math.abs(Number(a) - Number(b)) < 1e-7;

/** Xác nhận còn hiệu lực với địa chỉ + tọa độ hiện tại không. */
export function isSavedPinValid(row: SavedPinRow | null | undefined, current: SavedAddress): boolean {
  if (!row || !row.address_pin_confirmed_at) return false;
  if (!hasRealCoords(current.latitude, current.longitude)) return false;
  if (!sameCoord(row.address_pin_lat, current.latitude) || !sameCoord(row.address_pin_lng, current.longitude)) return false;
  return row.address_pin_snapshot === addressSnapshot(current);
}

async function db(q?: QueryFn): Promise<QueryFn> {
  if (q) return q;
  const { query } = await import('@/lib/db');
  return query as unknown as QueryFn;
}

export async function readSavedPin(userId: string, q?: QueryFn): Promise<SavedPinRow | null> {
  try {
    const run = await db(q);
    const res = await run(
      'SELECT address_pin_confirmed_at, address_pin_lat, address_pin_lng, address_pin_snapshot FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    return (res.rows[0] as SavedPinRow) || null;
  } catch {
    return null;
  }
}

/**
 * Sau khi khách lưu địa chỉ: `confirmed` = khách vừa xác nhận ghim trên bản đồ cho đúng địa chỉ này.
 * Có xác nhận → ghi lại (giờ, tọa độ, bản chụp). Không → xóa xác nhận cũ nếu địa chỉ hoặc tọa độ đã khác.
 */
export async function updateSavedPin(userId: string, saved: SavedAddress, confirmed: boolean, q?: QueryFn): Promise<boolean> {
  try {
    const run = await db(q);
    if (confirmed && hasRealCoords(saved.latitude, saved.longitude)) {
      await run(
        `UPDATE users SET address_pin_confirmed_at = NOW(), address_pin_lat = $1, address_pin_lng = $2, address_pin_snapshot = $3 WHERE id = $4`,
        [saved.latitude, saved.longitude, addressSnapshot(saved), userId]
      );
      return true;
    }
    const row = await readSavedPin(userId, run);
    if (row && row.address_pin_confirmed_at && !isSavedPinValid(row, saved)) {
      await run(
        `UPDATE users SET address_pin_confirmed_at = NULL, address_pin_lat = NULL, address_pin_lng = NULL, address_pin_snapshot = NULL WHERE id = $1`,
        [userId]
      );
    }
    return !!row && isSavedPinValid(row, saved);
  } catch {
    return false;
  }
}
