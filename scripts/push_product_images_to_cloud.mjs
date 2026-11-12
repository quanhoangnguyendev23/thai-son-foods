// ==============================================================================
// THÁI SƠN FOODS — ĐẨY ẢNH SẢN PHẨM TỪ DB MÁY LOCAL LÊN DB CLOUD (VERCEL)
//
// Trang chi tiết sản phẩm lấy ảnh từ bảng product_images + products.thumbnail trong DB.
// Web trên Vercel dùng DB cloud riêng, nên khi DB cloud còn bộ ảnh cũ thì web hiện ảnh cũ
// dù code đã đúng. Script này chép bộ ảnh (đúng thứ tự) từ DB local sang DB cloud, khớp theo slug.
//
// Cách dùng (PowerShell):
//   $env:TARGET_DATABASE_URL = "<chuỗi DATABASE_URL đang dùng trên Vercel>"
//   node scripts/push_product_images_to_cloud.mjs            # chạy thử: chỉ in ra thay đổi
//   node scripts/push_product_images_to_cloud.mjs --apply    # ghi thật (có sao lưu trước)
//
// Chỉ đụng 2 thứ: products.thumbnail và các dòng product_images của 12 sản phẩm.
// Bản sao lưu ảnh cũ của DB cloud được ghi vào scripts/backups/ trước khi ghi.
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes('--apply');

function readLocalUrl() {
  const envPath = path.join(__dirname, '..', '.env');
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
  return line ? line.slice('DATABASE_URL='.length).replace(/^"|"$/g, '') : null;
}

const sourceUrl = process.env.SOURCE_DATABASE_URL || readLocalUrl();
const targetUrl = process.env.TARGET_DATABASE_URL;

if (!targetUrl) {
  console.error('Thiếu TARGET_DATABASE_URL (chuỗi DATABASE_URL đang dùng trên Vercel).');
  process.exit(1);
}
if (!sourceUrl) {
  console.error('Không đọc được DATABASE_URL của máy local trong .env');
  process.exit(1);
}
if (sourceUrl === targetUrl) {
  console.error('Nguồn và đích trùng nhau, dừng.');
  process.exit(1);
}

const mkPool = (url) =>
  new pg.Pool({ connectionString: url, ssl: url.includes('sslmode=disable') || url.includes('127.0.0.1') ? false : { rejectUnauthorized: false } });

const src = mkPool(sourceUrl);
const dst = mkPool(targetUrl);

async function main() {
  console.log(apply ? '== GHI THẬT ==' : '== CHẠY THỬ (thêm --apply để ghi) ==');

  const srcProducts = (await src.query(`SELECT id, slug, thumbnail FROM products ORDER BY slug`)).rows;
  const srcImages = (
    await src.query(
      `SELECT product_id, url, alt, sort_order, image_type FROM product_images WHERE is_active = true ORDER BY product_id, sort_order`
    )
  ).rows;
  const dstProducts = (await dst.query(`SELECT id, slug, thumbnail FROM products`)).rows;

  const plan = [];
  for (const sp of srcProducts) {
    const dp = dstProducts.find((d) => d.slug === sp.slug);
    if (!dp) {
      console.log(`- Bỏ qua ${sp.slug}: DB cloud không có sản phẩm này`);
      continue;
    }
    const imgs = srcImages.filter((i) => i.product_id === sp.id);
    if (imgs.length === 0) {
      console.log(`- Bỏ qua ${sp.slug}: DB local không có ảnh`);
      continue;
    }
    const current = (
      await dst.query(`SELECT url FROM product_images WHERE product_id = $1 AND is_active = true ORDER BY sort_order`, [dp.id])
    ).rows.map((r) => r.url);
    const next = imgs.map((i) => i.url);
    const same = dp.thumbnail === sp.thumbnail && JSON.stringify(current) === JSON.stringify(next);
    console.log(`\n${sp.slug}${same ? ' (đã đúng, không đổi)' : ''}`);
    if (!same) {
      console.log(`  ảnh đại diện: ${dp.thumbnail}  ->  ${sp.thumbnail}`);
      console.log(`  bộ ảnh cũ:  ${current.join(', ') || '(trống)'}`);
      console.log(`  bộ ảnh mới: ${next.join(', ')}`);
      plan.push({ dstId: dp.id, slug: sp.slug, thumbnail: sp.thumbnail, imgs });
    }
  }

  if (!apply || plan.length === 0) {
    console.log(`\n${plan.length} sản phẩm cần cập nhật.${apply ? '' : ' Chạy lại với --apply để ghi.'}`);
    return;
  }

  // Sao lưu ảnh hiện tại trên DB cloud trước khi ghi
  const backup = {
    products: (await dst.query(`SELECT id, slug, thumbnail FROM products WHERE id = ANY($1)`, [plan.map((p) => p.dstId)])).rows,
    product_images: (await dst.query(`SELECT * FROM product_images WHERE product_id = ANY($1)`, [plan.map((p) => p.dstId)])).rows,
  };
  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `cloud_product_images_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`\nĐã sao lưu ảnh cũ: ${backupFile}`);

  const client = await dst.connect();
  try {
    await client.query('BEGIN');
    for (const p of plan) {
      await client.query(`DELETE FROM product_images WHERE product_id = $1`, [p.dstId]);
      for (const [idx, img] of p.imgs.entries()) {
        const id = `img-${p.dstId}-${idx + 1}`.slice(0, 50);
        await client.query(
          `INSERT INTO product_images (id, product_id, url, alt, sort_order, image_type, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [id, p.dstId, img.url, img.alt, img.sort_order ?? idx + 1, img.image_type || 'gallery']
        );
      }
      await client.query(`UPDATE products SET thumbnail = $1 WHERE id = $2`, [p.thumbnail, p.dstId]);
    }
    await client.query('COMMIT');
    console.log(`Đã cập nhật ${plan.length} sản phẩm trên DB cloud.`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

main()
  .catch((e) => {
    console.error('LỖI:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await src.end();
    await dst.end();
  });
