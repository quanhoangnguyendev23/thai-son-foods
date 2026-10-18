'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Mail,
  Send,
  Smartphone,
  Monitor,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Truck,
  ArrowRight,
  Info,
} from 'lucide-react';

type EmailTab = 'confirmation' | 'shipping' | 'completed';

interface EmailLog {
  id: string;
  order_code: string;
  recipient: string;
  email_type: string;
  subject: string;
  status: string;
  provider: string;
  error_message?: string;
  created_at: string;
}

export default function EmailTestingStudio() {
  const [activeTab, setActiveTab] = useState<EmailTab>('confirmation');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
    provider?: string;
    details?: string;
  } | null>(null);

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [authError, setAuthError] = useState<string | null>(
    process.env.NODE_ENV === 'production' ? 'not_found' : null
  );

  const tabConfigs = {
    confirmation: {
      type: 'ORDER_CONFIRMATION',
      title: '1. Xác nhận đã nhận đơn #DH1234',
      badge: 'Khách vừa đặt đơn',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
      desc: 'Chi tiết từng món thảo mộc, đơn giá, địa chỉ, phương thức COD/Banking, lưu ý chuẩn bị hàng.',
      subject: '[Thái Sơn Foods] Xác nhận đơn hàng #DH1234 - Đang chuẩn bị đồ uống tươi',
    },
    shipping: {
      type: 'ORDER_SHIPPING',
      title: '3. Đang giao hàng',
      badge: 'Cửa hàng giao Shipper',
      icon: <Truck className="w-4 h-4 text-amber-600" />,
      desc: 'Thông báo hàng đã xuất chi nhánh, kèm số điện thoại tài xế giao nhận, hotline và lưu ý giữ nhiệt.',
      subject: '[Thái Sơn Foods] Đơn hàng #DH1234 đang trên đường giao đến bạn',
    },
    completed: {
      type: 'ORDER_COMPLETED',
      title: '4. Cảm ơn & Bảo quản đồ uống',
      badge: 'Khách đã nhận hàng',
      icon: null,
      desc: 'Lời tri ân chân thành, 4 nguyên tắc vàng giữ lạnh 2°C-5°C, cam kết 1-đổi-1 và tặng voucher 10%.',
      subject: '[Thái Sơn Foods] Cảm ơn bạn & Cẩm nang bảo quản đồ uống tươi chuẩn vị',
    },
  };

  const currentTab = tabConfigs[activeTab];

  const fetchLogs = async () => {
    if (process.env.NODE_ENV === 'production') {
      setAuthError('not_found');
      return;
    }
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/test-email/logs');
      if (res.status === 404) {
        setAuthError('not_found');
        return;
      }
      if (res.status === 401) {
        setAuthError('unauthorized');
        return;
      }
      if (res.status === 403) {
        setAuthError('forbidden');
        return;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error('Failed to load logs', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) {
      alert('Vui lòng nhập địa chỉ email hợp lệ!');
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail,
          type: currentTab.type,
          orderCode: 'DH1234',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSendResult({
          success: true,
          message: data.message,
          provider: data.provider,
        });
        fetchLogs();
      } else {
        setSendResult({
          success: false,
          message: data.error || 'Có lỗi xảy ra khi gửi email thử nghiệm.',
        });
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err.message || 'Lỗi kết nối máy chủ.',
      });
    } finally {
      setSending(false);
    }
  };

  if (process.env.NODE_ENV === 'production' || authError === 'not_found') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h1 className="text-5xl text-slate-800 mb-2">404</h1>
          <p className="text-slate-600 font-medium mb-4">Trang không tồn tại hoặc đã bị vô hiệu hóa.</p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-forest-800 text-white rounded-lg text-base hover:bg-forest-900 transition-colors"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  if (authError === 'unauthorized' || authError === 'forbidden') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl text-slate-900 mb-1">Truy cập bị từ chối</h2>
          <p className="text-xs text-slate-500 mb-4">
            {authError === 'unauthorized'
              ? 'Yêu cầu đăng nhập tài khoản quản trị SUPER_ADMIN để truy cập công cụ này.'
              : 'Tài khoản của bạn không có quyền thực thi công cụ kiểm thử hệ thống.'}
          </p>
          <Link
            href="/admin/login"
            className="inline-block px-4 py-2 bg-forest-800 text-white rounded-lg text-sm hover:bg-forest-900 transition-colors"
          >
            Đăng nhập quản trị
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 text-slate-800 flex flex-col">
      {/* Header Studio */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-forest-800 to-forest-700 flex items-center justify-center text-white shadow-sm">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl text-slate-900">
                  Thái Sơn Foods • Email Testing Studio
                </h1>
                <span className="px-2 py-0.5 rounded-full text-sm bg-emerald-100 text-emerald-800 border border-emerald-200">
                  v1.0 Live Test
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Xem trước giao diện và kiểm thử 3 mẫu email đơn hàng tự động
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium text-slate-600 hover:text-forest-800 transition-colors"
            >
              Về Trang chủ
            </Link>
            <span className="text-slate-300">|</span>
            <Link
              href="/admin"
              className="text-xs font-medium text-slate-600 hover:text-forest-800 transition-colors"
            >
              Quản trị Admin
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Email Preview Canvas */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[700px]">
          {/* Tabs Selector */}
          <div className="border-b border-slate-200 bg-slate-50/70 p-2 sm:p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.keys(tabConfigs) as EmailTab[]).map((tab) => {
                const conf = tabConfigs[tab];
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setIframeKey((prev) => prev + 1);
                    }}
                    className={`text-left p-3 rounded-xl border transition-all duration-200 relative ${
                      isActive
                        ? 'bg-white border-forest-800 text-slate-900 shadow-sm ring-1 ring-forest-800/20'
                        : 'bg-white/60 hover:bg-white border-slate-200/80 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-sm line-clamp-1">{conf.title}</span>
                      {conf.icon}
                    </div>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {conf.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email Info Bar */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <span className="text-slate-500 whitespace-nowrap text-[1.125em]">Tiêu đề gửi:</span>
              <span className="font-medium text-slate-800 bg-white px-2.5 py-1 rounded-md border border-slate-200 truncate select-all">
                {currentTab.subject}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Responsive Switcher */}
              <div className="flex items-center bg-slate-200/80 rounded-lg p-0.5 border border-slate-300">
                <button
                  onClick={() => setViewMode('desktop')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'desktop'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Chế độ Desktop (620px)"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Máy tính</span>
                </button>
                <button
                  onClick={() => setViewMode('mobile')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'mobile'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Chế độ Mobile (375px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Di động</span>
                </button>
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => setIframeKey((prev) => prev + 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                title="Tải lại bản xem trước"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              {/* Open in New Tab */}
              <a
                href={`/api/test-email?type=${activeTab}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium"
                title="Mở toàn màn hình trong tab mới"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mở tab mới</span>
              </a>
            </div>
          </div>

          {/* Iframe Preview Container */}
          <div className="flex-1 bg-emerald-50 p-4 flex items-center justify-center overflow-auto min-h-[550px]">
            <div
              className={`transition-all duration-300 rounded-xl overflow-hidden shadow-md bg-white border border-slate-300 ${
                viewMode === 'desktop' ? 'w-[620px]' : 'w-[375px]'
              }`}
              style={{ height: '720px' }}
            >
              <iframe
                key={iframeKey}
                src={`/api/test-email?type=${activeTab}&t=${iframeKey}`}
                className="w-full h-full border-0"
                title="Email Preview"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Testing Controls & Audit Logs */}
        <div className="w-full lg:w-96 flex flex-col gap-5">
          {/* Card: Test Send Controller */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-[1.125em]">
                <Send className="w-4 h-4" />
              </div>
              <h2 className="text-base text-slate-900">
                Gửi Thử Nghiệm Trực Tiếp
              </h2>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Nhập email thực tế của bạn để gửi mẫu thư đang chọn (
              <span className="text-emerald-800 text-[1.125em]">{currentTab.title}</span>).
            </p>

            <form onSubmit={handleSendTest} className="space-y-3">
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Email người nhận:
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="vidu@gmail.com"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-forest-800 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full py-2.5 px-4 rounded-xl text-sm text-white bg-gradient-to-r from-forest-800 to-forest-700 hover:opacity-95 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang gửi qua hệ thống...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Bấm gửi thử nghiệm ngay
                  </>
                )}
              </button>
            </form>

            {/* Send Result Alert */}
            {sendResult && (
              <div
                className={`mt-4 p-3 rounded-xl border text-xs leading-relaxed ${
                  sendResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-start gap-2">
                  {sendResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="mb-0.5 text-[1.125em]">
                      {sendResult.success ? 'Gửi thành công!' : 'Chưa gửi được'}
                    </div>
                    <div>{sendResult.message}</div>
                    {sendResult.provider && (
                      <div className="mt-1 font-mono text-[10px] text-slate-500">
                        Cổng phát: {sendResult.provider}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card: Configuration Note */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900">
            <div className="flex items-center gap-1.5 mb-1.5 text-[1.125em]">
              <Info className="w-4 h-4 text-amber-700" />
              Lưu ý về môi trường:
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Hiện tại nếu bạn chưa điền <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono">RESEND_API_KEY</code> hoặc tài khoản Gmail SMTP trong file <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono">.env</code>, hệ thống chạy ở chế độ <strong className="text-[1.125em]">MOCK Development</strong> (ghi lưu vết trực tiếp vào cơ sở dữ liệu PostgreSQL bên dưới mà không lo phát sinh lỗi).
            </p>
          </div>

          {/* Card: Live Email Logs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm text-slate-900 uppercase tracking-wide">
                  Nhật Ký Gửi Thư (email_logs)
                </h3>
              </div>
              <button
                onClick={fetchLogs}
                disabled={loadingLogs}
                className="text-[11px] text-forest-800 hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[360px] divide-y divide-slate-100">
              {logs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Chưa có lượt gửi email nào được ghi nhận.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-slate-800 truncate text-[1.125em]">
                        {log.recipient}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] ${
                          log.status === 'SENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {log.status} • {log.provider}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mb-0.5">
                      {log.subject}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Đơn: #{log.order_code || '---'}</span>
                      <span>{new Date(log.created_at).toLocaleTimeString('vi-VN')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
