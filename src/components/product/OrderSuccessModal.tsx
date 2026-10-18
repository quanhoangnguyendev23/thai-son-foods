'use client';

import { CheckCircle2, Copy, Check, ArrowRight, ShoppingBag, Star } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';

interface OrderSuccessModalProps {
  orderId: string;
  customerName: string;
  total: number;
  onClose: () => void;
}

export default function OrderSuccessModal({
  orderId,
  customerName,
  total,
  onClose,
}: OrderSuccessModalProps) {
  const { language } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8 text-center border border-border-light"
      >
        <div className="w-16 h-16 bg-green-primary/10 text-green-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-primary" />
        </div>

        <h3 className="text-2xl text-text-dark font-heading mb-2">
          {language === 'en' ? 'Order Placed Successfully!' : 'Đặt hàng thành công!'}
        </h3>

        <p className="text-sm text-text-muted mb-6">
          {language === 'en' ? (
            <>
              Thank you <span className="text-text-dark text-[1.125em]">{customerName}</span> for choosing Thai Son Foods. We will contact you shortly to confirm your order.
            </>
          ) : (
            <>
              Cảm ơn <span className="text-text-dark text-[1.125em]">{customerName}</span> đã tin tưởng và sử dụng sản phẩm của Thái Sơn Foods. Mình sẽ liên hệ xác nhận đơn hàng cho bạn sớm nhất.
            </>
          )}
        </p>

        <div className="bg-ivory rounded-xl p-4 mb-6 text-left space-y-3 border border-border-light">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">
              {language === 'en' ? 'Order Code' : 'Mã đơn hàng'}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-base text-green-primary">{orderId}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-text-muted hover:text-text-dark transition-colors"
                title={language === 'en' ? 'Copy' : 'Sao chép'}
              >
                {copied ? <Check className="w-4 h-4 text-green-primary" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border-light pt-2">
            <span className="text-xs text-text-muted">
              {language === 'en' ? 'Payment Method' : 'Phương thức thanh toán'}
            </span>
            <span className="text-sm font-medium text-text-dark">
              {language === 'en' ? 'Cash on Delivery (COD)' : 'Thanh toán khi nhận hàng (COD)'}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-border-light pt-2">
            <span className="text-xs text-text-muted">
              {language === 'en' ? 'Total Payment' : 'Tổng thanh toán'}
            </span>
            <span className="text-lg text-green-primary">{formatPrice(total)}đ</span>
          </div>
        </div>

        {/* Lời nhắc đánh giá sản phẩm vừa mua */}
        <div className="mb-6 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-gray-900">
                {language === 'en' ? 'Review Your Purchase' : 'Đánh giá sản phẩm vừa mua'}
              </p>
              <p className="text-[11px] text-gray-500">
                {language === 'en' ? 'Share your experience with others' : 'Nhận huy hiệu Đã mua hàng từ thương hiệu'}
              </p>
            </div>
          </div>
          <Link
            href="/#danh-gia"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-ink-950 text-sm shrink-0 transition-colors shadow-xs"
          >
            {language === 'en' ? 'Review' : 'Đánh giá'}
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-border rounded-xl text-base text-text-dark hover:bg-ivory-dark transition-colors"
          >
            {language === 'en' ? 'Close' : 'Đóng'}
          </button>
          <Link
            href="/#san-pham"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-green-primary text-white rounded-xl text-base hover:bg-green-dark transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            {language === 'en' ? 'Continue Shopping' : 'Tiếp tục mua sắm'}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
