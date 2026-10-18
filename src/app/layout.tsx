import type { Metadata } from 'next';
import { Fira_Sans, Roboto, Playfair_Display } from 'next/font/google';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import LogoPreloader from '@/components/layout/LogoPreloader';
import AppLayout from '@/components/layout/AppLayout';

const firaSans = Fira_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-fira-sans',
  display: 'swap',
});

const roboto = Roboto({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  style: ['italic', 'normal'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://shop.thaisonfoods.vn'),
  title: {
    default: 'Thái Sơn Foods — Thức uống tự nhiên từ nguyên liệu chọn lọc',
    template: '%s | Thái Sơn Foods',
  },
  description:
    'Thái Sơn Foods chuyên cung cấp các sản phẩm đồ uống tự nhiên: Sữa Bắp Nếp, Sữa Hạt Sen, Trà Sữa, Nước Giải Khát. Nguyên liệu chọn lọc, an toàn cho sức khỏe.',
  keywords: [
    'Thái Sơn Foods',
    'sữa bắp nếp',
    'sữa hạt sen',
    'đồ uống tự nhiên',
    'nước giải khát',
    'thức uống Việt Nam',
  ],
  openGraph: {
    title: 'Thái Sơn Foods — Thức uống tự nhiên',
    description:
      'Sữa Bắp Nếp, Sữa Hạt Sen, Trà Sữa và nhiều hơn nữa. Đặt hàng online, giao tận nơi.',
    url: 'https://shop.thaisonfoods.vn',
    siteName: 'Thái Sơn Foods',
    locale: 'vi_VN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" data-scroll-behavior="smooth" className={`${firaSans.variable} ${roboto.variable} ${playfair.variable}`}>
      <body
        className="font-body antialiased bg-ivory text-text-dark"
        style={{ fontFamily: 'var(--font-roboto), sans-serif' }}
      >
        {/* Bộ lọc nâng điểm đen của video thành xanh rêu thương hiệu (áp bằng CSS: video { filter: url(#brand-black-lift) }) */}
        <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: 'absolute' }}>
          <filter id="brand-black-lift" colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="linear" slope="0.9059" intercept="0.0941" />
              <feFuncG type="linear" slope="0.7333" intercept="0.2667" />
              <feFuncB type="linear" slope="0.7569" intercept="0.2431" />
            </feComponentTransfer>
          </filter>
        </svg>
        <LogoPreloader />
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
