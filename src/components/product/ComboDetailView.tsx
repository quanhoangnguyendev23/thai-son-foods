'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Combo, Product } from '@/types';
import { formatPrice, cn } from '@/lib/utils';
import { useCartStore } from '@/store/cart';
import { useFlyToCart } from '@/context/FlyToCartContext';
import {
  ShoppingBag,
  ChevronRight,
  ChevronLeft,
  Truck,
  RotateCcw,
  Phone,
  Plus,
  Minus,
  Check,
  ZoomIn,
  X,
  Copy,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useBranchStore } from '@/store/branch';
import MobileBuyBar from '@/components/product/MobileBuyBar';
import ProductSidebarSponsoredCard from '@/components/product/ProductSidebarSponsoredCard';
import { MapPin, AlertCircle, Info } from 'lucide-react';

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
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

  const isCombo01 = combo.id === 'combo-4-chai';
  const isCombo02 = combo.id === 'combo-van-phong';
  const isComboUuDai = combo.id === 'combo-uu-dai' || combo.id === 'combo-5-old';
  const isComboSieuHoi = combo.id === 'combo-sieu-hoi' || combo.id === 'combo-6-old';
  const isCustomizable = isCombo01 || isCombo02 || isComboUuDai || isComboSieuHoi;

  const customizeLink = isCombo01
    ? '/combo?type=combo-4-chai'
    : isCombo02
    ? '/combo?type=combo-van-phong'
    : isComboUuDai
    ? '/combo?type=combo-uu-dai'
    : isComboSieuHoi
    ? '/combo?type=combo-sieu-hoi'
    : '/combo';

  const comboTitle = (language === 'en' && combo.nameEn) ? combo.nameEn : combo.name;
  const comboDesc = (language === 'en' && combo.descriptionEn) ? combo.descriptionEn : combo.description;

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const activeImage = galleryImages[activeIndex] || galleryImages[0];

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!isZoomOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZoomOpen(false);
      if (e.key === 'ArrowRight') setActiveIndex((prev) => (prev + 1) % galleryImages.length);
      if (e.key === 'ArrowLeft') setActiveIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomOpen, galleryImages.length]);

  const handleAddToCart = (e?: React.MouseEvent) => {
    if (e && imageContainerRef.current) {
      const img = imageContainerRef.current.querySelector('img');
      flyToCart({
        startElement: img || (e.currentTarget as HTMLElement),
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

  return (
    <div className="w-full">
      {/* ─── Breadcrumb ─── */}
      <div className="border-b border-gray-100 bg-ink-50 py-2.5 text-xs">
        <div className="section-container">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-gray-500 flex-wrap">
              <li>
                <Link href="/" className="hover:text-green-primary transition-colors font-medium">
                  {language === 'en' ? 'Home' : 'Trang chủ'}
                </Link>
              </li>
              <li><ChevronRight className="w-3.5 h-3.5 text-gray-400 inline" /></li>
              <li>
                <Link href="/#combo" className="hover:text-green-primary transition-colors font-medium">
                  {language === 'en' ? 'Value Combos' : 'Combo tiết kiệm'}
                </Link>
              </li>
              <li><ChevronRight className="w-3.5 h-3.5 text-gray-400 inline" /></li>
              <li className="text-gray-900 break-words text-[1.125em]">
                {comboTitle}
              </li>
            </ol>
          </nav>
        </div>
      </div>

      {/* ─── Main Content (2 Columns Layout) ─── */}
      <div className="max-w-[1456px] mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Khối Trái + Giữa (giống trang sản phẩm): Gallery + Thông tin & mua hàng */}
          <div className="lg:col-span-9 grid grid-cols-1 lg:grid-cols-9 gap-6 lg:gap-8 items-start">
          {/* CỘT TRÁI: Gallery ảnh Combo (Thumbnails bên trái + Ảnh lớn bên phải) + Danh sách chi tiết chai */}
          <div className="lg:col-span-5 w-full space-y-4">
            {/* Gallery Layout: Thumbnails Trái + Ảnh lớn Phải (Chuẩn theo ProductGallery) */}
            <div className="w-full flex flex-row items-stretch gap-3 select-none">
              {/* Cột Thumbnails dọc bên trái — hiển thị từ màn hình sm trở lên */}
              {galleryImages.length > 1 && (
                <div className="hidden sm:flex flex-col gap-2 w-[76px] shrink-0 max-h-[460px] overflow-y-auto scrollbar-hide py-0.5">
                  {galleryImages.map((image, index) => (
                    <button
                      key={image.id || index}
                      onClick={() => setActiveIndex(index)}
                      className={cn(
                        'relative w-full aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all shrink-0 bg-ivory p-0.5 flex items-center justify-center cursor-pointer',
                        activeIndex === index
                          ? 'border-forest-700 shadow-[0_0_0_1px_var(--color-forest-700)]'
                          : 'border-gray-200 hover:border-gray-400 opacity-70 hover:opacity-100'
                      )}
                      aria-label={`Xem ảnh ${index + 1}`}
                      title={image.label || image.alt}
                    >
                      <div className="relative w-full h-full rounded overflow-hidden">
                        <Image
                          src={image.url}
                          alt={image.alt || comboTitle}
                          fill
                          className={index === 0 ? "object-cover" : "object-contain"}
                          sizes="80px"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Khung ảnh chính */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div
                  ref={imageContainerRef}
                  className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-ivory border border-gray-200/80 shadow-sm group"
                >
                  {/* Floating Prev Button (<) */}
                  {galleryImages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/85 hover:bg-white text-gray-800 shadow-md border border-gray-100 flex items-center justify-center transition-all opacity-85 group-hover:opacity-100 hover:scale-105 cursor-pointer"
                      aria-label="Ảnh trước"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}

                  {/* Floating Next Button (>) */}
                  {galleryImages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveIndex((prev) => (prev + 1) % galleryImages.length);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/85 hover:bg-white text-gray-800 shadow-md border border-gray-100 flex items-center justify-center transition-all opacity-85 group-hover:opacity-100 hover:scale-105 cursor-pointer"
                      aria-label="Ảnh tiếp theo"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}

                  {/* Bottom-Right Counter Badge */}
                  <div className="absolute bottom-3.5 right-3.5 z-20 bg-ink-950/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-medium tracking-wider pointer-events-none">
                    {activeIndex + 1}/{galleryImages.length}
                  </div>

                  {/* Ảnh chính hiển thị với cursor zoom */}
                  <div
                    onClick={() => setIsZoomOpen(true)}
                    className="relative w-full h-full cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.02]"
                  >
                    <Image
                      src={activeImage.url}
                      alt={activeImage.alt}
                      fill
                      priority={activeIndex === 0}
                      className={
                        activeImage.url.includes('bang-thong-tin')
                          ? "object-contain p-1"
                          : activeIndex === 0 || activeImage.url.includes('bang-icon') || activeImage.url.includes('sua-bap-nep-3')
                          ? "object-cover object-center"
                          : "object-contain p-4"
                      }
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  </div>

                  {/* Huy hiệu loại combo (góc trên trái) */}
                  <div className="absolute top-3 left-3 z-10 pointer-events-none">
                    <span className="px-2.5 py-1 text-sm bg-forest-950/90 backdrop-blur-xs text-corn rounded-lg shadow-sm flex items-center gap-1">
                      {isCustomizable
                        ? (language === 'en' ? 'Customizable Combo' : 'Combo tự chọn vị')
                        : (language === 'en' ? 'Pre-packed Combo' : 'Combo đóng gói sẵn')}
                    </span>
                  </div>

                  {/* Huy hiệu giảm giá góc trên phải */}
                  <div className="absolute top-3 right-3 z-10 pointer-events-none">
                    <span className="px-2.5 py-1 text-sm bg-sale text-white rounded-lg shadow-sm">
                      -{combo.discount}%
                    </span>
                  </div>

                  {/* Huy hiệu số lượng chai góc dưới trái */}
                  <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
                    <span className="px-3 py-1.5 text-sm bg-emerald-800/95 backdrop-blur-xs text-white rounded-lg shadow-sm">
                      {combo.totalItems} {language === 'en' ? 'bottles' : 'chai'}
                    </span>
                  </div>
                </div>

                {/* Mobile Thumbnails Row — hiển thị dưới ảnh trên điện thoại */}
                {galleryImages.length > 1 && (
                  <div className="sm:hidden w-full flex items-center gap-2 overflow-x-auto py-2.5 px-0.5">
                    {galleryImages.map((image, index) => (
                      <button
                        key={image.id || index}
                        onClick={() => setActiveIndex(index)}
                        className={cn(
                          'relative w-16 aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all shrink-0 bg-ivory p-0.5 flex items-center justify-center cursor-pointer',
                          activeIndex === index
                            ? 'border-forest-700 shadow-[0_0_0_1px_var(--color-forest-700)]'
                            : 'border-gray-200 hover:border-gray-400 opacity-70 hover:opacity-100'
                        )}
                        aria-label={`Xem ảnh ${index + 1}`}
                      >
                        <div className="relative w-full h-full rounded overflow-hidden">
                          <Image
                            src={image.url}
                            alt={image.alt || comboTitle}
                            fill
                            className={index === 0 ? "object-cover" : "object-contain"}
                            sizes="64px"
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dưới ảnh: Phóng to & Chia sẻ bạn bè */}
            <div className="w-full pt-1.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 px-1">
              <button
                onClick={() => setIsZoomOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-forest-700 font-medium transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>{language === 'en' ? 'Click image to zoom' : 'Nhấp vào ảnh để phóng to'}</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 font-medium">
                  {language === 'en' ? 'Share:' : 'Chia sẻ đến bạn bè của bạn:'}
                </span>

                {/* Facebook */}
                <button
                  onClick={() => {
                    const url = typeof window !== 'undefined' ? window.location.href : '';
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer,width=620,height=580');
                  }}
                  className="w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 text-[#1877F2] flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-2xs"
                  title="Share to Facebook"
                  aria-label="Share to Facebook"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </button>

                {/* Zalo */}
                <button
                  onClick={() => {
                    const url = typeof window !== 'undefined' ? window.location.href : '';
                    window.open(`https://sp.zalo.me/plugins/share?url=${encodeURIComponent(url)}&title=${encodeURIComponent(comboTitle)}`, '_blank', 'noopener,noreferrer,width=620,height=580');
                  }}
                  className="w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 text-[#0068FF] flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-2xs text-[11px]"
                  title="Share to Zalo"
                  aria-label="Share to Zalo"
                >
                  Zalo
                </button>

                {/* Sao chép link */}
                <button
                  onClick={async () => {
                    const url = typeof window !== 'undefined' ? window.location.href : '';
                    try {
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    } catch {}
                  }}
                  className={cn(
                    "h-7 px-2.5 rounded-full border text-sm flex items-center gap-1 transition-all cursor-pointer shadow-2xs",
                    copied
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300"
                  )}
                  title="Copy link"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-white stroke-[3]" />
                      <span>{language === 'en' ? 'Copied!' : 'Đã chép!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-gray-500" />
                      <span>{language === 'en' ? 'Copy link' : 'Sao chép'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* DANH SÁCH CHI TIẾT TỪNG CHAI TRONG COMBO */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                <h3 className="text-gray-900 text-base sm:text-lg flex items-center gap-2">
                  <span>
                    {language === 'en'
                      ? `Items in this Combo (${combo.totalItems} bottles)`
                      : `Combo gồm (${combo.totalItems} chai)`}
                  </span>
                </h3>
                <span className="text-xs text-text-muted">
                  {language === 'en' ? 'Standard packaging spec' : 'Đúng định lượng đóng gói'}
                </span>
              </div>

              <div className="space-y-2.5">
                {productsDetail.map((item, idx) => {
                  const pFullName = (language === 'en' && item.product?.nameEn)
                    ? item.product.nameEn
                    : (item.product?.name || item.productId);
                  const pShortName = getShortBottleName(pFullName);
                  const pDesc = (language === 'en' && item.product?.shortDescriptionEn)
                    ? item.product.shortDescriptionEn
                    : (item.product?.shortDescription || (language === 'en' ? 'Convenient 330ml bottled nutrition' : 'Thức uống dinh dưỡng đóng chai 330ml tiện lợi'));

                  return (
                    <div
                      key={`${item.productId}-${idx}`}
                      className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-ivory border border-gray-100/90 hover:border-emerald-600/30 transition-colors"
                      title={pFullName}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Ảnh chai */}
                        <div className="relative w-12 h-12 rounded-lg bg-white overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center p-1">
                          <Image
                            src={item.product?.thumbnail || combo.image}
                            alt={pFullName}
                            fill
                            className="object-contain p-0.5"
                            sizes="48px"
                          />
                        </div>

                        {/* Thông tin chai: Tên ngắn × số chai, rê chuột xem tên đầy đủ */}
                        <div className="min-w-0" title={`Tên đầy đủ: ${pFullName}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm sm:text-base text-text-dark leading-snug">
                              {pShortName}
                            </h4>
                            <span className="px-2 py-0.5 text-sm bg-emerald-800 text-white rounded-md shrink-0">
                              × {item.quantity} {language === 'en' ? 'bottles' : 'chai'}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted leading-tight mt-0.5 truncate max-w-[260px] sm:max-w-none">
                            {pDesc}
                          </p>
                        </div>
                      </div>

                      {/* Link xem chi tiết chai */}
                      {item.product && (
                        <Link
                          href={`/san-pham/${item.product.slug}`}
                          className="shrink-0 text-sm text-green-primary hover:text-green-dark hover:underline flex items-center gap-0.5 ml-2"
                          title={language === 'en' ? `View ${pFullName}` : `Xem chi tiết ${item.product.name}`}
                        >
                          <span className="hidden sm:inline">
                            {language === 'en' ? 'View' : 'Xem vị'}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: Thông tin Combo, Giá, Khuyến mãi & Nút mua hàng */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-6">
            <div>
              {/* Thương hiệu */}
              <div className="flex items-center gap-2 text-sm text-green-primary uppercase tracking-wider mb-2">
                <span className="w-2 h-2 rounded-full bg-green-primary inline-block" />
                <span>
                  {language === 'en'
                    ? 'Thai Son Foods • Bottled Nutritious Beverages'
                    : 'Thái Sơn Foods • Thức Uống Dinh Dưỡng Đóng Chai'}
                </span>
              </div>

              {/* Tên combo */}
              <h1 className="text-2xl sm:text-2xl lg:text-3xl text-gray-900 leading-snug">
                {comboTitle}
              </h1>

              {/* Cam kết & Đánh giá */}
              <div className="flex items-center gap-3 mt-2.5 text-xs text-text-muted flex-wrap">
                <div className="flex items-center text-amber-500">
                  {'★'.repeat(5)}
                  <span className="ml-1 text-gray-700 text-[1.125em]">(5.0)</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1 bg-emerald-50/80 px-2 py-0.5 rounded text-emerald-900">
                  <MapPin className="w-3 h-3 text-emerald-700 shrink-0" />
                  <span>Kho: <strong className="text-[1.125em]">{selectedBranch?.name || 'Chi nhánh'}</strong></span>
                  <button
                    type="button"
                    onClick={openBranchModal}
                    className="text-emerald-800 underline ml-1 hover:text-emerald-950 cursor-pointer py-2 -my-2 inline-block text-[1.125em]"
                  >
                    Đổi
                  </button>
                </div>
                <span>•</span>
                {checkingStock ? (
                  <span className="inline-flex items-center gap-1.5 text-gray-600 font-medium bg-gray-100 px-2.5 py-0.5 rounded-full text-xs animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                    <span>{language === 'en' ? 'Checking stock...' : 'Đang kiểm kho...'}</span>
                  </span>
                ) : !isAvailable || availableStock === 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200/80 px-2.5 py-0.5 rounded-full text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                    <span>{language === 'en' ? 'Out of stock' : 'Hết hàng'}</span>
                  </span>
                ) : availableStock !== null && availableStock <= 10 ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full text-sm shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>
                      {language === 'en'
                        ? `Only ${availableStock} combos left`
                        : `Chỉ còn ${availableStock} combo`}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-sm shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <span>{language === 'en' ? 'In stock' : 'Còn hàng'}</span>
                  </span>
                )}
                <span>•</span>
                <span>{language === 'en' ? 'Combo Code: ' : 'Mã Combo: '}#{combo.id.toUpperCase()}</span>
              </div>
            </div>

            {/* KHỐI GIÁ BÁN NỔI BẬT */}
            <div className="p-4 sm:p-5 rounded-2xl bg-ivory border border-gray-200/80">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl sm:text-3xl text-green-primary">
                  {formatPrice(combo.salePrice)}đ
                </span>
                <span className="text-sm sm:text-base text-gray-400 line-through">
                  {formatPrice(combo.originalPrice)}đ
                </span>
                <span className="px-2 py-0.5 text-sm text-sale bg-red-100/90 rounded-md">
                  {language === 'en'
                    ? `Save ${formatPrice(savingsAmount)}đ (-${combo.discount}%)`
                    : `Tiết kiệm ${formatPrice(savingsAmount)}đ (-${combo.discount}%)`}
                </span>
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-gray-200/70 text-xs sm:text-sm text-text-muted flex items-center justify-between flex-wrap gap-2">
                <span>
                  {language === 'en'
                    ? <>Packaging: <strong className="text-[1.125em]">{combo.totalItems} bottles / carton</strong></>
                    : <>Quy cách: <strong className="text-[1.125em]">{combo.totalItems} chai / thùng</strong></>}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 font-medium">
                    {language === 'en' ? 'Stock:' : 'Tồn kho:'}
                  </span>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-sm inline-flex items-center gap-1 shadow-2xs",
                    availableStock === null
                      ? "text-emerald-800 bg-emerald-100/90 border border-emerald-200"
                      : !isAvailable || availableStock === 0
                      ? "text-red-800 bg-red-100 border border-red-200"
                      : availableStock <= 10
                      ? "text-amber-800 bg-amber-100 border border-amber-200"
                      : "text-emerald-800 bg-emerald-100/90 border border-emerald-200"
                  )}>
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      !isAvailable || availableStock === 0 ? "bg-red-600" : availableStock !== null && availableStock <= 10 ? "bg-amber-600 animate-pulse" : "bg-emerald-600"
                    )}></span>
                    <span>
                      {checkingStock
                        ? 'Đang kiểm tra...'
                        : !isAvailable || availableStock === 0
                        ? 'Hết hàng'
                        : availableStock !== null && availableStock <= 10
                        ? `Chỉ còn ${availableStock} combo`
                        : 'Còn hàng'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Khối tiện ích & cam kết */}
            <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-white border border-gray-200/80 flex items-start gap-2.5">
                  <div className="text-xs">
                    <p className="text-gray-900 text-[1.125em]">
                      {language === 'en' ? 'Cooling & Nutritious' : 'Thanh mát bổ dưỡng'}
                    </p>
                    <p className="text-gray-500">
                      {language === 'en'
                        ? 'Helps cool the body and provide natural healthy vitality.'
                        : 'Giúp giải nhiệt cơ thể và cung cấp năng lượng lành mạnh.'}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-gray-200/80 flex items-start gap-2.5">
                  <div className="text-xs">
                    <p className="text-gray-900 text-[1.125em]">
                      {language === 'en' ? '100% Fresh Ingredients' : '100% Nguyên liệu tươi'}
                    </p>
                    <p className="text-gray-500">
                      {language === 'en'
                        ? 'No chemical preservatives, strict food safety certification.'
                        : 'Không chất bảo quản, chuẩn vệ sinh an toàn thực phẩm.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* BỘ CHỌN SỐ LƯỢNG & NÚT MUA HÀNG */}
            {isCustomizable ? (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-sm text-emerald-900">
                  <p className="mb-1 text-[1.125em]">
                    {language === 'en'
                      ? 'This combo supports flexible flavor customization!'
                      : 'Combo này hỗ trợ tự chọn vị linh hoạt theo sở thích!'}
                  </p>
                  <p className="text-xs text-emerald-800">
                    {language === 'en'
                      ? 'You can customize your own combination of Corn Milk, Lotus Seed Milk, Aloe Vera, or Herbal Tea.'
                      : 'Bạn có thể tự tay phối hợp các hương vị Sữa Bắp, Sâm La Hán, Mủ Trôm hoặc Sữa Hạt theo ý muốn.'}
                  </p>
                </div>

                <Link
                  href={customizeLink}
                  className="w-full py-3.5 px-6 rounded-xl text-base sm:text-lg bg-corn hover:bg-yellow-400 text-text-dark shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <span>
                    {language === 'en'
                      ? 'Customize flavors for this Combo'
                      : 'Vào trang tự chọn vị cho Combo này'}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4 pt-4 border-t border-gray-100">
                {/* Chọn số lượng combo */}
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <span className="text-base text-gray-900">
                    {language === 'en' ? 'Quantity:' : 'Số lượng:'}
                  </span>
                  <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white shadow-xs">
                    <button
                      type="button"
                      disabled={quantity <= 1 || !isAvailable}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="p-2 sm:px-3 hover:bg-gray-100 text-gray-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label={language === 'en' ? 'Decrease quantity' : 'Giảm số lượng'}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-4 py-1.5 text-base sm:text-lg text-gray-900 min-w-[40px] text-center">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      disabled={
                        !isAvailable ||
                        (availableStock !== null && quantity >= availableStock)
                      }
                      onClick={() =>
                        setQuantity((q) =>
                          availableStock !== null ? Math.min(availableStock, q + 1) : q + 1
                        )
                      }
                      className={cn(
                        "p-2 sm:px-3 transition-colors cursor-pointer",
                        !isAvailable || (availableStock !== null && quantity >= availableStock)
                          ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                          : "hover:bg-gray-100 text-gray-700"
                      )}
                      aria-label={language === 'en' ? 'Increase quantity' : 'Tăng số lượng'}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs text-text-muted">
                    {language === 'en' ? 'Total: ' : 'Tổng cộng: '}
                    <strong className="text-[1.125em]">{formatPrice(combo.salePrice * quantity)}đ</strong>
                  </span>
                  <span className={cn(
                    "text-sm px-2.5 py-1 rounded-lg border shadow-2xs",
                    !isAvailable || availableStock === 0
                      ? "text-red-800 bg-red-50 border-red-200"
                      : availableStock !== null && availableStock <= 10
                      ? "text-amber-800 bg-amber-50 border-amber-200"
                      : "text-emerald-800 bg-emerald-50 border-emerald-200"
                  )}>
                    {!isAvailable || availableStock === 0
                      ? 'Hết hàng'
                      : availableStock !== null && availableStock <= 10
                      ? `Chỉ còn ${availableStock} combo`
                      : 'Còn hàng'}
                  </span>
                </div>

                {/* Cảnh báo khi người dùng chạm trần số lượng */}
                {availableStock !== null && quantity >= availableStock && availableStock > 0 && (
                  <p className="text-sm text-amber-800 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Đã đạt số lượng tối đa của cửa hàng này</span>
                  </p>
                )}

                {/* Hết hàng tại chi nhánh đã chọn: gợi ý cửa hàng khác còn hàng */}
                {(!isAvailable || availableStock === 0) && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-2.5">
                    <div className="flex items-center gap-2 text-red-900 text-[1.125em]">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{selectedBranch?.name || 'Chi nhánh hiện tại'} hiện đã hết hàng cho Combo này</span>
                    </div>

                    {alternativeStores.length > 0 ? (
                      <div className="pt-2 border-t border-red-200/70 space-y-2">
                        <p className="text-slate-700 font-medium">
                          Gợi ý chi nhánh khác còn hàng sẵn sàng giao:
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white rounded-lg border border-red-100 shadow-2xs">
                          <div>
                            <p className="text-gray-900 text-sm">
                              {alternativeStores[0].name}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {alternativeStores[0].address}
                              {typeof alternativeStores[0].distanceKm === 'number' && ` (~${alternativeStores[0].distanceKm.toFixed(1)} km)`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              useBranchStore.getState().setSelectedBranch(alternativeStores[0]);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm shrink-0 cursor-pointer transition-colors shadow-xs"
                          >
                            Chuyển sang cửa hàng này
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={openBranchModal}
                        className="text-sm text-emerald-800 underline cursor-pointer hover:text-emerald-950 block text-left pt-1"
                      >
                        Chọn chi nhánh khác còn hàng
                      </button>
                    )}
                  </div>
                )}

                {/* Hai nút hành động chính */}
                <div ref={buyButtonsRef} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    disabled={!isAvailable}
                    onClick={(e) => isAvailable && handleAddToCart(e)}
                    className={cn(
                      "w-full py-3.5 px-5 rounded-xl text-base sm:text-lg shadow-md transition-all flex items-center justify-center gap-2",
                      isAvailable
                        ? "bg-green-primary hover:bg-green-dark text-white hover:shadow-lg active:scale-[0.98] cursor-pointer"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300 shadow-none"
                    )}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-5 h-5 text-white" />
                        <span>{language === 'en' ? 'Added to cart!' : 'Đã thêm vào giỏ!'}</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-5 h-5" />
                        <span>{isAvailable ? (language === 'en' ? 'Add to Cart' : 'Thêm vào giỏ hàng') : 'Hết hàng tại chi nhánh'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => isAvailable && handleBuyNow()}
                    className={cn(
                      "w-full py-3.5 px-5 rounded-xl text-base sm:text-lg shadow-md transition-all flex items-center justify-center gap-2",
                      isAvailable
                        ? "bg-corn hover:bg-yellow-400 text-text-dark hover:shadow-lg active:scale-[0.98] cursor-pointer"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none"
                    )}
                  >
                    <span>{language === 'en' ? 'Buy Now' : 'Mua ngay'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Hotline & Cam kết chất lượng */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-ivory border border-gray-200/80 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-gray-800 font-medium">
                  <Phone className="w-4 h-4 text-green-primary" />
                  <span>
                    {language === 'en'
                      ? 'Need bulk order advice for events / companies?'
                      : 'Cần tư vấn đặt số lượng lớn cho sự kiện/công ty?'}
                  </span>
                </div>
                <a
                  href="tel:02862915024"
                  className="text-green-primary hover:underline text-[1.125em]"
                >
                  Hotline: 028 6291 5024
                </a>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-gray-600">
                <div className="p-2 rounded-lg bg-gray-50 flex flex-col items-center gap-1">
                  <Truck className="w-4 h-4 text-emerald-700" />
                  <span>{language === 'en' ? 'Fast 2h delivery' : 'Giao nhanh 2h'}</span>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 flex flex-col items-center gap-1">
                  <span>{language === 'en' ? 'Cold store 0-4°C' : 'Bảo quản lạnh 0-4°C'}</span>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 flex flex-col items-center gap-1">
                  <RotateCcw className="w-4 h-4 text-emerald-700" />
                  <span>{language === 'en' ? 'Attentive returns' : 'Đổi trả chu đáo'}</span>
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Cột phải (giống trang sản phẩm): thẻ Sponsored */}
          <div className="hidden lg:block lg:col-span-3 xl:col-span-3 lg:sticky lg:top-[168px]">
            <ProductSidebarSponsoredCard currentProductId={combo.id} />
          </div>
        </div>

        {/* Hiển thị dưới thông tin khi ở màn hình mobile (< lg) */}
        <div className="block lg:hidden mt-6">
          <ProductSidebarSponsoredCard currentProductId={combo.id} />
        </div>
      </div>

      {!isCustomizable && (
        <MobileBuyBar
          visible={showMobileBuyBar}
          price={combo.salePrice * quantity}
          packLabel={`${combo.totalItems} ${language === 'en' ? 'bottles' : 'chai'}${quantity > 1 ? ` × ${quantity}` : ''}`}
          canAdd={isAvailable && availableStock !== 0}
          isOutOfStock={!isAvailable || availableStock === 0}
          onAddToCart={(e) => handleAddToCart(e)}
          onBuyNow={handleBuyNow}
          onChangeBranch={openBranchModal}
          language={language}
        />
      )}

      {/* Lightbox Zoom Modal via Portal */}
      {isZoomOpen && mounted && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setIsZoomOpen(false)}
          className="fixed inset-0 z-[99999] bg-ink-950/90 backdrop-blur-md flex items-center justify-center p-4 select-none"
        >
          {/* Close button */}
          <button
            onClick={() => setIsZoomOpen(false)}
            className="absolute top-5 right-5 z-50 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105 cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Prev button */}
          {galleryImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
              }}
              className="absolute left-4 z-50 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer hidden sm:flex items-center justify-center"
              aria-label="Ảnh trước"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next button */}
          {galleryImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev + 1) % galleryImages.length);
              }}
              className="absolute right-4 z-50 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer hidden sm:flex items-center justify-center"
              aria-label="Ảnh tiếp theo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Image container */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-5xl w-full h-[80vh] flex items-center justify-center"
          >
            <Image
              src={activeImage.url}
              alt={activeImage.alt}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>

          {/* Bottom caption */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/15 backdrop-blur-md px-5 py-2 rounded-full text-white text-sm font-medium border border-white/10 flex items-center gap-2"
          >
            <span className="text-orange-400 text-[1.125em]">{activeIndex + 1}</span>
            <span className="text-white/60">/</span>
            <span>{galleryImages.length}</span>
            <span className="text-white/40">•</span>
            <span>{activeImage.alt}</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
