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
import { calculateHaversineDistance } from '@/lib/geo';

interface LocationConfirmMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCoords?: { lat: number; lng: number } | null;
  initialAddress?: string;
  onConfirm: (confirmed: {
    lat: number;
    lng: number;
    formattedAddress: string;
    components?: { province?: string; district?: string; ward?: string; street?: string };
    confidence: 'high' | 'medium' | 'low';
  }) => void;
}

export default function LocationConfirmMapModal({
  isOpen,
  onClose,
  initialCoords,
  initialAddress,
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

  const originalCoords = useRef<{ lat: number; lng: number }>(
    initialCoords || { lat: 10.7769, lng: 106.7009 }
  );

  // Giá trị ban đầu chỉ đọc lúc mở popup; thay đổi props khi đang mở không được dựng lại bản đồ (làm nhảy ghim)
  const initialCoordsRef = useRef(initialCoords);
  const initialAddressRef = useRef(initialAddress);
  initialCoordsRef.current = initialCoords;
  initialAddressRef.current = initialAddress;

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const initialCoords = initialCoordsRef.current;
    const initialAddress = initialAddressRef.current;
    let isMounted = true;

    async function initMap() {
      const L = (await import('leaflet')).default;

      if (!mapContainerRef.current) return;

      const startLat = initialCoords?.lat || 10.7769;
      const startLng = initialCoords?.lng || 106.7009;
      originalCoords.current = { lat: startLat, lng: startLng };

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
      const streetTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
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
          const distKm = calculateHaversineDistance(
            originalCoords.current.lat,
            originalCoords.current.lng,
            c.lat,
            c.lng
          );
          setDistanceShiftMeters(Math.round(distKm * 1000));
        }
      });

      map.on('moveend', async () => {
        if (!isMounted) return;
        setIsDragging(false);
        const c = map.getCenter();
        setCenterCoords({ lat: c.lat, lng: c.lng });

        // Reverse geocode khi dừng kéo
        setIsReverseGeocoding(true);
        try {
          const rev = await safeFetchJson<any>(`/api/geo/reverse?lat=${c.lat}&lng=${c.lng}`);
          if (rev?.success) {
            // Giữ lại số nhà/hẻm khách đã nhập trước đó nếu reverse geocode chỉ trả về tên đường chung chung
            let finalStreet = rev.components?.street || '';
            const houseMatch = (initialAddress || '').match(/^([0-9]+[A-Za-z0-9\/\-\.]*)/);
            if (houseMatch && houseMatch[1] && finalStreet && !finalStreet.startsWith(houseMatch[1])) {
              finalStreet = `${houseMatch[1]} ${finalStreet}`;
            }

            const updatedComponents = {
              ...rev.components,
              street: finalStreet || rev.components?.street,
            };
            setAddressComponents(updatedComponents);

            if (rev.formattedAddress) {
              let displayAddr = rev.formattedAddress;
              if (houseMatch && houseMatch[1] && !displayAddr.startsWith(houseMatch[1])) {
                displayAddr = `${houseMatch[1]} ${displayAddr}`;
              }
              setResolvedAddress(displayAddr);
            }
          }
        } catch {
          // Khi reverse geocoding lỗi, vẫn giữ nguyên tọa độ ghim và địa chỉ thủ công của khách
        } finally {
          setIsReverseGeocoding(false);
        }
      });

      if (isMounted) setMapReady(true);
    }

    initMap();

    return () => {
      isMounted = false;
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
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
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

  const handleConfirm = () => {
    const confidence = distanceShiftMeters > 200 ? 'medium' : 'high';
    onConfirm({
      lat: centerCoords.lat,
      lng: centerCoords.lng,
      formattedAddress: resolvedAddress || initialAddress || '',
      components: addressComponents,
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
            {/* Nút bật/tắt lớp vệ tinh */}
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
            <p className="text-base text-gray-900 truncate">
              {resolvedAddress || initialAddress || 'Đang cập nhật địa chỉ...'}
            </p>
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
              className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-base shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Xác nhận vị trí</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
