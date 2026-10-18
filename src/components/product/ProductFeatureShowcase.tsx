'use client';

import React from 'react';
import Image from 'next/image';
import { Product, ProductFeatureBanner } from '@/types';

interface ProductFeatureShowcaseProps {
  product?: Product;
  productId?: string;
  productSlug?: string;
  productSku?: string;
  productName?: string;
  productThumbnail?: string;
  featureBanners?: ProductFeatureBanner;
  className?: string;
}

const FEATURE_BANNERS_MAP: Record<string, ProductFeatureBanner> = {
  // Sữa Bắp Nếp Thái Sơn (SB)
  'sua-bap-nep': {
    banner1: '/images/banners/banner-feature-bap-01.jpg',
    banner2: '/images/banners/banner-feature-bap-02.jpg',
    alt1: 'Thành phần từ bắp tươi - Uống một bữa ăn ngon lành - Sản phẩm thuần chay thành phần từ thiên nhiên',
    alt2: 'Đặc tính sản phẩm Sữa Bắp Nếp Thái Sơn - Nguyên liệu tươi, Đóng chai tiện lợi, Vị ngọt tự nhiên, Bảo quản lạnh',
    title: 'Trải Nghiệm Trọn Vẹn Tinh Túy Bắp Nếp Tươi',
    subtitle: 'Thức uống thuần chay dinh dưỡng, vị ngon thanh mát từ thiên nhiên dành riêng cho bạn.',
  },
  // Sâm La Hán Hoa Cúc Thái Sơn (LH)
  'sam-la-han-hoa-cuc': {
    banner1: '/images/banners/banner-feature-lh-01.jpg',
    banner2: '/images/banners/banner-feature-lh-02.jpg',
    alt1: 'Thành phần từ La Hán Quả & Hoa Cúc thiên nhiên - Uống một bữa ăn ngon lành - Sản phẩm thuần chay thành phần từ thiên nhiên',
    alt2: 'Đặc tính sản phẩm Sâm La Hán Hoa Cúc Thái Sơn - Nguyên liệu tươi, Đóng chai tiện lợi, Vị ngọt tự nhiên, Bảo quản lạnh',
    title: 'Trải Nghiệm Trọn Vẹn Tinh Túy Sâm La Hán Hoa Cúc',
    subtitle: 'Thức uống thanh mát giải nhiệt, ngọt lành từ la hán quả và hoa cúc thảo mộc tự nhiên.',
  },
  // Sữa Hạt Sen Mekong Xanh (SHS)
  'sua-hat-sen-mekong': {
    banner1: '/images/banners/banner-feature-shs-01.jpg',
    banner2: '/images/banners/banner-feature-shs-02.jpg',
    alt1: 'Thành phần từ Hạt Sen thiên nhiên - Uống một bữa ăn ngon lành - Sản phẩm thuần chay thành phần từ thiên nhiên',
    alt2: 'Đặc tính sản phẩm Sữa Hạt Sen Mekong Xanh - Nguyên liệu tươi, Đóng chai tiện lợi, Vị ngọt tự nhiên, Bảo quản lạnh',
    title: 'Trải Nghiệm Trọn Vẹn Tinh Túy Sữa Hạt Sen Tươi',
    subtitle: 'Thức uống thuần chay dinh dưỡng, hương vị bùi ngậy thanh mát từ hạt sen Đồng Tháp tuyển chọn.',
  },
  // Sữa Gạo Lứt Mekong Xanh (SGL)
  'sua-gao-lut-mekong': {
    banner1: '/images/banners/banner-feature-sgl-01.jpg',
    banner2: '/images/banners/banner-feature-sgl-02.jpg',
    alt1: 'Thành phần từ Gạo Lứt Huyết Rồng - Uống một bữa ăn ngon lành - Sản phẩm thuần chay thành phần từ thiên nhiên',
    alt2: 'Đặc tính sản phẩm Sữa Gạo Lứt Mekong Xanh - Nguyên liệu tươi, Đóng chai tiện lợi, Vị ngọt tự nhiên, Bảo quản lạnh',
    title: 'Trải Nghiệm Trọn Vẹn Tinh Túy Sữa Gạo Lứt Huyết Rồng',
    subtitle: 'Dồi dào dưỡng chất từ gạo lứt nguyên cám, bổ sung năng lượng lành mạnh mỗi ngày.',
  },
  // Táo Đỏ Hạt Chia Thái Sơn (TD)
  'tao-do-hat-chia': {
    banner1: '/images/banners/banner-feature-td-01.jpg',
    banner2: '/images/banners/banner-feature-td-02.jpg',
    alt1: 'Thành phần từ Táo Đỏ thiên nhiên & Hạt Chia hảo hạng - Uống một bữa ăn ngon lành - Sản phẩm thuần chay thành phần từ thiên nhiên',
    alt2: 'Đặc tính sản phẩm Táo Đỏ Hạt Chia Thái Sơn - Nguyên liệu tươi, Đóng chai tiện lợi, Vị ngọt tự nhiên, Bảo quản lạnh',
    title: 'Trải Nghiệm Trọn Vẹn Tinh Túy Táo Đỏ Hạt Chia',
    subtitle: 'Thức uống thanh lọc và giải nhiệt, giàu chất xơ từ hạt chia hảo hạng và táo đỏ tự nhiên.',
  },
  // Nha Đam Mủ Trôm Thái Sơn (MD / nd)
  'nha-dam-mu-trom': {
    banner1: '/images/banners/banner-feature-nd-01.jpg',
    banner2: '/images/banners/banner-feature-nd-02.jpg',
    alt1: 'Thành phần từ Nha Đam tươi - Uống một bữa ăn ngon lành - Sản phẩm thuần chay thành phần từ thiên nhiên',
    alt2: 'Đặc tính sản phẩm Nha Đam Mủ Trôm Thái Sơn - Nguyên liệu tươi, Đóng chai tiện lợi, Vị ngọt tự nhiên, Bảo quản lạnh',
    title: 'Trải Nghiệm Trọn Vẹn Tinh Túy Nha Đam Mủ Trôm',
    subtitle: 'Nha đam tươi giòn sật kết hợp mủ trôm và lá dứa thanh mát, giải nhiệt và thanh lọc cơ thể.',
  },
};

