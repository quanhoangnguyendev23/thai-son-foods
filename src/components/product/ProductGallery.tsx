'use client';

import { useState, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { Product, ProductImage } from '@/types';
import { cn, formatPrice } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Share2, ZoomIn, X, Check, PlayCircle, Copy, QrCode, Smartphone } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
  imageFit?: 'cover' | 'contain';
  currentProductId?: string;
  categoryProducts?: Product[];
  /** Giao diện chi tiết mới: hiện đủ thumbnail (mặc định giữ hành vi cũ: tối đa 4) */
  showAllThumbnails?: boolean;
}

export default function ProductGallery({
  images,
  productName,
  imageFit,
  currentProductId,
  categoryProducts,
  showAllThumbnails = false,
}: ProductGalleryProps) {
  const { language } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  // Kính lúp: rê chuột lên ảnh chính (chỉ thiết bị có chuột) để phóng to vùng đang trỏ
  const [canHoverZoom, setCanHoverZoom] = useState(false);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && window.matchMedia) {
      setCanHoverZoom(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    }
    if (typeof window !== 'undefined') {
      setShareUrl(window.location.href);
    }
  }, []);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!isZoomOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZoomOpen(false);
      if (e.key === 'ArrowRight') setActiveIndex((prev) => (prev + 1) % displayImages.length);
      if (e.key === 'ArrowLeft') setActiveIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomOpen, images.length]);

  // Ràng buộc: tối đa 6 hình ảnh mô tả (Đảm bảo vị trí thumbnail thứ 3 luôn là Bảng Icon tiêu chuẩn chất lượng)
  const displayImages = (() => {
    const list: ProductImage[] = images.length > 0 ? [...images] : [
      { id: 'default', url: '/images/products/1200x900-sb1.jpg', alt: productName, sortOrder: 1 }
    ];

    // Bộ ảnh mới (public/images/products/gallery, 6 ảnh theo thứ tự 1→6) đã đủ nội dung: không chèn thêm Bảng Icon
    const hasCertIcon = list.some(
      (img) => img.url.includes('bang-icon') || img.url.includes('sua-bap-nep-3') || img.url.includes('/products/gallery/')
    );

    if (!hasCertIcon) {
      const certItem: ProductImage = {
        id: `${currentProductId || 'cert'}-icon-badge`,
        url: '/images/products/bang-icon.png',
        alt: language === 'en' ? 'Quality Standards & Certifications' : 'Tiêu chuẩn chất lượng & Chứng nhận',
        sortOrder: 3,
      };
      if (list.length >= 2) {
        list.splice(2, 0, certItem);
      } else {
        list.push(certItem);
      }
    }

    return list.slice(0, 6);
  })();

  const activeImage = displayImages[activeIndex] || displayImages[0];

  const LENS_ZOOM = 2.5;
  const handleLensMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    setLens({ x, y });
  };

  const copyToClipboard = async () => {
    const url = shareUrl || (typeof window !== 'undefined' ? window.location.href : '');
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleShareFacebook = () => {
    const url = shareUrl || (typeof window !== 'undefined' ? window.location.href : '');
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer,width=620,height=580'
    );
  };

  const handleShareZalo = () => {
    const url = shareUrl || (typeof window !== 'undefined' ? window.location.href : '');
    window.open(
      `https://sp.zalo.me/plugins/share?url=${encodeURIComponent(url)}&title=${encodeURIComponent(productName)}`,
      '_blank',
      'noopener,noreferrer,width=620,height=580'
    );
  };

  const handleShareMessenger = () => {
    const url = shareUrl || (typeof window !== 'undefined' ? window.location.href : '');
    window.open(
      `https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=291494419107518&redirect_uri=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer,width=620,height=580'
    );
  };

  const handleNativeShare = async () => {
    const url = shareUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: productName,
          text: `Cùng xem sản phẩm ${productName} tại Thái Sơn Foods nhé:`,
          url: url,
        });
      } catch {
        // Người dùng huỷ bỏ chia sẻ
      }
    } else {
      setIsShareModalOpen(true);
    }
  };

  const currentProduct = categoryProducts?.find(
    (p) => p.id === currentProductId || p.slug === currentProductId || p.sku === currentProductId
  );
  const currentPrice = currentProduct?.price;

  const isLandscape =
    activeImage.url.includes('600X400') ||
    activeImage.url.includes('combo') ||
    activeImage.url.includes('lifestyle');
  const is2x3 =
    activeImage.url.includes('620x930') ||
    activeImage.url.includes('620X930') ||
    activeImage.url.includes('800x1200') ||
    activeImage.url.includes('800X1200');
  const is3x4 = activeImage.url.includes('dreamina');
  const aspectClass = isLandscape
    ? 'aspect-[3/2]'
    : is2x3
      ? 'aspect-[2/3]'
      : is3x4
        ? 'aspect-[3/4]'
        : 'aspect-[4/5]';

  const isChart = activeImage.url.includes('bang-icon') || activeImage.url.includes('bang-thong-tin');
  const isPoster =
    isChart ||
    (!activeImage.url.endsWith('.png') && (
      activeImage.url.includes('620x930') ||
      activeImage.url.includes('800x1200') ||
      activeImage.url.includes('banner') ||
      activeImage.url.includes('lifestyle') ||
      activeImage.url.includes('poster') ||
      activeImage.url.includes('canh-dong') ||
      activeImage.url.includes('1789') ||
      activeImage.url.endsWith('.jpg') ||
      activeImage.url.endsWith('.jpeg') ||
      activeImage.url.endsWith('.webp')
    )) || (imageFit === 'cover' && !activeImage.url.endsWith('.png'));
  const isBottle = !isChart && (!isPoster || activeImage.url.endsWith('.png'));
  const isVideo = activeImage.url.endsWith('.mp4');

  return (
    <div className="w-full flex flex-col items-start select-none">
      {/* Gallery Layout: Thumbnails Cột dọc bên trái 64x64 1:1 + Main Image 1:1 bên phải */}
      <div className="w-full flex flex-row items-start gap-3 sm:gap-4">
        {/* Thumbnails bên trái: Cột dọc 4 ảnh tỉ lệ 4:3 khớp chuẩn ảnh 1200x900, bo góc rounded-lg */}
        {displayImages.length > 1 && (
          <div className="hidden sm:flex flex-col gap-2 w-16 shrink-0 py-0.5">
            {(showAllThumbnails ? displayImages : displayImages.slice(0, 4)).map((image, index) => (
              <button
                key={image.id || index}
                onClick={() => setActiveIndex(index)}
                onMouseEnter={() => canHoverZoom && setActiveIndex(index)}
                className={cn(
                  'relative w-16 aspect-[4/3] rounded-lg overflow-hidden border transition-all duration-200 shrink-0 bg-white cursor-pointer motion-reduce:transition-none',
                  activeIndex === index
                    ? 'border-forest-700 ring-2 ring-forest-700/20 shadow-xs'
                    : 'border-gray-200 opacity-80 hover:border-forest-700/60 hover:opacity-100 '
                )}
                aria-label={`Xem ảnh ${index + 1}`}
              >
                <div className="relative w-full h-full rounded-md overflow-hidden bg-gray-50 flex items-center justify-center">
                  {image.url.endsWith('.mp4') ? (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
                      <video
                        src={image.url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <div className="absolute inset-0 bg-ink-950/30 flex items-center justify-center pointer-events-none">
                        <PlayCircle className="w-5 h-5 text-white drop-shadow-md" />
                      </div>
                    </div>
                  ) : (
                    <Image
                      src={image.url}
                      alt={image.alt || productName}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Khung ảnh chính (Main Image): Tỉ lệ 4:3 khớp hoàn hảo ảnh 1200x900, nền trắng, bo góc rounded-2xl, border mỏng border-gray-200/80 */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="relative w-full aspect-[4/3] bg-white rounded-2xl border border-gray-200/80 overflow-hidden group shadow-sm transition-all">
            {/* Nút chia sẻ tròn Share2 góc trên bên phải */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNativeShare();
              }}
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-700 shadow-sm border border-gray-200/80 flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
              title="Chia sẻ sản phẩm"
              aria-label="Chia sẻ sản phẩm"
            >
              <Share2 className="w-4 h-4 text-gray-700" />
            </button>

            {/* Floating Prev Button (<) Tròn mờ ở 2 bên */}
            {displayImages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/70 hover:bg-white text-gray-800 shadow-md border border-gray-100 flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 cursor-pointer backdrop-blur-xs"
                aria-label="Ảnh trước"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* Floating Next Button (>) Tròn mờ ở 2 bên */}
            {displayImages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((prev) => (prev + 1) % displayImages.length);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/70 hover:bg-white text-gray-800 shadow-md border border-gray-100 flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 cursor-pointer backdrop-blur-xs"
                aria-label="Ảnh tiếp theo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Huy hiệu số trang góc dưới 1/4 nền đen mờ bg-ink-950/60 text-white text-xs px-2 py-0.5 rounded-full */}
            <div className="absolute bottom-3 right-3 z-10 bg-ink-950/60 text-white text-xs px-2 py-0.5 rounded-full font-medium pointer-events-none">
              {activeIndex + 1}/{displayImages.length}
            </div>

            {/* Main Product Media with zoom on click */}
            <div
              data-product-main-image="true"
              onClick={() => !isVideo && setIsZoomOpen(true)}
              onMouseEnter={canHoverZoom && !isVideo ? handleLensMove : undefined}
              onMouseMove={canHoverZoom && !isVideo ? handleLensMove : undefined}
              onMouseLeave={() => setLens(null)}
              className={cn(
                "relative w-full h-full overflow-hidden",
                !isVideo && "cursor-zoom-in",
                !isVideo && !canHoverZoom && "transition-transform duration-300 group-hover:scale-[1.02]"
              )}
            >
              {isVideo ? (
                <video
                  key={activeImage.url}
                  src={activeImage.url}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-contain bg-ink-950/5"
                />
              ) : (
                <Image
                  src={activeImage.url}
                  alt={activeImage.alt || productName}
                  fill
                  className={cn(
                    "object-contain transition-transform duration-200 ease-out",
                    !canHoverZoom && "duration-300 group-hover:scale-[1.02]"
                  )}
                  style={
                    canHoverZoom && lens
                      ? { transform: `scale(${LENS_ZOOM})`, transformOrigin: `${lens.x}% ${lens.y}%` }
                      : undefined
                  }
                  sizes="(max-width: 768px) 100vw, 1200px"
                  priority
                />
              )}
            </div>
          </div>

          {/* Mobile Thumbnails Row — only visible on small screens */}
          {displayImages.length > 1 && (
            <div className="sm:hidden w-full flex items-center gap-2 overflow-x-auto py-2.5 px-0.5">
              {(showAllThumbnails ? displayImages : displayImages.slice(0, 4)).map((image, index) => (
                <button
                  key={image.id || index}
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    'relative w-14 sm:w-16 aspect-[4/3] rounded-lg overflow-hidden border transition-all shrink-0 bg-white cursor-pointer',
                    activeIndex === index
                      ? 'border-forest-700 ring-2 ring-forest-700/20 shadow-xs'
                      : 'border-gray-200 hover:border-gray-400 opacity-80 hover:opacity-100'
                  )}
                  aria-label={`Xem ảnh ${index + 1}`}
                >
                  <div className="relative w-full h-full rounded-md overflow-hidden bg-gray-50 flex items-center justify-center">
                    {image.url.endsWith('.mp4') ? (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
                        <video
                          src={image.url}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <div className="absolute inset-0 bg-ink-950/30 flex items-center justify-center pointer-events-none">
                          <PlayCircle className="w-4 h-4 text-white drop-shadow-md" />
                        </div>
                      </div>
                    ) : (
                      <Image
                        src={image.url}
                        alt={image.alt || productName}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── HÀNG TIỆN ÍCH DƯỚI ẢNH ── */}
      <div className="w-full mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 px-1">
        {/* Dòng trái: Nhấp vào ảnh để phóng to kèm icon kính lúp ZoomIn màu var(--color-ink-600) */}
        <button
          onClick={() => !isVideo && setIsZoomOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-ink-600 hover:text-forest-700 font-normal transition-colors cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5 text-ink-600" />
          <span>Nhấp vào ảnh để phóng to</span>
        </button>

        {/* Cụm phải: Chia sẻ đến bạn bè của bạn: + 2 nút badge MXH (Facebook xanh #1877F2, Zalo xanh #0068FF) + Nút Sao chép viền xám */}
        <div className="flex items-center gap-2 relative">
          <span className="text-xs text-ink-600 font-normal hidden sm:inline">
            Chia sẻ đến bạn bè của bạn:
          </span>

          {/* Facebook — cùng kiểu viền xám với nút Sao chép */}
          <button
            onClick={handleShareFacebook}
            className="h-6 px-2 rounded-full border bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 flex items-center gap-1 transition-all cursor-pointer text-[11px] font-medium"
            title="Chia sẻ lên Facebook"
            aria-label="Chia sẻ lên Facebook"
          >
            <Image src="/images/icons/facebook.png" alt="" width={14} height={14} className="w-3.5 h-3.5 object-contain" aria-hidden="true" />
            <span>Facebook</span>
          </button>

          {/* Zalo — cùng kiểu viền xám với nút Sao chép */}
          <button
            onClick={handleShareZalo}
            className="h-6 px-2 rounded-full border bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 flex items-center gap-1 transition-all cursor-pointer text-[11px] font-medium"
            title="Chia sẻ qua Zalo"
            aria-label="Chia sẻ qua Zalo"
          >
            <Image src="/images/icons/zalo.png" alt="" width={14} height={14} className="w-3.5 h-3.5 object-contain" aria-hidden="true" />
            <span>Zalo</span>
          </button>

          {/* Nút Sao chép viền xám (Copy link có toast thông báo "Đã sao chép") */}
          <button
            onClick={() => copyToClipboard()}
            className={cn(
              "h-6 px-2.5 rounded-full border text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer",
              copied
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
            )}
            title="Sao chép liên kết"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-white stroke-[2.5]" />
                <span>Đã sao chép</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-gray-500" />
                <span>Sao chép</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── KHỐI "SẢN PHẨM CÙNG DANH MỤC (CHỌN ĐỂ XEM VỊ KHÁC)" ── */}
      {categoryProducts && categoryProducts.length > 0 && (
        <div className="w-full mt-4 pt-3 border-t border-gray-100">
          {/* Tiêu đề: Chấm tròn xanh w-2 h-2 rounded-full bg-emerald-600 + "Sản phẩm cùng danh mục (5)", bên phải là chữ xám nhạt "Chọn để xem vị khác" */}
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
              <span className="text-sm text-gray-900">
                Sản phẩm cùng danh mục ({categoryProducts.length})
              </span>
            </div>
            <span className="text-[11px] text-gray-400">
              Chọn để xem vị khác
            </span>
          </div>

          {/* Dải card cuộn ngang: Mỗi card có ảnh thumbnail tròn w-14 h-14 trên nền bo viền rounded-xl, tên vị bên dưới */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
            {categoryProducts.map((prod) => {
              const isCurrent =
                prod.id === currentProductId ||
                prod.slug === currentProductId ||
                prod.sku === currentProductId;

              // Rút gọn tên vị (Bắp Nếp, Sen Kết, Gạo Lứt...)
              const shortFlavorName = prod.name
                .replace(/Sữa\s*/i, '')
                .replace(/Thái Sơn\s*/i, '')
                .replace(/Lotus Yoo\s*/i, '')
                .replace(/Mekong\s*/i, '')
                .replace(/Ohsawa\s*/i, '')
                .trim() || prod.name;

              return (
                <Link
                  key={prod.id}
                  href={`/san-pham/${prod.slug}`}
                  className={cn(
                    'group relative rounded-xl border p-2 flex flex-col items-center justify-between bg-white transition-all shrink-0 w-[84px] text-center',
                    isCurrent
                      ? 'border-2 border-emerald-600 bg-emerald-50/20 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-2xs'
                  )}
                  title={prod.name}
                >
                  {/* Card đang xem có icon dấu tick tròn xanh Check nổi ở góc trên bên phải */}
                  {isCurrent && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs text-[10px] z-10">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}

                  {/* Khung ảnh thumbnail 4:3 khớp chuẩn ảnh 1200x900 */}
                  <div className="relative w-full aspect-[4/3] rounded-lg bg-white border border-gray-100 overflow-hidden flex items-center justify-center mb-1.5 transition-transform duration-200">
                    <Image
                      src={prod.thumbnail}
                      alt={prod.name}
                      fill
                      className="object-contain p-0.5"
                      sizes="80px"
                    />
                  </div>

                  {/* Tên vị bên dưới */}
                  <span className="text-[12px] text-gray-800 leading-tight line-clamp-1 w-full">
                    {shortFlavorName}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium mt-0.5">
                    {formatPrice(prod.price)}đ
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}



      {/* Full View Lightbox Modal via Portal to document.body (avoids stacking context bugs) */}
      {isZoomOpen && mounted && createPortal(
        <div
          onClick={() => setIsZoomOpen(false)}
          className="fixed inset-0 z-[99999] bg-ink-950/92 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-fade-in-up select-none"
        >
          {/* Close Button */}
          <button
            onClick={() => setIsZoomOpen(false)}
            className="absolute top-5 right-5 z-50 text-white/80 hover:text-white p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer backdrop-blur-sm shadow-lg"
            aria-label="Đóng xem toàn màn hình"
            title="Đóng"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Previous Arrow */}
          {displayImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
              }}
              className="absolute left-4 z-50 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer hidden sm:flex items-center justify-center"
              aria-label="Ảnh trước"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next Arrow */}
          {displayImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev + 1) % displayImages.length);
              }}
              className="absolute right-4 z-50 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer hidden sm:flex items-center justify-center"
              aria-label="Ảnh tiếp theo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Media Container — Fits viewport cleanly without forcing aspect-square */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-5xl w-full h-[80vh] flex items-center justify-center"
          >
            {isVideo ? (
              <video
                key={activeImage.url}
                src={activeImage.url}
                controls
                autoPlay
                loop
                playsInline
                className="max-h-[75vh] max-w-lg object-contain rounded-xl shadow-2xl"
              />
            ) : (
              <Image
                src={activeImage.url}
                alt={activeImage.alt || productName}
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            )}
          </div>

          {/* Bottom Caption / Indicator */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/15 backdrop-blur-md px-5 py-2 rounded-full text-white text-sm font-medium border border-white/10 flex items-center gap-2"
          >
            <span className="text-orange-400 text-[1.125em]">{activeIndex + 1}</span>
            <span className="text-white/60">/</span>
            <span>{displayImages.length}</span>
            <span className="text-white/40">•</span>
            <span>{productName}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Share Modal Dialog via Portal to document.body */}
      {isShareModalOpen && mounted && createPortal(
        <div
          onClick={() => setIsShareModalOpen(false)}
          className="fixed inset-0 z-[99999] bg-ink-950/60 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in-up"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-forest-700 flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-gray-900 text-lg leading-tight">
                    {language === 'en' ? 'Share Product' : 'Chia sẻ sản phẩm'}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {language === 'en' ? 'Tip: Share with your friends' : 'Gợi ý: Chia sẽ đến bạn bè của bạn'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                aria-label={language === 'en' ? 'Close' : 'Đóng'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Card Preview */}
            <div className="p-4 bg-ivory border-b border-gray-100 flex items-center gap-3">
              <div className="relative w-16 h-16 rounded-xl bg-white border border-gray-200/80 p-1 shrink-0 overflow-hidden flex items-center justify-center">
                <Image
                  src={displayImages[0]?.url || activeImage.url}
                  alt={productName}
                  fill
                  className="object-contain p-0.5"
                  sizes="64px"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full inline-block mb-1">
                  Thái Sơn Foods
                </span>
                <h4 className="text-base text-gray-900 leading-snug">
                  {productName}
                </h4>
                {currentPrice && (
                  <p className="text-sm text-emerald-700 mt-0.5">
                    {formatPrice(currentPrice)} ₫
                  </p>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Social Channels Grid */}
              <div>
                <label className="text-sm text-gray-700 block mb-2.5">
                  {language === 'en' ? 'Quick share via social media:' : 'Chia sẻ nhanh qua mạng xã hội:'}
                </label>
                <div className="grid grid-cols-4 gap-2.5">
                  {/* Facebook */}
                  <button
                    onClick={handleShareFacebook}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-xs transition-transform">
                      <Image src="/images/icons/facebook.png" alt="" width={40} height={40} className="w-10 h-10 object-contain" aria-hidden="true" />
                    </div>
                    <span className="text-[12px] text-gray-700">Facebook</span>
                  </button>

                  {/* Zalo */}
                  <button
                    onClick={handleShareZalo}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-xs transition-transform">
                      <Image src="/images/icons/zalo.png" alt="" width={24} height={24} className="w-6 h-6 object-contain" aria-hidden="true" />
                    </div>
                    <span className="text-[12px] text-gray-700">Zalo</span>
                  </button>

                  {/* Messenger */}
                  <button
                    onClick={handleShareMessenger}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-gray-100 hover:border-leaf-200 hover:bg-leaf-50/50 transition-all group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-forest-400 via-emerald-400 to-leaf-500 text-white flex items-center justify-center shadow-xs transition-transform">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.518 3.735 7.208V22l3.39-1.86c.928.257 1.916.396 2.875.396 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.09 12.433l-2.766-2.95-5.398 2.95 5.938-6.302 2.836 2.95 5.328-2.95-5.938 6.302z" />
                      </svg>
                    </div>
                    <span className="text-[12px] text-gray-700">Messenger</span>
                  </button>

                  {/* Mã QR */}
                  <button
                    onClick={() => setShowQrCode(!showQrCode)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all group cursor-pointer",
                      showQrCode
                        ? "border-emerald-500 bg-emerald-50/70"
                        : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-xs transition-transform">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <span className="text-[12px] text-gray-700">Mã QR</span>
                  </button>
                </div>
              </div>

              {/* QR Code Box nếu mở */}
              {showQrCode && (
                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80 flex flex-col items-center text-center animate-fade-in-up">
                  <div className="bg-white p-2.5 rounded-xl shadow-xs border border-gray-200 mb-2">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl || (typeof window !== 'undefined' ? window.location.href : ''))}`}
                      alt="QR Code sản phẩm"
                      className="w-32 h-32 object-contain"
                    />
                  </div>
                  <p className="text-sm text-gray-800">
                    Quét mã để xem chi tiết sản phẩm trên điện thoại
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Mở camera trên điện thoại của bạn bè để quét nhanh
                  </p>
                </div>
              )}

              {/* Copy Link Input */}
              <div>
                <label className="text-sm text-gray-700 block mb-1.5">
                  Hoặc sao chép đường link liên kết:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl || (typeof window !== 'undefined' ? window.location.href : '')}
                    className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-base sm:text-xs text-gray-600 select-all focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono truncate"
                  />
                  <button
                    onClick={() => copyToClipboard()}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-xs",
                      copied
                        ? "bg-emerald-600 text-white"
                        : "bg-forest-700 hover:bg-forest-800 text-white"
                    )}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Đã chép!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Native share for devices */}
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                <button
                  onClick={handleNativeShare}
                  className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200/80 text-gray-800 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-gray-600" />
                  <span>Chia sẻ qua ứng dụng khác trên thiết bị (AirDrop, Tin nhắn...)</span>
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
