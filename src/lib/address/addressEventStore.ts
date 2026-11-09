/**
 * Lưu log ẩn danh chất lượng gợi ý địa chỉ vào bảng address_events (không mã đơn, không mã khách, không IP) và xóa bản ghi
 * quá 30 ngày (gọi mỗi đêm từ /api/cron/cleanup-reservations). Xem anonymousLog.ts cho phần ẩn danh hóa.
 */
import type { AddressEvent } from './anonymousLog';

type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rowCount?: number | null }>;

export const ADDRESS_EVENT_RETENTION_DAYS = 30;

async function defaultQuery(): Promise<QueryFn> {
  const { query } = await import('@/lib/db');
  return query as unknown as QueryFn;
}

export async function saveAddressEvent(event: AddressEvent, q?: QueryFn): Promise<void> {
  const run = q ?? (await defaultQuery());
  await run(
    `INSERT INTO address_events
       (hour, query, result_count, rank, source, provider_status, precision, address_source, location_trusted,
        location_check, pin_moved, pin_choice, pin_lat, pin_lng)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      event.hour,
      event.query,
      event.resultCount,
      event.rank,
      event.source,
      event.providerStatus,
      event.precision,
      event.addressSource,
      event.locationTrusted,
      event.check,
      event.pinMoved,
      event.pinChoice,
      event.pin ? event.pin[0] : null,
      event.pin ? event.pin[1] : null,
    ]
  );
}

/** Xóa bản ghi quá hạn; trả số dòng đã xóa. */
export async function purgeOldAddressEvents(days = ADDRESS_EVENT_RETENTION_DAYS, q?: QueryFn): Promise<number> {
  const run = q ?? (await defaultQuery());
  const res = await run(`DELETE FROM address_events WHERE hour < NOW() - ($1::int * INTERVAL '1 day')`, [days]);
  return res.rowCount ?? 0;
}
