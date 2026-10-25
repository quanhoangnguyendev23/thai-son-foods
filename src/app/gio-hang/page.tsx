'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCartStore, getItemBottleMultiplier, getItemMaxQuantity } from '@/store/cart';
import { formatPrice, safeFetchJson } from '@/lib/utils';
import {
  Trash2,
  ShoppingBag,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Truck,
  CheckCircle2,
  Minus,
  Plus,
  RotateCcw,
  Store,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { products } from '@/data/products';
import { combos } from '@/data/combos';
import { useCartInventory } from '@/hooks/useCartInventory';

const MIN_ORDER_THRESHOLD = 120000;
const FREE_SHIPPING_THRESHOLD = 200000;

export default function CartPage() {
  const { language } = useLanguage();
  const [isMounted, setIsMounted] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const {
    items,
    addItem,
    removeItem,
    increaseQuantity,
    decreaseQuantity,
    setQuantity,
    clearCart,
  } = useCartStore();

  // Kiểm tra tồn kho ngay tại giỏ hàng để khách biết món nào thiếu trước khi sang bước thanh toán
  const {
    isAvailable: stockAvailable,
    shortItems,
    itemLimits,
    checkFailed,
    alternativeStores,
    selectedBranch,
    setSelectedBranch,
    openBranchModal,
  } = useCartInventory();

  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [activeImpulseTab, setActiveImpulseTab] = useState<'products' | 'combos'>('products');
  const productScrollRef = useRef<HTMLDivElement>(null);
  const comboScrollRef = useRef<HTMLDivElement>(null);

  const scrollShelf = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (!ref.current) return;
    const scrollAmount = direction === 'left' ? -340 : 340;
    ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const handleQuickAddProduct = (product: (typeof products)[0]) => {
    // Luôn chọn quy cách đóng gói tiêu chuẩn (Lốc 7 chai hoặc Lốc 5 chai), không bao giờ thêm chai lẻ
    const minVariant = (product.variants && product.variants.length > 0)
      ? [...product.variants].sort((a, b) => (a.quantity || 0) - (b.quantity || 0))[0]
      : null;

    const isBigBottle = product.slug?.includes('yoo') || product.volume?.includes('568') || product.price === 25000;
    const fallbackQty = isBigBottle ? 5 : 7;
    const effectiveVariant = minVariant || {
      id: isBigBottle ? 'default-5chai' : 'default-7chai',
      name: `${fallbackQty} chai`,
      quantity: fallbackQty,
      price: product.price * fallbackQty,
      unit: 'lốc',
    };

    const productName = language === 'en' && product.nameEn ? product.nameEn : product.name;
    const packUnit = language === 'en'
      ? `Pack of ${effectiveVariant.quantity} bottles`
      : `Lốc ${effectiveVariant.name}`;

    addItem({
      productId: `${product.id}-${effectiveVariant.id}`,
      name: `${productName} (${effectiveVariant.name})`,
      slug: product.slug,
      price: effectiveVariant.price,
      unit: packUnit,
      thumbnail: product.thumbnail,
      variantId: effectiveVariant.id,
      variantName: effectiveVariant.name,
    });

    setAddedIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [product.id]: false }));
    }, 1500);
  };

  const handleQuickAddCombo = (combo: (typeof combos)[0]) => {
    const comboName = language === 'en' && combo.nameEn ? combo.nameEn : combo.name;
    const unitText = language === 'en' ? `${combo.totalItems} bottles` : `${combo.totalItems} chai`;

    addItem({
      productId: combo.id,
      name: comboName,
      slug: combo.slug || '#combo',
      price: combo.salePrice,
      unit: unitText,
      thumbnail: combo.image,
    });

    setAddedIds((prev) => ({ ...prev, [combo.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [combo.id]: false }));
    }, 1500);
  };

  const [shelfProducts, setShelfProducts] = useState(products.filter((p) => p.isActive !== false).slice(0, 12));
  const [promoCombos, setPromoCombos] = useState(combos.filter((c) => c.isActive !== false).slice(0, 12));

  useEffect(() => {
    safeFetchJson<{ success: boolean; data: any[] }>('/api/products')
      .then((json) => {
        if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
          setShelfProducts(json.data.filter((p: any) => p.isActive !== false).slice(0, 12));
        }
      })
      .catch((err) => console.error('Failed to fetch shelf products:', err));

    safeFetchJson<{ success: boolean; data: any[] }>('/api/combos')
      .then((json) => {
        if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
          setPromoCombos(json.data.filter((c: any) => c.isActive !== false).slice(0, 12));
        }
      })
      .catch((err) => console.error('Failed to fetch promo combos:', err));
  }, []);

  const totalQuantity = items.reduce((t, i) => t + i.quantity, 0);
  const subtotal = items.reduce((t, i) => t + i.price * i.quantity, 0);
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 30000;
  const total = subtotal + shippingFee;

  // Tiến trình miễn phí vận chuyển
  const freeShipProgress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const remainingForFreeShip = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  // Kiểm tra nếu giỏ hàng có combo -> combo tính sau (được phép đặt dù dưới 120k)
  const hasCombo = items.some((i) => i.productId.includes('combo') || i.slug?.includes('combo'));
  const isEligibleToOrder = subtotal >= MIN_ORDER_THRESHOLD || hasCombo;
  const missingForMinOrder = Math.max(0, MIN_ORDER_THRESHOLD - subtotal);

  // Loading skeleton trong lúc client hydrate
  if (!isMounted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-20">
        <div className="max-w-md w-full mx-auto px-4 text-center animate-pulse">
          <div className="w-20 h-20 bg-emerald-100/60 rounded-full flex items-center justify-center mx-auto mb-5">
            <ShoppingBag className="w-10 h-10 text-emerald-300" />
          </div>
          <div className="h-6 bg-gray-200 rounded-md w-52 mx-auto mb-3" />
          <div className="h-4 bg-gray-100 rounded-md w-72 mx-auto" />
        </div>
      </div>
    );
  }

  // ─── PHÂN ĐOẠN SIÊU THỊ TRƯỚC QUẦY THU NGÂN (12 MÃ SP & 12 COMBO GỌN GÀNG TRÊN 1 HÀNG) ───
  const renderSupermarketShowcase = () => (
    <div className="mt-8 pt-7 border-t border-gray-200/90 space-y-8">
      {/* ═════════ SECTION A: KỆ MÁT TIỆN LỢI TRƯỚC QUẦY THU NGÂN (12 MÃ SP - 1 HÀNG) ═════════ */}
      <section aria-labelledby="checkout-shelf-heading" className="space-y-3">
        {/* Header section gọn gàng */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs">
                <Store className="w-3 h-3 text-amber-600" />
                <span>{language === 'en' ? 'CHECKOUT AISLE (12 ITEMS)' : 'LỐI VÀO QUẦY THU NGÂN • TIỆN TAY BỎ GIỎ (12 MÓN)'}</span>
              </span>
            </div>
            <h2 id="checkout-shelf-heading" className="text-xl sm:text-2xl text-gray-900 font-heading tracking-tight leading-snug">
              {language === 'en'
                ? 'Grab Before You Go – Refreshing Treats to Take Home'
                : 'Tiện tay thêm vào giỏ – Mát lạnh mang về ngay!'}
            </h2>
          </div>

          {/* Điều hướng cuộn ngang */}
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            <span className="text-[11px] font-medium text-gray-400 mr-1 hidden sm:inline">
              {language === 'en' ? 'Scroll 12 items' : 'Trượt xem 12 món'}
            </span>
            <button
              type="button"
              onClick={() => scrollShelf(productScrollRef, 'left')}
              className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-gray-600 hover:text-emerald-700 flex items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer"
              aria-label="Cuộn sang trái"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollShelf(productScrollRef, 'right')}
              className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-gray-600 hover:text-emerald-700 flex items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer"
              aria-label="Cuộn sang phải"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Danh sách 12 sản phẩm trên 1 hàng ngang trượt mượt mà, thẻ thu nhỏ gọn gàng */}
        <div
          ref={productScrollRef}
          className="flex flex-nowrap gap-3 overflow-x-auto pb-3 pt-0.5 scrollbar-thin scrollbar-thumb-emerald-200/80 scroll-smooth -mx-1 px-1"
        >
          {shelfProducts.map((prod) => {
            const inCartItem = items.find((i) => i.productId === prod.id);
            const inCartQty = inCartItem?.quantity || 0;
            const isJustAdded = !!addedIds[prod.id];
            const isPoster =
              prod.thumbnail.includes('620x930') ||
              prod.thumbnail.includes('800x1200') ||
              prod.thumbnail.includes('lifestyle') ||
              prod.imageFit === 'cover';
            const prodName = language === 'en' && prod.nameEn ? prod.nameEn : prod.name;

            return (
              <div
                key={prod.id}
                className="w-[155px] sm:w-[170px] md:w-[180px] shrink-0 bg-white rounded-xl border border-gray-200/80 hover:border-emerald-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between p-2.5 group relative"
              >
                <div>
                  {/* Ảnh sản phẩm thu nhỏ gọn gàng */}
                  <div className="relative h-28 sm:h-32 w-full rounded-lg overflow-hidden bg-gray-50/80 mb-2 border border-gray-100 flex items-center justify-center">
                    {prod.thumbnail ? (
                    <Image
                      src={prod.thumbnail}
                      alt={prod.name}
                      fill
                      sizes="180px"
                      className={`${
                        isPoster ? 'object-cover' : 'object-contain p-1.5'
                      } transition-transform duration-200`}
                    />
                    ) : null}

                    {/* Huy hiệu trên ảnh */}
                    <div className="absolute top-1 left-1 flex flex-col gap-0.5 z-10">
                      {prod.isBestSeller ? (
                        <span className="px-1.5 py-0.5 text-[9.5px] rounded bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs">
                          Hot
                        </span>
                      ) : prod.isNew ? (
                        <span className="px-1.5 py-0.5 text-[9.5px] rounded bg-emerald-600 text-white shadow-xs">
                          Mới
                        </span>
                      ) : null}
                    </div>

                    {inCartQty > 0 && (
                      <div className="absolute top-1 right-1 z-10">
                        <span className="px-1.5 py-0.5 text-[9.5px] rounded bg-emerald-800 text-white shadow-xs border border-emerald-700">
                          x{inCartQty}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tên & quy cách gọn gàng */}
                  <Link
                    href={`/san-pham/${prod.slug}`}
                    className="text-[12.5px] sm:text-sm text-gray-900 line-clamp-2 group-hover:text-emerald-700 transition-colors leading-snug block mb-0.5"
                    title={prodName}
                  >
                    {prodName}
                  </Link>
                  <p className="text-[10px] text-gray-400 font-medium truncate mb-1">
                    {prod.volume || '330ml'} • {language === 'en' ? 'Natural' : 'Tươi mát'}
                  </p>
                </div>

                {/* Giá & Nút Tiện tay thêm nhỏ gọn */}
                <div className="mt-auto pt-1.5 border-t border-gray-100 flex flex-col gap-1.5">
                  {(() => {
                    const minVariant = (prod.variants && prod.variants.length > 0)
                      ? [...prod.variants].sort((a, b) => (a.quantity || 0) - (b.quantity || 0))[0]
                      : null;
                    const isBigBottle = prod.slug?.includes('yoo') || prod.volume?.includes('568') || prod.price === 25000;
                    const fallbackQty = isBigBottle ? 5 : 7;
                    const effectiveVariant = minVariant || {
                      id: isBigBottle ? 'default-5chai' : 'default-7chai',
                      name: `${fallbackQty} chai`,
                      quantity: fallbackQty,
                      price: prod.price * fallbackQty,
                      unit: 'lốc',
                    };
                    const packLabel = language === 'en'
                      ? `pack ${effectiveVariant.quantity}`
                      : `lốc ${effectiveVariant.name}`;

                    return (
                      <>
                        <div className="flex flex-col">
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm sm:text-[15.5px] text-emerald-700 font-heading">
                              {formatPrice(effectiveVariant.price)}đ
                            </span>
                            <span className="text-[10px] text-gray-500">
                              /{packLabel}
                            </span>
                          </div>
                          <span className="text-[8px] sm:text-[8.5px] text-gray-400 font-normal">
                            ~{formatPrice(prod.price)}đ/{language === 'en' ? 'bottle' : 'chai'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleQuickAddProduct(prod)}
                          className={`w-full py-1.5 px-2 rounded-lg text-[11.5px] sm:text-[12px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                            isJustAdded
                              ? 'bg-emerald-600 text-white ring-1 ring-emerald-300'
                              : 'bg-emerald-50 hover:bg-emerald-700 text-emerald-800 hover:text-white border border-emerald-200/80 hover:border-emerald-700'
                          }`}
                        >
                          {isJustAdded ? (
                            <>
                              <Check className="w-3 h-3 stroke-[3]" />
                              <span>{language === 'en' ? 'Added!' : 'Đã thêm!'}</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>
                                {inCartQty > 0
                                  ? (language === 'en' ? '+1 pack' : '+1 lốc nữa')
                                  : (language === 'en' ? `+ Add pack` : `+ Thêm lốc ${effectiveVariant.name}`)}
                              </span>
                            </>
                          )}
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═════════ SECTION B: Ụ HÀNG COMBO SIÊU HỜI RINH VỀ CHO CẢ NHÀ (12 COMBO - 1 HÀNG) ═════════ */}
      <section aria-labelledby="checkout-combos-heading" className="space-y-3">
        {/* Header combo với phong cách ụ khuyến mãi siêu thị */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] bg-rose-50 text-rose-900 border border-rose-200/80 shadow-2xs">
                <span>{language === 'en' ? 'SPECIAL COMBOS (12 PACKS)' : 'KHU Ụ HÀNG KHUYẾN MÃI CUỐI QUẦY • MUA NHIỀU GIẢM SÂU (12 COMBO)'}</span>
              </span>
            </div>
            <h2 id="checkout-combos-heading" className="text-xl sm:text-2xl text-gray-900 font-heading tracking-tight leading-snug">
              {language === 'en'
                ? 'Take-Home Bundles – Multiply Your Family Savings'
                : 'Gói quà rinh về – Tiết kiệm gấp bội cho cả nhà'}
            </h2>
          </div>

          {/* Điều hướng cuộn ngang combo */}
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            <span className="text-[11px] font-medium text-gray-400 mr-1 hidden sm:inline">
              {language === 'en' ? 'Scroll 12 combos' : 'Trượt xem 12 combo'}
            </span>
            <button
              type="button"
              onClick={() => scrollShelf(comboScrollRef, 'left')}
              className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-gray-600 hover:text-emerald-700 flex items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer"
              aria-label="Cuộn combo sang trái"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollShelf(comboScrollRef, 'right')}
              className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-gray-600 hover:text-emerald-700 flex items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer"
              aria-label="Cuộn combo sang phải"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Danh sách 12 combo trên 1 hàng ngang trượt mượt mà, thẻ thu nhỏ gọn gàng */}
        <div
          ref={comboScrollRef}
          className="flex flex-nowrap gap-3 overflow-x-auto pb-3 pt-0.5 scrollbar-thin scrollbar-thumb-emerald-200/80 scroll-smooth -mx-1 px-1"
        >
          {promoCombos.map((combo) => {
            const inCartCombo = items.find((i) => i.productId === combo.id);
            const comboInCartQty = inCartCombo?.quantity || 0;
            const isJustAdded = !!addedIds[combo.id];
            const savedMoney = combo.originalPrice - combo.salePrice;
            const comboTitle = language === 'en' && combo.nameEn ? combo.nameEn : combo.name;

            return (
              <div
                key={combo.id}
                className="w-[205px] sm:w-[225px] md:w-[240px] shrink-0 bg-white rounded-xl border border-gray-200/90 hover:border-emerald-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between p-2.5 sm:p-3 group relative"
              >
                <div>
                  {/* Ảnh combo với badge giảm giá */}
                  <div className="relative h-28 sm:h-32 w-full rounded-lg overflow-hidden bg-gray-50 mb-2 border border-gray-100">
                    {combo.image ? (
                    <Image
                      src={combo.image}
                      alt={combo.name}
                      fill
                      sizes="240px"
                      className="object-cover transition-transform duration-200"
                    />
                    ) : null}

                    {/* Badges góc trên */}
                    <div className="absolute top-1 left-1 flex items-center gap-1 z-10">
                      <span className="px-1.5 py-0.5 text-[9.5px] rounded bg-rose-600 text-white shadow-xs">
                        -{combo.discount}%
                      </span>
                      <span className="px-1.5 py-0.5 text-[9px] rounded bg-gray-900/85 text-white backdrop-blur-xs">
                        {combo.totalItems} {language === 'en' ? 'bottles' : 'chai'}
                      </span>
                    </div>

                    {comboInCartQty > 0 && (
                      <div className="absolute top-1 right-1 z-10">
                        <span className="px-1.5 py-0.5 text-[9.5px] rounded bg-emerald-800 text-white shadow-xs border border-emerald-700">
                          x{comboInCartQty}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tiêu đề combo */}
                  <Link
                    href={`/combo/${combo.slug}`}
                    className="text-sm sm:text-[14.5px] text-gray-900 line-clamp-2 group-hover:text-emerald-700 transition-colors leading-snug block mb-1"
                    title={comboTitle}
                  >
                    {comboTitle}
                  </Link>

                  {/* Tag quyền lợi đặc quyền */}
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80 truncate">
                    <span className="truncate">
                      {language === 'en' ? 'Instant order eligible' : 'Đủ điều kiện đặt ngay'}
                    </span>
                  </div>
                </div>

                {/* Giá & Nút Rinh combo */}
                <div className="mt-auto pt-2 border-t border-gray-100 flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm sm:text-base text-rose-600 font-heading">
                        {formatPrice(combo.salePrice)}đ
                      </span>
                      <span className="text-[10px] text-gray-400 line-through">
                        {formatPrice(combo.originalPrice)}đ
                      </span>
                    </div>
                    {savedMoney > 0 && (
                      <span className="text-[10.5px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                        -{formatPrice(savedMoney)}đ
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleQuickAddCombo(combo)}
                    className={`w-full py-1.5 px-2.5 rounded-lg text-[12px] sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                      isJustAdded
                        ? 'bg-emerald-600 text-white ring-1 ring-emerald-300'
                        : 'bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-emerald-900/10'
                    }`}
                  >
                    {isJustAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>{language === 'en' ? 'Added!' : 'Đã rinh!'}</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {comboInCartQty > 0
                            ? language === 'en'
                              ? '+1 pack'
                              : '+1 gói nữa'
                            : language === 'en'
                            ? '+ Grab Combo'
                            : '+ Rinh Combo'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );

  // Giao diện khi giỏ hàng trống
  if (items.length === 0) {
    return (
      <div className="bg-ivory/70 min-h-screen py-12">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="max-w-md w-full mx-auto px-4 text-center mb-8">
            <div className="w-24 h-24 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xs">
              <ShoppingBag className="w-12 h-12 text-emerald-600/70" />
            </div>
            <h1 className="text-2xl sm:text-3xl text-gray-900 font-heading mb-2.5">
              {language === 'en' ? 'Your cart is empty' : 'Giỏ hàng của bạn đang trống'}
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-sm mx-auto">
              {language === 'en'
                ? 'Select any of our fresh refreshing bottles or family bundles below to get started!'
                : 'Hãy tiện tay chọn ngay những chai đồ uống thanh mát hoặc combo tiết kiệm bên dưới nhé!'}
            </p>
            <Link
              href="/#san-pham"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-800 to-emerald-700 text-white rounded-2xl shadow-lg shadow-emerald-900/15 hover:shadow-xl hover:brightness-105 active:scale-95 transition-all text-base"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{language === 'en' ? 'Explore Full Catalog' : 'Khám phá tất cả sản phẩm'}</span>
            </Link>
          </div>

          {/* Kệ hàng siêu thị tiện lợi trước quầy */}
          {renderSupermarketShowcase()}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ivory/70 min-h-screen pb-16 pt-5">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        {/* ─── 1. BREADCRUMB TINH TẾ ─── */}
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
            <li>
              <Link href="/" className="hover:text-emerald-700 transition-colors">
                {language === 'en' ? 'Home' : 'Trang chủ'}
              </Link>
            </li>
            <li>/</li>
            <li className="text-gray-900 text-[1.125em]">
              {language === 'en' ? 'Shopping Cart' : 'Giỏ hàng'}
            </li>
          </ol>
        </nav>

        {/* ─── 2. TIÊU ĐỀ TRANG & TIỆN ÍCH ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-2 border-b border-gray-200/60">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl text-gray-900 font-heading tracking-tight">
              {language === 'en' ? 'Your Shopping Cart' : 'Giỏ hàng của bạn'}
            </h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-emerald-100 text-emerald-800 border border-emerald-200">
              {language === 'en'
                ? `${totalQuantity} ${totalQuantity === 1 ? 'item' : 'items'}`
                : `${totalQuantity} sản phẩm`}
            </span>
          </div>

          <Link
            href="/#san-pham"
            className="inline-flex items-center gap-1.5 text-sm sm:text-base text-emerald-700 hover:text-emerald-800 transition-colors self-start sm:self-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{language === 'en' ? 'Continue Shopping' : 'Tiếp tục mua hàng'}</span>
          </Link>
        </div>

        {/* ─── 3. BỐ CỤC CHÍNH 2 CỘT ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* CỘT TRÁI (8 CỘT): DANH SÁCH SẢN PHẨM TRONG THẺ CARD CHỈNH CHU */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {/* THANH MIỄN PHÍ VẬN CHUYỂN NỔI BẬT */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-100/90 shadow-xs">
              <div className="flex items-center justify-between gap-3 mb-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-gray-900 text-[1.125em]">
                  <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                  {remainingForFreeShip <= 0 ? (
                    <span className="text-emerald-700">
                      {language === 'en'
                        ? 'Congratulations! Your order qualifies for FREE SHIPPING!'
                        : 'Chúc mừng! Đơn hàng của bạn đã được MIỄN PHÍ VẬN CHUYỂN!'}
                    </span>
                  ) : (
                    <span>
                      {language === 'en' ? (
                        <>
                          Add{' '}
                          <span className="text-emerald-700 text-[1.125em]">
                            {formatPrice(remainingForFreeShip)}đ
                          </span>{' '}
                          more for <span className="text-emerald-800 underline">Nationwide Free Shipping</span>
                        </>
                      ) : (
                        <>
                          Mua thêm{' '}
                          <span className="text-emerald-700 text-[1.125em]">
                            {formatPrice(remainingForFreeShip)}đ
                          </span>{' '}
                          để được nhận <span className="text-emerald-800 underline">Freeship toàn quốc</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
                <span className="text-emerald-700 text-sm shrink-0">
                  {Math.round(freeShipProgress)}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden p-0.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${freeShipProgress}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
                />
              </div>
            </div>

            {/* Cảnh báo thiếu hàng tại kho đang chọn (kèm cách xử lý) */}
            {isMounted && !stockAvailable && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900 space-y-2.5" role="alert">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[1.125em]">
                      {language === 'en'
                        ? `${selectedBranch?.name || 'The selected store'} does not have enough stock for this cart`
                        : `Kho ${selectedBranch?.name || 'đang chọn'} chưa đủ số lượng cho giỏ hàng này`}
                    </p>
                    <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                      {language === 'en'
                        ? 'Reduce the quantity of the highlighted items below, or switch to a store that has stock.'
                        : 'Bạn có thể giảm số lượng ở món được đánh dấu bên dưới, hoặc đổi sang kho còn hàng để đặt ngay.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-6">
                  {alternativeStores.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedBranch(alternativeStores[0] as any)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs hover:bg-emerald-800 transition-colors cursor-pointer"
                    >
                      {language === 'en'
                        ? `Switch to ${alternativeStores[0].name} (in stock)`
                        : `Đổi sang ${alternativeStores[0].name} (đủ hàng)`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openBranchModal}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-900 text-xs hover:bg-amber-100/60 transition-colors cursor-pointer"
                  >
                    {language === 'en' ? 'Choose another store' : 'Chọn kho khác'}
                  </button>
                </div>
              </div>
            )}

            {/* THẺ CHỨA TOÀN BỘ DANH SÁCH MÓN HÀNG */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
              {/* Tiêu đề bảng trên desktop */}
              <div className="hidden md:grid grid-cols-[3.2fr_1fr_1.3fr_1.1fr_44px] gap-3 px-6 py-3.5 bg-gray-50/90 border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                <span>{language === 'en' ? 'Product' : 'Sản phẩm'}</span>
                <span className="text-center">{language === 'en' ? 'Unit Price' : 'Đơn giá'}</span>
                <span className="text-center">{language === 'en' ? 'Quantity' : 'Số lượng'}</span>
                <span className="text-right">{language === 'en' ? 'Subtotal' : 'Thành tiền'}</span>
                <span className="text-center">{language === 'en' ? 'Remove' : 'Xóa'}</span>
              </div>

              {/* Các hàng sản phẩm */}
              <div className="divide-y divide-gray-100">
                {items.map((item) => {
                  const productMatch = products.find((p) => p.id === item.productId || p.slug === item.slug);
                  const comboMatch = combos.find((c) => c.id === item.productId || c.slug === item.slug);
                  const displayName = language === 'en'
                    ? (productMatch?.nameEn || comboMatch?.nameEn || item.name)
                    : item.name;
                  const displayUnit = language === 'en'
                    ? (productMatch?.unitEn || (item.unit === 'chai' ? 'bottle' : item.unit === 'lốc 6 chai' ? 'pack of 6 bottles' : item.unit === 'thùng 24 chai' ? 'carton of 24 bottles' : item.unit))
                    : item.unit;

                  return (
                    <div
                      key={`${item.productId}-${item.variantId || 'default'}`}
                      className="p-4 sm:p-5 md:px-6 md:py-4.5 grid grid-cols-1 md:grid-cols-[3.2fr_1fr_1.3fr_1.1fr_44px] gap-3 md:gap-3 items-center hover:bg-emerald-50/15 transition-colors"
                    >
                      {/* 1. Thông tin sản phẩm & ảnh */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Link
                          href={`/san-pham/${item.slug}`}
                          className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-ivory/70 border border-gray-200/80 shrink-0 p-1 flex items-center justify-center group"
                        >
                          {item.thumbnail ? (
                          <Image
                            src={item.thumbnail}
                            alt={displayName}
                            fill
                            className="object-contain transition-transform duration-300"
                            sizes="80px"
                          />
                          ) : null}
                        </Link>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/san-pham/${item.slug}`}
                            className="text-base sm:text-[17px] text-gray-900 hover:text-emerald-700 transition-colors leading-snug"
                          >
                            {displayName}
                          </Link>
                          {displayUnit && (
                            <div className="mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[12px] bg-gray-100 text-gray-700 border border-gray-200/60">
                                {language === 'en' ? `Spec: ${displayUnit}` : `Quy cách: ${displayUnit}`}
                              </span>
                            </div>
                          )}

                          {/* Đơn giá trên mobile */}
                          <div className="flex items-center justify-between mt-2 md:hidden">
                            <span className="text-sm text-gray-600">
                              {formatPrice(item.price)}đ
                            </span>
                            <span className="text-sm text-emerald-800">
                              {language === 'en' ? 'Subtotal: ' : 'Thành tiền: '}
                              {formatPrice(item.price * item.quantity)}đ
                            </span>
                          </div>

                          {/* Báo thiếu hàng ngay trên dòng món */}
                          {isMounted && (() => {
                            const sh = shortItems.find((s) => s.productId === item.productId);
                            if (!sh) return null;
                            return (
                              <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-900 leading-snug" role="status">
                                <span>
                                  {sh.maxQuantity > 0
                                    ? (language === 'en' ? `Only ${sh.maxQuantity} left at this store.` : `Kho này chỉ còn ${sh.maxQuantity}.`)
                                    : (language === 'en' ? 'Out of stock at this store.' : 'Kho này tạm hết hàng.')}
                                </span>{' '}
                                {sh.maxQuantity > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => setQuantity(item.productId, sh.maxQuantity)}
                                    className="underline text-emerald-800 hover:text-emerald-900 cursor-pointer"
                                  >
                                    {language === 'en' ? `Reduce to ${sh.maxQuantity}` : `Giảm còn ${sh.maxQuantity}`}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => removeItem(item.productId, item.variantId)}
                                    className="underline text-emerald-800 hover:text-emerald-900 cursor-pointer"
                                  >
                                    {language === 'en' ? 'Remove' : 'Xóa khỏi giỏ'}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* 2. Đơn giá (Desktop) */}
                      <div className="hidden md:block text-center text-base text-gray-700">
                        {formatPrice(item.price)}đ
                      </div>

                      {/* 3. Bộ tăng giảm số lượng (Ràng buộc tối đa 1.000 chai) */}
                      {(() => {
                        const itemMultiplier = getItemBottleMultiplier(item);
                        const stockLimit = itemLimits.find((l) => l.productId === item.productId)?.maxQuantity;
                        const ruleMax = getItemMaxQuantity(item);
                        const maxAllowed = typeof stockLimit === 'number' ? Math.max(1, Math.min(ruleMax, stockLimit)) : ruleMax;
                        const totalBottles = item.quantity * itemMultiplier;
                        const isAtMax = item.quantity >= maxAllowed;
                        const atStockLimit = typeof stockLimit === 'number' && stockLimit < ruleMax && item.quantity >= stockLimit;

                        return (
                          <div className="flex flex-col items-center justify-between md:justify-center mt-1 md:mt-0 gap-1">
                            <span className="text-xs text-gray-500 font-medium md:hidden self-start">
                              {language === 'en' ? 'Quantity:' : 'Số lượng:'}
                            </span>
                            <div className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50/70 p-0.5 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => decreaseQuantity(item.productId)}
                                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-emerald-800 hover:bg-white active:scale-95 transition-all cursor-pointer"
                                aria-label={language === 'en' ? 'Decrease 1' : 'Giảm 1'}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={maxAllowed}
                                value={item.quantity}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === '') return;
                                  const val = parseInt(raw, 10);
                                  if (!isNaN(val) && val > 0) {
                                    setQuantity(item.productId, Math.min(maxAllowed, val));
                                  }
                                }}
                                className="w-12 sm:w-14 text-center text-lg sm:text-sm sm:text-base text-gray-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                aria-label={language === 'en' ? 'Product quantity' : 'Số lượng sản phẩm'}
                              />
                              <button
                                type="button"
                                onClick={() => increaseQuantity(item.productId)}
                                disabled={isAtMax}
                                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-emerald-800 hover:bg-white active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label={language === 'en' ? 'Increase 1' : 'Tăng 1'}
                                title={isAtMax ? (atStockLimit ? (language === 'en' ? 'Reached the stock available at this store' : 'Đã đạt số lượng còn tại kho này') : (language === 'en' ? 'Reached 1,000 bottles limit' : 'Đã đạt giới hạn tối đa 1.000 chai')) : undefined}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 4. Thành tiền (Desktop) */}
                      <div className="hidden md:block text-right text-base sm:text-lg text-emerald-800">
                        {formatPrice(item.price * item.quantity)}đ
                      </div>

                      {/* 5. Nút xóa món */}
                      <div className="flex justify-end md:justify-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId, item.variantId)}
                          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title={language === 'en' ? 'Remove this item' : 'Xóa sản phẩm này'}
                          aria-label={language === 'en' ? `Remove ${displayName}` : `Xóa ${displayName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chân card: Tiếp tục mua sắm & Nút xóa tất cả an toàn */}
              <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between gap-4">
                <Link
                  href="/#san-pham"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm sm:text-base text-gray-700 hover:text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all shadow-2xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{language === 'en' ? 'Continue shopping' : 'Tiếp tục chọn thêm món'}</span>
                </Link>

                {showClearConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-medium hidden sm:inline">
                      {language === 'en' ? 'Clear all items?' : 'Xác nhận xóa hết?'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-200/70 rounded-lg transition-colors cursor-pointer"
                    >
                      {language === 'en' ? 'Cancel' : 'Hủy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearCart();
                        setShowClearConfirm(false);
                      }}
                      className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      {language === 'en' ? 'Confirm clear' : 'Đồng ý xóa'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{language === 'en' ? 'Clear shopping cart' : 'Xóa toàn bộ giỏ hàng'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (4 CỘT - 30% DIỆN TÍCH): TÓM TẮT ĐƠN HÀNG & KỆ GỢI Ý MUA HÀNG TIỆN TAY TRƯỚC QUẦY */}
          <div className="lg:col-span-4 sticky top-[90px] space-y-4">
            {/* ─── 1. KHỐI TÓM TẮT ĐƠN HÀNG (QUICK CHECKOUT SUMMARY) ─── */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2 text-base sm:text-lg text-gray-900 font-heading">
                  <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700" />
                  <span>{language === 'en' ? 'Order Summary' : 'Tóm tắt đơn hàng'}</span>
                </div>
                <span className="text-xs text-gray-400 font-medium">
                  {language === 'en'
                    ? `${totalQuantity} ${totalQuantity === 1 ? 'item' : 'items'}`
                    : `${totalQuantity} món`}
                </span>
              </div>

              {/* Chi tiết tính tiền */}
              <div className="space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between items-center text-gray-600">
                  <span>{language === 'en' ? 'Items Subtotal:' : 'Tạm tính tiền hàng:'}</span>
                  <span className="text-gray-900 text-[1.125em]">{formatPrice(subtotal)}đ</span>
                </div>

                <div className="flex justify-between items-center text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <span>{language === 'en' ? 'Shipping Fee:' : 'Phí vận chuyển:'}</span>
                    {shippingFee === 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px]">
                        FREESHIP
                      </span>
                    )}
                  </div>
                  <span className="text-gray-900 text-[1.125em]">
                    {shippingFee === 0 ? (
                      <span className="text-emerald-700 text-[1.125em]">
                        {language === 'en' ? 'Free' : 'Miễn phí'}
                      </span>
                    ) : (
                      `${formatPrice(shippingFee)}đ`
                    )}
                  </span>
                </div>

                {/* Đường kẻ đứt trang nhã */}
                <div className="border-t border-dashed border-gray-200 my-1 pt-2.5 flex justify-between items-baseline">
                  <div>
                    <span className="text-sm sm:text-base text-gray-900 block">
                      {language === 'en' ? 'Total Payment:' : 'Tổng thanh toán:'}
                    </span>
                    <span className="text-[10.5px] text-gray-400 font-normal">
                      {language === 'en' ? '(Taxes & shipping included)' : '(Đã gồm thuế & phí ship)'}
                    </span>
                  </div>
                  <span className="text-2xl sm:text-2xl text-emerald-800">
                    {formatPrice(total)}đ
                  </span>
                </div>
              </div>

              {/* Cảnh báo đơn hàng tối thiểu 120.000đ */}
              {!isEligibleToOrder ? (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-800 text-[1.125em]">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{language === 'en' ? 'Min order is 120,000đ' : 'Mức đặt hàng tối thiểu 120.000đ'}</span>
                  </div>
                  <p className="text-amber-700 text-[11px] leading-relaxed">
                    {language === 'en' ? (
                      <>
                        Add <strong className="text-amber-950 text-[1.125em]">{formatPrice(missingForMinOrder)}đ</strong> more to checkout.
                      </>
                    ) : (
                      <>
                        Chọn thêm <strong className="text-amber-950 text-[1.125em]">{formatPrice(missingForMinOrder)}đ</strong> để tiếp tục thanh toán.
                      </>
                    )}
                  </p>
                </div>
              ) : hasCombo && subtotal < MIN_ORDER_THRESHOLD ? (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center gap-1.5">
                  <span>
                    {language === 'en'
                      ? 'Combo included — Order eligible!'
                      : 'Đơn có Combo — Đủ điều kiện đặt hàng!'}
                  </span>
                </div>
              ) : null}

              {/* Nút hành động thanh toán */}
              {isEligibleToOrder && isMounted && checkFailed ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm text-center leading-snug cursor-not-allowed"
                >
                  {language === 'en'
                    ? 'Could not verify stock. Please reload and try again'
                    : 'Chưa kiểm tra được tồn kho. Vui lòng tải lại trang và thử lại'}
                </button>
              ) : isEligibleToOrder && isMounted && !stockAvailable ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm text-center leading-snug cursor-not-allowed"
                >
                  {language === 'en'
                    ? 'This store is short on stock. Please resolve the notice above'
                    : 'Kho này chưa đủ hàng. Vui lòng xử lý cảnh báo phía trên'}
                </button>
              ) : isEligibleToOrder ? (
                <Link
                  href="/thanh-toan"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-800 via-forest-700 to-emerald-900 text-white text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 hover:shadow-xl hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span>{language === 'en' ? 'Proceed to Checkout' : 'Tiến hành thanh toán'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 rounded-xl bg-gray-200 text-gray-400 text-sm sm:text-base cursor-not-allowed text-center"
                >
                  {language === 'en'
                    ? `Add ${formatPrice(missingForMinOrder)}đ more`
                    : `Cần thêm ${formatPrice(missingForMinOrder)}đ`}
                </button>
              )}

              <p className="text-center text-[10.5px] text-gray-400">
                {language === 'en'
                  ? 'Cash on Delivery (COD) & QR Bank Transfer'
                  : 'Thanh toán khi nhận hàng (COD) hoặc Chuyển khoản QR'}
              </p>
            </div>

            {/* ─── 2. KỆ HÀNG GỢI Ý MUA HÀNG TRƯỚC QUẦY THU NGÂN (3 PHẦN - GỢI Ý MUA HÀNG NGAY TẠI ĐÓ) ─── */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
              {/* Header kệ siêu thị tiện lợi */}
              <div className="p-3.5 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/70 border-b border-emerald-100/90">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] bg-white text-emerald-800 border border-emerald-200/90 shadow-2xs">
                    <Store className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{language === 'en' ? 'Checkout Aisle' : 'Kệ trước quầy thu ngân'}</span>
                  </span>
                  <span className="text-[12px] text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-200/60">
                    {activeImpulseTab === 'products'
                      ? (language === 'en' ? '12 fresh packs' : '12 lốc mát lạnh')
                      : (language === 'en' ? '12 family bundles' : '12 combo tiết kiệm')}
                  </span>
                </div>

                <h3 className="text-[16.5px] font-heading text-emerald-950 tracking-tight leading-snug">
                  {language === 'en' ? 'Grab Before You Go' : 'Tiện tay bỏ giỏ trước khi về'}
                </h3>
                <p className="text-[11px] text-emerald-700/90 leading-normal mt-0.5">
                  {language === 'en'
                    ? '1-click to add chilled drinks & discount bundles!'
                    : '1 chạm vào giỏ, nhận ngay đồ uống thanh mát & combo hời!'}
                </p>

                {/* Tab Switcher 2 ngăn: Chai nước (12) vs Combo (12) */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-emerald-100/60 rounded-xl mt-2.5 border border-emerald-200/70">
                  <button
                    type="button"
                    onClick={() => setActiveImpulseTab('products')}
                    className={`py-1.5 px-2 rounded-lg text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeImpulseTab === 'products'
                        ? 'bg-white text-emerald-900 shadow-xs border border-emerald-200/60'
                        : 'text-emerald-800/80 hover:text-emerald-900 hover:bg-white/60'
                    }`}
                  >
                    <span>{language === 'en' ? '12 Packs' : '12 Lốc mát'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveImpulseTab('combos')}
                    className={`py-1.5 px-2 rounded-lg text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeImpulseTab === 'combos'
                        ? 'bg-white text-emerald-900 shadow-xs border border-emerald-200/60'
                        : 'text-emerald-800/80 hover:text-emerald-900 hover:bg-white/60'
                    }`}
                  >
                    <span>{language === 'en' ? '12 Combos' : '12 Combo hời'}</span>
                  </button>
                </div>
              </div>

              {/* Danh sách 12 món cuộn mượt mà có scrollbar tùy chỉnh */}
              <div className="p-2.5 space-y-1.5 max-h-[440px] overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-200/90 divide-y divide-gray-100/80">
                {activeImpulseTab === 'products'
                  ? shelfProducts.map((prod) => {
                      // Cộng số lượng của mọi quy cách (lốc) của sản phẩm này đang có trong giỏ
                      const inCartQty = items.reduce(
                        (sum, i) => (i.productId === prod.id || i.productId?.startsWith(`${prod.id}-`) ? sum + i.quantity : sum),
                        0
                      );
                      const isJustAdded = !!addedIds[prod.id];
                      const isPoster =
                        prod.thumbnail.includes('620x930') ||
                        prod.thumbnail.includes('800x1200') ||
                        prod.thumbnail.includes('lifestyle') ||
                        prod.imageFit === 'cover';
                      const prodName = language === 'en' && prod.nameEn ? prod.nameEn : prod.name;

                      return (
                        <div
                          key={prod.id}
                          className="flex items-center gap-3 group hover:bg-emerald-50/40 p-2 rounded-xl transition-colors"
                        >
                          {/* Ảnh sản phẩm vuông vắn bo góc */}
                          <div className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-lg bg-gray-50 border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                            {prod.thumbnail ? (
                            <Image
                              src={prod.thumbnail}
                              alt={prod.name}
                              fill
                              sizes="72px"
                              className={`${isPoster ? 'object-cover' : 'object-contain p-1'} transition-transform duration-200`}
                            />
                            ) : null}
                            {prod.isBestSeller ? (
                              <span className="absolute top-0.5 left-0.5 px-1 py-0.2 text-[10px] rounded bg-amber-500 text-ink-950 leading-tight">
                                Hot
                              </span>
                            ) : prod.isNew ? (
                              <span className="absolute top-0.5 left-0.5 px-1 py-0.2 text-[10px] rounded bg-emerald-600 text-white leading-tight">
                                Mới
                              </span>
                            ) : null}

                            {inCartQty > 0 && (
                              <span
                                className="absolute bottom-0.5 right-0.5 px-1 py-0.2 text-[10px] rounded bg-emerald-800 text-white shadow-2xs"
                                title={language === 'en' ? `${inCartQty} in your cart` : `Đang có ${inCartQty} trong giỏ`}
                                aria-label={language === 'en' ? `${inCartQty} in your cart` : `Đang có ${inCartQty} trong giỏ`}
                              >
                                x{inCartQty}
                              </span>
                            )}
                          </div>

                          {/* Thông tin sản phẩm */}
                          <div className="flex-1 min-w-0 pr-1">
                            <Link
                              href={`/san-pham/${prod.slug}`}
                              className="text-[14px] sm:text-[15px] text-gray-900 line-clamp-2 break-words group-hover:text-emerald-700 transition-colors leading-snug"
                              title={prodName}
                            >
                              {prodName}
                            </Link>
                            <p className="text-[11px] text-gray-500 truncate mt-0.5">
                              {prod.volume || '330ml'} • {language === 'en' ? 'Natural' : 'Tươi mát'}
                            </p>
                            {(() => {
                              const minVariant = (prod.variants && prod.variants.length > 0)
                                ? [...prod.variants].sort((a, b) => (a.quantity || 0) - (b.quantity || 0))[0]
                                : null;
                              const isBigBottle = prod.slug?.includes('yoo') || prod.volume?.includes('568') || prod.price === 25000;
                              const fallbackQty = isBigBottle ? 5 : 7;
                              const effectiveVariant = minVariant || {
                                id: isBigBottle ? 'default-5chai' : 'default-7chai',
                                name: `${fallbackQty} chai`,
                                quantity: fallbackQty,
                                price: prod.price * fallbackQty,
                                unit: 'lốc',
                              };
                              const packLabel = language === 'en'
                                ? `pack ${effectiveVariant.quantity}`
                                : `lốc ${effectiveVariant.name}`;

                              return (
                                <div className="flex flex-col mt-0.5">
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-sm sm:text-[14.5px] text-emerald-700 font-heading">
                                      {formatPrice(effectiveVariant.price)}đ
                                    </span>
                                    <span className="text-[11px] text-gray-500">
                                      /{packLabel}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-gray-500">
                                    ~{formatPrice(prod.price)}đ/{language === 'en' ? 'bottle' : 'chai'}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Nút bấm thêm nhanh */}
                          <button
                            type="button"
                            onClick={() => handleQuickAddProduct(prod)}
                            className={`shrink-0 min-w-[84px] py-1.5 px-2 sm:px-2.5 rounded-lg text-[12px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                              isJustAdded
                                ? 'bg-emerald-600 text-white ring-1 ring-emerald-300'
                                : 'bg-emerald-50 hover:bg-emerald-700 text-emerald-800 hover:text-white border border-emerald-200/80 hover:border-emerald-700'
                            }`}
                            title={language === 'en' ? 'Add pack to cart' : 'Tiện tay thêm lốc'}
                          >
                            {isJustAdded ? (
                              <>
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>{language === 'en' ? 'Added' : 'Đã thêm'}</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                <span>{inCartQty > 0 ? (language === 'en' ? '1 more pack' : '1 lốc nữa') : (language === 'en' ? 'Add pack' : 'Thêm lốc')}</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })
                  : promoCombos.map((combo) => {
                      const inCartCombo = items.find((i) => i.productId === combo.id);
                      const comboInCartQty = inCartCombo?.quantity || 0;
                      const isJustAdded = !!addedIds[combo.id];
                      const savedMoney = combo.originalPrice - combo.salePrice;
                      const comboTitle = language === 'en' && combo.nameEn ? combo.nameEn : combo.name;

                      return (
                        <div
                          key={combo.id}
                          className="flex items-center gap-3 group hover:bg-rose-50/30 p-2 rounded-xl transition-colors"
                        >
                          {/* Ảnh combo bo góc */}
                          <div className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-lg bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                            {combo.image ? (
                            <Image
                              src={combo.image}
                              alt={combo.name}
                              fill
                              sizes="72px"
                              className="object-cover transition-transform duration-200"
                            />
                            ) : null}
                            <span className="absolute top-0.5 left-0.5 px-1 py-0.2 text-[10px] rounded bg-rose-600 text-white leading-tight">
                              -{combo.discount}%
                            </span>
                            {comboInCartQty > 0 && (
                              <span
                                className="absolute bottom-0.5 right-0.5 px-1 py-0.2 text-[10px] rounded bg-emerald-800 text-white shadow-2xs"
                                title={language === 'en' ? `${comboInCartQty} in your cart` : `Đang có ${comboInCartQty} trong giỏ`}
                                aria-label={language === 'en' ? `${comboInCartQty} in your cart` : `Đang có ${comboInCartQty} trong giỏ`}
                              >
                                x{comboInCartQty}
                              </span>
                            )}
                          </div>

                          {/* Thông tin combo */}
                          <div className="flex-1 min-w-0 pr-1">
                            <Link
                              href={`/combo/${combo.slug}`}
                              className="text-[14px] sm:text-[15px] text-gray-900 line-clamp-2 break-words group-hover:text-emerald-700 transition-colors leading-snug"
                              title={comboTitle}
                            >
                              {comboTitle}
                            </Link>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-gray-500 font-medium">
                                {combo.totalItems} {language === 'en' ? 'bottles' : 'chai'}
                              </span>
                              {savedMoney > 0 && (
                                <span className="text-[10.5px] text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-100">
                                  -{formatPrice(savedMoney)}đ
                                </span>
                              )}
                            </div>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                              <span className="text-sm sm:text-[14.5px] text-rose-600 font-heading">
                                {formatPrice(combo.salePrice)}đ
                              </span>
                              <span className="text-[11px] text-gray-400 line-through">
                                {formatPrice(combo.originalPrice)}đ
                              </span>
                            </div>
                          </div>

                          {/* Nút rinh combo */}
                          <button
                            type="button"
                            onClick={() => handleQuickAddCombo(combo)}
                            className={`shrink-0 min-w-[84px] py-1.5 px-2 sm:px-2.5 rounded-lg text-[12px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                              isJustAdded
                                ? 'bg-emerald-600 text-white ring-1 ring-emerald-300'
                                : 'bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-emerald-900/10'
                            }`}
                            title={language === 'en' ? 'Grab combo' : 'Rinh combo'}
                          >
                            {isJustAdded ? (
                              <>
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>{language === 'en' ? 'Added' : 'Đã rinh'}</span>
                              </>
                            ) : (
                              <>
                                <span>{comboInCartQty > 0 ? (language === 'en' ? '+1' : '+1 nữa') : (language === 'en' ? '+ Rinh' : '+ Rinh')}</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
              </div>

              {/* Chân kệ gợi ý: Thông báo trải nghiệm siêu thị */}
              <div className="px-3 py-2 bg-emerald-50/60 border-t border-emerald-100/70 text-center text-[10.5px] text-emerald-800 font-medium flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  {language === 'en'
                    ? 'Instant 1-click addition to your checkout cart!'
                    : '1 chạm là cập nhật tức thì vào giỏ hàng bên cạnh!'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
