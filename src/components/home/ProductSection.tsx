'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { products } from '@/data/products';
import ProductCard from '@/components/product/ProductCard';
import SectionTitle from '@/components/ui/SectionTitle';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { safeFetchJson } from '@/lib/utils';

import { Product } from '@/types';

interface ProductSectionProps {
  title?: string;
  viewAllLink?: string;
  viewAllText?: string;
  showViewAll?: boolean;
  excludeProductId?: string;
  itemsPerRow?: number;
  className?: string;
  products?: Product[];
}

export default function ProductSection({
  title = 'Sản phẩm Thái Sơn',
  viewAllLink,
  viewAllText = 'Xem tất cả',
  showViewAll = false,
  excludeProductId,
  itemsPerRow,
  className = '',
  products: initialProducts,
}: ProductSectionProps = {}) {
  const { language } = useLanguage();
  const sectionTitle = title === 'Sản phẩm Thái Sơn'
    ? (language === 'en' ? 'Thai Son Products' : 'Sản phẩm Thái Sơn')
    : title === 'Những sản phẩm khác bạn có thể quan tâm'
    ? (language === 'en' ? 'Other products you may like' : 'Những sản phẩm khác bạn có thể quan tâm')
    : title === 'Sản phẩm gợi ý' || title === 'Các sản phẩm nổi bật đáng cân nhắc' || title === 'Các sản phẩm bạn có thể thích'
    ? (language === 'en' ? 'Products you may like' : 'Các sản phẩm bạn có thể thích')
    : title;
  const sectionViewAllText = viewAllText === 'Xem tất cả'
    ? (language === 'en' ? 'View all' : 'Xem tất cả')
    : viewAllText;

  const [productList, setProductList] = useState<Product[]>(initialProducts || products);

  useEffect(() => {
    if (initialProducts) {
      setProductList(initialProducts);
      return;
    }
    let active = true;
    safeFetchJson<{ success: boolean; data: Product[] }>('/api/products').then((data) => {
      if (!active || !data) return;
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        setProductList(data.data);
      }
    });
    return () => {
      active = false;
    };
  }, [initialProducts]);

  const sliderRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    if (!sliderRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  useEffect(() => {
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(checkScroll, 300);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [checkScroll]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!sliderRef.current) return;
    const container = sliderRef.current;
    const scrollAmount = Math.max(container.clientWidth * 0.65, 320);
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Chế độ Slider / Carousel 7 sản phẩm 1 hàng (trang chi tiết sản phẩm)
  if (excludeProductId || itemsPerRow === 7) {
    const currentProduct = productList.find(
      (p) => p.id === excludeProductId || p.slug === excludeProductId
    );

    // Lọc bỏ sản phẩm hiện tại để không bị trùng lặp
    const availableProducts = productList.filter(
      (p) => p.id !== excludeProductId && p.slug !== excludeProductId && p.isActive
    );

    // Ưu tiên sản phẩm cùng danh mục lên trước, tiếp đến các sản phẩm khác
    const sortedProducts = currentProduct
      ? [
          ...availableProducts.filter((p) => p.categoryId === currentProduct.categoryId),
          ...availableProducts.filter((p) => p.categoryId !== currentProduct.categoryId),
        ]
      : availableProducts;

    return (
      <section id="san-pham" className={`section-container max-sm:px-2.5 py-8 sm:py-10 md:py-16 ${className}`}>
        <SectionTitle
          title={sectionTitle}
          viewAllLink={showViewAll ? viewAllLink : undefined}
          viewAllText={sectionViewAllText}
          className="mb-4 sm:mb-6 md:mb-8"
        />

        {/* Khung slider sản phẩm với nút mũi tên lướt */}
        <div className="relative w-full group">
          {/* Mũi tên lướt sang trái */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => handleScroll('left')}
              className="absolute -left-2 sm:-left-3.5 md:-left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-md border border-gray-200/90 flex items-center justify-center text-gray-700 hover:text-white hover:bg-green-primary transition-all duration-200 cursor-pointer active:scale-90"
              aria-label={language === 'en' ? 'Previous products' : 'Lướt sang trái xem sản phẩm trước'}
              title={language === 'en' ? 'Previous products' : 'Xem sản phẩm trước'}
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </button>
          )}

          {/* Danh sách sản phẩm cuộn ngang (7 sản phẩm 1 hàng trên desktop) */}
          <div
            ref={sliderRef}
            onScroll={checkScroll}
            className="flex gap-2 sm:gap-3 lg:gap-3.5 overflow-x-auto scroll-smooth scrollbar-none py-2 px-0.5 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {sortedProducts.map((product) => (
              <div
                key={product.id}
                className="shrink-0 snap-start w-[calc((100%-8px)/2)] sm:w-[calc((100%-16px)/3)] md:w-[calc((100%-36px)/4)] lg:w-[calc((100%-72px)/7)] self-stretch flex flex-col"
              >
                <ProductCard
                  product={product}
                  layout="compact"
                />
              </div>
            ))}
          </div>

          {/* Mũi tên lướt sang phải (vị trí người dùng khoanh đỏ) */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => handleScroll('right')}
              className="absolute -right-2 sm:-right-3.5 md:-right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-md border border-gray-200/90 flex items-center justify-center text-gray-700 hover:text-white hover:bg-green-primary transition-all duration-200 cursor-pointer active:scale-90"
              aria-label={language === 'en' ? 'Next products' : 'Lướt sang phải xem thêm sản phẩm'}
              title={language === 'en' ? 'Next products' : 'Xem thêm sản phẩm'}
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </button>
          )}
        </div>
      </section>
    );
  }

  // Bố cục mặc định cho Trang chủ: 2 hàng, mỗi hàng 6 mã sản phẩm (lọc chỉ hiển thị sản phẩm đang hoạt động)
  const activeProducts = productList.filter((p) => p.isActive);
  const rows = [
    { id: 'row-1', items: activeProducts.slice(0, 6) },
    { id: 'row-2', items: activeProducts.slice(6, 12) },
  ];

  return (
    <section id="san-pham" className={`section-container max-sm:px-2.5 pt-2 sm:pt-3 md:pt-4 pb-3 sm:pb-4 md:pb-6 ${className}`}>
      <SectionTitle
        title={sectionTitle}
        viewAllLink={showViewAll ? viewAllLink : undefined}
        viewAllText={sectionViewAllText}
        variant="default"
        className="mb-4 sm:mb-5 md:mb-6"
      />

      <div className="space-y-3 sm:space-y-4 md:space-y-5 lg:space-y-6 w-full">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-3.5 lg:gap-4 w-full"
          >
            {row.items.map((product, pIdx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{
                  duration: 0.4,
                  ease: 'easeOut',
                  delay: pIdx * 0.04,
                }}
                className="h-full"
              >
                <ProductCard
                  product={product}
                  layout="compact"
                  isHomepage={true}
                />
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
