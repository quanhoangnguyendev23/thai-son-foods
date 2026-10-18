'use client';

import React, { useState, useMemo } from 'react';
import {
  Store,
  MapPin,
  Clock,
  Phone,
  Sparkles,
  ChevronRight,
  X,
  Search,
  Check,
  Compass,
  AlertCircle,
  Truck,
  ShoppingBag,
  Info,
} from 'lucide-react';
import { StoreRecommendationItem } from '@/lib/storeRecommender';
import { cn } from '@/lib/utils';

interface StoreRecommendationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  recommended: StoreRecommendationItem | null;
  alternatives: StoreRecommendationItem[];
  others: StoreRecommendationItem[];
  unavailable: Array<{ store: Partial<StoreRecommendationItem>; reason: string }>;
  selectedStoreCode: string;
  onSelectStore: (storeCode: string) => void;
  mode?: 'delivery' | 'pickup';
  onModeChange?: (mode: 'delivery' | 'pickup') => void;
}

export default function StoreRecommendationSheet({
  isOpen,
  onClose,
  recommended,
  alternatives,
  others,
  unavailable,
  selectedStoreCode,
  onSelectStore,
  mode = 'delivery',
  onModeChange,
}: StoreRecommendationSheetProps) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showAllStores, setShowAllStores] = useState(false);

  // Danh sách top gợi ý giao được (Đề xuất + Tối đa 3 lựa chọn thay thế)
  const topStores = useMemo(() => {
    const list: StoreRecommendationItem[] = [];
    if (recommended) list.push(recommended);
    alternatives.forEach((a) => {
      if (!list.some((s) => s.code === a.code)) list.push(a);
    });
    return list;
  }, [recommended, alternatives]);

  // Nhóm các cửa hàng còn lại theo Tỉnh / Thành phố
  const groupedOthers = useMemo(() => {
    const all = [...others, ...unavailable.map((u) => u.store as StoreRecommendationItem)];
    const groups: Record<string, StoreRecommendationItem[]> = {};

    all.forEach((s) => {
      if (!s || !s.code) return;
      const prov = s.addressNew?.includes('Bình Dương')
        ? 'Bình Dương'
        : s.addressNew?.includes('Đồng Nai')
        ? 'Đồng Nai'
        : s.addressNew?.includes('Cần Thơ')
        ? 'Cần Thơ'
        : s.addressNew?.includes('Vũng Tàu')
        ? 'Bà Rịa - Vũng Tàu'
        : s.addressNew?.includes('Tây Ninh')
        ? 'Tây Ninh'
        : 'TP. Hồ Chí Minh';

      if (!groups[prov]) groups[prov] = [];
      if (!groups[prov].some((item) => item.code === s.code)) {
        groups[prov].push(s);
      }
    });

    return groups;
  }, [others, unavailable]);

  // Lọc theo từ khóa tìm kiếm
  const filterByKeyword = (store: StoreRecommendationItem) => {
    if (!searchKeyword.trim()) return true;
    const kw = searchKeyword.toLowerCase();
    const target = `${store.name} ${store.areaLabel || ''} ${store.addressNew} ${store.code}`.toLowerCase();
    return target.includes(kw);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full h-[85vh] sm:h-[85vh] sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-[1.125em]">
              <Store className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-gray-900 text-lg leading-tight">
                Chọn chi nhánh phục vụ đơn hàng
              </h3>
              <p className="text-xs text-gray-500">
                Đề xuất dựa trên khoảng cách thực tế, thời gian giao và tồn kho
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chuyển đổi phương thức: Giao tận nơi vs Nhận tại cửa hàng */}
        {onModeChange && (
          <div className="px-4 sm:px-5 pt-3 pb-1 bg-white border-b border-gray-50 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onModeChange('delivery')}
              className={cn(
                'flex-1 py-2 px-3 rounded-xl text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                mode === 'delivery'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Giao hàng tận nơi</span>
            </button>
            <button
              type="button"
              onClick={() => onModeChange('pickup')}
              className={cn(
                'flex-1 py-2 px-3 rounded-xl text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                mode === 'pickup'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Nhận tại cửa hàng</span>
            </button>
          </div>
        )}

        {/* Ô tìm kiếm chi nhánh */}
        <div className="p-3 sm:px-5 bg-gray-50/70 border-b border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm theo tên chi nhánh hoặc khu vực (vd: Tân Bình, Quận 1, Dĩ An)..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-hidden focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Danh sách các chi nhánh */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4" role="radiogroup">
          {/* PHẦN 1: CÁC GỢI Ý GẦN NHẤT & GIAO ĐƯỢC (TỐI ĐA 3-4 CỬA HÀNG) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-gray-500 uppercase tracking-wider">
                Gợi ý giao hàng tối ưu nhất ({topStores.length})
              </span>
              <span className="text-[11px] text-emerald-800 font-medium">Bán kính ≤ 10 km</span>
            </div>

            {topStores.filter(filterByKeyword).length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-xs bg-gray-50 rounded-2xl">
                Không tìm thấy chi nhánh phù hợp với từ khóa tìm kiếm.
              </div>
            ) : (
              topStores.filter(filterByKeyword).map((st) => {
                const isSelected = selectedStoreCode === st.code;
                const isTop1 = recommended?.code === st.code;

                // Tính toán chênh lệch so với đề xuất
                const diffFee =
                  recommended && st.shippingFee > recommended.shippingFee
                    ? st.shippingFee - recommended.shippingFee
                    : 0;
                const diffEta =
                  recommended && st.etaMinutes > recommended.etaMinutes
                    ? st.etaMinutes - recommended.etaMinutes
                    : 0;

                return (
                  <div
                    key={st.code}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => {
                      onSelectStore(st.code);
                      onClose();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectStore(st.code);
                        onClose();
                      }
                    }}
                    className={cn(
                      'p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col gap-2',
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-gray-50/80'
                    )}
                  >
                    {/* Hàng trên: Tên + Khu vực + Huy hiệu */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-gray-900 text-base">{st.name}</span>
                          {st.areaLabel && (
                            <span className="text-[12px] text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                              {st.areaLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">{st.addressNew}</p>
                      </div>

                      {isSelected && (
                        <span className="text-[12px] text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Đang chọn</span>
                        </span>
                      )}
                    </div>

                    {/* Hàng giữa: Các thông số Quãng đường, ETA, Phí ship, Giờ đóng cửa */}
                    <div className="flex items-center gap-2 flex-wrap text-xs pt-1 border-t border-gray-100">
                      <span className="text-gray-800 flex items-center gap-1 text-[1.125em]">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{st.roadKm} km</span>
                      </span>

                      <span className="text-gray-300">•</span>

                      <span className="text-gray-800 flex items-center gap-1 text-[1.125em]">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span>~{st.etaMinutes} phút</span>
                      </span>

                      <span className="text-gray-300">•</span>

                      <span className="text-emerald-800 text-[1.125em]">
                        {st.shippingFee === 0 ? 'Freeship' : `${st.shippingFee.toLocaleString('vi-VN')}đ`}
                      </span>

                      {st.closesAt && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-[11px] text-gray-500">Mở đến {st.closesAt}</span>
                        </>
                      )}
                    </div>

                    {/* Hàng dưới: Badges & Chênh lệch nếu chọn chi nhánh xa hơn */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {st.badges.map((b) => (
                          <span
                            key={b}
                            className={cn(
                              'text-[11px] px-2 py-0.5 rounded-md',
                              b === 'Đề xuất'
                                ? 'bg-emerald-800 text-white'
                                : b === 'Gần nhất'
                                ? 'bg-amber-100 text-amber-900'
                                : b === 'Giao nhanh nhất'
                                ? 'bg-blue-100 text-blue-900'
                                : 'bg-gray-100 text-gray-700'
                            )}
                          >
                            {b}
                          </span>
                        ))}
                      </div>

                      {/* Hiển thị chênh lệch nếu khách tự chọn chi nhánh xa hơn đề xuất */}
                      {!isTop1 && (diffFee > 0 || diffEta > 0) && (
                        <span className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                          {diffFee > 0 && `+${diffFee.toLocaleString('vi-VN')}đ `}
                          {diffEta > 0 && `+${diffEta} phút`}
                        </span>
                      )}

                      {/* Nút gọi Hotline trung tính (không tô đỏ) */}
                      {st.phone && (
                        <a
                          href={`tel:${st.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-md transition-colors"
                        >
                          <Phone className="w-3 h-3 text-gray-500" />
                          <span>{st.phone}</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* PHẦN 2: XEM THÊM CÁC CỬA HÀNG KHÁC (NHÓM THEO TỈNH/THÀNH) */}
          <div className="pt-2 border-t border-gray-100">
            {!showAllStores ? (
              <button
                type="button"
                onClick={() => setShowAllStores(true)}
                className="w-full py-2.5 px-4 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Xem thêm các chi nhánh khác ({others.length + unavailable.length})</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-500 uppercase tracking-wider">
                    Tất cả chi nhánh hệ thống
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllStores(false)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Thu gọn
                  </button>
                </div>

                {Object.entries(groupedOthers).map(([provName, storeList]) => {
                  const filtered = storeList.filter(filterByKeyword);
                  if (filtered.length === 0) return null;

                  return (
                    <div key={provName} className="space-y-2">
                      <p className="text-sm text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">
                        {provName} ({filtered.length})
                      </p>

                      <div className="space-y-2 pl-1">
                        {filtered.map((st) => {
                          const isUnavailable = unavailable.some((u) => u.store?.code === st.code);
                          const unavailReason = unavailable.find((u) => u.store?.code === st.code)?.reason;

                          return (
                            <div
                              key={st.code}
                              onClick={() => {
                                if (!isUnavailable || mode === 'pickup') {
                                  onSelectStore(st.code);
                                  onClose();
                                }
                              }}
                              className={cn(
                                'p-3 rounded-xl border transition-all text-xs flex flex-col gap-1',
                                isUnavailable
                                  ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                                  : 'bg-white border-gray-200 hover:border-emerald-300 cursor-pointer'
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-900 text-[1.125em]">{st.name}</span>
                                {st.roadKm && <span className="text-gray-500">~{st.roadKm} km</span>}
                              </div>
                              <p className="text-[11px] text-gray-500 truncate">{st.addressNew}</p>
                              {isUnavailable && unavailReason && (
                                <p className="text-[10px] text-amber-800 font-medium">
                                  {unavailReason}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
