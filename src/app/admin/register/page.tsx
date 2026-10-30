'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Lock,
  User,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Loader2,
  Database,
  Crown,
} from 'lucide-react';

export default function AdminRegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerKey, setRegisterKey] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingInit, setCheckingInit] = useState(true);
  const [hasAdmins, setHasAdmins] = useState<boolean | null>(null);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/admin/auth/me');
        const data = await res.json();
        if (data.authenticated) {
          router.replace('/admin');
          return;
        }
        setHasAdmins(data.hasAdmins);
      } catch (err) {
        console.error('Failed to check auth status:', err);
      } finally {
        setCheckingInit(false);
      }
    }
    checkStatus();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username.trim() || username.trim().length < 3) {
      setErrorMsg('Tên đăng nhập phải có ít nhất 3 ký tự');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Email không hợp lệ');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Mật khẩu phải có độ dài từ 6 ký tự trở lên');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp');
      return;
    }

    if (!registerKey.trim()) {
      setErrorMsg('Vui lòng nhập Mã bảo mật đăng ký (ADMIN_REGISTER_KEY của máy chủ)');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          username,
          email,
          password,
          registerKey,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Đăng ký tài khoản thất bại');
        setLoading(false);
        return;
      }

      setSuccessMsg(data.message || 'Đăng ký thành công! Đang chuyển đến trang đăng nhập...');
      setTimeout(() => {
        router.push('/admin/login');
      }, 1200);
    } catch (err: any) {
      setErrorMsg('Lỗi kết nối máy chủ: ' + err.message);
      setLoading(false);
    }
  };

  const isFirstAdmin = hasAdmins === false;

  return (
    <div
      style={{ '--color-slate-400': '#e0ebe5' } as React.CSSProperties}
      className="admin-theme min-h-screen bg-forest-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white"
    >
      <style>{`
        @layer utilities {
          :where(.admin-theme) .text-slate-400 {
            color: #e0ebe5;
          }
          :where(.admin-theme) .to-teal-400 {
            --tw-gradient-to: #DFE6E5;
          }
          :where(.admin-theme) .border-slate-800 {
            border-color: #7ca250;
          }
        }
      `}</style>
      {/* Ambient background glow effects */}
      <div className="absolute top-1/4 -right-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-40 w-96 h-96 bg-leaf-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(var(--color-ink-900)_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-lg relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-0.5 shadow-xl shadow-emerald-950/50 mb-3 ring-4 ring-emerald-500/20">
            <div className="w-full h-full bg-forest-950 rounded-[14px] flex items-center justify-center">
              <span className="text-2xl tracking-tighter bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                TSF
              </span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl tracking-tight text-white mb-1.5">
            {isFirstAdmin ? 'Khởi Tạo Super Admin' : 'Đăng Ký Tài Khoản Quản Trị'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {isFirstAdmin
              ? 'Thiết lập tài khoản Quản trị viên cấp cao đầu tiên cho hệ thống Thái Sơn Foods'
              : 'Đăng ký tài khoản Quản trị viên mới'}
          </p>
        </div>

        {/* First time setup banner */}
        {!checkingInit && isFirstAdmin && (
          <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-amber-500/15 to-emerald-500/15 border border-amber-500/30 text-amber-200 text-xs sm:text-sm flex items-start gap-3 shadow-lg">
            <Crown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-[1.125em]">Quyền Super Admin tự động kích hoạt</p>
              <p className="text-xs text-slate-300 mt-1">
                Tài khoản đầu tiên được đăng ký sẽ tự động sở hữu toàn quyền quản trị cao nhất và không yêu cầu mã bảo mật.
              </p>
            </div>
          </div>
        )}

        {/* Registration Card */}
        <div className="bg-slate-900/85 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-ink-950/80 relative">
          {/* Card Header Status */}
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800/80 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>{isFirstAdmin ? 'Thiết lập hệ thống' : 'Thêm Quản trị viên'}</span>
            </div>
            {/* Tên CSDL chỉ hiện trên máy phát triển */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                <Database className="w-3 h-3 text-emerald-400" />
                <span>PostgreSQL: WebTSF</span>
              </div>
            )}
          </div>

          {/* Error & Success Messages */}
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Khi đã có admin: Cổng đăng ký công khai đóng hoàn toàn */}
          {!checkingInit && hasAdmins ? (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-950/40">
                <Lock className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl text-white">Cổng Đăng Ký Tự Do Đã Đóng</h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Hệ thống quản trị Thái Sơn Foods đã được thiết lập. Nhằm đảm bảo an toàn và bảo mật thông tin, việc đăng ký tài khoản mới tự do đã bị vô hiệu hóa.
                </p>
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 max-w-sm mx-auto text-left space-y-1">
                  <p className="text-slate-300 text-[1.125em]">📋 Nguyên tắc cấp phát tài khoản:</p>
                  <p>• Mọi tài khoản <strong className="text-[1.125em]">Marketing</strong> hoặc <strong className="text-[1.125em]">Nhân viên cửa hàng</strong> đều phải do Quản trị viên cấp cao (Super Admin) tạo.</p>
                  <p>• Vui lòng liên hệ Super Admin của công ty để được cấp tài khoản và phân quyền cửa hàng tương ứng.</p>
                </div>
              </div>

              <Link
                href="/admin/login"
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-base bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
              >
                <span>Chuyển Đến Trang Đăng Nhập</span>
              </Link>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm uppercase tracking-wider text-slate-300 mb-1.5">
                Họ và Tên
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* Username & Email Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Username */}
              <div>
                <label className="block text-sm uppercase tracking-wider text-slate-300 mb-1.5">
                  Tên đăng nhập <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin_tsf"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm uppercase tracking-wider text-slate-300 mb-1.5">
                  Email <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@thaisonfoods.vn"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Password & Confirm Password Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Password */}
              <div>
                <label className="block text-sm uppercase tracking-wider text-slate-300 mb-1.5">
                  Mật khẩu <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm uppercase tracking-wider text-slate-300 mb-1.5">
                  Xác nhận mật khẩu <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Secret Register Key (Required if hasAdmins) */}
            {!checkingInit && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm uppercase tracking-wider text-slate-300">
                    Mã bảo mật đăng ký <span className="text-emerald-400">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Cấu hình trên máy chủ</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={registerKey}
                    onChange={(e) => setRegisterKey(e.target.value)}
                    placeholder="Nhập mã bảo mật (ADMIN_REGISTER_KEY)"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-amber-500/40 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors disabled:opacity-50"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Mã này ngăn chặn việc tự ý đăng ký tài khoản quản trị khi chưa được phép.
                </p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl text-base bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/60 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý đăng ký...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>{isFirstAdmin ? 'Khởi Tạo Super Admin' : 'Đăng Ký Tài Khoản'}</span>
                </>
              )}
            </button>
          </form>
          )}

          {/* Switch to Login link */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-400">
            <span>Đã có tài khoản quản trị? </span>
            <Link
              href="/admin/login"
              className="text-emerald-400 hover:text-emerald-300 hover:underline ml-1 text-[1.125em]"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </div>

        {/* Back to Website */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại trang chủ Website</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
