import type { MetadataRoute } from 'next';
import { products } from '@/data/products';
import { combos } from '@/data/combos';
import { ENABLE_COMBOS, FEATURES } from '@/config/features';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://shop.thaisonfoods.vn').replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    ...(ENABLE_COMBOS ? [{ url: `${SITE_URL}/combo`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 }] : []),
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

  const comboPages: MetadataRoute.Sitemap = combos
    .filter((c) => ENABLE_COMBOS && c.isActive !== false && c.slug)
    .map((c) => ({
      url: `${SITE_URL}/combo/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

  return [...staticPages, ...productPages, ...comboPages];
}
