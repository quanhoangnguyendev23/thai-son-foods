'use client';

import { useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/types';
import { formatPrice } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useCartStore, getItemMaxQuantity } from '@/store/cart';
import { useFlyToCart } from '@/context/FlyToCartContext';
import { useRouter } from 'next/navigation';
import { Star, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useBranchStore } from '@/store/branch';
import { DEFAULT_PRODUCT_DETAIL, getProductDetailContent, STORE_SALES_INFO } from '@/data/product-detail-content';
import {
  sortVariants,
  getVariantLabel,
  getBottleVolume,
  getUnitPrice,
  getVariantOriginalPrice,
  getShortProductName,
  isSameProduct,
  getProductImage,
} from '@/lib/product-detail';
import PackSizeSelector from '@/components/product/PackSizeSelector';
import ProductBuyBox from '@/components/product/ProductBuyBox';
import MobileBuyBar from '@/components/product/MobileBuyBar';
import ProductSponsoredMiniCard from '@/components/product/ProductSponsoredMiniCard';
import ProductSidebarSponsoredCard from '@/components/product/ProductSidebarSponsoredCard';
import { CouponPlaceholder } from '@/components/product/ProductPlaceholderBlocks';
import { MonthlySalesInfo } from '@/components/product/ProductRealBlocks';

const VEGAN_PRODUCT_IDS = new Set([
  'sua-bap-nep',
  'sua-bap-nep-thai-son',
  'sua-hat-sen-mekong',
  'sua-hat-sen-mekong-xanh',
  'sua-gao-lut-mekong',
  'sua-gao-lut-mekong-xanh',
  'sua-hat-sen-lotus',
  'sua-hat-sen-lotus-yoo',
  'sua-gao-lut-ohsawa',
  'sua-gao-lut-ohsawa-yoo',
  'nha-dam-mu-trom',
  'nha-dam-mu-trom-thai-son',
  'tao-do-hat-chia',
  'tao-do-hat-chia-thai-son',
  'sam-la-han-hoa-cuc',
]);

interface ProductMainSectionProps {
  product: Product;
  /** Thư viện ảnh (cột trái) — truyền từ page để giữ server/client boundary hiện có */
  gallery?: ReactNode;
  /** Sản phẩm cùng danh mục để chọn hương vị khác */
  siblingProducts?: Product[];
  /** Hiển thị các khối mẫu (PLACEHOLDER) của bố cục Amazon chưa có nghiệp vụ thật */
  showPlaceholders?: boolean;
}

/**
 * Khu vực sản phẩm chính theo bố cục 3 vùng:
 *  - Desktop (xl): Gallery | Thông tin sản phẩm | Buy Box (sticky)
 *  - Tablet (md–lg): Gallery (sticky) | Thông tin + Buy Box + Đặc điểm
 *  - Mobile: Ảnh → Tên & đánh giá → Giá & quy cách → Giao hàng & mua → Đặc điểm (+ thanh mua cố định)
 */
