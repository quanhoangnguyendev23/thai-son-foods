'use client';

import { useUserAuth } from '@/context/UserAuthContext';

/**
 * Hai khu cuối trang chi tiết (giống cuối trang Amazon):
 *  - PersonalizedSignInPrompt: mời khách chưa đăng nhập đăng nhập để xem gợi ý dành riêng; ẩn khi đã đăng nhập
 *  - BackToTopBar: thanh ngang "Lên đầu trang" ngay trên chân trang
 */

export function PersonalizedSignInPrompt() {
  const { user, isLoading, openAuthModal } = useUserAuth();
  if (isLoading || user) return null;

  return (
    <section className="border-t border-gray-200 bg-white">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-10 text-center">
        <h2 className="text-xl md:text-2xl text-ink-950">Xem gợi ý dành riêng cho bạn</h2>
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="mt-4 w-full max-w-xs rounded-full bg-brand-amber px-6 py-2.5 text-sm text-white hover:opacity-90 cursor-pointer"
        >
          Đăng nhập
        </button>
        <p className="mt-2 text-xs text-gray-600">
          Khách hàng mới?{' '}
          <button
            type="button"
            onClick={() => openAuthModal('register')}
            className="text-forest-700 underline hover:text-copper-600 cursor-pointer"
          >
            Đăng ký tại đây.
          </button>
        </p>
      </div>
    </section>
  );
}

export function BackToTopBar() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="block w-full bg-forest-600 py-4 text-center text-sm text-white hover:bg-forest-500 transition-colors cursor-pointer"
    >
      Lên đầu trang
    </button>
  );
}
