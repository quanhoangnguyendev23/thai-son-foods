'use client';

import { discountLabel, discountPercentSuffix } from '@/lib/discount-label';
import { useState, useRef, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Combo, Product, ProductImage } from '@/types';
import { formatPrice, cn } from '@/lib/utils';
import { useCartStore } from '@/store/cart';
import { useFlyToCart } from '@/context/FlyToCartContext';
import { ChevronRight, Clock, Star } from 'lucide-react';
import { msUntilNextVnMidnight, useTodayDealIds } from '@/lib/daily-deals';
import { useLanguage } from '@/context/LanguageContext';
import { useBranchStore } from '@/store/branch';
import { DEFAULT_PRODUCT_DETAIL, STORE_SALES_INFO } from '@/data/product-detail-content';
import { getShortProductName } from '@/lib/product-detail';
import MobileBuyBar from '@/components/product/MobileBuyBar';
import ProductGallery from '@/components/product/ProductGallery';
import ProductBuyBox from '@/components/product/ProductBuyBox';
import ProductSponsoredMiniCard from '@/components/product/ProductSponsoredMiniCard';
import ProductSidebarSponsoredCard from '@/components/product/ProductSidebarSponsoredCard';
import { CouponPlaceholder } from '@/components/product/ProductPlaceholderBlocks';
import { MonthlySalesInfo } from '@/components/product/ProductRealBlocks';

interface ComboProductDetailItem {
  quantity: number;
  productId: string;
  product: Product | null;
}

interface ComboDetailViewProps {
  combo: Combo;
  productsDetail: ComboProductDetailItem[];
  initialStock?: number | null;
  initialStockDetails?: any[];
}

/**
 * Nhãn "Deal trong ngày" + đồng hồ HH:MM:SS ngay trên giá (không ghi chữ giải thích cơ chế) — chỉ hiện khi combo thuộc bộ deal hôm nay
 * (cùng thuật toán/nguồn với dải Deal trong ngày ở trang chủ). Đồng hồ thật tới 0h giờ VN, chỉ chạy sau mount.
 * Qua 0h: combo không còn trong bộ deal mới → nhãn tự ẩn; vẫn còn → đếm lại. Giá combo không đổi nên không ghi "Kết thúc".
 */
function DailyDealBadge({ comboId, isEn }: { comboId: string; isEn: boolean }) {
  const dealIds = useTodayDealIds();
  const isDeal = dealIds.has(comboId);
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    if (!isDeal) return;
    const tick = () => setMs(msUntilNextVnMidnight());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [isDeal]);

  if (!isDeal || ms === null) return null;
  const total = Math.floor(ms / 1000);
  const hhmmss = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');

  return (
    <p className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-md bg-brand-crimson text-white text-sm">
      <span>{isEn ? "Today's deal" : 'Deal trong ngày'}</span>
      <Clock className="w-4 h-4 shrink-0" aria-hidden />
      <span className="tabular-nums" aria-label={isEn ? "Time left for today's deal" : 'Thời gian còn lại của deal trong ngày'}>
        {hhmmss}
      </span>
    </p>
  );
}