const KEY_ALIASES: Record<string, string> = {
  // SB
  'sua-bap-nep': 'sua-bap-nep',
  'sua-bap-nep-thai-son': 'sua-bap-nep',
  'prod-sb-01': 'sua-bap-nep',
  'sb-01': 'sua-bap-nep',

  // LH
  'sam-la-han-hoa-cuc': 'sam-la-han-hoa-cuc',
  'sam-la-han-hoa-cuc-thai-son': 'sam-la-han-hoa-cuc',
  'prod-lh-01': 'sam-la-han-hoa-cuc',
  'lh-01': 'sam-la-han-hoa-cuc',

  // SHS
  'sua-hat-sen-mekong': 'sua-hat-sen-mekong',
  'sua-hat-sen-mekong-xanh': 'sua-hat-sen-mekong',
  'prod-shs-01': 'sua-hat-sen-mekong',
  'shs-01': 'sua-hat-sen-mekong',

  // SGL
  'sua-gao-lut-mekong': 'sua-gao-lut-mekong',
  'sua-gao-lut-mekong-xanh': 'sua-gao-lut-mekong',
  'prod-sgl-01': 'sua-gao-lut-mekong',
  'sgl-01': 'sua-gao-lut-mekong',

  // TD
  'tao-do-hat-chia': 'tao-do-hat-chia',
  'tao-do-hat-chia-thai-son': 'tao-do-hat-chia',
  'prod-td-01': 'tao-do-hat-chia',
  'td-01': 'tao-do-hat-chia',

  // MD / nd
  'nha-dam-mu-trom': 'nha-dam-mu-trom',
  'nha-dam-mu-trom-thai-son': 'nha-dam-mu-trom',
  'prod-md-01': 'nha-dam-mu-trom',
  'md-01': 'nha-dam-mu-trom',
};

