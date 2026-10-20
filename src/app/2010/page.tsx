import type { Metadata, Viewport } from 'next';
import Story2010 from './Story2010';

// Trang quà tặng riêng: không lập chỉ mục, tiêu đề trung tính (không dùng mẫu tiêu đề của cửa hàng)
export const metadata: Metadata = {
  title: { absolute: 'Một món quà nhỏ' },
  description: 'Một câu chuyện nhỏ gửi tặng bạn.',
  robots: { index: false, follow: false },
  keywords: [],
  // Bản xem trước khi chia sẻ link: trung tính, không mang tên cửa hàng
  openGraph: {
    title: 'Một món quà nhỏ',
    description: 'Một câu chuyện nhỏ gửi tặng bạn.',
    type: 'website',
    locale: 'vi_VN',
  },
  twitter: { card: 'summary', title: 'Một món quà nhỏ', description: 'Một câu chuyện nhỏ gửi tặng bạn.' },
};

// Mobile-first: khóa zoom, dùng toàn màn hình kể cả vùng tai thỏ (safe-area)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0d0509',
};

export default function Page() {
  return <Story2010 />;
}
