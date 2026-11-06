'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  X,
  Layers,
  Navigation,
  Check,
  AlertTriangle,
  Loader2,
  Compass,
  Building,
} from 'lucide-react';
import { cn, safeFetchJson } from '@/lib/utils';
import { distanceMeters as distanceBetween } from '@/lib/address/normalize';
import { formatAdminLine } from '@/lib/address/admin';

/** Khoảng cách chính xác tới từng mét (hàm trong lib/geo làm tròn 0,1 km nên không đo được vài chục mét) */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return distanceBetween({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
}

type AddressComponents = { province?: string; district?: string; ward?: string; street?: string };

/** Tách "Số 12A/3 Phổ Quang" -> { house: "12A/3", rest: "Phổ Quang" } */
function splitHouseNumber(text?: string): { house: string; rest: string } {
  const t = (text || '').trim();
  const m = t.match(/^(?:số\s*)?(\d+[A-Za-z0-9\/\-\.]*)\s+(.+)$/i);
  return m ? { house: m[1], rest: m[2].trim() } : { house: '', rest: t };
}

function normalizeRoad(text?: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/^(duong|pho)\s+/, '')
    .split(',')[0]
    .trim();
}

/** Cùng 1 con đường (bỏ dấu, bỏ chữ "Đường/Phố", chấp nhận "Hẻm 12 Phổ Quang" ~ "Phổ Quang") */
function isSameRoad(a?: string, b?: string): boolean {
  const x = normalizeRoad(a);
  const y = normalizeRoad(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return (x.length >= 4 && y.includes(x)) || (y.length >= 4 && x.includes(y));
}

/**
 * Dòng "Số nhà, tên đường" theo điểm ghim.
 * - Khách chưa dời ghim mà đã gõ địa chỉ: giữ nguyên (trả undefined).
 * - Bản đồ có số nhà tại điểm ghim: dùng số nhà đó (ghim lại số 2 -> "2 abc").
 * - Bản đồ không có số nhà nhưng vẫn cùng con đường khách gõ: giữ số nhà khách gõ (khách chỉ chỉnh ghim cho đúng chỗ).
 * - Sang đường khác mà không có số nhà: chỉ điền tên đường, nhắc khách gõ thêm số nhà.
 */
function buildStreetFromPin(
  rev: { street?: string; houseNumber?: string; road?: string },
  typedAddress: string,
  shiftMeters: number
): { street?: string; houseNote: 'none' | 'missing' | 'kept' | 'noRoad' } {
  const typed = (typedAddress || '').trim();
  if (typed && shiftMeters < 5) return { street: undefined, houseNote: 'none' };

  const revSplit = splitHouseNumber(rev.street);
  const road = rev.road || revSplit.rest;
  const revHouse = rev.houseNumber || revSplit.house;
  // Điểm ghim không nằm trên con đường nào (quảng trường, vòng xoay...): giữ địa chỉ cũ nhưng nhắc kiểm tra
  if (!road) return { street: undefined, houseNote: shiftMeters >= 30 ? 'noRoad' : 'none' };

  const t = splitHouseNumber(typed);
  // Chỉ nhích ghim vài mét trên cùng con đường: khách đang canh lại cửa nhà, giữ số nhà đã gõ
  if (t.house && shiftMeters < 15 && isSameRoad(t.rest, road)) {
    return { street: typed, houseNote: 'none' };
  }
  if (revHouse) return { street: `${revHouse} ${road}`, houseNote: 'none' };

  if (t.house && isSameRoad(t.rest, road)) {
    // Giữ nguyên cách khách viết tên đường (vd. hẻm "12/5 Phổ Quang")
    return { street: typed, houseNote: 'kept' };
  }
  return { street: road, houseNote: 'missing' };
}

interface LocationConfirmMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCoords?: { lat: number; lng: number } | null;
  initialAddress?: string;
  /** Điểm bắt đầu chỉ là gần đúng (tâm phường): khách phải kéo ghim đi chỗ khác rồi mới xác nhận được */
  requireMove?: boolean;
  /** Bản đồ nền không tải được hoặc không tra được địa chỉ tại ghim: báo cho trang để mở đường lui "gọi xác nhận" */
  onMapError?: (code: 'TILES_FAILED' | 'REVERSE_FAILED') => void;
  onConfirm: (confirmed: {
    lat: number;
    lng: number;
    formattedAddress: string;
    components?: { province?: string; district?: string; ward?: string; street?: string };
    confidence: 'high' | 'medium' | 'low';
  }) => void;
}

