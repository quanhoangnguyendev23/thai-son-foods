/**
 * Thay toàn bộ combo theo file "01 - Bang tinh gia Combo - 261115.xlsb", sheet "Bảng tính combo" (19/11/2026).
 * Mỗi loại combo (cột "Mô tả") lấy 3 combo đầu: STT 1–3 (Đa dạng), 6–8 (Chỉ định), 11–13 (Tăng số lượng),
 * 16–18 (Giá) → 12 combo. Loại Member (STT 21–25) bỏ theo yêu cầu 19/11/2026. Mọi combo khác bị XOÁ
 * (combo_items / combo_images tự xoá theo).
 *
 * - Tên combo tạm để "?" theo yêu cầu 19/11/2026 (label: tên dự kiến, chỉ để đọc, không ghi vào CSDL).
 * - Giá gốc = "Giá Web - NTD" (tổng giá web từng chai); giá bán = giá gốc − cột "NTD" (phần margin nhường người tiêu dùng);
 *   discount = làm tròn (NTD / giá gốc × 100). Đúng cách tính các combo đang có trên staging.
 * - Combo đã có (khớp slug cũ hoặc slug mới) được CẬP NHẬT giữ nguyên id (đơn cũ vẫn tra được); chưa có thì tạo mới.
 * - Thành phần tra sản phẩm theo products.sku (SB, SHS, SGL, SS, SL, MD, LH, TD, TSG, TXG, TSA, MAC).
 * - TEST-GUARD: chỉ chạy trên DB tên chứa "staging" / "test" (hoặc ALLOW_PROD_DB=yes). Sao lưu combos, combo_items,
 *   combo_images ra JSON trước khi ghi; chạy trong 1 giao dịch.
 *
 *   node scripts/replace_combos_2026-11-19.mjs --dry-run
 *   node scripts/replace_combos_2026-11-19.mjs --backup-dir <thư mục>
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { assertSafeDatabase } from './db-guard.mjs';

/** stt: số thứ tự trong sheet; oldSlugs: slug combo đang có trên staging tương ứng (để giữ id) */
export const COMBOS = [
  { stt: 1, slug: 'bo-san-pham-sua-hat', oldSlugs: [], name: '?', label: 'Bộ sản phẩm Sữa hạt', type: 'DA_DANG', items: { SB: 4, SHS: 2, SGL: 4 }, web: 180000, ntd: 20000 },
  { stt: 2, slug: 'bo-3-loai-nuoc-mat-thanh-nhiet', oldSlugs: [], name: '?', label: 'Bộ 3 loại nước mát thanh nhiệt', type: 'DA_DANG', items: { SS: 3, SL: 3, TSA: 2, MAC: 2 }, web: 230000, ntd: 18500 },
  { stt: 3, slug: 'thuong-thuc-combo-tra-sua', oldSlugs: [], name: '?', label: 'Thưởng thức combo Trà sữa', type: 'DA_DANG', items: { LH: 2, TD: 2, TSA: 4, MAC: 4 }, web: 232000, ntd: 23500 },
  { stt: 6, slug: 'combo-chi-dinh-tao-do', oldSlugs: ['nhap-chi-dinh-1'], name: '?', label: 'Combo chỉ định Táo đỏ hạt chia', type: 'CHI_DINH', items: { MD: 3, LH: 3, TD: 6 }, web: 216000, ntd: 22500 },
  { stt: 7, slug: 'combo-chi-dinh-nha-dam', oldSlugs: ['nhap-chi-dinh-2'], name: '?', label: 'Combo chỉ định Nha đam', type: 'CHI_DINH', items: { MD: 5, TD: 2, TSG: 2, TXG: 3 }, web: 216000, ntd: 23500 },
  { stt: 8, slug: 'combo-chi-dinh-matcha-ciao', oldSlugs: ['nhap-chi-dinh-3'], name: '?', label: 'Combo chỉ định Matcha trà sữa Ciao', type: 'CHI_DINH', items: { SHS: 2, SGL: 2, MAC: 6 }, web: 192000, ntd: 20000 },
  { stt: 11, slug: 'combo-tang-so-luong-1', oldSlugs: ['combo-1'], name: '?', label: 'Combo tăng số lượng 1', type: 'TANG_SO_LUONG', items: { SB: 2, MD: 2, LH: 2, TD: 2 }, web: 144000, ntd: 12400 },
  { stt: 12, slug: 'combo-tang-so-luong-2', oldSlugs: ['nhap-tang-so-luong-2'], name: '?', label: 'Combo tăng số lượng 2', type: 'TANG_SO_LUONG', items: { SS: 2, SL: 2, TSA: 2, MAC: 2 }, web: 180000, ntd: 12000 },
  { stt: 13, slug: 'combo-tang-so-luong-3', oldSlugs: ['nhap-tang-so-luong-3'], name: '?', label: 'Combo tăng số lượng 3', type: 'TANG_SO_LUONG', items: { SB: 2, SHS: 2, SL: 2, TD: 2 }, web: 158000, ntd: 12000 },
  { stt: 16, slug: 'bo-san-pham-gia-dinh', oldSlugs: [], name: '?', label: 'Bộ sản phẩm gia đình', type: 'GIA', items: { SS: 4, SL: 4, TSG: 3, TXG: 3 }, web: 308000, ntd: 41600 },
  { stt: 17, slug: 'bo-san-pham-ciao', oldSlugs: [], name: '?', label: 'Bộ sản phẩm Ciao', type: 'GIA', items: { SB: 3, MD: 3, TSA: 4, MAC: 4 }, web: 268000, ntd: 39200 },
  { stt: 18, slug: 'bo-san-pham-03-dong', oldSlugs: [], name: '?', label: 'Bộ sản phẩm 03 dòng', type: 'GIA', items: { SB: 2, SHS: 2, SGL: 2, MD: 4, LH: 4 }, web: 252000, ntd: 39200 },
];

