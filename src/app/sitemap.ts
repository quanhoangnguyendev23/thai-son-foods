import type { MetadataRoute } from 'next';
import { products } from '@/data/products';
import { combos } from '@/data/combos';
import { ENABLE_COMBOS, FEATURES } from '@/config/features';
import { query } from '@/lib/db';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://shop.thaisonfoods.vn').replace(/\/$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    // /doi-tac chỉ có khi bật Chương trình Đối tác (đang tắt → middleware chuyển về trang chủ)
    ...(FEATURES.PARTNER_PROGRAM ? [{ url: `${SITE_URL}/doi-tac`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5 }] : []),
  ];

  const productPages: MetadataRoute.Sitemap = products
    .filter((p) => p.isActive !== false && p.slug)
    .map((p) => ({
      url: `${SITE_URL}/san-pham/${p.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    }));

  // Chỉ đưa combo ĐANG BÁN trong DB (is_active); DB lỗi thì dùng dữ liệu tĩnh
  let comboSlugs: string[] = combos.filter((c) => c.isActive !== false && c.slug).map((c) => c.slug);
  try {
    const res = await query(`SELECT slug FROM combos WHERE is_active = true AND slug IS NOT NULL;`);
    comboSlugs = res.rows.map((r: { slug: string }) => r.slug);
  } catch {
    // giữ danh sách tĩnh
  }
  const comboPages: MetadataRoute.Sitemap = comboSlugs
    .filter(() => ENABLE_COMBOS)
    .map((slug) => ({
      url: `${SITE_URL}/combo/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

  return [...staticPages, ...productPages, ...comboPages];
}