/** Lớp ảnh vệ tinh Esri: chỉ bật khi đã có giấy phép thương mại của Esri (NEXT_PUBLIC_MAP_SATELLITE=1). */
const SATELLITE_ENABLED = process.env.NEXT_PUBLIC_MAP_SATELLITE === '1';

export default function LocationConfirmMapModal({
  isOpen,
  onClose,
  initialCoords,
  initialAddress,
  requireMove = false,
  onMapError,
  onConfirm,
}: LocationConfirmMapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [centerCoords, setCenterCoords] = useState<{ lat: number; lng: number }>(
    initialCoords || { lat: 10.7769, lng: 106.7009 }
  );
  const [isSatellite, setIsSatellite] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string>(initialAddress || '');
  const [addressComponents, setAddressComponents] = useState<{
    province?: string;
    district?: string;
    ward?: string;
    street?: string;
  }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [distanceShiftMeters, setDistanceShiftMeters] = useState(0);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const userDotRef = useRef<any>(null);
  // Điểm ghim chưa có số nhà trên bản đồ: nhắc khách tự bổ sung / kiểm tra số nhà đang giữ
  const [houseNote, setHouseNote] = useState<'none' | 'missing' | 'kept' | 'noRoad'>('none');
  const [isConfirming, setIsConfirming] = useState(false);
  // Phân giải địa chỉ tại 1 tọa độ; bỏ kết quả cũ nếu khách đã kéo tiếp
  const resolveAtRef = useRef<
    ((lat: number, lng: number) => Promise<{ components: AddressComponents; display: string } | null>) | null
  >(null);
  const resolvedForRef = useRef<{ lat: number; lng: number; components: AddressComponents; display: string } | null>(null);
  const reverseSeqRef = useRef(0);

  const originalCoords = useRef<{ lat: number; lng: number }>(
    initialCoords || { lat: 10.7769, lng: 106.7009 }
  );

  // Giá trị ban đầu chỉ đọc lúc mở popup; thay đổi props khi đang mở không được dựng lại bản đồ (làm nhảy ghim)
  const onMapErrorRef = useRef(onMapError);
  const initialCoordsRef = useRef(initialCoords);
  const initialAddressRef = useRef(initialAddress);
  // Cập nhật ref sau khi render (không ghi ref trong lúc render); khai báo trước effect khởi tạo bản đồ để giữ thứ tự chạy
  useEffect(() => {
    onMapErrorRef.current = onMapError;
    initialCoordsRef.current = initialCoords;
    initialAddressRef.current = initialAddress;
  });

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const initialCoords = initialCoordsRef.current;
    const initialAddress = initialAddressRef.current;
    let isMounted = true;
    // Chỉ hỏi địa chỉ tại ghim SAU KHI dừng kéo 400 ms và ghim đã dời ≥ 5 m (không hỏi khi zoom bằng nút, không hỏi mỗi lần map di chuyển)
    let moveTimer: ReturnType<typeof setTimeout> | null = null;
    let lastResolved: { lat: number; lng: number } = { lat: 0, lng: 0 };

    async function initMap() {
      const L = (await import('leaflet')).default;

      if (!mapContainerRef.current) return;

      const startLat = initialCoords?.lat || 10.7769;
      const startLng = initialCoords?.lng || 106.7009;
      originalCoords.current = { lat: startLat, lng: startLng };
      // Mở lại popup: bắt đầu từ điểm ghim hiện tại, bỏ kết quả của lần mở trước
      setCenterCoords({ lat: startLat, lng: startLng });
      setDistanceShiftMeters(0);
      setAddressComponents({});
      setResolvedAddress(initialAddress || '');
      setHouseNote('none');

      // Hủy map cũ nếu đã tồn tại
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLng],
        zoom: 17,
        zoomControl: false,
      });

      // Thêm nút zoom ở góc dưới phải
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Lớp tile bản đồ đường phố mặc định (OpenStreetMap Standard)
      const streetTile = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      });

      // Đếm ô bản đồ lỗi: lỗi liên tiếp nhiều ô = nền bản đồ không dùng được
      let tileErrors = 0;
      streetTile.on('tileerror', () => {
        tileErrors++;
        if (tileErrors === 6) onMapErrorRef.current?.('TILES_FAILED');
      });
      streetTile.on('tileload', () => {
        tileErrors = 0;
      });
      streetTile.addTo(map);
      tileLayerRef.current = streetTile;
      mapInstanceRef.current = map;

      // Xử lý sự kiện kéo bản đồ
      map.on('movestart', () => {
        if (isMounted) setIsDragging(true);
      });

      map.on('move', () => {
        const c = map.getCenter();
        if (isMounted) {
          setCenterCoords({ lat: c.lat, lng: c.lng });
          setDistanceShiftMeters(
            distanceMeters(originalCoords.current.lat, originalCoords.current.lng, c.lat, c.lng)
          );
        }
      });

      // Reverse geocode 1 điểm ghim -> số nhà, tên đường, phường, quận
      const resolveAt = async (lat: number, lng: number) => {
        const seq = ++reverseSeqRef.current;
        setIsReverseGeocoding(true);
        try {
          const rev = await safeFetchJson<any>(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
          if (isMounted && seq === reverseSeqRef.current && !rev?.success) onMapErrorRef.current?.('REVERSE_FAILED');
          if (!isMounted || seq !== reverseSeqRef.current || !rev?.success) return null;
          const shiftMeters = distanceMeters(originalCoords.current.lat, originalCoords.current.lng, lat, lng);
          const { street, houseNote: note } = buildStreetFromPin(
            rev.components || {},
            initialAddress || '',
            shiftMeters
          );
          const components: AddressComponents = {
            province: rev.components?.province,
            district: rev.components?.district,
            ward: rev.components?.ward,
            street,
          };
          const display =
            [street || initialAddress, components.ward, components.district, components.province]
              .filter((part, i, arr) => !!part && arr.indexOf(part) === i)
              .join(', ') || rev.formattedAddress || '';
          setAddressComponents(components);
          setResolvedAddress(display);
          setHouseNote(note);
          resolvedForRef.current = { lat, lng, components, display };
          return { components, display };
        } catch {
          if (isMounted) onMapErrorRef.current?.('REVERSE_FAILED');
          // Khi reverse geocoding lỗi, vẫn giữ nguyên tọa độ ghim và địa chỉ thủ công của khách
          return null;
        } finally {
          if (isMounted && seq === reverseSeqRef.current) setIsReverseGeocoding(false);
        }
      };
      resolveAtRef.current = resolveAt;
      resolvedForRef.current = null;

      lastResolved = { lat: startLat, lng: startLng };
      map.on('moveend', () => {
        if (!isMounted) return;
        setIsDragging(false);
        const c = map.getCenter();
        setCenterCoords({ lat: c.lat, lng: c.lng });
        if (distanceMeters(lastResolved.lat, lastResolved.lng, c.lat, c.lng) < 5) return;
        if (moveTimer) clearTimeout(moveTimer);
        moveTimer = setTimeout(() => {
          moveTimer = null;
          if (!isMounted) return;
          lastResolved = { lat: c.lat, lng: c.lng };
          void resolveAt(c.lat, c.lng);
        }, 400);
      });

      if (isMounted) setMapReady(true);

      // Đã có tọa độ sẵn: lấy luôn địa chỉ tại điểm ghim hiện tại (khách xác nhận ngay không cần kéo)
      if (initialCoords) {
        resolveAt(startLat, startLng);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (moveTimer) clearTimeout(moveTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Xin quyền vị trí khi mở popup để hiện chấm xanh "bạn đang ở đây" (không tự dời ghim)
  useEffect(() => {
    if (!isOpen || typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocationDenied(false);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocationDenied(false);
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      () => setLocationDenied(true),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOpen]);

  // Vẽ / cập nhật chấm xanh vị trí hiện tại của khách trên bản đồ
  useEffect(() => {
    if (!mapReady || !userPos || !mapInstanceRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      const map = mapInstanceRef.current;
      if (cancelled || !map) return;
      if (userDotRef.current) {
        try { map.removeLayer(userDotRef.current); } catch {}
      }
      const dot = L.layerGroup([
        L.circle([userPos.lat, userPos.lng], {
          radius: Math.min(userPos.accuracy || 30, 200),
          color: 'var(--color-emerald-400)',
          weight: 1,
          fillColor: 'var(--color-emerald-400)',
          fillOpacity: 0.15,
          interactive: false,
        }),
        L.circleMarker([userPos.lat, userPos.lng], {
          radius: 8,
          color: '#ffffff',
          weight: 3,
          fillColor: 'var(--color-emerald-400)',
          fillOpacity: 1,
          interactive: false,
        }),
      ]).addTo(map);
      userDotRef.current = dot;
    })();
    return () => {
      cancelled = true;
    };
  }, [mapReady, userPos]);

  // Chuyển đổi lớp bản đồ Đường phố vs Vệ tinh
  const toggleSatellite = useCallback(async () => {
    if (!mapInstanceRef.current) return;
    const L = (await import('leaflet')).default;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    if (!isSatellite) {
      // Bật lớp vệ tinh Esri World Imagery với attribution chuẩn
      const satLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
          maxZoom: 19,
        }
      );
      satLayer.addTo(mapInstanceRef.current);
      tileLayerRef.current = satLayer;
      setIsSatellite(true);
    } else {
      // Về lớp đường phố OpenStreetMap Standard
      const streetLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      });
      streetLayer.addTo(mapInstanceRef.current);
      tileLayerRef.current = streetLayer;
      setIsSatellite(false);
    }
  }, [isSatellite]);

  // Định vị GPS thiết bị hiện tại
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const { latitude, longitude } = pos.coords;
        mapInstanceRef.current.setView([latitude, longitude], 18, { animate: true });
      },
      () => {
        setIsLocatingUser(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const handleConfirm = async () => {
    const confidence = distanceShiftMeters > 200 ? 'medium' : 'high';
    let components = addressComponents;
    let display = resolvedAddress;
    // Địa chỉ chưa kịp cập nhật theo điểm ghim cuối cùng: đợi phân giải xong rồi mới xác nhận
    const done = resolvedForRef.current;
    const isFresh =
      done && Math.abs(done.lat - centerCoords.lat) < 1e-6 && Math.abs(done.lng - centerCoords.lng) < 1e-6;
    if (isFresh && done) {
      components = done.components;
      display = done.display;
    } else if (resolveAtRef.current) {
      setIsConfirming(true);
      const r = await resolveAtRef.current(centerCoords.lat, centerCoords.lng);
      setIsConfirming(false);
      if (r) {
        components = r.components;
        display = r.display;
      }
    }
    onConfirm({
      lat: centerCoords.lat,
      lng: centerCoords.lng,
      formattedAddress: display || initialAddress || '',
      components,
      confidence,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-0 sm:p-4 bg-ink-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full h-full sm:h-[90vh] sm:max-w-3xl bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-[1.125em]">
              <MapPin className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-gray-900 text-base sm:text-lg leading-tight">
                Xác nhận vị trí giao hàng chính xác
              </h3>
              <p className="text-[11px] text-gray-500">
                Kéo bản đồ để đặt pin chính xác vào cổng hoặc cửa nhà bạn
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

        {/* Khung bản đồ tương tác */}
        <div className="relative flex-1 w-full bg-gray-100 overflow-hidden">
          <div ref={mapContainerRef} className="relative z-0 w-full h-full" />

          {/* PIN CỐ ĐỊNH Ở TRUNG TÂM (Grab/ShopeeFood style) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-20 flex flex-col items-center">
            {/* Nhãn trên pin */}
            <div
              className={cn(
                'px-2.5 py-1 rounded-full text-[12px] shadow-lg mb-1 whitespace-nowrap transition-all flex items-center gap-1',
                isDragging
                  ? 'bg-amber-500 text-ink-950 scale-105'
                  : 'bg-emerald-800 text-white'
              )}
            >
              <span>Shipper sẽ giao đến đây</span>
            </div>

            {/* Icon Pin với hiệu ứng nhấc lên khi kéo */}
            <div
              className={cn(
                'transition-transform duration-150',
                isDragging ? '-translate-y-2 scale-110' : 'translate-y-0'
              )}
            >
              <svg width="40" height="48" viewBox="0 0 24 30" fill="none">
                <path
                  d="M12 0C5.373 0 0 5.373 0 12c0 9 12 18 12 18s12-9 12-18c0-6.627-5.373-12-12-12z"
                  fill="var(--color-emerald-700)"
                />
                <circle cx="12" cy="11" r="5" fill="#ffffff" />
                <circle cx="12" cy="11" r="2.5" fill="var(--color-forest-700)" />
              </svg>
            </div>

            {/* Bóng đổ của Pin */}
            <div
              className={cn(
                'w-4 h-1.5 bg-ink-950/30 rounded-full blur-[1px] transition-all',
                isDragging ? 'scale-75 opacity-40' : 'scale-100 opacity-70'
              )}
            />
          </div>

          {/* Các nút điều khiển nổi trên bản đồ */}
          <div className="absolute top-3 right-3 z-30 flex flex-col gap-2">
            {/* Nút bật/tắt lớp vệ tinh: ảnh Esri dùng cho site thương mại cần giấy phép trả phí, nên mặc định ẩn;
                bật bằng NEXT_PUBLIC_MAP_SATELLITE=1 khi đã có giấy phép (xem docs/DEPLOY-DIA-CHI.md) */}
            {SATELLITE_ENABLED && (
            <button
              type="button"
              onClick={toggleSatellite}
              className={cn(
                'px-3 py-2 rounded-xl text-sm shadow-md flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md',
                isSatellite
                  ? 'bg-emerald-800 text-white'
                  : 'bg-white/95 text-gray-700 hover:bg-white'
              )}
              title="Chuyển đổi lớp vệ tinh / đường phố"
            >
              <Layers className="w-4 h-4" />
              <span>{isSatellite ? 'Vệ tinh' : 'Bản đồ'}</span>
            </button>
            )}

            {/* Nút định vị vị trí hiện tại */}
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={isLocatingUser}
              className="p-2.5 rounded-xl bg-white/95 text-gray-700 hover:bg-white shadow-md transition-all cursor-pointer disabled:opacity-50"
              title="Định vị vị trí thiết bị của bạn"
            >
              {isLocatingUser ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <Navigation className="w-4 h-4 text-emerald-700" />
              )}
            </button>
          </div>

          {/* Chú thích chấm xanh vị trí của khách / nhắc bật định vị */}
          {userPos ? (
            <div className="absolute bottom-3 left-3 z-30 px-2.5 py-1.5 rounded-xl bg-white/95 text-[12px] text-gray-700 shadow-md flex items-center gap-1.5 backdrop-blur-md pointer-events-none">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-white shadow" />
              <span>Chấm xanh: vị trí hiện tại của bạn</span>
            </div>
          ) : locationDenied ? (
            <div className="absolute bottom-3 left-3 right-16 sm:right-auto sm:max-w-xs z-30 px-2.5 py-1.5 rounded-xl bg-white/95 text-[11px] text-gray-700 shadow-md backdrop-blur-md">
              Bật quyền vị trí của trình duyệt để thấy chấm xanh nơi bạn đang đứng, giúp ghim chính xác hơn.
            </div>
          ) : null}

          {/* Cảnh báo nếu khách kéo lệch quá 150m */}
          {distanceShiftMeters > 150 && (
            <div className="absolute top-3 left-3 right-16 sm:right-auto sm:max-w-xs z-30 p-2.5 rounded-xl bg-amber-500/95 text-ink-950 text-xs shadow-lg flex items-center gap-2 backdrop-blur-xs animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
              <span>Đang lệch ~{distanceShiftMeters}m so với vị trí tìm kiếm. Hãy chắc chắn đây là đúng nhà bạn.</span>
            </div>
          )}
        </div>

        {/* Footer: Thông tin địa chỉ & Nút xác nhận */}
        <div className="p-4 bg-white border-t border-gray-100 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-0.5">
              <span>Tọa độ xác nhận:</span>
              <span className="font-mono text-emerald-800 text-[1.125em]">
                {centerCoords.lat.toFixed(6)}, {centerCoords.lng.toFixed(6)}
              </span>
              {isReverseGeocoding && <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />}
            </div>
            {/* Phường tại ghim, cập nhật sau khi dừng kéo (khi tra địa chỉ xong) */}
            {addressComponents.ward && !isReverseGeocoding && (
              <p className="text-xs text-emerald-800 mb-0.5">
                Ghim đang ở {formatAdminLine({ ward: addressComponents.ward, district: addressComponents.district, province: addressComponents.province })}
              </p>
            )}
            <p className="text-base text-gray-900 truncate">
              <span className="text-xs text-gray-500">Vị trí ghim: </span>
              {resolvedAddress || initialAddress || 'Đang cập nhật địa chỉ...'}
            </p>
            <p className="text-2xs text-gray-500 mt-0.5">
              Xác nhận chỉ lưu vị trí ghim. Nếu địa chỉ tại ghim khác chữ bạn đã nhập, trang sẽ hỏi bạn có dùng địa chỉ này không.
            </p>
            {requireMove && distanceShiftMeters < 5 && (
              <p className="text-2xs text-amber-800 mt-0.5">
                Điểm này mới là vị trí gần đúng của khu vực. Hãy kéo bản đồ để đặt ghim vào đúng cổng hoặc cửa nhà bạn rồi mới xác nhận.
              </p>
            )}
            {houseNote !== 'none' && !isReverseGeocoding && (
              <p className="text-[11px] text-amber-800 mt-0.5">
                {houseNote === 'kept'
                  ? 'Bản đồ chưa có số nhà tại điểm này nên đang giữ số nhà bạn đã gõ. Nếu khác, bạn sửa lại trong ô địa chỉ nhé.'
                  : houseNote === 'noRoad'
                  ? 'Điểm ghim không nằm trên con đường nào nên đang giữ địa chỉ cũ. Hãy kéo ghim vào đúng cửa nhà hoặc sửa lại ô địa chỉ.'
                  : 'Bản đồ chưa có số nhà tại điểm này. Sau khi xác nhận, bạn gõ thêm số nhà vào ô địa chỉ nhé.'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-base transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirming || (requireMove && distanceShiftMeters < 5)}
              className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-base shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-70"
            >
              {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Xác nhận vị trí</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
