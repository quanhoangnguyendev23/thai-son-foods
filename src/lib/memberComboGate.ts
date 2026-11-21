'use client';

import { useCallback } from 'react';
import { useUserAuth } from '@/context/UserAuthContext';
import { isMemberCombo } from '@/lib/comboTypes';

/**
 * Khoá combo Member cho khách chưa đăng nhập (21/11/2026).
 * - locked(combo): true khi là combo MEMBER và chưa có tài khoản đăng nhập → thẻ hiện nhãn khoá.
 * - guard(combo): gọi trước khi thêm giỏ; nếu bị khoá thì mở hộp Đăng ký và trả về true (dừng thêm giỏ).
 * API /api/orders vẫn chặn lại ở server, đây chỉ là lớp giao diện.
 */
export function useMemberComboGate() {
  const { user, openAuthModal } = useUserAuth();
  const locked = useCallback(
    (combo: { comboType?: string | null } | null | undefined) => isMemberCombo(combo) && !user,
    [user]
  );
  const guard = useCallback(
    (combo: { comboType?: string | null } | null | undefined) => {
      if (!locked(combo)) return false;
      openAuthModal('register');
      return true;
    },
    [locked, openAuthModal]
  );
  return { locked, guard, isLoggedIn: Boolean(user) };
}
