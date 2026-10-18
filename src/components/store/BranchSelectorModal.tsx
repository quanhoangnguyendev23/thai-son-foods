'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Navigation,
  X,
  Search,
  Check,
  ChevronRight,
  Phone,
  AlertCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { useBranchStore, StoreBranch } from '@/store/branch';
import { calculateHaversineDistance } from '@/lib/geo';
import { cn, safeFetchJson } from '@/lib/utils';

interface BranchSelectorModalProps {
  productId?: string; // Tùy chọn nếu đang mở từ trang sản phẩm để hiển thị tồn kho của món đó
  onSelect?: (branch: StoreBranch) => void;
}

export default function BranchSelectorModal({ productId, onSelect }: BranchSelectorModalProps) {
  const {
    selectedBranch,
    setSelectedBranch,
    isBranchModalOpen,
    closeBranchModal,
    branches,
    fetchBranches,
    isLoading: isStoreLoading,
  } = useBranchStore();

  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedProvince, setSelectedProvince] = useState<string>('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [storeStockMap, setStoreStockMap] = useState<Record<string, 'in_stock' | 'low_stock' | 'out_of_stock'>>({});

  // Tải danh sách cửa hàng khi mở modal
  useEffect(() => {
    if (isBranchModalOpen) {
      fetchBranches();
    }
  }, [isBranchModalOpen, fetchBranches]);

  // Nếu có productId, truy vấn tình trạng kho của sản phẩm tại các chi nhánh
  useEffect(() => {
    if (isBranchModalOpen && productId) {
      let active = true;
      safeFetchJson<{ success: boolean; stores: any[] }>(`/api/stores?productId=${encodeURIComponent(productId)}`)
        .then((data) => {
          if (!active || !data) return;
          if (data.success && Array.isArray(data.stores)) {
            const map: Record<string, 'in_stock' | 'low_stock' | 'out_of_stock'> = {};
            data.stores.forEach((s: any) => {
              if (s.stockStatus) map[s.code] = s.stockStatus;
            });
            setStoreStockMap(map);
          }
        });
      return () => {
        active = false;
      };
    }
  }, [isBranchModalOpen, productId]);

  // Lấy danh sách Tỉnh/Thành duy nhất từ danh sách chi nhánh
  const provinces = useMemo(() => {
    const set = new Set<string>();
    branches.forEach((b) => {
      if (b.province) set.add(b.province);
    });
    return Array.from(set);
  }, [branches]);

  // Lấy danh sách Quận/Huyện theo Tỉnh đã chọn
  const districts = useMemo(() => {
    const set = new Set<string>();
    branches.forEach((b) => {
      if (selectedProvince === 'ALL' || b.province === selectedProvince) {
        if (b.district) set.add(b.district);
      }
    });
    return Array.from(set);
  }, [branches, selectedProvince]);

  // Xử lý lấy vị trí GPS từ trình duyệt
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Trình duyệt của bạn không hỗ trợ định vị GPS');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserCoords(coords);
        setGpsLoading(false);
      },
      (error) => {
        setGpsLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError('Bạn đã từ chối cấp quyền vị trí. Vui lòng chọn Tỉnh/Quận bên dưới.');
        } else if (error.code === error.TIMEOUT) {
          setGpsError('Lấy vị trí quá thời gian chờ. Vui lòng chọn Tỉnh/Quận thủ công.');
        } else {
          setGpsError('Không thể lấy vị trí hiện tại của bạn.');
        }
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  // Tính khoảng cách và sắp xếp danh sách chi nhánh
  const processedBranches = useMemo(() => {
    let list = branches.map((b) => {
      let distanceKm: number | undefined = undefined;
      if (userCoords && b.latitude && b.longitude) {
        distanceKm = calculateHaversineDistance(
          userCoords.lat,
          userCoords.lng,
          b.latitude,
          b.longitude
        );
      }
      return {
        ...b,
        distanceKm,
        stockStatus: storeStockMap[b.code] || b.stockStatus,
      };
    });

    // Lọc theo tìm kiếm từ khóa
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.address.toLowerCase().includes(q) ||
          (b.district && b.district.toLowerCase().includes(q))
      );
    }

    // Lọc theo Tỉnh
    if (selectedProvince !== 'ALL') {
      list = list.filter((b) => b.province === selectedProvince);
    }

    // Lọc theo Quận
    if (selectedDistrict !== 'ALL') {
      list = list.filter((b) => b.district === selectedDistrict);
    }

    // Sắp xếp: Nếu có vị trí GPS -> ưu tiên gần nhất lên đầu
    if (userCoords) {
      list.sort((a, b) => {
        if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm;
        }
        if (a.distanceKm !== undefined) return -1;
        if (b.distanceKm !== undefined) return 1;
        return 0;
      });
    }

    return list;
  }, [branches, userCoords, searchKeyword, selectedProvince, selectedDistrict, storeStockMap]);

  // Chi nhánh gần nhất (nếu có GPS)
  const nearestBranchCode = useMemo(() => {
    if (!userCoords) return null;
    const withDist = processedBranches.filter((b) => b.distanceKm !== undefined);
    return withDist.length > 0 ? withDist[0].code : null;
  }, [userCoords, processedBranches]);

  const handleSelect = (branch: StoreBranch) => {
    setSelectedBranch(branch);
    if (onSelect) onSelect(branch);
    closeBranchModal();
  };

  if (!isBranchModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-ink-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-emerald-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[1.125em]">
              <MapPin className="w-5 h-5 text-forest-700" />
            </div>
            <div>
              <h2 className="text-xl text-gray-900 font-heading">
                Chọn Chi nhánh Phục vụ
              </h2>
              <p className="text-xs text-text-muted">
                Hệ thống đề xuất chi nhánh gần bạn nhất để tối ưu phí ship & thời gian giao
              </p>
            </div>
          </div>
          <button
            onClick={closeBranchModal}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-white/80 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action: Dùng vị trí hiện tại + Bộ lọc */}
        <div className="p-5 border-b border-gray-100 bg-white space-y-3.5">
          {/* Nút GPS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              onClick={handleGetLocation}
              disabled={gpsLoading}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-xs cursor-pointer',
                userCoords
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-forest-700 hover:bg-forest-800 text-white'
              )}
            >
              {gpsLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xác định vị trí...</span>
                </>
              ) : userCoords ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Đã định vị vị trí của bạn</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  <span>Dùng vị trí của tôi (Đề xuất gần nhất)</span>
                </>
              )}
            </button>

            {/* Ô tìm kiếm nhanh */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm theo tên chi nhánh, đường, quận..."
                className="w-full pl-9 pr-3 py-2 text-base sm:text-sm border border-gray-200 rounded-xl focus:outline-hidden focus:border-forest-700"
              />
            </div>
          </div>

          {/* Cảnh báo lỗi GPS nếu có */}
          {gpsError && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 text-amber-800 text-xs border border-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{gpsError}</span>
            </div>
          )}

          {/* Bộ lọc Tỉnh & Quận */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[12px] text-gray-500 uppercase tracking-wider mb-1">
                Tỉnh / Thành phố
              </label>
              <select
                value={selectedProvince}
                onChange={(e) => {
                  setSelectedProvince(e.target.value);
                  setSelectedDistrict('ALL');
                }}
                className="w-full px-3 py-2 text-base sm:text-xs md:text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-hidden focus:border-forest-700"
              >
                <option value="ALL">Tất cả Tỉnh/Thành</option>
                {provinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] text-gray-500 uppercase tracking-wider mb-1">
                Quận / Huyện
              </label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="w-full px-3 py-2 text-base sm:text-xs md:text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-hidden focus:border-forest-700"
              >
                <option value="ALL">Tất cả Quận/Huyện</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Danh sách Chi nhánh */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-gray-100">
          {isStoreLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-text-muted gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-forest-700" />
              <span className="text-sm">Đang tải danh sách chi nhánh...</span>
            </div>
          ) : processedBranches.length === 0 ? (
            <div className="py-12 text-center text-text-muted">
              <p className="text-sm">Không tìm thấy chi nhánh phù hợp với điều kiện tìm kiếm.</p>
              <button
                onClick={() => {
                  setSelectedProvince('ALL');
                  setSelectedDistrict('ALL');
                  setSearchKeyword('');
                }}
                className="mt-2 text-sm text-forest-700 underline cursor-pointer"
              >
                Xem tất cả chi nhánh
              </button>
            </div>
          ) : (
            processedBranches.map((branch) => {
              const isSelected = selectedBranch?.code === branch.code;
              const isNearest = nearestBranchCode === branch.code;
              const stockStatus = branch.stockStatus;

              return (
                <div
                  key={branch.id || branch.code}
                  className={cn(
                    'py-3.5 px-3 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                    isSelected ? 'bg-emerald-50/70 border border-emerald-200' : 'hover:bg-gray-50'
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-900 text-base md:text-[17px]">
                        {branch.name}
                      </span>

                      {/* Huy hiệu Gần nhất */}
                      {isNearest && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[12px]">
                          Gần nhất ({branch.distanceKm} km)
                        </span>
                      )}

                      {/* Khoảng cách nếu có GPS và không phải gần nhất */}
                      {!isNearest && branch.distanceKm !== undefined && (
                        <span className="text-[11px] text-gray-500 font-medium">
                          • cách {branch.distanceKm} km
                        </span>
                      )}

                      {/* Tình trạng tồn kho của sản phẩm đang xem */}
                      {stockStatus && (
                        <span
                          className={cn(
                            'text-[12px] px-2 py-0.5 rounded-full',
                            stockStatus === 'in_stock' && 'bg-emerald-100 text-emerald-800',
                            stockStatus === 'low_stock' && 'bg-amber-100 text-amber-800',
                            stockStatus === 'out_of_stock' && 'bg-red-100 text-red-800'
                          )}
                        >
                          {stockStatus === 'in_stock'
                            ? 'Còn hàng'
                            : stockStatus === 'low_stock'
                            ? 'Sắp hết'
                            : 'Hết hàng'}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-600 mt-1 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span>{branch.address}</span>
                    </p>

                    {branch.phone && (
                      <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1 pl-4.5">
                        <Phone className="w-3 h-3" />
                        <span>Hotline: {branch.phone}</span>
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center justify-end">
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm shadow-xs">
                        <Check className="w-3.5 h-3.5" />
                        Đang chọn
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSelect(branch)}
                        className="px-3.5 py-1.5 rounded-lg border border-forest-700 text-forest-700 hover:bg-forest-700 hover:text-white transition-all text-sm cursor-pointer"
                      >
                        Chọn chi nhánh này
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-text-muted">
          <span>Tổng cộng {branches.length} chi nhánh đang hoạt động</span>
          <button
            onClick={closeBranchModal}
            className="text-gray-600 hover:text-gray-900 font-medium cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