export default function ComboDetailView({
  combo,
  productsDetail,
  initialStock = null,
  initialStockDetails = [],
}: ComboDetailViewProps) {
  const { language } = useLanguage();
  const router = useRouter();
  const { flyToCart } = useFlyToCart();
  const addItem = useCartStore((s) => s.addItem);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<{ averageRating: number; totalReviews: number } | null>(null);
  // Thanh mua hàng cố định (mobile/tablet): chỉ hiện khi khối nút mua đã cuộn khỏi màn hình
  const buyButtonsRef = useRef<HTMLDivElement>(null);
  const [showMobileBuyBar, setShowMobileBuyBar] = useState(false);

  // Chi nhánh & Tồn kho
  const { selectedBranch, openBranchModal } = useBranchStore();
  const [isAvailable, setIsAvailable] = useState(true);
  const [checkingStock, setCheckingStock] = useState(false);
  const [availableStock, setAvailableStock] = useState<number | null>(initialStock);
  const [stockStatus, setStockStatus] = useState<'in_stock' | 'low' | 'out'>('in_stock');
  const [alternativeStores, setAlternativeStores] = useState<any[]>([]);

  // Hàm chuyển đổi tên ngắn cho chai thành phần trong combo
  const getShortBottleName = (fullName: string) => {
    return fullName
      .replace(/\s*Chai\s*330ml/gi, '')
      .replace(/\s*330ml/gi, '')
      .replace(/\s*Thức Uống\s*/gi, '')
      .replace(/\s*Đóng Chai\s*/gi, '')
      .trim();
  };

  useEffect(() => {
    let active = true;
    setCheckingStock(true);
    fetch('/api/inventory/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeCode: selectedBranch?.code || 'NH',
        items: [{ productId: combo.id, quantity }],
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (!active) return;
        if (res.success) {
          setIsAvailable(res.isAvailable);
          const stock = typeof res.maxQuantity === 'number' ? res.maxQuantity : (typeof res.availableStock === 'number' ? res.availableStock : null);
          setAvailableStock(stock);
          setStockStatus(res.status || (stock === 0 ? 'out' : stock !== null && stock <= 10 ? 'low' : 'in_stock'));
          setAlternativeStores(res.alternativeStores || []);

          if (stock !== null && stock > 0 && quantity > stock) {
            setQuantity(stock);
          }
        }
      })
      .catch((err) => console.error('Error checking combo stock:', err))
      .finally(() => {
        if (active) setCheckingStock(false);
      });

    return () => {
      active = false;
    };
  }, [combo.id, quantity, selectedBranch?.code]);

  const savingsAmount = combo.originalPrice - combo.salePrice;
  const avgBottlePrice = Math.round(combo.salePrice / combo.totalItems);

  // Trang combo tự chọn (/combo) đã gỡ: mọi combo bán theo giá cố định trong bảng combos, mua trực tiếp tại đây
  const isCustomizable = false as boolean;
  const customizeLink = '/#combo';

  const comboTitle = (language === 'en' && combo.nameEn) ? combo.nameEn : combo.name;
  const comboDesc = (language === 'en' && combo.descriptionEn) ? combo.descriptionEn : combo.description;

  // Tóm tắt đánh giá thật từ API (cùng khóa productId với khối đánh giá bên dưới)
  useEffect(() => {
    let isMounted = true;
    const pId = `combo:${combo.slug || combo.id}`;
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
  }, [combo.id, combo.slug]);

  useEffect(() => {
    const el = buyButtonsRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setShowMobileBuyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isCustomizable]);

  // Danh sách hình ảnh mô tả combo (ảnh chính combo + ảnh các chai thành phần + Bảng Icon tiêu chuẩn)
  const galleryImages = useMemo(() => {
    const list: { id: string; url: string; alt: string; label?: string }[] = [];

    // 1. Ảnh chính trọn bộ Combo & các ảnh combo được cấu hình từ Admin
    if (combo.images && combo.images.length > 0) {
      combo.images.forEach((cImg, idx) => {
        list.push({
          id: cImg.id || `combo-img-${idx}`,
          url: cImg.url,
          alt: cImg.alt || comboTitle,
          label: cImg.isPrimary ? (language === 'en' ? 'Combo Set' : 'Trọn bộ Combo') : undefined,
        });
      });
    } else if (combo.image) {
      list.push({
        id: `combo-main-${combo.id}`,
        url: combo.image,
        alt: comboTitle,
        label: language === 'en' ? 'Combo Set' : 'Trọn bộ Combo',
      });
    }

    // 2. Ảnh của từng sản phẩm thành phần trong combo
    productsDetail.forEach((item, pIdx) => {
      const p = item.product;
      if (!p) return;
      const pName = (language === 'en' && p.nameEn) ? p.nameEn : p.name;

      // Ảnh thumbnail chính của chai
      if (p.thumbnail && !list.some((img) => img.url === p.thumbnail)) {
        list.push({
          id: `prod-thumb-${p.id}-${pIdx}`,
          url: p.thumbnail,
          alt: pName,
          label: `${pName} (x${item.quantity})`,
        });
      }

      // Các ảnh phụ/chi tiết của chai (bỏ qua icon tiêu chuẩn & bảng dinh dưỡng đơn để ghim riêng ở thumbnail 3 & 4)
      if (p.images && p.images.length > 0) {
        p.images.forEach((img, imgIdx) => {
          const isSpecial = img.url.includes('bang-icon') || 
                            img.url.includes('sua-bap-nep-3') ||
                            img.url.includes('sua-bap-nep-4') ||
                            img.url.includes('bang-thong-tin');
          if (img.url && !isSpecial && !list.some((existing) => existing.url === img.url)) {
            list.push({
              id: `prod-img-${p.id}-${imgIdx}`,
              url: img.url,
              alt: img.alt || pName,
              label: pName,
            });
          }
        });
      }
    });

    // 3. Ghim Bảng Icon tiêu chuẩn vào thumbnail thứ 3 (index 2)
    const standardIconImage = {
      id: `combo-cert-icon-${combo.id}`,
      url: '/images/products/bang-icon.png',
      alt: language === 'en' ? 'Quality Standards & Certifications' : 'Bảng Icon tiêu chuẩn',
      label: language === 'en' ? 'Standards & Certifications' : 'Bảng Icon',
    };

    if (list.length >= 2) {
      list.splice(2, 0, standardIconImage);
    } else {
      list.push(standardIconImage);
    }

    // 4. Ghim Bảng thông tin thành phần combo vào thumbnail thứ 4 (index 3)
    const nutritionInfoImage = {
      id: `combo-nutrition-info-${combo.id}`,
      url: '/images/combos/bang-thong-tin-thanh-phan-combo.png',
      alt: language === 'en' ? 'Combo Ingredients & Nutrition Facts' : 'Bảng thông tin thành phần combo',
      label: language === 'en' ? 'Nutrition Facts' : 'Thông tin thành phần',
    };

    if (list.length >= 3) {
      list.splice(3, 0, nutritionInfoImage);
    } else {
      list.push(nutritionInfoImage);
    }

    // Ràng buộc: tối đa 5 hình ảnh mô tả
    const capped = list.length > 5 ? list.slice(0, 5) : list;

    return capped.length > 0
      ? capped
      : [{ id: 'default', url: combo.image || '/images/combos/combo-1.jpg', alt: comboTitle }];
  }, [combo.image, combo.id, comboTitle, productsDetail, language]);

  const handleAddToCart = (e?: React.MouseEvent) => {
    if (e) {
      const mainImg = document.querySelector('[data-product-main-image]') as HTMLElement | null;
      flyToCart({
        startElement: mainImg || (e.currentTarget as HTMLElement),
        imageSrc: combo.image,
      });
    }

    addItem(
      {
        productId: combo.id,
        name: comboTitle,
        slug: combo.slug || `#combo-${combo.id}`,
        price: combo.salePrice,
        unit: `${combo.totalItems} ${language === 'en' ? 'bottles' : 'chai'}`,
        thumbnail: combo.image,
      },
      quantity
    );

    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const handleBuyNow = () => {
    addItem(
      {
        productId: combo.id,
        name: comboTitle,
        slug: combo.slug || `#combo-${combo.id}`,
        price: combo.salePrice,
        unit: `${combo.totalItems} ${language === 'en' ? 'bottles' : 'chai'}`,
        thumbnail: combo.image,
      },
      quantity
    );
    router.push('/thanh-toan');
  };

  const isEn = language === 'en';
  const isOutOfStock = !isAvailable || availableStock === 0;
  const isLowStock = !isOutOfStock && availableStock !== null && availableStock <= 10;
  const remainingCanAdd = availableStock !== null ? availableStock : 99;
  const galleryForDisplay: ProductImage[] = galleryImages.map((img, idx) => ({
    id: img.id,
    url: img.url,
    alt: img.alt,
    sortOrder: idx + 1,
  }));

  const scrollToReviews = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById('danh-gia') || document.getElementById('danh-gia-khach-hang');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const overviewRows: { label: string; value: string }[] = [
    { label: isEn ? 'Brand' : 'Thương hiệu', value: STORE_SALES_INFO.seller },
    { label: isEn ? 'Pack' : 'Quy cách', value: `${combo.totalItems} ${isEn ? 'bottles / carton' : 'chai / thùng'}` },
    {
      label: isEn ? 'Combo type' : 'Loại combo',
      value: isCustomizable
        ? (isEn ? 'Customizable flavors' : 'Tự chọn vị')
        : (isEn ? 'Pre-packed' : 'Đóng gói sẵn'),
    },
    { label: isEn ? 'Origin' : 'Xuất xứ', value: DEFAULT_PRODUCT_DETAIL.origin },
  ];

  return (
    <div className="w-full">
      {/* ─── Breadcrumb (đồng bộ chi tiết sản phẩm) ─── */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 pt-3 pb-1 text-xs">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1 text-gray-600 min-w-0">
            <li className="shrink-0">
              <Link href="/" className="hover:text-copper-600 hover:underline">
                {isEn ? 'Home' : 'Trang chủ'}
              </Link>
            </li>
            <li className="shrink-0" aria-hidden><ChevronRight className="w-3 h-3 text-gray-400" /></li>
            <li className="shrink-0">
              <Link href="/#combo" className="hover:text-copper-600 hover:underline">
                {isEn ? 'Value Combos' : 'Combo tiết kiệm'}
              </Link>
            </li>
            <li className="shrink-0" aria-hidden><ChevronRight className="w-3 h-3 text-gray-400" /></li>
            <li className="text-ink-950 font-medium truncate min-w-0" aria-current="page">
              {comboTitle}
            </li>
          </ol>
        </nav>
      </div>

      {/* ─── Khu vực chính: Gallery | Thông tin | Buy Box (cùng lưới với chi tiết sản phẩm) ─── */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 pt-3 pb-8 lg:pb-10">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 md:grid-rows-[auto_auto_1fr] xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)] xl:grid-rows-[auto_1fr] xl:gap-x-8">
          {/* ── VÙNG 1: GALLERY ── */}
          <div className="min-w-0 md:col-start-1 md:row-start-1 md:row-span-3 xl:row-span-2 md:sticky md:top-[168px] md:self-start">
            <ProductGallery
              images={galleryForDisplay}
              productName={comboTitle}
              currentProductId={combo.id}
              showAllThumbnails
            />
            <div className="hidden md:block mt-4">
              <ProductSponsoredMiniCard currentProductId={combo.id} hideUnverifiedStats randomize />
            </div>
          </div>

          {/* ── VÙNG 2: THÔNG TIN CHÍNH ── */}
          <div className="min-w-0 md:col-start-2 md:row-start-1 xl:col-start-2 space-y-3">
            <Link
              href="/#ve-chung-toi"
              className="inline-block text-sm text-forest-700 hover:text-copper-600 hover:underline"
            >
              {isEn ? 'Visit the Thái Sơn Foods store' : 'Ghé thăm cửa hàng Thái Sơn Foods'}
            </Link>

            <h1 className="text-xl sm:text-2xl xl:text-2xl font-medium text-ink-950 leading-snug break-words">
              {comboTitle}
            </h1>

            {/* Đánh giá thật từ hệ thống + mã combo */}
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm">
              {reviewSummary && reviewSummary.totalReviews > 0 ? (
                <a href="#danh-gia" onClick={scrollToReviews} className="inline-flex items-center gap-1.5 group">
                  <span className="text-ink-950 text-emph">{reviewSummary.averageRating.toFixed(1)}</span>
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
            </div>

            <MonthlySalesInfo itemId={combo.id} itemType="combo" slug={combo.slug} />

            {/* Nhãn thuộc tính */}
            <div className="flex flex-wrap gap-1.5">
              {combo.isBestSeller && (
                <span className="text-xs px-2 py-0.5 rounded bg-sale text-white">{isEn ? 'Best seller' : 'Bán chạy'}</span>
              )}
              {discountLabel(combo) && (
                <span className="text-xs px-2 py-0.5 rounded bg-sale text-white">{discountLabel(combo)}</span>
              )}
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                {isCustomizable
                  ? (isEn ? 'Customizable Combo' : 'Combo tự chọn vị')
                  : (isEn ? 'Pre-packed Combo' : 'Combo đóng gói sẵn')}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                {combo.totalItems} {isEn ? 'bottles' : 'chai'}
              </span>
            </div>

            {/* Giá */}
            <div className="border-t border-gray-200 pt-3">
              <DailyDealBadge comboId={combo.id} isEn={isEn} />
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl leading-none text-ink-950">{formatPrice(combo.salePrice)}đ</span>
                <span className="text-sm text-gray-600">
                  ({formatPrice(avgBottlePrice)}đ/{isEn ? 'bottle' : 'chai'})
                </span>
              </div>
              {combo.originalPrice > combo.salePrice && (
                <p className="text-xs text-gray-500 mt-1">
                  {isEn ? 'List price: ' : 'Giá gốc: '}
                  <span className="line-through">{formatPrice(combo.originalPrice)}đ</span>
                  <span className="ml-2 text-sale">
                    {isEn
                      ? `Save ${formatPrice(savingsAmount)}đ${discountPercentSuffix(combo)}`
                      : `Tiết kiệm ${formatPrice(savingsAmount)}đ${discountPercentSuffix(combo)}`}
                  </span>
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {isEn ? 'Sold by combo, not by single bottle.' : 'Giá bán theo combo, không bán lẻ từng chai.'}
              </p>
            </div>

            <CouponPlaceholder />

            {/* Combo gồm: lưới thẻ ảnh cùng kiểu ô "Hương vị" của trang sản phẩm (chỉ để xem, bấm sang trang sản phẩm) */}
            {productsDetail.length > 0 && (
              <div className="pt-1">
                <p className="text-sm text-ink-950 mb-2">
                  {isEn ? 'Items in this combo ' : 'Combo gồm '}
                  <strong className="text-emph">
                    ({combo.totalItems} {isEn ? 'bottles' : 'chai'})
                  </strong>
                </p>
                <ul className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-3 xl:grid-cols-4 gap-2 pb-1">
                  {productsDetail.map((item, idx) => {
                    const pFullName = (isEn && item.product?.nameEn)
                      ? item.product.nameEn
                      : (item.product?.name || item.productId);
                    const pShortName = item.product
                      ? getShortProductName(item.product, language)
                      : getShortBottleName(pFullName);
                    const cardBody = (
                      <>
                        <span className="relative block w-full aspect-[4/3] rounded overflow-hidden bg-white">
                          <Image
                            src={item.product?.thumbnail || combo.image}
                            alt=""
                            fill
                            sizes="96px"
                            className="object-contain"
                          />
                        </span>
                        <span className="block text-2xs leading-tight text-ink-950 mt-1 line-clamp-2 min-h-[2.4em]">
                          {pShortName}
                        </span>
                        <span className="block text-2xs leading-tight text-gray-600 mt-0.5">
                          × {item.quantity} {isEn ? 'bottles' : 'chai'}
                        </span>
                      </>
                    );
                    return (
                      <li key={`${item.productId}-${idx}`} className="min-w-0">
                        {item.product ? (
                          <Link
                            href={`/san-pham/${item.product.slug}`}
                            title={isEn ? `View ${pFullName}` : `Xem chi tiết ${item.product.name}`}
                            className="group block h-full rounded-lg p-1 text-center border border-gray-300 transition-all duration-200 motion-reduce:transition-none hover:border-green-primary/70 hover:bg-green-primary/[0.04]"
                          >
                            {cardBody}
                          </Link>
                        ) : (
                          <div title={pFullName} className="block h-full rounded-lg p-1 text-center border border-gray-300">
                            {cardBody}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Bảng tóm tắt thuộc tính chính */}
            <table className="w-full text-sm">
              <tbody>
                {overviewRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="w-[42%] py-1 pr-3 text-left text-ink-950 align-top text-emph">
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
            {isCustomizable ? (
              <div className="rounded-xl border border-gray-300 bg-white p-4 space-y-3.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl leading-none text-ink-950">{formatPrice(combo.salePrice)}đ</span>
                  {combo.originalPrice > combo.salePrice && (
                    <span className="text-sm text-gray-500 line-through">{formatPrice(combo.originalPrice)}đ</span>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/70 text-sm text-emerald-900">
                  <p className="mb-1 text-emph">
                    {isEn
                      ? 'This combo supports flexible flavor customization!'
                      : 'Combo này hỗ trợ tự chọn vị linh hoạt theo sở thích!'}
                  </p>
                  <p className="text-xs text-emerald-800">
                    {isEn
                      ? 'You can customize your own combination of Corn Milk, Lotus Seed Milk, Aloe Vera, or Herbal Tea.'
                      : 'Bạn có thể tự tay phối hợp các hương vị Sữa Bắp, Sâm La Hán, Mủ Trôm hoặc Sữa Hạt theo ý muốn.'}
                  </p>
                </div>
                <Link
                  href={customizeLink}
                  className="w-full h-11 rounded-full text-base inline-flex items-center justify-center gap-2 transition-colors bg-corn hover:bg-corn-dark text-ink-950 border border-corn-dark/60"
                >
                  <span>{isEn ? 'Customize flavors' : 'Tự chọn vị cho Combo'}</span>
                  <ChevronRight className="w-4 h-4" aria-hidden />
                </Link>
                <div className="border-t border-gray-100 pt-3 text-xs text-gray-700 space-y-2">
                  <p>
                    {isEn ? 'Need bulk order advice? ' : 'Cần tư vấn đặt số lượng lớn? '}
                    <a href="tel:02862915024" className="text-forest-700 hover:text-copper-600 hover:underline">
                      Hotline: 028 6291 5024
                    </a>
                  </p>
                </div>
              </div>
            ) : (
              <ProductBuyBox
                ref={buyButtonsRef}
                price={combo.salePrice}
                originalPrice={combo.originalPrice > combo.salePrice ? combo.originalPrice : null}
                quantity={quantity}
                onQuantityChange={(v) => setQuantity(Math.max(1, Math.min(v, Math.max(1, remainingCanAdd))))}
                onQuantityStep={(delta) =>
                  setQuantity((q) => Math.max(1, Math.min(q + delta, Math.max(1, remainingCanAdd))))
                }
                stock={{
                  isOutOfStock,
                  isLowStock,
                  packsAvailable: availableStock,
                  remainingCanAdd,
                  existingCartQty: 0,
                  alternativeStoreName: alternativeStores[0]?.name ?? null,
                }}
                branchName={selectedBranch?.name}
                onChangeBranch={openBranchModal}
                onAddToCart={(e) => handleAddToCart(e)}
                onBuyNow={handleBuyNow}
                addedMessage={isAdded ? (isEn ? 'Added to cart!' : 'Đã thêm combo vào giỏ hàng.') : null}
                storageText={DEFAULT_PRODUCT_DETAIL.storage}
                expiryText={DEFAULT_PRODUCT_DETAIL.expiry}
                certification={DEFAULT_PRODUCT_DETAIL.certification}
                language={language}
                itemId={combo.id}
                itemType="combo"
                priceNote={`Combo ${combo.totalItems} ${isEn ? 'bottles' : 'chai'} · ${formatPrice(combo.salePrice / Math.max(1, combo.totalItems))}đ/${isEn ? 'bottle' : 'chai'}`}
              />
            )}
            <div className="hidden xl:block mt-4">
              <ProductSidebarSponsoredCard currentProductId={combo.id} hideUnverifiedStats randomize />
            </div>
          </div>

          {/* ── VÙNG 4: ĐẶC ĐIỂM NỔI BẬT (Combo gồm đã chuyển lên ngay dưới giá, như trang sản phẩm) ── */}
          <div className="min-w-0 md:col-start-2 md:row-start-3 xl:col-start-2 xl:row-start-2 self-start">
            <div className="border-t border-gray-200 pt-4">
              <h2 className="text-lg text-ink-950 mb-2">
                {isEn ? 'Key highlights' : 'Đặc điểm nổi bật'}
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink-950 leading-relaxed marker:text-gray-400">
                <li>
                  <strong className="text-emph">{isEn ? 'Cooling & Nutritious' : 'Thanh mát bổ dưỡng'}:</strong>{' '}
                  {isEn
                    ? 'Helps cool the body and provide natural healthy vitality.'
                    : 'Giúp giải nhiệt cơ thể và cung cấp năng lượng lành mạnh.'}
                </li>
                <li>
                  <strong className="text-emph">{isEn ? '100% Fresh Ingredients' : '100% Nguyên liệu tươi'}:</strong>{' '}
                  {isEn
                    ? 'No chemical preservatives, strict food safety certification.'
                    : 'Không chất bảo quản, chuẩn vệ sinh an toàn thực phẩm.'}
                </li>
                {comboDesc && <li>{comboDesc}</li>}
              </ul>
            </div>

            {/* Màn hình nhỏ hơn xl: các khối được tài trợ chuyển xuống dưới */}
            <div className="xl:hidden mt-6 space-y-4">
              <div className="md:hidden">
                <ProductSponsoredMiniCard currentProductId={combo.id} hideUnverifiedStats randomize />
              </div>
              <ProductSidebarSponsoredCard currentProductId={combo.id} hideUnverifiedStats randomize />
            </div>
          </div>
        </div>
      </div>

      {!isCustomizable && (
        <MobileBuyBar
          visible={showMobileBuyBar}
          price={combo.salePrice * quantity}
          packLabel={`${combo.totalItems} ${isEn ? 'bottles' : 'chai'}${quantity > 1 ? ` × ${quantity}` : ''}`}
          canAdd={isAvailable && availableStock !== 0}
          isOutOfStock={isOutOfStock}
          onAddToCart={(e) => handleAddToCart(e)}
          onBuyNow={handleBuyNow}
          onChangeBranch={openBranchModal}
          language={language}
        />
      )}
    </div>
  );
}
