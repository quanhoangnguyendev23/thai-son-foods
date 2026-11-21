import crypto from 'node:crypto';
import { pool } from '@/lib/db';
import { SITE_SETTINGS_DDL } from '@/lib/site-settings';
import data from '@/data/combo-member-2026-11-21.json';

/**
 * Thêm 3 combo Member (STT 21–23) MỘT LẦN trên Vercel (DB cloud), chủ dự án cho phép 21/11/2026
 * ("Cho phép tự thêm khi deploy"). Cùng dữ liệu với scripts/replace_combos_2026-11-19.mjs (STT 21–23).
 *
 * - CHỈ chạy khi có biến môi trường VERCEL (không bao giờ chạy trên máy nội bộ / server công ty).
 * - CHỈ THÊM: combo nào đã có slug thì bỏ qua; không sửa / xoá combo khác.
 * - Chạy một lần: đánh dấu site_settings 'combo_member_2026_11_21'; khoá tư vấn để nhiều instance không chạy chồng.
 * - Một giao dịch; thiếu sản phẩm theo SKU hoặc tổng giá web lệch file Excel → không ghi gì, ghi log, lần sau thử lại.
 */
const MARKER_KEY = 'combo_member_2026_11_21';

type Entry = (typeof data.combos)[number];

let running: Promise<void> | null = null;

export function ensureMemberCombos20261121(): Promise<void> {
  if (!process.env.VERCEL) return Promise.resolve();
  if (!running) {
    running = runInsert().catch((err) => {
      console.error('[ComboMember] Lỗi, sẽ thử lại ở lần sau:', err);
      running = null;
    });
  }
  return running;
}

async function runInsert(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1));`, [MARKER_KEY]);
    await client.query(SITE_SETTINGS_DDL);
    const done = await client.query(`SELECT 1 FROM site_settings WHERE key = $1;`, [MARKER_KEY]);
    if (done.rows.length > 0) {
      await client.query('COMMIT;');
      return;
    }
    await client.query(`ALTER TABLE combos ADD COLUMN IF NOT EXISTS combo_type VARCHAR(20);`);

    const prod = (await client.query(`SELECT id, sku, price FROM products WHERE sku IS NOT NULL;`)).rows;
    // Mã SKU: staging dùng "SB", DB cloud dùng "SB-01" → nhận cả hai (mã đúng nguyên văn được ưu tiên)
    const bySku = new Map<string, any>();
    for (const p of prod) bySku.set(String(p.sku).toUpperCase(), p);
    for (const p of prod) {
      const base = String(p.sku).toUpperCase().replace(/-\d+$/, '');
      if (!bySku.has(base)) bySku.set(base, p);
    }
    const problems: string[] = [];
    for (const c of data.combos as Entry[]) {
      let sum = 0;
      for (const [sku, q] of Object.entries(c.items)) {
        const p: any = bySku.get(sku);
        if (!p) problems.push(`STT ${c.stt}: không có sản phẩm sku ${sku}`);
        else sum += Number(p.price) * Number(q);
      }
      if (sum !== c.web) problems.push(`STT ${c.stt}: tổng giá web ${sum} ≠ ${c.web}`);
    }
    if (problems.length) {
      await client.query('ROLLBACK;');
      console.error('[ComboMember] Dữ liệu sản phẩm chưa khớp, không thêm combo Member:\n  ' + problems.join('\n  '));
      return;
    }

    const existing = new Set(
      (await client.query(`SELECT slug FROM combos WHERE slug = ANY($1);`, [(data.combos as Entry[]).map((c) => c.slug)])).rows.map(
        (r: any) => r.slug
      )
    );
    let created = 0;
    let i = 0;
    for (const c of data.combos as Entry[]) {
      i++;
      if (existing.has(c.slug)) continue;
      const sale = c.web - c.ntd;
      const discount = Math.round((c.ntd / c.web) * 100);
      const total = Object.values(c.items).reduce((a, b) => a + Number(b), 0);
      const id = `combo_${Date.now()}${i}`;
      await client.query(
        `INSERT INTO combos (id, slug, name, description, original_price, sale_price, total_items, discount, image, combo_type,
                             is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, CURRENT_TIMESTAMP + ($11 || ' seconds')::interval, CURRENT_TIMESTAMP);`,
        [id, c.slug, c.name, c.description, c.web, sale, total, discount, c.image, c.type, String(i)]
      );
      for (const [sku, q] of Object.entries(c.items)) {
        await client.query(`INSERT INTO combo_items (id, combo_id, product_id, quantity, unit) VALUES ($1, $2, $3, $4, 'chai');`, [
          `ci_${crypto.randomBytes(6).toString('hex')}`,
          id,
          (bySku.get(sku) as any).id,
          Number(q),
        ]);
      }
      created++;
    }

    await client.query(
      `INSERT INTO site_settings (key, value, updated_by, updated_at) VALUES ($1, $2, 'system', CURRENT_TIMESTAMP);`,
      [MARKER_KEY, JSON.stringify({ at: new Date().toISOString(), created, skipped: data.combos.length - created })]
    );
    await client.query('COMMIT;');
    console.log(`[ComboMember] Đã thêm ${created} combo Member.`);
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
