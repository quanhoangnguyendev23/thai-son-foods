'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Info, Check } from 'lucide-react';
import { Product } from '@/types';
import { products } from '@/data/products';
import { formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart';

interface FrequentlyBoughtTogetherProps {
  currentProduct: Product;
  className?: string;
}

interface BundleItem {
  id: string;
  product: Product;
  cleanName: string;
  packName: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  rating: number;
  reviewCount: number;
  thumbnail: string;
  isSponsored?: boolean;
  hasPrime?: boolean;
  isCurrent?: boolean;
  variantId: string;
  variantName: string;
}

function getCleanName(product: Product): string {
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
  return firstPart.length > 40 ? firstPart.slice(0, 37) + '...' : firstPart;
}

export default function FrequentlyBoughtTogether({
  currentProduct,
  className = '',
}: FrequentlyBoughtTogetherProps) {
  const addItem = useCartStore((s) => s.addItem);

  // Xây dựng 3 sản phẩm bundle phù hợp: Sản phẩm hiện tại + 2 sản phẩm gợi ý
  const bundleItems: BundleItem[] = useMemo(() => {
    // 1. Sản phẩm hiện tại
    const currVariant =
      currentProduct.variants?.find((v) => v.quantity === 7) ||
      currentProduct.variants?.[0];
    const currPrice = currVariant
      ? currVariant.price
      : currentProduct.price * 7;
    const currPack = currVariant ? `Lốc ${currVariant.name}` : 'Lốc 7 chai 330ml';

    const item1: BundleItem = {
      id: currentProduct.id,
      product: currentProduct,
      cleanName: getCleanName(currentProduct),
      packName: currPack,
      price: currPrice,
      rating: 4.8,
      reviewCount: 548,
      thumbnail: currentProduct.thumbnail || '/images/products/1200x900-sb1.jpg',
      isCurrent: true,
      variantId: currVariant?.id || '7chai',
      variantName: currVariant?.name || '7 chai',
    };

    // 2. Lấy 2 sản phẩm đi kèm phù hợp từ danh mục
    const candidates = products.filter(
      (p) => p.id !== currentProduct.id && p.isActive
    );

    // Ưu tiên các dòng sữa chủ lực của Thái Sơn
    let p2 = candidates.find((p) => p.id === 'sua-hat-sen-mekong');
    let p3 = candidates.find((p) => p.id === 'sua-gao-lut-mekong');

    if (currentProduct.id === 'sua-hat-sen-mekong') {
      p2 = candidates.find((p) => p.id === 'sua-bap-nep') || candidates[0];
      p3 = candidates.find((p) => p.id === 'sua-gao-lut-mekong') || candidates[1];
    } else if (currentProduct.id === 'sua-gao-lut-mekong') {
      p2 = candidates.find((p) => p.id === 'sua-bap-nep') || candidates[0];
      p3 = candidates.find((p) => p.id === 'sua-hat-sen-mekong') || candidates[1];
    } else if (!p2 || !p3) {
      p2 = candidates[0] || currentProduct;
      p3 = candidates[1] || currentProduct;
    }

    const p2Variant =
      p2.variants?.find((v) => v.quantity === 7) || p2.variants?.[0];
    const p2Price = p2Variant ? p2Variant.price : p2.price * 7;
    const p2OriginalPrice = Math.round(p2Price * 1.05);

    const item2: BundleItem = {
      id: p2.id,
      product: p2,
      cleanName: getCleanName(p2),
      packName: p2Variant ? `Lốc ${p2Variant.name}` : 'Lốc 7 chai 330ml',
      price: p2Price,
      originalPrice: p2OriginalPrice,
      discountPercent: 5,
      rating: 4.7,
      reviewCount: 759,
      thumbnail: p2.thumbnail || '/images/products/1200x900-shs1.jpg',
      isSponsored: true,
      variantId: p2Variant?.id || '7chai',
      variantName: p2Variant?.name || '7 chai',
    };

    const p3Variant =
      p3.variants?.find((v) => v.quantity === 7) || p3.variants?.[0];
    const p3Price = p3Variant ? p3Variant.price : p3.price * 7;

    const item3: BundleItem = {
      id: p3.id,
      product: p3,
      cleanName: getCleanName(p3),
      packName: p3Variant ? `Lốc ${p3Variant.name}` : 'Lốc 7 chai 330ml',
      price: p3Price,
      rating: 4.8,
      reviewCount: 409,
      thumbnail: p3.thumbnail || '/images/products/1200x900-sgl1.jpg',
      isSponsored: true,
      hasPrime: true,
      variantId: p3Variant?.id || '7chai',
      variantName: p3Variant?.name || '7 chai',
    };

    return [item1, item2, item3];
  }, [currentProduct]);

  // Trạng thái checkbox chọn mua (mặc định chọn cả 3)
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>(() => {
    return bundleItems.reduce((acc, item) => {
      acc[item.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
  });

  const [isSuccess, setIsSuccess] = useState(false);

  // Toggle checkbox
  const toggleItem = (id: string) => {
    setSelectedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Tính tổng giá và số lượng được chọn
  const selectedItems = bundleItems.filter((item) => selectedIds[item.id]);
  const selectedCount = selectedItems.length;
  const totalPrice = selectedItems.reduce((sum, item) => sum + item.price, 0);

  // Xử lý thêm vào giỏ hàng
  const handleAddToCart = () => {
    if (selectedCount === 0) return;

    selectedItems.forEach((item) => {
      addItem({
        productId: `${item.product.id}-${item.variantId}`,
        name: `${item.cleanName} (${item.variantName})`,
        slug: item.product.slug,
        price: item.price,
        unit: item.packName,
        thumbnail: item.thumbnail,
        variantId: item.variantId,
        variantName: item.variantName,
      });
    });

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
    }, 2500);
  };

  return (
    <div
      className={`w-full bg-white rounded-xl border border-gray-200/90 p-4 sm:p-6 shadow-[0_1px_4px_rgba(34,84,76,0.03)] ${className}`}
    >
      {/* ── TIÊU ĐỀ KHỐI (Chuẩn Amazon) ── */}
      <h3 className="text-lg sm:text-xl text-gray-900 leading-snug mb-5">
        Các sản phẩm của <span className="text-forest-700">Thái Sơn Foods</span> mà khách hàng đã mua cùng nhau.
      </h3>

      {/* ── BỐ CỤC CHÍNH: HÀNG SẢN PHẨM BÊN TRÁI & KHỐI TỔNG GIÁ BÊN PHẢI ── */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        {/* Cột 1: Danh sách 3 sản phẩm có dấu cộng nối giữa */}
        <div className="w-full xl:flex-1 flex flex-col md:flex-row items-start md:items-center gap-3 sm:gap-4 overflow-x-auto pb-2 md:pb-0">
          {bundleItems.map((item, index) => {
            const isSelected = !!selectedIds[item.id];

            return (
              <React.Fragment key={item.id}>
                {/* Dấu cộng giữa các sản phẩm */}
                {index > 0 && (
                  <div className="hidden md:flex items-center justify-center shrink-0 self-center text-gray-400 text-2xl font-light select-none px-1">
                    +
                  </div>
                )}

                {/* Thẻ sản phẩm */}
                <div
                  className={`w-full md:w-[210px] shrink-0 transition-opacity duration-200 ${
                    isSelected ? 'opacity-100' : 'opacity-40 grayscale'
                  }`}
                >
                  {/* Khung ảnh có Checkbox góc trên bên phải */}
                  <div className="relative w-full aspect-square max-w-[160px] sm:max-w-[170px] bg-ink-50 rounded-lg border border-gray-200/80 p-2.5 mx-auto md:mx-0 flex items-center justify-center overflow-hidden group">
                    <Link
                      href={`/san-pham/${item.product.slug}`}
                      className="relative w-full h-full block"
                    >
                      <Image
                        src={item.thumbnail}
                        alt={item.cleanName}
                        fill
                        sizes="180px"
                        className="object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                      />
                    </Link>

                    {/* Checkbox phong cách Amazon (góc trên phải) */}
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={`absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center transition-all z-10 shadow-xs border ${
                        isSelected
                          ? 'bg-forest-700 border-forest-700 text-white hover:bg-forest-700'
                          : 'bg-white border-gray-400 hover:border-gray-600'
                      }`}
                      aria-label={isSelected ? `Bỏ chọn ${item.cleanName}` : `Chọn ${item.cleanName}`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  </div>

                  {/* Thông tin mô tả bên dưới ảnh */}
                  <div className="pt-2.5 text-left">
                    {/* Dòng Được tài trợ (nếu là sản phẩm gợi ý) */}
                    {item.isSponsored && (
                      <div className="flex items-center gap-0.5 text-[10px] text-gray-400 mb-0.5 select-none">
                        <span>Được tài trợ</span>
                        <Info className="w-2.5 h-2.5 text-gray-400" />
                      </div>
                    )}

                    {/* Tên sản phẩm */}
                    <Link
                      href={`/san-pham/${item.product.slug}`}
                      className="block text-sm text-gray-900 hover:text-forest-700 transition-colors leading-snug line-clamp-2"
                      title={`${item.cleanName} (${item.packName})`}
                    >
                      {item.isCurrent && (
                        <span className="text-gray-900 mr-1 text-[1.125em]">
                          Sản phẩm này:
                        </span>
                      )}
                      {item.cleanName} ({item.packName})
                    </Link>

                    {/* Đánh giá sao */}
                    <div className="flex items-center gap-1 text-[11px] mt-1 flex-wrap">
                      <span className="text-gray-800 text-[12px]">
                        {item.rating}
                      </span>
                      <div className="flex items-center text-amber-500">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className="w-2.5 h-2.5 fill-amber-500 stroke-amber-500"
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-forest-700 font-medium">
                        {item.reviewCount}
                      </span>
                    </div>

                    {/* Giá tiền & Huy hiệu Prime */}
                    <div className="flex items-baseline gap-1.5 flex-wrap mt-1">
                      {item.discountPercent && (
                        <span className="text-sm text-crimson-600">
                          -{item.discountPercent}%
                        </span>
                      )}
                      <span className="text-base text-gray-900 leading-none">
                        {item.price.toLocaleString('vi-VN')}₫
                      </span>
                      {item.originalPrice && (
                        <span className="text-[11px] text-gray-400 line-through">
                          {item.originalPrice.toLocaleString('vi-VN')}₫
                        </span>
                      )}
                      {item.hasPrime && (
                        <span className="inline-flex items-center text-forest-700 text-sm italic tracking-tighter ml-1">
                          <span className="text-forest-700 mr-0.5 not-italic text-[1.125em]">✓</span>
                          <span className="text-forest-700 not-italic text-[12px] font-sans">
                            prime
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Cột 2: Khối Tổng Giá & Nút "Thêm cả 3 vào giỏ hàng" */}
        <div className="w-full xl:w-[260px] shrink-0 border-t xl:border-t-0 xl:border-l border-gray-100 pt-4 xl:pt-0 xl:pl-6 flex flex-col justify-center">
          {/* Dòng Tổng giá */}
          <div className="text-sm text-gray-700 mb-2.5">
            <span>Tổng giá: </span>
            <span className="text-lg sm:text-xl text-crimson-600 ml-1">
              {formatPrice(totalPrice)}
            </span>
          </div>

          {/* Nút Vàng Chuẩn Amazon */}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={selectedCount === 0 || isSuccess}
            className={`w-full py-2.5 px-5 rounded-full text-xs sm:text-sm font-medium transition-all shadow-[0_2px_5px_rgba(34,84,76,0.18)] border ${
              isSuccess
                ? 'bg-emerald-600 border-emerald-600 text-white cursor-default'
                : selectedCount > 0
                ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-700 text-gray-900 border-amber-700 hover:shadow-md cursor-pointer'
                : 'bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSuccess ? (
              <span className="inline-flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4 stroke-[2.5]" />
                Đã thêm {selectedCount} sản phẩm vào giỏ!
              </span>
            ) : selectedCount === 3 ? (
              'Thêm cả 3 vào giỏ hàng'
            ) : selectedCount === 2 ? (
              'Thêm cả 2 vào giỏ hàng'
            ) : selectedCount === 1 ? (
              'Thêm vào giỏ hàng'
            ) : (
              'Chọn ít nhất 1 sản phẩm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
