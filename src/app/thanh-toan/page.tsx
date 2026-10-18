'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useCartStore } from '@/store/cart';
import { formatPrice, cn, safeFetchJson, safeParseJson } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import {
  CheckCircle,
  ArrowLeft,
  Banknote,
  AlertCircle,
  AlertTriangle,
  User,
  Store,
  MapPin,
  RefreshCw,
  Search,
  Navigation,
  Compass,
  Loader2,
  Clock,
  Phone,
  Truck,
  ChevronRight,
  Maximize2,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useUserAuth } from '@/context/UserAuthContext';
import { products } from '@/data/products';
import { combos } from '@/data/combos';
import { useBranchStore } from '@/store/branch';
import { calculateShippingFee, INVENTORY_CONFIG } from '@/config/inventory';
import { calculateHaversineDistance, estimateCoordinatesFromAddress, findNearestStore, removeKhuPho } from '@/lib/geo';
import {
  getProvinceNames,
  getDistrictsByProvince,
  getWardsByDistrict,
  findPreciseCoordinates,
} from '@/data/vietnam-addresses';
import type { AutocompleteSuggestion } from '@/app/api/geo/autocomplete/route';
import LocationConfirmMapModal from '@/components/checkout/LocationConfirmMapModal';
import StoreRecommendationSheet from '@/components/checkout/StoreRecommendationSheet';
import type { StoreRecommendationItem } from '@/lib/storeRecommender';

interface DeliveryMiniMapProps {
  coords: { lat: number; lng: number } | null;
  isConfirmed: boolean;
  addressText?: string;
  onOpenModal: () => void;
}

