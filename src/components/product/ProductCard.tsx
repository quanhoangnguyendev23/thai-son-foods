'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { Product } from '@/types';
import { formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart';
import { useFlyToCart } from '@/context/FlyToCartContext';
import { useLanguage } from '@/context/LanguageContext';

interface ProductCardProps {
  product: Product;
  layout?: 'vertical' | 'horizontal' | 'compact';
  isHomepage?: boolean;
}

export default function ProductCard({ product, layout = 'vertical', isHomepage = false }: ProductCardProps) {
  const { language } = useLanguage();
  const addItem = useCartStore((s) => s.addItem);
  const { flyToCart } = useFlyToCart();
  const cardRef = useRef<HTMLElement>(null);

  const fallbackImg = '/images/products/sua-bap-nep.png';
  const initialImg = product.thumbnail && product.thumbnail.trim() ? product.thumbnail.trim() : fallbackImg;
  const [imgSrc, setImgSrc] = useState(initialImg);

  useEffect(() => {
    setImgSrc(product.thumbnail && product.thumbnail.trim() ? product.thumbnail.trim() : fallbackImg);
  }, [product.thumbnail]);

  // Kiểm tra ảnh ngoài và dự phòng nếu URL chứa hostname lạ hoặc không hợp lệ
  const isInvalidOrBlockedHost = !imgSrc || imgSrc.includes('example.com');
  const safeImgSrc = isInvalidOrBlockedHost ? fallbackImg : imgSrc;
  const isExternal = Boolean(safeImgSrc && (safeImgSrc.startsWith('http://') || safeImgSrc.startsWith('https://')));

  const fullName = language === 'en' && product.nameEn ? product.nameEn : product.name;
  const bestSellerText = language === 'en' ? 'Best Seller' : 'Bán chạy';
  const newText = language === 'en' ? 'New' : 'Mới';

  // Lấy quy cách đóng gói tiêu chuẩn nhỏ nhất (Ví dụ: Lốc 7 chai hoặc Lốc 5 chai), không bao giờ bán/thêm 1 chai lẻ
  const defaultVariant = useMemo(() => {
    if (product.variants && product.variants.length > 0) {
      return [...product.variants].sort((a, b) => (a.quantity || 0) - (b.quantity || 0))[0];
    }
    const isBigBottle = product.slug?.includes('yoo') || product.volume?.includes('568') || product.price === 25000;
    const qty = isBigBottle ? 6 : 10;
    return {
      id: isBigBottle ? 'default-6chai' : 'default-10chai',
      name: `${qty} chai`,
      quantity: qty,
      price: product.price * qty,
      unit: 'lốc',
      volume: `${qty} x ${product.volume || (isBigBottle ? '568ml' : '330ml')}`,
    };
  }, [product]);

  const packDisplayUnit = language === 'en'
    ? `Pack of ${defaultVariant.quantity}`
    : `lốc ${defaultVariant.name}`;

  // Số lượng gói này đang có trong giỏ (hiện trên nút để khách biết đã thêm bao nhiêu, tránh bấm nhầm nhiều lần)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const cartQty = useCartStore(
    (s) => s.items.find((i) => i.productId === `${product.id}-${defaultVariant.id}`)?.quantity ?? 0
  );
  const cartQtyBadge =
    mounted && cartQty > 0 ? (
      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-sale text-white text-[11px] leading-[18px] text-center shadow-sm pointer-events-none">
        {cartQty > 99 ? '99+' : cartQty}
      </span>
    ) : null;

  // Thông báo ngắn tại nút: số gói vừa thêm gần đây + nút Hoàn tác (thêm nhầm / bấm quá tay)
  const [recentAdds, setRecentAdds] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    },
    []
  );
  const handleUndoAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const id = `${product.id}-${defaultVariant.id}`;
    const cart = useCartStore.getState();
    const current = cart.items.find((i) => i.productId === id)?.quantity ?? 0;
    if (current - recentAdds > 0) cart.setQuantity(id, current - recentAdds);
    else cart.removeItem(id);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setRecentAdds(0);
  };
  const undoPill =
    recentAdds > 0 ? (
      <span
        role="status"
        className="absolute right-0 bottom-full mb-1.5 z-20 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink-950 text-white text-[11px] pl-2.5 pr-1 py-1 shadow-lg"
      >
        <span>{language === 'en' ? `Added ${recentAdds}` : `Đã thêm ${recentAdds}`}</span>
        <button
          type="button"
          onClick={handleUndoAdd}
          className="rounded-full bg-white/20 hover:bg-white/30 px-2 py-0.5 cursor-pointer"
        >
          {language === 'en' ? 'Undo' : 'Hoàn tác'}
        </button>
      </span>
    ) : null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Lấy ảnh thumbnail trong thẻ hoặc fallback về nút được bấm
    const imgEl = cardRef.current?.querySelector('img') as HTMLElement | null;

    flyToCart({
      startElement: imgEl || (e.currentTarget as HTMLElement),
      imageSrc: product.thumbnail,
    });

    const packUnit = language === 'en'
      ? `Pack of ${defaultVariant.quantity} bottles`
      : `Lốc ${defaultVariant.name}`;

    addItem({
      productId: `${product.id}-${defaultVariant.id}`,
      name: `${fullName} (${defaultVariant.name})`,
      slug: product.slug,
      price: defaultVariant.price,
      unit: packUnit,
      thumbnail: product.thumbnail,
      variantId: defaultVariant.id,
      variantName: defaultVariant.name,
    });

    setRecentAdds((n) => n + 1);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setRecentAdds(0), 3500);
  };

  // Ảnh hover: rê chuột vào thẻ sẽ chuyển sang ảnh thứ 2 của sản phẩm (ảnh đời sống) bằng hiệu ứng mờ dần
  const hoverImgUrl = (() => {
    const u = product.images && product.images.length > 1 ? product.images[1]?.url : '';
    return u && u.startsWith('/') && !u.endsWith('.mp4') && u !== safeImgSrc ? u : '';
  })();
  const renderHoverImage = (sizes: string) =>
    hoverImgUrl ? (
      <Image
        src={hoverImgUrl}
        alt=""
        aria-hidden
        fill
        sizes={sizes}
        loading="lazy"
        className="pointer-events-none object-cover opacity-0 scale-105 transition-[opacity,transform] duration-500 ease-out group-hover:opacity-100 group-hover:scale-100 motion-reduce:transition-none [@media(hover:none)]:hidden"
      />
    ) : null;

  // Xác định ảnh là poster full-bleed (620x930, 800x1200) hay ảnh chai/sản phẩm
  const isPoster =
    product.thumbnail.includes('620x930') ||
    product.thumbnail.includes('800x1200') ||
    product.thumbnail.includes('lifestyle') ||
    product.imageFit === 'cover';

  // Khai báo imageFit của sản phẩm luôn được ưu tiên (không suy đoán theo đuôi .png, vì sẽ làm ảnh bị thu nhỏ/chừa viền so với các thẻ khác)
  const isBottle = product.imageFit ? product.imageFit === 'contain' : !isPoster;

  // ─── BỐ CỤC COMPACT (Dành cho hàng 7 sản phẩm ở phần gợi ý trang chi tiết) ───
  if (layout === 'compact') {
    return (
      <article ref={cardRef} className="group h-full flex flex-col">
        <Link
          href={`/san-pham/${product.slug}`}
          className="flex flex-col h-full bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200/80 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-forest-700/30 hover:shadow-[0_14px_28px_-14px_rgba(34,84,76,0.35)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          {/* Khung thẻ ảnh */}
          <div
            className={`relative aspect-[4/3] w-full overflow-hidden flex items-center justify-center ${
              isBottle ? 'bg-ivory' : 'bg-gray-100'
            }`}
          >
            <Image
              src={safeImgSrc}
              alt={product.name}
              fill
              unoptimized={isExternal}
              onError={() => setImgSrc(fallbackImg)}
              className={`${
                isBottle
                  ? 'object-contain p-2 sm:p-3'
                  : 'object-cover object-top'
              } transition-transform duration-500 group-hover:scale-105`}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 34vw, 22vw"
              loading="lazy"
            />
            {renderHoverImage("(max-width: 640px) 50vw, (max-width: 1024px) 34vw, 22vw")}

            {/* Huy hiệu Bán chạy / Mới */}
            <div
              className={`absolute top-1 sm:top-2 ${
                isPoster ? 'right-1 sm:right-2' : 'left-1 sm:left-2'
              } flex flex-col gap-0.5 z-10`}
            >
              {product.isBestSeller && (
                <span className="px-1.5 py-0.5 text-[11px] lg:text-[10px] bg-brand-emerald text-white rounded shadow-xs">
                  {bestSellerText}
                </span>
              )}
              {product.isNew && (
                <span className="px-1.5 py-0.5 text-[11px] lg:text-[10px] bg-corn text-text-dark rounded shadow-xs">
                  {newText}
                </span>
              )}
            </div>
          </div>

          {/* Thông tin sản phẩm */}
          <div className="p-2 sm:p-2.5 md:p-3 flex-1 flex flex-col justify-between">
            <div>
              <h3
                title={fullName}
                className={`text-[15px] sm:text-[15px] text-text-dark mb-1 leading-snug group-hover:text-leaf-900 transition-colors ${
                  isHomepage ? 'line-clamp-2' : ''
                }`}
              >
                {fullName}
              </h3>
            </div>

            <div className="relative flex items-center justify-between gap-1 mt-auto pt-1.5 sm:pt-2 border-t border-gray-100">
              <div className="flex flex-col">
                <div className="text-base sm:text-[15px] text-leaf-900 flex flex-wrap items-baseline gap-x-0.5">
                  <span suppressHydrationWarning>{formatPrice(defaultVariant.price)}đ</span>
                  <span className="text-[11px] lg:text-[10px] text-text-muted">
                    /{packDisplayUnit}
                  </span>
                </div>
                <span className="text-[10px] lg:text-[8.5px] text-text-muted font-normal" suppressHydrationWarning>
                  ~{formatPrice(product.price)}đ/{language === 'en' ? 'bottle' : 'chai'}
                </span>
              </div>

              {undoPill}
              <button
                onClick={handleAddToCart}
                className="relative shrink-0 w-9 h-9 before:absolute before:-inset-1 before:content-[''] sm:before:hidden sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center bg-brand-emerald text-white rounded-lg hover:bg-brand-forest transition-colors active:scale-95 cursor-pointer shadow-xs"
                aria-label={language === 'en' ? `Add ${fullName} (${defaultVariant.name}) to cart` : `Thêm ${fullName} (${defaultVariant.name}) vào giỏ hàng`}
                title={language === 'en' ? `Add ${packDisplayUnit}` : `Thêm ${packDisplayUnit}`}
              >
                <ShoppingBag className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                {cartQtyBadge}
              </button>
            </div>
          </div>
        </Link>
      </article>
    );
  }

  // ─── BỐ CỤC NẰM NGANG (Dành cho hàng 2 sản phẩm: 1 bên sản phẩm, 1 bên title & thông tin) ───
  if (layout === 'horizontal') {
    return (
      <article ref={cardRef} className="group h-full flex flex-col">
        <Link
          href={`/san-pham/${product.slug}`}
          className="flex flex-row h-full bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200/80 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-forest-700/30 hover:shadow-[0_14px_28px_-14px_rgba(34,84,76,0.35)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          {/* 1 BÊN LÀ SẢN PHẨM (Khung ảnh) — Đồng bộ chuẩn tỷ lệ 4:3 (1200x900px) giống hệt hàng 3 sản phẩm */}
          <div
            className={`relative w-[44%] sm:w-[46%] md:w-[48%] aspect-[4/3] shrink-0 overflow-hidden flex items-center justify-center ${
              isBottle ? 'bg-ivory' : 'bg-gray-100'
            }`}
          >
            <Image
              src={safeImgSrc}
              alt={fullName}
              fill
              unoptimized={isExternal}
              onError={() => setImgSrc(fallbackImg)}
              className={`${
                isBottle
                  ? 'object-contain p-1.5 sm:p-4 md:p-5'
                  : 'object-cover object-center'
              } transition-transform duration-500 group-hover:scale-105`}
              sizes="(max-width: 640px) 50vw, 35vw"
              loading="lazy"
            />
            {renderHoverImage("(max-width: 640px) 50vw, 35vw")}

            {/* Huy hiệu Bán chạy / Mới — Tự động sang góc phải nếu là poster có con dấu đỏ bên trái */}
            <div
              className={`absolute top-1 sm:top-2.5 ${
                isPoster ? 'right-1 sm:right-2.5' : 'left-1 sm:left-2.5'
              } flex flex-col gap-1 z-10`}
            >
              {product.isBestSeller && (
                <span className="px-1.5 sm:px-2 py-0.5 text-[11px] md:text-sm bg-brand-emerald text-white rounded sm:rounded-md shadow-xs">
                  {bestSellerText}
                </span>
              )}
              {product.isNew && (
                <span className="px-1.5 sm:px-2 py-0.5 text-[11px] md:text-sm bg-corn text-text-dark rounded sm:rounded-md shadow-xs">
                  {newText}
                </span>
              )}
            </div>
          </div>

          {/* 1 BÊN LÀ TITLE & THÔNG TIN */}
          <div className="p-2 sm:p-4 md:p-5 flex-1 flex flex-col justify-between">
            <div>
              <h3
                title={fullName}
                className={`text-[15px] sm:text-lg md:text-xl text-text-dark mb-1 sm:mb-1.5 leading-snug group-hover:text-leaf-900 transition-colors ${
                  isHomepage ? 'line-clamp-2' : ''
                }`}
              >
                {fullName}
              </h3>
            </div>

            <div className="relative flex items-center justify-between gap-1 sm:gap-2 mt-auto pt-1.5 sm:pt-2 md:pt-3 border-t border-gray-100">
              <div className="flex flex-col">
                <div className="text-base sm:text-lg md:text-xl text-leaf-900 flex flex-wrap items-baseline gap-x-1">
                  <span suppressHydrationWarning>{formatPrice(defaultVariant.price)}đ</span>
                  <span className="text-[11px] sm:text-sm md:text-base text-text-muted">
                    /{packDisplayUnit}
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs text-text-muted font-normal" suppressHydrationWarning>
                  ~{formatPrice(product.price)}đ/{language === 'en' ? 'bottle' : 'chai'}
                </span>
              </div>

              {undoPill}
              <button
                onClick={handleAddToCart}
                className="relative shrink-0 w-9 h-9 before:absolute before:-inset-1 before:content-[''] sm:before:hidden sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center bg-brand-emerald text-white rounded-lg sm:rounded-xl hover:bg-brand-forest transition-colors active:scale-95 cursor-pointer shadow-xs"
                aria-label={language === 'en' ? `Add ${fullName} (${defaultVariant.name}) to cart` : `Thêm ${fullName} (${defaultVariant.name}) vào giỏ hàng`}
                title={language === 'en' ? `Add ${packDisplayUnit}` : `Thêm ${packDisplayUnit}`}
              >
                <ShoppingBag className="w-4 h-4 sm:w-4 sm:h-4 md:w-[18px] md:h-[18px]" />
                {cartQtyBadge}
              </button>
            </div>
          </div>
        </Link>
      </article>
    );
  }

  // ─── BỐ CỤC ĐỨNG MẶC ĐỊNH (Dành cho hàng 3 sản phẩm: Title ở dưới sản phẩm) ───
  return (
    <article className="group h-full flex flex-col">
      <Link
        href={`/san-pham/${product.slug}`}
        className="flex flex-col h-full bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200/80 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-forest-700/30 hover:shadow-[0_14px_28px_-14px_rgba(34,84,76,0.35)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        {/* Khung thẻ ảnh — Tỷ lệ chuẩn 4:3 khớp hoàn hảo với poster cánh đồng và chai đơn */}
        <div
          className={`relative aspect-[4/3] w-full overflow-hidden flex items-center justify-center ${
            isBottle ? 'bg-ivory' : 'bg-gray-100'
          }`}
        >
          <Image
            src={safeImgSrc}
            alt={fullName}
            fill
            unoptimized={isExternal}
            onError={() => setImgSrc(fallbackImg)}
            className={`${
              isBottle
                ? 'object-contain p-1.5 sm:p-4 md:p-6'
                : 'object-cover object-top'
            } transition-transform duration-500 group-hover:scale-105`}
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 33vw, 25vw"
            loading="lazy"
          />
          {renderHoverImage("(max-width: 640px) 33vw, (max-width: 1024px) 33vw, 25vw")}

          {/* Huy hiệu Bán chạy / Mới — Tự động sang góc phải nếu là poster có con dấu đỏ bên trái */}
          <div
            className={`absolute top-1 sm:top-2.5 ${
              isPoster ? 'right-1 sm:right-2.5' : 'left-1 sm:left-2.5'
            } flex flex-col gap-1 z-10`}
          >
            {product.isBestSeller && (
              <span className="px-1.5 sm:px-2 py-0.5 text-[11px] md:text-sm bg-brand-emerald text-white rounded sm:rounded-md shadow-xs">
                {bestSellerText}
              </span>
            )}
            {product.isNew && (
              <span className="px-1.5 sm:px-2 py-0.5 text-[11px] md:text-sm bg-corn text-text-dark rounded sm:rounded-md shadow-xs">
                {newText}
              </span>
            )}
          </div>
        </div>

        {/* Thông tin sản phẩm — Title ở dưới sản phẩm */}
        <div className="p-2 sm:p-3.5 md:p-5 flex-1 flex flex-col justify-between">
          <div>
            <h3
              title={fullName}
              className={`text-[15px] sm:text-lg md:text-xl text-text-dark mb-1 sm:mb-1.5 leading-snug group-hover:text-leaf-900 transition-colors ${
                isHomepage ? 'line-clamp-2' : ''
              }`}
            >
              {fullName}
            </h3>
          </div>

          <div className="relative flex items-center justify-between gap-1 sm:gap-2 mt-auto pt-1.5 sm:pt-2 md:pt-3 border-t border-gray-100">
            <div className="flex flex-col">
              <div className="text-base sm:text-lg md:text-xl text-leaf-900 flex flex-wrap items-baseline gap-x-1">
                <span suppressHydrationWarning>{formatPrice(defaultVariant.price)}đ</span>
                <span className="text-[11px] sm:text-sm md:text-base text-text-muted">
                  /{packDisplayUnit}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-text-muted font-normal" suppressHydrationWarning>
                ~{formatPrice(product.price)}đ/{language === 'en' ? 'bottle' : 'chai'}
              </span>
            </div>

            {undoPill}
            <button
              onClick={handleAddToCart}
              className="relative shrink-0 w-9 h-9 before:absolute before:-inset-1 before:content-[''] sm:before:hidden sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center bg-brand-emerald text-white rounded-lg sm:rounded-xl hover:bg-brand-forest transition-colors active:scale-95 cursor-pointer shadow-xs"
              aria-label={language === 'en' ? `Add ${fullName} (${defaultVariant.name}) to cart` : `Thêm ${fullName} (${defaultVariant.name}) vào giỏ hàng`}
              title={language === 'en' ? `Add ${packDisplayUnit}` : `Thêm ${packDisplayUnit}`}
            >
              <ShoppingBag className="w-4 h-4 sm:w-4 sm:h-4 md:w-[18px] md:h-[18px]" />
              {cartQtyBadge}
            </button>
          </div>
        </div>
      </Link>
    </article>
  );
}
