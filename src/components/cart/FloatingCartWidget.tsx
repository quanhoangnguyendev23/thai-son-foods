'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, CheckCircle2, ChevronRight, X, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { useLanguage } from '@/context/LanguageContext';
import { formatPrice } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { products } from '@/data/products';
import { combos } from '@/data/combos';

export default function FloatingCartWidget() {
  const [isMounted, setIsMounted] = useState(false);
  const { language } = useLanguage();
  const {
    items,
    getTotalPrice,
    lastAddedItem,
    clearLastAddedItem,
  } = useCartStore();

  const [toastItem, setToastItem] = useState<typeof lastAddedItem>(null);
  const [bounceKey, setBounceKey] = useState(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalPrice = getTotalPrice();
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);

  // Lắng nghe khi có món mới vừa được thêm vào giỏ ("quăng vào giỏ")
  useEffect(() => {
    if (lastAddedItem) {
      setToastItem(lastAddedItem);
      setBounceKey((k) => k + 1); // Kích hoạt hiệu ứng nảy/rung của widget

      // Tự động đóng popup mini sau 3.5 giây
      const timer = setTimeout(() => {
        setToastItem(null);
        clearLastAddedItem();
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, [lastAddedItem, clearLastAddedItem]);

  const productMatch = toastItem ? products.find((p) => p.id === toastItem.productId || p.slug === toastItem.slug) : null;
  const comboMatch = toastItem ? combos.find((c) => c.id === toastItem.productId || c.slug === toastItem.slug) : null;
  const toastName = toastItem ? (language === 'en' ? (productMatch?.nameEn || comboMatch?.nameEn || toastItem.name) : toastItem.name) : '';

  return (
    <div className="fixed bottom-6 right-4 sm:bottom-7 sm:right-6 z-40 flex flex-col items-end pointer-events-none select-none">
      {/* ─────────────────────────────────────────────────────────────
          1. POPUP MINI PREVIEW: HIỆN LÊN GỌN GÀNG KHI MÓN VỪA ĐƯỢC QUĂNG VÀO GIỎ
          (Tuyệt đối KHÔNG có backdrop đen che mờ màn hình!)
      ────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isMounted && toastItem && (
          <motion.div
            key={`toast-${toastItem.productId}-${bounceKey}`}
            initial={{ opacity: 0, y: 20, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.9 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="pointer-events-auto mb-3 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-emerald-600/30 p-3 sm:p-3.5 w-[290px] sm:w-[320px] flex flex-col gap-2.5 ring-4 ring-emerald-500/10"
          >
            <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2">
              <div className="flex items-center gap-1.5 text-sm text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{language === 'vi' ? 'Đã quăng vào giỏ hàng!' : 'Added to cart!'}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setToastItem(null);
                  clearLastAddedItem();
                }}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label={language === 'en' ? 'Close notification' : 'Đóng thông báo'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl bg-ivory p-1 shrink-0 border border-emerald-100/80 flex items-center justify-center overflow-hidden">
                <Image
                  src={toastItem.thumbnail}
                  alt={toastName}
                  fill
                  className="object-contain"
                  sizes="48px"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-sm sm:text-[15px] text-forest-950 leading-snug">
                  {toastName}
                </h4>
                <p className="text-sm text-emerald-700 mt-1">
                  {formatPrice(toastItem.price)}đ
                  {toastItem.quantity > 1 ? ` x ${toastItem.quantity}` : ''}
                </p>
              </div>
            </div>

            <Link
              href="/gio-hang"
              onClick={() => {
                setToastItem(null);
                clearLastAddedItem();
              }}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 mt-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[12px] transition-colors cursor-pointer"
            >
              <span>{language === 'vi' ? 'Xem giỏ hàng & thanh toán' : 'View cart & checkout'}</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          2. WIDGET GIỎ HÀNG NỔI "DẠNG NHỎ" (CAPSULE PILL)
          Target cho hiệu ứng bay từ các nút "Thêm vào giỏ" trên trang chủ
      ────────────────────────────────────────────────────────────── */}
      <motion.div
        key={bounceKey}
        initial={{ scale: 0.95 }}
        animate={
          bounceKey > 0
            ? { scale: [1, 1.2, 0.94, 1.05, 1], rotate: [0, -3, 3, -1, 0] }
            : { scale: 1 }
        }
        transition={{ duration: 0.45, ease: 'easeOut' }}
        whileHover={{ scale: 1.04, y: -2 }}
        whileTap={{ scale: 0.96 }}
        className="pointer-events-auto"
      >
        <Link
          href="/gio-hang"
          id="cart-target-floating"
          className="group relative flex items-center gap-2.5 sm:gap-3 px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-full bg-gradient-to-r from-emerald-800 via-forest-700 to-emerald-900 text-white shadow-2xl shadow-emerald-950/40 border border-emerald-500/40 hover:border-emerald-300 transition-all cursor-pointer"
          aria-label={
            language === 'en'
              ? `Cart: ${isMounted ? totalQuantity : 0} items, subtotal ${formatPrice(isMounted ? totalPrice : 0)}đ`
              : `Giỏ hàng: ${isMounted ? totalQuantity : 0} sản phẩm, tổng cộng ${formatPrice(isMounted ? totalPrice : 0)}đ`
          }
        >
          {/* Vòng hào quang nhẹ (Glow Effect) */}
          <span className="absolute -inset-0.5 rounded-full bg-emerald-400 opacity-20 blur-sm group-hover:opacity-40 transition-opacity" />

          {/* Icon túi hàng + Badge đỏ nổi bật */}
          <div className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-white transition-transform" />
            {isMounted && totalQuantity > 0 && (
              <motion.span
                key={`badge-${totalQuantity}`}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-sale text-white text-[12px] flex items-center justify-center shadow-md border-2 border-emerald-900"
              >
                {totalQuantity > 99 ? '99+' : totalQuantity}
              </motion.span>
            )}
          </div>

          {/* Nhãn giỏ hàng & Tạm tính */}
          <div className="relative z-10 text-left min-w-0 pr-0.5">
            <div className="text-[12px] text-emerald-200 leading-tight">
              {isMounted && totalQuantity > 0
                ? (language === 'vi' ? 'Giỏ hàng của bạn' : 'Your Cart')
                : (language === 'vi' ? 'Giỏ hàng' : 'Cart')}
            </div>
            <div className="text-sm sm:text-[15px] text-white leading-tight mt-0.5">
              {isMounted && totalQuantity > 0
                ? `${formatPrice(totalPrice)}đ`
                : (language === 'vi' ? '0 món' : '0 items')}
            </div>
          </div>

          {/* Mũi tên trượt */}
          <div className="relative z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/10 flex items-center justify-center text-emerald-200 group-hover:text-white transition-all">
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </Link>
      </motion.div>
    </div>
  );
}
