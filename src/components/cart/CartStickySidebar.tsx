'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  CheckCircle2,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { useCartStore, getItemMaxQuantity } from '@/store/cart';
import { useFlyToCart } from '@/context/FlyToCartContext';
import { formatPrice } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useCartInventory } from '@/hooks/useCartInventory';

export default function CartStickySidebar() {
  const { language } = useLanguage();
  const { isSoundEnabled, toggleSound } = useFlyToCart();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    getTotalPrice,
  } = useCartStore();

  const totalPrice = getTotalPrice();
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);

  const freeShippingThreshold = 200000;
  const progress = Math.min((totalPrice / freeShippingThreshold) * 100, 100);
  const remainingForFreeShipping = freeShippingThreshold - totalPrice;

  const {
    isAvailable,
    insufficientItems,
    alternativeStores,
    selectedBranch,
    setSelectedBranch,
    openBranchModal,
  } = useCartInventory();

  // Tránh Hydration Mismatch: Render giao diện khởi tạo đồng bộ SSR trước khi đọc localStorage
  if (!isMounted) {
    return (
      <div className="flex flex-col h-full bg-white select-none">
        {/* Header tĩnh */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light bg-ivory/50">
          <div className="flex items-center gap-2.5">
            <div id="cart-target-sticky-ssr" className="relative w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg text-forest-950 font-heading leading-tight">
                {language === 'en' ? 'Your Cart' : 'Giỏ hàng của bạn'}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[12px] text-emerald-800">
                  {language === 'en' ? 'Live updates' : 'Cập nhật trực tiếp'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Thanh freeship tĩnh */}
        <div className="px-5 py-3 bg-emerald-50/50 border-b border-emerald-100/80">
          <div className="flex items-center justify-between text-xs text-text-dark mb-1.5">
            <span className="font-medium text-text-body">
              {language === 'en' ? (
                <>Add <strong className="text-emerald-800 text-[1.125em]">200.000đ</strong> more for Free Shipping</>
              ) : (
                <>Mua thêm <strong className="text-emerald-800 text-[1.125em]">200.000đ</strong> để được Freeship</>
              )}
            </span>
            <span className="text-emerald-900 text-[12px]">0%</span>
          </div>
          <div className="w-full h-2 bg-emerald-100/70 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full w-0" />
          </div>
        </div>

        {/* Khung trạng thái giỏ rỗng ban đầu */}
        <div className="h-full flex flex-col items-center justify-center py-12 text-center">
          <div className="w-20 h-20 bg-ivory rounded-2xl flex items-center justify-center mb-4 border border-dashed border-gray-300">
            <ShoppingBag className="w-9 h-9 text-gray-400" />
          </div>
          <h3 className="text-lg text-text-dark font-heading mb-1">
            {language === 'en' ? 'Your cart is empty' : 'Giỏ hàng đang trống'}
          </h3>
          <p className="text-xs text-text-muted max-w-[240px] leading-relaxed mb-4">
            {language === 'en'
              ? 'Select delicious natural beverages from Thai Son Foods to add to your cart!'
              : 'Hãy chọn những thức uống thơm ngon tự nhiên từ Thái Sơn Foods để bỏ vào giỏ nhé!'}
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full">
            {language === 'en' ? 'Click "Add to Cart" on the left' : 'Bấm "Thêm vào giỏ" bên trái'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white select-none">
      {/* 1. HEADER SIDEBAR: TIÊU ĐỀ & TRẠNG THÁI REALTIME */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-light bg-ivory/50">
        <div className="flex items-center gap-2.5">
          <div id="cart-target-sticky" className="relative w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shadow-xs transition-transform">
            <ShoppingBag className="w-5 h-5" />
            {totalQuantity > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sale text-white text-[11px] flex items-center justify-center shadow-xs">
                {totalQuantity > 99 ? '99+' : totalQuantity}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-lg text-forest-950 font-heading leading-tight">
              {language === 'en' ? 'Your Cart' : 'Giỏ hàng của bạn'}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[12px] text-emerald-800">
                {totalQuantity > 0
                  ? (language === 'en' ? `${totalQuantity} item(s) in cart` : `${totalQuantity} sản phẩm trong giỏ`)
                  : (language === 'en' ? 'Live updates' : 'Cập nhật trực tiếp')}
              </span>
            </div>
          </div>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            className="text-sm text-gray-400 hover:text-sale transition-colors cursor-pointer"
            title={language === 'en' ? 'Clear all items in cart' : 'Xóa tất cả món trong giỏ'}
          >
            {language === 'en' ? 'Clear' : 'Làm trống'}
          </button>
        )}
      </div>

      {/* 2. THANH TIẾN TRÌNH FREESHIP */}
      <div className="px-5 py-3 bg-emerald-50/50 border-b border-emerald-100/80">
        <div className="flex items-center justify-between text-xs text-text-dark mb-1.5">
          <span className="font-medium text-text-body">
            {remainingForFreeShipping <= 0 ? (
              <span className="text-emerald-800 flex items-center gap-1 text-[1.125em]">
                {language === 'en' ? 'FREE SHIPPING UNLOCKED!' : 'Đủ điều kiện MIỄN PHÍ VẬN CHUYỂN!'}
              </span>
            ) : (
              language === 'en' ? (
                <>
                  Add{' '}
                  <strong className="text-emerald-800 text-[1.125em]">
                    {formatPrice(remainingForFreeShipping)}đ
                  </strong>{' '}
                  more for Free Shipping
                </>
              ) : (
                <>
                  Mua thêm{' '}
                  <strong className="text-emerald-800 text-[1.125em]">
                    {formatPrice(remainingForFreeShipping)}đ
                  </strong>{' '}
                  để được Freeship
                </>
              )
            )}
          </span>
          <span className="text-emerald-900 text-[12px]">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full h-2 bg-emerald-100/70 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="h-full bg-emerald-600 rounded-full"
          />
        </div>
      </div>

      {/* Chỉ báo chi nhánh đang phục vụ giỏ hàng */}
      <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 truncate text-gray-700">
          <MapPin className="w-3.5 h-3.5 text-forest-700 shrink-0" />
          <span className="text-text-muted hidden sm:inline shrink-0">Kho:</span>
          <span className="text-gray-900 truncate text-[1.125em]">
            {selectedBranch?.name || 'Cửa Hàng NH - Phú Thọ Hòa'}
          </span>
        </div>
        <button
          type="button"
          onClick={openBranchModal}
          className="text-forest-700 hover:text-emerald-800 underline cursor-pointer shrink-0 ml-2 text-[1.125em]"
        >
          {language === 'en' ? 'Change' : 'Đổi'}
        </button>
      </div>

      {/* 3. DANH SÁCH SẢN PHẨM TRONG GIỎ (CUỘN ĐỘC LẬP) */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 divide-y divide-gray-100">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-12 text-center">
            <div className="w-20 h-20 bg-ivory rounded-2xl flex items-center justify-center mb-4 border border-dashed border-gray-300">
              <ShoppingBag className="w-9 h-9 text-gray-400" />
            </div>
            <h3 className="text-lg text-text-dark font-heading mb-1">
              {language === 'en' ? 'Your cart is empty' : 'Giỏ hàng đang trống'}
            </h3>
            <p className="text-xs text-text-muted max-w-[240px] leading-relaxed mb-4">
              {language === 'en'
                ? 'Select delicious natural beverages from Thai Son Foods to add to your cart!'
                : 'Hãy chọn những thức uống thơm ngon tự nhiên từ Thái Sơn Foods để bỏ vào giỏ nhé!'}
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full">
              {language === 'en' ? 'Click "Add to Cart" on the left' : 'Bấm "Thêm vào giỏ" bên trái'}
            </span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.div
                key={`${item.productId}-${item.variantId || 'default'}`}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="pt-3 first:pt-0 flex items-center gap-3 group"
              >
                {/* Thumbnail sản phẩm */}
                <div className="relative w-14 h-16 rounded-xl overflow-hidden bg-ivory shrink-0 border border-gray-100 p-1 flex items-center justify-center">
                  <Image
                    src={item.thumbnail}
                    alt={item.name}
                    fill
                    className="object-contain p-0.5"
                    sizes="56px"
                  />
                </div>

                {/* Thông tin món */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm sm:text-[15px] text-text-dark leading-snug break-words">
                    {item.name}
                  </h4>
                  {item.variantName && (
                    <p className="text-[11px] text-text-muted leading-snug break-words mt-0.5">
                      {item.variantName}
                    </p>
                  )}
                  <p className="text-sm text-emerald-800 mt-1">
                    {formatPrice(item.price)}đ
                  </p>

                  {/* Nút tăng/giảm số lượng */}
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.productId,
                            Math.max(0, item.quantity - 1),
                            item.variantId
                          )
                        }
                        className="p-1 text-gray-500 hover:text-text-dark hover:bg-gray-100 transition-colors cursor-pointer"
                        aria-label="Giảm số lượng"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-sm text-text-dark min-w-[20px] text-center">
                        {item.quantity}
                      </span>
                      {(() => {
                        const isAtMax = item.quantity >= getItemMaxQuantity(item);
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.quantity + 1,
                                item.variantId
                              )
                            }
                            disabled={isAtMax}
                            className="p-1 text-gray-500 hover:text-text-dark hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Tăng số lượng"
                            title={isAtMax ? 'Đã đạt giới hạn tối đa 1.000 chai' : undefined}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-dark">
                        {formatPrice(item.price * item.quantity)}đ
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="p-1 text-gray-400 hover:text-sale transition-colors cursor-pointer"
                        aria-label="Xóa sản phẩm"
                        title="Xóa món này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* 4. FOOTER TỔNG KẾT & NÚT ĐẶT HÀNG NHANH */}
      {items.length > 0 && (
        <div className="p-4 border-t border-border-light bg-ivory/40 space-y-3 shrink-0">
          {/* Tạm tính */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted font-medium">
              {language === 'en' ? 'Subtotal:' : 'Tạm tính:'}
            </span>
            <div className="text-right">
              <span className="text-emerald-800 text-xl">
                {formatPrice(totalPrice)}đ
              </span>
              <span className="text-[11px] text-gray-400 block font-normal">
                {remainingForFreeShipping <= 0
                  ? (language === 'en' ? 'Free Shipping' : 'Miễn phí vận chuyển')
                  : (language === 'en' ? '+ Shipping calculated at checkout' : '+ Phí ship tính khi thanh toán')}
              </span>
            </div>
          </div>

          {/* Cảnh báo thiếu hàng nếu có */}
          {!isAvailable && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-900 text-[1.125em]">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Chi nhánh hiện chưa đủ số lượng</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-snug">
                Chúng tôi đang nỗ lực điều phối để bổ sung sớm nhất. Quý khách vui lòng đổi chi nhánh còn hàng để được phục vụ ngay.
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                {insufficientItems.map((it) => (
                  <li key={it.productId}>
                    <strong className="text-[1.125em]">{it.productName.slice(0, 32)}...</strong>: cần {it.requested}, kho còn {it.available}
                  </li>
                ))}
              </ul>
              {alternativeStores.length > 0 ? (
                <div className="pt-1 border-t border-amber-200/70 flex items-center justify-between gap-1">
                  <span className="text-[11px] text-gray-700">
                    Kho <strong className="text-[1.125em]">{alternativeStores[0].name.slice(0, 16)}</strong> đủ hàng
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedBranch(alternativeStores[0] as any)}
                    className="text-[12px] text-emerald-800 underline hover:text-emerald-900 cursor-pointer"
                  >
                    Đổi kho này
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openBranchModal}
                  className="text-[12px] text-emerald-800 underline cursor-pointer block text-left"
                >
                  Chọn chi nhánh khác còn hàng
                </button>
              )}
            </div>
          )}

          {/* Nút đặt hàng - chuyển hướng sang trang đặt hàng (/thanh-toan) */}
          {isAvailable ? (
            <Link
              href="/thanh-toan"
              className="w-full py-3 bg-gradient-to-r from-emerald-700 to-forest-800 text-white rounded-xl hover:opacity-95 transition-all text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
            >
              <span>{language === 'en' ? 'Place Order' : 'Đặt hàng'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="w-full py-2.5 px-2 bg-amber-50/90 text-amber-950 rounded-xl text-sm flex flex-col items-center justify-center cursor-not-allowed border border-amber-300 text-center leading-tight gap-0.5 shadow-xs"
            >
              <span className="text-amber-950 text-sm">
                {language === 'en' ? 'Branch currently out of stock' : 'Chi nhánh tạm chưa đủ hàng'}
              </span>
              <span className="text-[10.5px] text-amber-800 font-normal">
                {language === 'en' ? 'We are restocking • Please switch branch' : 'Đang nỗ lực điều phối • Vui lòng đổi chi nhánh'}
              </span>
            </button>
          )}

          {/* Nút xem chi tiết giỏ hàng */}
          <Link
            href="/gio-hang"
            className="w-full py-2 px-2 bg-white border border-gray-200 text-text-dark rounded-xl hover:bg-gray-50 transition-all text-sm text-center flex items-center justify-center block"
          >
            {language === 'en' ? 'View Cart' : 'Xem giỏ hàng'}
          </Link>

          <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {language === 'en' ? 'Nationwide delivery' : 'Giao hàng tận nơi toàn quốc'}
            </span>
            <span>{language === 'en' ? 'COD / Bank transfer' : 'Thanh toán COD / CK'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
