'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Star,
  CheckCircle2,
  ThumbsUp,
  Edit3,
  X,
  Send,
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ReviewItem, ProductReviewSummary } from '@/types/reviews';
import { useUserAuth } from '@/context/UserAuthContext';

interface ProductReviewsSectionProps {
  productId: string;
  productName?: string;
  className?: string;
}

// Bảng màu avatar ngẫu nhiên theo tên
const AVATAR_COLORS = [
  'bg-emerald-600 text-white',
  'bg-blue-600 text-white',
  'bg-amber-600 text-white',
  'bg-leaf-600 text-white',
  'bg-teal-600 text-white',
  'bg-rose-600 text-white',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Vừa xong';
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} tháng trước`;
    return `${Math.floor(diffDays / 365)} năm trước`;
  } catch {
    return 'Gần đây';
  }
}

export default function ProductReviewsSection({
  productId,
  productName = 'Sản phẩm',
  className = '',
}: ProductReviewsSectionProps) {
  const { user } = useUserAuth();

  // State dữ liệu
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ProductReviewSummary>({
    averageRating: 0,
    totalReviews: 0,
    verifiedReviewsCount: 0,
    breakdown: [
      { stars: 5, count: 0, percentage: 0 },
      { stars: 4, count: 0, percentage: 0 },
      { stars: 3, count: 0, percentage: 0 },
      { stars: 2, count: 0, percentage: 0 },
      { stars: 1, count: 0, percentage: 0 },
    ],
  });

  const [loading, setLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [votedMap, setVotedMap] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);

  // Modal viết đánh giá
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [formHoverRating, setFormHoverRating] = useState(0);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formVariant, setFormVariant] = useState('Lốc 7 chai (330ml)');
  const [formTitle, setFormTitle] = useState('');
  const [formComment, setFormComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Tải tóm tắt đánh giá
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/reviews/summary?productId=${encodeURIComponent(productId)}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (data.success && data.data) {
        setSummary(data.data);
      }
    } catch (err) {
      console.warn('Error fetching review summary:', err);
    }
  }, [productId]);

  // Tải danh sách đánh giá
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        productId,
        sort: 'helpful',
        limit: '50',
        _t: Date.now().toString(),
      });
      if (selectedRating !== null) {
        params.set('rating', selectedRating.toString());
      }
      if (verifiedOnly) {
        params.set('verifiedOnly', 'true');
      }

      const res = await fetch(`/api/reviews?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setReviews(data.data);
      }
    } catch (err) {
      console.warn('Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  }, [productId, selectedRating, verifiedOnly]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Reset trạng thái xem thêm khi đổi bộ lọc sao hoặc đã mua hàng
  useEffect(() => {
    setShowAll(false);
  }, [selectedRating, verifiedOnly]);

  // Bấm hữu ích
  const handleVoteHelpful = async (reviewId: string) => {
    if (votedMap[reviewId]) return;

    // Optimistic update
    setVotedMap((prev) => ({ ...prev, [reviewId]: true }));
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, helpfulCount: r.helpfulCount + 1 } : r))
    );

    try {
      const res = await fetch(`/api/reviews/${reviewId}/helpful`, { method: 'POST' });
      const data = await res.json();
      if (data.success && typeof data.helpfulCount === 'number') {
        setReviews((prev) =>
          prev.map((r) => (r.id === reviewId ? { ...r, helpfulCount: data.helpfulCount } : r))
        );
      }
    } catch (err) {
      console.warn('Error voting helpful:', err);
    }
  };

  // Mở modal
  const handleOpenModal = () => {
    if (user) {
      setFormName(user.fullName || '');
      setFormPhone(user.phone || '');
    }
    setSubmitMessage(null);
    setIsModalOpen(true);
  };

  // Gửi đánh giá
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setSubmitMessage({ text: 'Vui lòng nhập tiêu đề tóm tắt đánh giá.', isError: true });
      return;
    }
    if (!formComment.trim()) {
      setSubmitMessage({ text: 'Vui lòng nhập nội dung nhận xét chi tiết.', isError: true });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          customerName: formName.trim() || 'Khách hàng Thái Sơn',
          customerPhone: formPhone.trim() || undefined,
          variantInfo: formVariant,
          rating: formRating,
          title: formTitle.trim(),
          comment: formComment.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        const isPending = data.data?.status === 'PENDING';
        const successMsg = data.message || (isPending
          ? 'Cảm ơn bạn, đánh giá sẽ hiển thị sau khi được duyệt.'
          : 'Gửi đánh giá thành công! Cảm ơn bạn.');
        setSubmitMessage({ text: successMsg });
        // Tải lại danh sách
        fetchSummary();
        fetchReviews();
        // Reset form và tự đóng
        setTimeout(() => {
          setIsModalOpen(false);
          setFormTitle('');
          setFormComment('');
          setSubmitMessage(null);
        }, isPending ? 2500 : 1500);
      } else {
        setSubmitMessage({ text: data.error || 'Có lỗi xảy ra, vui lòng thử lại.', isError: true });
      }
    } catch {
      setSubmitMessage({ text: 'Không thể kết nối đến máy chủ. Vui lòng thử lại.', isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tính số lượng cho filter pill
  const count5 = useMemo(() => summary.breakdown.find((b) => b.stars === 5)?.count || 0, [summary]);
  const count4 = useMemo(() => summary.breakdown.find((b) => b.stars === 4)?.count || 0, [summary]);

  return (
    <section className={`w-full bg-white py-12 md:py-16 border-t border-gray-200 scroll-mt-[168px] ${className}`} id="danh-gia">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* 1. SECTION HEADER */}
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm uppercase tracking-wider mb-2">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>ĐÁNH GIÁ TỪ KHÁCH HÀNG</span>
          </div>
          <h2 className="text-2xl sm:text-3xl text-gray-900 mt-2">
            Khách Hàng Nói Gì Về Sản Phẩm?
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-500 max-w-2xl mx-auto">
            100% đánh giá thực tế từ khách hàng đã mua và trải nghiệm tại Thái Sơn Foods.
          </p>
        </div>

        {/* 2. BỐ CỤC 2 CỘT CHÍNH (GRID 12 CỘT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── CỘT TRÁI (TỔNG QUAN ĐÁNH GIÁ - 4 CỘT) ── */}
          <div className="lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5 lg:sticky lg:top-[168px] z-10">
            <h3 className="text-gray-900 text-lg">
              Đánh giá chung
            </h3>

            {/* Điểm số trung bình hoặc trạng thái chưa có đánh giá */}
            {summary.totalReviews === 0 ? (
              <div className="py-2">
                <p className="text-2xl text-gray-800">Chưa có đánh giá</p>
                <p className="text-xs text-gray-500 mt-1">
                  Hãy là người đầu tiên chia sẻ cảm nhận về {productName}!
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-4xl text-gray-900 font-heading">
                    {summary.averageRating.toFixed(1)}
                  </span>
                  <span className="text-base text-gray-400 font-normal">/ 5.0</span>
                  <div className="flex items-center gap-1 ml-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4.5 h-4.5 ${
                          s <= Math.round(summary.averageRating)
                            ? 'fill-amber-500 text-amber-500'
                            : 'fill-gray-200 text-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Dựa trên {summary.totalReviews} lượt đánh giá từ khách hàng
                </p>
              </div>
            )}

            {/* 5 Thanh tỉ lệ sao */}
            <div className="space-y-2.5">
              {summary.breakdown.map((item) => (
                <div key={item.stars} className="flex items-center gap-3 text-xs">
                  <span className="w-10 text-gray-600 font-medium shrink-0">
                    {item.stars} sao
                  </span>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex-1">
                    <div
                      className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-gray-500 font-medium shrink-0">
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>

            {/* Nút CTA Viết đánh giá của bạn */}
            <button
              type="button"
              onClick={handleOpenModal}
              className="w-full py-3 px-4 rounded-xl bg-forest-700 hover:bg-forest-800 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Viết đánh giá của bạn</span>
            </button>
          </div>

          {/* ── CỘT PHẢI (BỘ LỌC & DANH SÁCH REVIEW - 8 CỘT) ── */}
          <div className="lg:col-span-8">
            {/* Thanh lọc Pill Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedRating(null);
                  setVerifiedOnly(false);
                }}
                className={`px-4 py-2 text-xs transition-all cursor-pointer rounded-lg ${
                  selectedRating === null && !verifiedOnly
                    ? 'bg-ink-950 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                Tất cả ({summary.totalReviews})
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedRating(5);
                  setVerifiedOnly(false);
                }}
                className={`px-4 py-2 text-xs transition-all cursor-pointer rounded-lg ${
                  selectedRating === 5 && !verifiedOnly
                    ? 'bg-ink-950 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                5 sao ({count5})
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedRating(4);
                  setVerifiedOnly(false);
                }}
                className={`px-4 py-2 text-xs transition-all cursor-pointer rounded-lg ${
                  selectedRating === 4 && !verifiedOnly
                    ? 'bg-ink-950 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                4 sao ({count4})
              </button>

              <button
                type="button"
                onClick={() => {
                  setVerifiedOnly((prev) => !prev);
                  setSelectedRating(null);
                }}
                className={`px-4 py-2 text-xs transition-all cursor-pointer rounded-lg flex items-center gap-1.5 ${
                  verifiedOnly
                    ? 'bg-ink-950 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>✓ Đã mua hàng ({summary.verifiedReviewsCount})</span>
              </button>
            </div>

            {/* Danh sách Review Cards (Hiển thị tĩnh 5 đánh giá, bấm Xem thêm để mở rộng) */}
            {(() => {
              const INITIAL_COUNT = 5;
              const displayedReviews = showAll ? reviews : reviews.slice(0, INITIAL_COUNT);
              const hasMore = reviews.length > INITIAL_COUNT;

              return loading ? (
                <div className="space-y-4 mt-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border border-gray-200 rounded-2xl p-5 bg-white space-y-3 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-200" />
                        <div className="space-y-1.5 flex-1">
                          <div className="w-32 h-4 bg-gray-200 rounded" />
                          <div className="w-24 h-3 bg-gray-100 rounded" />
                        </div>
                      </div>
                      <div className="w-3/4 h-4 bg-gray-200 rounded" />
                      <div className="w-full h-12 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <div className="border border-gray-200 rounded-2xl p-10 bg-white text-center text-gray-500 mt-6">
                  <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-700 text-[1.125em]">
                    {summary.totalReviews === 0
                      ? 'Chưa có đánh giá nào cho sản phẩm này'
                      : 'Chưa có đánh giá nào phù hợp với bộ lọc'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {summary.totalReviews === 0
                      ? 'Hãy là người đầu tiên để lại đánh giá cho sản phẩm này!'
                      : 'Thử chọn mức sao hoặc bộ lọc khác để xem thêm đánh giá.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 mt-6">
                  {displayedReviews.map((rev) => (
                  <article
                    key={rev.id}
                    className="border border-gray-200 rounded-2xl p-5 bg-white space-y-3 shadow-xs hover:shadow-sm transition-all"
                  >
                    {/* Hàng tác giả: Avatar chữ cái đầu bo tròn 36px + Tên khách hàng + Badge Đã mua hàng + 5 sao vàng bên phải */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar chữ cái đầu bo tròn 36px */}
                        <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-base shrink-0 shadow-xs">
                          {rev.customerName.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-gray-900 text-base">
                              {rev.customerName}
                            </span>

                            {rev.isVerifiedBuyer && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[12px] border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Đã mua hàng
                              </span>
                            )}
                          </div>

                          {/* Hàng thông tin phụ: Phân loại mua + Chấm tròn phân cách + Thời gian */}
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                            <span>{rev.variantInfo || 'Lốc 7 chai (330ml)'}</span>
                            <span className="text-gray-300">•</span>
                            <span>{formatRelativeTime(rev.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 5 ngôi sao vàng var(--color-amber-500) bên phải */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${
                              s <= rev.rating
                                ? 'fill-amber-500 text-amber-500'
                                : 'fill-gray-200 text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Tiêu đề nhận xét in đậm */}
                    {rev.title && (
                      <h4 className="text-gray-900 text-base leading-snug">
                        {rev.title}
                      </h4>
                    )}

                    {/* Nội dung nhận xét */}
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      {rev.comment}
                    </p>

                    {/* Phản hồi từ CSKH Thái Sơn Foods (nếu có) */}
                    {rev.adminReply && (
                      <div className="bg-gray-50 border-l-4 border-emerald-600 p-3 rounded-r-xl text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-800 mb-1 text-[1.125em]">
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Phản hồi từ Thái Sơn Foods
                        </div>
                        <p className="text-gray-600 leading-relaxed">{rev.adminReply}</p>
                      </div>
                    )}

                    {/* Footer card: Bên trái là nút like ThumbsUp "Hữu ích (24)" viền xám nhạt bo tròn; Bên phải là chữ xám nhạt "Thái Sơn Foods bảo chứng" */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                      <button
                        type="button"
                        onClick={() => handleVoteHelpful(rev.id)}
                        disabled={votedMap[rev.id]}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all cursor-pointer ${
                          votedMap[rev.id]
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-medium'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${votedMap[rev.id] ? 'text-emerald-600' : 'text-gray-400'}`} />
                        <span>Hữu ích ({rev.helpfulCount})</span>
                      </button>

                      <div className="inline-flex items-center gap-1 text-xs text-gray-400 font-normal">
                        <span>Thái Sơn Foods bảo chứng</span>
                      </div>
                    </div>
                  </article>
                ))}

                {/* Nút Xem thêm / Thu gọn khi có nhiều hơn 5 đánh giá */}
                {hasMore && (
                  <div className="pt-2 text-center">
                    {!showAll ? (
                      <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-medium text-sm shadow-xs hover:border-gray-400 transition-all cursor-pointer"
                      >
                        <span>Xem thêm ({reviews.length - INITIAL_COUNT}) đánh giá khác</span>
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowAll(false)}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 font-medium text-sm transition-all cursor-pointer"
                      >
                        <span>Thu gọn đánh giá</span>
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          </div>
        </div>
      </div>

      {/* ── MODAL VIẾT ĐÁNH GIÁ CỦA BẠN ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Nút đóng */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center mb-2">
                <Edit3 className="w-6 h-6" />
              </div>
              <h3 className="text-2xl text-gray-900 font-heading">
                Viết Đánh Giá Của Bạn
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Chia sẻ trải nghiệm thưởng thức {productName} cùng Thái Sơn Foods
              </p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              {/* Chọn số sao */}
              <div className="text-center pb-2">
                <label className="block text-sm text-gray-700 mb-2">
                  Chất lượng sản phẩm
                </label>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseEnter={() => setFormHoverRating(s)}
                      onMouseLeave={() => setFormHoverRating(0)}
                      onClick={() => setFormRating(s)}
                      className="p-1 text-2xl transition-transform hover:scale-125 focus:outline-hidden cursor-pointer"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          s <= (formHoverRating || formRating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-gray-200 text-gray-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-sm text-amber-600 mt-1">
                  {formRating === 5 && 'Tuyệt vời — Rất hài lòng!'}
                  {formRating === 4 && 'Hài lòng — Vị ngon vừa vặn'}
                  {formRating === 3 && 'Bình thường — Cần cải thiện'}
                  {formRating === 2 && 'Chưa hài lòng'}
                  {formRating === 1 && 'Rất tệ'}
                </p>
              </div>

              {/* Họ tên & Số điện thoại */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Họ và tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Số điện thoại (Nhận huy hiệu Đã mua)
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Phân loại quy cách */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Quy cách đã trải nghiệm
                </label>
                <select
                  value={formVariant}
                  onChange={(e) => setFormVariant(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="Lốc 7 chai (330ml)">Lốc 7 chai (330ml)</option>
                  <option value="Lốc 10 chai (330ml)">Lốc 10 chai (330ml)</option>
                  <option value="Thùng 24 chai (330ml)">Thùng 24 chai (330ml)</option>
                  <option value="Chai lẻ uống thử">Chai lẻ uống thử (330ml)</option>
                </select>
              </div>

              {/* Tiêu đề đánh giá */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Tiêu đề đánh giá <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ví dụ: Vị bắp nếp béo thơm tự nhiên, cả nhà ai cũng mê"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Nội dung nhận xét */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Nội dung nhận xét chi tiết <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  placeholder="Chia sẻ cảm nhận chân thực về độ ngọt, mùi thơm, nhiệt độ giao lạnh và sự tiện lợi..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* Thông báo kết quả */}
              {submitMessage && (
                <div
                  className={`p-3 rounded-xl text-sm ${
                    submitMessage.isError
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {submitMessage.text}
                </div>
              )}

              {/* Nút gửi */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm uppercase tracking-wider transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Đang gửi đánh giá...' : 'Gửi Đánh Giá Của Bạn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
