'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  ArrowRight,
  Building,
  CreditCard,
  Phone,
  Mail,
  User,
  Lock,
  KeyRound,
  AlertCircle,
  Clock,
  ArrowLeft,
} from 'lucide-react';

export default function DangKyDoiTacPage() {
  const router = useRouter();

  // State bước hiện tại: 1 (Cơ bản/OTP) hoặc 2 (KYC & Ngân hàng) hoặc 3 (Thành công)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form Lớp 1
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(true);

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  // Partner Info sau khi hoàn tất Lớp 1
  const [createdPartner, setCreatedPartner] = useState<{
    id: string;
    partnerCode: string;
    fullName: string;
    phone: string;
  } | null>(null);

  // Form Lớp 2 (KYC)
  const [idCardNumber, setIdCardNumber] = useState('');
  const [idCardIssuedDate, setIdCardIssuedDate] = useState('');
  const [idCardIssuedPlace, setIdCardIssuedPlace] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [bankName, setBankName] = useState('Vietcombank');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankBranch, setBankBranch] = useState('');

  // Trạng thái xử lý
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Gửi OTP
  const handleSendOtp = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    const cleanPhone = phone.replace(/[\s\-\.]/g, '');
    const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
    if (!phoneRegex.test(cleanPhone)) {
      setErrorMsg('Vui lòng nhập số điện thoại Việt Nam hợp lệ (VD: 0123456789).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/partner/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể gửi mã OTP.');
      }

      setOtpSent(true);
      setSuccessMsg('Mã OTP 6 số đã được gửi tới số điện thoại của bạn!');
      if (data.debugOtp) {
        setDebugOtp(data.debugOtp);
        setOtpCode(data.debugOtp); // Tự động điền trên môi trường test/staging
      }

      // Đếm ngược 60s
      setOtpCountdown(60);
      const timer = setInterval(() => {
        setOtpCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi gửi mã OTP.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Lớp 1 (Đăng ký tài khoản CTV)
  const handleSubmitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!fullName.trim()) return setErrorMsg('Vui lòng nhập Họ và tên.');
    if (!phone.trim()) return setErrorMsg('Vui lòng nhập Số điện thoại.');
    if (!otpCode.trim()) return setErrorMsg('Vui lòng nhập mã OTP.');
    if (!acceptTerms) return setErrorMsg('Bạn cần đồng ý với điều khoản hợp tác.');

    setLoading(true);
    try {
      const res = await fetch('/api/partner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          phone,
          email,
          password: password || undefined,
          otpCode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Đăng ký không thành công.');
      }

      setCreatedPartner(data.partner);
      setSuccessMsg(`Chúc mừng! Bạn đã đăng ký thành công với mã CTV: ${data.partner.partnerCode}`);
      setStep(2); // Chuyển sang hoàn tất hồ sơ KYC lớp 2
    } catch (err: any) {
      setErrorMsg(err.message || 'Đăng ký thất bại.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Submit Lớp 2 (Hồ sơ KYC & Ngân hàng)
  const handleSubmitStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    setLoading(true);
    try {
      const res = await fetch('/api/partner/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idCardNumber,
          idCardIssuedDate: idCardIssuedDate || undefined,
          idCardIssuedPlace: idCardIssuedPlace || undefined,
          taxCode: taxCode || undefined,
          bankName,
          bankAccountNumber,
          bankAccountName: bankAccountName || fullName,
          bankBranch: bankBranch || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Cập nhật hồ sơ KYC thất bại.');
      }

      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi cập nhật hồ sơ KYC.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        {/* Header Logo & Title */}
        <div className="text-center mb-8">
          <Link
            href="/dai-ly"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-700 mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại trang giới thiệu
          </Link>
          <div className="flex justify-center mb-2">
            <span className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
              <Users className="w-7 h-7" />
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl text-slate-900">
            Đăng Ký Đối Tác Thái Sơn Foods
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
            Bắt đầu bán hàng cùng thương hiệu thức uống tự nhiên hàng đầu
          </p>

          {/* Stepper Indicator */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className={`flex items-center gap-1.5 text-sm ${step >= 1 ? 'text-emerald-700' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                1
              </span>
              <span>Đăng ký cơ bản</span>
            </div>
            <span className="w-8 h-[2px] bg-slate-200" />
            <div className={`flex items-center gap-1.5 text-sm ${step >= 2 ? 'text-emerald-700' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                2
              </span>
              <span>Định danh & Ngân hàng</span>
            </div>
            <span className="w-8 h-[2px] bg-slate-200" />
            <div className={`flex items-center gap-1.5 text-sm ${step === 3 ? 'text-emerald-700' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                3
              </span>
              <span>Kích hoạt</span>
            </div>
          </div>
        </div>

        {/* Thông báo lỗi / thành công */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ================= BƯỚC 1: ĐĂNG KÝ CƠ BẢN (LỚP 1) ================= */}
        {step === 1 && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <form onSubmit={handleSubmitStep1} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Họ và tên của bạn <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Số điện thoại đăng ký <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      placeholder="0123456789"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={loading || otpCountdown > 0}
                    onClick={handleSendOtp}
                    className="px-4 py-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm border border-emerald-200 whitespace-nowrap disabled:opacity-50 transition-all"
                  >
                    {otpCountdown > 0 ? `Gửi lại (${otpCountdown}s)` : 'Gửi mã OTP'}
                  </button>
                </div>
              </div>

              {otpSent && (
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-900 flex items-center gap-1.5 text-[1.125em]">
                      <KeyRound className="w-4 h-4 text-amber-600" /> Nhập mã xác thực OTP 6 số:
                    </span>
                    {debugOtp && (
                      <span className="text-[11px] font-mono bg-amber-200 px-1.5 py-0.5 rounded text-amber-900">
                        Demo: {debugOtp}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full text-center tracking-widest font-mono text-lg py-2 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-white"
                  />
                  <p className="text-[11px] text-amber-800">
                    Mã xác thực gồm 6 chữ số có hiệu lực trong vòng 5 phút.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Địa chỉ Email (tùy chọn)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="partner@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Mật khẩu đăng nhập
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  <input
                    type="password"
                    placeholder="Mật khẩu tối thiểu 6 ký tự"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    Tôi đồng ý với{' '}
                    <span className="text-emerald-700 underline text-[1.125em]">
                      Chính sách đối tác & Quy chế phân phối
                    </span>{' '}
                    của Thái Sơn Foods.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Đang kích hoạt...' : 'Hoàn Tất Đăng Ký & Nhận Mã CTV'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
              Đã có tài khoản đối tác?{' '}
              <Link href="/doi-tac" className="text-emerald-700 hover:underline text-[1.125em]">
                Đăng nhập Cổng đối tác
              </Link>
            </div>
          </div>
        )}

        {/* ================= BƯỚC 2: KYC & NGÂN HÀNG (LỚP 2) ================= */}
        {step === 2 && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-800 text-base">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Chúc mừng! Bạn đã nhận mã CTV: {createdPartner?.partnerCode}
              </div>
              <p className="mt-1 text-xs text-emerald-700">
                Hãy hoàn tất thông tin tài khoản ngân hàng để hệ thống sẵn sàng chi trả hoa hồng tự động khi bạn phát sinh đơn hàng.
              </p>
            </div>

            <form onSubmit={handleSubmitStep2} className="space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-base text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-600" /> 1. Tài Khoản Ngân Hàng Nhận Tiền
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-700 mb-1">
                    Ngân hàng <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="Vietcombank">Vietcombank</option>
                    <option value="Techcombank">Techcombank</option>
                    <option value="MBBank">MB Bank (Quân Đội)</option>
                    <option value="ACB">ACB (Á Châu)</option>
                    <option value="BIDV">BIDV</option>
                    <option value="VietinBank">VietinBank</option>
                    <option value="VPBank">VPBank</option>
                    <option value="TPBank">TPBank</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-700 mb-1">
                    Số tài khoản <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 0123456789"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-700 mb-1">
                    Tên chủ tài khoản <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="NGUYEN VAN A"
                    value={bankAccountName || fullName}
                    onChange={(e) => setBankAccountName(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1">
                    Chi nhánh (tùy chọn)
                  </label>
                  <input
                    type="text"
                    placeholder="Hồ Chí Minh"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="border-b border-slate-100 pt-3 pb-2">
                <h3 className="text-base text-slate-800 flex items-center gap-1.5">
                  2. Định Danh Cá Nhân (CCCD/CMND)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-700 mb-1">
                    Số CCCD/CMND <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="12 chữ số"
                    value={idCardNumber}
                    onChange={(e) => setIdCardNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1">
                    Mã số thuế cá nhân (nếu có)
                  </label>
                  <input
                    type="text"
                    placeholder="MST"
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Đang lưu...' : 'Gửi Hồ Sơ Xác Minh'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/doi-tac')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium text-sm transition-all"
                >
                  Bỏ qua, cập nhật sau
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= BƯỚC 3: HOÀN TẤT & CHUYỂN TIẾP ================= */}
        {step === 3 && (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl text-slate-900">Hồ Sơ Đã Được Ghi Nhận!</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Hồ sơ định danh và thông tin ngân hàng của bạn đã được chuyển tới ban quản trị kiểm tra. Bạn có thể bắt đầu lấy link giới thiệu và theo dõi thu nhập ngay bây giờ.
            </p>

            <div className="pt-2">
              <button
                onClick={() => router.push('/doi-tac')}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base shadow-md transition-all"
              >
                Vào Cổng Quản Lý Đối Tác Ngay
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
