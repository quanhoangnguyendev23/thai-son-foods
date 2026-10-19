import { NextRequest, NextResponse } from 'next/server';
import { VIETNAM_ADDRESSES } from '@/data/vietnam-addresses';
import { calculateHaversineDistance, matchStandardAdministrative, isKhuPho, removeKhuPho } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');

    if (!latStr || !lngStr) {
      return NextResponse.json(
        { success: false, error: 'Tọa độ lat và lng là bắt buộc' },
        { status: 400 }
      );
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: 'Tọa độ không hợp lệ' },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // 1. Google Maps Reverse Geocode (nếu có key)
    if (apiKey) {
      try {
        const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=vi&key=${apiKey}`;
        const gRes = await fetch(gUrl);
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.status === 'OK' && gData.results?.[0]) {
            const first = gData.results[0];
            const components = first.address_components || [];

            let rawProv = '';
            let rawDist = '';
            let rawWard = '';
            let rawRoute = '';
            let rawStreetNum = '';

            for (const c of components) {
              const types = c.types || [];
              if (types.includes('administrative_area_level_1')) {
                rawProv = c.long_name;
              } else if (types.includes('administrative_area_level_2')) {
                rawDist = c.long_name;
              } else if (
                types.includes('sublocality_level_1') ||
                types.includes('administrative_area_level_3')
              ) {
                rawWard = c.long_name;
              } else if (types.includes('route')) {
                rawRoute = c.long_name;
              } else if (types.includes('street_number')) {
                rawStreetNum = c.long_name;
              }
            }

            const matched = matchStandardAdministrative(rawProv, rawDist, rawWard);
            const street = [rawStreetNum, rawRoute].filter(Boolean).join(' ');

            return NextResponse.json({
              success: true,
              lat,
              lng,
              formattedAddress: first.formatted_address,
              components: {
                ...matched,
                street: street || undefined,
              },
              source: 'google',
            });
          }
        }
      } catch (e) {
        console.warn('[Geo Reverse] Google reverse error:', e);
      }
    }

    // 2. OpenStreetMap Reverse Geocode
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=vi`;
      const nRes = await fetch(nomUrl, {
        headers: {
          'User-Agent': 'ThaiSonFoodsWeb/1.0 (contact@thaisonfoods.vn)',
          'Accept-Language': 'vi,en;q=0.9',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (nRes.ok) {
        const item = await nRes.json();
        if (item && item.address) {
          const addr = item.address;
          const rawProv = addr.city || addr.state || 'TP. Hồ Chí Minh';
          const rawDist = addr.city_district || addr.county || addr.suburb || '';
          let rawWard = '';

          if (addr.suburb && /^(phường|xã|thị trấn)\s+/i.test(addr.suburb)) {
            rawWard = addr.suburb;
          } else if (addr.quarter && /^(phường|xã|thị trấn)\s+/i.test(addr.quarter)) {
            rawWard = addr.quarter;
          } else if (addr.suburb && !isKhuPho(addr.suburb)) {
            rawWard = addr.suburb;
          } else {
            const candidate = addr.village || '';
            rawWard = isKhuPho(candidate) ? '' : candidate;
          }
          if (isKhuPho(rawWard)) rawWard = '';

          const rawStreet = [addr.house_number, addr.road].filter(Boolean).join(' ');
          const matched = matchStandardAdministrative(rawProv, rawDist, rawWard);

          return NextResponse.json({
            success: true,
            lat,
            lng,
            formattedAddress: removeKhuPho(item.display_name),
            components: {
              ...matched,
              ward: matched.ward && !isKhuPho(matched.ward) ? removeKhuPho(matched.ward) : undefined,
              street: removeKhuPho(rawStreet) || undefined,
            },
            source: 'nominatim',
          });
        }
      }
    } catch (e) {
      console.warn('[Geo Reverse] Nominatim reverse warning:', e);
    }

    // 3. Fallback: Tìm phường/quận gần nhất theo khoảng cách Haversine từ CSDL nội bộ
    let closestWard: { wardName: string; distName: string; provName: string; distKm: number } | null = null;

    for (const prov of VIETNAM_ADDRESSES) {
      for (const dist of prov.districts) {
        for (const w of dist.wards) {
          const wLat = w.lat || dist.lat;
          const wLng = w.lng || dist.lng;
          const d = calculateHaversineDistance(lat, lng, wLat, wLng);
          if (!closestWard || d < closestWard.distKm) {
            closestWard = {
              wardName: w.name,
              distName: dist.name,
              provName: prov.name,
              distKm: d,
            };
          }
        }
      }
    }

    if (closestWard) {
      return NextResponse.json({
        success: true,
        lat,
        lng,
        formattedAddress: `${closestWard.wardName}, ${closestWard.distName}, ${closestWard.provName}`,
        components: {
          province: closestWard.provName,
          district: closestWard.distName,
          ward: closestWard.wardName,
        },
        source: 'local_nearest',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Không thể phân giải vị trí từ tọa độ GPS' },
      { status: 404 }
    );
  } catch (err: any) {
    console.error('[Geo Reverse] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Lỗi máy chủ phân giải tọa độ GPS' },
      { status: 500 }
    );
  }
}
