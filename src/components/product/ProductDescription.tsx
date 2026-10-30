'use client';

import React from 'react';
import { formatKcal } from '@/lib/utils';

interface ProductDescriptionProps {
  productName?: string;
  description?: string;
  className?: string;
  /** Ẩn bảng dinh dưỡng ước tính chung khi sản phẩm đã có số liệu thật từ nhãn. Mặc định giữ hành vi cũ. */
  hideEstimatedNutrition?: boolean;
  /** Năng lượng thật trên 100ml (kcal) do admin nhập; có thì thay cho số ước tính */
  energyKcal?: number | null;
}

export default function ProductDescription({
  productName = 'Sữa Hạt Sen Lotus Yoo',
  description,
  className = '',
  hideEstimatedNutrition = false,
  energyKcal = null,
}: ProductDescriptionProps) {
  return (
    <section className={`bg-white py-12 md:py-16 border-t border-gray-200 ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
        {/* 1. SECTION HEADER */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-forest-700 text-sm uppercase tracking-wider mb-3">
          <span>MÔ TẢ & CÂU CHUYỆN CHẤT LƯỢNG</span>
        </div>

        <h2 className="text-2xl sm:text-3xl lg:text-4xl text-gray-900 tracking-tight">
          Dinh Dưỡng Lành Tự Nhiên Từ {productName}
        </h2>

        <p className="mt-3 text-sm sm:text-base text-gray-600 max-w-3xl mx-auto leading-relaxed">
          {description ||
            'Chắt chiu trọn vẹn tinh túy từ nguyên liệu chọn lọc tươi mới, sản xuất theo quy trình thanh trùng khép kín hiện đại đạt chuẩn HACCP, giữ trọn vị thơm ngon nguyên bản và nguồn dưỡng chất thuần khiết.'}
        </p>

        {/* 2. GRID 4 THẺ GIÁ TRỊ CỐT LÕI (4 CORE VALUE CARDS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 my-12 text-left">
          {/* Card 1: Nguyên liệu tươi */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 hover:shadow-md transition-all">
            <h3 className="text-gray-900 text-lg mb-1">
              Nguyên liệu tươi chọn lọc
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Nguyên liệu nông sản sạch tuyển chọn khắt khe từ các vùng nguyên liệu trù phú.
            </p>
          </div>

          {/* Card 2: Chuẩn Quốc Tế HACCP */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 hover:shadow-md transition-all">
            <h3 className="text-gray-900 text-lg mb-1">
              Chuẩn Quốc Tế HACCP
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Quy trình công nghệ thanh trùng khép kín vô trùng, đảm bảo an toàn vệ sinh thực phẩm tối đa.
            </p>
          </div>

          {/* Card 3: Không chất bảo quản */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-5 hover:shadow-md transition-all">
            <h3 className="text-gray-900 text-lg mb-1">
              Không chất bảo quản
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Không phụ gia hóa học độc hại, không phẩm màu nhân tạo, an tâm tuyệt đối cho trẻ nhỏ và người lớn tuổi.
            </p>
          </div>

          {/* Card 4: Bảo quản mát */}
          <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-5 hover:shadow-md transition-all">
            <h3 className="text-gray-900 text-lg mb-1">
              Bảo quản mát 5 - 10°C
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Luôn được bảo quản trong hệ thống chuỗi cung ứng lạnh, mang đến ngụm nước mát lành sảng khoái.
            </p>
          </div>
        </div>

        {/* 3. KHỐI NỘI DUNG NARRATIVE & BẢNG DINH DƯỠNG (GRID 2 CỘT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left">
          {/* Cột trái (Narrative - 7 cột) */}
          <div className={hideEstimatedNutrition ? 'lg:col-span-12 space-y-4' : 'lg:col-span-7 space-y-4'}>
            <div className="flex items-center gap-2.5">
              <h3 className="text-gray-900 text-xl sm:text-2xl">
                Thức uống dinh dưỡng - Uống một bữa ăn ngon lành
              </h3>
            </div>

            <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
              Dòng sản phẩm của Thái Sơn Foods ra đời với sứ mệnh mang lại nguồn năng lượng thuần thực vật lành mạnh cho cộng đồng. Mỗi chai sản phẩm đều được kiểm định chất lượng nghiêm ngặt trước khi xuất xưởng, đảm bảo hương vị thanh khiết tự nhiên nhất.
            </p>

            <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
              Hàm lượng chất xơ tự nhiên, vitamin nhóm B (B1, B3, B6) và các khoáng chất thiết yếu trong sản phẩm hỗ trợ quá trình tiêu hóa, duy trì vóc dáng thon gọn và nâng cao sức đề kháng cho cơ thể trong nhịp sống hiện đại.
            </p>

            <div className="pt-2 flex flex-wrap gap-2 text-xs text-emerald-800">
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 font-medium">
                100% Nông sản sạch
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 font-medium">
                Vị ngọt thanh dịu
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 font-medium">
                Tốt cho tim mạch
              </span>
            </div>
          </div>

          {/* Cột phải (Bảng Dinh dưỡng - 5 cột) */}
          {!hideEstimatedNutrition && (
          <div className="lg:col-span-5">
            <div className="bg-ink-50 border border-gray-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <h4 className="text-gray-900 text-base sm:text-lg">
                  Giá trị dinh dưỡng (Trong 100ml)
                </h4>
                <span className="text-[11px] text-gray-400 bg-white border border-gray-200 rounded-md px-2 py-0.5 font-medium">
                  Ước tính
                </span>
              </div>

              <div className="divide-y divide-gray-100">
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-gray-600">Năng lượng / Energy</span>
                  <span className="text-gray-900 text-[1.125em]">{formatKcal(energyKcal) || '~62 kcal'}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-gray-600">Carbohydrate</span>
                  <span className="text-gray-900 text-[1.125em]">11.8 g</span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-gray-600">Chất đạm / Protein</span>
                  <span className="text-gray-900 text-[1.125em]">1.2 g</span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-gray-600">Chất béo / Fat</span>
                  <span className="text-gray-900 text-[1.125em]">1.0 g</span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-gray-600">Chất xơ / Dietary Fiber</span>
                  <span className="text-gray-900 text-[1.125em]">0.8 g</span>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 mt-3 italic text-center">
                * Tỷ lệ phần trăm giá trị dinh dưỡng dựa trên chế độ ăn 2.000 calo/ngày.
              </p>
            </div>
          </div>
          )}
        </div>
      </div>
    </section>
  );
}
