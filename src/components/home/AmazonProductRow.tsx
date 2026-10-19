'use client';

import { Product } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import ProductCarousel from '@/components/product/ProductCarousel';

interface AmazonProductRowProps {
  id?: string;
  titleVi: string;
  titleEn: string;
  subtitleVi?: string;
  subtitleEn?: string;
  products: Product[];
  action?: React.ReactNode;
}

/**
 * Hàng carousel sản phẩm trong panel trắng (bố cục Amazon).
 * Tái sử dụng ProductCarousel + ProductCard (giá thật, nút thêm giỏ dùng store giỏ hàng hiện có).
 */
export default function AmazonProductRow({
  id,
  titleVi,
  titleEn,
  subtitleVi,
  subtitleEn,
  products,
  action,
}: AmazonProductRowProps) {
  const { language } = useLanguage();
  if (products.length === 0) return null;

  const isEn = language === 'en';
  return (
    <div id={id} className="bg-white rounded-2xl border border-border shadow-xs scroll-mt-[130px]">
      <ProductCarousel
        title={isEn ? titleEn : titleVi}
        subtitle={isEn ? subtitleEn : subtitleVi}
        products={products}
        action={action}
        mobileGrid
      />
    </div>
  );
}
