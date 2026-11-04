import { query } from '@/lib/db';

export interface AuditLogParams {
  adminId?: string | null;
  adminUsername?: string | null;
  role?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  storeCode?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordhash',
  'token',
  'secret',
  'jwt',
  'cookie',
  'apikey',
  'api_key',
  'authorization',
]);

/**
 * Khử sạch các trường nhạy cảm (mật khẩu, hash, token) trước khi ghi log
 */
export function sanitizeAuditData(data: unknown): unknown {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeAuditData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    let isSensitive = false;
    for (const sens of SENSITIVE_KEYS) {
      if (lowerKey.includes(sens)) {
        isSensitive = true;
        break;
      }
    }

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/** Trường định danh luôn giữ lại để đọc log còn biết là bản ghi nào */
const IDENTITY_KEYS = ['id', 'name', 'title', 'code', 'slug', 'username', 'order_code', 'store_code'];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Khi có cả dữ liệu trước và sau (thao tác sửa), chỉ giữ các trường thực sự thay đổi
 * (cộng trường định danh) thay vì lưu nguyên cả bản ghi hai lần.
 * Tạo mới (không có trước) hoặc xoá (không có sau) vẫn lưu đầy đủ để còn khôi phục được.
 */
export function compactAuditDiff(before: unknown, after: unknown): { before: unknown; after: unknown } {
  if (!isPlainObject(before) || !isPlainObject(after)) return { before, after };

  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  for (const key of keys) {
    const changed = JSON.stringify(before[key]) !== JSON.stringify(after[key]);
    if (changed || IDENTITY_KEYS.includes(key)) {
      if (key in before) b[key] = before[key];
      if (key in after) a[key] = after[key];
    }
  }
  return { before: b, after: a };
}

/**
 * Ghi nhật ký hoạt động quản trị viên (Audit Log)
 * Tuyệt đối không lưu mật khẩu, hash hoặc token.
 */
export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const diff = compactAuditDiff(params.beforeJson, params.afterJson);
    const sanitizedBefore = diff.before ? JSON.stringify(sanitizeAuditData(diff.before)) : null;
    const sanitizedAfter = diff.after ? JSON.stringify(sanitizeAuditData(diff.after)) : null;

    await query(
      `INSERT INTO audit_logs (
        id, admin_id, admin_username, role, action, entity_type, entity_id, store_code, before_json, after_json, ip, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
      [
        id,
        params.adminId || null,
        params.adminUsername || null,
        params.role || null,
        params.action,
        params.entityType,
        params.entityId || null,
        params.storeCode || null,
        sanitizedBefore,
        sanitizedAfter,
        params.ip || null,
        params.userAgent || null,
      ]
    );
  } catch (err) {
    // Không làm sập request nếu việc ghi log gặp lỗi, chỉ in cảnh báo server
    console.error('Failed to write audit log:', err);
  }
}
