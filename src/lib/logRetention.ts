import { promises as fs } from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';
import { put } from '@vercel/blob';
import { query } from '@/lib/db';

/**
 * Hạn lưu giữ nhật ký (audit_logs, inventory_logs).
 *
 * Chạy mỗi đêm từ /api/cron/cleanup-reservations. Mỗi nhóm log quá hạn được XUẤT RA FILE LƯU TRỮ
 * (.jsonl.gz) trước, ghi file thành công mới xoá khỏi DB. Ghi file lỗi thì bỏ qua lần này, không xoá gì.
 *
 * Nơi lưu file:
 * - Có BLOB_READ_WRITE_TOKEN (Vercel): Vercel Blob, chế độ private, thư mục log-archive/.
 * - Không có (máy chủ riêng): thư mục LOG_ARCHIVE_DIR, bỏ trống = <thư mục app>/backups/log-archive.
 *
 * Số ngày giữ đổi được bằng biến môi trường (xem .env.example, mục "Hạn lưu giữ nhật ký").
 */

type Rule = {
  key: string;
  table: 'audit_logs' | 'inventory_logs';
  /** Điều kiện SQL chọn nhóm log (không chứa tham số) */
  where: string;
  days: number;
};

/** Ghi chú do đồng bộ Google Sheet tự ghi (xem writeSyncLogs trong src/lib/inventorySheet.ts) */
const SHEET_SYNC_WHERE = `(actor = 'sheet-sync' OR note LIKE 'Đồng bộ từ Google Sheet:%')`;

/** Mỗi nhóm xoá tối đa chừng này dòng/lần chạy để không giữ khoá DB lâu; còn thừa thì đêm sau xoá tiếp */
const BATCH_LIMIT = 5000;

function envDays(name: string, fallback: number): number {
  const n = parseInt(process.env[name] || '', 10);
  // Không cho đặt dưới 7 ngày để tránh lỡ tay xoá nhật ký vừa ghi
  return Number.isFinite(n) && n >= 7 ? n : fallback;
}

function getRules(): Rule[] {
  return [
    {
      key: 'inventory-sheet-sync',
      table: 'inventory_logs',
      where: SHEET_SYNC_WHERE,
      days: envDays('LOG_RETENTION_SHEET_SYNC_DAYS', 90),
    },
    {
      key: 'inventory-other',
      table: 'inventory_logs',
      where: `NOT ${SHEET_SYNC_WHERE}`,
      days: envDays('LOG_RETENTION_INVENTORY_DAYS', 730),
    },
    {
      key: 'audit-auth',
      table: 'audit_logs',
      where: `action LIKE 'AUTH\\_%'`,
      days: envDays('LOG_RETENTION_AUTH_DAYS', 180),
    },
    {
      key: 'audit-other',
      table: 'audit_logs',
      where: `action NOT LIKE 'AUTH\\_%'`,
      days: envDays('LOG_RETENTION_AUDIT_DAYS', 730),
    },
  ];
}

async function saveArchive(fileName: string, rows: unknown[]): Promise<string> {
  const body = gzipSync(Buffer.from(rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8'));
  const blobToken = (process.env.BLOB_READ_WRITE_TOKEN || '').trim();

  if (blobToken) {
    const blob = await put(`log-archive/${fileName}`, body, {
      access: 'private',
      contentType: 'application/gzip',
      addRandomSuffix: true,
      token: blobToken,
    });
    return blob.pathname;
  }

  const dir = (process.env.LOG_ARCHIVE_DIR || '').trim()
    ? path.resolve(process.env.LOG_ARCHIVE_DIR as string)
    : path.join(process.cwd(), 'backups', 'log-archive');
  const fullPath = path.join(dir, fileName);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, body);
  return fullPath;
}

export interface LogRetentionResult {
  rule: string;
  days: number;
  archived: number;
  deleted: number;
  archivePath?: string;
  error?: string;
}

/**
 * Xuất rồi xoá nhật ký quá hạn. Không ném lỗi ra ngoài: lỗi của từng nhóm được trả về trong kết quả.
 */
export async function pruneOldLogs(): Promise<LogRetentionResult[]> {
  const results: LogRetentionResult[] = [];
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  for (const rule of getRules()) {
    const result: LogRetentionResult = { rule: rule.key, days: rule.days, archived: 0, deleted: 0 };
    try {
      const res = await query(
        `SELECT * FROM ${rule.table}
         WHERE ${rule.where} AND created_at < NOW() - ($1::int * INTERVAL '1 day')
         ORDER BY created_at ASC
         LIMIT ${BATCH_LIMIT};`,
        [rule.days]
      );
      if (res.rows.length > 0) {
        result.archivePath = await saveArchive(`${rule.table}/${stamp}_${rule.key}.jsonl.gz`, res.rows);
        result.archived = res.rows.length;

        const ids = res.rows.map((r: { id: string }) => r.id);
        const del = await query(`DELETE FROM ${rule.table} WHERE id = ANY($1::text[]);`, [ids]);
        result.deleted = del.rowCount || 0;
      }
    } catch (err: any) {
      // Bảng chưa tồn tại (DB cũ) hoặc không ghi được file lưu trữ: giữ nguyên dữ liệu, thử lại đêm sau
      result.error = err?.message || String(err);
      console.error(`[LogRetention] ${rule.key}:`, result.error);
    }
    results.push(result);
  }

  return results;
}
