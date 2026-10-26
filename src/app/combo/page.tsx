'use client';

import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { redirect, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ShoppingBag,
  Plus,
  Minus,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Lock,
  RotateCcw,
  Layers,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import { products } from '@/data/products';
import { formatPrice, cn } from '@/lib/utils';
import { useCartStore } from '@/store/cart';
import { useFlyToCart } from '@/context/FlyToCartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useBranchStore } from '@/store/branch';
import { useBranchStockMap } from '@/hooks/useBranchStockMap';
import { ENABLE_COMBOS, ENABLE_CUSTOM_COMBOS } from '@/config/features';

// Combo tự chọn đang tạm ngưng (ENABLE_CUSTOM_COMBOS = false): thay nút thêm giỏ bằng thông báo, không cho thêm vào giỏ
function CustomComboPausedNotice() {
  return (
    <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 px-5 py-3 rounded-2xl bg-gray-100 border border-gray-200 text-center">
      <span className="flex items-center gap-1.5 text-base text-gray-600">
        <Lock className="w-4 h-4 text-gray-500" />
        Combo tự chọn tạm ngưng
      </span>
      <Link href="/#combo" className="text-base text-forest-800 underline underline-offset-2 hover:text-forest-900">
        Xem combo có sẵn
      </Link>
    </div>
  );
}

// ==========================================
// CẤU HÌNH COMBO 01 (TỰ DO 4 CHAI)
// ==========================================
const COMBO_01_TARGET = 4;
const COMBO_01_PRICE = 69000;

const PRODUCT_SUBTITLES: Record<string, string> = {
  'sua-bap-nep': '330ml • Vị ngọt thanh bùi ngậy bắp non',
  'nha-dam-mu-trom': '330ml • Thanh nhiệt giải độc giòn sần sật',
  'sua-hat-sen-mekong': '330ml • Hương sen Đồng Tháp thuần khiết',
  'sua-gao-lut-mekong': '330ml • Giàu dưỡng chất, thơm dẻo gạo lứt',
  'sua-hat-sen-lotus': '330ml • Công thức ít ngọt, thơm mát',
  'sua-gao-lut-ohsawa': '330ml • Vị đậm đà bổ dưỡng năng lượng',
  'tao-do-hat-chia': '330ml • Bổ khí huyết, đẹp da và dáng',
  'sam-la-han-hoa-cuc': '330ml • Mát gan giải nhiệt ngày nắng nóng',
  'tra-sua-ciao': '330ml • Đậm vị trà, béo ngậy vị sữa',
  'matcha-tra-sua-ciao': '330ml • Trà xanh Matcha Nhật Bản thơm dịu',
  'tra-sua-go': '330ml • Thạch dai giòn sảng khoái',
  'tra-xanh-go': '330ml • Trà xanh thanh mát, thạch giòn',
};

// ==========================================
// CẤU HÌNH COMBO 02 (10 CHAI PHÂN NHÁNH)
// ==========================================
const COMBO_02_TARGET = 10;
const COMBO_02_PRICE = 160000;
const COMBO_02_ORIGINAL_PRICE = 180000;

interface OptionItem {
  id: string;
  name: string;
  count: number;
  unitPrice: number;
  totalOriginal: number;
  image: string;
  desc: string;
  badge?: string;
}

// BƯỚC 1: Chọn 5 chai chủ lực
const STEP1_OPTIONS: OptionItem[] = [
  {
    id: 'sua-bap-nep',
    name: 'Sữa Bắp Nếp Thái Sơn',
    count: 5,
    unitPrice: 18000,
    totalOriginal: 90000,
    image: '/images/products/1200x900-sb1.jpg',
    desc: '330ml • Vị ngọt thanh bùi ngậy tự nhiên từ bắp non tươi nguyên chất',
    badge: 'Món bán chạy #1',
  },
  {
    id: 'nha-dam-mu-trom',
    name: 'Nha Đam Mủ Trôm Thái Sơn',
    count: 5,
    unitPrice: 18000,
    totalOriginal: 90000,
    image: '/images/products/1200x900-md1.jpg',
    desc: '330ml • Thanh nhiệt giải độc cơ thể, topping nha đam giòn mát sần sật',
    badge: 'Thanh nhiệt giải độc',
  },
];

// BƯỚC 2 (Nhánh A: Khi đã chọn 5 Sữa Bắp): 3 chai Thảo mộc
const STEP2_SUA_BAP_OPTIONS: OptionItem[] = [
  {
    id: 'sam-la-han-hoa-cuc',
    name: 'Sâm La Hán Hoa Cúc',
    count: 3,
    unitPrice: 18000,
    totalOriginal: 54000,
    image: '/images/products/1200x900-lh1.jpg',
    desc: '330ml • Mát gan giải nhiệt, kết hợp tinh hoa La Hán Quả & Hoa Cúc tự nhiên',
    badge: 'Thảo mộc thanh mát',
  },
  {
    id: 'tao-do-hat-chia',
    name: 'Táo Đỏ Hạt Chia',
    count: 3,
    unitPrice: 18000,
    totalOriginal: 54000,
    image: '/images/products/1200x900-td1.jpg',
    desc: '330ml • Bổ khí huyết, đẹp da dáng cùng hạt chia organic giàu dưỡng chất',
    badge: 'Bổ dưỡng đẹp dáng',
  },
];

// BƯỚC 2 (Nhánh B: Khi đã chọn 5 Mủ Trôm): 3 chai Sữa hạt
const STEP2_MU_TROM_OPTIONS: OptionItem[] = [
  {
    id: 'sua-hat-sen-mekong',
    name: 'Sữa Hạt Sen Mekong Xanh',
    count: 3,
    unitPrice: 18000,
    totalOriginal: 54000,
    image: '/images/products/1200x900-shs1.jpg',
    desc: '330ml • Hạt sen Đồng Tháp thuần khiết, thanh tâm an thần ngủ ngon',
    badge: 'An thần thanh lọc',
  },
  {
    id: 'sua-gao-lut-mekong',
    name: 'Sữa Gạo Lứt Mekong Xanh',
    count: 3,
    unitPrice: 18000,
    totalOriginal: 54000,
    image: '/images/products/1200x900-sgl1.jpg',
    desc: '330ml • Gạo lứt huyết rồng dồi dào chất xơ & nguồn năng lượng lành mạnh',
    badge: 'Năng lượng lành',
  },
];

// BƯỚC 3: Chọn 2 chai Trà thạch
const STEP3_OPTIONS: OptionItem[] = [
  {
    id: 'tra-sua-go',
    name: 'Trà Sữa GO',
    count: 2,
    unitPrice: 18000,
    totalOriginal: 36000,
    image: '/images/products/1200x900-tsg1.jpg',
    desc: '330ml • Trà sữa béo ngậy thơm nồng kèm thạch dai giòn sảng khoái',
    badge: 'Kèm thạch giòn',
  },
  {
    id: 'tra-xanh-go',
    name: 'Trà Xanh GO',
    count: 2,
    unitPrice: 18000,
    totalOriginal: 36000,
    image: '/images/products/1200x900-txg1.jpg',
    desc: '330ml • Lá trà xanh mát lạnh kết hợp thạch giòn dai vui miệng',
    badge: 'Kèm thạch giòn',
  },
];

// ==========================================
// COMPONENT CHỌN COMBO 01 (TỰ DO 4 CHAI)
// ==========================================
function Combo01View() {
  const { flyToCart } = useFlyToCart();
  const { selectedBranch, openBranchModal, getAvailable } = useBranchStockMap();
  const [selectedBottles, setSelectedBottles] = useState<Record<string, number>>({
    'sua-bap-nep': 1,
    'nha-dam-mu-trom': 1,
  });
  const [justAdded, setJustAdded] = useState(false);
  const [stockAlert, setStockAlert] = useState<string | null>(null);

  const availableProducts = useMemo(() => {
    return products.filter((p) => p.isActive);
  }, []);

  const totalSelected = useMemo(() => {
    return Object.values(selectedBottles).reduce((sum, qty) => sum + qty, 0);
  }, [selectedBottles]);

  const originalMarketPrice = useMemo(() => {
    const sum = Object.entries(selectedBottles).reduce((acc, [id, qty]) => {
      const prod = availableProducts.find((p) => p.id === id);
      return acc + (prod ? prod.price * qty : 18000 * qty);
    }, 0);
    return Math.max(72000, sum);
  }, [selectedBottles, availableProducts]);

  const savings = Math.max(3000, originalMarketPrice - COMBO_01_PRICE);
  const percentComplete = Math.min(100, Math.round((totalSelected / COMBO_01_TARGET) * 100));

  const selectedSlots = useMemo(() => {
    const slots: (typeof availableProducts[0] | null)[] = [];
    for (const [id, qty] of Object.entries(selectedBottles)) {
      const prod = availableProducts.find((p) => p.id === id);
      if (prod) {
        for (let i = 0; i < qty; i++) {
          if (slots.length < COMBO_01_TARGET) {
            slots.push(prod);
          }
        }
      }
    }
    while (slots.length < COMBO_01_TARGET) {
      slots.push(null);
    }
    return slots;
  }, [selectedBottles, availableProducts]);

  const handleIncrease = (productId: string) => {
    if (totalSelected >= COMBO_01_TARGET) return;
    const avail = getAvailable(productId);
    const current = selectedBottles[productId] || 0;
    if (current >= avail) {
      setStockAlert(`Kho ${selectedBranch?.name || 'hiện tại'} chỉ còn ${avail} chai khả dụng cho thức uống này.`);
      setTimeout(() => setStockAlert(null), 3500);
      return;
    }
    setStockAlert(null);
    setSelectedBottles((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }));
  };

  const handleDecrease = (productId: string) => {
    setSelectedBottles((prev) => {
      const current = prev[productId] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return {
        ...prev,
        [productId]: current - 1,
      };
    });
  };

  const handleClearAll = () => {
    setSelectedBottles({});
  };

  const handleAddToCart = () => {
    if (!ENABLE_CUSTOM_COMBOS) return;
    if (totalSelected !== COMBO_01_TARGET) return;

    const summaryList = Object.entries(selectedBottles)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => {
        const prod = availableProducts.find((p) => p.id === id);
        const name = prod ? prod.name : id;
        return `${qty} ${name}`;
      });

    const summaryText = summaryList.join(', ');
    const fingerprint = Object.entries(selectedBottles)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => `${id}:${qty}`)
      .sort()
      .join('_');

    useCartStore.getState().addItem({
      productId: `combo-4-chai-${fingerprint}`,
      name: 'Combo 4 Chai (Tự chọn)',
      slug: '/combo?type=combo-4-chai',
      price: COMBO_01_PRICE,
      unit: `4 chai: ${summaryText}`,
      thumbnail: '/images/combos/combo-7-chai-3.jpg',
    });

    setJustAdded(true);
    useCartStore.getState().openCart();
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div>
      {/* Header: Tiêu đề & Giá bán */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl text-forest-950 font-heading tracking-tight">
            Chọn 4 chai cho Combo 01
          </h1>
          <p className="text-text-muted text-sm md:text-[15px] mt-1">
            Tự do chọn 4 chai bất kỳ trong 12 thức uống bên dưới — Giá trọn gói chỉ{' '}
            <strong className="text-text-dark text-[1.125em]">{formatPrice(COMBO_01_PRICE)}đ</strong>
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl md:text-4xl text-forest-950 font-heading">
              {formatPrice(COMBO_01_PRICE)}đ
            </span>
            <span className="text-sm md:text-base text-gray-400 line-through">
              {formatPrice(originalMarketPrice)}đ
            </span>
          </div>
          <div className="inline-flex items-center gap-1 text-sm text-emerald-800 mt-0.5">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Tiết kiệm {formatPrice(savings)}đ so với giá bán lẻ
          </div>
        </div>
      </div>

      {/* KHAY 4 CHAI ĐÃ CHỌN */}
      <div className="bg-white rounded-3xl border border-gray-200/90 p-4 sm:p-6 shadow-xs mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
              {selectedSlots.map((product, index) => {
                if (product) {
                  return (
                    <div
                      key={`slot-${index}-${product.id}`}
                      className="relative rounded-2xl border-2 border-forest-800 bg-ivory p-3 flex flex-col items-center justify-between text-center min-h-[145px] shadow-xs group transition-all"
                    >
                      <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-forest-800 text-white text-[12px] flex items-center justify-center shadow-xs">
                        {index + 1}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDecrease(product.id)}
                        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-100 hover:bg-red-500 text-red-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Bỏ chai này"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      <div className="relative w-16 h-20 my-1">
                        <Image
                          src={product.thumbnail}
                          alt={product.name}
                          fill
                          className="object-contain"
                          sizes="80px"
                        />
                      </div>

                      <div className="w-full">
                        <p className="text-sm text-text-dark leading-tight">
                          {product.name}
                        </p>
                        <span className="text-[11px] text-emerald-700">Đã chọn</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={`slot-empty-${index}`}
                    className="relative rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/60 p-3 flex flex-col items-center justify-center text-center min-h-[145px] transition-all"
                  >
                    <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[12px] flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-gray-200/80 flex items-center justify-center text-gray-400 mb-2">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-sm text-gray-400">Chai {index + 1}</span>
                    <span className="text-[10px] text-gray-400">Chọn bên dưới</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-gray-100 pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between text-sm text-text-dark mb-1.5">
                <span>Tiến độ hoàn tất Combo</span>
                <span className="text-emerald-700 text-[1.125em]">{totalSelected} / {COMBO_01_TARGET} chai</span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-forest-800 transition-all duration-300 rounded-full"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>

              {totalSelected < COMBO_01_TARGET ? (
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/70 text-amber-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Vui lòng chọn thêm <strong className="text-[1.125em]">{COMBO_01_TARGET - totalSelected} chai</strong> nữa để đủ 4 chai cho combo.</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[1.125em]">Đã đủ 4 chai! Bạn có thể thêm ngay vào giỏ hàng.</span>
                </div>
              )}
            </div>

            {totalSelected > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="mt-4 text-sm text-gray-500 hover:text-red-500 inline-flex items-center gap-1 self-start transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Làm mới khay chọn</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DANH SÁCH 12 SẢN PHẨM ĐỂ CHỌN */}
      <div className="mb-8">
        {stockAlert && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{stockAlert}</span>
            </div>
            <button
              type="button"
              onClick={openBranchModal}
              className="text-red-900 underline text-xs cursor-pointer"
            >
              Đổi kho khác
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl text-text-dark font-heading">
            Danh sách 12 thức uống thanh mát
          </h2>
          <span className="text-xs text-text-muted">Nhấn dấu + hoặc - để thêm chai</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {availableProducts.map((prod) => {
            const currentQty = selectedBottles[prod.id] || 0;
            const isSelected = currentQty > 0;
            const subtitle = PRODUCT_SUBTITLES[prod.id] || prod.volume || '330ml';
            const isLimitReached = totalSelected >= COMBO_01_TARGET && currentQty === 0;
            const avail = getAvailable(prod.id);
            const isOutOfStock = avail <= 0;
            const isMaxForThisProd = currentQty >= avail;

            return (
              <div
                key={prod.id}
                className={cn(
                  'rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between bg-white relative',
                  isSelected
                    ? 'border-forest-800 shadow-sm ring-1 ring-forest-800/20'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-xs',
                  (isLimitReached || isOutOfStock) && 'opacity-60 bg-gray-50'
                )}
              >
                {isSelected && (
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-forest-800 text-white text-sm flex items-center justify-center shadow-xs">
                    {currentQty}
                  </span>
                )}

                <div>
                  <div className="relative w-full aspect-square mb-3 bg-ivory rounded-xl p-2 flex items-center justify-center overflow-hidden">
                    <Image
                      src={prod.thumbnail}
                      alt={prod.name}
                      fill
                      className="object-contain p-2 transition-transform"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  </div>

                  <h3 className="text-text-dark text-base sm:text-lg leading-snug mb-1">
                    {prod.name}
                  </h3>
                  <p className="text-xs text-text-muted mb-2">{subtitle}</p>

                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    <span className="text-xs text-gray-400">Giá lẻ:</span>
                    <span className="text-sm text-gray-600 line-through">
                      {formatPrice(prod.price)}đ
                    </span>
                    {isOutOfStock ? (
                      <span className="text-[12px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                        Hết hàng tại kho
                      </span>
                    ) : (
                      <span className="text-[12px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Gói Combo
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  {currentQty > 0 ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDecrease(prod.id)}
                          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-base text-text-dark min-w-[20px] text-center">
                          {currentQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleIncrease(prod.id)}
                          disabled={totalSelected >= COMBO_01_TARGET || isMaxForThisProd}
                          className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                            totalSelected >= COMBO_01_TARGET || isMaxForThisProd
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-forest-800 hover:bg-forest-900 text-white cursor-pointer'
                          )}
                          title={isMaxForThisProd ? `Kho chỉ còn ${avail} chai` : 'Thêm chai'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <span className="text-sm text-emerald-800">
                        {currentQty} chai
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleIncrease(prod.id)}
                      disabled={totalSelected >= COMBO_01_TARGET || isOutOfStock}
                      className={cn(
                        'w-full py-2 px-3 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all',
                        totalSelected >= COMBO_01_TARGET || isOutOfStock
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-ivory hover:bg-forest-800 text-text-dark hover:text-white border border-gray-300 hover:border-forest-800 cursor-pointer active:scale-95'
                      )}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isOutOfStock ? 'Hết hàng tại kho' : 'Thêm vào Combo'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* THANH TỔNG KẾT VÀ NÚT THÊM GIỎ HÀNG DƯỚI CÙNG */}
      <div className="fixed bottom-0 left-0 right-0 min-[1440px]:right-[380px] z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 px-4 py-3 sm:py-4 shadow-xl">
        <div className="section-container max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-2xl text-forest-950 font-heading">
                  {formatPrice(COMBO_01_PRICE)}đ
                </span>
                <span className="text-xs text-gray-400 line-through">
                  {formatPrice(originalMarketPrice)}đ
                </span>
              </div>
              <span className="text-sm text-emerald-700">
                Đã chọn {totalSelected}/{COMBO_01_TARGET} chai
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {totalSelected < COMBO_01_TARGET && (
              <div className="hidden sm:flex items-center gap-1 px-3.5 py-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-sm shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Chọn thêm {COMBO_01_TARGET - totalSelected} chai để hoàn tất
              </div>
            )}

            {!ENABLE_CUSTOM_COMBOS ? <CustomComboPausedNotice /> : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={totalSelected !== COMBO_01_TARGET}
              className={cn(
                'w-full sm:w-auto px-6 sm:px-8 py-3 rounded-2xl text-base sm:text-lg flex items-center justify-center gap-2 transition-all shadow-md',
                totalSelected === COMBO_01_TARGET
                  ? 'bg-forest-800 text-white hover:bg-forest-900 active:scale-95 cursor-pointer shadow-forest-800/20'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              )}
            >
              {justAdded ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  Đã thêm vào giỏ!
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  Thêm vào giỏ hàng ({formatPrice(COMBO_01_PRICE)}đ)
                </>
              )}
            </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENT CHỌN COMBO 02 (COMBO KHÁM PHÁ 10 CHAI)
// ==========================================
function Combo02View() {
  const { flyToCart } = useFlyToCart();
  const stepContainerRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [step1, setStep1] = useState<'sua-bap-nep' | 'nha-dam-mu-trom' | null>(null);
  const [step2, setStep2] = useState<string | null>(null);
  const [step3, setStep3] = useState<'tra-sua-go' | 'tra-xanh-go' | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  // Tính toán số chai đã chọn
  const totalSelected = useMemo(() => {
    let count = 0;
    if (step1) count += 5;
    if (step2) count += 3;
    if (step3) count += 2;
    return count;
  }, [step1, step2, step3]);

  const isComplete = totalSelected === COMBO_02_TARGET;

  // Sản phẩm đang được chọn
  const selectedStep1Obj = useMemo(() => {
    return STEP1_OPTIONS.find((o) => o.id === step1) || null;
  }, [step1]);

  const currentStep2Options = useMemo(() => {
    if (step1 === 'sua-bap-nep') return STEP2_SUA_BAP_OPTIONS;
    if (step1 === 'nha-dam-mu-trom') return STEP2_MU_TROM_OPTIONS;
    return [];
  }, [step1]);

  const selectedStep2Obj = useMemo(() => {
    if (!step2) return null;
    return currentStep2Options.find((o) => o.id === step2) || null;
  }, [step2, currentStep2Options]);

  const selectedStep3Obj = useMemo(() => {
    return STEP3_OPTIONS.find((o) => o.id === step3) || null;
  }, [step3]);

  // Xử lý chọn Bước 1 (5 chai) & TỰ ĐỘNG CHUYỂN BƯỚC 2
  const handleSelectStep1 = (id: 'sua-bap-nep' | 'nha-dam-mu-trom') => {
    setStep1(id);
    if (step1 !== id) {
      setStep2(null);
    }
    setCurrentStep(2);
    setTimeout(() => {
      if (stepContainerRef.current) {
        stepContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  // Xử lý chọn Bước 2 (3 chai) & TỰ ĐỘNG CHUYỂN BƯỚC 3
  const handleSelectStep2 = (id: string) => {
    setStep2(id);
    setCurrentStep(3);
    setTimeout(() => {
      if (stepContainerRef.current) {
        stepContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  // Xử lý chọn Bước 3 (2 chai)
  const handleSelectStep3 = (id: 'tra-sua-go' | 'tra-xanh-go') => {
    setStep3(id);
  };

  // Làm mới toàn bộ
  const handleReset = () => {
    setStep1(null);
    setStep2(null);
    setStep3(null);
    setCurrentStep(1);
  };

  // Thêm vào giỏ hàng
  const handleAddToCart = (e?: React.MouseEvent) => {
    if (!ENABLE_CUSTOM_COMBOS) return;
    if (!isComplete || !selectedStep1Obj || !selectedStep2Obj || !selectedStep3Obj) return;

    if (e) {
      flyToCart({
        startElement: e.currentTarget as HTMLElement,
        imageSrc: '/images/combos/combo-6-chai-2.jpg',
      });
    }

    const summaryText = `5x ${selectedStep1Obj.name}, 3x ${selectedStep2Obj.name}, 2x ${selectedStep3Obj.name}`;
    const fingerprint = `${step1}_${step2}_${step3}`;

    useCartStore.getState().addItem({
      productId: `combo-van-phong-${fingerprint}`,
      name: 'Combo khám phá thức uống đa dạng, trải nghiệm hương vị mới (10 chai)',
      slug: '/combo?type=combo-van-phong',
      price: COMBO_02_PRICE,
      unit: `10 chai: ${summaryText}`,
      thumbnail: '/images/combos/combo-1.jpg',
    });

    setJustAdded(true);
    useCartStore.getState().openCart();
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div>
      {/* Header: Tiêu đề & Mức giá ưu đãi */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6 pb-2">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-sm mb-2">
            <span>Ưu đãi nhánh vị • Tự do phối 10 chai</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl text-forest-950 font-heading tracking-tight">
            Combo khám phá thức uống đa dạng, trải nghiệm hương vị mới gồm sữa hạt, nước giải khát và trà sữa (10 chai)
          </h1>
          <p className="text-text-muted text-sm md:text-[15px] mt-1.5 max-w-2xl">
            Thành phần tự nhiên, kết hợp hài hòa giữa dinh dưỡng từ hạt và sự thanh mát, phù hợp để dùng thử và khám phá đa dạng các dòng đồ uống.
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl md:text-4xl text-forest-950 font-heading">
              {formatPrice(COMBO_02_PRICE)}đ
            </span>
            <span className="text-sm md:text-base text-gray-400 line-through">
              {formatPrice(COMBO_02_ORIGINAL_PRICE)}đ
            </span>
          </div>
          <div className="inline-flex items-center gap-1 text-sm text-emerald-800 mt-0.5">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tiết kiệm {formatPrice(COMBO_02_ORIGINAL_PRICE - COMBO_02_PRICE)}đ (giảm 11%) so với giá bán lẻ</span>
          </div>
        </div>
      </div>

      {/* KHAY TỔNG KẾT 3 KHỐI: 5 CHAI CHỦ ĐẠO + 3 CHAI BỔ TRỢ + 2 CHAI TRÀ THẠCH */}
      <div className="bg-white rounded-3xl border border-gray-200/90 p-4 sm:p-6 shadow-xs mb-8">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl text-text-dark font-heading">
              Khay tổng kết Combo Khám Phá (Tổng 10 chai)
            </h2>
          </div>
          <span className="text-sm text-emerald-800">
            {isComplete ? '✓ Đã đủ 10 chai' : `Đã chọn: ${totalSelected}/10 chai (còn thiếu ${10 - totalSelected})`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Khối 1: 5 chai chủ đạo */}
          <div
            onClick={() => setCurrentStep(1)}
            className={cn(
              'relative rounded-2xl p-4 flex flex-col items-center text-center justify-between min-h-[180px] transition-all cursor-pointer select-none',
              currentStep === 1 && 'ring-2 ring-forest-800 shadow-sm',
              selectedStep1Obj
                ? 'border-2 border-forest-800 bg-ivory'
                : 'border-2 border-dashed border-gray-300 bg-gray-50/60 hover:border-gray-400'
            )}
          >
            <div className="flex items-center gap-1 absolute top-2.5 left-2.5">
              <span className="px-2 py-0.5 rounded-full bg-forest-800 text-white text-[12px]">
                1. Chủ đạo • 5 chai
              </span>
              {currentStep === 1 && (
                <span className="text-[11px] text-forest-800 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                  Đang chọn
                </span>
              )}
            </div>

            {selectedStep1Obj ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStep1(null);
                    setStep2(null);
                    setCurrentStep(1);
                  }}
                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-red-100 hover:bg-red-500 text-red-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Bỏ chọn món chủ đạo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="relative w-20 h-24 my-2">
                  <Image
                    src={selectedStep1Obj.image}
                    alt={selectedStep1Obj.name}
                    fill
                    className="object-contain"
                    sizes="90px"
                  />
                </div>
                <div>
                  <p className="text-base text-text-dark">
                    {selectedStep1Obj.name}
                  </p>
                  <span className="text-sm text-emerald-800">
                    5 chai x {formatPrice(selectedStep1Obj.unitPrice)}đ = {formatPrice(selectedStep1Obj.totalOriginal)}đ
                  </span>
                </div>
              </>
            ) : (
              <div className="my-auto py-6">
                <div className="w-10 h-10 rounded-full bg-gray-200/80 flex items-center justify-center text-gray-400 mx-auto mb-2">
                  <Plus className="w-5 h-5" />
                </div>
                <p className="text-sm text-gray-500">Chưa chọn món chủ đạo</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Bấm vào để chọn (5 chai)</p>
              </div>
            )}
          </div>

          {/* Khối 2: 3 chai bổ trợ */}
          <div
            onClick={() => setCurrentStep(2)}
            className={cn(
              'relative rounded-2xl p-4 flex flex-col items-center text-center justify-between min-h-[180px] transition-all cursor-pointer select-none',
              currentStep === 2 && 'ring-2 ring-amber-500 shadow-sm',
              selectedStep2Obj
                ? 'border-2 border-amber-500 bg-amber-50/30'
                : 'border-2 border-dashed border-gray-300 bg-gray-50/60 hover:border-gray-400'
            )}
          >
            <div className="flex items-center gap-1 absolute top-2.5 left-2.5">
              <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[12px]">
                2. Bổ trợ • 3 chai
              </span>
              {currentStep === 2 && (
                <span className="text-[11px] text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded-full">
                  Đang chọn
                </span>
              )}
            </div>

            {selectedStep2Obj ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStep2(null);
                    setCurrentStep(2);
                  }}
                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-red-100 hover:bg-red-500 text-red-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Bỏ chọn món bổ trợ"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="relative w-20 h-24 my-2">
                  <Image
                    src={selectedStep2Obj.image}
                    alt={selectedStep2Obj.name}
                    fill
                    className="object-contain"
                    sizes="90px"
                  />
                </div>
                <div>
                  <p className="text-base text-text-dark">
                    {selectedStep2Obj.name}
                  </p>
                  <span className="text-sm text-amber-800">
                    3 chai x {formatPrice(selectedStep2Obj.unitPrice)}đ = {formatPrice(selectedStep2Obj.totalOriginal)}đ
                  </span>
                </div>
              </>
            ) : (
              <div className="my-auto py-6">
                <div className="w-10 h-10 rounded-full bg-gray-200/80 flex items-center justify-center text-gray-400 mx-auto mb-2">
                  <Plus className="w-5 h-5" />
                </div>
                <p className="text-sm text-gray-500">Chưa chọn món bổ trợ</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {step1 ? 'Bấm vào để chọn (3 chai)' : 'Chọn bước 1 trước'}
                </p>
              </div>
            )}
          </div>

          {/* Khối 3: 2 chai trà thạch */}
          <div
            onClick={() => setCurrentStep(3)}
            className={cn(
              'relative rounded-2xl p-4 flex flex-col items-center text-center justify-between min-h-[180px] transition-all cursor-pointer select-none',
              currentStep === 3 && 'ring-2 ring-teal-600 shadow-sm',
              selectedStep3Obj
                ? 'border-2 border-teal-600 bg-teal-50/30'
                : 'border-2 border-dashed border-gray-300 bg-gray-50/60 hover:border-gray-400'
            )}
          >
            <div className="flex items-center gap-1 absolute top-2.5 left-2.5">
              <span className="px-2 py-0.5 rounded-full bg-teal-700 text-white text-[12px]">
                3. Trà thạch • 2 chai
              </span>
              {currentStep === 3 && (
                <span className="text-[11px] text-teal-800 bg-teal-100 px-1.5 py-0.2 rounded-full">
                  Đang chọn
                </span>
              )}
            </div>

            {selectedStep3Obj ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStep3(null);
                    setCurrentStep(3);
                  }}
                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-red-100 hover:bg-red-500 text-red-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Bỏ chọn trà thạch"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="relative w-20 h-24 my-2">
                  <Image
                    src={selectedStep3Obj.image}
                    alt={selectedStep3Obj.name}
                    fill
                    className="object-contain"
                    sizes="90px"
                  />
                </div>
                <div>
                  <p className="text-base text-text-dark">
                    {selectedStep3Obj.name}
                  </p>
                  <span className="text-sm text-teal-800">
                    2 chai x {formatPrice(selectedStep3Obj.unitPrice)}đ = {formatPrice(selectedStep3Obj.totalOriginal)}đ
                  </span>
                </div>
              </>
            ) : (
              <div className="my-auto py-6">
                <div className="w-10 h-10 rounded-full bg-gray-200/80 flex items-center justify-center text-gray-400 mx-auto mb-2">
                  <Plus className="w-5 h-5" />
                </div>
                <p className="text-sm text-gray-500">Chưa chọn trà thạch</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Bấm vào để chọn (2 chai)</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* THANH TAB CHUYỂN BƯỚC (1 -> 2 -> 3) */}
      <div
        ref={stepContainerRef}
        className="flex items-center gap-2 p-1.5 bg-gray-200/80 rounded-2xl max-w-xl mb-6 shadow-inner scroll-mt-24"
      >
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className={cn(
            'flex-1 py-2.5 px-3 rounded-xl text-sm sm:text-base transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer',
            currentStep === 1
              ? 'bg-forest-800 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 bg-transparent'
          )}
        >
          <span className={cn(
            'w-5 h-5 rounded-full text-[12px] flex items-center justify-center',
            currentStep === 1 ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
          )}>
            1
          </span>
          <span>5 Chai Chủ Đạo</span>
          {selectedStep1Obj && <Check className="w-3.5 h-3.5 text-emerald-300" />}
        </button>

        <button
          type="button"
          onClick={() => setCurrentStep(2)}
          className={cn(
            'flex-1 py-2.5 px-3 rounded-xl text-sm sm:text-base transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer',
            currentStep === 2
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 bg-transparent'
          )}
        >
          <span className={cn(
            'w-5 h-5 rounded-full text-[12px] flex items-center justify-center',
            currentStep === 2 ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
          )}>
            2
          </span>
          <span>3 Chai Bổ Trợ</span>
          {selectedStep2Obj && <Check className="w-3.5 h-3.5 text-amber-200" />}
        </button>

        <button
          type="button"
          onClick={() => setCurrentStep(3)}
          className={cn(
            'flex-1 py-2.5 px-3 rounded-xl text-sm sm:text-base transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer',
            currentStep === 3
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 bg-transparent'
          )}
        >
          <span className={cn(
            'w-5 h-5 rounded-full text-[12px] flex items-center justify-center',
            currentStep === 3 ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
          )}>
            3
          </span>
          <span>2 Chai Trà Thạch</span>
          {selectedStep3Obj && <Check className="w-3.5 h-3.5 text-teal-200" />}
        </button>
      </div>

      {/* NỘI DUNG TƯƠNG ỨNG VỚI TỪNG BƯỚC */}
      {currentStep === 1 && (
        /* ─── BƯỚC 1: CHỌN 5 CHAI CHỦ ĐẠO ─── */
        <div className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 shadow-xs mb-8 animate-fadeIn">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-forest-800" />
                <h3 className="text-lg sm:text-xl text-text-dark font-heading">
                  1. Chọn 5 chai chủ đạo (Chọn 1 trong 2 loại)
                </h3>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Nhấn chọn 1 loại bên dưới — Sau khi nhấn sẽ <strong className="text-[1.125em]">tự động chuyển sang Bước 2</strong>
              </p>
            </div>
            <span
              className={cn(
                'text-sm px-2.5 py-0.5 rounded-full',
                step1 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
              )}
            >
              {step1 ? '✓ Đã chọn 5 chai' : 'Bắt buộc chọn'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
            {STEP1_OPTIONS.map((item) => {
              const isSelected = step1 === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectStep1(item.id as 'sua-bap-nep' | 'nha-dam-mu-trom')}
                  className={cn(
                    'group p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative',
                    isSelected
                      ? 'border-forest-800 bg-ivory shadow-xs ring-1 ring-forest-800/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-2xs'
                  )}
                >
                  {item.badge && (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[12px]">
                      {item.badge}
                    </span>
                  )}

                  <div>
                    <div className="relative w-full aspect-square mb-2.5 bg-white rounded-xl p-2 flex items-center justify-center">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-contain p-1 transition-transform"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                    </div>
                    <h4 className="text-text-dark text-lg mb-1">
                      {item.name}
                    </h4>
                    <p className="text-xs text-text-muted mb-3">
                      {item.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-400 block">Đơn giá:</span>
                      <span className="text-base text-text-dark">
                        {formatPrice(item.unitPrice)}đ
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectStep1(item.id as 'sua-bap-nep' | 'nha-dam-mu-trom');
                      }}
                      className={cn(
                        'px-4 py-3 rounded-xl text-sm transition-all cursor-pointer',
                        isSelected
                          ? 'bg-forest-800 text-white'
                          : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                      )}
                    >
                      {isSelected ? 'Đã chọn' : 'Chọn 5 chai'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {step1 && (
            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm sm:text-base flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <span>Chuyển sang Bước 2: Chọn 3 chai bổ trợ</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {currentStep === 2 && (
        /* ─── BƯỚC 2: CHỌN 3 CHAI BỔ TRỢ ─── */
        <div className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 shadow-xs mb-8 animate-fadeIn">
          {step1 ? (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Đã chọn: <strong className="text-[1.125em]">{selectedStep1Obj?.name}</strong> (5 chai). Đang mở danh sách bổ trợ phù hợp nhất:
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-emerald-700 hover:text-emerald-900 underline shrink-0 cursor-pointer text-sm"
              >
                Đổi món chủ đạo
              </button>
            </div>
          ) : (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs sm:text-sm text-amber-900">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Bạn chưa chọn 5 chai chủ đạo ở Bước 1:</span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-2.5 py-1 bg-forest-800 text-white rounded-lg text-sm shrink-0 cursor-pointer"
              >
                ← Chọn Bước 1 trước
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                <h3 className="text-lg sm:text-xl text-text-dark font-heading">
                  2. Chọn 3 chai bổ trợ ({step1 === 'sua-bap-nep' ? 'Nhánh Thảo Mộc Thanh Mát' : 'Nhánh Sữa Hạt Mekong Xanh'})
                </h3>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Nhấn chọn 1 loại bên dưới — Sau khi nhấn sẽ <strong className="text-[1.125em]">tự động chuyển sang Bước 3</strong>
              </p>
            </div>
            <span
              className={cn(
                'text-sm px-2.5 py-0.5 rounded-full',
                step2 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
              )}
            >
              {step2 ? '✓ Đã chọn 3 chai' : 'Bắt buộc chọn'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
            {currentStep2Options.map((item) => {
              const isSelected = step2 === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectStep2(item.id)}
                  className={cn(
                    'group p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative',
                    isSelected
                      ? 'border-amber-500 bg-amber-50/40 shadow-xs ring-1 ring-amber-500/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-2xs'
                  )}
                >
                  {item.badge && (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[12px]">
                      {item.badge}
                    </span>
                  )}

                  <div>
                    <div className="relative w-full aspect-square mb-2.5 bg-white rounded-xl p-2 flex items-center justify-center">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-contain p-1 transition-transform"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                    </div>
                    <h4 className="text-text-dark text-lg mb-1">
                      {item.name}
                    </h4>
                    <p className="text-xs text-text-muted mb-3">
                      {item.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-400 block">Đơn giá:</span>
                      <span className="text-base text-text-dark">
                        {formatPrice(item.unitPrice)}đ
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectStep2(item.id);
                      }}
                      className={cn(
                        'px-4 py-2 rounded-xl text-sm transition-all cursor-pointer',
                        isSelected
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                      )}
                    >
                      {isSelected ? 'Đã chọn' : 'Chọn 3 chai'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-gray-600 hover:text-gray-900 text-sm sm:text-base flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại Bước 1: Món chủ đạo</span>
            </button>

            {step2 && (
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm sm:text-base flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <span>Chuyển sang Bước 3: Chọn 2 chai trà thạch</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {currentStep === 3 && (
        /* ─── BƯỚC 3: CHỌN 2 CHAI TRÀ THẠCH ─── */
        <div className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 shadow-xs mb-8 animate-fadeIn">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-700" />
                <h3 className="text-lg sm:text-xl text-text-dark font-heading">
                  3. Chọn 2 chai trà thạch (Chọn 1 trong 2 loại)
                </h3>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Dòng trà thạch thanh mát, topping thạch dai giòn sảng khoái hoàn thiện combo 10 chai
              </p>
            </div>
            <span
              className={cn(
                'text-sm px-2.5 py-0.5 rounded-full',
                step3 ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-500'
              )}
            >
              {step3 ? '✓ Đã chọn 2 chai' : 'Bắt buộc chọn'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
            {STEP3_OPTIONS.map((item) => {
              const isSelected = step3 === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectStep3(item.id as 'tra-sua-go' | 'tra-xanh-go')}
                  className={cn(
                    'group p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative',
                    isSelected
                      ? 'border-teal-600 bg-teal-50/40 shadow-xs ring-1 ring-teal-600/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-2xs'
                  )}
                >
                  {item.badge && (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[12px]">
                      {item.badge}
                    </span>
                  )}

                  <div>
                    <div className="relative w-full aspect-square mb-2.5 bg-white rounded-xl p-2 flex items-center justify-center">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-contain p-1 transition-transform"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                    </div>
                    <h4 className="text-text-dark text-lg mb-1">
                      {item.name}
                    </h4>
                    <p className="text-xs text-text-muted mb-3">
                      {item.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-400 block">Đơn giá:</span>
                      <span className="text-base text-text-dark">
                        {formatPrice(item.unitPrice)}đ
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectStep3(item.id as 'tra-sua-go' | 'tra-xanh-go');
                      }}
                      className={cn(
                        'px-4 py-2 rounded-xl text-sm transition-all cursor-pointer',
                        isSelected
                          ? 'bg-teal-700 text-white'
                          : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                      )}
                    >
                      {isSelected ? 'Đã chọn' : 'Chọn 2 chai'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="text-gray-600 hover:text-gray-900 text-sm sm:text-base flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại Bước 2: Món bổ trợ</span>
            </button>

            {isComplete && (
              <span className="text-sm text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                ✓ Đã hoàn tất 10 chai! Bạn có thể thêm vào giỏ hàng bên dưới.
              </span>
            )}
          </div>
        </div>
      )}

      {/* THANH TỔNG KẾT VÀ NÚT THÊM GIỎ HÀNG DƯỚI CÙNG CHO COMBO 02 */}
      <div className="fixed bottom-0 left-0 right-0 min-[1440px]:right-[380px] z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 px-4 py-3 sm:py-4 shadow-xl">
        <div className="section-container max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-2xl text-forest-950 font-heading">
                  {formatPrice(COMBO_02_PRICE)}đ
                </span>
                <span className="text-xs text-gray-400 line-through">
                  {formatPrice(COMBO_02_ORIGINAL_PRICE)}đ
                </span>
                <span className="text-[12px] text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                  Tiết kiệm 20.000đ
                </span>
              </div>
              <span className="text-sm text-emerald-800">
                {isComplete
                  ? `Đã chọn: 5 ${selectedStep1Obj?.name} + 3 ${selectedStep2Obj?.name} + 2 ${selectedStep3Obj?.name} (10 chai)`
                  : `Vui lòng chọn đủ 10 chai (Đã chọn: ${totalSelected}/10)`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {!isComplete && (
              <div className="hidden sm:flex items-center gap-1 px-3.5 py-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-sm shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                {!step1 ? 'Chưa chọn món chủ đạo' : !step2 ? 'Chưa chọn món bổ trợ' : 'Chưa chọn trà thạch'}
              </div>
            )}

            {!ENABLE_CUSTOM_COMBOS ? <CustomComboPausedNotice /> : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!isComplete}
              className={cn(
                'w-full sm:w-auto px-6 sm:px-8 py-3 rounded-2xl text-base sm:text-lg flex items-center justify-center gap-2 transition-all shadow-md',
                isComplete
                  ? 'bg-gradient-to-r from-emerald-800 to-forest-800 text-white hover:opacity-95 active:scale-95 cursor-pointer shadow-emerald-700/20'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              )}
            >
              {justAdded ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  Đã thêm Combo Khám Phá vào giỏ!
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  Thêm vào giỏ hàng ({formatPrice(COMBO_02_PRICE)}đ)
                </>
              )}
            </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// CẤU HÌNH & COMPONENT COMBO 05 (MUA 10A + 5B TẶNG 2B)
// ==========================================
// Tất cả mã trừ SS (sua-hat-sen-lotus) và SL (sua-gao-lut-ohsawa)
const EXCLUDED_COMBO_05_IDS = new Set(['sua-hat-sen-lotus', 'sua-gao-lut-ohsawa']);

function Combo05View() {
  const { flyToCart } = useFlyToCart();
  const stepContainerRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState<'A' | 'B'>('A');
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  // Danh sách sản phẩm hợp lệ: tất cả trừ SS (sua-hat-sen-lotus) và SL (sua-gao-lut-ohsawa)
  const availableProducts = useMemo(() => {
    return products.filter((p) => p.isActive && !EXCLUDED_COMBO_05_IDS.has(p.id));
  }, []);

  const prodA = useMemo(
    () => availableProducts.find((p) => p.id === selectedA) || null,
    [selectedA, availableProducts]
  );

  const prodB = useMemo(
    () => availableProducts.find((p) => p.id === selectedB) || null,
    [selectedB, availableProducts]
  );

  // Tính giá
  const priceA = prodA ? prodA.price : 18000;
  const priceB = prodB ? prodB.price : 18000;

  // Khách hàng trả tiền cho 10A + 5B
  const comboPrice = priceA * 10 + priceB * 5;

  // Tổng giá trị thực tế nhận được (10A + 7B)
  const marketPrice = priceA * 10 + priceB * 7;

  // Tiết kiệm giá trị 2 chai B tặng miễn phí
  const savings = priceB * 2;

  const isComplete = Boolean(selectedA && selectedB);

  // Khi nhấn chọn sản phẩm A -> lưu A và TỰ ĐỘNG NHẢY QUA TAB B ĐỂ CHỌN B LUÔN
  const handleSelectA = (id: string) => {
    setSelectedA(id);
    if (selectedB === id) {
      setSelectedB(null);
    }
    // Tự động nhảy tab qua và chọn được B luôn
    setCurrentStep('B');

    // Cuộn mượt đến đầu khu vực chọn sản phẩm B để người dùng thấy rõ và thao tác chọn ngay
    setTimeout(() => {
      if (stepContainerRef.current) {
        stepContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleSelectB = (id: string) => {
    setSelectedB(id);
  };

  const handleAddToCart = () => {
    if (!ENABLE_CUSTOM_COMBOS) return;
    if (!prodA || !prodB) return;

    const nameA = prodA.name;
    const nameB = prodB.name;

    useCartStore.getState().addItem({
      productId: `combo-5-${prodA.id}_10-${prodB.id}_5_plus2`,
      name: `Combo Siêu Hời (${nameA} + ${nameB})`,
      slug: '/combo?type=combo-5',
      price: comboPrice,
      unit: `17 chai (10 ${nameA} + 5 ${nameB} + 2 ${nameB} tặng)`,
      thumbnail: '/images/combos/combo-2.jpg',
    });

    setJustAdded(true);
    useCartStore.getState().openCart();
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div>
      {/* Header: Tiêu đề & Giá bán */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6 pb-2">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-sm mb-2">
            <span>Ưu đãi siêu hời • Mua 15 Tặng 2</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl text-forest-950 font-heading tracking-tight">
            Combo siêu hời tiết kiệm, tích trữ thông minh cho gia đình (17 chai)
          </h1>
          <p className="text-text-muted text-sm md:text-[15px] mt-1.5 max-w-2xl">
            Gồm 10 chai cùng loại + 5 chai sản phẩm khác, tặng thêm 2 chai. Lựa chọn hoàn hảo để dự trữ trong tủ lạnh cho nhu cầu sử dụng thường xuyên.
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl md:text-4xl text-forest-950 font-heading">
              {formatPrice(comboPrice)}đ
            </span>
            <span className="text-sm md:text-base text-gray-400 line-through">
              {formatPrice(marketPrice)}đ
            </span>
          </div>
          <div className="inline-flex items-center gap-1 text-sm text-emerald-800 mt-0.5">
            <span>Tặng 2 chai B trị giá {formatPrice(savings)}đ (Tổng nhận 17 chai)</span>
          </div>
        </div>
      </div>

      {/* KHAY TỔNG QUAN 3 KHỐI: SẢN PHẨM A (10) + SẢN PHẨM B (5) + QUÀ TẶNG B (2) */}
      <div className="bg-white rounded-3xl border border-gray-200/90 p-4 sm:p-6 shadow-xs mb-8">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl text-text-dark font-heading">
              Khay tổng kết Combo Siêu Hời (Tổng nhận 17 chai)
            </h2>
          </div>
          <span className="text-sm text-emerald-800">
            {isComplete ? '✓ Đã hoàn tất chọn' : 'Vui lòng chọn đủ A và B'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Khối 1: Sản phẩm A (10 chai) — Bấm vào để mở tab A */}
          <div
            onClick={() => setCurrentStep('A')}
            className={cn(
              'relative rounded-2xl p-4 flex flex-col items-center text-center justify-between min-h-[180px] transition-all cursor-pointer select-none',
              currentStep === 'A' && 'ring-2 ring-forest-800 shadow-sm',
              prodA
                ? 'border-2 border-forest-800 bg-ivory'
                : 'border-2 border-dashed border-gray-300 bg-gray-50/60 hover:border-gray-400'
            )}
          >
            <div className="flex items-center gap-1 absolute top-2.5 left-2.5">
              <span className="px-2 py-0.5 rounded-full bg-forest-800 text-white text-[12px]">
                1. Sản phẩm A • 10 chai
              </span>
              {currentStep === 'A' && (
                <span className="text-[11px] text-forest-800 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                  Đang chọn
                </span>
              )}
            </div>

            {prodA ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedA(null);
                    setCurrentStep('A');
                  }}
                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-red-100 hover:bg-red-500 text-red-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Bỏ chọn A"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="relative w-20 h-24 my-2">
                  <Image
                    src={prodA.thumbnail}
                    alt={prodA.name}
                    fill
                    className="object-contain"
                    sizes="90px"
                  />
                </div>
                <div>
                  <p className="text-base text-text-dark">
                    {prodA.name}
                  </p>
                  <span className="text-sm text-emerald-800">
                    10 chai x {formatPrice(prodA.price)}đ = {formatPrice(prodA.price * 10)}đ
                  </span>
                </div>
              </>
            ) : (
              <div className="my-auto py-6">
                <div className="w-10 h-10 rounded-full bg-gray-200/80 flex items-center justify-center text-gray-400 mx-auto mb-2">
                  <Plus className="w-5 h-5" />
                </div>
                <p className="text-sm text-gray-500">Chưa chọn sản phẩm A</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Bấm vào để chọn (10 chai)</p>
              </div>
            )}
          </div>

          {/* Khối 2: Sản phẩm B (5 chai) — Bấm vào để mở tab B */}
          <div
            onClick={() => setCurrentStep('B')}
            className={cn(
              'relative rounded-2xl p-4 flex flex-col items-center text-center justify-between min-h-[180px] transition-all cursor-pointer select-none',
              currentStep === 'B' && 'ring-2 ring-teal-700 shadow-sm',
              prodB
                ? 'border-2 border-teal-700 bg-teal-50/30'
                : 'border-2 border-dashed border-gray-300 bg-gray-50/60 hover:border-gray-400'
            )}
          >
            <div className="flex items-center gap-1 absolute top-2.5 left-2.5">
              <span className="px-2 py-0.5 rounded-full bg-teal-700 text-white text-[12px]">
                2. Sản phẩm B • 5 chai
              </span>
              {currentStep === 'B' && (
                <span className="text-[11px] text-teal-800 bg-teal-100 px-1.5 py-0.2 rounded-full">
                  Đang chọn
                </span>
              )}
            </div>

            {prodB ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedB(null);
                    setCurrentStep('B');
                  }}
                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-red-100 hover:bg-red-500 text-red-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Bỏ chọn B"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="relative w-20 h-24 my-2">
                  <Image
                    src={prodB.thumbnail}
                    alt={prodB.name}
                    fill
                    className="object-contain"
                    sizes="90px"
                  />
                </div>
                <div>
                  <p className="text-base text-text-dark">
                    {prodB.name}
                  </p>
                  <span className="text-sm text-teal-800">
                    5 chai x {formatPrice(prodB.price)}đ = {formatPrice(prodB.price * 5)}đ
                  </span>
                </div>
              </>
            ) : (
              <div className="my-auto py-6">
                <div className="w-10 h-10 rounded-full bg-gray-200/80 flex items-center justify-center text-gray-400 mx-auto mb-2">
                  <Plus className="w-5 h-5" />
                </div>
                <p className="text-sm text-gray-500">Chưa chọn sản phẩm B</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Bấm vào để chọn (5 chai)</p>
              </div>
            )}
          </div>

          {/* Khối 3: Quà tặng 2 chai B (0đ) — Bấm vào để mở tab B */}
          <div
            onClick={() => setCurrentStep('B')}
            className={cn(
              'relative rounded-2xl p-4 flex flex-col items-center text-center justify-between min-h-[180px] border-2 transition-all cursor-pointer select-none',
              currentStep === 'B' && 'ring-2 ring-amber-400 shadow-sm',
              prodB
                ? 'border-amber-400 bg-gradient-to-b from-amber-50 to-amber-100/50 shadow-xs'
                : 'border-dashed border-amber-300 bg-amber-50/30 hover:border-amber-400'
            )}
          >
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-ink-950 text-[12px] shadow-xs">
              <span>TẶNG THÊM 2 CHAI B</span>
            </div>

            {prodB ? (
              <>
                <div className="relative w-20 h-24 my-2">
                  <Image
                    src={prodB.thumbnail}
                    alt={prodB.name}
                    fill
                    className="object-contain"
                    sizes="90px"
                  />
                  <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-sale text-white text-[11px] shadow-xs">
                    x2 chai
                  </span>
                </div>
                <div>
                  <p className="text-base text-amber-950">
                    {prodB.name}
                  </p>
                  <span className="text-sm text-sale bg-sale/10 px-2 py-0.5 rounded-full">
                    Miễn phí 100% (Tiết kiệm {formatPrice(prodB.price * 2)}đ)
                  </span>
                </div>
              </>
            ) : (
              <div className="my-auto py-6">
                <p className="text-sm text-amber-900">Quà tặng 2 chai B (0đ)</p>
                <p className="text-[11px] text-amber-700/80 mt-0.5">Tự động tặng khi bạn chọn sản phẩm B</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* THANH TAB CHUYỂN BƯỚC SẢN PHẨM A ↔ SẢN PHẨM B */}
      <div
        ref={stepContainerRef}
        className="flex items-center gap-2 p-1.5 bg-gray-200/80 rounded-2xl max-w-md mb-6 shadow-inner scroll-mt-24"
      >
        <button
          type="button"
          onClick={() => setCurrentStep('A')}
          className={cn(
            'flex-1 py-2.5 px-3 rounded-xl text-sm sm:text-base transition-all text-center flex items-center justify-center gap-2 cursor-pointer',
            currentStep === 'A'
              ? 'bg-forest-800 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 bg-transparent'
          )}
        >
          <span className={cn(
            'w-5 h-5 rounded-full text-[12px] flex items-center justify-center',
            currentStep === 'A' ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
          )}>
            1
          </span>
          <span>Sản phẩm A (10 chai)</span>
          {prodA && <Check className="w-3.5 h-3.5 text-emerald-300" />}
        </button>

        <button
          type="button"
          onClick={() => setCurrentStep('B')}
          className={cn(
            'flex-1 py-2.5 px-3 rounded-xl text-sm sm:text-base transition-all text-center flex items-center justify-center gap-2 cursor-pointer',
            currentStep === 'B'
              ? 'bg-amber-500 text-ink-950 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 bg-transparent'
          )}
        >
          <span className={cn(
            'w-5 h-5 rounded-full text-[12px] flex items-center justify-center',
            currentStep === 'B' ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
          )}>
            2
          </span>
          <span>Sản phẩm B (5+2 tặng)</span>
          {prodB && <Check className="w-3.5 h-3.5 text-amber-200" />}
        </button>
      </div>

      {/* NỘI DUNG TƯƠNG ỨNG VỚI TAB A HOẶC TAB B */}
      {currentStep === 'A' ? (
        /* ─── TAB 1: CHỌN SẢN PHẨM A (10 CHAI) ─── */
        <div className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 shadow-xs mb-8 animate-fadeIn">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-forest-800" />
                <h3 className="text-lg sm:text-xl text-text-dark font-heading">
                  1. Chọn sản phẩm A (Mua 10 chai)
                </h3>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Nhấn chọn 1 thức uống bên dưới — Sau khi nhấn xong sẽ <strong className="text-[1.125em]">tự động chuyển tab qua chọn sản phẩm B ngay</strong>
              </p>
            </div>
            <span
              className={cn(
                'text-sm px-2.5 py-0.5 rounded-full',
                prodA ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
              )}
            >
              {prodA ? '✓ Đã chọn 10 chai' : 'Bắt buộc chọn'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {availableProducts.map((prod) => {
              const isSelected = selectedA === prod.id;
              return (
                <div
                  key={`a-${prod.id}`}
                  onClick={() => handleSelectA(prod.id)}
                  className={cn(
                    'group p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative',
                    isSelected
                      ? 'border-forest-800 bg-ivory shadow-xs ring-1 ring-forest-800/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-2xs'
                  )}
                >
                  {isSelected && (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-forest-800 text-white text-[12px] shadow-xs">
                      ✓ Đang chọn 10 chai
                    </span>
                  )}

                  <div>
                    <div className="relative w-full aspect-square mb-2.5 bg-white rounded-xl p-2 flex items-center justify-center">
                      <Image
                        src={prod.thumbnail}
                        alt={prod.name}
                        fill
                        className="object-contain p-1 transition-transform"
                        sizes="(max-width: 640px) 100vw, 25vw"
                      />
                    </div>
                    <h4 className="text-text-dark text-base mb-0.5">
                      {prod.name}
                    </h4>
                    <p className="text-[11px] text-text-muted mb-2">
                      {PRODUCT_SUBTITLES[prod.id] || prod.volume || '330ml'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-400 block">Đơn giá:</span>
                      <span className="text-base text-text-dark">
                        {formatPrice(prod.price)}đ
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectA(prod.id);
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-sm transition-all cursor-pointer',
                        isSelected
                          ? 'bg-forest-800 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      {isSelected ? 'Đã chọn' : 'Chọn 10 chai'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nút chuyển tiếp nhanh nếu đã chọn A */}
          {prodA && (
            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep('B')}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-ink-950 text-sm sm:text-base flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <span>Chuyển sang Bước 2: Chọn sản phẩm B (Tặng 2 chai)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ─── TAB 2: CHỌN SẢN PHẨM B (MUA 5 CHAI — TẶNG 2 CHAI) ─── */
        <div className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 shadow-xs mb-8 animate-fadeIn">
          {/* Thông báo hướng dẫn & nút quay lại A nếu cần */}
          {prodA ? (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Đã chọn A: <strong className="text-[1.125em]">{prodA.name}</strong> (10 chai). Giờ hãy chọn <strong className="text-[1.125em]">sản phẩm B</strong> bên dưới để nhận thêm 2 chai B miễn phí!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep('A')}
                className="text-emerald-700 hover:text-emerald-900 underline shrink-0 cursor-pointer text-sm"
              >
                Đổi sản phẩm A
              </button>
            </div>
          ) : (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs sm:text-sm text-amber-900">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Bạn chưa chọn sản phẩm A. Bạn có thể chọn B trước hoặc quay lại bước 1:</span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep('A')}
                className="px-2.5 py-1 bg-forest-800 text-white rounded-lg text-sm shrink-0 cursor-pointer"
              >
                ← Chọn A trước
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h3 className="text-lg sm:text-xl text-text-dark font-heading">
                  2. Chọn sản phẩm B (Mua 5 chai — TẶNG THÊM 2 CHAI B)
                </h3>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Chọn thức uống khác với sản phẩm A (áp dụng các dòng chai 330ml, trừ dòng chai lớn Lotus Yoo và Ohsawa Yoo 568ml) • Nhận tổng cộng 7 chai B
              </p>
            </div>
            <span
              className={cn(
                'text-sm px-2.5 py-0.5 rounded-full',
                prodB ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
              )}
            >
              {prodB ? '✓ Đã chọn 5 + 2 tặng' : 'Bắt buộc chọn'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {availableProducts.map((prod) => {
              const isSameAsA = selectedA === prod.id;
              const isSelected = selectedB === prod.id;

              return (
                <div
                  key={`b-${prod.id}`}
                  onClick={() => {
                    if (!isSameAsA) handleSelectB(prod.id);
                  }}
                  className={cn(
                    'group p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between relative',
                    isSameAsA && 'opacity-40 bg-gray-100 cursor-not-allowed border-gray-200',
                    !isSameAsA && isSelected && 'border-amber-400 bg-amber-50/40 shadow-xs ring-1 ring-amber-400/30 cursor-pointer',
                    !isSameAsA && !isSelected && 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-2xs cursor-pointer'
                  )}
                >
                  {/* Badge trạng thái */}
                  {isSameAsA ? (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-[11px]">
                      Trùng với A
                    </span>
                  ) : isSelected ? (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-amber-500 text-ink-950 text-[11px] shadow-xs">
                      ✓ Đã chọn (5+2 tặng)
                    </span>
                  ) : (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px]">
                      Tặng thêm 2
                    </span>
                  )}

                  <div>
                    <div className="relative w-full aspect-square mb-2.5 bg-white rounded-xl p-2 flex items-center justify-center">
                      <Image
                        src={prod.thumbnail}
                        alt={prod.name}
                        fill
                        className="object-contain p-1 transition-transform"
                        sizes="(max-width: 640px) 100vw, 25vw"
                      />
                    </div>
                    <h4 className="text-text-dark text-base mb-0.5">
                      {prod.name}
                    </h4>
                    <p className="text-[11px] text-text-muted mb-2">
                      {PRODUCT_SUBTITLES[prod.id] || prod.volume || '330ml'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-400 block">Đơn giá:</span>
                      <span className="text-base text-text-dark">
                        {formatPrice(prod.price)}đ
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isSameAsA}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isSameAsA) handleSelectB(prod.id);
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-sm transition-all',
                        isSameAsA
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : isSelected
                          ? 'bg-amber-500 text-ink-950 cursor-pointer'
                          : 'bg-amber-100 text-amber-900 hover:bg-amber-200 cursor-pointer'
                      )}
                    >
                      {isSameAsA ? 'Đã chọn ở A' : isSelected ? 'Đã chọn' : 'Chọn 5 (+2 tặng)'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
            <button
              type="button"
              onClick={() => setCurrentStep('A')}
              className="text-gray-600 hover:text-gray-900 text-sm sm:text-base flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại đổi sản phẩm A</span>
            </button>

            {isComplete && (
              <span className="text-sm text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                ✓ Đã hoàn tất 17 chai! Bạn có thể thêm vào giỏ hàng bên dưới.
              </span>
            )}
          </div>
        </div>
      )}

      {/* THANH TỔNG KẾT VÀ NÚT THÊM GIỎ HÀNG DƯỚI CÙNG CHO COMBO 05 */}
      <div className="fixed bottom-0 left-0 right-0 min-[1440px]:right-[380px] z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 px-4 py-3 sm:py-4 shadow-xl">
        <div className="section-container max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-2xl text-forest-950 font-heading">
                  {formatPrice(comboPrice)}đ
                </span>
                <span className="text-xs text-gray-400 line-through">
                  {formatPrice(marketPrice)}đ
                </span>
                <span className="text-[12px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                  Tặng 2 chai
                </span>
              </div>
              <span className="text-sm text-emerald-800">
                {isComplete
                  ? `Đã chọn: 10 ${prodA?.name} + 7 ${prodB?.name} (17 chai)`
                  : 'Vui lòng chọn đủ sản phẩm A và B'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {!isComplete && (
              <div className="hidden sm:flex items-center gap-1 px-3.5 py-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-sm shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                {!selectedA ? 'Chưa chọn sản phẩm A' : 'Chưa chọn sản phẩm B'}
              </div>
            )}

            {!ENABLE_CUSTOM_COMBOS ? <CustomComboPausedNotice /> : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!isComplete}
              className={cn(
                'w-full sm:w-auto px-6 sm:px-8 py-3 rounded-2xl text-base sm:text-lg flex items-center justify-center gap-2 transition-all shadow-md',
                isComplete
                  ? 'bg-gradient-to-r from-amber-600 to-forest-800 text-white hover:opacity-95 active:scale-95 cursor-pointer shadow-emerald-700/20'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              )}
            >
              {justAdded ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  Đã thêm Combo Siêu Hời vào giỏ!
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  Thêm vào giỏ hàng ({formatPrice(comboPrice)}đ)
                </>
              )}
            </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// CẤU HÌNH COMBO 06 (GIÁ GIẢM BẬC THANG 20 - 30 CHAI)
// Tất cả sản phẩm trừ Trà Sữa Ciao, Matcha Trà Sữa Ciao, Sữa Gạo Lứt Ohsawa Yoo, Sữa Hạt Sen Lotus Yoo
// Mua 10 chai đầu giá 18k, 10 chai tiếp giá 15k, 10 chai tiếp giá 12k (cùng loại)
// Có tùy chọn mua 20 chai hoặc 30 chai (không khóa lựa chọn này)
// ==========================================
const EXCLUDED_COMBO_06_IDS = new Set([
  'tra-sua-ciao',
  'matcha-tra-sua-ciao',
  'sua-gao-lut-ohsawa',
  'sua-hat-sen-lotus',
]);

function Combo06View() {
  const { flyToCart } = useFlyToCart();
  const stepContainerRef = useRef<HTMLDivElement>(null);
  const [packageSize, setPackageSize] = useState<20 | 30>(20);
  const [isSameFlavor, setIsSameFlavor] = useState<boolean>(true);
  const [activeSlot, setActiveSlot] = useState<1 | 2 | 3>(1);
  const [slot1, setSlot1] = useState<string>('sua-bap-nep');
  const [slot2, setSlot2] = useState<string>('sua-bap-nep');
  const [slot3, setSlot3] = useState<string>('sua-bap-nep');
  const [justAdded, setJustAdded] = useState(false);

  // 8 sản phẩm hợp lệ (trừ Ciao và Yoo Milk)
  const availableProducts = useMemo(() => {
    return products.filter((p) => p.isActive && !EXCLUDED_COMBO_06_IDS.has(p.id));
  }, []);

  const prod1 = useMemo(
    () => availableProducts.find((p) => p.id === slot1) || availableProducts[0],
    [slot1, availableProducts]
  );
  const prod2 = useMemo(
    () => availableProducts.find((p) => p.id === slot2) || availableProducts[0],
    [slot2, availableProducts]
  );
  const prod3 = useMemo(
    () => availableProducts.find((p) => p.id === slot3) || availableProducts[0],
    [slot3, availableProducts]
  );

  // Tính giá bậc thang:
  // Gói 20 chai: 10 chai đầu (18k) + 10 chai tiếp (15k) = 180k + 150k = 330k
  // Gói 30 chai: 10 chai đầu (18k) + 10 chai tiếp (15k) + 10 chai tiếp (12k) = 180k + 150k + 120k = 450k
  const comboPrice = packageSize === 20 ? 330000 : 450000;
  const marketPrice = packageSize === 20 ? 360000 : 540000;
  const savings = marketPrice - comboPrice; // 30.000đ cho gói 20, 90.000đ cho gói 30
  const avgPricePerBottle = Math.round(comboPrice / packageSize); // 16.500đ hoặc 15.000đ

  // Xử lý khi bấm chọn 1 sản phẩm & TỰ ĐỘNG CHUYỂN ĐỢT TIẾP THEO
  const handleSelectProduct = (productId: string) => {
    if (isSameFlavor) {
      setSlot1(productId);
      setSlot2(productId);
      setSlot3(productId);
    } else {
      if (activeSlot === 1) {
        setSlot1(productId);
        setActiveSlot(2);
      } else if (activeSlot === 2) {
        setSlot2(productId);
        if (packageSize === 30) {
          setActiveSlot(3);
        }
      } else {
        setSlot3(productId);
      }
      setTimeout(() => {
        if (stepContainerRef.current) {
          stepContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  };

  const handleAddToCart = () => {
    if (!ENABLE_CUSTOM_COMBOS) return;
    const name1 = prod1.name;
    const name2 = prod2.name;
    const name3 = prod3.name;

    let comboTitle = `Combo Giảm Giá Bậc Thang: ${packageSize} Chai (${name1})`;
    let unitDesc = `${packageSize} chai (${name1})`;

    if (isSameFlavor) {
      comboTitle = `Combo Giảm Giá Bậc Thang: ${packageSize} Chai (${name1})`;
      unitDesc = packageSize === 20 
        ? `20 chai ${name1} (10 chai x 18.000đ + 10 chai x 15.000đ)`
        : `30 chai ${name1} (10 chai x 18.000đ + 10 chai x 15.000đ + 10 chai x 12.000đ)`;
    } else {
      if (packageSize === 20) {
        comboTitle = `Combo Giảm Giá Bậc Thang: 20 Chai (${name1} + ${name2})`;
        unitDesc = `20 chai (10 chai ${name1} x 18.000đ + 10 chai ${name2} x 15.000đ)`;
      } else {
        comboTitle = `Combo Giảm Giá Bậc Thang: 30 Chai (${name1} + ${name2} + ${name3})`;
        unitDesc = `30 chai (10 chai ${name1} x 18.000đ + 10 chai ${name2} x 15.000đ + 10 chai ${name3} x 12.000đ)`;
      }
    }

    useCartStore.getState().addItem({
      productId: `combo-6-${slot1}_${slot2}_${packageSize === 30 ? slot3 : 'none'}_${packageSize}`,
      name: comboTitle,
      slug: '/combo?type=combo-6',
      price: comboPrice,
      unit: unitDesc,
      thumbnail: prod1.thumbnail || '/images/combos/combo-3.jpg',
    });

    setJustAdded(true);
    useCartStore.getState().openCart();
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div>
      {/* Header: Tiêu đề & Mức giá ưu đãi */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6 pb-2">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-sm mb-2">
            <span>Ưu đãi bậc thang • Càng mua nhiều giảm càng sâu</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl text-forest-950 font-heading tracking-tight">
            Combo giảm giá bậc thang mua nhiều giảm sâu, tùy chọn hương vị theo sở thích của mình
          </h1>
          <p className="text-text-muted text-sm md:text-[15px] mt-1.5 max-w-2xl">
            Gói ưu đãi thiết kế theo 3 mức giá khác nhau (10 chai giá 18.000đ, 10 chai sau giá 15.000đ, 10 chai tiếp giá 12.000đ)
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl md:text-4xl text-forest-950 font-heading">
              {formatPrice(comboPrice)}đ
            </span>
            <span className="text-sm md:text-base text-gray-400 line-through">
              {formatPrice(marketPrice)}đ
            </span>
          </div>
          <div className="inline-flex items-center gap-1 text-sm text-emerald-800 mt-0.5">
            <span>
              Tiết kiệm ngay {formatPrice(savings)}đ (Chỉ ~{formatPrice(avgPricePerBottle)}đ/chai)
            </span>
          </div>
        </div>
      </div>

      {/* BƯỚC 1: TÙY CHỌN SỐ LƯỢNG (20 CHAI HOẶC 30 CHAI) */}
      <div className="bg-white rounded-3xl border border-gray-200/90 p-4 sm:p-6 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-forest-800 text-white text-sm flex items-center justify-center">
              1
            </span>
            <h2 className="text-lg sm:text-xl text-text-dark font-heading">
              Chọn gói số lượng (Không khóa • Tự do chọn 20 chai hoặc 30 chai)
            </h2>
          </div>
          <span className="text-xs font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
            ✓ Bấm chọn gói bất kỳ lúc nào để cập nhật giá
          </span>
        </div>

        {/* 2 Card chọn gói 20 chai và 30 chai */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gói 20 chai */}
          <div
            onClick={() => setPackageSize(20)}
            className={cn(
              'group relative rounded-2xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between select-none',
              packageSize === 20
                ? 'border-forest-800 bg-ivory shadow-md ring-2 ring-forest-800/20'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-xs'
            )}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                    packageSize === 20
                      ? 'border-forest-800 bg-forest-800 text-white'
                      : 'border-gray-300 bg-white'
                  )}>
                    {packageSize === 20 && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <h3 className="text-xl text-text-dark">
                    Gói 20 chai
                  </h3>
                </div>
                <p className="text-xs text-text-muted mt-1 ml-7">
                  10 chai đầu x 18.000đ + 10 chai tiếp theo x 15.000đ
                </p>
              </div>

              <span className="text-sm text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full shrink-0">
                Tiết kiệm 30.000đ
              </span>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-baseline justify-between mt-2">
              <span className="text-xs text-text-muted">
                Giá trung bình: <strong className="text-emerald-800 text-[1.125em]">16.500đ/chai</strong>
              </span>
              <div className="text-right">
                <span className="text-xs text-gray-400 line-through mr-1.5">360.000đ</span>
                <span className="text-2xl text-forest-950 font-heading">
                  330.000đ
                </span>
              </div>
            </div>
          </div>

          {/* Gói 30 chai */}
          <div
            onClick={() => setPackageSize(30)}
            className={cn(
              'group relative rounded-2xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between select-none',
              packageSize === 30
                ? 'border-amber-500 bg-amber-50/30 shadow-md ring-2 ring-amber-500/30'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-xs'
            )}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                    packageSize === 30
                      ? 'border-amber-500 bg-amber-500 text-ink-950'
                      : 'border-gray-300 bg-white'
                  )}>
                    {packageSize === 30 && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <h3 className="text-xl text-text-dark flex items-center gap-2">
                    <span>Gói 30 chai</span>
                    <span className="text-[11px] uppercase px-2 py-0.5 rounded-full bg-sale text-white shadow-xs">
                      Siêu hời
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-text-muted mt-1 ml-7">
                  10 chai đầu x 18.000đ + 10 chai tiếp theo x 15.000đ + <strong className="text-[1.125em]">10 chai tiếp theo chỉ 12.000đ/chai</strong>
                </p>
              </div>

              <span className="text-sm text-amber-900 bg-amber-200/80 px-2.5 py-1 rounded-full shrink-0">
                Tiết kiệm 90.000đ
              </span>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-baseline justify-between mt-2">
              <span className="text-xs text-text-muted">
                Giá trung bình: <strong className="text-sale text-[1.125em]">15.000đ/chai</strong> (Giảm sâu)
              </span>
              <div className="text-right">
                <span className="text-xs text-gray-400 line-through mr-1.5">540.000đ</span>
                <span className="text-2xl text-amber-950 font-heading">
                  450.000đ
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BƯỚC 2: KHAY TỔNG KẾT CÁC ĐỢT 10 CHAI */}
      <div className="bg-white rounded-3xl border border-gray-200/90 p-4 sm:p-6 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl text-text-dark font-heading">
                Khay tổng kết Combo Giảm Giá Bậc Thang (Gói {packageSize} chai)
              </h2>
            </div>
            <p className="text-xs text-text-muted mt-0.5 ml-6">
              {isSameFlavor
                ? `Đang áp dụng cùng 1 vị cho cả ${packageSize} chai. Bấm "Tự chọn từng đợt" để tùy biến riêng từng đợt 10 chai.`
                : `Đang chọn vị cho Đợt ${activeSlot} (Bấm vào từng đợt bên dưới để đổi vị)`}
            </p>
          </div>

          {/* Nút chuyển chế độ: Cùng 1 loại vs Tự chọn từng đợt */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsSameFlavor(true);
                setSlot2(slot1);
                setSlot3(slot1);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer',
                isSameFlavor
                  ? 'bg-white text-forest-950 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Cùng 1 loại ({packageSize} chai)
            </button>
            <button
              type="button"
              onClick={() => setIsSameFlavor(false)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer',
                !isSameFlavor
                  ? 'bg-white text-forest-950 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Tự chọn từng đợt 10 chai
            </button>
          </div>
        </div>

        {/* Khay hiển thị 3 khối đợt 10 chai chuẩn UX Combo 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Khối 1: Đợt 1 • 10 chai */}
          <div
            onClick={() => {
              if (!isSameFlavor) setActiveSlot(1);
            }}
            className={cn(
              'relative rounded-2xl p-4 flex flex-col items-center justify-center min-h-[160px] transition-all select-none border-2',
              !isSameFlavor && 'cursor-pointer',
              !isSameFlavor && activeSlot === 1
                ? 'border-forest-800 bg-ivory ring-2 ring-forest-800 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            )}
          >
            <div className="flex items-center gap-1 absolute top-2.5 left-2.5">
              <span className="px-2 py-0.5 rounded-full bg-forest-800 text-white text-[12px]">
                1. Đợt 1 • 10 chai
              </span>
              {!isSameFlavor && activeSlot === 1 && (
                <span className="text-[11px] text-forest-800 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                  Đang chọn
                </span>
              )}
            </div>

            <div className="relative w-20 h-24 my-2">
              <Image
                src={prod1.thumbnail}
                alt={prod1.name}
                fill
                className="object-contain"
                sizes="90px"
              />
            </div>
          </div>

          {/* Khối 2: Đợt 2 • 10 chai */}
          <div
            onClick={() => {
              if (!isSameFlavor) setActiveSlot(2);
            }}
            className={cn(
              'relative rounded-2xl p-4 flex flex-col items-center justify-center min-h-[160px] transition-all select-none border-2',
              !isSameFlavor && 'cursor-pointer',
              !isSameFlavor && activeSlot === 2
                ? 'border-emerald-700 bg-emerald-50/40 ring-2 ring-emerald-700 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            )}
          >
            <div className="flex items-center gap-1 absolute top-2.5 left-2.5">
              <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[12px]">
                2. Đợt 2 • 10 chai
              </span>
              {!isSameFlavor && activeSlot === 2 && (
                <span className="text-[11px] text-emerald-800 bg-emerald-200 px-1.5 py-0.2 rounded-full">
                  Đang chọn
                </span>
              )}
            </div>

            <div className="relative w-20 h-24 my-2">
              <Image
                src={prod2.thumbnail}
                alt={prod2.name}
                fill
                className="object-contain"
                sizes="90px"
              />
            </div>
          </div>

          {/* Khối 3: Đợt 3 • 10 chai hoặc Thẻ nâng cấp gói 30 chai */}
          {packageSize === 30 ? (
            <div
              onClick={() => {
                if (!isSameFlavor) setActiveSlot(3);
              }}
              className={cn(
                'relative rounded-2xl p-4 flex flex-col items-center justify-center min-h-[160px] transition-all select-none border-2',
                !isSameFlavor && 'cursor-pointer',
                !isSameFlavor && activeSlot === 3
                  ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <div className="flex items-center gap-1 absolute top-2.5 left-2.5">
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-ink-950 text-[12px]">
                  3. Đợt 3 • 10 chai
                </span>
                {!isSameFlavor && activeSlot === 3 && (
                  <span className="text-[11px] text-amber-900 bg-amber-200 px-1.5 py-0.2 rounded-full">
                    Đang chọn
                  </span>
                )}
              </div>

              <div className="relative w-20 h-24 my-2">
                <Image
                  src={prod3.thumbnail}
                  alt={prod3.name}
                  fill
                  className="object-contain"
                  sizes="90px"
                />
              </div>
            </div>
          ) : (
            <div
              onClick={() => {
                setPackageSize(30);
                if (!isSameFlavor) setActiveSlot(3);
              }}
              className="relative rounded-2xl p-4 flex flex-col items-center text-center justify-between min-h-[180px] border-2 border-dashed border-amber-400 bg-gradient-to-b from-amber-50/60 to-amber-100/40 hover:border-amber-500 hover:shadow-xs transition-all cursor-pointer select-none"
            >
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-ink-950 text-[12px] shadow-xs">
                <span>NÂNG CẤP GÓI 30 CHAI</span>
              </div>

              <div className="my-auto py-6">
                <p className="text-sm text-amber-900">Thêm 10 chai chỉ 12.000đ/chai</p>
                <p className="text-[11px] text-amber-700/90 mt-0.5">Bấm để nâng cấp lên 30 chai (Tiết kiệm 90.000đ)</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* THANH TAB CHUYỂN ĐỢT (Khi chọn Tự chọn từng đợt) */}
      {!isSameFlavor && (
        <div
          ref={stepContainerRef}
          className="flex items-center gap-2 p-1.5 bg-gray-200/80 rounded-2xl max-w-xl mb-6 shadow-inner scroll-mt-24"
        >
          <button
            type="button"
            onClick={() => setActiveSlot(1)}
            className={cn(
              'flex-1 py-2.5 px-3 rounded-xl text-sm sm:text-base transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer',
              activeSlot === 1
                ? 'bg-forest-800 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 bg-transparent'
            )}
          >
            <span className={cn(
              'w-5 h-5 rounded-full text-[12px] flex items-center justify-center',
              activeSlot === 1 ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
            )}>
              1
            </span>
            <span>Đợt 1 (18.000đ/chai)</span>
            {prod1 && <Check className="w-3.5 h-3.5 text-emerald-300" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveSlot(2)}
            className={cn(
              'flex-1 py-2.5 px-3 rounded-xl text-sm sm:text-base transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer',
              activeSlot === 2
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 bg-transparent'
            )}
          >
            <span className={cn(
              'w-5 h-5 rounded-full text-[12px] flex items-center justify-center',
              activeSlot === 2 ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
            )}>
              2
            </span>
            <span>Đợt 2 (15.000đ/chai)</span>
            {prod2 && <Check className="w-3.5 h-3.5 text-emerald-200" />}
          </button>

          {packageSize === 30 && (
            <button
              type="button"
              onClick={() => setActiveSlot(3)}
              className={cn(
                'flex-1 py-2.5 px-3 rounded-xl text-sm sm:text-base transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer',
                activeSlot === 3
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 bg-transparent'
              )}
            >
              <span className={cn(
                'w-5 h-5 rounded-full text-[12px] flex items-center justify-center',
                activeSlot === 3 ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
              )}>
                3
              </span>
              <span>Đợt 3 (12.000đ/chai)</span>
              {prod3 && <Check className="w-3.5 h-3.5 text-amber-200" />}
            </button>
          )}
        </div>
      )}

      {/* KHU VỰC CHỌN SẢN PHẨM TRONG BẬC THANG */}
      <div className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 shadow-xs mb-8 animate-fadeIn">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className={cn(
                'w-2.5 h-2.5 rounded-full',
                isSameFlavor ? 'bg-forest-800' : activeSlot === 1 ? 'bg-forest-800' : activeSlot === 2 ? 'bg-emerald-700' : 'bg-amber-500'
              )} />
              <h3 className="text-lg sm:text-xl text-text-dark font-heading">
                {isSameFlavor ? (
                  <span>Chọn 1 sản phẩm cho cả Combo {packageSize} chai:</span>
                ) : (
                  <span>Chọn sản phẩm cho Đợt {activeSlot} (10 chai • {activeSlot === 1 ? '18.000đ' : activeSlot === 2 ? '15.000đ' : '12.000đ'}/chai):</span>
                )}
              </h3>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {isSameFlavor
                ? 'Nhấn chọn 1 sản phẩm bên dưới để đồng bộ vị cho cả combo'
                : 'Nhấn chọn sản phẩm — Sau khi nhấn sẽ tự động chuyển sang đợt tiếp theo'}
            </p>
          </div>
          <span className="text-sm px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            ✓ Đã chọn vị
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {availableProducts.map((prod) => {
            const isSelectedForCombo = isSameFlavor
              ? slot1 === prod.id
              : (activeSlot === 1 && slot1 === prod.id) ||
                (activeSlot === 2 && slot2 === prod.id) ||
                (activeSlot === 3 && slot3 === prod.id);

            const isPresentInAnySlot = slot1 === prod.id || slot2 === prod.id || (packageSize === 30 && slot3 === prod.id);

            return (
              <div
                key={prod.id}
                onClick={() => handleSelectProduct(prod.id)}
                className={cn(
                  'group p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative',
                  isSelectedForCombo
                    ? 'border-forest-800 bg-ivory shadow-xs ring-1 ring-forest-800/20'
                    : isPresentInAnySlot
                    ? 'border-emerald-300 bg-emerald-50/20 hover:border-forest-800'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-2xs'
                )}
              >
                {/* Badge trạng thái */}
                {isSelectedForCombo && (
                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-forest-800 text-white text-[12px] shadow-xs">
                    ✓ Đang chọn
                  </span>
                )}

                <div>
                  <div className="relative w-full aspect-square mb-2.5 bg-white rounded-xl p-2 flex items-center justify-center">
                    <Image
                      src={prod.thumbnail}
                      alt={prod.name}
                      fill
                      className="object-contain p-1 transition-transform"
                      sizes="(max-width: 640px) 100vw, 25vw"
                    />
                  </div>
                  <h4 className="text-text-dark text-base mb-0.5">
                    {prod.name}
                  </h4>
                  <p className="text-[11px] text-text-muted mb-2">
                    {PRODUCT_SUBTITLES[prod.id] || prod.volume || '330ml'}
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-gray-400 block">Đơn giá gốc:</span>
                    <span className="text-sm text-text-muted line-through">
                      18.000đ/chai
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectProduct(prod.id);
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-sm transition-all cursor-pointer',
                      isSelectedForCombo
                        ? 'bg-forest-800 text-white'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    )}
                  >
                    {isSameFlavor
                      ? isSelectedForCombo ? 'Đang chọn' : 'Chọn vị này'
                      : isSelectedForCombo ? `Đợt ${activeSlot}` : `Chọn đợt ${activeSlot}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer điều hướng nếu ở chế độ tự chọn từng đợt */}
        {!isSameFlavor && (
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            {activeSlot > 1 ? (
              <button
                type="button"
                onClick={() => setActiveSlot((activeSlot - 1) as 1 | 2)}
                className="text-gray-600 hover:text-gray-900 text-sm sm:text-base flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại Đợt {activeSlot - 1}</span>
              </button>
            ) : <div />}

            {activeSlot < (packageSize === 30 ? 3 : 2) && (
              <button
                type="button"
                onClick={() => setActiveSlot((activeSlot + 1) as 2 | 3)}
                className="px-5 py-2.5 rounded-xl bg-forest-800 hover:bg-emerald-900 text-white text-sm sm:text-base flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <span>Chuyển sang Đợt {activeSlot + 1}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* THANH TỔNG KẾT VÀ NÚT THÊM GIỎ HÀNG DƯỚI CÙNG CHO COMBO 06 */}
      <div className="fixed bottom-0 left-0 right-0 min-[1440px]:right-[380px] z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 px-4 py-3 sm:py-4 shadow-xl">
        <div className="section-container max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-2xl text-forest-950 font-heading">
                  {formatPrice(comboPrice)}đ
                </span>
                <span className="text-xs text-gray-400 line-through">
                  {formatPrice(marketPrice)}đ
                </span>
                <span className="text-[12px] text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                  Tiết kiệm {formatPrice(savings)}đ
                </span>
              </div>
              <span className="text-sm text-emerald-800">
                {isSameFlavor
                  ? `Đã chọn: Gói ${packageSize} chai ${prod1.name} (~${formatPrice(avgPricePerBottle)}đ/chai)`
                  : `Đã chọn: 10 ${prod1.name} + 10 ${prod2.name}${packageSize === 30 ? ` + 10 ${prod3.name}` : ''}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {!ENABLE_CUSTOM_COMBOS ? <CustomComboPausedNotice /> : (
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 rounded-2xl text-base sm:text-lg flex items-center justify-center gap-2 transition-all shadow-md bg-gradient-to-r from-emerald-800 to-forest-800 text-white hover:opacity-95 active:scale-95 cursor-pointer shadow-emerald-700/20"
            >
              {justAdded ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  Đã thêm Combo Giảm Giá Bậc Thang vào giỏ!
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  Thêm vào giỏ hàng ({formatPrice(comboPrice)}đ)
                </>
              )}
            </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ==========================================
// COMPONENT CHÍNH VỚI TABS CHUYỂN ĐỔI COMBO 01, 02, 05 & 06
// ==========================================
function ComboContent() {
  const { language } = useLanguage();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');
  const { selectedBranch, openBranchModal } = useBranchStore();

  // Mặc định tab dựa trên url param: combo-6 / combo-06, combo-5 / combo-05, combo-van-phong / combo-02, hoặc combo-01
  const [activeTab, setActiveTab] = useState<'combo-01' | 'combo-02' | 'combo-05' | 'combo-06'>(() => {
    if (typeParam === 'combo-6' || typeParam === 'combo-06' || typeParam === 'combo-sieu-hoi') {
      return 'combo-06';
    }
    if (typeParam === 'combo-5' || typeParam === 'combo-05' || typeParam === 'combo-uu-dai') {
      return 'combo-05';
    }
    return 'combo-02';
  });

  // Đồng bộ activeTab khi query param type thay đổi
  useEffect(() => {
    if (typeParam === 'combo-6' || typeParam === 'combo-06' || typeParam === 'combo-sieu-hoi') {
      setActiveTab('combo-06');
    } else if (typeParam === 'combo-5' || typeParam === 'combo-05' || typeParam === 'combo-uu-dai') {
      setActiveTab('combo-05');
    } else if (typeParam === 'combo-4-chai' || typeParam === 'combo-01') {
      setActiveTab('combo-01');
    } else {
      setActiveTab('combo-02');
    }
  }, [typeParam]);

  return (
    <div className="min-h-screen bg-ivory pb-32 pt-2">
      <div className="w-full">
        <div className="section-container max-w-7xl mx-auto px-4 sm:px-6">
            {/* Top bar: Nút quay lại */}
            <div className="flex items-center justify-between py-3 mb-3">
              <Link
                href="/#combo"
                className="inline-flex items-center gap-1.5 text-base text-gray-700 hover:text-green-primary transition-colors py-2 -my-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{language === 'en' ? 'Back to Home' : 'Quay lại trang chủ'}</span>
              </Link>

              <span className="text-xs text-text-muted hidden sm:inline-block">
                {language === 'en'
                  ? 'Thai Son Foods • Natural Nutritious Beverages'
                  : 'Thái Sơn Foods • Thức uống dinh dưỡng tự nhiên'}
              </span>
            </div>

            {/* Thanh chi nhánh đang chọn */}
            <div className="flex items-center justify-between p-3.5 mb-6 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl text-xs sm:text-sm shadow-xs">
              <div className="flex items-center gap-2 text-emerald-950 font-medium truncate">
                <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="truncate">
                  Đang chọn món tại kho: <strong className="text-[1.125em]">{selectedBranch?.name || 'Chi nhánh'}</strong> {selectedBranch?.address ? `(${selectedBranch.address})` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={openBranchModal}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm shrink-0 cursor-pointer transition-colors ml-2 shadow-xs"
              >
                Đổi chi nhánh
              </button>
            </div>

            {/* TABS CHỌN GIỮA COMBO 02, COMBO 05 VÀ COMBO 06 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-gray-200/80 rounded-2xl max-w-4xl mb-8 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab('combo-02')}
                className={cn(
                  'py-2.5 px-3 rounded-xl text-sm sm:text-base transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer leading-snug',
                  activeTab === 'combo-02'
                    ? 'bg-white text-forest-950 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <span>Combo khám phá thức uống đa dạng, trải nghiệm hương vị mới gồm sữa hạt, nước giải khát và trà sữa, 10 chai đồ uống kết hợp.</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('combo-05')}
                className={cn(
                  'py-2.5 px-3 rounded-xl text-sm sm:text-base transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer leading-snug',
                  activeTab === 'combo-05'
                    ? 'bg-white text-forest-950 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <span>Combo siêu hời tiết kiệm, tích trữ thông minh cho gia đình, 17 chai thức uống yêu thích.</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('combo-06')}
                className={cn(
                  'py-2.5 px-3 rounded-xl text-sm sm:text-base transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer leading-snug',
                  activeTab === 'combo-06'
                    ? 'bg-white text-forest-950 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <span>Combo giảm giá bậc thang mua nhiều giảm sâu, tùy chọn hương vị theo sở thích của mình.</span>
              </button>
            </div>

            {/* HIỂN THỊ NỘI DUNG TƯƠNG ỨNG */}
            {activeTab === 'combo-01' ? (
              <Combo01View />
            ) : activeTab === 'combo-02' ? (
              <Combo02View />
            ) : activeTab === 'combo-05' ? (
              <Combo05View />
            ) : (
              <Combo06View />
            )}
          </div>
        </div>
      </div>
  );
}


export default function ComboSelectionPage() {
  // Doanh nghiệp chưa chốt combo → tạm ẩn trang combo (redirect hợp lệ khi render Client Component)
  if (!ENABLE_COMBOS) redirect('/');
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-ivory flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-forest-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-base text-text-dark">Loading...</p>
          </div>
        </div>
      }
    >
      <ComboContent />
    </Suspense>
  );
}
