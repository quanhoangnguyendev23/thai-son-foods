'use client';

import { forwardRef } from 'react';
import { Truck, MapPin, Check, CalendarClock, ShoppingCart, Store } from 'lucide-react';
import { ProductVariant } from '@/types';
import { cn, formatPrice } from '@/lib/utils';
import { calculateShippingFee, INVENTORY_CONFIG } from '@/config/inventory';
import { getUnitPrice, getVariantLabel } from '@/lib/product-detail';
import QuantitySelector from '@/components/product/QuantitySelector';
import { STORE_SALES_INFO } from '@/data/product-detail-content';
import { DeliveryAddressInfo, WishlistButton } from '@/components/product/ProductRealBlocks';
import { PreorderSchedulePlaceholder } from '@/components/product/ProductPlaceholderBlocks';

export interface BuyBoxStock {
  isOutOfStock: boolean;
  isLowStock: boolean;
  /** Số gói tối đa khả dụng tại chi nhánh (null = hệ thống chưa trả số liệu) */
  packsAvailable: number | null;
  remainingCanAdd: number;
  existingCartQty: number;
  alternativeStoreName?: string | null;
}

interface ProductBuyBoxProps {
  variant?: ProductVariant;
  price: number;
  originalPrice?: number | null;
  bottleVolume?: string;
  quantity: number;
  onQuantityChange: (value: number) => void;
  /** Tăng/giảm theo bước, cập nhật dựa trên giá trị mới nhất (an toàn khi bấm liên tục) */
  onQuantityStep: (delta: 1 | -1) => void;
  stock: BuyBoxStock;
  branchName?: string;
  onChangeBranch: () => void;
  onAddToCart: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onBuyNow: () => void;
  addedMessage?: string | null;
  storageText?: string;
  expiryText?: string;
  certification?: string;
  language?: string;
  /** Hiển thị các khối mẫu theo bố cục Amazon (địa chỉ giao, đổi trả, yêu thích) */
  showPlaceholders?: boolean;
  /** Mã sản phẩm / combo dùng cho nút Yêu thích */
  itemId?: string;
  itemType?: 'product' | 'combo';
}

/**
 * Khu vực mua hàng (Buy Box): giá, giao hàng, tồn kho, số lượng và hành động mua.
 * Phí giao hàng lấy từ INVENTORY_CONFIG.SHIPPING (cùng nguồn với trang giỏ hàng / thanh toán).
 */
