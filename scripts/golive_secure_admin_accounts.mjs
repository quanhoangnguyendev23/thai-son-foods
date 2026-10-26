/**
 * GO-LIVE (P0-2): Khoá tài khoản admin yếu / tài khoản test trong bảng admin_users.
 *
 * Mặc định --dry-run: chỉ in danh sách tài khoản + kế hoạch xử lý, không ghi gì vào CSDL.
 * --apply:
 *   - is_active = false cho tài khoản test (qa_*, marketing_test4, Test-mar, Mar1, staff_empty_store, adminCH1..5),
 *     trừ các tài khoản liệt kê trong --keep;
 *   - đặt mật khẩu ngẫu nhiên 16 ký tự cho MỌI tài khoản còn hoạt động, must_change_password = true,
 *     password_changed_at = now() (token đăng nhập cũ tự hết hiệu lực);
 *   - ghi username + mật khẩu tạm ra file CSV ở máy local (mặc định ./admin-credentials-<ngày>.csv, đã có trong .gitignore);
 *   - ghi audit_logs cho từng thay đổi. Toàn bộ chạy trong 1 transaction, lỗi thì rollback.
 * Không bao giờ in mật khẩu hoặc hash ra màn hình. Chuỗi kết nối chỉ nhận qua dòng lệnh, không ghi vào file.
 *
 * Chạy:
 *   node scripts/golive_secure_admin_accounts.mjs --db "<DATABASE_URL>"                       (dry-run)
 *   node scripts/golive_secure_admin_accounts.mjs --db "<DATABASE_URL>" --apply --confirm-db <tên_db>
 * Tuỳ chọn: --keep user1,user2   (giữ hoạt động tài khoản test này)
 *           --out <đường_dẫn.csv> (nơi lưu file mật khẩu tạm)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const WEAK_PASSWORDS = ['Admin@123', 'Tsf@123', 'QaTest@2026!Password', 'Password123!', 'Password123'];
const TEST_EXACT = ['marketing_test4', 'test-mar', 'mar1', 'staff_empty_store'];
const isTestAccount = (username) => {
  const u = String(username || '').toLowerCase();
  return u.startsWith('qa_') || TEST_EXACT.includes(u) || /^adminch[1-5]$/.test(u);
};

function parseArgs(argv) {
  const args = { apply: false, keep: [], db: null, confirmDb: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.apply = false;
    else if (a === '--db') args.db = next();
    else if (a.startsWith('--db=')) args.db = a.slice(5);
    else if (a === '--confirm-db') args.confirmDb = next();
    else if (a.startsWith('--confirm-db=')) args.confirmDb = a.slice(13);
    else if (a === '--keep') args.keep = String(next() || '').split(',');
    else if (a.startsWith('--keep=')) args.keep = a.slice(7).split(',');
    else if (a === '--out') args.out = next();
    else if (a.startsWith('--out=')) args.out = a.slice(6);
  }
  args.keep = args.keep.map((s) => s.trim().toLowerCase()).filter(Boolean);
  return args;
}

/** 16 ký tự: chữ hoa, chữ thường, số, ký hiệu (đủ password-policy: có chữ + số) */
function randomPassword(len = 16) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*-_=+'];
  const all = sets.join('');
  const chars = sets.map((s) => s[crypto.randomInt(s.length)]);
  while (chars.length < len) chars.push(all[crypto.randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function ensureGitignored(fileName) {
  const gi = path.resolve('.gitignore');
  const rule = 'admin-credentials-*.csv';
  const content = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  if (!content.split(/\r?\n/).includes(rule)) {
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    fs.appendFileSync(gi, `${content && !content.endsWith('\n') ? eol : ''}# mật khẩu tạm admin (golive_secure_admin_accounts)${eol}${rule}${eol}`);
    console.log(`📝 Đã thêm "${rule}" vào .gitignore`);
  }
  if (!/^admin-credentials-.*\.csv$/.test(path.basename(fileName))) {
    console.warn(`⚠️ File ${path.basename(fileName)} không khớp mẫu admin-credentials-*.csv — tự đảm bảo không commit file này.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.db) {
    console.error('Thiếu --db "<DATABASE_URL>".');
    process.exit(2);
  }
  let dbName;
  let host;
  try {
    const u = new URL(args.db);
    dbName = decodeURIComponent(u.pathname.replace(/^\//, ''));
    host = u.hostname;
  } catch {
    console.error('DATABASE_URL không hợp lệ.');
    process.exit(2);
  }
  if (args.apply && args.confirmDb !== dbName) {
    console.error(`Từ chối --apply: phải kèm --confirm-db ${dbName || '<tên_db>'} (đúng tên CSDL) để xác nhận.`);
    process.exit(2);
  }

  console.log(`🔐 ${args.apply ? 'APPLY' : 'DRY-RUN'} trên CSDL "${dbName}" @ ${host}`);
  const pool = new pg.Pool({ connectionString: args.db });
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, username, role, store_code, is_active, must_change_password, password_hash FROM admin_users ORDER BY role, username;`
    );

    const plan = [];
    for (const r of rows) {
      let weak = null;
      for (const pw of WEAK_PASSWORDS) {
        if (r.password_hash && (await bcrypt.compare(pw, r.password_hash).catch(() => false))) {
          weak = pw;
          break;
        }
      }
      const test = isTestAccount(r.username);
      const kept = args.keep.includes(String(r.username).toLowerCase());
      let action;
      if (!r.is_active) action = 'bỏ qua (đã tắt)';
      else if (test && !kept) action = 'TẮT (tài khoản test)';
      else action = 'ĐỔI MẬT KHẨU ngẫu nhiên';
      plan.push({ ...r, weak, test, action });
    }

    console.table(
      plan.map((p) => ({
        username: p.username,
        role: p.role,
        store_code: p.store_code || '',
        is_active: p.is_active,
        test: p.test ? 'test' : '',
        mat_khau_yeu: p.weak ? `khớp "${p.weak}"` : '',
        ke_hoach: p.action,
      }))
    );

    const weakCount = {};
    for (const p of plan) if (p.weak) weakCount[p.weak] = (weakCount[p.weak] || 0) + 1;
    const toDisable = plan.filter((p) => p.action.startsWith('TẮT'));
    const toReset = plan.filter((p) => p.action.startsWith('ĐỔI'));
    console.log(`\nTổng: ${plan.length} tài khoản, ${plan.filter((p) => p.is_active).length} đang hoạt động.`);
    console.log('Khớp mật khẩu yếu:', Object.keys(weakCount).length ? weakCount : 'không có');
    console.log(
      `Sẽ TẮT ${toDisable.length} tài khoản test${toDisable.length ? `: ${toDisable.map((p) => p.username).join(', ')}` : ''}`
    );
    console.log(`Sẽ ĐỔI MẬT KHẨU ${toReset.length} tài khoản còn hoạt động.`);
    if (args.keep.length) console.log(`--keep: ${args.keep.join(', ')}`);

    if (!args.apply) {
      console.log('\n(DRY-RUN) Không ghi gì vào CSDL. Chạy lại với --apply --confirm-db <tên_db> để thực hiện.');
      return;
    }

    const date = new Date().toISOString().slice(0, 10);
    const outFile = path.resolve(args.out || `admin-credentials-${date}.csv`);
    ensureGitignored(outFile);

    const credentials = [];
    const auditBase = { role: 'SYSTEM', adminUsername: 'golive_secure_admin_accounts', entityType: 'admin_users' };
    const audit = (action, p, before, after) =>
      client.query(
        `INSERT INTO audit_logs (id, admin_id, admin_username, role, action, entity_type, entity_id, store_code, before_json, after_json, ip, user_agent, created_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, NULL, 'script:golive_secure_admin_accounts', NOW());`,
        [
          `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          auditBase.adminUsername,
          auditBase.role,
          action,
          auditBase.entityType,
          p.id,
          p.store_code || null,
          JSON.stringify(before),
          JSON.stringify(after),
        ]
      );

    await client.query('BEGIN');
    try {
      for (const p of toDisable) {
        await client.query(`UPDATE admin_users SET is_active = false, updated_at = NOW() WHERE id = $1;`, [p.id]);
        await audit('GOLIVE_DISABLE_TEST_ACCOUNT', p, { username: p.username, is_active: true }, { is_active: false });
      }
      for (const p of toReset) {
        const pw = randomPassword(16);
        const hash = await bcrypt.hash(pw, await bcrypt.genSalt(10));
        await client.query(
          `UPDATE admin_users SET password_hash = $2, must_change_password = true, password_changed_at = NOW(), updated_at = NOW() WHERE id = $1;`,
          [p.id, hash]
        );
        await audit(
          'GOLIVE_RESET_PASSWORD',
          p,
          { username: p.username, must_change_password: p.must_change_password, weak_password: Boolean(p.weak) },
          { must_change_password: true, password_reset: true }
        );
        credentials.push([p.username, p.role, p.store_code || '', pw]);
      }
      // Ghi file trước khi COMMIT: không ghi được file thì rollback, tránh khoá mất mật khẩu
      const csv = ['username,role,store_code,temporary_password', ...credentials.map((c) => c.map(csvCell).join(','))].join('\n');
      fs.writeFileSync(outFile, `${csv}\n`, { encoding: 'utf8', mode: 0o600 });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    console.log(`\n✅ Đã tắt ${toDisable.length} tài khoản test, đổi mật khẩu ${toReset.length} tài khoản.`);
    console.log(`🔑 Mật khẩu tạm lưu tại: ${outFile} (KHÔNG commit, gửi riêng cho từng người rồi xoá file).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
