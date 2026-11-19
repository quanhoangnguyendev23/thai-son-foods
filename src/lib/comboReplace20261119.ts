import crypto from 'node:crypto';
import { pool } from '@/lib/db';
import { SITE_SETTINGS_DDL } from '@/lib/site-settings';
import data from '@/data/combo-replacement-2026-11-19.json';

/**
 * Thay combo MỘT LẦN trên Vercel (DB cloud), chủ dự án cho phép 19/11/2026 ("Cho phép tự thay khi deploy").
 * Cùng dữ liệu và cách làm với scripts/replace_combos_2026-11-19.mjs: 12 combo theo bảng tính giá (STT 1–3, 6–8, 11–13, 16–18),
 * tên tạm "?", ảnh combo-stt-XX.jpg, loại combo; mọi combo khác bị xoá.
 *
 * - CHỈ chạy khi có biến môi trường VERCEL (không bao giờ chạy trên máy nội bộ / server công ty).
 * - Chạy một lần: đánh dấu bằng site_settings 'combo_replace_2026_11_19'; khoá tư vấn để nhiều instance không chạy chồng.
 * - Sao lưu toàn bộ combos / combo_items / combo_images cũ vào site_settings 'combo_backup_2026_11_19' trước khi ghi.
 * - Một giao dịch; thiếu sản phẩm theo SKU hoặc tổng giá web lệch file Excel → không ghi gì, ghi log, lần sau thử lại.
 */
const MARKER_KEY = 'combo_replace_2026_11_19';
const BACKUP_KEY = 'combo_backup_2026_11_19';

type Entry = (typeof data.combos)[number];

let running: Promise<void> | null = null;

export function ensureComboReplacement20261119(): Promise<void> {
  if (!process.env.VERCEL) return Promise.resolve();
  if (!running) {
    running = runReplacement().catch((err) => {
      console.error('[ComboReplace] Lỗi, sẽ thử lại ở lần sau:', err);
      running = null;
    });
  }
  return running;
}

async function runReplacement(): Promise<void> {
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
    const bySku = new Map(prod.map((p: any) => [String(p.sku).toUpperCase(), p]));
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
      console.error('[ComboReplace] Dữ liệu sản phẩm chưa khớp, không thay combo:\n  ' + problems.join('\n  '));
      return;
    }

    const backup = {
      combos: (await client.query(`SELECT * FROM combos;`)).rows,
      combo_items: (await client.query(`SELECT * FROM combo_items;`)).rows,
      combo_images: (await client.query(`SELECT * FROM combo_images;`)).rows,
    };
    await client.query(
      `INSERT INTO site_settings (key, value, updated_by, updated_at) VALUES ($1, $2, 'system', CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;`,
      [BACKUP_KEY, JSON.stringify(backup)]
    );

    const existing = backup.combos as { id: string; slug: string }[];
    const plan = (data.combos as Entry[]).map((c) => ({
      c,
      id: existing.find((e) => e.slug === c.slug || c.oldSlugs.includes(e.slug))?.id || null,
    }));
    const keep = new Set(plan.map((x) => x.id).filter(Boolean));
    let deleted = 0;
    for (const e of existing) {
      if (!keep.has(e.id)) {
        await client.query(`DELETE FROM combos WHERE id = $1;`, [e.id]);
        deleted++;
      }
    }

    let i = 0;
    for (const x of plan) {
      const c = x.c;
      const sale = c.web - c.ntd;
      const discount = Math.round((c.ntd / c.web) * 100);
      const total = Object.values(c.items).reduce((a, b) => a + Number(b), 0);
      let id = x.id;
      if (id) {
        await client.query(
          `UPDATE combos SET slug = $2, name = $3, name_en = NULL, description = $4, description_en = NULL,
                  original_price = $5, sale_price = $6, total_items = $7, discount = $8, image = $9, combo_type = $10,
                  is_active = true, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1;`,
          [id, c.slug, c.name, c.description, c.web, sale, total, discount, c.image, c.type]
        );
        await client.query(`DELETE FROM combo_items WHERE combo_id = $1;`, [id]);
      } else {
        id = `combo_${Date.now()}${i}`;
        await client.query(
          `INSERT INTO combos (id, slug, name, description, original_price, sale_price, total_items, discount, image, combo_type,
                               is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, CURRENT_TIMESTAMP + ($11 || ' seconds')::interval, CURRENT_TIMESTAMP);`,
          [id, c.slug, c.name, c.description, c.web, sale, total, discount, c.image, c.type, String(i)]
        );
      }
      for (const [sku, q] of Object.entries(c.items)) {
        await client.query(`INSERT INTO combo_items (id, combo_id, product_id, quantity, unit) VALUES ($1, $2, $3, $4, 'chai');`, [
          `ci_${crypto.randomBytes(6).toString('hex')}`,
          id,
          (bySku.get(sku) as any).id,
          Number(q),
        ]);
      }
      i++;
    }

    await client.query(
      `INSERT INTO site_settings (key, value, updated_by, updated_at) VALUES ($1, $2, 'system', CURRENT_TIMESTAMP);`,
      [MARKER_KEY, JSON.stringify({ at: new Date().toISOString(), updated: plan.filter((x) => x.id).length, created: plan.filter((x) => !x.id).length, deleted })]
    );
    await client.query('COMMIT;');
    console.log(`[ComboReplace] Đã thay combo: ${plan.length} combo, xoá ${deleted} combo cũ (sao lưu ở site_settings '${BACKUP_KEY}').`);
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
