'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Percent,
  Truck,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Package,
  Headphones,
  HelpCircle,
  Building2,
  ChevronRight,
  Calculator,
  FileText,
} from 'lucide-react';

export default function DaiLyLandingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  // Bộ tính toán thu nhập mô phỏng cho CTV
  const [estBottles, setEstBottles] = useState<number>(300);
  const avgBottlePrice = 22000; // Giá bán lẻ trung bình
  const ctvCommissionRate = 0.12; // 12% hoa hồng CTV chuẩn
  const monthlyRevenue = estBottles * avgBottlePrice;
  const monthlyProfit = Math.round(monthlyRevenue * ctvCommissionRate);

  // Tính năng đang tạm tắt theo yêu cầu doanh nghiệp, chuyển hướng về trang chủ
  return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-sm sm:text-base tracking-wide">
                <SparklesIcon className="w-4 h-4" />
                HỆ THỐNG PHÂN PHỐI ĐỐI TÁC CHÍNH THỨC THÁI SƠN FOODS
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl text-white leading-tight tracking-tight">
                Đồng Hành Cùng Thái Sơn Foods <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-amber-300">
                  Từ Cộng Tác Viên Đến Đại Lý Toàn Quốc
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-2xl">
                Khởi đầu kinh doanh đồ uống dinh dưỡng chất lượng cao với vốn 0 đồng qua mô hình 
                <strong className="text-[1.125em]"> CTV Bán hộ (TSF vận chuyển & đối soát COD)</strong>. Tích lũy doanh số để nâng cấp thành 
                <strong className="text-[1.125em]"> Đại Lý Phân Phối Cấp Cao</strong> hưởng giá sỉ chiết khấu sâu.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/dang-ky-doi-tac"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] text-[1.125em]"
                >
                  Đăng Ký CTV Miễn Phí (30 Giây)
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/doi-tac"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white backdrop-blur-sm transition-all text-[1.125em]"
                >
                  Đăng Nhập Cổng Đối Tác
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="pt-4 grid grid-cols-3 gap-4 border-t border-slate-700/60 max-w-lg">
                <div>
                  <p className="text-2xl text-amber-400">0 VNĐ</p>
                  <p className="text-xs text-slate-300">Vốn nhập hàng CTV</p>
                </div>
                <div>
                  <p className="text-2xl text-emerald-400">10% - 15%</p>
                  <p className="text-xs text-slate-300">Hoa hồng đơn hàng</p>
                </div>
                <div>
                  <p className="text-2xl text-teal-400">100% Minh bạch</p>
                  <p className="text-xs text-slate-300">Sổ cái tự động đối soát</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl text-slate-100">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <span className="text-sm uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4" /> Bảng Tính Thu Nhập Dự Kiến
                  </span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/20">
                    Cộng Tác Viên (CTV)
                  </span>
                </div>

                <div className="py-5 space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5 font-medium">
                      <span>Số lượng chai nước bán mỗi tháng:</span>
                      <span className="text-amber-300 text-lg">{estBottles} chai</span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={2000}
                      step={50}
                      value={estBottles}
                      onChange={(e) => setEstBottles(Number(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-700 rounded-lg"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                      <span>50 chai (bán lẻ)</span>
                      <span>1,000 chai (nhóm/tiệc)</span>
                      <span>2,000 chai</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 rounded-xl p-4 border border-white/5 space-y-2">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Ước tính doanh thu tạo ra:</span>
                      <span className="text-slate-100 text-[1.125em]">
                        {monthlyRevenue.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Mức hoa hồng áp dụng:</span>
                      <span className="text-emerald-400 text-[1.125em]">12% doanh số</span>
                    </div>
                    <div className="border-t border-slate-700/60 pt-2 flex justify-between items-baseline">
                      <span className="text-base text-white">Thu nhập thực nhận:</span>
                      <span className="text-2xl text-amber-400">
                        {monthlyProfit.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </div>

                  <div className="text-[12px] text-slate-300 bg-emerald-950/40 border border-emerald-500/20 rounded-lg p-2.5">
                    <strong className="text-[1.125em]">Cơ hội Đại lý:</strong> Khi tích lũy đủ 20.000.000 đ doanh số hoặc 30 đơn hàng, bạn sẽ đủ điều kiện thăng cấp <strong className="text-[1.125em]">ĐẠI LÝ CHÍNH THỨC</strong> với bảng giá sỉ chiết khấu lên đến 25% - 35%!
                  </div>
                </div>

                <Link
                  href="/dang-ky-doi-tac"
                  className="block text-center w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-base transition-all"
                >
                  Bắt Đầu Kiếm Thu Nhập Ngay
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. MÔ HÌNH SO SÁNH: CTV vs ĐẠI LÝ */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl text-slate-900">
            Lộ Trình Phát Triển 2 Giai Đoạn Thống Nhất
          </h2>
          <p className="mt-2 text-slate-600 text-sm sm:text-base">
            Thái Sơn Foods xây dựng mô hình đối tác bậc thang vững chắc: Không đa cấp, không ôm vốn rủi ro, minh bạch theo năng lực kinh doanh thực tế.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card CTV */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm mb-4">
              <Users className="w-3.5 h-3.5" /> GIAI ĐOẠN 1
            </div>
            <h3 className="text-2xl sm:text-2xl text-slate-900">Cộng Tác Viên (CTV)</h3>
            <p className="mt-1 text-sm text-slate-500">Phù hợp cá nhân, người làm nội dung, văn phòng, giới thiệu bạn bè.</p>

            <ul className="mt-6 space-y-3.5 text-sm text-slate-700">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong className="text-[1.125em]">Không cần bỏ vốn, không nhập hàng:</strong> Bạn chỉ cần chia sẻ link giới thiệu hoặc mã giới thiệu của mình.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong className="text-[1.125em]">TSF lo toàn bộ vận hành:</strong> Chúng tôi đóng gói, giao hàng hỏa tốc trong ngày và thu tiền COD từ khách hàng.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong className="text-[1.125em]">Hoa hồng tự động vào ví:</strong> Ghi nhận tức thì vào sổ cái bất biến, rút tiền về tài khoản ngân hàng từ 200.000 đ.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong className="text-[1.125em]">Cookie lưu 30 ngày:</strong> Khách quay lại mua trong vòng 30 ngày vẫn được tính hoa hồng cho bạn.</span>
              </li>
            </ul>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Yêu cầu tham gia</p>
                <p className="text-base text-slate-800">SĐT chính chủ & xác thực OTP</p>
              </div>
              <Link
                href="/dang-ky-doi-tac"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-all"
              >
                Đăng Ký CTV
              </Link>
            </div>
          </div>

          {/* Card Đại Lý */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative border border-slate-700">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30 text-sm mb-4">
              <Building2 className="w-3.5 h-3.5" /> GIAI ĐOẠN 2 (CẤP CAO)
            </div>
            <h3 className="text-2xl sm:text-2xl text-white">Đại Lý Phân Phối</h3>
            <p className="mt-1 text-sm text-slate-300">Phù hợp cửa hàng tiện lợi, quán cafe, đại lý tạp hóa, NPP chuyên nghiệp.</p>

            <ul className="mt-6 space-y-3.5 text-sm text-slate-200">
              <li className="flex items-start gap-2.5">
                <span><strong className="text-[1.125em]">Bảng giá sỉ độc quyền:</strong> Chiết khấu trực tiếp theo cấp bậc (Tier 1, Tier 2, Tier 3) với biên lợi nhuận cao nhất.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span><strong className="text-[1.125em]">Đơn đặt hàng số lượng lớn:</strong> Đặt đơn theo thùng/chai (tối thiểu 50 chai) trực tiếp qua cổng đại lý.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span><strong className="text-[1.125em]">Quản lý lô & Date chuẩn FEFO:</strong> Ưu tiên xuất kho lô date mới nhất, đảm bảo hạn sử dụng chuẩn cho đại lý bày bán.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span><strong className="text-[1.125em]">Hỗ trợ POSM & Marketing điểm bán:</strong> Cung cấp tủ mát, kệ trưng bày, standee và tư liệu truyền thông từ TSF.</span>
              </li>
            </ul>

            <div className="mt-8 pt-6 border-t border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Điều kiện nâng cấp</p>
                <p className="text-base text-amber-400">Doanh số 20tr hoặc 30 đơn CTV</p>
              </div>
              <Link
                href="/doi-tac"
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-base transition-all"
              >
                Xem Cổng Đại Lý
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. QUY TRÌNH 4 BƯỚC HOẠT ĐỘNG */}
      <section className="bg-slate-100 py-16 px-4 sm:px-6 lg:px-8 border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl text-slate-900">
              Quy Trình Hợp Tác Tinh Gọn & Tự Động
            </h2>
            <p className="mt-2 text-slate-600 text-sm">
              Mọi bước đều được tự động hóa bằng hệ thống phần mềm chuyên nghiệp, đảm bảo chính xác 100%.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl mb-4">
                1
              </div>
              <h4 className="text-slate-900 text-lg mb-1.5">Đăng Ký & Nhận Link</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Đăng ký chỉ với Số điện thoại và OTP. Hệ thống cấp ngay mã định danh và link chia sẻ cá nhân hóa.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl mb-4">
                2
              </div>
              <h4 className="text-slate-900 text-lg mb-1.5">Chia Sẻ & Khách Đặt</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Khách hàng nhấn vào link mua sữa bắp, sữa hạt sen. Đơn hàng tự động gắn vào mã của bạn ngay trong tích tắc.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl mb-4">
                3
              </div>
              <h4 className="text-slate-900 text-lg mb-1.5">TSF Giao Hàng & Thu Tiền</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Thái Sơn Foods đóng gói từ kho chuẩn lạnh, giao tận tay người tiêu dùng và đối soát COD ngân hàng.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl mb-4">
                4
              </div>
              <h4 className="text-slate-900 text-lg mb-1.5">Nhận Tiền & Nâng Hạng</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Hoa hồng về ví khả dụng, rút tiền tự động về tài khoản ngân hàng. Khi đủ doanh số, nâng cấp thẳng lên Đại Lý.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. CHÍNH SÁCH CAM KẾT & MINH BẠCH */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-white border border-slate-200 flex gap-4 items-start">
            <div>
              <h4 className="text-slate-900 mb-1 text-[1.125em]">Sổ Cái Bất Biến (Immutable)</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mọi khoản hoa hồng, đối soát, tạm giữ đều ghi nhận theo cơ chế sổ cái kế toán kép. Không bao giờ mất dữ liệu.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-white border border-slate-200 flex gap-4 items-start">
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-slate-900 mb-1 text-[1.125em]">Chất Lượng Tươi Mỗi Ngày</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sản phẩm sữa nếp bắp, hạt sen TSF luôn giữ chuẩn tươi mới, quy trình thanh trùng hiện đại bảo toàn dinh dưỡng.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-white border border-slate-200 flex gap-4 items-start">
            <div className="p-3 rounded-lg bg-teal-50 text-teal-600 shrink-0">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-slate-900 mb-1 text-[1.125em]">Đội Ngũ Hỗ Trợ Riêng Biệt</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Kênh Zalo và hotline riêng hỗ trợ tư vấn đối tác, giải quyết khiếu nại đơn hàng và hướng dẫn kỹ năng bán hàng.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CÂU HỎI THƯỜNG GẶP (FAQ) */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-slate-200">
        <h2 className="text-2xl sm:text-3xl text-center text-slate-900 mb-8">
          Câu Hỏi Thường Gặp
        </h2>
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <h4 className="text-slate-900 text-base sm:text-lg flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              Làm CTV có bắt buộc phải đóng phí hoặc mua hàng trước không?
            </h4>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 pl-6 leading-relaxed">
              Hoàn toàn <strong className="text-[1.125em]">KHÔNG</strong>. Chương trình CTV của Thái Sơn Foods miễn phí 100%. Bạn chỉ cần đăng ký bằng số điện thoại, lấy link giới thiệu và gửi cho khách mua.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <h4 className="text-slate-900 text-base sm:text-lg flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              Khi nào tôi có thể rút tiền hoa hồng về ngân hàng?
            </h4>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 pl-6 leading-relaxed">
              Sau khi đơn hàng giao thành công và hoàn tất đối soát COD, tiền hoa hồng sẽ chuyển sang trạng thái <strong className="text-[1.125em]">Khả dụng</strong>. Bạn có thể gửi lệnh rút tiền bất kỳ lúc nào với số dư tối thiểu từ <strong className="text-[1.125em]">200.000 đ</strong>.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <h4 className="text-slate-900 text-base sm:text-lg flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              Làm sao để tôi nâng cấp từ CTV lên Đại lý phân phối?
            </h4>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 pl-6 leading-relaxed">
              Khi tổng doanh số bán hộ của bạn tích lũy đạt <strong className="text-[1.125em]">20.000.000 đ</strong> hoặc đạt từ <strong className="text-[1.125em]">30 đơn hàng hoàn tất</strong>, hệ thống trên trang quản lý đối tác sẽ mở nút <em>&ldquo;Yêu cầu nâng cấp Đại lý&rdquo;</em>. Admin TSF sẽ duyệt và cấp quyền nhập sỉ với chiết khấu đại lý.
            </p>
          </div>
        </div>
      </section>

      {/* 6. CALL TO ACTION CUỐI TRANG */}
      <section className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white py-16 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-2xl sm:text-4xl">
            Bắt Đầu Kinh Doanh Cùng Thái Sơn Foods Ngay Hôm Nay
          </h2>
          <p className="text-emerald-100 text-sm sm:text-base">
            Gia nhập cộng đồng hơn 1.000+ CTV và Đại lý trên cả nước. Đăng ký nhận mã ngay trong chưa đầy 1 phút.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              href="/dang-ky-doi-tac"
              className="px-8 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg transition-all hover:scale-105 text-[1.125em]"
            >
              Đăng Ký Làm Đối Tác Ngay
            </Link>
            <Link
              href="/doi-tac"
              className="px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all text-[1.125em]"
            >
              Vào Cổng Quản Lý Đối Tác
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
    </svg>
  );
}
