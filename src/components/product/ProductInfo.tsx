'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Product } from '@/types';
import { formatPrice } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useCartStore, getItemMaxQuantity } from '@/store/cart';
import { useFlyToCart } from '@/context/FlyToCartContext';
import { useRouter } from 'next/navigation';
import {
  Star,
  Truck,
  RotateCcw,
  Lock,
  ChevronDown,
  Check,
  Info,
  Clock,
  Package,
  Plus,
  Minus,
  ChevronRight,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useBranchStore } from '@/store/branch';

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

interface ProductHighlightItem {
  labelVi: string;
  contentVi: string;
  labelEn: string;
  contentEn: string;
}

const PRODUCT_HIGHLIGHTS: Record<string, ProductHighlightItem[]> = {
  // Sữa Bắp Nếp Thái Sơn
  'sua-bap-nep': [
    {
      labelVi: 'Chứng nhận Quốc tế HACCP',
      contentVi: 'Quy trình sản xuất thanh trùng khép kín, kiểm soát an toàn vệ sinh thực phẩm.',
      labelEn: 'International HACCP Certification',
      contentEn: 'Closed pasteurization process, strict food hygiene and safety control.',
    },
    {
      labelVi: 'Nguyên liệu tuyển chọn',
      contentVi: 'Chế biến từ nguồn bắp nếp và hạt tự nhiên tươi ngon, giữ trọn hương vị béo ngậy thanh thuần.',
      labelEn: 'Selected Ingredients',
      contentEn: 'Processed from fresh glutinous corn and natural grains, preserving rich authentic flavor.',
    },
    {
      labelVi: 'Giàu dưỡng chất',
      contentVi: 'Bổ sung chất xơ tự nhiên, hỗ trợ tiêu hóa và nạp năng lượng tươi mới.',
      labelEn: 'Rich in Nutrients',
      contentEn: 'Supplements natural dietary fiber, supports digestion and recharges fresh energy.',
    },
  ],
  'sua-bap-nep-thai-son': [
    {
      labelVi: 'Chứng nhận Quốc tế HACCP',
      contentVi: 'Quy trình sản xuất thanh trùng khép kín, kiểm soát an toàn vệ sinh thực phẩm.',
      labelEn: 'International HACCP Certification',
      contentEn: 'Closed pasteurization process, strict food hygiene and safety control.',
    },
    {
      labelVi: 'Nguyên liệu tuyển chọn',
      contentVi: 'Chế biến từ nguồn bắp nếp và hạt tự nhiên tươi ngon, giữ trọn hương vị béo ngậy thanh thuần.',
      labelEn: 'Selected Ingredients',
      contentEn: 'Processed from fresh glutinous corn and natural grains, preserving rich authentic flavor.',
    },
    {
      labelVi: 'Giàu dưỡng chất',
      contentVi: 'Bổ sung chất xơ tự nhiên, hỗ trợ tiêu hóa và nạp năng lượng tươi mới.',
      labelEn: 'Rich in Nutrients',
      contentEn: 'Supplements natural dietary fiber, supports digestion and recharges fresh energy.',
    },
  ],
};

const DEFAULT_HIGHLIGHTS: ProductHighlightItem[] = [
  {
    labelVi: 'Chứng nhận Quốc tế HACCP',
    contentVi: 'Quy trình sản xuất thanh trùng khép kín, kiểm soát an toàn vệ sinh thực phẩm.',
    labelEn: 'International HACCP Certification',
    contentEn: 'Strict closed pasteurization technology, ensuring optimal food safety and hygiene.',
  },
  {
    labelVi: '100% Nguyên liệu tuyển chọn',
    contentVi: 'Chế biến từ nguồn nguyên liệu tự nhiên tươi ngon, giữ trọn hương vị thanh thuần.',
    labelEn: '100% Selected Natural Ingredients',
    contentEn: 'Crafted from fresh wholesome natural ingredients, retaining authentic flavor.',
  },
  {
    labelVi: 'Không chất bảo quản hóa học',
    contentVi: 'Đạt tiêu chuẩn vệ sinh an toàn thực phẩm, an tâm cho sức khỏe người dùng.',
    labelEn: 'No Chemical Preservatives',
    contentEn: 'Guaranteed food safety certified, safe and wholesome for the whole family.',
  },
  {
    labelVi: 'Giàu dưỡng chất & Vitamin',
    contentVi: 'Bổ sung vitamin và chất xơ tự nhiên, hỗ trợ tiêu hóa và nạp năng lượng tươi mới.',
    labelEn: 'Rich in Nutrients & Vitamins',
    contentEn: 'Naturally loaded with essential nutrients, boosting vitality and gut wellness.',
  },
];

