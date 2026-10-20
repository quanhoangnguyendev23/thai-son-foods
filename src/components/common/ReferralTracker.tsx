'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { FEATURES } from '@/config/features';

export default function ReferralTracker() {
  const searchParams = useSearchParams();
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!FEATURES.PARTNER_PROGRAM) return;
    const refCode = searchParams.get('ref') || searchParams.get('code');
    if (!refCode || !refCode.trim()) return;

    const cleanCode = refCode.trim().toUpperCase();

    // Tránh gửi lặp lại trong cùng 1 lần duyệt trang
    if (trackedRef.current === cleanCode) return;
    trackedRef.current = cleanCode;

    // Lưu tạm vào sessionStorage để trang checkout có thể fallback đọc được
    try {
      sessionStorage.setItem('tsf_ref_code', cleanCode);
    } catch (_) {}

    // Gọi API ghi nhận click và set cookie 30 ngày từ server
    fetch(`/api/partner/click?ref=${encodeURIComponent(cleanCode)}`, {
      method: 'GET',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log(`[ReferralTracker] Đã ghi nhận mã giới thiệu: ${cleanCode}`);
        }
      })
      .catch((err) => {
        console.warn('[ReferralTracker] Không thể ghi nhận mã giới thiệu:', err);
      });
  }, [searchParams]);

  return null;
}
