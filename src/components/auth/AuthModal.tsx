'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { useUserAuth } from '@/context/UserAuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import SocialAuthButtons from '@/components/auth/SocialAuthButtons';
import { FEATURES } from '@/config/features';

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, authModalTab, login, register } = useUserAuth();
  const { language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Lỗi đăng nhập mạng xã hội chờ hiển thị khi cửa sổ thực sự mở (tránh bị effect đặt lại xóa mất)
  const pendingOAuthErrorRef = useRef('');

  // Lỗi trả về từ luồng đăng nhập Google/Facebook (?error=...): hiện trong cửa sổ rồi xóa khỏi URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get('error');
    if (!code) return;
    const isEn = language === 'en';
    const messages: Record<string, [string, string]> = {
      oauth_not_configured: ['Social sign-in is not available yet.', 'Đăng nhập bằng mạng xã hội chưa khả dụng.'],
      oauth_cancelled: ['Sign-in was cancelled.', 'Bạn đã hủy đăng nhập.'],
      oauth_state_invalid: ['Sign-in session expired. Please try again.', 'Phiên đăng nhập đã hết hạn, vui lòng thử lại.'],
      google_email_unverified: ['Your Google email is not verified.', 'Email Google của bạn chưa được xác minh.'],
      google_no_email: ['Google did not share your email.', 'Google không cung cấp email của bạn.'],
      account_disabled: ['This account has been disabled.', 'Tài khoản này đã bị vô hiệu hóa.'],
    };
    const found = messages[code];
    pendingOAuthErrorRef.current =
      found
        ? (isEn ? found[0] : found[1])
        : isEn
          ? 'Social sign-in failed. Please try again or use email.'
          : 'Đăng nhập bằng mạng xã hội không thành công. Vui lòng thử lại hoặc dùng email.';
    url.searchParams.delete('error');
    window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    address: '',
  });

  useEffect(() => {
    setActiveTab(authModalTab);
    if (isAuthModalOpen && pendingOAuthErrorRef.current) {
      setErrorMsg(pendingOAuthErrorRef.current);
      pendingOAuthErrorRef.current = '';
    } else {
      setErrorMsg('');
    }
    setSuccessMsg('');
  }, [authModalTab, isAuthModalOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAuthModal();
      }
    };
    if (isAuthModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!loginForm.email.trim()) {
      setErrorMsg(language === 'en' ? 'Please enter your email' : 'Vui lòng nhập địa chỉ email');
      return;
    }
    if (!loginForm.password) {
      setErrorMsg(language === 'en' ? 'Please enter your password' : 'Vui lòng nhập mật khẩu');
      return;
    }

    setIsSubmitting(true);
    const res = await login(loginForm.email, loginForm.password);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || (language === 'en' ? 'Login failed' : 'Đăng nhập không thành công'));
    } else {
      setSuccessMsg(language === 'en' ? 'Logged in successfully!' : 'Đăng nhập thành công!');
      setTimeout(() => {
        closeAuthModal();
      }, 800);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!registerForm.fullName.trim()) {
      setErrorMsg(language === 'en' ? 'Please enter your full name' : 'Vui lòng nhập họ và tên');
      return;
    }
    if (!registerForm.email.trim() || !registerForm.email.includes('@')) {
      setErrorMsg(language === 'en' ? 'Please enter a valid email' : 'Vui lòng nhập email hợp lệ');
      return;
    }
    if (!registerForm.password || registerForm.password.length < 6) {
      setErrorMsg(
        language === 'en'
          ? 'Password must be at least 6 characters'
          : 'Mật khẩu phải có ít nhất 6 ký tự'
      );
      return;
    }

    setIsSubmitting(true);
    const res = await register({
      fullName: registerForm.fullName,
      email: registerForm.email,
      phone: registerForm.phone,
      password: registerForm.password,
      address: registerForm.address,
    });
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || (language === 'en' ? 'Registration failed' : 'Đăng ký không thành công'));
    } else {
      setSuccessMsg(
        language === 'en' ? 'Account created successfully!' : 'Tạo tài khoản thành công!'
      );
      setTimeout(() => {
        closeAuthModal();
      }, 800);
    }
  };

  return (
    <div
      onClick={closeAuthModal}
      className="fixed inset-0 z-[999999] bg-ink-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col relative max-h-[92vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="bg-gradient-to-b from-emerald-50/80 to-white px-6 pt-7 pb-4 text-center border-b border-gray-100">
          <div className="relative w-36 h-12 mx-auto mb-2">
            <Image
              src="/images/logo-vien-trang.png"
              alt="Thái Sơn Foods"
              fill
              sizes="144px"
              className="object-contain"
            />
          </div>
          <h2 className="text-2xl text-gray-900 font-heading">
            {activeTab === 'login'
              ? language === 'en'
                ? 'Welcome Back'
                : 'Đăng Nhập Tài Khoản'
              : language === 'en'
              ? 'Create New Account'
              : 'Đăng Ký Tài Khoản'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {language === 'en'
              ? 'Enjoy fast checkout, order tracking & member perks'
              : 'Theo dõi đơn hàng, lưu thông tin giao hàng & ưu đãi thành viên'}
          </p>

          {/* Tab Selector */}
          <div className="flex bg-gray-100/90 p-1 rounded-2xl mt-4 border border-gray-200/60">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMsg('');
              }}
              className={cn(
                'flex-1 py-2 text-sm rounded-xl transition-all cursor-pointer',
                activeTab === 'login'
                  ? 'bg-white text-forest-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              )}
            >
              {language === 'en' ? 'Sign In' : 'Đăng nhập'}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setErrorMsg('');
              }}
              className={cn(
                'flex-1 py-2 text-sm rounded-xl transition-all cursor-pointer',
                activeTab === 'register'
                  ? 'bg-white text-forest-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              )}
            >
              {language === 'en' ? 'Register' : 'Đăng ký mới'}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* Quick Social Logins */}
          {FEATURES.SOCIAL_LOGIN && (
            <SocialAuthButtons returnUrl={typeof window !== 'undefined' ? window.location.pathname : '/tai-khoan'} />
          )}

          {/* Notifications */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-base sm:text-sm focus:outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10 transition-colors"
                  />
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  {language === 'en' ? 'Password' : 'Mật khẩu'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-base sm:text-sm focus:outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10 transition-colors"
                  />
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-forest-700 hover:bg-forest-800 text-white rounded-xl shadow-sm text-base transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{language === 'en' ? 'Signing in...' : 'Đang đăng nhập...'}</span>
                  </>
                ) : (
                  <span>{language === 'en' ? 'Sign In' : 'Đăng nhập'}</span>
                )}
              </button>

              <div className="text-center text-xs text-gray-500 pt-2">
                {language === 'en' ? "Don't have an account yet?" : 'Chưa có tài khoản Thái Sơn Foods?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('register');
                    setErrorMsg('');
                  }}
                  className="text-forest-700 hover:underline cursor-pointer text-[1.125em]"
                >
                  {language === 'en' ? 'Register now' : 'Đăng ký ngay'}
                </button>
              </div>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  {language === 'en' ? 'Full Name' : 'Họ và tên'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={registerForm.fullName}
                    onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                    placeholder={language === 'en' ? 'Nguyen Van A' : 'Nguyễn Văn A'}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-base sm:text-sm focus:outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10 transition-colors"
                  />
                  <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-base sm:text-sm focus:outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10 transition-colors"
                  />
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  {language === 'en' ? 'Phone Number' : 'Số điện thoại'}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    placeholder="0123456789"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-base sm:text-sm focus:outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10 transition-colors"
                  />
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  {language === 'en' ? 'Password (min 6 characters)' : 'Mật khẩu (tối thiểu 6 ký tự)'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-base sm:text-sm focus:outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10 transition-colors"
                  />
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 bg-forest-700 hover:bg-forest-800 text-white rounded-xl shadow-sm text-base transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{language === 'en' ? 'Creating account...' : 'Đang tạo tài khoản...'}</span>
                  </>
                ) : (
                  <span>{language === 'en' ? 'Create Account' : 'Đăng ký tài khoản'}</span>
                )}
              </button>

              <div className="text-center text-xs text-gray-500 pt-1">
                {language === 'en' ? 'Already have an account?' : 'Đã có tài khoản?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setErrorMsg('');
                  }}
                  className="text-forest-700 hover:underline cursor-pointer text-[1.125em]"
                >
                  {language === 'en' ? 'Sign in' : 'Đăng nhập ngay'}
                </button>
              </div>
            </form>
          )}

          {/* Friendly Guest Checkout Assurance Note */}
          <div className="mt-5 pt-4 border-t border-gray-100 flex items-start gap-2.5 text-[11px] text-gray-500 bg-gray-50/80 p-3 rounded-xl">
            <ShoppingBag className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="text-gray-800 text-[1.125em]">
                {language === 'en' ? 'Guest Checkout Available' : 'Mua sắm không bắt buộc đăng nhập'}:
              </span>{' '}
              {language === 'en'
                ? 'You can always buy products and checkout directly without registering an account.'
                : 'Bạn luôn có thể đặt hàng nhanh chóng trực tiếp tại giỏ hàng mà không cần tài khoản.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