function DeliveryMiniMap({
  coords,
  isConfirmed,
  addressText,
  onOpenModal,
}: DeliveryMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || !containerRef.current) {
      return;
    }

    let isCancelled = false;

    async function setupMiniMap() {
      const L = (await import('leaflet')).default;
      if (isCancelled || !containerRef.current) return;

      const targetLat = coords?.lat || 10.7769;
      const targetLng = coords?.lng || 106.7009;
      const targetZoom = coords ? 16 : 13;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([targetLat, targetLng], targetZoom, { animate: true });
        return;
      }

      const map = L.map(containerRef.current, {
        center: [targetLat, targetLng],
        zoom: targetZoom,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      setTimeout(() => {
        if (!isCancelled && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);
    }

    setupMiniMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mounted, coords]);

  if (!mounted) {
    return (
      <div className="w-full h-[175px] bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center animate-pulse">
        <span className="text-xs text-slate-400">Đang tải bản đồ...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl border border-gray-200 overflow-hidden shadow-2xs bg-white isolate z-0">
      <div
        ref={containerRef}
        onClick={onOpenModal}
        className="relative z-0 w-full h-[175px] cursor-pointer transition-opacity hover:opacity-95"
      />
      <div
        onClick={onOpenModal}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10 flex flex-col items-center"
      >
        <div className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-800 text-white shadow-md mb-0.5 whitespace-nowrap">
          {coords ? (isConfirmed ? '✓ Vị trí giao hàng' : 'Tọa độ ước tính') : 'Chạm để ghim vị trí'}
        </div>
        <svg width="32" height="38" viewBox="0 0 24 30" fill="none" className="drop-shadow-md">
          <path
            d="M12 0C5.373 0 0 5.373 0 12c0 9 12 18 12 18s12-9 12-18c0-6.627-5.373-12-12-12z"
            fill={coords ? (isConfirmed ? 'var(--color-forest-700)' : 'var(--color-amber-600)') : 'var(--color-forest-700)'}
          />
          <circle cx="12" cy="11" r="5" fill="#ffffff" />
          <circle cx="12" cy="11" r="2.5" fill={coords ? (isConfirmed ? 'var(--color-forest-700)' : 'var(--color-amber-600)') : 'var(--color-forest-700)'} />
        </svg>
        <div className="w-3 h-1 bg-ink-950/30 rounded-full blur-[1px]" />
      </div>

      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-2 pointer-events-none">
        <div
          className={cn(
            'px-2.5 py-1 rounded-xl text-[12px] flex items-center gap-1.5 shadow-sm backdrop-blur-md',
            coords
              ? isConfirmed
                ? 'bg-emerald-600/95 text-white'
                : 'bg-amber-500/95 text-ink-950'
              : 'bg-emerald-800/90 text-white'
          )}
        >
          {coords ? (
            isConfirmed ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>✓ Đã xác nhận ghim</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Tọa độ ước tính — Chạm để chỉnh ghim</span>
              </>
            )
          ) : (
            <>
              <MapPin className="w-3.5 h-3.5" />
              <span>Bản đồ trực quan — Chạm để chấm ghim</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenModal}
          className="pointer-events-auto px-2.5 py-1 rounded-xl bg-white/95 hover:bg-white text-gray-800 hover:text-emerald-800 text-[12px] shadow-md flex items-center gap-1 transition-all cursor-pointer backdrop-blur-md"
          title="Mở toàn màn hình để điều chỉnh ghim"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Phóng to &amp; Sửa ghim</span>
        </button>
      </div>

      <div className="px-3.5 py-2 bg-slate-50 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-[11px] text-gray-500 font-medium">GPS:</span>
          {coords ? (
            <span className="font-mono text-[12px] text-emerald-800 truncate">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          ) : (
            <span className="text-[11px] text-gray-600 truncate">
              TP. Hồ Chí Minh • Chạm bản đồ để chấm ghim
            </span>
          )}
          {coords && addressText && (
            <span className="text-gray-400 hidden md:inline truncate text-[11px]">
              • {addressText}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenModal}
          className="shrink-0 text-[12px] text-emerald-800 hover:text-emerald-900 underline cursor-pointer"
        >
          {coords ? (isConfirmed ? 'Điều chỉnh lại' : 'Chấm ghim ngay') : 'Chấm ghim trên bản đồ'}
        </button>
      </div>
    </div>
  );
}

const MIN_ORDER_THRESHOLD = 120000;

export default function CheckoutPage() {
  const { language } = useLanguage();
  const { user, openAuthModal } = useUserAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [saveDefaultAddress, setSaveDefaultAddress] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const savedRef = sessionStorage.getItem('tsf_ref_code');
      if (savedRef) setReferralCode(savedRef);
    } catch (_) {}
  }, []);

  const { items, clearCart } = useCartStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const paymentMethod = 'cod';
  const [orderCode, setOrderCode] = useState('');
  const [completedOrder, setCompletedOrder] = useState<{
    fullName: string;
    phone: string;
    email?: string;
    address: string;
    total: number;
    paymentMethod: string;
    storeAddress?: string;
  } | null>(null);

  // Chi nhánh phục vụ: MẶC ĐỊNH lấy từ chi nhánh đang chọn toàn site
  const { selectedBranch, setSelectedBranch } = useBranchStore();
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStoreCode, setSelectedStoreCode] = useState<string>(
    selectedBranch?.code || 'NH'
  );

  // Trạng thái kiểm tra tồn kho giỏ hàng tại chi nhánh
  const [isStockChecking, setIsStockChecking] = useState(false);
  const [isStockAvailable, setIsStockAvailable] = useState(true);
  const [insufficientItems, setInsufficientItems] = useState<any[]>([]);
  const [alternativeStores, setAlternativeStores] = useState<any[]>([]);
  const [suggestedCloserStore, setSuggestedCloserStore] = useState<{
    code: string;
    name: string;
    address: string;
    phone?: string;
    distanceKm: number;
  } | null>(null);
  const [stockConflictError, setStockConflictError] = useState<string | null>(null);

  // Tọa độ GPS khách hàng (hoặc ước tính từ địa chỉ) để tính khoảng cách & định tuyến kho
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // GPS & Store Recommendation State (Mục 18)
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isStoreSheetOpen, setIsStoreSheetOpen] = useState(false);
  const [fulfillmentMode, setFulfillmentMode] = useState<'delivery' | 'pickup'>('delivery');
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [locationConfirmedBy, setLocationConfirmedBy] = useState<string | null>(null);
  // Ghim do khách tự chấm: các bước tự đoán tọa độ không được ghi đè
  const pinLockedRef = useRef(false);
  pinLockedRef.current = locationConfirmed && locationConfirmedBy === 'USER_MAP_PIN';
  // Địa chỉ do ghim điền vào: không bật gợi ý / không hiện khung xác định lại
  const pinAddressRef = useRef<string | null>(null);
  // Tọa độ geocode của địa chỉ gõ tay (chỉ dùng để cảnh báo lệch so với ghim)
  const [typedAddrCoords, setTypedAddrCoords] = useState<{ lat: number; lng: number } | null>(null);
  // Khoảng cách (km) giữa ghim khách chấm và địa chỉ gõ tay; > 1km coi là lệch
  const pinMismatchKm =
    locationConfirmed && locationConfirmedBy === 'USER_MAP_PIN' && typedAddrCoords && customerCoords
      ? calculateHaversineDistance(customerCoords.lat, customerCoords.lng, typedAddrCoords.lat, typedAddrCoords.lng)
      : 0;
  const hasPinMismatch = pinMismatchKm > 1;
  const [wasOverridden, setWasOverridden] = useState(false);
  const [recommendData, setRecommendData] = useState<{
    recommended: StoreRecommendationItem | null;
    alternatives: StoreRecommendationItem[];
    others: StoreRecommendationItem[];
    unavailable: Array<{ store: Partial<StoreRecommendationItem>; reason: string }>;
  } | null>(null);
  const [isLoadingRecommend, setIsLoadingRecommend] = useState(false);

  // Nạp danh sách stores và đồng bộ chi nhánh đang chọn
  useEffect(() => {
    safeFetchJson<{ success: boolean; stores: any[] }>('/api/stores')
      .then((data) => {
        if (data?.success && Array.isArray(data.stores)) {
          setStores(data.stores);
          if (selectedBranch?.code) {
            setSelectedStoreCode(selectedBranch.code);
          } else {
            setSelectedStoreCode(data.stores[0]?.code || 'NH');
          }
        }
      })
      .catch(console.error);
  }, [selectedBranch?.code]);

  // Gọi API đề xuất chi nhánh thông minh tối ưu (Mục 18.3)
  const fetchStoreRecommendation = useCallback(
    async (coords: { lat: number; lng: number }, mode: 'delivery' | 'pickup' = fulfillmentMode) => {
      setIsLoadingRecommend(true);
      try {
        const res = await safeFetchJson<any>('/api/stores/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: coords.lat,
            lng: coords.lng,
            mode,
            cartItems: items,
          }),
        });

        if (res?.success) {
          setRecommendData({
            recommended: res.recommended || null,
            alternatives: res.alternatives || [],
            others: res.others || [],
            unavailable: res.unavailable || [],
          });

          // Tự động gán chi nhánh tối ưu nếu người dùng chưa can thiệp thủ công
          if (res.recommended && !wasOverridden) {
            setSelectedStoreCode(res.recommended.code);
            const matched = stores.find((s) => s.code === res.recommended.code);
            if (matched) {
              setSelectedBranch(matched);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching store recommendations:', err);
      } finally {
        setIsLoadingRecommend(false);
      }
    },
    [fulfillmentMode, items, wasOverridden, stores, setSelectedBranch]
  );

  // Tự động gọi API đề xuất khi có tọa độ GPS khách hàng hoặc khi đổi chế độ giao hàng
  useEffect(() => {
    if (customerCoords) {
      fetchStoreRecommendation(customerCoords, fulfillmentMode);
    }
  }, [customerCoords, fulfillmentMode, fetchStoreRecommendation]);

  const handleSelectStore = (storeCode: string) => {
    setSelectedStoreCode(storeCode);
    setSuggestedCloserStore(null);
    if (recommendData?.recommended && recommendData.recommended.code !== storeCode) {
      setWasOverridden(true);
    }
    const matched = stores.find((s) => s.code === storeCode);
    if (matched) {
      setSelectedBranch(matched);
    }
  };

  const handleMapLocationConfirm = (confirmed: {
    lat: number;
    lng: number;
    formattedAddress: string;
    components?: { province?: string; district?: string; ward?: string; street?: string };
    confidence: 'high' | 'medium' | 'low';
  }) => {
    setCustomerCoords({ lat: confirmed.lat, lng: confirmed.lng });
    setLocationConfirmed(true);
    setLocationConfirmedBy('USER_MAP_PIN');
    pinAddressRef.current = confirmed.components?.street || null;
    setTypedAddrCoords(null);
    setShowSuggestions(false);
    setSuggestions([]);

    if (confirmed.components) {
      setForm((prev) => ({
        ...prev,
        province: confirmed.components?.province || prev.province,
        district: confirmed.components?.district || prev.district,
        ward: confirmed.components?.ward || prev.ward,
        address: confirmed.components?.street || prev.address,
      }));
      setErrors((prev) => ({
        ...prev,
        province: '',
        district: '',
        ward: '',
        address: '',
      }));
    }
    if (confirmed.formattedAddress) {
      setGeoResolvedDesc(confirmed.formattedAddress);
    }
  };

  const getNearestBranchPreview = useCallback(
    (lat?: number, lng?: number) => {
      if (!lat || !lng || !stores.length) return null;
      let closest: { name: string; dist: number } | null = null;
      for (const s of stores) {
        if (typeof s.latitude === 'number' && typeof s.longitude === 'number') {
          const d = calculateHaversineDistance(lat, lng, s.latitude, s.longitude);
          if (!closest || d < closest.dist) {
            closest = { name: s.name, dist: d };
          }
        }
      }
      return closest;
    },
    [stores]
  );

  const handleLocateGPS = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert(language === 'en' ? 'Geolocation is not supported by your browser.' : 'Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCustomerCoords(coords);
        setLocationConfirmed(false);
        setLocationConfirmedBy('DEVICE_GPS');

        try {
          // Phân giải địa chỉ chuẩn từ tọa độ GPS thực tế
          const revData = await safeFetchJson<{
            success: boolean;
            formattedAddress?: string;
            components?: { province?: string; district?: string; ward?: string; street?: string };
          }>(`/api/geo/reverse?lat=${coords.lat}&lng=${coords.lng}`);

          if (revData?.success && revData.components) {
            setForm((prev) => ({
              ...prev,
              province: revData.components?.province || prev.province,
              district: revData.components?.district || prev.district,
              ward: revData.components?.ward || prev.ward,
              address: revData.components?.street || prev.address,
            }));
            setGeoResolvedDesc(
              revData.formattedAddress ||
                [revData.components.street, revData.components.ward, revData.components.district, revData.components.province]
                  .filter(Boolean)
                  .join(', ')
            );
          } else {
            setGeoResolvedDesc(
              language === 'en'
                ? `GPS located: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
                : `Đã định vị thành công tọa độ GPS: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
            );
          }
        } catch {
          // ignore
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        alert(
          language === 'en'
            ? 'Unable to retrieve your GPS location. Nearest branch will be estimated from your address.'
            : 'Không thể lấy vị trí GPS. Hệ thống sẽ ước tính kho gần nhất theo địa chỉ bạn nhập.'
        );
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    province: '',
    district: '',
    ward: '',
    address: '',
    note: '',
  });

  // Danh mục tỉnh / thành phố hành chính Việt Nam
  // Hiện chỉ giao tại TP. Hồ Chí Minh
  const allProvinces = useMemo(() => getProvinceNames().filter((p) => p === 'TP. Hồ Chí Minh'), []);
  const availableDistricts = useMemo(() => getDistrictsByProvince(form.province), [form.province]);
  const availableWards = useMemo(() => getWardsByDistrict(form.province, form.district), [form.province, form.district]);

  // Trạng thái gợi ý địa chỉ Google Maps Places Autocomplete
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [geoResolvedDesc, setGeoResolvedDesc] = useState<string | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown gợi ý khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Xử lý thay đổi Tỉnh / Thành phố
  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provinceVal = e.target.value;
    setForm((prev) => ({
      ...prev,
      province: provinceVal,
      district: '',
      ward: '',
    }));
    if (errors.province) {
      setErrors((prev) => ({ ...prev, province: '' }));
    }
    const coords = findPreciseCoordinates(provinceVal);
    if (coords && !pinLockedRef.current) {
      setCustomerCoords(coords);
    }
  };

  // Xử lý thay đổi Quận / Huyện
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const districtVal = e.target.value;
    setForm((prev) => ({
      ...prev,
      district: districtVal,
      ward: '',
    }));
    if (errors.district) {
      setErrors((prev) => ({ ...prev, district: '' }));
    }
    const coords = findPreciseCoordinates(form.province, districtVal);
    if (coords && !pinLockedRef.current) {
      setCustomerCoords(coords);
    }
  };

  // Xử lý thay đổi Phường / Xã
  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const wardVal = e.target.value;
    setForm((prev) => ({
      ...prev,
      ward: wardVal,
    }));
    if (errors.ward) {
      setErrors((prev) => ({ ...prev, ward: '' }));
    }
    const coords = findPreciseCoordinates(form.province, form.district, wardVal);
    if (coords && !pinLockedRef.current) {
      setCustomerCoords(coords);
    }
  };

  // Xử lý nhập số nhà, tên đường
  const handleAddressInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm((prev) => ({ ...prev, address: val }));
    if (errors.address) {
      setErrors((prev) => ({ ...prev, address: '' }));
    }
    // Xóa thông báo định vị cũ khi user gõ lại
    if (geoResolvedDesc) {
      setGeoResolvedDesc(null);
    }
  };

  // Tìm kiếm gợi ý Google Maps khi người dùng gõ số nhà / tên đường
  useEffect(() => {
    if (!form.address || form.address.trim().length < 2) {
      setSuggestions([]);
      setIsSearchingAddress(false);
      return;
    }
    if (pinLockedRef.current && form.address === pinAddressRef.current) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingAddress(true);
      try {
        // Truyền province/district/ward context để API trả kết quả chính xác theo khu vực
        const params = new URLSearchParams({ input: form.address });
        if (form.province) params.set('province', form.province);
        if (form.district) params.set('district', form.district);
        if (form.ward) params.set('ward', form.ward);

        const data = await safeFetchJson<{ success: boolean; predictions?: AutocompleteSuggestion[] }>(
          `/api/geo/autocomplete?${params.toString()}`
        );
        if (data?.success && Array.isArray(data.predictions)) {
          setSuggestions(data.predictions);
          if (data.predictions.length > 0) {
            setShowSuggestions(true);
          }
        }
      } catch (err) {
        console.error('Error fetching address suggestions:', err);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [form.address, form.ward, form.district, form.province]);

  // Geocode ngầm địa chỉ tự động chọn Tỉnh, Quận, Phường khi người dùng gõ số nhà tên đường
  useEffect(() => {
    if (pinLockedRef.current && form.address === pinAddressRef.current) {
      setTypedAddrCoords(null);
      return;
    }
    if (form.address && form.address.trim().length >= 4) {
      const timer = setTimeout(async () => {
        try {
          const defaultProv = form.province || 'TP. Hồ Chí Minh';
          const data = await safeFetchJson<{
            success: boolean;
            lat?: number;
            lng?: number;
            formattedAddress?: string;
            components?: { province?: string; district?: string; ward?: string; street?: string };
            source?: string;
          }>(
            `/api/geo/geocode?address=${encodeURIComponent(form.address)}&ward=${encodeURIComponent(
              form.ward
            )}&district=${encodeURIComponent(form.district)}&province=${encodeURIComponent(defaultProv)}`
          );
          if (data?.success) {
            if (pinLockedRef.current) {
              // Khách đã ghim: chỉ so sánh địa chỉ gõ tay với ghim, không dời ghim, không đổi Tỉnh/Quận/Phường
              setTypedAddrCoords(data.lat && data.lng ? { lat: data.lat, lng: data.lng } : null);
              if (data.formattedAddress) setGeoResolvedDesc(data.formattedAddress);
              return;
            }
            setTypedAddrCoords(null);
            if (data.lat && data.lng) {
              setCustomerCoords({ lat: data.lat, lng: data.lng });
            }
            if (data.components) {
              const newProv = data.components.province || form.province || 'TP. Hồ Chí Minh';
              const newDist = data.components.district || form.district;
              const newWard = data.components.ward || form.ward;

              const shouldUpdateWard = newWard && newWard !== form.ward;
              const shouldUpdateDist = newDist && newDist !== form.district;
              const shouldUpdateProv = newProv && newProv !== form.province;

              if (shouldUpdateWard || shouldUpdateDist || shouldUpdateProv) {
                setForm((prev) => ({
                  ...prev,
                  province: newProv,
                  district: newDist || prev.district,
                  ward: newWard || prev.ward,
                }));
                setErrors((prev) => ({
                  ...prev,
                  province: newProv ? '' : prev.province,
                  district: newDist ? '' : prev.district,
                  ward: newWard ? '' : prev.ward,
                }));
              }

              const resolvedText = [
                form.address,
                newWard || form.ward,
                newDist || form.district,
                newProv || form.province,
              ]
                .filter(Boolean)
                .join(', ');
              setGeoResolvedDesc(resolvedText);
            } else if (data.formattedAddress) {
              setGeoResolvedDesc(data.formattedAddress);
            }
          }
        } catch {
          // ignore
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [form.address, form.ward, form.district, form.province]);

  // Chọn một địa chỉ từ gợi ý Google Maps / Nominatim / Tuyến đường GPS
  const handleSelectSuggestion = async (suggestion: AutocompleteSuggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setIsSearchingAddress(true);
    try {
      // 1. Áp dụng ngay tọa độ GPS chính xác từ gợi ý (không để bước sau làm lệch tọa độ thực)
      if (suggestion.lat && suggestion.lng) {
        setCustomerCoords({ lat: suggestion.lat, lng: suggestion.lng });
        setLocationConfirmed(false);
        setLocationConfirmedBy('AUTOCOMPLETE_SUGGESTION');
      }

      // 2. Tự động điền đầy đủ và chọn ngay Tỉnh/Thành, Quận/Huyện, Phường/Xã cho người dùng (loại bỏ hoàn toàn Khu phố)
      const targetProv = suggestion.province || form.province || 'TP. Hồ Chí Minh';
      const targetDist = suggestion.district || form.district;
      const targetWard = removeKhuPho(suggestion.ward) || form.ward;
      const targetAddress = removeKhuPho(suggestion.main_text || form.address);

      setForm((prev) => ({
        ...prev,
        province: targetProv,
        district: targetDist || prev.district,
        ward: targetWard || prev.ward,
        address: targetAddress,
      }));
      setGeoResolvedDesc(removeKhuPho(suggestion.description));

      // Xóa ngay lập tức mọi cảnh báo lỗi của form địa chỉ
      setErrors((prev) => ({
        ...prev,
        province: '',
        district: '',
        ward: '',
        address: '',
      }));

      // 3. Nếu còn thiếu Quận hoặc Phường từ nguồn gợi ý, gọi geocode chuyên sâu để tự động bổ sung
      if (!targetDist || !targetWard) {
        const data = await safeFetchJson<any>(
          `/api/geo/geocode?place_id=${encodeURIComponent(suggestion.place_id)}&address=${encodeURIComponent(
            suggestion.description
          )}&province=${encodeURIComponent(targetProv)}&district=${encodeURIComponent(
            targetDist || ''
          )}&ward=${encodeURIComponent(targetWard || '')}`
        );

        if (data?.success) {
          if (data.components) {
            setForm((prev) => ({
              ...prev,
              province: data.components.province || targetProv,
              district: data.components.district || targetDist || prev.district,
              ward: removeKhuPho(data.components.ward || targetWard || prev.ward),
              address: targetAddress,
            }));
          }
          if (data.formattedAddress) {
            setGeoResolvedDesc(removeKhuPho(data.formattedAddress));
          }
        }
      }
    } catch (err) {
      console.error('Error handling selected suggestion:', err);
      if (suggestion.lat && suggestion.lng) {
        setCustomerCoords({ lat: suggestion.lat, lng: suggestion.lng });
      }
      setForm((prev) => ({
        ...prev,
        province: suggestion.province || prev.province || 'TP. Hồ Chí Minh',
        district: suggestion.district || prev.district,
        ward: suggestion.ward || prev.ward,
        address: suggestion.main_text || prev.address,
      }));
      setGeoResolvedDesc(suggestion.description);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // Kiểm tra tồn kho toàn giỏ (đã bóc combo) mỗi khi đổi chi nhánh hoặc đổi giỏ hàng / tọa độ
  const checkCartStock = useCallback(
    async (storeCode: string) => {
      if (items.length === 0) return;
      setIsStockChecking(true);
      setStockConflictError(null);
      try {
        const data = await safeFetchJson<any>('/api/inventory/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeCode,
            items,
            latitude: customerCoords?.lat,
            longitude: customerCoords?.lng,
            province: form.province,
            district: form.district,
            address: form.address,
          }),
        });
        if (data?.success) {
          setIsStockAvailable(data.isAvailable);
          setInsufficientItems(data.insufficientItems || []);
          setAlternativeStores(data.alternativeStores || []);
          setSuggestedCloserStore(data.suggestedCloserStore || null);
        }
      } catch (e) {
        console.error('Error checking cart stock:', e);
      } finally {
        setIsStockChecking(false);
      }
    },
    [items, customerCoords, form.province, form.district, form.address]
  );

  useEffect(() => {
    checkCartStock(selectedStoreCode);
  }, [selectedStoreCode, checkCartStock]);

  // Tự động điền thông tin nếu khách hàng đã đăng nhập
  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        fullName: prev.fullName || user.fullName || '',
        phone: prev.phone || user.phone || '',
        email: prev.email || user.email || '',
        address: prev.address || user.address || '',
        province: prev.province || user.province || '',
        district: prev.district || user.district || '',
        ward: prev.ward || user.ward || '',
        note: prev.note || '',
      }));
      if (user.latitude && user.longitude && !customerCoords) {
        setCustomerCoords({ lat: Number(user.latitude), lng: Number(user.longitude) });
        setLocationConfirmed(true);
        setLocationConfirmedBy('USER_SAVED_PROFILE');
      }
    }
  }, [user]);

  const subtotal = items.reduce((t, i) => t + i.price * i.quantity, 0);

  // Tính khoảng cách đến chi nhánh đang chọn
  const selectedStore = stores.find((s) => s.code === selectedStoreCode);
  let currentStoreDistanceKm: number | null = null;
  if (customerCoords && selectedStore?.latitude && selectedStore?.longitude) {
    currentStoreDistanceKm = calculateHaversineDistance(
      customerCoords.lat,
      customerCoords.lng,
      Number(selectedStore.latitude),
      Number(selectedStore.longitude)
    );
  }

  // Sắp xếp các chi nhánh theo khoảng cách tăng dần khi có tọa độ khách hàng
  const sortedStores = useMemo(() => {
    if (!customerCoords) return stores;
    return [...stores].sort((a, b) => {
      const distA =
        a.latitude && a.longitude
          ? calculateHaversineDistance(
              customerCoords.lat,
              customerCoords.lng,
              Number(a.latitude),
              Number(a.longitude)
            )
          : 99999;
      const distB =
        b.latitude && b.longitude
          ? calculateHaversineDistance(
              customerCoords.lat,
              customerCoords.lng,
              Number(b.latitude),
              Number(b.longitude)
            )
          : 99999;
      return distA - distB;
    });
  }, [stores, customerCoords]);

  // Tìm chi nhánh hiện tại trong kết quả đề xuất (nếu có) để lấy chính xác phí & ETA
  const activeRecommendedItem = useMemo(() => {
    if (!recommendData) return null;
    if (recommendData.recommended?.code === selectedStoreCode) return recommendData.recommended;
    const foundAlt = recommendData.alternatives?.find((a) => a.code === selectedStoreCode);
    if (foundAlt) return foundAlt;
    const foundOther = recommendData.others?.find((o) => o.code === selectedStoreCode);
    if (foundOther) return foundOther;
    return null;
  }, [recommendData, selectedStoreCode]);

  // Tính phí vận chuyển theo config (hỗ trợ cả bậc khoảng cách km khi bật cấu hình hoặc theo đề xuất)
  const shippingInfo = calculateShippingFee(subtotal, currentStoreDistanceKm);
  const calculatedShippingFee = useMemo(() => {
    if (fulfillmentMode === 'pickup') return 0;
    if (activeRecommendedItem && typeof activeRecommendedItem.shippingFee === 'number') {
      return activeRecommendedItem.shippingFee;
    }
    return shippingInfo.fee;
  }, [fulfillmentMode, activeRecommendedItem, shippingInfo.fee]);

  const shippingFee = calculatedShippingFee;
  const total = subtotal + shippingFee;

  // Kiểm tra nếu giỏ hàng có combo -> combo tính sau (được phép đặt dù dưới 120k)
  const hasCombo = items.some((i) => i.productId.includes('combo') || i.slug?.includes('combo'));
  const isEligibleToOrder = subtotal >= MIN_ORDER_THRESHOLD || hasCombo;
  const missingForMinOrder = Math.max(0, MIN_ORDER_THRESHOLD - subtotal);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.fullName.trim()) {
      newErrors.fullName = language === 'en' ? 'Please enter full name' : 'Vui lòng nhập họ tên';
    }
    if (!form.phone.trim()) {
      newErrors.phone = language === 'en' ? 'Please enter phone number' : 'Vui lòng nhập số điện thoại';
    } else if (!/^(0|\+84)\d{9,10}$/.test(form.phone.replace(/\s/g, ''))) {
      newErrors.phone = language === 'en' ? 'Invalid phone number' : 'Số điện thoại không hợp lệ';
    }
    if (!form.province.trim()) {
      newErrors.province = language === 'en' ? 'Please enter province/city' : 'Vui lòng nhập tỉnh/thành phố';
    }
    if (!form.district.trim()) {
      newErrors.district = language === 'en' ? 'Please enter district' : 'Vui lòng nhập quận/huyện';
    }
    if (!form.ward.trim()) {
      newErrors.ward = language === 'en' ? 'Please enter ward' : 'Vui lòng nhập phường/xã';
    }
    if (!form.address.trim()) {
      newErrors.address = language === 'en' ? 'Please enter street address' : 'Vui lòng nhập địa chỉ';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEligibleToOrder) {
      alert(
        language === 'en'
          ? 'Minimum order value is 120,000đ to proceed with ordering.'
          : 'Đơn hàng tối thiểu từ 120.000đ mới có thể tiến hành đặt hàng.'
      );
      return;
    }
    if (!validate()) return;

    // Chặn gửi đơn nếu chi nhánh thiếu hàng
    if (!isStockAvailable) {
      alert(
        language === 'en'
          ? 'The selected store does not have enough stock. Please choose an alternative store.'
          : 'Chi nhánh hiện tại không đủ tồn kho cho các món trong giỏ. Vui lòng đổi chi nhánh còn hàng bên dưới.'
      );
      return;
    }

    const generatedCode = `TSF-${Math.floor(100000 + Math.random() * 900000)}`;
    setOrderCode(generatedCode);

    setIsSubmitting(true);
    setStockConflictError(null);
    try {
      const targetStore = stores.find((s) => s.code === selectedStoreCode);

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderCode: generatedCode,
          userId: user?.id || null,
          fullName: form.fullName,
          phone: form.phone,
          email: form.email,
          province: form.province,
          district: form.district,
          ward: form.ward,
          address: form.address,
          note: form.note,
          paymentMethod,
          shippingFee,
          subtotal,
          total,
          items,
          storeCode: selectedStoreCode,
          storeAddress: targetStore?.address || null,
          latitude: customerCoords?.lat || null,
          longitude: customerCoords?.lng || null,
          locationConfirmed,
          locationConfirmedBy,
          saveDefaultAddress,
          addressNew: geoResolvedDesc || (form.address ? `${form.address}, ${form.ward}, ${form.district}, ${form.province}` : null),
          recommendedStoreId: recommendData?.recommended?.code || null,
          wasOverridden,
          rankingSnapshot: recommendData
            ? {
                recommended: recommendData.recommended,
                alternatives: recommendData.alternatives?.slice(0, 3),
              }
            : null,
          referralCode: referralCode.trim() || undefined,
        }),
      });

      // Bắt lỗi 409 Conflict: Có người vừa mua mất hàng
      if (res.status === 409) {
        let friendlyMsg = language === 'en'
          ? 'An item was just ordered by another customer. Your cart has been updated.'
          : 'Combo vừa có người đặt, hiện không còn đủ số lượng.';

        // Tự động kiểm tra lại tồn khả dụng cho từng món trong giỏ hàng và tự chỉnh số lượng
        for (const item of items) {
          try {
            const checkData = await safeFetchJson<any>('/api/inventory/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                storeCode: selectedStoreCode,
                items: [{ productId: item.productId, quantity: 1 }],
              }),
            });
            if (checkData?.success) {
              const remaining = typeof checkData.maxQuantity === 'number' ? checkData.maxQuantity : 0;
              if (item.quantity > remaining) {
                if (remaining > 0) {
                  useCartStore.getState().updateQuantity(item.productId, remaining);
                  friendlyMsg = language === 'en'
                    ? `Combo "${item.name}" was just purchased by another customer. Only ${remaining} left. Cart quantity adjusted.`
                    : `Combo "${item.name}" vừa có người đặt, hiện còn ${remaining}. Số lượng trong giỏ đã được tự động điều chỉnh.`;
                } else {
                  useCartStore.getState().updateQuantity(item.productId, 0);
                  useCartStore.getState().removeItem(item.productId);
                  friendlyMsg = language === 'en'
                    ? `Combo "${item.name}" was just purchased by another customer and is now out of stock at this store.`
                    : `Combo "${item.name}" vừa có người đặt và hiện đã hết hàng tại chi nhánh này.`;
                }
              }
            }
          } catch (err) {
            console.error('Error re-checking item after 409:', err);
          }
        }

        setStockConflictError(friendlyMsg);
        alert(friendlyMsg);
        checkCartStock(selectedStoreCode);
        return;
      }

      const data = await safeParseJson<any>(res);
      if (!res.ok || !data?.success || data?.savedToPostgres === false) {
        alert(
          data?.error ||
            data?.message ||
            (language === 'en'
              ? 'An error occurred while saving your order. Please try again!'
              : 'Có lỗi xảy ra khi lưu đơn hàng vào hệ thống. Vui lòng thử lại!')
        );
        return;
      }

      setCompletedOrder({
        fullName: form.fullName,
        phone: form.phone,
        email: form.email || user?.email,
        address: `${form.address}, ${form.ward}, ${form.district}, ${form.province}`,
        total: total,
        paymentMethod:
          language === 'en'
            ? 'Cash on Delivery (COD)'
            : 'Thanh toán tiền mặt khi nhận hàng (COD)',
        storeAddress: targetStore?.address,
      });
      setIsSubmitted(true);
      clearCart();
    } catch (err) {
      console.error('Order sync error:', err);
      alert(
        language === 'en'
          ? 'Unable to connect to server. Please try again shortly!'
          : 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau ít phút!'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted && completedOrder) {
    return (
      <div className="section-container py-12 md:py-20">
        <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-border-light text-center">
          <div className="w-20 h-20 bg-green-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-primary" />
          </div>
          <span className="inline-block px-3 py-1 text-sm uppercase tracking-wider text-green-primary bg-green-primary/10 rounded-full mb-3">
            {language === 'en' ? `Order #${orderCode}` : `Đơn hàng #${orderCode}`}
          </span>
          <h1 className="text-2xl md:text-3xl text-text-dark font-heading mb-3">
            {language === 'en' ? 'Order Placed Successfully!' : 'Đặt hàng thành công!'}
          </h1>
          <p className="text-text-muted text-sm md:text-base mb-8">
            {language === 'en' ? (
              <>
                Thank you for choosing <span className="text-green-primary text-[1.125em]">Thai Son Foods</span>. Your order is being received and processed quickly.
              </>
            ) : (
              <>
                Cảm ơn bạn đã tin tưởng chọn <span className="text-green-primary text-[1.125em]">Thái Sơn Foods</span>. Đơn hàng của bạn đang được tiếp nhận và xử lý nhanh chóng.
              </>
            )}
          </p>

          {/* Email Confirmation Notice Banner */}
          {completedOrder.email && (
            <div className="mb-6 p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-2xl text-left text-xs text-emerald-950 flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-emerald-900 mb-0.5 text-[1.125em]">
                  {language === 'en' ? 'Confirmation Email Sent!' : 'Đã gửi email xác nhận đến hộp thư!'}
                </p>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  {language === 'en'
                    ? `Order details & fresh beverage care guide have been sent to ${completedOrder.email}.`
                    : `Chi tiết từng món & cẩm nang bảo quản đồ uống tươi đã được gửi đến ${completedOrder.email}.`}
                </p>
              </div>
            </div>
          )}

          {/* Order Details Card */}
          <div className="bg-ivory/60 rounded-2xl p-5 text-left text-sm space-y-3 mb-8 border border-border-light">
            <div className="flex justify-between pb-2 border-b border-border-light">
              <span className="text-text-muted">{language === 'en' ? 'Recipient:' : 'Người nhận:'}</span>
              <span className="text-text-dark text-[1.125em]">{completedOrder.fullName}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-border-light">
              <span className="text-text-muted">{language === 'en' ? 'Phone:' : 'Số điện thoại:'}</span>
              <span className="text-text-dark text-[1.125em]">{completedOrder.phone}</span>
            </div>
            {completedOrder.email && (
              <div className="flex justify-between pb-2 border-b border-border-light">
                <span className="text-text-muted">{language === 'en' ? 'Email:' : 'Email nhận tin:'}</span>
                <span className="text-emerald-800 text-right text-[1.125em]">{completedOrder.email}</span>
              </div>
            )}
            <div className="flex justify-between pb-2 border-b border-border-light">
              <span className="text-text-muted">{language === 'en' ? 'Delivery Address:' : 'Địa chỉ giao:'}</span>
              <span className="text-text-dark text-right max-w-[280px] text-[1.125em]">{completedOrder.address}</span>
            </div>
            {completedOrder.storeAddress && (
              <div className="flex justify-between pb-2 border-b border-border-light">
                <span className="text-text-muted">{language === 'en' ? 'Fulfillment Branch:' : 'Chi nhánh tiếp nhận:'}</span>
                <span className="text-emerald-800 text-right max-w-[280px] text-[1.125em]">{completedOrder.storeAddress}</span>
              </div>
            )}
            <div className="flex justify-between pb-2 border-b border-border-light">
              <span className="text-text-muted">{language === 'en' ? 'Payment Method:' : 'Phương thức:'}</span>
              <span className="text-green-primary text-[1.125em]">{completedOrder.paymentMethod}</span>
            </div>
            <div className="flex justify-between pt-1 text-base">
              <span className="text-text-dark text-[1.125em]">{language === 'en' ? 'Total Payment:' : 'Tổng thanh toán:'}</span>
              <span className="text-green-primary text-xl">{formatPrice(completedOrder.total)}đ</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-green-primary text-white rounded-xl hover:bg-green-dark transition-colors text-base"
            >
              {language === 'en' ? 'Back to Home' : 'Về trang chủ'}
            </Link>
            <Link
              href="/#san-pham"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white border border-border text-text-dark rounded-xl hover:bg-ivory transition-colors text-base"
            >
              {language === 'en' ? 'Shop More Drinks' : 'Mua thêm thức uống'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isMounted) {
    return (
      <div className="section-container py-20 text-center">
        <div className="max-w-md mx-auto animate-pulse">
          <div className="w-16 h-16 bg-ivory-dark rounded-full mx-auto mb-4" />
          <div className="h-6 bg-ivory-dark rounded w-48 mx-auto mb-2" />
          <div className="h-4 bg-ivory-dark rounded w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="section-container py-20 text-center">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl text-text-dark font-heading mb-2">
            {language === 'en' ? 'No items in cart' : 'Không có sản phẩm'}
          </h1>
          <p className="text-text-muted mb-8">
            {language === 'en'
              ? 'Please add products to your cart before checking out.'
              : 'Vui lòng thêm sản phẩm vào giỏ hàng trước khi thanh toán.'}
          </p>
          <Link
            href="/#san-pham"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-primary text-white rounded-xl hover:bg-green-dark transition-colors text-[1.125em]"
          >
            <ArrowLeft className="w-4 h-4" />
            {language === 'en' ? 'Shop Now' : 'Mua sắm ngay'}
          </Link>
        </div>
      </div>
    );
  }

  // Chặn thanh toán nếu đơn hàng chưa đạt mức tối thiểu 120.000đ (ngoại trừ combo)
  if (!isEligibleToOrder) {
    return (
      <div className="section-container py-16 md:py-24 text-center">
        <div className="max-w-md mx-auto bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl text-text-dark font-heading mb-2">
            {language === 'en' ? 'Minimum Order Requirement Not Met' : 'Đơn hàng chưa đạt mức tối thiểu'}
          </h1>
          <p className="text-text-muted text-sm mb-3">
            {language === 'en' ? (
              <>
                Thai Son Foods applies a minimum order value of <strong className="text-[1.125em]">{formatPrice(MIN_ORDER_THRESHOLD)}đ</strong>.
              </>
            ) : (
              <>
                Thái Sơn Foods áp dụng mức đặt hàng tối thiểu từ <strong className="text-[1.125em]">{formatPrice(MIN_ORDER_THRESHOLD)}đ</strong>.
              </>
            )}
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 mb-6 font-medium text-left space-y-1">
            <p>
              • {language === 'en' ? 'Current cart total:' : 'Giá trị giỏ hàng hiện tại:'}{' '}
              <strong className="text-text-dark text-[1.125em]">{formatPrice(subtotal)}đ</strong>
            </p>
            <p>
              • {language === 'en' ? 'Need to add at least:' : 'Cần chọn thêm ít nhất:'}{' '}
              <strong className="text-amber-900 text-[1.125em]">{formatPrice(missingForMinOrder)}đ</strong>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/#san-pham"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-primary text-white rounded-xl hover:bg-green-dark transition-colors text-base"
            >
              <ArrowLeft className="w-4 h-4" />
              {language === 'en' ? 'Shop More Products' : 'Mua thêm sản phẩm'}
            </Link>
            <Link
              href="/gio-hang"
              className="inline-flex items-center justify-center px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-base"
            >
              {language === 'en' ? 'View Cart' : 'Xem lại giỏ hàng'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-container pt-4 pb-8 md:pt-5 md:pb-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-1.5 text-sm text-text-muted">
          <li>
            <Link href="/" className="hover:text-green-primary transition-colors">
              {language === 'en' ? 'Home' : 'Trang chủ'}
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href="/gio-hang" className="hover:text-green-primary transition-colors">
              {language === 'en' ? 'Shopping Cart' : 'Giỏ hàng'}
            </Link>
          </li>
          <li>/</li>
          <li className="text-text-dark font-medium">
            {language === 'en' ? 'Checkout' : 'Thanh toán'}
          </li>
        </ol>
      </nav>

      <h1 className="text-2xl md:text-3xl text-text-dark font-heading mb-8">
        {language === 'en' ? 'Checkout' : 'Thanh toán'}
      </h1>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2 space-y-5">
            {/* Account Banner (Tùy chọn đăng nhập - KHÔNG bắt buộc) */}
            {user ? (
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-forest-700 text-white flex items-center justify-center text-sm shrink-0">
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <span className="text-gray-600">
                      {language === 'en' ? 'Ordering with account:' : 'Đang đặt hàng với tài khoản:'}{' '}
                    </span>
                    <span className="text-gray-900 text-[1.125em]">{user.fullName}</span>{' '}
                    <span className="text-gray-400">({user.email})</span>
                  </div>
                </div>
                <span className="text-[12px] text-emerald-800 bg-white/90 px-2.5 py-1 rounded-lg border border-emerald-200">
                  {language === 'en' ? '✓ Auto-filled address' : '✓ Đã tự động điền địa chỉ'}
                </span>
              </div>
            ) : (
              <div className="p-3.5 bg-emerald-50/50 border border-emerald-200/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="text-gray-600">
                    <span className="text-gray-800 text-[1.125em]">
                      {language === 'en' ? 'Already have an account?' : 'Bạn đã có tài khoản Thái Sơn Foods?'}
                    </span>{' '}
                    <span className="hidden sm:inline">
                      {language === 'en'
                        ? 'Sign in to autofill your shipping details & save orders (or continue as guest below).'
                        : 'Đăng nhập để tự động điền địa chỉ & lưu đơn hàng (hoặc tiếp tục mua hàng nhanh bên dưới).'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  <a
                    href="/api/auth/google?returnUrl=/thanh-toan"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm rounded-xl transition-colors shadow-2xs"
                    title="Đăng nhập nhanh với Google"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Google</span>
                  </a>
                  <a
                    href="/api/auth/facebook?returnUrl=/thanh-toan"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1877F2] hover:bg-emerald-400 text-ink-950 text-sm rounded-xl transition-colors shadow-2xs"
                    title="Đăng nhập nhanh với Facebook"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>Facebook</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => openAuthModal('login')}
                    className="px-3 py-1.5 bg-forest-700 hover:bg-forest-800 text-white rounded-xl whitespace-nowrap transition-colors cursor-pointer text-sm"
                  >
                    {language === 'en' ? 'Email' : 'Email'}
                  </button>
                </div>
              </div>
            )}

            <h2 className="text-xl text-text-dark">
              {language === 'en' ? 'Shipping Information' : 'Thông tin giao hàng'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label htmlFor="fullName" className="block text-sm font-medium text-text-dark mb-1.5">
                  {language === 'en' ? 'Full Name' : 'Họ và tên'} <span className="text-sale">*</span>
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={form.fullName}
                  onChange={handleChange}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border bg-white text-text-dark text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30 focus:border-green-primary transition-colors',
                    errors.fullName ? 'border-sale' : 'border-border'
                  )}
                  placeholder={language === 'en' ? 'John Doe' : 'Nguyễn Văn A'}
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-sale">{errors.fullName}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-text-dark mb-1.5">
                  {language === 'en' ? 'Phone Number' : 'Số điện thoại'} <span className="text-sale">*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border bg-white text-text-dark text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30 focus:border-green-primary transition-colors',
                    errors.phone ? 'border-sale' : 'border-border'
                  )}
                  placeholder="0912 345 678"
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-sale">{errors.phone}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-dark mb-1.5 flex items-center justify-between">
                  <span>
                    Email{' '}
                    <span className="text-xs font-normal text-emerald-700">
                      {language === 'en' ? '(Receive order status updates)' : '(Nhận thông báo tình trạng đơn hàng)'}
                    </span>
                  </span>
                  {user?.email && (
                    <span className="text-[12px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {language === 'en' ? 'Account email' : 'Email từ tài khoản'}
                    </span>
                  )}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text-dark text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30 focus:border-green-primary transition-colors"
                  placeholder={user?.email || 'email@example.com'}
                />
              </div>

              {/* Province */}
              <div>
                <label htmlFor="province" className="block text-sm font-medium text-text-dark mb-1.5">
                  {language === 'en' ? 'Province / City' : 'Tỉnh / Thành phố'} <span className="text-sale">*</span>
                </label>
                <select
                  id="province"
                  name="province"
                  value={form.province}
                  onChange={handleProvinceChange}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border bg-white text-text-dark text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30 focus:border-green-primary transition-colors cursor-pointer',
                    errors.province ? 'border-sale' : 'border-border'
                  )}
                >
                  <option value="">{language === 'en' ? '-- Select Province / City --' : '-- Chọn Tỉnh / Thành phố --'}</option>
                  {allProvinces.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {errors.province && (
                  <p className="mt-1 text-xs text-sale">{errors.province}</p>
                )}
              </div>

              {/* District */}
              <div>
                <label htmlFor="district" className="block text-sm font-medium text-text-dark mb-1.5">
                  {language === 'en' ? 'District' : 'Quận / Huyện'} <span className="text-sale">*</span>
                </label>
                <select
                  id="district"
                  name="district"
                  value={form.district}
                  onChange={handleDistrictChange}
                  disabled={!form.province}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border bg-white text-text-dark text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30 focus:border-green-primary transition-colors cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed',
                    errors.district ? 'border-sale' : 'border-border'
                  )}
                >
                  <option value="">
                    {!form.province
                      ? (language === 'en' ? '-- Select Province first --' : '-- Vui lòng chọn Tỉnh/Thành trước --')
                      : (language === 'en' ? '-- Select District --' : '-- Chọn Quận / Huyện --')}
                  </option>
                  {availableDistricts.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {errors.district && (
                  <p className="mt-1 text-xs text-sale">{errors.district}</p>
                )}
              </div>

              {/* Ward */}
              <div>
                <label htmlFor="ward" className="block text-sm font-medium text-text-dark mb-1.5">
                  {language === 'en' ? 'Ward' : 'Phường / Xã'} <span className="text-sale">*</span>
                </label>
                <select
                  id="ward"
                  name="ward"
                  value={form.ward}
                  onChange={handleWardChange}
                  disabled={!form.district}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border bg-white text-text-dark text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30 focus:border-green-primary transition-colors cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed',
                    errors.ward ? 'border-sale' : 'border-border'
                  )}
                >
                  <option value="">
                    {!form.district
                      ? (language === 'en' ? '-- Select District first --' : '-- Vui lòng chọn Quận/Huyện trước --')
                      : (language === 'en' ? '-- Select Ward --' : '-- Chọn Phường / Xã --')}
                  </option>
                  {availableWards.map((w) => (
                    <option key={w.name} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
                {errors.ward && (
                  <p className="mt-1 text-xs text-sale">{errors.ward}</p>
                )}
              </div>

              {/* Address */}
              <div
                className={cn(
                  'sm:col-span-2 relative',
                  showSuggestions && suggestions.length > 0 ? 'z-50' : 'z-10'
                )}
                ref={suggestionsRef}
              >
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label htmlFor="address" className="block text-sm font-medium text-text-dark">
                    {language === 'en' ? 'House number & street name' : 'Số nhà, tên đường'}{' '}
                    <span className="text-sale">*</span>
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleLocateGPS}
                      disabled={isLocating}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[12px] rounded-lg border border-emerald-200 transition-colors disabled:opacity-60 cursor-pointer shadow-2xs"
                      title={language === 'en' ? 'Auto-detect device GPS location' : 'Định vị GPS thiết bị để tự động điền địa chỉ'}
                    >
                      <Navigation className={cn('w-3 h-3 text-emerald-600', isLocating && 'animate-spin')} />
                      <span>{isLocating ? (language === 'en' ? 'Locating...' : 'Đang lấy GPS...') : (language === 'en' ? 'Auto GPS Locate' : 'Lấy vị trí GPS')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMapModalOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[12px] rounded-lg transition-colors cursor-pointer shadow-2xs"
                      title={language === 'en' ? 'Open satellite map to adjust pin' : 'Mở bản đồ vệ tinh để chấm vị trí ghim nhà bạn'}
                    >
                      <MapPin className="w-3 h-3 text-white" />
                      <span>{language === 'en' ? 'Pin on Map' : 'Chỉnh pin bản đồ'}</span>
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    id="address"
                    name="address"
                    type="text"
                    autoComplete="off"
                    value={form.address}
                    onChange={handleAddressInputChange}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (suggestions.length > 0) {
                          handleSelectSuggestion(suggestions[0]);
                        }
                      }
                    }}
                    onBlur={() => {
                      // Nếu khách hàng gõ số nhà tên đường xong mà rời ô input, tự động chọn gợi ý VIP số 1 nếu chưa có quận/phường
                      setTimeout(() => {
                        if (suggestions.length > 0 && (!form.district || !form.ward)) {
                          handleSelectSuggestion(suggestions[0]);
                        }
                      }, 250);
                    }}
                    className={cn(
                      'w-full pl-4 pr-10 py-3 rounded-xl border bg-white text-text-dark text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30 focus:border-green-primary transition-colors',
                      errors.address ? 'border-sale' : 'border-border'
                    )}
                    placeholder={
                      language === 'en'
                        ? 'Ex: 159 Nguyen Thai Binh or 27 Van Chung...'
                        : 'Ví dụ: 159 Nguyễn Thái Bình hoặc 27 Văn Chung...'
                    }
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400 pointer-events-none">
                    {isSearchingAddress ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </div>
                </div>
                {errors.address && (
                  <p className="mt-1 text-xs text-sale">{errors.address}</p>
                )}

                {/* Dropdown Gợi ý từ Google Maps / OpenStreetMap / Tuyến đường GPS */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-[1050] bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3.5 py-2 bg-emerald-50/80 flex items-center justify-between text-[12px] text-emerald-950 border-b border-emerald-100">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        {language === 'en'
                          ? `Found ${suggestions.length} GPS suggestions`
                          : `Tìm thấy ${suggestions.length} vị trí GPS chính xác`}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-normal">
                        {language === 'en' ? 'Click to auto-fill ward & district' : 'Bấm để tự điền đúng Phường & Quận'}
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                      {suggestions.map((item, idx) => (
                        <button
                          key={`${item.place_id}_${idx}`}
                          type="button"
                          onClick={() => handleSelectSuggestion(item)}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-emerald-50/70 transition-colors flex items-start gap-2.5 cursor-pointer group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-emerald-100/90 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-200 transition-colors text-emerald-800 text-sm">
                            <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <p className="text-sm text-gray-900 group-hover:text-emerald-800">
                                {removeKhuPho(item.main_text)}
                              </p>
                              <span
                                className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded-md border shrink-0',
                                  item.source === 'google'
                                    ? 'text-blue-700 bg-blue-50 border-blue-200'
                                    : item.source === 'nominatim'
                                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                    : 'text-amber-800 bg-amber-50 border-amber-200'
                                )}
                              >
                                {item.source === 'google'
                                  ? 'Google Maps'
                                  : item.source === 'nominatim'
                                  ? 'Bản đồ OSM'
                                  : 'Tuyến đường GPS'}
                              </span>
                              {item.lat && item.lng && (
                                <span className="text-[9px] text-emerald-700 bg-emerald-50/80 px-1.5 py-0.5 rounded font-mono font-medium">
                                  GPS: {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                                </span>
                              )}
                              {(() => {
                                const nearest = getNearestBranchPreview(item.lat, item.lng);
                                if (!nearest) return null;
                                return (
                                  <span className="text-[9px] text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                                    Gần {nearest.name} ({nearest.dist.toFixed(1)} km)
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="text-[11px] text-gray-600 truncate leading-snug">
                              {removeKhuPho(item.secondary_text || item.description)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Thông báo định vị thành công */}
                {hasPinMismatch && (
                  <div className="mt-2 p-2.5 bg-amber-50 rounded-xl border border-amber-300 flex items-start gap-2 text-xs text-amber-900 shadow-2xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="mb-0.5 text-[1.125em]">
                        {language === 'en' ? 'Typed address does not match your map pin' : 'Địa chỉ đã nhập không khớp với ghim trên bản đồ'}
                      </p>
                      <p className="text-[11px] leading-snug">
                        {language === 'en'
                          ? `The pin is about ${pinMismatchKm.toFixed(1)} km from the typed address. Please check before ordering.`
                          : `Ghim đang cách địa chỉ bạn gõ khoảng ${pinMismatchKm.toFixed(1)} km. Vui lòng kiểm tra lại trước khi đặt hàng.`}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setIsMapModalOpen(true)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-800 text-white text-[12px] cursor-pointer"
                        >
                          {language === 'en' ? 'Adjust pin' : 'Chỉnh lại ghim'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (typedAddrCoords) setCustomerCoords(typedAddrCoords);
                            pinAddressRef.current = null;
                            setLocationConfirmed(false);
                            setLocationConfirmedBy('MANUAL_INPUT');
                            setTypedAddrCoords(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-amber-400 text-amber-900 text-[12px] cursor-pointer"
                        >
                          {language === 'en' ? 'Use typed address location' : 'Dùng vị trí theo địa chỉ đã gõ'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {geoResolvedDesc && !hasPinMismatch && (
                  <div className="mt-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200/90 flex items-start gap-2 text-xs text-emerald-900 shadow-2xs">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-emerald-950 mb-0.5 flex items-center justify-between text-[1.125em]">
                        <span>{language === 'en' ? 'Verified Delivery Location' : 'Đã xác định vị trí giao hàng chuẩn xác'}</span>
                        {customerCoords && (
                          <span className="text-[10px] text-emerald-700 font-mono font-normal">
                            GPS: {customerCoords.lat.toFixed(6)}, {customerCoords.lng.toFixed(6)}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-emerald-900 leading-snug">
                        {geoResolvedDesc}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* MINI-MAP XÁC NHẬN TỌA ĐỘ VỊ TRÍ GIAO HÀNG TẬN CỬA */}
              <div className="sm:col-span-2 relative z-0 isolate">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-text-dark">
                    {language === 'en' ? 'Delivery Location Map' : 'Bản đồ vị trí giao hàng'}
                  </label>
                  {customerCoords && (
                    <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      GPS: {customerCoords.lat.toFixed(5)}, {customerCoords.lng.toFixed(5)}
                    </span>
                  )}
                </div>
                <DeliveryMiniMap
                  coords={customerCoords}
                  isConfirmed={locationConfirmed}
                  addressText={form.address ? `${form.address}, ${form.ward || ''}` : undefined}
                  onOpenModal={() => setIsMapModalOpen(true)}
                />

                {/* Tùy chọn lưu làm địa chỉ mặc định cho tài khoản đã đăng nhập */}
                {user && (
                  <label className="mt-2.5 flex items-center gap-2 cursor-pointer text-xs text-gray-700 select-none">
                    <input
                      type="checkbox"
                      checked={saveDefaultAddress}
                      onChange={(e) => setSaveDefaultAddress(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 border-gray-300 cursor-pointer"
                    />
                    <span>
                      {language === 'en'
                        ? 'Save this address and GPS location as my default account address'
                        : 'Lưu địa chỉ và tọa độ GPS này làm địa chỉ mặc định cho tài khoản'}
                    </span>
                  </label>
                )}
              </div>

              {/* Note */}
              <div className="sm:col-span-2">
                <label htmlFor="note" className="block text-sm font-medium text-text-dark mb-1.5">
                  {language === 'en' ? 'Order Note' : 'Ghi chú'}
                </label>
                <textarea
                  id="note"
                  name="note"
                  value={form.note}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text-dark text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/30 focus:border-green-primary transition-colors resize-none"
                  placeholder={language === 'en' ? 'Optional order notes or delivery instructions...' : 'Ghi chú thêm cho đơn hàng...'}
                />
              </div>
            </div>

            {/* THẺ TÓM TẮT THÔNG MINH CHI NHÁNH PHỤC VỤ (Mục 18.5) */}
            <div className="pt-4 border-t border-border-light space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xl text-text-dark flex items-center gap-2">
                  <Store className="w-5 h-5 text-emerald-600" />
                  <span>
                    {language === 'en'
                      ? 'Fulfillment Store'
                      : 'Chi nhánh phục vụ đơn hàng'}
                  </span>
                </h2>

                {/* Phương thức phục vụ: Giao tận nơi */}
                <div className="inline-flex items-center px-3 py-1.5 bg-emerald-800 text-white rounded-xl text-sm gap-1.5 shadow-2xs">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Giao tận nơi</span>
                </div>
              </div>

              {/* THẺ TÓM TẮT CHI NHÁNH ĐƯỢC CHỌN / ĐỀ XUẤT */}
              <div className="p-4 sm:p-5 rounded-2xl border-2 border-emerald-600/80 bg-linear-to-br from-emerald-50/70 via-white to-emerald-50/30 shadow-xs space-y-3.5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-lg text-gray-900">
                        {activeRecommendedItem?.name || selectedStore?.name || 'Chi nhánh Thái Sơn Foods'}
                      </span>
                      {(activeRecommendedItem?.areaLabel || selectedStore?.area_label) && (
                        <span className="text-sm text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                          {activeRecommendedItem?.areaLabel || selectedStore?.area_label}
                        </span>
                      )}
                      {activeRecommendedItem?.badges?.map((b) => (
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
                              : 'bg-emerald-100 text-emerald-800'
                          )}
                        >
                          {b}
                        </span>
                      ))}
                    </div>

                    <p className="text-xs text-gray-600 line-clamp-2">
                      {activeRecommendedItem?.addressNew || selectedStore?.address_new || selectedStore?.address || 'Hệ thống Thái Sơn Foods'}
                    </p>
                  </div>

                  {/* Nút gọi điện hotline trực tiếp (màu trung tính nhẹ nhàng) */}
                  {(activeRecommendedItem?.phone || selectedStore?.phone) && (
                    <a
                      href={`tel:${activeRecommendedItem?.phone || selectedStore?.phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-xl transition-colors shrink-0"
                    >
                      <Phone className="w-3.5 h-3.5 text-gray-500" />
                      <span>{activeRecommendedItem?.phone || selectedStore?.phone}</span>
                    </a>
                  )}
                </div>

                {/* Hàng 4 thông số trọng tâm: Khoảng cách · Thời gian · Phí ship · Giờ đóng cửa */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-100/80 text-xs">
                  <div className="p-2 rounded-xl bg-white/80 border border-emerald-100 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 block">Khoảng cách</span>
                      <span className="text-gray-900 text-[1.125em]">
                        {activeRecommendedItem?.roadKm
                          ? `~ ${activeRecommendedItem.roadKm} km`
                          : currentStoreDistanceKm
                          ? `~ ${currentStoreDistanceKm.toFixed(1)} km`
                          : 'Đang ước tính'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white/80 border border-emerald-100 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 block">Thời gian giao</span>
                      <span className="text-gray-900 text-[1.125em]">
                        {activeRecommendedItem?.etaMinutes
                          ? `~ ${activeRecommendedItem.etaMinutes} phút`
                          : 'Khoảng 25-30 phút'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white/80 border border-emerald-100 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 block">Phí vận chuyển</span>
                      <span className="text-emerald-800 text-[1.125em]">
                        {fulfillmentMode === 'pickup'
                          ? '0đ (Tự nhận)'
                          : shippingFee === 0
                          ? 'Miễn phí'
                          : `${shippingFee.toLocaleString('vi-VN')}đ`}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white/80 border border-emerald-100 flex items-center gap-2">
                    <div>
                      <span className="text-[10px] text-gray-400 block">Giờ phục vụ</span>
                      <span className="text-gray-900 text-[1.125em]">
                        {activeRecommendedItem?.closesAt
                          ? `Mở đến ${activeRecommendedItem.closesAt}`
                          : '07:00 - 21:30'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Các nút hành động chính: Đổi chi nhánh khác & Chỉnh pin trên bản đồ */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-emerald-100/60 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsStoreSheetOpen(true)}
                      className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-sm rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Đổi chi nhánh khác</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsMapModalOpen(true)}
                      className="px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-sm rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Chỉnh pin trên bản đồ</span>
                    </button>
                  </div>

                  {wasOverridden && (
                    <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg font-medium">
                      (Đã đổi theo ý bạn)
                    </span>
                  )}
                </div>
              </div>

              {/* Cảnh báo nếu nằm ngoài bán kính phục vụ chuẩn của chi nhánh */}
              {fulfillmentMode === 'delivery' &&
                currentStoreDistanceKm !== null &&
                selectedStore &&
                currentStoreDistanceKm > (selectedStore.delivery_radius_km ? Number(selectedStore.delivery_radius_km) : 10) && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5 animate-in fade-in duration-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[1.125em]">Địa chỉ nhận hàng nằm ngoài bán kính giao nhanh tiêu chuẩn:</p>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Khoảng cách ước tính ~{currentStoreDistanceKm.toFixed(1)} km vượt quá bán kính phục vụ chuẩn ({selectedStore.delivery_radius_km || 10} km) của {selectedStore.name}. Quý khách vẫn có thể hoàn tất đặt đơn; nhân viên sẽ liên hệ để xác nhận thời gian &amp; cước vận chuyển phù hợp nhất.
                      </p>
                    </div>
                  </div>
                )}

              {/* Cảnh báo thiếu hàng cho chi nhánh đang chọn */}
              {!isStockAvailable && selectedStore && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 text-red-900 text-[1.125em]">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{selectedStore.name} hiện không đủ hàng cho các món trong giỏ:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                    {insufficientItems.map((it) => (
                      <li key={it.productId}>
                        <strong className="text-[1.125em]">{it.productName}</strong>: cần {it.requested}, kho chỉ còn{' '}
                        <span className="text-red-700 text-[1.125em]">{it.available}</span> chai
                      </li>
                    ))}
                  </ul>

                  {alternativeStores.length > 0 ? (
                    <div className="pt-2 border-t border-red-200/60">
                      <span className="text-emerald-950 block mb-1.5 text-sm">
                        Gợi ý các chi nhánh ĐỦ HÀNG cho cả giỏ:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {alternativeStores.map((alt) => (
                          <div
                            key={alt.code}
                            className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-emerald-200 shadow-2xs gap-2"
                          >
                            <div className="truncate min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-emerald-900 block text-sm truncate">{alt.name}</span>
                                {typeof alt.distanceKm === 'number' && (
                                  <span className="text-[11px] text-emerald-800 bg-emerald-100/90 px-1.5 py-0.2 rounded border border-emerald-300 shrink-0">
                                    ~ {alt.distanceKm} km
                                  </span>
                                )}
                              </div>
                              <span className="text-gray-500 text-[10px] truncate block mt-0.5">{alt.address}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectStore(alt.code)}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm shrink-0 cursor-pointer transition-colors shadow-2xs"
                            >
                              Đổi sang kho này
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-red-700 italic">
                      Hiện không có chi nhánh nào khác đủ toàn bộ số lượng này. Quý khách vui lòng giảm bớt số lượng hoặc liên hệ hotline để được hỗ trợ.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Payment Method - Tiền mặt khi nhận hàng (COD) */}
            <div className="pt-4 border-t border-border-light">
              <h2 className="text-xl text-text-dark mb-3">
                {language === 'en' ? 'Payment Method' : 'Phương thức thanh toán'}
              </h2>
              <div className="p-4 rounded-2xl border-2 border-emerald-600 bg-emerald-50/40 flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700 mt-0.5">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-base text-text-dark">
                    {language === 'en' ? 'Cash on Delivery (COD)' : 'Thanh toán tiền mặt khi nhận hàng (COD)'}
                  </span>
                  <span className="block text-xs text-text-muted mt-1 leading-relaxed">
                    {language === 'en'
                      ? 'Inspect fresh beverages upon arrival and pay cash directly to the courier.'
                      : 'Quý khách kiểm tra đồ uống tươi khi giao đến và thanh toán tiền mặt trực tiếp cho nhân viên giao hàng.'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl border border-border-light sticky top-[100px]">
              <h2 className="text-xl text-text-dark mb-5">
                {language === 'en' ? 'Order Summary' : 'Tóm tắt đơn hàng'}
              </h2>

              <div className="space-y-3 mb-5">
                {items.map((item) => {
                  const productMatch = products.find((p) => p.id === item.productId || p.slug === item.slug);
                  const comboMatch = combos.find((c) => c.id === item.productId || c.slug === item.slug);
                  const itemName = language === 'en'
                    ? (productMatch?.nameEn || comboMatch?.nameEn || item.name)
                    : item.name;

                  return (
                    <div key={item.productId} className="flex gap-3">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-ivory-dark shrink-0">
                        <Image
                          src={item.thumbnail}
                          alt={itemName}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-dark leading-snug">
                          {itemName}
                        </p>
                        <p className="text-xs text-text-muted">
                          x{item.quantity}
                        </p>
                      </div>
                      <p className="text-base text-text-dark whitespace-nowrap">
                        {formatPrice(item.price * item.quantity)}đ
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border-light pt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-body">{language === 'en' ? 'Subtotal' : 'Tạm tính'}</span>
                  <span className="font-medium">{formatPrice(subtotal)}đ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-body">{language === 'en' ? 'Shipping Fee' : 'Phí vận chuyển'}</span>
                  <span className="font-medium">
                    {shippingFee === 0 ? (
                      <span className="text-green-primary">
                        {language === 'en' ? 'Free' : 'Miễn phí'}
                      </span>
                    ) : (
                      `${formatPrice(shippingFee)}đ`
                    )}
                  </span>
                </div>
                <div className="border-t border-border-light pt-3 flex justify-between">
                  <span className="text-text-dark text-lg">
                    {language === 'en' ? 'Total' : 'Tổng cộng'}
                  </span>
                  <span className="text-green-primary text-2xl">
                    {formatPrice(total)}đ
                  </span>
                </div>
              </div>

              {/* Trạng thái kiểm tra tồn kho & Cảnh báo */}
              {isStockChecking ? (
                <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-700" />
                  <span>Đang kiểm tra tồn kho tại chi nhánh...</span>
                </div>
              ) : !isStockAvailable ? (
                <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 text-[1.125em]">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Chi nhánh hiện chưa đủ số lượng</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Chúng tôi đang nỗ lực điều phối để bổ sung sớm nhất. Quý khách vui lòng chọn chi nhánh khác còn hàng ở danh sách bên trái hoặc giảm số lượng để tiếp tục đặt hàng.
                  </p>
                  {alternativeStores.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectStore(alternativeStores[0].code)}
                      className="w-full mt-1 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-sm transition-colors cursor-pointer"
                    >
                      Đổi sang {alternativeStores[0].name.slice(0, 20)}... (Đủ hàng)
                    </button>
                  )}
                </div>
              ) : null}

              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitting || !isStockAvailable || isStockChecking}
                className={cn(
                  "mt-5 w-full py-3.5 px-3 text-white rounded-xl transition-all text-base flex items-center justify-center gap-2",
                  isStockAvailable && !isStockChecking
                    ? "bg-green-primary hover:bg-green-dark active:scale-[0.98] cursor-pointer shadow-md hover:shadow-lg"
                    : "bg-amber-50/90 text-amber-950 cursor-not-allowed border border-amber-300 shadow-none opacity-90"
                )}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{language === 'en' ? 'Processing order...' : 'Đang xử lý đơn hàng...'}</span>
                  </>
                ) : !isStockAvailable ? (
                  <div className="flex flex-col items-center leading-tight gap-0.5">
                    <span className="text-amber-950 text-base">
                      {language === 'en' ? 'Branch currently out of stock' : 'Chi nhánh tạm chưa đủ hàng'}
                    </span>
                    <span className="text-[11px] text-amber-800 font-normal">
                      {language === 'en'
                        ? 'We are restocking • Please switch branch'
                        : 'Đang nỗ lực điều phối • Vui lòng đổi chi nhánh'}
                    </span>
                  </div>
                ) : (
                  language === 'en' ? 'Place Order' : 'Đặt hàng'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
      {/* MODAL BẢN ĐỒ VỆ TINH PIN KÉO THẢ (Mục 4.3) */}
      <LocationConfirmMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        initialCoords={customerCoords}
        initialAddress={form.address}
        onConfirm={handleMapLocationConfirm}
      />

      {/* BOTTOM SHEET / MODAL ĐỀ XUẤT CHI NHÁNH TỐI ƯU (Mục 18.5) */}
      <StoreRecommendationSheet
        isOpen={isStoreSheetOpen}
        onClose={() => setIsStoreSheetOpen(false)}
        recommended={recommendData?.recommended || null}
        alternatives={recommendData?.alternatives || []}
        others={recommendData?.others || []}
        unavailable={recommendData?.unavailable || []}
        selectedStoreCode={selectedStoreCode}
        onSelectStore={handleSelectStore}
        mode={fulfillmentMode}
      />
    </div>
  );
}