export default function ProductFeatureShowcase({
  product,
  productId,
  productSlug,
  productSku,
  productName,
  featureBanners: propBanners,
  className = '',
}: ProductFeatureShowcaseProps) {
  let lookupKey =
    (product?.sku && KEY_ALIASES[product.sku.toLowerCase()]) ||
    (product?.slug && KEY_ALIASES[product.slug.toLowerCase()]) ||
    (product?.id && KEY_ALIASES[product.id.toLowerCase()]) ||
    (productSku && KEY_ALIASES[productSku.toLowerCase()]) ||
    (productSlug && KEY_ALIASES[productSlug.toLowerCase()]) ||
    (productId && KEY_ALIASES[productId.toLowerCase()]) ||
    '';

  if (!lookupKey) {
    const rawName = (product?.name || productName || '').toLowerCase();
    const isYooMilk =
      rawName.includes('yoo') ||
      rawName.includes('ohsawa') ||
      rawName.includes('568ml') ||
      (product?.sku && ['ss-01', 'sl-01'].includes(product.sku.toLowerCase())) ||
      (product?.id && ['sua-hat-sen-lotus', 'sua-gao-lut-ohsawa', 'prod-ss-01', 'prod-sl-01'].includes(product.id.toLowerCase()));

    if (!isYooMilk) {
      if (rawName.includes('la hán') || rawName.includes('hoa cúc') || rawName.includes('sam-la-han') || rawName.includes('sâm')) {
        lookupKey = 'sam-la-han-hoa-cuc';
      } else if (rawName.includes('hạt sen') || rawName.includes('mekong')) {
        lookupKey = 'sua-hat-sen-mekong';
      } else if (rawName.includes('gạo lứt') || rawName.includes('gao-lut') || rawName.includes('huyết rồng')) {
        lookupKey = 'sua-gao-lut-mekong';
      } else if (rawName.includes('táo đỏ') || rawName.includes('tao-do') || rawName.includes('hạt chia')) {
        lookupKey = 'tao-do-hat-chia';
      } else if (rawName.includes('nha đam') || rawName.includes('mủ trôm') || rawName.includes('nha-dam')) {
        lookupKey = 'nha-dam-mu-trom';
      } else if (rawName.includes('bắp') || rawName.includes('sua-bap') || rawName.includes('bắp nếp')) {
        lookupKey = 'sua-bap-nep';
      }
    }
  }

  const banners =
    propBanners ||
    product?.featureBanners ||
    (lookupKey ? FEATURE_BANNERS_MAP[lookupKey] : null);

  if (!banners) {
    return null;
  }

  const title = banners.title || `Trải Nghiệm Trọn Vẹn Tinh Túy ${product?.name || productName || 'Sản Phẩm'}`;
  const subtitle =
    banners.subtitle || 'Thức uống thuần chay dinh dưỡng, vị ngon thanh mát từ thiên nhiên dành riêng cho bạn.';

  return (
    <section className={`bg-ivory py-12 md:py-16 border-t border-gray-200 ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* 1. HEADER TRUNG TÂM */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-forest-700 text-sm uppercase tracking-wider">
            <span>ĐẶC TÍNH & NGUỒN GỐC THUẦN TỰ NHIÊN</span>
          </span>
          <h2 className="text-2xl sm:text-3xl text-gray-900 mt-2">
            {title}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {subtitle}
          </p>
        </div>

        {/* 2. CARD CHỨA 2 BANNER XẾP CHỒNG (STACKED CARD) */}
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg">
          {/* Banner 1 (Phía trên): Banner chữ A - Hình ảnh thiết kế hoàn chỉnh */}
          <div className="relative w-full aspect-[1920/850] bg-ivory overflow-hidden group">
            <Image
              src={banners.banner1}
              alt={banners.alt1 || `${product?.name || productName} - Thành phần từ thiên nhiên`}
              fill
              priority
              className="object-cover object-center group-hover:scale-[1.01] transition-transform duration-500"
              sizes="(max-width: 1200px) 100vw, 1200px"
            />
          </div>

          {/* Đường kẻ phân cách */}
          <div className="w-full h-px bg-gray-100" />

          {/* Banner 2 (Phía dưới): Banner chữ 4 nhánh Infographic */}
          <div className="relative w-full aspect-[1920/850] bg-ivory overflow-hidden group">
            <Image
              src={banners.banner2}
              alt={banners.alt2 || `${product?.name || productName} - Đặc tính sản phẩm`}
              fill
              className="object-cover object-center group-hover:scale-[1.01] transition-transform duration-500"
              sizes="(max-width: 1200px) 100vw, 1200px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
