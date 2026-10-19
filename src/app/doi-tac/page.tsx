'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { safeFetchJson } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  DollarSign,
  Wallet,
  User,
  Building2,
  Copy,
  Check,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Package,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  CreditCard,
  Send,
  Plus
} from 'lucide-react';

interface PartnerProfile {
  id: string;
  partnerCode: string;
  partnerType: 'CTV' | 'DEALER';
  lifecycleStatus: 'LITE' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  fullName: string;
  phone: string;
  email?: string;
  tierId?: string;
  tierName?: string;
  discountRate?: number;
  idCardNumber?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  bankBranch?: string;
}

interface StatsData {
  totalAttributed: number;
  totalOrders: number;
  totalRevenue: number;
  estimatedIncome: number;
  confirmedIncome: number;
  availableIncome: number;
  paidIncome: number;
  voidIncome: number;
  clawbackIncome: number;
  pendingPayoutAmount: number;
  isNegativeWallet: boolean;
  negativeAmountNeeded: number;
  dealerProgress: {
    revenueCurrent: number;
    revenueTarget: number;
    ordersCurrent: number;
    ordersTarget: number;
    isEligible: boolean;
  };
}

export default function PartnerPortalPage() {
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'ledger' | 'payouts' | 'profile' | 'dealer'>('overview');

  // Copy feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Data states
  const [orders, setOrders] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [dealerProducts, setDealerProducts] = useState<any[]>([]);

  // Payout request modal/form
  const [payoutAmount, setPayoutAmount] = useState<string>('200000');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Upgrade dealer loading
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dealer order form state
  const [dealerQuantities, setDealerQuantities] = useState<Record<string, number>>({});
  const [dealerShippingAddress, setDealerShippingAddress] = useState('');
  const [dealerOrderNote, setDealerOrderNote] = useState('');
  const [dealerOrderLoading, setDealerOrderLoading] = useState(false);
  const [dealerOrderSuccess, setDealerOrderSuccess] = useState<any | null>(null);

  // Auth form state if not logged in
  const [loginPhone, setLoginPhone] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [loginDebugOtp, setLoginDebugOtp] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // 1. Fetch Partner Profile & Stats
  const fetchPortalData = async () => {
    setLoading(true);
    try {
      const data = await safeFetchJson<{ success: boolean; partner: any }>('/api/partner/profile');
      if (data?.success && data.partner) {
        setPartner(data.partner);

        // Fetch stats
        const statsData = await safeFetchJson<{ success: boolean; stats: any }>('/api/partner/stats');
        if (statsData?.success) {
          setStats(statsData.stats);
        }
      } else {
        setPartner(null);
      }
    } catch (err) {
      console.error('Error fetching partner portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  // 2. Fetch specific tab data
  useEffect(() => {
    if (!partner) return;

    if (activeTab === 'orders') {
      safeFetchJson<{ success: boolean; orders: any[] }>('/api/partner/orders')
        .then((d) => d?.success && setOrders(d.orders || []))
        .catch(console.error);
    } else if (activeTab === 'ledger') {
      safeFetchJson<{ success: boolean; entries: any[] }>('/api/partner/ledger')
        .then((d) => d?.success && setLedgerEntries(d.entries || []))
        .catch(console.error);
    } else if (activeTab === 'payouts') {
      safeFetchJson<{ success: boolean; payouts: any[] }>('/api/partner/payouts')
        .then((d) => d?.success && setPayouts(d.payouts || []))
        .catch(console.error);
    } else if (activeTab === 'dealer') {
      safeFetchJson<{ success: boolean; products: any[] }>('/api/dealer/products')
        .then((d) => {
          if (d?.success && d.products) {
            setDealerProducts(d.products);
          }
        })
        .catch(console.error);
    }
  }, [activeTab, partner]);

  // Copy referral link
  const referralLink = typeof window !== 'undefined' && partner
    ? `${window.location.origin}/dai-ly?ref=${partner.partnerCode}`
    : '';

  const handleCopyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!partner?.partnerCode) return;
    navigator.clipboard.writeText(partner.partnerCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Login handler
  const handleRequestLoginOtp = async () => {
    setLoginError('');
    if (!loginPhone) return setLoginError('Vui lòng nhập số điện thoại');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/partner/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Lỗi gửi OTP');
      setLoginOtpSent(true);
      if (data.debugOtp) {
        setLoginDebugOtp(data.debugOtp);
        setLoginOtp(data.debugOtp);
      }
    } catch (e: any) {
      setLoginError(e.message || 'Lỗi gửi OTP');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerifyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      // Đăng nhập bằng register endpoint hoặc verify OTP
      const res = await fetch('/api/partner/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone, code: loginOtp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Mã OTP không đúng');

      // Tải lại portal
      await fetchPortalData();
    } catch (e: any) {
      setLoginError(e.message || 'Đăng nhập thất bại');
    } finally {
      setLoginLoading(false);
    }
  };

  // Submit Payout Request
  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutMsg(null);
    const amount = Number(payoutAmount);
    if (isNaN(amount) || amount < 200000) {
      setPayoutMsg({ type: 'error', text: 'Số tiền rút tối thiểu là 200.000 đ' });
      return;
    }

    setPayoutLoading(true);
    try {
      const res = await fetch('/api/partner/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Yêu cầu rút tiền không thành công');
      }

      setPayoutMsg({ type: 'success', text: 'Đã gửi yêu cầu rút tiền thành công! Kế toán sẽ xét duyệt và chuyển khoản.' });
      // Refresh
      fetchPortalData();
      const pRes = await fetch('/api/partner/payouts');
      const pData = await pRes.json();
      if (pData.success) setPayouts(pData.payouts || []);
    } catch (e: any) {
      setPayoutMsg({ type: 'error', text: e.message || 'Lỗi gửi yêu cầu rút tiền' });
    } finally {
      setPayoutLoading(false);
    }
  };

  // Submit Upgrade to Dealer
  const handleUpgradeDealer = async () => {
    setUpgradeMsg(null);
    setUpgradeLoading(true);
    try {
      const res = await fetch('/api/partner/upgrade-dealer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nâng cấp không thành công');
      }

      setUpgradeMsg({ type: 'success', text: data.message || 'Chúc mừng! Tài khoản đã được nâng cấp lên ĐẠI LÝ CHÍNH THỨC.' });
      fetchPortalData();
    } catch (e: any) {
      setUpgradeMsg({ type: 'error', text: e.message || 'Lỗi yêu cầu nâng cấp' });
    } finally {
      setUpgradeLoading(false);
    }
  };

  // Submit Dealer Wholesale Order
  const handleCreateDealerOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setDealerOrderLoading(true);
    setDealerOrderSuccess(null);

    const items = Object.entries(dealerQuantities)
      .filter(([_, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    const totalBottles = items.reduce((sum, it) => sum + it.quantity, 0);
    if (totalBottles < 50) {
      alert(`Đơn sỉ đại lý yêu cầu tối thiểu 50 chai. Hiện tại bạn đang chọn ${totalBottles} chai.`);
      setDealerOrderLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/dealer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          shippingAddress: dealerShippingAddress,
          note: dealerOrderNote,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể tạo đơn hàng sỉ');
      }

      setDealerOrderSuccess(data.order);
      setDealerQuantities({});
      setDealerShippingAddress('');
    } catch (e: any) {
      alert(e.message || 'Lỗi tạo đơn hàng sỉ');
    } finally {
      setDealerOrderLoading(false);
    }
  };

  // ================= UI LOADING =================
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
          <p className="text-base text-slate-700">Đang tải Cổng đối tác Thái Sơn Foods...</p>
        </div>
      </div>
    );
  }

  // ================= UI CHƯA ĐĂNG NHẬP =================
  if (!partner) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <span className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl inline-block">
              <Building2 className="w-7 h-7" />
            </span>
            <h1 className="text-2xl text-slate-900">Cổng Thông Tin Đối Tác</h1>
            <p className="text-xs text-slate-500">
              Vui lòng đăng nhập bằng số điện thoại đối tác để tiếp tục
            </p>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleVerifyLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-700 mb-1">Số điện thoại</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  required
                  placeholder="0123456789"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                />
                <button
                  type="button"
                  disabled={loginLoading}
                  onClick={handleRequestLoginOtp}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-sm rounded-lg whitespace-nowrap"
                >
                  Gửi OTP
                </button>
              </div>
            </div>

            {loginOtpSent && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm text-slate-700">Mã OTP 6 số</label>
                  {loginDebugOtp && (
                    <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Demo: {loginDebugOtp}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={loginOtp}
                  onChange={(e) => setLoginOtp(e.target.value)}
                  className="w-full text-center tracking-widest font-mono py-2 rounded-lg border border-slate-200 focus:border-emerald-600 text-lg"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading || !loginOtpSent}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base shadow-md transition-all disabled:opacity-50"
            >
              {loginLoading ? 'Đang xác thực...' : 'Đăng Nhập Cổng Đối Tác'}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-600">
            Chưa có tài khoản đối tác?{' '}
            <Link href="/dang-ky-doi-tac" className="text-emerald-700 hover:underline text-[1.125em]">
              Đăng ký làm CTV ngay
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ================= UI ĐÃ ĐĂNG NHẬP (DASHBOARD CHÍNH) =================
  const isDealer = partner.partnerType === 'DEALER';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      {/* 1. TOP HEADER BRAND & PARTNER INFO */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-emerald-700 text-white rounded-xl shadow-xs">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg text-slate-900">{partner.fullName}</span>
                <span
                  className={`text-[12px] px-2 py-0.5 rounded-full ${
                    isDealer
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  {isDealer ? `ĐẠI LÝ (${partner.tierName || 'TIER 1'})` : 'CỘNG TÁC VIÊN'}
                </span>
                <span className="text-[12px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  {partner.lifecycleStatus}
                </span>
              </div>
              <p className="text-xs text-slate-500">Mã đối tác: <strong className="font-mono text-emerald-800 text-[1.125em]">{partner.partnerCode}</strong> • SĐT: {partner.phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-sm transition-all"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Đã chép link!' : 'Chép link giới thiệu'}
            </button>
            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm transition-all"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? 'Đã chép mã!' : 'Mã: ' + partner.partnerCode}
            </button>
            <button
              onClick={() => {
                fetch('/api/partner/auth/logout', { method: 'POST' }).then(() => window.location.reload());
              }}
              title="Đăng xuất"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. NAVIGATION TABS */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto gap-1 border-t border-slate-100 py-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 text-sm rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'overview'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Tổng Quan
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-2 text-sm rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'orders'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Đơn Hàng Giới Thiệu
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-3.5 py-2 text-sm rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'ledger'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Sổ Cái Thu Nhập
          </button>
          <button
            onClick={() => setActiveTab('payouts')}
            className={`px-3.5 py-2 text-sm rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'payouts'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" /> Yêu Cầu Rút Tiền
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-2 text-sm rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'profile'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Hồ Sơ & KYC
          </button>
          <button
            onClick={() => setActiveTab('dealer')}
            className={`px-3.5 py-2 text-sm rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'dealer'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            {isDealer ? 'Cổng Đặt Hàng Đại Lý' : 'Tiến Độ Lên Đại Lý'}
          </button>
        </div>
      </header>

      {/* 3. NỘI DUNG TỪNG TAB */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* ================= TAB 1: TỔNG QUAN (OVERVIEW) ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Cảnh báo trạng thái ví âm hoặc KYC */}
            {stats?.isNegativeWallet && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <strong className="block text-[1.125em]">Cảnh báo: Ví hoa hồng đang có số dư âm!</strong>
                  Do phát sinh đơn hàng trả/hủy sau khi đã nhận tiền. Số tiền cần hoàn bù qua các đơn tiếp theo:{' '}
                  <strong className="text-[1.125em]">{stats.negativeAmountNeeded.toLocaleString('vi-VN')} đ</strong>.
                </div>
              </div>
            )}

            {/* Grid Thẻ Tài Chính KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex justify-between items-start text-slate-500 mb-2">
                  <span className="text-sm uppercase tracking-wider">Số Dư Khả Dụng</span>
                  <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                    <Wallet className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-2xl sm:text-2xl text-emerald-700">
                  {(stats?.availableIncome || 0).toLocaleString('vi-VN')} đ
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Đã sẵn sàng tạo lệnh rút tiền</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex justify-between items-start text-slate-500 mb-2">
                  <span className="text-sm uppercase tracking-wider">Đã Xác Nhận</span>
                  <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-2xl sm:text-2xl text-blue-700">
                  {(stats?.confirmedIncome || 0).toLocaleString('vi-VN')} đ
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Đơn giao thành công (chờ kỳ khả dụng)</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex justify-between items-start text-slate-500 mb-2">
                  <span className="text-sm uppercase tracking-wider">Ước Tính (Chờ Giao)</span>
                  <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                    <Clock className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-2xl sm:text-2xl text-amber-700">
                  {(stats?.estimatedIncome || 0).toLocaleString('vi-VN')} đ
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Đơn vừa đặt, đang chờ giao COD</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex justify-between items-start text-slate-500 mb-2">
                  <span className="text-sm uppercase tracking-wider">Tổng Đã Nhận</span>
                  <span className="p-1.5 rounded-lg bg-leaf-50 text-leaf-700">
                    <DollarSign className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-2xl sm:text-2xl text-leaf-700">
                  {(stats?.paidIncome || 0).toLocaleString('vi-VN')} đ
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Đã chi trả thành công về ngân hàng</p>
              </div>
            </div>

            {/* Khối Tiến độ lên Đại lý (nếu đang là CTV) */}
            {!isDealer && stats?.dealerProgress && (
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-md border border-slate-700">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <div>
                    <span className="text-sm text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" /> Tiến Độ Thăng Cấp Đại Lý Chính Thức
                    </span>
                    <h3 className="text-xl text-white mt-0.5">
                      Gia nhập kênh bán sỉ hưởng chiết khấu 25% - 35%
                    </h3>
                  </div>

                  {stats.dealerProgress.isEligible ? (
                    <button
                      onClick={handleUpgradeDealer}
                      disabled={upgradeLoading}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {upgradeLoading ? 'Đang gửi...' : 'Đạt Chuẩn! Nâng Cấp Đại Lý Ngay'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-xs bg-white/10 px-3 py-1.5 rounded-lg text-slate-300 border border-white/10">
                      Chưa đủ tiêu chuẩn (Cần 20tr doanh số hoặc 30 đơn)
                    </span>
                  )}
                </div>

                {upgradeMsg && (
                  <div
                    className={`mb-4 p-3 rounded-lg text-sm ${
                      upgradeMsg.type === 'success' ? 'bg-emerald-900/80 text-emerald-200' : 'bg-rose-900/80 text-rose-200'
                    }`}
                  >
                    {upgradeMsg.text}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                      <span>Doanh số tích lũy:</span>
                      <strong className="text-amber-400 text-[1.125em]">
                        {stats.dealerProgress.revenueCurrent.toLocaleString('vi-VN')} / {stats.dealerProgress.revenueTarget.toLocaleString('vi-VN')} đ
                      </strong>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-amber-400 h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            (stats.dealerProgress.revenueCurrent / stats.dealerProgress.revenueTarget) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                      <span>Số đơn hàng tích lũy:</span>
                      <strong className="text-emerald-400 text-[1.125em]">
                        {stats.dealerProgress.ordersCurrent} / {stats.dealerProgress.ordersTarget} đơn
                      </strong>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-400 h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            (stats.dealerProgress.ordersCurrent / stats.dealerProgress.ordersTarget) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bảng tổng quan hoạt động */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-base text-slate-900">Chia Sẻ & Kiếm Thu Nhập</h4>
                  <span className="text-xs text-slate-500">Cookie hiệu lực: 30 ngày</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-sm text-slate-600 block">Link giới thiệu của bạn:</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={referralLink}
                      className="flex-1 bg-white px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 text-slate-700 select-all"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm shrink-0 transition-all"
                    >
                      {copiedLink ? 'Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center pt-2">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-xs text-slate-500 block">Tổng đơn giới thiệu</span>
                    <strong className="text-xl text-slate-900">{stats?.totalOrders || 0}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-xs text-slate-500 block">Doanh số tạo ra</span>
                    <strong className="text-xl text-slate-900">
                      {(stats?.totalRevenue || 0).toLocaleString('vi-VN')} đ
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-xs text-slate-500 block">Tỷ lệ hoàn hàng</span>
                    <strong className="text-xl text-emerald-700">
                      {stats?.totalOrders ? Math.round(((stats?.voidIncome || 0) / (stats?.totalRevenue || 1)) * 100) : 0}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Thông tin tài khoản nhận hoa hồng */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                <h4 className="text-base text-slate-900">Tài Khoản Nhận Tiền</h4>
                {partner.bankAccountNumber ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Ngân hàng:</span>
                      <strong className="text-slate-800 text-[1.125em]">{partner.bankName}</strong>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Số tài khoản:</span>
                      <strong className="font-mono text-slate-800 text-[1.125em]">{partner.bankAccountNumber}</strong>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Chủ tài khoản:</span>
                      <strong className="text-slate-800 uppercase text-[1.125em]">{partner.bankAccountName}</strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">Định danh KYC:</span>
                      <span className="text-emerald-700 flex items-center gap-1 text-[1.125em]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã gửi
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-xs text-slate-500">Chưa liên kết tài khoản ngân hàng để nhận tiền.</p>
                    <button
                      onClick={() => setActiveTab('profile')}
                      className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm"
                    >
                      Bổ sung tài khoản ngay
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: ĐƠN HÀNG GIỚI THIỆU (ORDERS) ================= */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg text-slate-900">Danh Sách Đơn Hàng Giới Thiệu</h3>
                <p className="text-xs text-slate-500">Đơn hàng được gán tự động qua link hoặc mã giới thiệu của bạn</p>
              </div>
              <button
                onClick={() => {
                  safeFetchJson<{ success: boolean; orders: any[] }>('/api/partner/orders')
                    .then((d) => d?.success && setOrders(d.orders || []));
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Chưa có đơn hàng giới thiệu nào. Hãy chia sẻ link tới bạn bè và khách hàng!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/60 text-[1.125em]">
                      <th className="py-2.5 px-3">Mã Đơn</th>
                      <th className="py-2.5 px-3">Ngày Tạo</th>
                      <th className="py-2.5 px-3">Khách Hàng</th>
                      <th className="py-2.5 px-3 text-right">Giá Trị</th>
                      <th className="py-2.5 px-3">Trạng Thái Đơn</th>
                      <th className="py-2.5 px-3 text-right">Hoa Hồng</th>
                      <th className="py-2.5 px-3">Trạng Thái Hoa Hồng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3 font-mono font-medium text-slate-800">{ord.orderNumber || ord.id.slice(0, 8)}</td>
                        <td className="py-3 px-3 text-slate-500">
                          {new Date(ord.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800">{ord.customerName || 'Khách lẻ'}</td>
                        <td className="py-3 px-3 text-right text-slate-900 text-[1.125em]">
                          {Number(ord.totalAmount).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[12px] bg-slate-100 text-slate-700">
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-700 text-[1.125em]">
                          +{Number(ord.commissionAmount || 0).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[12px] ${
                              ord.commissionStatus === 'AVAILABLE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ord.commissionStatus === 'CONFIRMED'
                                ? 'bg-blue-100 text-blue-800'
                                : ord.commissionStatus === 'VOID'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ord.commissionStatus || 'ESTIMATED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: SỔ CÁI THU NHẬP (LEDGER) ================= */}
        {activeTab === 'ledger' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg text-slate-900">Sổ Cái Kế Toán Đối Tác (Immutable Ledger)</h3>
                <p className="text-xs text-slate-500">Nguồn sự thật ghi nhận toàn bộ biến động tài chính của bạn</p>
              </div>
            </div>

            {ledgerEntries.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Chưa có bút toán nào được ghi nhận.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/60 text-[1.125em]">
                      <th className="py-2.5 px-3">Thời Gian</th>
                      <th className="py-2.5 px-3">Loại Bút Toán</th>
                      <th className="py-2.5 px-3">Mã Tham Chiếu</th>
                      <th className="py-2.5 px-3 text-right">Số Tiền</th>
                      <th className="py-2.5 px-3">Trạng Thái</th>
                      <th className="py-2.5 px-3">Ngày Khả Dụng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerEntries.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3 text-slate-500">
                          {new Date(row.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-3 text-slate-800 text-[1.125em]">{row.entryType}</td>
                        <td className="py-3 px-3 font-mono text-slate-500">{row.referenceId || row.orderId || '-'}</td>
                        <td
                          className={`py-3 px-3 text-right ${
                            row.direction === 'IN' ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {row.direction === 'IN' ? '+' : '-'}
                          {Number(row.amount).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[12px] ${
                              row.status === 'AVAILABLE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : row.status === 'CONFIRMED'
                                ? 'bg-blue-100 text-blue-800'
                                : row.status === 'PAID'
                                ? 'bg-leaf-100 text-leaf-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {row.availableAt ? new Date(row.availableAt).toLocaleDateString('vi-VN') : 'Tức thì'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: RÚT TIỀN (PAYOUTS) ================= */}
        {activeTab === 'payouts' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <h3 className="text-lg text-slate-900">Tạo Lệnh Rút Tiền</h3>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-xs text-emerald-800 block">Số dư khả dụng hiện tại:</span>
                <strong className="text-2xl text-emerald-700">
                  {(stats?.availableIncome || 0).toLocaleString('vi-VN')} đ
                </strong>
              </div>

              {payoutMsg && (
                <div
                  className={`p-3 rounded-lg text-sm ${
                    payoutMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {payoutMsg.text}
                </div>
              )}

              <form onSubmit={handleRequestPayout} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-700 mb-1">
                    Số tiền muốn rút (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="200000"
                    step="50000"
                    required
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full px-3 py-2 text-base rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Mức rút tối thiểu: 200.000 đ</p>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-slate-800 text-[1.125em]">Tài khoản nhận tiền:</div>
                  <div>{partner.bankName} - {partner.bankAccountNumber}</div>
                  <div className="uppercase font-medium text-slate-700">{partner.bankAccountName}</div>
                </div>

                <button
                  type="submit"
                  disabled={payoutLoading || (stats?.availableIncome || 0) < 200000}
                  className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {payoutLoading ? 'Đang xử lý...' : 'Gửi Yêu Cầu Rút Tiền'}
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <h3 className="text-lg text-slate-900">Lịch Sử Yêu Cầu Rút Tiền</h3>

              {payouts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Chưa có lệnh rút tiền nào được tạo.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/60 text-[1.125em]">
                        <th className="py-2.5 px-3">Mã Lệnh</th>
                        <th className="py-2.5 px-3">Ngày Tạo</th>
                        <th className="py-2.5 px-3 text-right">Số Tiền</th>
                        <th className="py-2.5 px-3">Trạng Thái</th>
                        <th className="py-2.5 px-3">Mã Ngân Hàng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payouts.map((po) => (
                        <tr key={po.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3 font-mono font-medium text-slate-800">{po.payoutCode || po.id.slice(0, 8)}</td>
                          <td className="py-3 px-3 text-slate-500">{new Date(po.createdAt).toLocaleDateString('vi-VN')}</td>
                          <td className="py-3 px-3 text-right text-slate-900 text-[1.125em]">
                            {Number(po.amount).toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[12px] ${
                                po.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : po.status === 'APPROVED'
                                  ? 'bg-blue-100 text-blue-800'
                                  : po.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {po.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-500">{po.bankReference || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 5: HỒ SƠ & KYC (PROFILE) ================= */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
            <h3 className="text-lg text-slate-900">Thông Tin Định Danh & Thanh Toán</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Họ và tên</label>
                  <input
                    type="text"
                    disabled
                    value={partner.fullName}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-base text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    disabled
                    value={partner.phone}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-base text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Số CCCD/CMND</label>
                  <input
                    type="text"
                    disabled={Boolean(partner.idCardNumber)}
                    defaultValue={partner.idCardNumber || ''}
                    placeholder="Chưa cập nhật"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Ngân hàng</label>
                  <input
                    type="text"
                    disabled={Boolean(partner.bankName)}
                    defaultValue={partner.bankName || ''}
                    placeholder="VD: Vietcombank"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Số tài khoản ngân hàng</label>
                  <input
                    type="text"
                    disabled={Boolean(partner.bankAccountNumber)}
                    defaultValue={partner.bankAccountNumber || ''}
                    placeholder="Chưa cập nhật"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-base font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Tên chủ tài khoản</label>
                  <input
                    type="text"
                    disabled={Boolean(partner.bankAccountName)}
                    defaultValue={partner.bankAccountName || partner.fullName}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-base uppercase"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                Thông tin định danh và tài khoản ngân hàng được mã hóa bảo vệ theo quy định lưu trữ bảo mật TSF. Để thay đổi STK đã xác minh, vui lòng liên hệ bộ phận hỗ trợ đối tác.
              </p>
            </div>
          </div>
        )}

        {/* ================= TAB 6: ĐẠI LÝ (DEALER) ================= */}
        {activeTab === 'dealer' && (
          <div className="space-y-6">
            {!isDealer ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-xl mx-auto space-y-4">
                <span className="p-4 bg-amber-100 text-amber-800 rounded-2xl inline-block">
                  <Building2 className="w-8 h-8" />
                </span>
                <h3 className="text-2xl text-slate-900">Bạn Hiện Đang Là Cộng Tác Viên (CTV)</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Để đặt đơn hàng sỉ số lượng lớn và hưởng bảng giá chiết khấu đại lý độc quyền, hãy tích lũy doanh số đạt mốc <strong className="text-[1.125em]">20.000.000 đ</strong> hoặc hoàn tất <strong className="text-[1.125em]">30 đơn hàng</strong> để nâng cấp tài khoản!
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm"
                  >
                    Xem Tiến Độ Tại Trang Tổng Quan
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Banner Đại Lý Active */}
                <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-6 rounded-2xl shadow-md flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <span className="text-sm bg-white/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Cổng Bán Sỉ Dành Riêng Cho Đại Lý
                    </span>
                    <h3 className="text-2xl mt-1">
                      Hạng Đại Lý: {partner.tierName || 'TIER 1'} (Chiết Khấu: {partner.discountRate ? (partner.discountRate * 100).toFixed(0) : '20'}%)
                    </h3>
                    <p className="text-xs text-amber-100 mt-0.5">
                      Đơn sỉ yêu cầu tối thiểu 50 chai. Thanh toán chuyển khoản trước khi xuất kho chuẩn date FEFO.
                    </p>
                  </div>
                </div>

                {dealerOrderSuccess && (
                  <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 space-y-3">
                    <div className="flex items-center gap-2 text-lg">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      Tạo Đơn Hàng Sỉ Thành Công! Mã Đơn: {dealerOrderSuccess.orderNumber || dealerOrderSuccess.id}
                    </div>
                    <p className="text-xs text-emerald-800">
                      Tổng tiền thanh toán sau chiết khấu:{' '}
                      <strong className="text-[1.125em]">{Number(dealerOrderSuccess.totalAmount).toLocaleString('vi-VN')} đ</strong>.
                    </p>
                    <div className="p-3 bg-white rounded-xl border border-emerald-200 text-xs space-y-1">
                      <span className="text-slate-800 text-[1.125em]">Thông tin chuyển khoản:</span>
                      <div>Ngân hàng: <strong className="text-[1.125em]">Vietcombank - CN Tân Bình</strong></div>
                      <div>Số tài khoản: <strong className="text-[1.125em]">0071001234567</strong></div>
                      <div>Chủ tài khoản: <strong className="text-[1.125em]">CÔNG TY CỔ PHẦN THỰC PHẨM THÁI SƠN</strong></div>
                      <div>Nội dung CK: <strong className="font-mono text-emerald-700 text-[1.125em]">TSF DEALER {dealerOrderSuccess.orderNumber || dealerOrderSuccess.id}</strong></div>
                    </div>
                  </div>
                )}

                {/* Form Đặt Hàng Sỉ */}
                <form onSubmit={handleCreateDealerOrder} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
                  <h4 className="text-lg text-slate-900">Bảng Giá Sỉ & Chọn Sản Phẩm</h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/60 text-[1.125em]">
                          <th className="py-2.5 px-3">Sản Phẩm</th>
                          <th className="py-2.5 px-3 text-right">Giá Bán Lẻ</th>
                          <th className="py-2.5 px-3 text-right">Giá Sỉ Đại Lý</th>
                          <th className="py-2.5 px-3 text-right">Chiết Khấu</th>
                          <th className="py-2.5 px-3 text-center w-32">Số Lượng (Chai)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dealerProducts.map((p) => {
                          const qty = dealerQuantities[p.id] || 0;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-3">
                                <span className="text-slate-800 block text-[1.125em]">{p.name}</span>
                                <span className="text-[11px] text-slate-400">Quy cách: Thùng 24 chai</span>
                              </td>
                              <td className="py-3 px-3 text-right text-slate-500 line-through">
                                {Number(p.retailPrice).toLocaleString('vi-VN')} đ
                              </td>
                              <td className="py-3 px-3 text-right text-amber-700 text-base">
                                {Number(p.dealerPrice).toLocaleString('vi-VN')} đ
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[12px]">
                                  -{(p.discountRate * 100).toFixed(0)}%
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="6"
                                  value={qty}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                    setDealerQuantities((prev) => ({ ...prev, [p.id]: val }));
                                  }}
                                  className="w-20 px-2 py-1 text-center border border-slate-200 rounded-lg focus:border-amber-600 focus:outline-none text-[1.125em]"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div>
                      <label className="block text-sm text-slate-700 mb-1">
                        Địa chỉ nhận hàng của đại lý <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Số nhà, đường, phường, quận, tỉnh/thành phố..."
                        value={dealerShippingAddress}
                        onChange={(e) => setDealerShippingAddress(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-amber-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-700 mb-1">
                        Ghi chú đơn sỉ (nếu có)
                      </label>
                      <input
                        type="text"
                        placeholder="Giao giờ hành chính, cần hóa đơn VAT..."
                        value={dealerOrderNote}
                        onChange={(e) => setDealerOrderNote(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-amber-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={dealerOrderLoading}
                      className="px-8 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-base shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {dealerOrderLoading ? 'Đang tạo đơn sỉ...' : 'Gửi Đơn Đặt Hàng Sỉ'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
