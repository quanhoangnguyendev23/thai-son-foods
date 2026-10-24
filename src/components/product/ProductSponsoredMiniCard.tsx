'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Info } from 'lucide-react';
import { products } from '@/data/products';
import { Product } from '@/types';
import { getPackLabel, useRandomSponsoredProduct } from '@/lib/sponsored-products';

interface ProductSponsoredMiniCardProps {
  currentProductId?: string;
  className?: string;
  /** Ẩn số liệu chưa xác thực (sao/lượt đánh giá mẫu, prime). Mặc định giữ hành vi cũ. */
  hideUnverifiedStats?: boolean;
  /** Chọn ngẫu nhiên sản phẩm khác mỗi lần mở trang (giao diện mới). Mặc định giữ hành vi cũ. */
  randomize?: boolean;
}

function getProductSubtitle(product: Product): string {
  if (product.slug?.includes('sua-bap-nep')) {
    return 'Sữa Bắp Nếp Tươi Thái Sơn (Lốc 7 chai 330ml) | Bắp nếp tươi nguyên chất, sánh béo tự nhiên';
  }
  if (product.slug?.includes('sua-hat-sen-mekong')) {
    return 'Sữa Hạt Sen Mekong Xanh (Lốc 7 chai 330ml) | Hạt sen tươi & đậu xanh thanh mát, giàu dinh dưỡng';
  }
  if (product.slug?.includes('sua-gao-lut-mekong')) {
    return 'Sữa Gạo Lứt Mekong Xanh (Lốc 7 chai 330ml) | Gạo lứt huyết rồng nguyên cám thơm lừng';
  }
  if (product.slug?.includes('nha-dam-mu-trom')) {
    return 'Nha Đam Mủ Trôm Thái Sơn (Lốc 7 chai 330ml) | Thạch nha đam giòn sần sật, thanh lọc cơ thể';
  }
  if (product.slug?.includes('tao-do-hat-chia')) {
    return 'Táo Đỏ Hạt Chia Thái Sơn (Lốc 7 chai 330ml) | Năng lượng sạch tự nhiên, bổ dưỡng mỗi ngày';
  }
  if (product.slug?.includes('sam-la-han')) {
    return 'Sâm La Hán Hoa Cúc Thái Sơn (Lốc 7 chai 330ml) | Giải nhiệt sảng khoái, vị ngọt thanh mát';
  }

  const firstPart = product.name.split(',')[0].trim();
  const variant = product.variants?.find((v) => v.quantity === 7) || product.variants?.[0];
  return `${firstPart} (${getPackLabel(product, variant)}) | 100% Nguyên liệu tự nhiên`;
}

export default function ProductSponsoredMiniCard({
  currentProductId,
  className = '',
  hideUnverifiedStats = false,
  randomize = false,
}: ProductSponsoredMiniCardProps) {
  const randomProduct = useRandomSponsoredProduct(currentProductId, 0, randomize);

  // Chọn sản phẩm gợi ý khác với sản phẩm hiện tại
  const candidates = products.filter(
    (p) => p.id !== currentProductId && p.slug !== currentProductId && p.isActive
  );

  const fixedProduct: Product =
    candidates.find((p) => p.id === 'sua-hat-sen-mekong') ||
    candidates.find((p) => p.id === 'sua-bap-nep') ||
    candidates.find((p) => p.id === 'sua-gao-lut-mekong') ||
    candidates[0] ||
    products[0];
  const recommendedProduct: Product = randomProduct || fixedProduct;
  // Chế độ ngẫu nhiên: ẩn (giữ chỗ) cho tới khi chọn xong phía trình duyệt, tránh nháy sản phẩm
  const waitingRandom = randomize && !randomProduct;

  if (!recommendedProduct) return null;

  // Lấy giá lốc 7 chai
  const defaultPackVariant =
    recommendedProduct.variants?.find((v) => v.quantity === 7) ||
    recommendedProduct.variants?.[0];
  const price = defaultPackVariant
    ? defaultPackVariant.price
    : recommendedProduct.price * 7;
  const bottleCount = defaultPackVariant?.quantity || 7;
  const unitPrice = Math.round(price / bottleCount);

  const displayTitle = getProductSubtitle(recommendedProduct);
  const thumbnail = recommendedProduct.thumbnail || '/images/products/1200x900-shs1.jpg';
  const productLink = `/san-pham/${recommendedProduct.slug}`;

  return (
    <div
      className={`w-full bg-white rounded-lg border border-gray-200/90 p-3 sm:p-3.5 shadow-[0_1px_4px_rgba(34,84,76,0.03)] hover:shadow-[0_2px_10px_rgba(34,84,76,0.07)] transition-all duration-300 ${waitingRandom ? 'invisible' : ''} ${className}`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Ảnh sản phẩm bên trái (Tỉ lệ chuẩn Amazon) */}
        <Link
          href={productLink}
          className="relative w-24 sm:w-28 aspect-[4/3] bg-ink-50 rounded-md border border-gray-100 shrink-0 overflow-hidden group"
        >
          <Image
            src={thumbnail}
            alt={recommendedProduct.name}
            fill
            sizes="110px"
            className="object-cover transition-transform duration-300"
          />
        </Link>

        {/* Thông tin sản phẩm bên phải */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Tên sản phẩm */}
          <Link
            href={productLink}
            className="text-xs sm:text-[13px] font-medium text-gray-900 hover:text-forest-700 transition-colors leading-snug line-clamp-2"
            title={displayTitle}
          >
            {displayTitle}
          </Link>

          {/* Đánh giá sao, số lượng review & Giá tiền */}
          <div className="flex items-center gap-1.5 text-xs mt-1.5 flex-wrap">
            {!hideUnverifiedStats && (
              <>
            <div className="flex items-center text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="w-3 h-3 fill-amber-500 stroke-amber-500"
                />
              ))}
            </div>
            <span className="text-[11px] text-forest-700 font-medium">
              77
            </span>
            <span className="text-gray-300 text-xs">|</span>
              </>
            )}
            <span className="text-sm sm:text-[15px] text-gray-900">
              {price.toLocaleString('vi-VN')}₫
            </span>
            <span className="text-[11px] text-gray-500 font-normal">
              ({unitPrice.toLocaleString('vi-VN')} đ/chai)
            </span>
            {/* Huy hiệu Prime chuẩn Amazon */}
            {!hideUnverifiedStats && (
            <span className="inline-flex items-center text-forest-700 text-sm italic tracking-tighter ml-auto sm:ml-1">
              <span className="text-forest-700 mr-0.5 not-italic text-[1.125em]">✓</span>
              <span className="text-forest-700 not-italic text-[12px] font-sans">
                prime
              </span>
            </span>
            )}
          </div>

          {/* Hàng điều hướng: Shop now > bên trái & Được tài trợ bên phải */}
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-50">
            <Link
              href={productLink}
              className="text-xs text-forest-700 hover:text-copper-600 hover:underline font-medium inline-flex items-center gap-0.5"
            >
              Shop now ›
            </Link>
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5 select-none">
              <span>Được tài trợ</span>
              <Info className="w-2.5 h-2.5 text-gray-400" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