/**
 * Ảnh combo: public/images/combos/combo-stt-<STT>.jpg, chép từ "Y:/2. Tư liệu thiết kế/A3 - Combo/File TK/Chọn/Combo <STT> - Nền ….jpg"
 * (file thiết kế đánh số theo STT trong Excel; STT 17 dùng bản "Nền 1aa").
 */
export const comboImage = (c) => `/images/combos/combo-stt-${String(c.stt).padStart(2, '0')}.jpg`;

export const TYPE_DESCRIPTION = {
  DA_DANG: 'Combo đa dạng, gồm ít nhất 3 loại thức uống để thưởng thức nhiều hương vị.',
  CHI_DINH: 'Combo chỉ định: một sản phẩm chủ đạo chiếm khoảng một nửa số chai, kèm các vị khác.',
  TANG_SO_LUONG: 'Combo tăng số lượng: gói nhỏ gọn, giá tốt khi mua nhiều.',
  GIA: 'Combo giá tốt cho gia đình, tiết kiệm hơn mua lẻ.',
};

const isMain = /replace_combos_2026-11-19\.mjs$/.test(process.argv[1] || '');

async function main() {
  const dbName = assertSafeDatabase();
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const bArg = args.indexOf('--backup-dir');
  const backupDir = bArg >= 0 ? args[bArg + 1] : path.resolve('backups', `combos_${new Date().toISOString().replace(/[:.]/g, '-')}`);
  // DB cloud (không phải máy này) cần SSL, giống src/lib/db.ts
  const url = process.env.DATABASE_URL || '';
  const remote = Boolean(url) && !url.includes('127.0.0.1') && !url.includes('localhost');
  const pool = new pg.Pool({ connectionString: url, ssl: remote ? { rejectUnauthorized: false } : undefined });
  const client = await pool.connect();
  try {
    console.log(`[COMBOS] DB: ${dbName}${dryRun ? ' (chạy thử, không ghi)' : ''}`);
    const prod = (await client.query(`SELECT id, sku, price FROM products WHERE sku IS NOT NULL;`)).rows;
    const bySku = new Map(prod.map((p) => [String(p.sku).toUpperCase(), p]));
    const existing = (await client.query(`SELECT id, slug, name FROM combos ORDER BY created_at;`)).rows;

    // Kiểm dữ liệu trước khi ghi: đủ sản phẩm, tổng giá web khớp giá sản phẩm hiện tại
    const problems = [];
    for (const c of COMBOS) {
      let sum = 0;
      for (const [sku, q] of Object.entries(c.items)) {
        const p = bySku.get(sku);
        if (!p) problems.push(`STT ${c.stt}: không có sản phẩm sku ${sku}`);
        else sum += Number(p.price) * q;
      }
      if (sum !== c.web) problems.push(`STT ${c.stt}: tổng giá web theo DB ${sum} ≠ ${c.web} trong file Excel`);
    }
    if (problems.length) {
      console.error('Dừng, dữ liệu chưa khớp:\n  ' + problems.join('\n  '));
      process.exitCode = 1;
      return;
    }

    const plan = COMBOS.map((c) => {
      const hit = existing.find((e) => e.slug === c.slug || c.oldSlugs.includes(e.slug));
      return { c, id: hit?.id || null, from: hit?.slug || null };
    });
    const keepIds = new Set(plan.map((x) => x.id).filter(Boolean));
    const toDelete = existing.filter((e) => !keepIds.has(e.id));
    for (const x of plan) {
      const sale = x.c.web - x.c.ntd;
      console.log(`  ${x.id ? 'SỬA' : 'TẠO'} STT ${String(x.c.stt).padStart(2)} ${x.c.slug}${x.from && x.from !== x.c.slug ? ` (từ ${x.from})` : ''}: ${x.c.web} → ${sale}`);
    }
    for (const d of toDelete) console.log(`  XOÁ ${d.slug}`);
    if (dryRun) return;

    fs.mkdirSync(backupDir, { recursive: true });
    for (const t of ['combos', 'combo_items', 'combo_images']) {
      const rows = (await client.query(`SELECT * FROM ${t};`)).rows;
      fs.writeFileSync(path.join(backupDir, `${t}.json`), JSON.stringify(rows, null, 2));
      console.log(`  sao lưu ${t}: ${rows.length} dòng`);
    }
    console.log(`  → ${backupDir}`);

    await client.query('BEGIN;');
    for (const d of toDelete) await client.query(`DELETE FROM combos WHERE id = $1;`, [d.id]);
    let i = 0;
    for (const x of plan) {
      const c = x.c;
      const sale = c.web - c.ntd;
      const discount = Math.round((c.ntd / c.web) * 100);
      const total = Object.values(c.items).reduce((a, b) => a + b, 0);
      const desc = TYPE_DESCRIPTION[c.type];
      const image = comboImage(c);
      let id = x.id;
      if (id) {
        await client.query(
          `UPDATE combos SET slug = $2, name = $3, name_en = NULL, description = $4, description_en = NULL,
                  original_price = $5, sale_price = $6, total_items = $7, discount = $8, image = $9, is_active = true, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1;`,
          [id, c.slug, c.name, desc, c.web, sale, total, discount, image]
        );
        await client.query(`DELETE FROM combo_items WHERE combo_id = $1;`, [id]);
      } else {
        id = `combo_${Date.now()}${i}`;
        // created_at tăng dần theo STT để trang chủ (ORDER BY created_at) hiện đúng thứ tự trong file
        await client.query(
          `INSERT INTO combos (id, slug, name, description, original_price, sale_price, total_items, discount, image, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $10, true, CURRENT_TIMESTAMP + ($9 || ' seconds')::interval, CURRENT_TIMESTAMP);`,
          [id, c.slug, c.name, desc, c.web, sale, total, discount, String(i), image]
        );
      }
      for (const [sku, q] of Object.entries(c.items)) {
        await client.query(`INSERT INTO combo_items (id, combo_id, product_id, quantity, unit) VALUES ($1, $2, $3, $4, 'chai');`, [
          `ci_${crypto.randomBytes(6).toString('hex')}`,
          id,
          bySku.get(sku).id,
          q,
        ]);
      }
      i++;
    }
    await client.query('COMMIT;');
    const after = (await client.query(`SELECT count(*)::int n FROM combos;`)).rows[0].n;
    console.log(`[COMBOS] Xong: ${plan.filter((x) => x.id).length} sửa, ${plan.filter((x) => !x.id).length} tạo, ${toDelete.length} xoá. Còn ${after} combo.`);
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (isMain) {
  main().catch((e) => {
    console.error('[COMBOS] Lỗi:', e.message);
    process.exit(1);
  });
}
