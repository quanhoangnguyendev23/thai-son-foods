'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MEMBERSHIP_CONFIG } from '@/config/membership';
import { Star, Info, ShoppingBag } from 'lucide-react';
import { products } from '@/data/products';
import { Product } from '@/types';
import { getPackLabel, useRandomSponsoredProduct } from '@/lib/sponsored-products';
import { useCartStore } from '@/store/cart';
import { useFlyToCart } from '@/context/FlyToCartContext';

interface ProductSidebarSponsoredCardProps {
  currentProductId?: string;
  className?: string;
  /** Ẩn số liệu chưa xác thực (sao/lượt đánh giá mẫu, prime, -15%, giá gốc ước tính). Mặc định giữ hành vi cũ. */
  hideUnverifiedStats?: boolean;
  /** Chọn ngẫu nhiên sản phẩm khác mỗi lần mở trang (giao diện mới). Mặc định giữ hành vi cũ. */
  randomize?: boolean;
}

/**
 * Trả về tên ngắn gọn, chuẩn nhận diện cho sản phẩm hiển thị trên card
 */
function getCleanProductName(product: Product): string {
  if (product.slug?.includes('sua-bap-nep')) return 'Sữa Bắp Nếp Tươi Thái Sơn';
  if (product.slug?.includes('sua-hat-sen-mekong')) return 'Sữa Hạt Sen Mekong Xanh';
  if (product.slug?.includes('sua-gao-lut-mekong')) return 'Sữa Gạo Lứt Mekong Xanh';
  if (product.slug?.includes('sua-hat-sen-lotus')) return 'Sữa Hạt Sen Lotus Yoo';
  if (product.slug?.includes('nha-dam-mu-trom')) return 'Nha Đam Mủ Trôm Thái Sơn';
  if (product.slug?.includes('tao-do-hat-chia')) return 'Táo Đỏ Hạt Chia Thái Sơn';
  if (product.slug?.includes('sam-la-han')) return 'Sâm La Hán Hoa Cúc Thái Sơn';
  if (product.slug?.includes('tra-sua-truyen-thong')) return 'Trà Sữa Ciao Truyền Thống';
  if (product.slug?.includes('tra-sua-matcha')) return 'Trà Sữa Ciao Matcha';

  const firstPart = product.name.split(',')[0].trim();
  return firstPart.length > 35 ? firstPart.slice(0, 32) + '...' : firstPart;
}

