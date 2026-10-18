'use client';

import Image from 'next/image';
import Link from 'next/link';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, CheckCircle2, MapPin, AlertTriangle } from 'lucide-react';
import { useCartStore, getItemMaxQuantity } from '@/store/cart';
import { formatPrice } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useCartInventory } from '@/hooks/useCartInventory';

import { usePathname } from 'next/navigation';

export default function CartDrawer() {
  const pathname = usePathname();
  const isPageWithStickySidebar = Boolean(pathname?.startsWith('/san-pham/') || pathname?.startsWith('/combo'));
  const { language } = useLanguage();
  const {
    items,
    isOpen,
    closeCart,
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-xs ${isPageWithStickySidebar ? 'min-[1440px]:hidden' : ''}`}
            onClick={closeCart}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col ${isPageWithStickySidebar ? 'min-[1440px]:hidden' : ''}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-light">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-green-primary" />
                <h2 className="text-xl text-text-dark font-heading">
                  {language === 'en' ? 'Shopping Cart' : 'Giỏ hàng'} ({totalQuantity})
                </h2>
              </div>
              <button
                type="button"
                onClick={closeCart}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-dark hover:bg-ivory transition-colors cursor-pointer"
                aria-label={language === 'en' ? 'Close cart' : 'Đóng giỏ hàng'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chi nhánh đang chọn */}
            <div className="px-4 py-2.5 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-emerald-900 truncate">
                <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="truncate">
                  Kho: <strong className="text-[1.125em]">{selectedBranch?.name || 'Chi nhánh'}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={openBranchModal}
                className="text-emerald-700 hover:text-emerald-900 underline shrink-0 ml-2 cursor-pointer text-[1.125em]"
              >
                Đổi
              </button>
            </div>

            {/* Free Shipping Progress */}
            <div className="p-4 bg-ivory/60 border-b border-border-light">
              <div className="flex items-center justify-between text-xs text-text-dark mb-1.5">
                <span>
                  {remainingForFreeShipping <= 0 ? (
                    <span className="text-green-primary text-[1.125em]">
                      {language === 'en' ? 'You have unlocked FREE SHIPPING!' : 'Bạn được MIỄN PHÍ VẬN CHUYỂN!'}
                    </span>
                  ) : (
                    <>
                      {language === 'en' ? 'Add ' : 'Mua thêm '}
                      <span className="text-green-primary text-[1.125em]">
                        {formatPrice(remainingForFreeShipping)}đ
                      </span>{' '}
                      {language === 'en' ? 'more for free shipping' : 'để được freeship'}
                    </>
                  )}
                </span>
                <span className="font-medium text-text-muted">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="w-full h-2 bg-border-light rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full bg-green-primary rounded-full"
                />
              </div>
            </div>

            {/* Items List */}
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-ivory rounded-full flex items-center justify-center mb-4">
                  <ShoppingBag className="w-10 h-10 text-text-muted" />
                </div>
                <h3 className="text-xl text-text-dark font-heading mb-1">
                  {language === 'en' ? 'Your cart is empty' : 'Giỏ hàng của bạn đang trống'}
                </h3>
                <p className="text-sm text-text-muted mb-6">
                  {language === 'en' ? 'Discover delicious fresh healthy drinks from Thai Son Foods!' : 'Hãy chọn những sản phẩm thơm ngon từ Thái Sơn Foods nhé!'}
                </p>
                <button
                  type="button"
                  onClick={closeCart}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-primary text-white font-medium rounded-xl hover:bg-green-dark transition-colors text-sm cursor-pointer"
                >
                  {language === 'en' ? 'Explore Products' : 'Khám phá sản phẩm'}
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-border-light">
                <AnimatePresence initial={false}>
                {items.map((item) => (
                  <motion.div
                    key={`${item.productId}-${item.variantId || 'default'}`}
                    layout
                    initial={{ opacity: 0, y: -16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, x: 20 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="pt-3 first:pt-0 flex gap-3"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-18 h-18 rounded-lg overflow-hidden bg-ivory shrink-0 border border-border-light">
                      <Image
                        src={item.thumbnail}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="72px"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base text-text-dark leading-snug break-words">
                        {item.name}
                      </h4>
                      {item.variantName && (
                        <p className="text-xs text-text-muted mt-0.5">
                          {item.variantName}
                        </p>
                      )}
                      <p className="text-base text-green-primary mt-1">
                        {formatPrice(item.price)}đ
                      </p>

                      {/* Quantity + Remove */}
                      <div className="flex items-center justify-between mt-2">
                        {(() => {
                          const maxAllowed = getItemMaxQuantity(item);
                          const isAtMax = item.quantity >= maxAllowed;

                          return (
                            <div className="flex items-center border border-border rounded-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    item.productId,
                                    Math.max(0, item.quantity - 1),
                                    item.variantId
                                  )
                                }
                                className="p-1 text-text-muted hover:text-text-dark hover:bg-ivory transition-colors cursor-pointer"
                                aria-label={language === 'en' ? 'Decrease quantity' : 'Giảm số lượng'}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-2.5 text-sm text-text-dark min-w-[24px] text-center">
                                {item.quantity}
                              </span>
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
                                className="p-1 text-text-muted hover:text-text-dark hover:bg-ivory transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label={language === 'en' ? 'Increase quantity' : 'Tăng số lượng'}
                                title={isAtMax ? (language === 'en' ? 'Reached 1,000 bottles limit' : 'Đã đạt giới hạn tối đa 1.000 chai') : undefined}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })()}

                        <button
                          type="button"
                          onClick={() => removeItem(item.productId, item.variantId)}
                          className="p-1 text-text-muted hover:text-sale transition-colors cursor-pointer"
                          aria-label={language === 'en' ? 'Remove item' : 'Xóa sản phẩm'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>
            )}

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-4 border-t border-border-light bg-ivory/30 space-y-3">
                {/* Total */}
                <div className="flex items-center justify-between text-base">
                  <span className="text-text-muted">{language === 'en' ? 'Subtotal:' : 'Tạm tính:'}</span>
                  <span className="text-green-primary text-xl">
                    {formatPrice(totalPrice)}đ
                  </span>
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
                          <strong className="text-[1.125em]">{it.productName.slice(0, 30)}...</strong>: cần {it.requested}, kho còn {it.available}
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

                <div className="space-y-2 pt-1">
                  {/* Nút đặt hàng - chỉ cho phép bấm khi kho đủ hàng */}
                  {isAvailable ? (
                    <Link
                      href="/thanh-toan"
                      onClick={closeCart}
                      className="w-full py-3 bg-green-primary text-white rounded-xl hover:bg-green-dark transition-all text-base flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
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
                  
                  <Link
                    href="/gio-hang"
                    onClick={closeCart}
                    className="w-full py-2 bg-white border border-border text-text-dark font-medium rounded-xl hover:bg-ivory transition-all text-xs text-center flex items-center justify-center block"
                  >
                    {language === 'en' ? 'View Full Cart' : 'Xem chi tiết giỏ hàng'}
                  </Link>
                </div>

                <div className="flex items-center justify-between text-xs text-text-muted pt-1">
                  <span>{language === 'en' ? 'Cash on Delivery (COD)' : 'Thanh toán khi nhận hàng (COD)'}</span>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-text-muted hover:text-sale transition-colors cursor-pointer"
                  >
                    {language === 'en' ? 'Clear all' : 'Xóa tất cả'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
