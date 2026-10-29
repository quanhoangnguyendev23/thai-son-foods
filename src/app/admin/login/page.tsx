'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Loader2,
  Database,
} from 'lucide-react';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/admin';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [checkingInit, setCheckingInit] = useState(true);
  const [hasAdmins, setHasAdmins] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Check if system has any admins on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/admin/auth/me');
        const data = await res.json();
        if (data.authenticated) {
          router.replace('/admin');
          return;
        }
        if (!res.ok && data?.error) {
          const errStr = String(data.error);
          if (errStr.includes('ECONNREFUSED') || errStr.includes('connect') || errStr.includes('timeout') || errStr.includes('ENOTFOUND')) {
            setErrorMsg('Chưa kết nối được cơ sở dữ liệu PostgreSQL. Vui lòng cấu hình biến môi trường DATABASE_URL trên Vercel.');
          }
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

    if (!identifier.trim()) {
      setErrorMsg('Vui lòng nhập tên đăng nhập hoặc email');
      return;
    }
    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Tài khoản hoặc mật khẩu không chính xác');
        setLoading(false);
        return;
      }

      setSuccessMsg('Đăng nhập thành công! Đang chuyển hướng...');
      setTimeout(() => {
        router.push(from);
        router.refresh();
      }, 600);
    } catch (err: any) {
      setErrorMsg('Lỗi kết nối máy chủ: ' + err.message);
      setLoading(false);
    }
  };

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
      <div className="absolute top-1/4 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-40 w-96 h-96 bg-teal-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(var(--color-ink-900)_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-0.5 shadow-xl shadow-emerald-950/50 mb-4 ring-4 ring-emerald-500/20">
            <div className="w-full h-full bg-forest-950 rounded-[14px] flex items-center justify-center">
              <span className="text-2xl tracking-tighter bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                TSF
              </span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl tracking-tight text-white mb-2">
            Đăng Nhập Quản Trị
          </h1>
          <p className="text-sm text-slate-400">
            Hệ thống quản lý & cơ sở dữ liệu Thái Sơn Foods
          </p>
        </div>

        {/* First time setup banner if no admins exist */}
        {!checkingInit && hasAdmins === false && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-start gap-3 shadow-lg">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-[1.125em]">Khởi tạo hệ thống lần đầu!</p>
              <p className="text-xs text-amber-200/80 mt-1">
                Chưa có tài khoản quản trị nào trong cơ sở dữ liệu. Vui lòng bấm Đăng Ký để tạo tài khoản Super Admin đầu tiên.
              </p>
              <Link
                href="/admin/register"
                className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-lg text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
              >
                <span>Tạo Super Admin ngay</span>
              </Link>
            </div>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-slate-900/85 backdrop-blur-xl border border-slate-800 rounded-2xl p-7 sm:p-8 shadow-2xl shadow-ink-950/80 relative">
          {/* PostgreSQL Indicator Pill */}
          <div className="flex items-center justify-between pb-5 mb-5 border-b border-slate-800/80 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Xác thực Quản trị viên</span>
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
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Identifier input */}
            <div>
              <label className="block text-sm uppercase tracking-wider text-slate-300 mb-2">
                Tên đăng nhập hoặc Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin hoặc email@thaisonfoods.vn"
                  required
                  autoFocus
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm uppercase tracking-wider text-slate-300">
                  Mật khẩu
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                />
                <span>Ghi nhớ phiên đăng nhập (7 ngày)</span>
              </label>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-base bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/60 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Đăng Nhập Quản Trị</span>
                </>
              )}
            </button>
          </form>

          {/* Switch to Register link */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-400">
            <span>Chưa có tài khoản quản trị? </span>
            <Link
              href="/admin/register"
              className="text-emerald-400 hover:text-emerald-300 hover:underline ml-1 text-[1.125em]"
            >
              Đăng ký tài khoản mới
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

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