export default function ProductSidebarSponsoredCard({
  currentProductId,
  className = '',
  hideUnverifiedStats = false,
  randomize = false,
}: ProductSidebarSponsoredCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const { flyToCart } = useFlyToCart();
  const randomProduct = useRandomSponsoredProduct(currentProductId, 1, randomize);

  // Chọn sản phẩm Best Seller hoặc Đang Sale khác với sản phẩm hiện tại
  const candidateProducts = products.filter((p) => p.id !== currentProductId && p.isActive);

  // Ưu tiên sản phẩm Bestseller hoặc có ưu đãi tốt
  const fixedProduct: Product =
    candidateProducts.find((p) => p.id === 'sua-bap-nep' || p.slug === 'sua-bap-nep-thai-son') ||
    candidateProducts.find((p) => p.id === 'sua-hat-sen-mekong' || p.slug === 'sua-hat-sen-mekong-xanh') ||
    candidateProducts.find((p) => p.isBestSeller) ||
    candidateProducts[0] ||
    products[0];
  const recommendedProduct: Product = randomProduct || fixedProduct;
  const waitingRandom = randomize && !randomProduct;

  if (!recommendedProduct) return null;

  // Lấy giá lốc (nếu có variant) hoặc giá cơ bản
  const defaultPackVariant = recommendedProduct.variants?.find((v) => v.quantity === 7) || recommendedProduct.variants?.[0];
  const price = defaultPackVariant ? defaultPackVariant.price : recommendedProduct.price * 7;
  const originalPrice = recommendedProduct.originalPrice
    ? (defaultPackVariant ? Math.round(recommendedProduct.originalPrice * (defaultPackVariant.quantity || 7)) : Math.round(recommendedProduct.originalPrice * 7))
    : hideUnverifiedStats ? 0 : Math.round(price * 1.35);

  const cleanName = getCleanProductName(recommendedProduct);
  const packUnit = getPackLabel(recommendedProduct, defaultPackVariant);
  const productLink = `/san-pham/${recommendedProduct.slug}`;
  const thumbnail = recommendedProduct.thumbnail || '/images/products/1200x900-sb1.jpg';

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    flyToCart({
      startElement: e.currentTarget,
      imageSrc: thumbnail,
    });

    const variantId = defaultPackVariant?.id || 'default-7chai';
    const variantName = defaultPackVariant?.name || '7 chai';

    addItem({
      productId: `${recommendedProduct.id}-${variantId}`,
      name: `${cleanName} (${variantName})`,
      slug: recommendedProduct.slug,
      price,
      unit: packUnit,
      thumbnail,
      variantId,
      variantName,
    });
  };

  return (
    <div className={`w-full space-y-3 sm:space-y-3.5 ${className}`}>
      {/* ── Box Prime Hội Viên (Ảnh 1): Hiển thị ở trên mục gợi ý sản phẩm tài trợ ("trên mục này") ── */}
      {MEMBERSHIP_CONFIG.ENABLE_MEMBERSHIP && (
        <div className="relative bg-white rounded-lg border border-gray-200/90 p-3.5 sm:p-4 shadow-[0_1px_4px_rgba(34,84,76,0.03)] hover:shadow-[0_3px_12px_rgba(34,84,76,0.07)] transition-all duration-300">
          {/* Logo Thương Hiệu Thái Sơn (thay thế cho logo Prime) */}
          <Link href="/member" className="inline-block group mb-2.5">
            <div className="relative w-28 h-8 sm:w-32 sm:h-9">
              <Image
                src="/images/logo-clean-1000.png"
                alt="Thái Sơn Foods"
                fill
                sizes="130px"
                className="object-contain object-left transition-transform duration-300"
              />
            </div>
          </Link>

          {/* Nội dung giới thiệu dịch vụ hội viên */}
          <p className="text-xs sm:text-[13px] text-gray-900 leading-relaxed font-normal">
            Tận hưởng dịch vụ giao hàng nhanh chóng, miễn phí, ưu đãi độc quyền và các đặc quyền dinh dưỡng dành riêng cho hội viên.
          </p>
        </div>
      )}

      {/* ── Box quảng cáo gợi ý chuẩn Amazon Sponsored Product Card ── */}
      <div className={waitingRandom ? 'invisible' : undefined}>
        <div className="relative bg-white rounded-lg border border-gray-200/90 p-3.5 sm:p-4 shadow-[0_1px_4px_rgba(34,84,76,0.03)] hover:shadow-[0_3px_12px_rgba(34,84,76,0.07)] transition-all duration-300">
          <Link href={productLink} className="block group">
            {/* HÀNG TRÊN: Logo thương hiệu bên trái + Mini banner/ảnh sản phẩm bên phải */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
              {/* Logo Thương Hiệu */}
              <div className="relative w-24 h-9 sm:w-28 sm:h-10 shrink-0">
                <Image
                  src="/images/logo-clean-1000.png"
                  alt="Thái Sơn Foods"
                  fill
                  sizes="120px"
                  className="object-contain object-left transition-transform duration-300"
                />
              </div>

              {/* Mini Product / Lifestyle Banner bên phải: tỉ lệ 4:3 khớp ảnh chuẩn 1200x900 */}
              <div className="relative w-24 sm:w-28 aspect-[4/3] rounded-md overflow-hidden bg-white border border-gray-100 shrink-0">
                <Image
                  src={thumbnail}
                  alt={cleanName}
                  fill
                  sizes="120px"
                  className="object-contain p-0.5 transition-transform duration-300"
                />
              </div>
            </div>

            {/* PHẦN GIỮA: Thông tin sản phẩm chính thức & Thông tin đánh giá */}
            <div className="pt-2">
              {/* Tag định danh Bán chạy nhất */}
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] px-1.5 py-0.5 rounded tracking-tight uppercase">
                  Bán chạy nhất
                </span>
                <span className="text-[11px] text-gray-500 font-medium">
                  100% Tự nhiên
                </span>
              </div>

              {/* Tên sản phẩm chuẩn xác, gọn gàng */}
              <h4
                className="text-sm sm:text-[15px] text-gray-900 group-hover:text-forest-700 transition-colors leading-snug line-clamp-2"
                title={`${cleanName} (${packUnit})`}
              >
                {cleanName} ({packUnit})
              </h4>

              {/* Hàng Đánh Giá Sao Chuẩn Amazon */}
              {!hideUnverifiedStats && (
              <div className="flex items-center gap-1 text-xs mt-1.5 flex-wrap">
                <span className="text-gray-900 text-sm">4.8</span>
                <div className="flex items-center text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-500 stroke-amber-500" />
                  ))}
                </div>
                <span className="text-[11px] text-forest-700 font-medium ml-0.5">
                  548
                </span>
              </div>
              )}

              {/* Hàng Giá & Huy hiệu Prime / Nút Thêm vào giỏ hàng */}
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                <span className="text-base sm:text-lg text-gray-900 leading-none">
                  {price.toLocaleString('vi-VN')}₫
                </span>
                {originalPrice > price && (
                  <span className="text-xs text-gray-400 line-through">
                    {originalPrice.toLocaleString('vi-VN')}₫
                  </span>
                )}
                {/* Huy hiệu Prime chuẩn Amazon */}
                {!hideUnverifiedStats && MEMBERSHIP_CONFIG.ENABLE_MEMBERSHIP && (
                <span className="inline-flex items-center text-forest-700 text-sm italic tracking-tighter">
                  <span className="text-forest-700 mr-0.5 not-italic text-[1.125em]">✓</span>
                  <span className="text-forest-700 not-italic text-[12px] font-sans">prime</span>
                </span>
                )}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="ml-auto relative shrink-0 w-8 h-8 flex items-center justify-center bg-leaf-900 text-white rounded-lg hover:bg-forest-700 transition-colors active:scale-95 cursor-pointer shadow-xs"
                  aria-label={`Thêm ${cleanName} (${packUnit}) vào giỏ hàng`}
                  title={`Thêm ${cleanName} (${packUnit}) vào giỏ hàng`}
                >
                  <ShoppingBag className="w-4 h-4" />
                </button>
              </div>

              {/* Huy hiệu Ưu đãi / Subscribe & Save chuẩn Ahorra con Planea y ahorra */}
              {!hideUnverifiedStats && (
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span className="bg-crimson-600 text-white text-[11px] px-1.5 py-0.5 rounded-xs tracking-tight uppercase">
                  Tiết kiệm 15%
                </span>
                <span className="text-[11px] text-gray-700 font-medium">
                  khi Đăng ký định kỳ
                </span>
              </div>
              )}
            </div>
          </Link>
        </div>

        {/* Dòng ghi chú Patrocinado / Được tài trợ góc dưới bên phải */}
        <div className="flex items-center justify-end gap-1 mt-1 pr-1 text-[11px] text-gray-400 select-none">
          <span>Được tài trợ</span>
          <Info className="w-3 h-3 text-gray-400" />
        </div>
      </div>
    </div>
  );
}
