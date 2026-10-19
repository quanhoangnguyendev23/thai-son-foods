import type { NextConfig } from "next";

// Bí mật (JWT_SECRET, ADMIN_REGISTER_KEY, CRON_SECRET, DATABASE_URL, SMTP_*) chỉ được cấu hình qua biến môi trường.
// KHÔNG đặt giá trị mặc định trong mã nguồn.

const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.google.com https://maps.google.com https://sp.zalo.me https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://images.unsplash.com https://shop.thaisonfoods.vn https://*.public.blob.vercel-storage.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://lh3.googleusercontent.com https://api.qrserver.com https://*.google.com https://*.googleusercontent.com",
  "connect-src 'self' https://maps.googleapis.com https://api.resend.com https://oauth2.googleapis.com https://graph.facebook.com",
  "frame-src 'self' https://www.google.com https://maps.google.com https://www.youtube.com https://sp.zalo.me",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Cho phép build kiểm tra song song với dev server (NEXT_DIST_DIR=.next-build)
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Allow internal LAN IP access without cross-origin blocking
  allowedDevOrigins: [
    '137.107.16.94:3000',
    '137.107.16.94',
    '137.107.16.62:3000',
    '137.107.16.62',
    'localhost:3000',
    '127.0.0.1:3000',
  ],
  images: {
    // Ảnh bị nén quá tay (mặc định 75) làm chữ trên nhãn chai mờ; nâng lên 90.
    // Next 16 quy giá trị quality về mục gần nhất trong danh sách này.
    // 91 (thay vì 90) để bỏ qua cache ảnh cũ trong .next/dev/cache/images (khóa cache gồm quality).
    qualities: [91],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'shop.thaisonfoods.vn',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  async headers() {
    const securityHeaders = [
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(self)',
      },
      {
        key: 'Content-Security-Policy-Report-Only',
        value: cspReportOnly,
      },
    ];

    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains',
      });
    }

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/uploads/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/dang-nhap',
        destination: '/?auth=login',
        permanent: true,
      },
      {
        source: '/dang-ky',
        destination: '/?auth=register',
        permanent: true,
      },
      {
        source: '/member',
        destination: '/',
        permanent: false,
      },
      {
        source: '/tai-khoan/dinh-ky',
        destination: '/',
        permanent: false,
      },
      {
        source: '/dai-ly',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