interface ProductInfoProps {
  product: Product;
}

export default function ProductInfo({ product }: ProductInfoProps) {
  const isVegan = Boolean(product.isVegan || VEGAN_PRODUCT_IDS.has(product.id) || VEGAN_PRODUCT_IDS.has(product.slug));
  const { language } = useLanguage();
  const { flyToCart } = useFlyToCart();
  const [quantity, setQuantity] = useState(1);

  // Sắp xếp quy cách đóng gói theo thứ tự số lượng tăng dần (Chuẩn UX E-commerce: 7 -> 10 -> 12 -> 15 -> 24)
  const sortedVariants = useMemo(() => {
    if (!product.variants) return [];
    return [...product.variants].sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
  }, [product.variants]);

  const [activeVariant, setActiveVariant] = useState(
    () => sortedVariants[0]?.id || product.variants?.[0]?.id || 'standard'
  );

  const [addedToast, setAddedToast] = useState(false);

  // Quản lý thông tin tồn kho theo chi nhánh đang chọn toàn site
  const { selectedBranch, openBranchModal, setSelectedBranch } = useBranchStore();
  const [branchStockStatus, setBranchStockStatus] = useState<'in_stock' | 'low_stock' | 'out_of_stock'>('in_stock');
  const [branchSellableBottles, setBranchSellableBottles] = useState<number | null>(null);
  const [bestAlternativeStore, setBestAlternativeStore] = useState<any | null>(null);
  const [hasOtherBranchInStock, setHasOtherBranchInStock] = useState(false);

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
          setHasOtherBranchInStock(otherStores.length > 0);
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

  // Accordion state - Luôn luôn đóng mặc định, người xem muốn đọc sẽ bấm mở rộng
  const [openAccordions, setOpenAccordions] = useState<{ [key: string]: boolean }>({
    highlights: false,
    details: false,
    measurements: false,
  });

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const router = useRouter();

  // Helper for variant names
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

  // Find selected variant (luôn ưu tiên gói quy cách tiêu chuẩn, không bán lẻ 1 chai)
  const currentVariant = product.variants?.find((v) => v.id === activeVariant) || sortedVariants[0] || product.variants?.[0];
  const currentPrice = currentVariant ? currentVariant.price : product.price;
  const currentUnit = currentVariant ? getVariantName(currentVariant.name) : (language === 'en' ? (product.unitEn || 'bottle') : product.unit);
  const currentVolume = currentVariant?.volume || product.volume || '330ml';
  const bottleVolume = product.volume || (currentVariant?.volume && currentVariant.volume.includes('x') ? currentVariant.volume.split('x').pop()?.trim() : currentVariant?.volume) || '330ml';
  const displayName = (language === 'en' && product.nameEn) ? product.nameEn : product.name;
  const displayShortDesc = (language === 'en' && product.shortDescriptionEn) ? product.shortDescriptionEn : product.shortDescription;
  const highlights = PRODUCT_HIGHLIGHTS[product.id] || PRODUCT_HIGHLIGHTS[product.slug] || DEFAULT_HIGHLIGHTS;

  const bottleCount = currentVariant?.quantity || 1;
  const perBottlePrice = Math.round(currentPrice / bottleCount);

  // PHƯƠNG ÁN 1: Tính toán tồn kho thông minh theo quy cách đóng gói & chi nhánh
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

  // Tự động điều chỉnh quantity nếu vượt quá số lượng tồn khả dụng
  useEffect(() => {
    if (remainingCanAdd > 0 && quantity > remainingCanAdd) {
      setQuantity(Math.max(1, remainingCanAdd));
    }
  }, [remainingCanAdd, activeVariant]);

  const handleAddToCart = (e: React.MouseEvent) => {
    if (isOutOfStock || remainingCanAdd <= 0) return;

    // Tìm ảnh chính sản phẩm trong gallery hoặc fallback về nút bấm
    const mainImg = document.querySelector('[data-product-main-image]') as HTMLElement | null;
    const btn = e.currentTarget as HTMLElement;

    flyToCart({
      startElement: mainImg || btn,
      imageSrc: product.thumbnail,
    });

    const qtyToAdd = Math.min(quantity, remainingCanAdd);
    addItem(
      {
        productId: currentVariant ? `${product.id}-${currentVariant.id}` : product.id,
        name: currentVariant ? `${displayName} (${getVariantName(currentVariant.name)})` : displayName,
        slug: product.slug,
        price: currentPrice,
        unit: currentUnit,
        thumbnail: product.thumbnail,
        variantId: currentVariant?.id,
        variantName: currentVariant?.name,
      },
      qtyToAdd
    );

    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2500);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;

    if (remainingCanAdd > 0) {
      addItem(
        {
          productId: currentVariant ? `${product.id}-${currentVariant.id}` : product.id,
          name: currentVariant ? `${displayName} (${getVariantName(currentVariant.name)})` : displayName,
          slug: product.slug,
          price: currentPrice,
          unit: currentUnit,
          thumbnail: product.thumbnail,
          variantId: currentVariant?.id,
          variantName: currentVariant?.name,
        },
        Math.min(quantity, remainingCanAdd)
      );
    }

    router.push('/thanh-toan');
  };

  // Tính toán giá gốc hiển thị chuẩn Amazon
  const discountRate = 26;
  const originalPrice = Math.round((currentPrice / (1 - discountRate / 100)) / 1000) * 1000;

  // Đảm bảo luôn có 3 biến thể bộ sản phẩm để hiển thị 3 card lựa chọn ngang
  const displayVariants = useMemo(() => {
    if (sortedVariants.length >= 3) {
      return sortedVariants.slice(0, 3);
    }
    if (sortedVariants.length > 0) {
      return sortedVariants;
    }
    // Fallback nếu sản phẩm chưa cấu hình variants
    return [
      { id: 'v-5', name: '5 chai', quantity: 5, price: 125000, volume: '5 x 568ml', unit: 'lốc' },
      { id: 'v-7', name: '7 chai', quantity: 7, price: 175000, volume: '7 x 568ml', unit: 'lốc' },
      { id: 'v-10', name: '10 chai', quantity: 10, price: 250000, volume: '10 x 568ml', unit: 'thùng' },
    ];
  }, [sortedVariants]);

  return (
    <div className="flex flex-col space-y-3.5 w-full">
      {/* 1. Tiêu đề sản phẩm chuẩn Amazon */}
      <div className="space-y-1">
        <h1 className="text-2xl lg:text-[25px] font-medium text-ink-950 leading-snug tracking-tight">
          {displayName}
        </h1>
        {displayShortDesc && (
          <p className="text-sm text-ink-800 pt-0.5 leading-relaxed">
            {displayShortDesc}
          </p>
        )}
      </div>

      {/* 2. Link gian hàng & SKU */}
      <div className="flex items-center justify-between text-sm flex-wrap gap-2 pb-1 border-b border-gray-100">
        <Link
          href="/"
          className="text-forest-700 hover:text-copper-600 hover:underline text-sm font-medium transition-colors"
        >
          Ghé thăm cửa hàng Thái Sơn Foods
        </Link>
        <span className="text-xs text-gray-500 font-mono">
          SKU: {product.sku || 'SS-01'}
        </span>
      </div>

      {/* 3. Đánh giá & Lượt bán */}
      <div className="flex items-center gap-2 flex-wrap text-sm text-ink-950">
        {reviewSummary && reviewSummary.totalReviews > 0 ? (
          <>
            <span className="text-base">{reviewSummary.averageRating.toFixed(1)}</span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${
                    s <= Math.round(reviewSummary.averageRating)
                      ? 'fill-amber-500 text-amber-500'
                      : 'fill-gray-200 text-gray-200'
                  }`}
                />
              ))}
            </div>
            <a
              href="#danh-gia"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById('danh-gia') || document.getElementById('danh-gia-khach-hang');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-forest-700 hover:text-copper-600 hover:underline text-xs sm:text-sm cursor-pointer font-medium"
            >
              ({reviewSummary.totalReviews}) đánh giá
            </a>
          </>
        ) : (
          <a
            href="#danh-gia"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById('danh-gia') || document.getElementById('danh-gia-khach-hang');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 hover:text-emerald-700 cursor-pointer group"
          >
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-3.5 h-3.5 fill-gray-200 text-gray-200 group-hover:fill-amber-300" />
              ))}
            </div>
            <span className="text-gray-600 group-hover:underline">Chưa có đánh giá</span>
            <span className="text-emerald-700 font-medium text-xs">(Viết nhận xét đầu tiên)</span>
          </a>
        )}
        <span className="text-gray-300">|</span>
        <span className="text-xs sm:text-sm text-ink-700">
          Hơn 200 sản phẩm đã được mua trong tháng trước.
        </span>
      </div>

      {/* 4. Khối Giá & Ưu đãi */}
      <div className="py-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl text-crimson-600 font-light mr-2">
            -{discountRate}%
          </span>
          <span className="text-3xl text-ink-950">
            {formatPrice(currentPrice)} đ
          </span>
          <span className="text-xs text-gray-500">
            ({formatPrice(perBottlePrice)} đ / {bottleCount > 1 ? (language === 'en' ? 'bottle' : 'chai') : (language === 'en' ? (product.unitEn || 'bottle') : product.unit)})
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          <span>Đã từng là: </span>
          <span className="line-through">{formatPrice(originalPrice)} đ</span>
        </div>
      </div>

      {/* 5. Banner Mã giảm giá */}
      <div className="bg-ivory border border-amber-200 rounded-lg p-3 text-xs flex items-center gap-2 text-ink-950 leading-relaxed">
        <span className="bg-crimson-600 text-white px-1.5 py-0.5 rounded text-[12px] shrink-0">
          Mã giảm giá:
        </span>
        <div className="flex-1 min-w-0">
          <strong className="text-[1.125em]">Tiết kiệm 5%</strong>: Mã giảm giá chỉ áp dụng cho tùy chọn mua hàng trực tiếp website.{' '}
          <Link href="/#khuyen-mai" className="text-forest-700 hover:text-copper-600 hover:underline font-medium">
            Mua sắm các mặt hàng
          </Link>{' '}
          |{' '}
          <span className="text-forest-700 hover:text-copper-600 hover:underline cursor-pointer">
            Điều khoản
          </span>
        </div>
      </div>

      {/* 6. Selector Chọn biến thể bộ sản phẩm: 3 Card ngang */}
      <div className="space-y-2 pt-1">
        <div className="text-sm text-ink-950">
          <span>Tên bộ sản phẩm: </span>
          <strong className="text-[1.125em]">{currentUnit} ({currentVolume})</strong>
        </div>

        <div
          className={
            displayVariants.length === 2
              ? 'grid grid-cols-2 gap-2.5'
              : displayVariants.length === 1
              ? 'grid grid-cols-1 gap-2.5 max-w-xs'
              : 'grid grid-cols-3 gap-2.5'
          }
        >
          {displayVariants.map((v) => {
            const isSelected = activeVariant === v.id;
            const vPerBottle = Math.round(v.price / (v.quantity || 1));
            const vOriginalPrice = Math.round((v.price / (1 - discountRate / 100)) / 1000) * 1000;
            const vDisplayName = getVariantName(v.name);

            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveVariant(v.id)}
                className={cn(
                  'rounded-lg p-3 text-left transition-all relative flex flex-col justify-between cursor-pointer',
                  isSelected
                    ? 'border-2 border-forest-700 bg-blue-50/10 shadow-xs'
                    : 'border border-gray-200 bg-white hover:border-gray-400'
                )}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-base text-ink-950">{vDisplayName}</span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-forest-700 text-white flex items-center justify-center text-[10px]">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div className="text-base sm:text-lg text-ink-950">
                  {formatPrice(v.price)} đ
                </div>

                <div className="text-[11px] text-gray-500 mt-0.5">
                  ({formatPrice(vPerBottle)} đ/chai)
                </div>

                <div className="text-[11px] text-gray-400 line-through mt-0.5">
                  {formatPrice(vOriginalPrice)} đ
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 7. Khối Thao tác & Tồn kho (Buy Box Card) */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
        {/* Dòng giá nhắc lại + Badge Thuần chay */}
        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-gray-100">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl text-ink-950">
              {formatPrice(currentPrice)} đ
            </span>
            <span className="text-xs text-gray-500">
              ({formatPrice(perBottlePrice)} đ / {bottleCount > 1 ? (language === 'en' ? 'bottle' : 'chai') : (language === 'en' ? (product.unitEn || 'bottle') : product.unit)})
            </span>
          </div>

          {isVegan && (
            <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
              <span>Thuần chay</span>
            </div>
          )}
        </div>

        {/* Giao hàng miễn phí */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-ink-950">
          <Truck className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            Giao hàng <strong className="text-emerald-700 text-[1.125em]">MIỄN PHÍ</strong> cho đơn hàng từ 200.000 đ
          </span>
        </div>

        {/* Vị trí kho */}
        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-ink-700">
          <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="truncate">
            Giao hàng đến: <strong className="text-ink-950 text-[1.125em]">{selectedBranch?.name || 'Cửa Hàng NH - Phú Thọ Hòa'}</strong>
          </span>
          <button
            type="button"
            onClick={openBranchModal}
            className="text-forest-700 hover:text-copper-600 hover:underline font-medium ml-1 shrink-0 cursor-pointer"
          >
            (Đổi kho)
          </button>
        </div>

        {/* Tồn kho */}
        <div className="pt-0.5">
          {isOutOfStock ? (
            <div className="space-y-1">
              <div className="text-red-600 text-base flex items-start gap-1.5 leading-snug">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0 mt-1"></span>
                <span>Tạm thời hết hàng chúng tôi đang nỗ lực để sớm có hàng trở lại.</span>
              </div>
              <p className="text-xs text-gray-500 pl-4 leading-relaxed">
                Bạn có thể tham khảo các kho xa hơn nhưng có thể tốn chi phí giao hàng cao hơn.
              </p>
            </div>
          ) : isLowStock ? (
            <div className="text-amber-700 text-base flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Sắp hết hàng ({maxAvailableInBranch} {currentUnit} có sẵn)</span>
            </div>
          ) : (
            <div className="text-emerald-700 text-base flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>Còn hàng</span>
            </div>
          )}
        </div>

        {/* Số lượng & Nút Thao tác */}
        {!isOutOfStock && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 font-medium">
                Số lượng:
              </label>
              <div className="flex items-center border border-gray-300 rounded-lg bg-gray-50">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-2.5 py-1 text-gray-600 hover:text-gray-900 transition-colors rounded-l-lg cursor-pointer disabled:opacity-40"
                  disabled={quantity <= 1 || remainingCanAdd <= 0}
                  aria-label="Giảm số lượng"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-3 py-1 text-base text-gray-900 min-w-[32px] text-center">
                  {remainingCanAdd <= 0 ? 0 : quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(remainingCanAdd, q + 1))}
                  className="px-2.5 py-1 text-gray-600 hover:text-gray-900 transition-colors rounded-r-lg cursor-pointer disabled:opacity-40"
                  disabled={quantity >= remainingCanAdd || remainingCanAdd <= 0}
                  aria-label="Tăng số lượng"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Các nút bấm */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={remainingCanAdd <= 0}
                className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-ink-950 font-medium rounded-full text-sm shadow-sm transition-all border border-amber-700 cursor-pointer text-center"
              >
                Thêm vào giỏ hàng
              </button>

              <button
                type="button"
                onClick={handleBuyNow}
                disabled={remainingCanAdd <= 0}
                className="w-full py-3 px-4 bg-brand-emerald hover:bg-brand-forest active:scale-[0.99] text-white font-medium rounded-full text-sm shadow-sm transition-all cursor-pointer text-center"
              >
                Mua ngay
              </button>
            </div>
          </div>
        )}

        {/* Toast thông báo khi thêm giỏ */}
        {addedToast && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs px-3 py-2 rounded-lg flex items-center gap-2 animate-fade-in-up">
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              Đã thêm <strong className="text-[1.125em]">{quantity} {currentUnit} ({currentVolume})</strong> vào giỏ hàng!
            </span>
          </div>
        )}
      </div>

      {/* 8. CÁC KHỐI THÔNG TIN CHI TIẾT (ACCORDIONS) */}
      <div className="pt-2 space-y-2.5">
        {/* Accordion 1: Đặc điểm nổi bật (Top highlights) */}
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
          <button
            onClick={() => toggleAccordion('highlights')}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-base md:text-lg text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              {language === 'en' ? 'Key Highlights' : 'Đặc điểm nổi bật'}
            </span>
            <ChevronDown
              className={cn(
                'w-4.5 h-4.5 text-gray-500 transition-transform duration-200',
                openAccordions.highlights ? 'rotate-180' : ''
              )}
            />
          </button>
          {openAccordions.highlights && (
            <div className="px-4 pb-4 text-sm md:text-base text-gray-700 space-y-2 border-t border-gray-100 pt-3 leading-relaxed">
              {highlights.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-forest-700 text-[1.125em]">•</span>
                  <span>
                    <strong className="text-[1.125em]">
                      {language === 'en' ? item.labelEn : item.labelVi}:{' '}
                    </strong>
                    {language === 'en' ? item.contentEn : item.contentVi}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Accordion 2: Thông tin chi tiết (Item details) */}
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
          <button
            onClick={() => toggleAccordion('details')}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-base md:text-lg text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Info className="w-4.5 h-4.5 text-forest-700" />
              {language === 'en' ? 'Product Details' : 'Thông tin chi tiết'}
            </span>
            <ChevronDown
              className={cn(
                'w-4.5 h-4.5 text-gray-500 transition-transform duration-200',
                openAccordions.details ? 'rotate-180' : ''
              )}
            />
          </button>
          {openAccordions.details && (
            <div className="px-4 pb-4 text-sm text-gray-700 border-t border-gray-100 pt-3">
              <table className="w-full text-left">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 text-gray-600 w-40 text-[1.125em]">{language === 'en' ? 'Brand' : 'Thương hiệu'}</td>
                    <td className="py-2.5 text-gray-900 font-medium">Thái Sơn Foods</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 text-gray-600 text-[1.125em]">{language === 'en' ? 'Origin' : 'Xuất xứ'}</td>
                    <td className="py-2.5 text-gray-900">{language === 'en' ? 'Vietnam' : 'Việt Nam'}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 text-gray-600 text-[1.125em]">{language === 'en' ? 'Product Code' : 'Mã sản phẩm'}</td>
                    <td className="py-2.5 text-gray-900 font-mono">{product.sku || 'TSF-PRODUCT'}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 text-gray-600 text-[1.125em]">{language === 'en' ? 'Certification' : 'Chứng nhận'}</td>
                    <td className="py-2.5 text-emerald-700 text-[1.125em]">{language === 'en' ? 'International HACCP Certification' : 'Chứng nhận Quốc tế HACCP'}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 text-gray-600 text-[1.125em]">{language === 'en' ? 'Expiry Date' : 'Hạn sử dụng'}</td>
                    <td className="py-2.5 text-gray-900">{language === 'en' ? 'Printed on bottle cap' : 'Xem trên nắp chai'}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 text-gray-600 text-[1.125em]">{language === 'en' ? 'Usage Instructions' : 'Hướng dẫn sử dụng'}</td>
                    <td className="py-2.5 text-gray-900">
                      {language === 'en'
                        ? 'Best consumed within 24 hours after opening. Keep refrigerated during use.'
                        : 'Sử dụng trong 24 giờ sau khi mở nắp, giữ lạnh sản phẩm trong quá trình sử dụng.'}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 text-gray-600 text-[1.125em]">{language === 'en' ? 'Storage Instructions' : 'Hướng dẫn bảo quản'}</td>
                    <td className="py-2.5 text-gray-900">
                      {language === 'en'
                        ? 'Store at 5 - 10°C in refrigerator chiller compartment.'
                        : 'Bảo quản ở nhiệt độ 5 - 10 độ C trong ngăn mát tủ lạnh'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Accordion 3: Quy cách & Kích thước (Measurements) */}
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
          <button
            onClick={() => toggleAccordion('measurements')}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-base md:text-lg text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Package className="w-4.5 h-4.5 text-forest-700" />
              {language === 'en' ? 'Packaging & Dimensions' : 'Quy cách & Kích thước'}
            </span>
            <ChevronDown
              className={cn(
                'w-4.5 h-4.5 text-gray-500 transition-transform duration-200',
                openAccordions.measurements ? 'rotate-180' : ''
              )}
            />
          </button>
          {openAccordions.measurements && (
            <div className="px-4 pb-4 text-sm text-gray-700 border-t border-gray-100 pt-3 space-y-2 leading-relaxed">
              <p>• {language === 'en' ? 'Standard bottle volume: ' : 'Dung tích đóng chai tiêu chuẩn: '}<strong className="text-[1.125em]">{bottleVolume}</strong></p>
              <p>• {language === 'en' ? 'Packaging material: ' : 'Chất liệu bao bì: '}<strong className="text-[1.125em]">{language === 'en' ? 'Food-grade virgin PET, 100% recyclable' : 'Nhựa nguyên sinh an toàn thực phẩm, có thể tái chế.'}</strong></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductBreadcrumb({
  product,
  category,
}: {
  product: Product;
  category?: { id: string; name: string; nameEn?: string; slug: string };
}) {
  const { language } = useLanguage();

  const homeText = language === 'en' ? 'Home' : 'Trang chủ';
  const categoryName = language === 'en'
    ? (category?.nameEn || (category ? category.name : 'Nutritious Beverages'))
    : (category ? category.name : 'Sản phẩm dinh dưỡng');
  const productName = language === 'en' ? (product.nameEn || product.name) : product.name;

  return (
    <div className="border-b border-gray-100 bg-ink-50 py-2.5 text-xs">
      <div className="section-container">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-gray-500 flex-wrap">
            <li>
              <Link href="/" className="hover:text-green-primary transition-colors font-medium">
                {homeText}
              </Link>
            </li>
            <li><ChevronRight className="w-3.5 h-3.5 text-gray-400 inline" /></li>
            <li>
              <Link href="/#san-pham" className="hover:text-green-primary transition-colors font-medium">
                {categoryName}
              </Link>
            </li>
            <li><ChevronRight className="w-3.5 h-3.5 text-gray-400 inline" /></li>
            <li className="text-gray-900 break-words text-[1.125em]">
              {productName}
            </li>
          </ol>
        </nav>
      </div>
    </div>
  );
}
