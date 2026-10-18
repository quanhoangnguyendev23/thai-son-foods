'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Truck,
  RefreshCw,
  Clock,
  Calendar,
  AlertCircle,
  PauseCircle,
  XCircle,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { useUserAuth } from '@/context/UserAuthContext';
import { formatPrice, safeFetchJson, safeParseJson } from '@/lib/utils';
import { MEMBERSHIP_CONFIG } from '@/config/membership';

export default function MemberPage() {
  const router = useRouter();

  useEffect(() => {
    if (!MEMBERSHIP_CONFIG.ENABLE_MEMBERSHIP) {
      router.replace('/');
    }
  }, [router]);

  const { user, openAuthModal } = useUserAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [membershipData, setMembershipData] = useState<any>(null);
  const [selectedCycle, setSelectedCycle] = useState<'month' | 'year'>('month');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Hủy 2 bước (Anti-Dark Pattern)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelStep, setCancelStep] = useState<1 | 2>(1);
  const [cancelReason, setCancelReason] = useState('Giá chưa phù hợp nhu cầu');

  // Modal Tạm dừng
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [pauseMonths, setPauseMonths] = useState(1);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const json = await safeFetchJson<any>('/api/membership/my-status');
      if (json?.success) {
        setMembershipData(json.data);
      }
    } catch (err) {
      console.error('Error fetching member status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!MEMBERSHIP_CONFIG.ENABLE_MEMBERSHIP) return;
    fetchStatus();
  }, [user]);

  const handleSubscribe = async (tierCode: 'PRIME_MONTHLY' | 'PRIME_YEARLY', isTrial = false) => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    try {
      setIsSubmitting(true);
      setActionMessage(null);
      const res = await fetch('/api/membership/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierCode, isTrial }),
      });
      const json = await safeParseJson<any>(res);
      if (res.ok && json?.success) {
        setActionMessage({ type: 'success', text: json.message });
        await fetchStatus();
      } else {
        setActionMessage({ type: 'error', text: json?.error || 'Đăng ký thất bại' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Lỗi kết nối máy chủ.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePause = async () => {
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/membership/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: pauseMonths }),
      });
      const json = await safeParseJson<any>(res);
      if (res.ok && json?.success) {
        setIsPauseModalOpen(false);
        setActionMessage({ type: 'success', text: json.message });
        await fetchStatus();
      } else {
        setActionMessage({ type: 'error', text: json?.error || 'Lỗi tạm dừng gói' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Lỗi kết nối.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/membership/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const json = await safeParseJson<any>(res);
      if (res.ok && json?.success) {
        setIsCancelModalOpen(false);
        setCancelStep(1);
        setActionMessage({ type: 'success', text: json.message });
        await fetchStatus();
      } else {
        setActionMessage({ type: 'error', text: json?.error || 'Lỗi hủy gói' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Lỗi kết nối.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPrime = membershipData?.membership?.status === 'PAID_ACTIVE' || membershipData?.membership?.status === 'TRIAL_ACTIVE';
  const isGrace = membershipData?.membership?.status === 'CANCELLED_GRACE';
  if (!MEMBERSHIP_CONFIG.ENABLE_MEMBERSHIP) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Banner thông báo */}
        {actionMessage && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-center justify-between text-sm ${
              actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <span>{actionMessage.text}</span>
            <button onClick={() => setActionMessage(null)} className="text-gray-400 hover:text-gray-700">✕</button>
          </div>
        )}

        {/* ── THẺ HỘI VIÊN HIỆN TẠI (NẾU ĐÃ CÓ GÓI) ── */}
        {user && isPrime && (
          <div className="mb-10 bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">

            <div className="relative z-10">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-700/60 pb-5">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-sm text-emerald-200 tracking-wider uppercase">Thành viên cao cấp</div>
                    <h2 className="text-2xl text-white">Thái Sơn Prime Pass</h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-sm bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {membershipData?.membership?.status === 'TRIAL_ACTIVE' ? 'Dùng thử 30 ngày' : 'Đang hoạt động'}
                  </span>
                </div>
              </div>

              {/* Thống kê quyền lợi */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                  <div className="text-xs text-emerald-200">Điểm thưởng hiện có</div>
                  <div className="text-2xl text-amber-300 mt-1">
                    {membershipData?.loyalty?.balance || 0} <span className="text-xs text-white/80 font-normal">điểm</span>
                  </div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                  <div className="text-xs text-emerald-200">Hợp đồng giao định kỳ</div>
                  <div className="text-2xl text-white mt-1">
                    {membershipData?.activeSubscriptionsCount || 0} <span className="text-xs text-white/80 font-normal">hợp đồng</span>
                  </div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                  <div className="text-xs text-emerald-200">Ngày gia hạn / Hết hạn</div>
                  <div className="text-lg text-white mt-1">
                    {membershipData?.membership?.expiresAt
                      ? new Date(membershipData.membership.expiresAt).toLocaleDateString('vi-VN')
                      : 'Không xác định'}
                  </div>
                </div>
              </div>

              {/* Nút thao tác */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/tai-khoan/dinh-ky"
                  className="px-4 py-2.5 rounded-xl bg-amber-400 text-emerald-950 text-base hover:bg-amber-300 transition-all flex items-center gap-1.5 shadow"
                >
                  <RefreshCw className="w-4 h-4" />
                  Quản lý Lịch giao Subscribe & Save
                </Link>

                <button
                  onClick={() => setIsPauseModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all flex items-center gap-1.5"
                >
                  <PauseCircle className="w-4 h-4" />
                  Tạm dừng gói (1-3 tháng)
                </button>

                <button
                  onClick={() => {
                    setCancelStep(1);
                    setIsCancelModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl hover:bg-red-500/20 text-red-200 hover:text-red-100 font-medium text-sm transition-all ml-auto"
                >
                  Hủy gói gia hạn
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trạng thái đã hủy nhưng còn hạn bảo lưu (Grace Period) */}
        {user && isGrace && (
          <div className="mb-8 p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-amber-900 text-[1.125em]">Gói hội viên đã hủy gia hạn</h4>
              <p className="text-sm text-amber-800 mt-1">
                Bạn không bị trừ tiền ở chu kỳ tới. Quyền lợi Freeship và giảm giá 15% của bạn vẫn được bảo lưu trọn vẹn đến hết ngày{' '}
                <span className="text-[1.125em]">
                  {new Date(membershipData?.membership?.expiresAt).toLocaleDateString('vi-VN')}
                </span>.
              </p>
              <button
                onClick={() => handleSubscribe('PRIME_MONTHLY')}
                className="mt-3 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700"
              >
                Đổi ý? Kích hoạt lại ngay
              </button>
            </div>
          </div>
        )}

        {/* ── HEADER GIỚI THIỆU CHƯƠNG TRÌNH ── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm tracking-wide uppercase mb-3">
            Đặc quyền thành viên Thái Sơn Foods
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl text-gray-900 tracking-tight font-heading">
            Gia Nhập <span className="text-emerald-700">Thái Sơn Prime</span>
          </h1>
          <p className="mt-3 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Giải pháp uống sữa hạt nấu tươi dinh dưỡng mỗi ngày cho gia đình. Miễn phí vận chuyển 100%, giảm 15% đơn định kỳ trọn đời và tích gấp đôi điểm thưởng.
          </p>
        </div>

        {/* ── BẢNG SO SÁNH QUYỀN LỢI ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-12">
          <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200 text-base text-gray-700 p-4 sm:p-5">
            <div className="text-left font-heading">Đặc quyền dịch vụ</div>
            <div className="text-center text-gray-500">Khách Thường</div>
            <div className="text-center text-emerald-700 flex items-center justify-center gap-1 text-[1.125em]">
              Thái Sơn Prime
            </div>
          </div>

          <div className="divide-y divide-gray-100 text-sm">
            <div className="grid grid-cols-3 p-4 sm:p-5 items-center">
              <div className="font-medium text-gray-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" /> Phí giao hàng xe lạnh
              </div>
              <div className="text-center text-gray-500">30.000 đ (Đơn &lt; 200k)</div>
              <div className="text-center text-emerald-700 bg-emerald-50/60 py-1 rounded text-[1.125em]">MIỄN PHÍ 100%</div>
            </div>

            <div className="grid grid-cols-3 p-4 sm:p-5 items-center">
              <div className="font-medium text-gray-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600" /> Giảm giá Subscribe & Save
              </div>
              <div className="text-center text-gray-500">Không áp dụng</div>
              <div className="text-center text-emerald-700 bg-emerald-50/60 py-1 rounded text-[1.125em]">GIẢM 15% TRỌN ĐỜI</div>
            </div>

            <div className="grid grid-cols-3 p-4 sm:p-5 items-center">
              <div className="font-medium text-gray-900 flex items-center gap-2">
                Tỷ lệ tích điểm thưởng
              </div>
              <div className="text-center text-gray-500">1% giá trị đơn hàng</div>
              <div className="text-center text-emerald-700 bg-emerald-50/60 py-1 rounded text-[1.125em]">2% (GẤP ĐÔI ĐIỂM)</div>
            </div>

            <div className="grid grid-cols-3 p-4 sm:p-5 items-center">
              <div className="font-medium text-gray-900 flex items-center gap-2">
                Quà sinh nhật hàng năm
              </div>
              <div className="text-center text-gray-500">Không có</div>
              <div className="text-center text-emerald-700 bg-emerald-50/60 py-1 rounded text-[1.125em]">Hộp quà dinh dưỡng</div>
            </div>

            <div className="grid grid-cols-3 p-4 sm:p-5 items-center">
              <div className="font-medium text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" /> Ưu tiên giao giờ cao điểm
              </div>
              <div className="text-center text-gray-500">Theo tuyến định kỳ</div>
              <div className="text-center text-emerald-700 bg-emerald-50/60 py-1 rounded text-[1.125em]">Khung giờ vàng ưu tiên</div>
            </div>
          </div>
        </div>

        {/* ── BẢNG CHỌN GÓI & ĐĂNG KÝ ── */}
        {!isPrime && (
          <div className="mb-14">
            <h3 className="text-center text-2xl text-gray-900 mb-6 font-heading">
              Chọn Gói Hội Viên Phù Hợp Cho Gia Đình Bạn
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Gói Tháng */}
              <div
                onClick={() => setSelectedCycle('month')}
                className={`cursor-pointer rounded-2xl p-6 sm:p-8 border-2 transition-all relative ${
                  selectedCycle === 'month' ? 'border-emerald-600 bg-emerald-50/30 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xl text-gray-900">Gói Tháng Linh Hoạt</h4>
                    <p className="text-xs text-gray-500 mt-1">Phù hợp trải nghiệm thử nghiệm 1 tháng</p>
                  </div>
                  <input
                    type="radio"
                    name="tier_cycle"
                    checked={selectedCycle === 'month'}
                    onChange={() => setSelectedCycle('month')}
                    className="w-5 h-5 text-emerald-600 focus:ring-emerald-500"
                  />
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl text-gray-900">49.000</span>
                  <span className="text-base text-gray-500">₫ / tháng</span>
                </div>

                <p className="text-xs text-gray-500 mt-2">Chỉ cần đặt 2 đơn/tháng là đã hòa vốn và có lãi!</p>

                <button
                  disabled={isSubmitting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubscribe('PRIME_MONTHLY', true); // Dùng thử 30 ngày
                  }}
                  className="mt-6 w-full py-3 rounded-xl bg-emerald-600 text-white text-base hover:bg-emerald-700 transition shadow"
                >
                  Dùng Thử 30 Ngày Hoàn Toàn Miễn Phí
                </button>
              </div>

              {/* Gói Năm */}
              <div
                onClick={() => setSelectedCycle('year')}
                className={`cursor-pointer rounded-2xl p-6 sm:p-8 border-2 transition-all relative ${
                  selectedCycle === 'year' ? 'border-amber-500 bg-amber-50/30 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-amber-500 text-ink-950 text-sm shadow">
                  TIẾT KIỆM 15%
                </div>

                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xl text-gray-900">Gói Năm Tiết Kiệm Nhất</h4>
                    <p className="text-xs text-gray-500 mt-1">Uống sữa hạt tươi ngon trọn năm không lo nghĩ</p>
                  </div>
                  <input
                    type="radio"
                    name="tier_cycle"
                    checked={selectedCycle === 'year'}
                    onChange={() => setSelectedCycle('year')}
                    className="w-5 h-5 text-amber-600 focus:ring-amber-500"
                  />
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl text-gray-900">499.000</span>
                  <span className="text-base text-gray-500">₫ / năm</span>
                </div>

                <p className="text-xs text-gray-500 mt-2">Tương đương chỉ ~41.000 đ/tháng. Tặng kèm Quà sinh nhật!</p>

                <button
                  disabled={isSubmitting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubscribe('PRIME_YEARLY', false);
                  }}
                  className="mt-6 w-full py-3 rounded-xl bg-amber-500 text-emerald-950 text-base hover:bg-amber-400 transition shadow"
                >
                  Đăng Ký Gói Năm (Tiết Kiệm Nhất)
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-gray-500 mt-4 flex items-center justify-center gap-1.5">
              Cam kết minh bạch: Hủy dễ dàng bất kỳ lúc nào chỉ với 2 click tại trang cá nhân.
            </p>
          </div>
        )}

        {/* ── LIÊN KẾT ĐẾN GIAO ĐỊNH KỲ ── */}
        <div className="rounded-2xl bg-white border border-gray-200 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div>
            <h4 className="text-xl text-gray-900">Bạn đã có hợp đồng giao định kỳ chưa?</h4>
            <p className="text-sm text-gray-600 mt-1">
              Đăng ký nhận sữa hạt nấu tươi mỗi tuần (Sáng T2 hoặc T5), tự động giảm 15% và freeship tận nhà.
            </p>
          </div>
          <Link
            href="/tai-khoan/dinh-ky"
            className="shrink-0 px-6 py-3 rounded-xl bg-gray-900 text-white text-base hover:bg-gray-800 transition flex items-center gap-2"
          >
            Quản lý Lịch Giao Hàng <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ── MODAL HỦY GÓI MINH BẠCH 2 BƯỚC (ANTI-DARK PATTERN) ── */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setIsCancelModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>

            {cancelStep === 1 ? (
              <div>
                <h3 className="text-2xl text-gray-900 font-heading">
                  Bạn đang yêu cầu hủy gói Thái Sơn Prime?
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                  Chúng tôi rất tiếc khi bạn có ý định dừng lại. Bạn có thể chọn giải pháp linh hoạt thay vì hủy:
                </p>

                <div className="mt-4 space-y-3">
                  <div
                    onClick={() => {
                      setIsCancelModalOpen(false);
                      setIsPauseModalOpen(true);
                    }}
                    className="cursor-pointer p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition"
                  >
                    <div className="text-base text-emerald-900 flex items-center gap-1.5">
                      <PauseCircle className="w-4 h-4 text-emerald-600" /> Tạm dừng nhận gói từ 1 đến 3 tháng
                    </div>
                    <div className="text-xs text-emerald-700 mt-1">
                      Giữ nguyên mức giảm 15% và điểm thưởng tích lũy, không phát sinh chi phí.
                    </div>
                  </div>

                  <Link
                    href="/tai-khoan/dinh-ky"
                    className="block p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="text-base text-gray-900 flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 text-gray-600" /> Đổi chu kỳ giao thưa hơn (2 tuần hoặc 4 tuần)
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Uống không kịp date sữa? Hãy chuyển sang 2 tuần hoặc 1 tháng giao 1 lần.
                    </div>
                  </Link>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setIsCancelModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-800 text-base hover:bg-gray-200 transition"
                  >
                    Giữ lại gói hội viên
                  </button>
                  <button
                    onClick={() => setCancelStep(2)}
                    className="px-4 py-2.5 rounded-xl text-red-600 hover:bg-red-50 text-base transition"
                  >
                    Tiếp tục đến bước hủy cuối &gt;
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-2xl text-gray-900 font-heading">
                  Xác nhận hủy gia hạn gói hội viên
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                  Cho chúng tôi biết lý do bạn muốn dừng (Tùy chọn, 1 click):
                </p>

                <div className="mt-4 space-y-2 text-sm text-gray-700">
                  {[
                    'Giá chưa phù hợp nhu cầu',
                    'Tần suất giao quá nhiều, uống không kịp date sữa',
                    'Muốn mua lẻ khi có nhu cầu phát sinh',
                    'Lý do cá nhân khác',
                  ].map((r) => (
                    <label key={r} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="cancel_reason"
                        checked={cancelReason === r}
                        onChange={() => setCancelReason(r)}
                        className="text-emerald-600"
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-gray-600 space-y-1">
                  <div>✓ Bạn <span className="text-gray-900 text-[1.125em]">KHÔNG</span> bị trừ tiền ở kỳ tiếp theo.</div>
                  <div>✓ Bạn vẫn được hưởng trọn vẹn đặc quyền Prime cho tới hết chu kỳ hiện tại.</div>
                  <div>✓ Sau đó tài khoản tự động chuyển về Khách Thường tích điểm 1%.</div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setCancelStep(1)}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-800 text-base hover:bg-gray-200 transition"
                  >
                    Quay lại
                  </button>
                  <button
                    disabled={isSubmitting}
                    onClick={handleCancel}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-base transition shadow"
                  >
                    {isSubmitting ? 'Đang xử lý...' : 'Xác nhận hủy gia hạn'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL TẠM DỪNG GÓI ── */}
      {isPauseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsPauseModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>

            <h3 className="text-2xl text-gray-900 font-heading">Tạm dừng gói Prime</h3>
            <p className="text-sm text-gray-600 mt-2">
              Bạn sắp đi công tác hoặc nghỉ lễ? Tạm dừng gói để không phát sinh chi phí và bảo lưu toàn bộ ưu đãi.
            </p>

            <div className="mt-5 space-y-2">
              {[1, 2, 3].map((m) => (
                <label
                  key={m}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    pauseMonths === m ? 'border-emerald-600 bg-emerald-50/50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base text-gray-800">Tạm dừng trong {m} tháng</span>
                  <input
                    type="radio"
                    name="pause_months"
                    checked={pauseMonths === m}
                    onChange={() => setPauseMonths(m)}
                    className="text-emerald-600"
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setIsPauseModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-base"
              >
                Hủy
              </button>
              <button
                disabled={isSubmitting}
                onClick={handlePause}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-base hover:bg-emerald-700 transition"
              >
                {isSubmitting ? 'Đang lưu...' : 'Xác nhận tạm dừng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
