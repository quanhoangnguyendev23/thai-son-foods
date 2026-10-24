'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Info } from 'lucide-react';
import { Product } from '@/types';
import { getPackLabel, useRandomSponsoredProduct } from '@/lib/sponsored-products';

interface ProductSponsoredBannerProps {
  product?: Product;
  className?: string;
  /** Ẩn số liệu chưa xác thực (sao/lượt đánh giá mẫu, prime, -15%, giá gốc ước tính). Mặc định giữ hành vi cũ. */
  hideUnverifiedStats?: boolean;
  /** Chọn ngẫu nhiên một sản phẩm KHÁC sản phẩm đang xem mỗi lần mở trang (giao diện mới). Mặc định giữ hành vi cũ. */
  randomize?: boolean;
}

export default function ProductSponsoredBanner({
  product: currentProduct,
  className = '',
  hideUnverifiedStats = false,
  randomize = false,
}: ProductSponsoredBannerProps) {
  const randomProduct = useRandomSponsoredProduct(currentProduct?.id, 2, randomize);
  const product = randomize ? randomProduct || undefined : currentProduct;
  const waitingRandom = randomize && !randomProduct;
  // Lấy giá lốc hoặc mặc định tương ứng với sản phẩm
  const defaultPackVariant = product?.variants?.find((v) => v.quantity === 7) || product?.variants?.[0];
  const price = defaultPackVariant ? defaultPackVariant.price : (product?.price ? product.price * 7 : 126000);
  const originalPrice = product?.originalPrice 
    ? (defaultPackVariant ? Math.round(product.originalPrice * (defaultPackVariant.quantity || 7)) : Math.round(product.originalPrice * 7))
    : hideUnverifiedStats ? 0 : Math.round(price * 1.35);

  const displayTitle = product?.name
    ? `${product.name.replace(/,.*$/, '')} (${getPackLabel(product, defaultPackVariant)})`
    : 'Sữa Bắp Nếp Tươi Thái Sơn (Lốc 7 chai 330ml)';

  const productImg = product?.thumbnail || '/images/products/1200x900-sb1.jpg';
  const productLink = product?.slug ? `/san-pham/${product.slug}` : '/san-pham/sua-bap-nep-thai-son';

  return (
    <section className={`w-full py-4 sm:py-6 ${waitingRandom ? 'invisible' : ''} ${className}`}>
      {/* ── Khung Banner Chính Chuẩn Amazon Sponsored Brand Showcase ── */}
      <div className="relative bg-white rounded-xl sm:rounded-2xl border border-gray-200/90 shadow-[0_1px_6px_rgba(34,84,76,0.03)] overflow-hidden transition-all duration-300">
        <div className="flex flex-col md:flex-row items-stretch md:h-[220px] lg:h-[230px]">
          
          {/* CỘT 1 (Trái): Logo thương hiệu & Tagline (Refréscate • Recupérate • Revive style) */}
          <div className="w-full md:w-[22%] lg:w-[22%] p-5 sm:p-6 flex flex-col items-center justify-center text-center bg-white border-b md:border-b-0 md:border-r border-gray-100 shrink-0">
            <Link
              href="/#san-pham"
              className="group flex flex-col items-center justify-center transition-transform duration-300"
            >
              <div className="relative w-32 h-12 sm:w-36 sm:h-14 flex items-center justify-center">
                <Image
                  src="/images/logo-clean-1000.png"
                  alt="Thái Sơn Foods"
                  fill
                  sizes="160px"
                  className="object-contain"
                  priority
                />
              </div>

              {/* Tagline thương hiệu chuẩn Monster / Amazon */}
              <div className="mt-2.5 text-center">
                <p className="text-[13px] sm:text-[15px] text-gray-800 tracking-tight leading-snug">
                  Thanh Mát <span className="text-forest-700 mx-0.5 text-[1.125em]">•</span> Tự Nhiên <span className="text-forest-700 mx-0.5 text-[1.125em]">•</span> Dinh Dưỡng
                </p>
                <span className="inline-block mt-0.5 text-[11px] text-gray-400 font-medium tracking-tight">
                  100% Nông Sản Việt Tươi Sạch
                </span>
              </div>
            </Link>
          </div>

          {/* CỘT 2 (Giữa): Hình ảnh Lifestyle người dùng thưởng thức thức uống ngoài trời */}
          <Link
            href={productLink}
            className="w-full md:w-[48%] lg:w-[48%] relative min-h-[190px] sm:min-h-[210px] md:min-h-0 bg-gray-900 overflow-hidden group block"
          >
            <Image
              src="/images/banners/lifestyle-thaison-drink-v2.jpg"
              alt="Thưởng thức nước uống dinh dưỡng Thái Sơn Foods tươi ngon mát lành"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover object-center transition-transform duration-700 ease-out"
              priority
            />
            {/* Lớp gradient nhẹ phủ chân ảnh tạo chiều sâu */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/20 via-transparent to-transparent pointer-events-none" />
            
            {/* Tagline thương hiệu nhỏ tinh tế */}
            <div className="absolute bottom-2.5 left-3 px-2.5 py-0.5 rounded bg-ink-950/40 backdrop-blur-xs text-white text-[11px] font-medium tracking-wide">
              Uống một bữa ăn ngon lành
            </div>
          </Link>

          {/* CỘT 3 (Phải): Mini Buy-Box / Thông tin sản phẩm & Ưu đãi Subscribe & Save */}
          <Link
            href={productLink}
            className="w-full md:w-[30%] lg:w-[30%] p-4 sm:p-5 flex flex-col justify-center bg-white border-t md:border-t-0 md:border-l border-gray-100 group transition-colors hover:bg-gray-50/50"
          >
            {/* Ảnh sản phẩm / Lốc đóng gói */}
            <div className="relative w-full h-20 sm:h-22 mb-1.5 flex items-center justify-center">
              <Image
                src={productImg}
                alt={displayTitle}
                fill
                sizes="160px"
                className="object-contain transition-transform duration-300"
              />
            </div>

            {/* Tên sản phẩm */}
            <div
              className="text-sm sm:text-[15px] text-gray-900 line-clamp-1 group-hover:text-forest-700 transition-colors leading-tight mb-1"
              title={displayTitle}
            >
              {displayTitle}
            </div>

            {/* Hàng Đánh Giá Sao Chuẩn Amazon */}
            {!hideUnverifiedStats && (
            <div className="flex items-center gap-1 text-xs mb-1 flex-wrap">
              <span className="text-gray-900 text-sm">4.8</span>
              <div className="flex items-center text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-500 stroke-amber-500" />
                ))}
              </div>
              <span className="text-xs text-forest-700 font-medium ml-0.5">
                (409)
              </span>
            </div>
            )}

            {/* Hàng Giá & Huy hiệu Prime */}
            <div className="flex items-baseline gap-2 flex-wrap mb-1">
              <span className="text-lg sm:text-xl text-gray-900 leading-none">
                {price.toLocaleString('vi-VN')}₫
              </span>
              {originalPrice > price && (
                <span className="text-xs text-gray-400 line-through">
                  {originalPrice.toLocaleString('vi-VN')}₫
                </span>
              )}
              {/* Huy hiệu Prime chuẩn Amazon */}
              {!hideUnverifiedStats && (
              <span className="inline-flex items-center text-forest-700 text-sm italic tracking-tighter ml-auto">
                <span className="text-forest-700 mr-0.5 not-italic text-[1.125em]">✓</span>
                <span className="text-forest-700 not-italic text-[13px] font-sans">prime</span>
              </span>
              )}
            </div>

            {/* Huy hiệu Tiết kiệm 15% khi Đăng ký định kỳ (Chuẩn Ahorra 5% con Planea y ahorra) */}
            {!hideUnverifiedStats && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-crimson-600 text-white text-[11px] px-1.5 py-0.5 rounded-xs tracking-tight uppercase">
                Tiết kiệm 15%
              </span>
              <span className="text-[11px] sm:text-xs text-gray-700 font-medium">
                khi Đăng ký định kỳ
              </span>
            </div>
            )}
          </Link>
        </div>
      </div>

      {/* Dòng ghi chú Patrocinado / Được tài trợ góc dưới bên phải */}
      <div className="flex items-center justify-end gap-1 mt-1 pr-1 text-[11px] text-gray-400 select-none">
        <span>Được tài trợ</span>
        <Info className="w-3 h-3 text-gray-400" />
      </div>
    </section>
  );
}