export default function ProductMainSection({
  product,
  gallery,
  siblingProducts = [],
  showPlaceholders = true,
}: ProductMainSectionProps) {
  const isVegan = Boolean(product.isVegan || VEGAN_PRODUCT_IDS.has(product.id) || VEGAN_PRODUCT_IDS.has(product.slug));
  const { language } = useLanguage();
  const isEn = language === 'en';
  const { flyToCart } = useFlyToCart();
  const [quantity, setQuantity] = useState(1);

  // Sắp xếp quy cách đóng gói theo thứ tự số lượng tăng dần (7 -> 10 -> 12 -> 15)
  const sortedVariants = useMemo(() => sortVariants(product.variants), [product.variants]);

  const [activeVariant, setActiveVariant] = useState(
    () => sortedVariants[0]?.id || product.variants?.[0]?.id || 'standard'
  );

  const [addedMessage, setAddedMessage] = useState<string | null>(null);

  // Quản lý thông tin tồn kho theo chi nhánh đang chọn toàn site
  const { selectedBranch, openBranchModal } = useBranchStore();
  const [branchStockStatus, setBranchStockStatus] = useState<'in_stock' | 'low_stock' | 'out_of_stock'>('in_stock');
  const [branchSellableBottles, setBranchSellableBottles] = useState<number | null>(null);
  const [bestAlternativeStore, setBestAlternativeStore] = useState<any | null>(null);

  // Dữ liệu tóm tắt đánh giá thật từ API
  const [reviewSummary, setReviewSummary] = useState<{
    averageRating: number;
    totalReviews: number;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const pId = product.slug || product.id;
    if (!pId) return;
    fetch(`/api/reviews/summary?productId=${encodeURIComponent(pId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.data) {
          setReviewSummary({
            averageRating: Number(data.data.averageRating) || 0,
            totalReviews: Number(data.data.totalReviews) || 0,
          });
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [product.id, product.slug]);

  // Nạp dữ liệu tồn kho theo chi nhánh đang chọn cho sản phẩm này
  useEffect(() => {
    let isMounted = true;
    fetch(`/api/stores?productId=${encodeURIComponent(product.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.stores)) {
          const currentStore = data.stores.find((s: any) => s.code === selectedBranch?.code);
          if (currentStore) {
            setBranchStockStatus(currentStore.stockStatus || 'in_stock');
            setBranchSellableBottles(
              typeof currentStore.sellableQuantity === 'number' ? currentStore.sellableQuantity : null
            );
          } else {
            setBranchStockStatus('in_stock');
            setBranchSellableBottles(null);
          }

          // Lọc danh sách các chi nhánh khác còn hàng khả dụng
          const otherStores = data.stores.filter(
            (s: any) => s.code !== selectedBranch?.code && (s.sellableQuantity ?? 0) > 0
          );
          if (otherStores.length > 0) {
            const sortedAlternatives = [...otherStores].sort(
              (a: any, b: any) => (b.sellableQuantity ?? 0) - (a.sellableQuantity ?? 0)
            );
            setBestAlternativeStore(sortedAlternatives[0]);
          } else {
            setBestAlternativeStore(null);
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching product stock:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [product.id, selectedBranch?.code]);

  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const router = useRouter();

  // Helper for variant names (giữ nguyên định dạng tên dòng giỏ hàng hiện có)
  const getVariantName = (vName: string) => {
    if (language !== 'en') return vName;
    if (vName.includes('5 chai')) return 'Pack of 5 bottles';
    if (vName.includes('7 chai')) return 'Pack of 7 bottles';
    if (vName.includes('10 chai')) return 'Pack of 10 bottles';
    if (vName.includes('12 chai')) return 'Carton of 12 bottles';
    if (vName.includes('15 chai')) return 'Carton of 15 bottles';
    if (vName.includes('6 chai') || vName.includes('Lốc 6')) return 'Pack of 6 bottles';
    if (vName.includes('24 chai') || vName.includes('Thùng 24')) return 'Carton of 24 bottles';
    if (vName.includes('Combo 4')) return 'Combo of 4 bottles';
    if (vName.includes('Combo 10')) return 'Combo of 10 bottles';
    return vName;
  };

  // Quy cách đang chọn (luôn ưu tiên gói quy cách tiêu chuẩn, không bán lẻ 1 chai)
  const currentVariant = product.variants?.find((v) => v.id === activeVariant) || sortedVariants[0] || product.variants?.[0];
  const currentPrice = currentVariant ? currentVariant.price : product.price;
  const currentUnit = currentVariant ? getVariantName(currentVariant.name) : (isEn ? (product.unitEn || 'bottle') : product.unit);
  const displayName = (isEn && product.nameEn) ? product.nameEn : product.name;
  const bottleVolume = getBottleVolume(product, currentVariant);
  const detailContent = getProductDetailContent(product);
  const highlights = detailContent.highlights || DEFAULT_PRODUCT_DETAIL.highlights;
  const originalPrice = currentVariant ? getVariantOriginalPrice(product, currentVariant) : null;

  const bottleCount = currentVariant?.quantity || 1;

  // Tính toán tồn kho theo quy cách đóng gói & chi nhánh
  const maxPacksAllowedByRule = getItemMaxQuantity({
    productId: currentVariant ? `${product.id}-${currentVariant.id}` : product.id,
    variantId: currentVariant?.id,
    name: currentVariant ? `${displayName} (${getVariantName(currentVariant.name)})` : displayName,
    unit: currentUnit,
  });

  const branchPacksAvailable = branchSellableBottles !== null
    ? Math.max(0, Math.floor(branchSellableBottles / bottleCount))
    : maxPacksAllowedByRule;

  const maxAvailableInBranch = Math.min(maxPacksAllowedByRule, branchPacksAvailable);

  // Món này đã có bao nhiêu gói trong giỏ hàng
  const currentCartItem = cartItems.find(
    (it) =>
      (it.productId === (currentVariant ? `${product.id}-${currentVariant.id}` : product.id) ||
        it.productId === product.id) &&
      it.variantId === currentVariant?.id
  );
  const existingCartQty = currentCartItem?.quantity || 0;

  // Số lượng tối đa có thể thêm vào giỏ hàng
  const remainingCanAdd = Math.max(0, maxAvailableInBranch - existingCartQty);

  const isOutOfStock = branchSellableBottles !== null
    ? maxAvailableInBranch <= 0
    : branchStockStatus === 'out_of_stock';

  const isLowStock = !isOutOfStock && branchSellableBottles !== null
    ? maxAvailableInBranch <= 10
    : branchStockStatus === 'low_stock';

  // Quy cách không đủ hàng tại chi nhánh (chỉ khi hệ thống trả về số chai thực tế)
  const unavailableVariantIds = useMemo(() => {
    if (branchSellableBottles === null) return undefined;
    return new Set(
      sortedVariants.filter((v) => Math.floor(branchSellableBottles / (v.quantity || 1)) < 1).map((v) => v.id)
    );
  }, [branchSellableBottles, sortedVariants]);

  // Tự động điều chỉnh quantity nếu vượt quá số lượng tồn khả dụng
  useEffect(() => {
    if (remainingCanAdd > 0 && quantity > remainingCanAdd) {
      setQuantity(Math.max(1, remainingCanAdd));
    }
  }, [remainingCanAdd, activeVariant]);

  useEffect(() => {
    if (!addedMessage) return;
    const t = setTimeout(() => setAddedMessage(null), 3000);
    return () => clearTimeout(t);
  }, [addedMessage]);

  const buildCartPayload = () => ({
    productId: currentVariant ? `${product.id}-${currentVariant.id}` : product.id,
    name: currentVariant ? `${displayName} (${getVariantName(currentVariant.name)})` : displayName,
    slug: product.slug,
    price: currentPrice,
    unit: currentUnit,
    thumbnail: product.thumbnail,
    variantId: currentVariant?.id,
    variantName: currentVariant?.name,
  });

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isOutOfStock || remainingCanAdd <= 0) return;

    // Tìm ảnh chính sản phẩm trong gallery hoặc fallback về nút bấm
    const mainImg = document.querySelector('[data-product-main-image]') as HTMLElement | null;
    const btn = e.currentTarget as HTMLElement;
    const mainImgVisible = mainImg ? mainImg.getBoundingClientRect().bottom > 0 : false;

    flyToCart({
      startElement: mainImgVisible && mainImg ? mainImg : btn,
      imageSrc: product.thumbnail,
    });

    const qtyToAdd = Math.min(quantity, remainingCanAdd);
    addItem(buildCartPayload(), qtyToAdd);

    const label = currentVariant ? getVariantLabel(currentVariant, language) : currentUnit;
    setAddedMessage(
      isEn ? `Added ${qtyToAdd} × ${label} to cart.` : `Đã thêm ${qtyToAdd} × ${label} vào giỏ hàng.`
    );
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;

    if (remainingCanAdd > 0) {
      addItem(buildCartPayload(), Math.min(quantity, remainingCanAdd));
    }

    router.push('/thanh-toan');
  };

  // Thanh mua hàng mobile: hiện khi khối nút của Buy Box không nằm trong màn hình
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsInView, setActionsInView] = useState(true);
  const [footerInView, setFooterInView] = useState(false);
  useEffect(() => {
    const el = actionsRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setActionsInView(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [isOutOfStock]);
  // Ẩn thanh khi chạm Footer để không che thông tin liên hệ cuối trang
  useEffect(() => {
    // Tra cứu footer mỗi lần cuộn (footer thuộc layout chung, có thể render sau component này)
    const check = () => {
      const footer = document.querySelector('footer');
      setFooterInView(Boolean(footer && footer.getBoundingClientRect().top < window.innerHeight));
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  const scrollToReviews = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById('danh-gia') || document.getElementById('danh-gia-khach-hang');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const overviewRows: { label: string; value: string }[] = [
    { label: isEn ? 'Brand' : 'Thương hiệu', value: STORE_SALES_INFO.seller },
    { label: isEn ? 'Flavor' : 'Hương vị', value: getShortProductName(product, language) },
    ...(bottleVolume ? [{ label: isEn ? 'Bottle volume' : 'Dung tích chai', value: bottleVolume }] : []),
    ...(currentVariant
      ? [{ label: isEn ? 'Selected pack' : 'Quy cách đang chọn', value: getVariantLabel(currentVariant, language) }]
      : []),
    ...(isVegan ? [{ label: isEn ? 'Diet' : 'Chế độ ăn', value: isEn ? 'Vegan' : 'Thuần chay' }] : []),
    { label: isEn ? 'Origin' : 'Xuất xứ', value: detailContent.origin || DEFAULT_PRODUCT_DETAIL.origin },
  ];

  const packLabel = currentVariant
    ? `${getVariantLabel(currentVariant, language)}${bottleVolume ? ` × ${bottleVolume}` : ''}`
    : currentUnit;

  return (
    <>
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 md:grid-rows-[auto_auto_1fr] xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)] xl:grid-rows-[auto_1fr] xl:gap-x-8">
        {/* ── VÙNG 1: GALLERY ── */}
        <div className="min-w-0 md:col-start-1 md:row-start-1 md:row-span-3 xl:row-span-2 md:sticky md:top-[168px] md:self-start">
          <div key="gallery">{gallery}</div>
          {/* Thẻ sản phẩm được tài trợ dưới thư viện ảnh (khối có sẵn của TSF) */}
          <div className="hidden md:block mt-4">
            <ProductSponsoredMiniCard currentProductId={product.id} hideUnverifiedStats randomize />
          </div>
        </div>

        {/* ── VÙNG 2: THÔNG TIN MUA HÀNG CHÍNH ── */}
        <div className="min-w-0 md:col-start-2 md:row-start-1 xl:col-start-2 space-y-3">
          <Link
            href="/#ve-chung-toi"
            className="inline-block text-[13px] text-forest-700 hover:text-copper-600 hover:underline"
          >
            {isEn ? 'Visit the Thái Sơn Foods store' : 'Ghé thăm cửa hàng Thái Sơn Foods'}
          </Link>

          <h1 className="text-xl sm:text-2xl xl:text-[24px] font-medium text-ink-950 leading-snug break-words">
            {displayName}
          </h1>

          {/* Đánh giá thật từ hệ thống + SKU */}
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm">
            {reviewSummary && reviewSummary.totalReviews > 0 ? (
              <a href="#danh-gia" onClick={scrollToReviews} className="inline-flex items-center gap-1.5 group">
                <span className="text-ink-950 text-[1.125em]">{reviewSummary.averageRating.toFixed(1)}</span>
                <span className="flex items-center gap-0.5" aria-hidden>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={cn(
                        'w-4 h-4',
                        s <= Math.round(reviewSummary.averageRating)
                          ? 'fill-amber-500 text-amber-500'
                          : 'fill-gray-200 text-gray-200'
                      )}
                    />
                  ))}
                </span>
                <span className="text-forest-700 group-hover:text-copper-600 group-hover:underline">
                  {reviewSummary.totalReviews} {isEn ? 'ratings' : 'đánh giá'}
                </span>
              </a>
            ) : (
              <a
                href="#danh-gia"
                onClick={scrollToReviews}
                className="text-gray-600 hover:text-green-primary hover:underline"
              >
                {isEn ? 'No reviews yet — be the first' : 'Chưa có đánh giá — hãy là người đầu tiên'}
              </a>
            )}
            <span className="text-xs text-gray-500 font-mono">SKU: {product.sku}</span>
          </div>

          <MonthlySalesInfo itemId={product.id} itemType="product" />

          {/* Nhãn thuộc tính có trong dữ liệu */}
          {(isVegan || product.isBestSeller || product.isNew) && (
            <div className="flex flex-wrap gap-1.5">
              {product.isBestSeller && (
                <span className="text-[12px] px-2 py-0.5 rounded bg-sale text-white">
                  {isEn ? 'Best seller' : 'Bán chạy'}
                </span>
              )}
              {product.isNew && (
                <span className="text-[12px] px-2 py-0.5 rounded bg-sky-600 text-white">
                  {isEn ? 'New' : 'Mới'}
                </span>
              )}
              {isVegan && (
                <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {isEn ? 'Vegan' : 'Thuần chay'}
                </span>
              )}
            </div>
          )}

          <div className="border-t border-gray-200 pt-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[26px] leading-none text-ink-950">{formatPrice(currentPrice)}đ</span>
              {currentVariant && (
                <span className="text-sm text-gray-600">
                  ({formatPrice(getUnitPrice(currentVariant))}đ/{isEn ? 'bottle' : 'chai'})
                </span>
              )}
            </div>
            {originalPrice && (
              <p className="text-xs text-gray-500 mt-1">
                {isEn ? 'List price: ' : 'Giá gốc: '}
                <span className="line-through">{formatPrice(originalPrice)}đ</span>
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {isEn ? 'Sold by pack, not by single bottle.' : 'Giá bán theo quy cách đóng gói, không bán lẻ từng chai.'}
            </p>
          </div>

          {showPlaceholders && <CouponPlaceholder />}

          <PackSizeSelector
            product={product}
            variants={sortedVariants}
            activeVariantId={currentVariant?.id}
            onSelect={setActiveVariant}
            unavailableIds={unavailableVariantIds}
            language={language}
          />

          {/* Hương vị khác trong cùng danh mục */}
          {siblingProducts.length > 1 && (
            <div className="pt-1">
              <p className="text-sm text-ink-950 mb-2">
                {isEn ? 'Flavor: ' : 'Hương vị: '}
                <strong className="text-[1.125em]">{getShortProductName(product, language)}</strong>
              </p>
              <div className="flex flex-wrap gap-2 pb-1">
                {siblingProducts.map((p) => {
                  const isCurrent = isSameProduct(p, product);
                  return (
                    <Link
                      key={p.id}
                      href={`/san-pham/${p.slug}`}
                      aria-current={isCurrent ? 'page' : undefined}
                      title={getShortProductName(p, language)}
                      className={cn(
                        'shrink-0 w-[76px] rounded-lg p-1 text-center transition-colors',
                        isCurrent ? 'border-2 border-green-primary' : 'border border-gray-300 hover:border-gray-500'
                      )}
                    >
                      <span className="relative block w-full aspect-[4/3] rounded overflow-hidden bg-white">
                        <Image src={getProductImage(p)} alt="" fill sizes="76px" className="object-contain" />
                      </span>
                      <span className="block text-[10.5px] leading-tight text-ink-950 mt-1 line-clamp-2 min-h-[2.4em]">
                        {getShortProductName(p, language)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bảng tóm tắt thuộc tính chính (dữ liệu thật) */}
          <table className="w-full text-[13px]">
            <tbody>
              {overviewRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="w-[42%] py-1 pr-3 text-left text-ink-950 align-top text-[1.125em]">
                    {row.label}
                  </th>
                  <td className="py-1 text-ink-950">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── VÙNG 3: BUY BOX ── */}
        <div className="min-w-0 md:col-start-2 md:row-start-2 xl:col-start-3 xl:row-start-1 xl:row-span-2 xl:self-start">
          <ProductBuyBox
            ref={actionsRef}
            variant={currentVariant}
            price={currentPrice}
            originalPrice={originalPrice}
            bottleVolume={bottleVolume}
            quantity={quantity}
            onQuantityChange={(v) => setQuantity(Math.max(1, Math.min(v, Math.max(1, remainingCanAdd))))}
            onQuantityStep={(delta) =>
              setQuantity((q) => Math.max(1, Math.min(q + delta, Math.max(1, remainingCanAdd))))
            }
            stock={{
              isOutOfStock,
              isLowStock,
              packsAvailable: branchSellableBottles !== null ? maxAvailableInBranch : null,
              remainingCanAdd,
              existingCartQty,
              alternativeStoreName: bestAlternativeStore?.name ?? null,
            }}
            branchName={selectedBranch?.name}
            onChangeBranch={openBranchModal}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            addedMessage={addedMessage}
            storageText={detailContent.storage || DEFAULT_PRODUCT_DETAIL.storage}
            expiryText={detailContent.expiry || DEFAULT_PRODUCT_DETAIL.expiry}
            certification={detailContent.certification || DEFAULT_PRODUCT_DETAIL.certification}
            language={language}
            showPlaceholders={showPlaceholders}
            itemId={product.id}
            itemType="product"
          />
          {/* Khối hội viên + gợi ý được tài trợ (khối có sẵn của TSF) dưới Buy Box */}
          <div className="hidden xl:block mt-4">
            <ProductSidebarSponsoredCard currentProductId={product.id} hideUnverifiedStats randomize />
          </div>
        </div>

        {/* ── VÙNG 4: ĐẶC ĐIỂM NỔI BẬT ── */}
        <div className="min-w-0 md:col-start-2 md:row-start-3 xl:col-start-2 xl:row-start-2 self-start">
          <div className="border-t border-gray-200 pt-4">
            <h2 className="text-lg text-ink-950 mb-2">
              {isEn ? 'Key highlights' : 'Đặc điểm nổi bật'}
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink-950 leading-relaxed marker:text-gray-400">
              {highlights.map((item) => (
                <li key={item.labelVi}>
                  <strong className="text-[1.125em]">{isEn ? item.labelEn : item.labelVi}:</strong>{' '}
                  {isEn ? item.contentEn : item.contentVi}
                </li>
              ))}
              {product.shortDescription && (
                <li>{(isEn && product.shortDescriptionEn) || product.shortDescription}</li>
              )}
            </ul>
            <a
              href="#thong-tin-san-pham"
              className="inline-flex items-center gap-0.5 mt-2 text-[13px] text-forest-700 hover:text-copper-600 hover:underline"
            >
              {isEn ? 'See full product information' : 'Xem thông tin chi tiết sản phẩm'}
              <ChevronRight className="w-3.5 h-3.5" aria-hidden />
            </a>
          </div>

          {/* Màn hình nhỏ hơn xl: các khối được tài trợ chuyển xuống dưới phần đặc điểm */}
          <div className="xl:hidden mt-6 space-y-4">
            <div className="md:hidden">
              <ProductSponsoredMiniCard currentProductId={product.id} hideUnverifiedStats randomize />
            </div>
            <ProductSidebarSponsoredCard currentProductId={product.id} hideUnverifiedStats randomize />
          </div>
        </div>
      </div>

      <MobileBuyBar
        visible={!actionsInView && !footerInView}
        price={currentPrice}
        packLabel={packLabel}
        canAdd={!isOutOfStock && remainingCanAdd > 0}
        isOutOfStock={isOutOfStock}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        onChangeBranch={openBranchModal}
        language={language}
      />
    </>
  );
}

export function AmazonProductBreadcrumb({
  product,
  category,
}: {
  product: Product;
  category?: { id: string; name: string; nameEn?: string; slug: string };
}) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  const categoryName = isEn ? (category?.nameEn || category?.name) : category?.name;

  return (
    <div className="max-w-[1456px] mx-auto px-4 sm:px-6 pt-3 pb-1 text-xs">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-gray-600 min-w-0">
          <li className="shrink-0">
            <Link href="/" className="hover:text-copper-600 hover:underline">
              {isEn ? 'Home' : 'Trang chủ'}
            </Link>
          </li>
          <li className="shrink-0" aria-hidden><ChevronRight className="w-3 h-3 text-gray-400" /></li>
          <li className="shrink-0">
            <Link href="/#san-pham" className="hover:text-copper-600 hover:underline">
              {isEn ? 'Products' : 'Sản phẩm'}
            </Link>
          </li>
          {categoryName && (
            <>
              <li className="shrink-0" aria-hidden><ChevronRight className="w-3 h-3 text-gray-400" /></li>
              <li className="shrink-0">{categoryName}</li>
            </>
          )}
          <li className="shrink-0" aria-hidden><ChevronRight className="w-3 h-3 text-gray-400" /></li>
          <li className="text-ink-950 font-medium truncate min-w-0" aria-current="page">
            {getShortProductName(product, language)}
          </li>
        </ol>
      </nav>
    </div>
  );
}