const ProductBuyBox = forwardRef<HTMLDivElement, ProductBuyBoxProps>(function ProductBuyBox(
  {
    variant,
    price,
    originalPrice,
    bottleVolume,
    quantity,
    onQuantityChange,
    onQuantityStep,
    stock,
    branchName,
    onChangeBranch,
    onAddToCart,
    onBuyNow,
    addedMessage,
    storageText,
    expiryText,
    certification,
    language = 'vi',
    showPlaceholders = true,
    itemId,
    itemType = 'product',
  },
  actionsRef
) {
  const isEn = language === 'en';
  const canAdd = !stock.isOutOfStock && stock.remainingCanAdd > 0;
  const effectiveQty = canAdd ? Math.min(quantity, stock.remainingCanAdd) : 0;
  const subtotal = price * Math.max(1, effectiveQty);
  const shipping = calculateShippingFee(subtotal);
  const freeThreshold = INVENTORY_CONFIG.SHIPPING.FREE_SHIPPING_THRESHOLD;
  const remainingForFree = Math.max(0, freeThreshold - subtotal);
  const packLabel = variant ? getVariantLabel(variant, language) : '';
  const packUnitWord = (variant?.unit || (isEn ? 'pack' : 'gói')).toLowerCase();

  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4 space-y-3.5">
      {/* Giá */}
      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[28px] leading-none text-ink-950">{formatPrice(price)}đ</span>
          {originalPrice && (
            <span className="text-sm text-gray-500 line-through">{formatPrice(originalPrice)}đ</span>
          )}
        </div>
        {variant && (
          <p className="text-xs text-gray-600 mt-1.5">
            {packLabel}
            {bottleVolume ? ` × ${bottleVolume}` : ''} · {formatPrice(getUnitPrice(variant))}đ/{isEn ? 'bottle' : 'chai'}
          </p>
        )}
      </div>

      {/* Giao hàng */}
      <div className="space-y-2 text-[13px] text-ink-950 border-t border-gray-100 pt-3">
        <DeliveryAddressInfo />
        <div className="flex items-start gap-2">
          <Truck className="w-4 h-4 text-green-primary shrink-0 mt-0.5" aria-hidden />
          <div className="leading-snug">
            {shipping.isFree ? (
              <span>
                <strong className="text-green-primary text-[1.125em]">{isEn ? 'Free delivery' : 'Miễn phí giao hàng'}</strong>{' '}
                {isEn ? 'for this order value' : 'cho giá trị đơn này'}
              </span>
            ) : (
              <span>
                {isEn ? 'Delivery fee ' : 'Phí giao hàng '}
                <strong className="text-[1.125em]">{formatPrice(shipping.fee)}đ</strong>.{' '}
                {isEn ? 'Add ' : 'Mua thêm '}
                <strong className="text-[1.125em]">{formatPrice(remainingForFree)}đ</strong>
                {isEn ? ' for free delivery' : ' để được miễn phí giao hàng'}
              </span>
            )}
            <span className="block text-[11px] text-gray-500 mt-0.5">
              {isEn
                ? `Free delivery from ${formatPrice(freeThreshold)}đ. Final fee is confirmed at checkout.`
                : `Miễn phí cho đơn từ ${formatPrice(freeThreshold)}đ. Phí chính xác được xác nhận ở bước thanh toán.`}
            </span>
          </div>
        </div>
      </div>

      {/* Chọn cách nhận hàng: giao hôm nay / đặt trước (bản mẫu, chỉ hiện khi bật cờ placeholder) */}
      {showPlaceholders && <PreorderSchedulePlaceholder />}

      {/* Tồn kho */}
      <div className="text-[17px]" aria-live="polite">
        {stock.isOutOfStock ? (
          <div className="space-y-1">
            <p className="text-red-600">{isEn ? 'Out of stock at this branch' : 'Tạm hết hàng tại chi nhánh này'}</p>
            <p className="text-xs font-normal text-gray-600">
              {isEn
                ? 'We are working to restock soon. Farther branches may have higher delivery fees.'
                : 'Chúng tôi đang nỗ lực để sớm có hàng trở lại. Bạn có thể tham khảo các kho xa hơn nhưng có thể tốn chi phí giao hàng cao hơn.'}
            </p>
            {stock.alternativeStoreName && (
              <p className="text-xs font-normal text-gray-600">
                {isEn ? 'Available at: ' : 'Còn hàng tại: '}
                <strong className="text-[1.125em]">{stock.alternativeStoreName}</strong>
              </p>
            )}
          </div>
        ) : stock.isLowStock && stock.packsAvailable !== null ? (
          <p className="text-amber-700">
            {isEn
              ? `Only ${stock.packsAvailable} ${packUnitWord} left`
              : `Chỉ còn ${stock.packsAvailable} ${packUnitWord} tại chi nhánh`}
          </p>
        ) : (
          <p className="text-green-primary">{isEn ? 'In stock' : 'Còn hàng'}</p>
        )}
      </div>

      {/* Số lượng + hành động */}
      {stock.isOutOfStock ? (
        <button
          type="button"
          onClick={onChangeBranch}
          className="w-full h-11 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-ink-950 inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <Store className="w-4 h-4" aria-hidden />
          {isEn ? 'Choose another branch' : 'Chọn chi nhánh khác'}
        </button>
      ) : (
        <div ref={actionsRef} className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-gray-700">
              {isEn ? 'Quantity' : 'Số lượng'}
            </span>
            <QuantitySelector
              size="sm"
              quantity={canAdd ? quantity : 0}
              min={1}
              max={Math.max(1, stock.remainingCanAdd)}
              onIncrease={() => onQuantityStep(1)}
              onDecrease={() => onQuantityStep(-1)}
              onChange={onQuantityChange}
            />
          </div>

          {stock.existingCartQty > 0 && (
            <p className="text-xs text-gray-600">
              {isEn
                ? `${stock.existingCartQty} already in your cart.`
                : `Đã có ${stock.existingCartQty} ${packUnitWord} trong giỏ.`}
              {!canAdd && (isEn ? ' Maximum reached.' : ' Đã đạt số lượng tối đa có thể mua.')}
            </p>
          )}

          <button
            type="button"
            onClick={onAddToCart}
            disabled={!canAdd}
            className={cn(
              'w-full h-11 rounded-full text-base inline-flex items-center justify-center gap-2 transition-all duration-200 motion-reduce:transition-none',
              'bg-corn hover:bg-corn-dark text-ink-950 border border-corn-dark/60 cursor-pointer',
              'enabled:active:scale-[0.98]',
              'disabled:bg-gray-200 disabled:border-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed'
            )}
          >
            <ShoppingCart className="w-4 h-4" aria-hidden />
            {isEn ? 'Add to cart' : 'Thêm vào giỏ hàng'}
          </button>
          <button
            type="button"
            onClick={onBuyNow}
            disabled={!canAdd && stock.existingCartQty === 0}
            className={cn(
              'w-full h-11 rounded-full text-base inline-flex items-center justify-center gap-2 transition-all duration-200 motion-reduce:transition-none',
              'bg-leaf-900 hover:bg-forest-800 text-white cursor-pointer',
              'enabled:active:scale-[0.98]',
              'disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed'
            )}
          >
            {isEn ? 'Buy now' : 'Mua ngay'}
          </button>

          {addedMessage && (
            <div
              role="status"
              className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-lg flex items-start gap-2"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-px" aria-hidden />
              <span>{addedMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Giao từ / Bán bởi / Thanh toán */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs border-t border-gray-100 pt-3">
        <dt className="text-gray-500">{isEn ? 'Ships from' : 'Giao từ'}</dt>
        <dd className="min-w-0 text-ink-950">
          <span className="font-medium">{branchName || (isEn ? 'No branch selected' : 'Chưa chọn chi nhánh')}</span>{' '}
          <button
            type="button"
            onClick={onChangeBranch}
            className="text-copper-600 hover:text-copper-800 underline underline-offset-2 font-medium cursor-pointer inline-flex items-center gap-0.5"
          >
            <MapPin className="w-3 h-3" aria-hidden />
            {isEn ? 'Change' : 'Đổi'}
          </button>
        </dd>
        <dt className="text-gray-500">{isEn ? 'Sold by' : 'Bán bởi'}</dt>
        <dd className="text-ink-950 font-medium">{STORE_SALES_INFO.seller}</dd>
        <dt className="text-gray-500">{isEn ? 'Payment' : 'Thanh toán'}</dt>
        <dd className="text-ink-950">{isEn ? STORE_SALES_INFO.paymentEn : STORE_SALES_INFO.paymentVi}</dd>
      </dl>

      {/* Cam kết / bảo quản — chỉ thông tin đã có trong dữ liệu sản phẩm */}
      <ul className="border-t border-gray-100 pt-3 space-y-2 text-xs text-gray-700">
        {certification && (
          <li className="flex items-start gap-2">
            <span>{isEn ? `Produced under ${certification} process` : `Sản xuất theo quy trình ${certification}`}</span>
          </li>
        )}
        {storageText && (
          <li className="flex items-start gap-2">
            <span>{storageText}</span>
          </li>
        )}
        {expiryText && (
          <li className="flex items-start gap-2">
            <CalendarClock className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-px" aria-hidden />
            <span>{expiryText}</span>
          </li>
        )}
      </ul>

      {itemId && (
        <div className="border-t border-gray-100 pt-3">
          <WishlistButton itemId={itemId} itemType={itemType} />
        </div>
      )}
    </div>
  );
});

export default ProductBuyBox;
