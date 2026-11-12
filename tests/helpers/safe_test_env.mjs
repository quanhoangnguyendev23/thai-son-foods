import url from 'node:url';

// SEC-02: chuỗi kết nối DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return url;
}

/**
 * Requirement 4:
 * Mọi test có ghi DB chỉ chạy khi DATABASE_URL trỏ DB dev/test,
 * từ chối chạy khi NODE_ENV=production hoặc host không phải localhost.
 */
export function assertSafeTestEnvironment(customDbUrl) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[SAFETY_GUARD_REJECTED] Test bị từ chối chạy: Biến môi trường NODE_ENV đang là "production". Test có ghi DB chỉ được phép chạy trên dev/test.'
    );
  }

  const dbUrl = customDbUrl || requireDatabaseUrl();

  let parsed;
  try {
    parsed = new url.URL(dbUrl);
  } catch (err) {
    throw new Error(`[SAFETY_GUARD_REJECTED] DATABASE_URL không hợp lệ: ${err.message}`);
  }

  const hostname = (parsed.hostname || '').toLowerCase();
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0';

  if (!isLocal) {
    throw new Error(
      `[SAFETY_GUARD_REJECTED] Test bị từ chối chạy: DATABASE_URL host (${hostname}) không phải localhost / 127.0.0.1.`
    );
  }

  const dbName = (parsed.pathname || '').replace(/^\//, '').toLowerCase();
  if (dbName.includes('production') || dbName === 'webtsf_prod' || dbName === 'webtsf_production') {
    throw new Error(
      `[SAFETY_GUARD_REJECTED] Test bị từ chối chạy: DB name (${dbName}) trỏ vào production database!`
    );
  }

  return { safe: true, hostname, dbName };
}
