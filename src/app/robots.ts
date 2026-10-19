import type { MetadataRoute } from 'next';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://shop.thaisonfoods.vn').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/gio-hang', '/thanh-toan', '/tai-khoan', '/test-email'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
