import { NextRequest, NextResponse } from 'next/server';
import { findPreciseCoordinates, VIETNAM_ADDRESSES } from '@/data/vietnam-addresses';
import { findStreetCoordinates } from '@/data/vietnam-streets';
import { matchStandardAdministrative, isKhuPho, removeKhuPho } from '@/lib/geo';

export const dynamic = 'force-dynamic';

function cleanComponent(val: string): string {
  return val.replace(/^(Thành phố|Tỉnh|Quận|Huyện|Thị xã|Phường|Xã|Thị trấn|Khu phố|Tổ dân phố|KP|Tổ)\s+/i, '').trim();
}

/**
 * Khớp tên hành chính với danh mục chuẩn VIETNAM_ADDRESSES
 */
function extractStreetFromAddress(fullAddr?: string): string | undefined {
  if (!fullAddr) return undefined;
  const cleaned = removeKhuPho(fullAddr);
  const parts = cleaned.split(',').map((p) => p.trim());
  const streetParts = parts.filter(
    (p) =>
      !/^(phường|xã|thị trấn|quận|huyện|thị xã|tp\.?|thành phố|khu phố|kp|tổ\s+\d+|tỉnh|việt nam)\b/i.test(p)
  );
  if (streetParts.length > 0) {
    return removeKhuPho(streetParts.join(', '));
  }
  return removeKhuPho(parts[0]);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get('place_id');
    const address = searchParams.get('address')?.trim();
    const provinceParam = searchParams.get('province')?.trim();
    const districtParam = searchParams.get('district')?.trim();
    const wardParam = searchParams.get('ward')?.trim();

    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // 1. Nếu có Google Maps API Key và có place_id
    if (apiKey && placeId && !placeId.startsWith('nom_') && !placeId.startsWith('loc_')) {
      try {
        const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry,formatted_address,address_components&language=vi&key=${apiKey}`;
        const gRes = await fetch(placeDetailsUrl);
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.status === 'OK' && gData.result?.geometry?.location) {
            const loc = gData.result.geometry.location;
            const components = gData.result.address_components || [];

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

            const matched = matchStandardAdministrative(
              rawProv || provinceParam,
              rawDist || districtParam,
              rawWard || wardParam
            );

            const street = [rawStreetNum, rawRoute].filter(Boolean).join(' ');

            return NextResponse.json({
              success: true,
              lat: loc.lat,
              lng: loc.lng,
              formattedAddress: gData.result.formatted_address,
              components: {
                ...matched,
                street: street || undefined,
              },
              source: 'google',
            });
          }
        }
      } catch (e) {
        console.warn('Google Place Details error, falling back:', e);
      }
    }

    // 2. Nếu có Google Maps API Key và có address query
    if (apiKey && address) {
      try {
        const fullQuery = [address, wardParam, districtParam, provinceParam, 'Vietnam']
          .filter(Boolean)
          .join(', ');
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          fullQuery
        )}&components=country:VN&language=vi&key=${apiKey}`;

        const gRes = await fetch(geocodeUrl);
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.status === 'OK' && gData.results?.[0]?.geometry?.location) {
            const result = gData.results[0];
            const loc = result.geometry.location;
            const components = result.address_components || [];

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

            const matched = matchStandardAdministrative(
              rawProv || provinceParam,
              rawDist || districtParam,
              rawWard || wardParam
            );

            const street = [rawStreetNum, rawRoute].filter(Boolean).join(' ');

            return NextResponse.json({
              success: true,
              lat: loc.lat,
              lng: loc.lng,
              formattedAddress: result.formatted_address,
              components: {
                ...matched,
                street: street || undefined,
              },
              source: 'google',
            });
          }
        }
      } catch (e) {
        console.warn('Google Geocode error, falling back:', e);
      }
    }

    // 3. Fallback: OpenStreetMap Nominatim
    const searchTarget = address
      ? [address, wardParam, districtParam, provinceParam, 'Việt Nam']
          .filter(Boolean)
          .join(', ')
      : [wardParam, districtParam, provinceParam, 'Việt Nam']
          .filter(Boolean)
          .join(', ');

    if (searchTarget) {
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          searchTarget
        )}&format=json&countrycodes=vn&addressdetails=1&limit=1`;

        const nRes = await fetch(nomUrl, {
          headers: {
            'User-Agent': 'ThaiSonFoodsWeb/1.0 (contact@thaisonfoods.vn)',
            'Accept-Language': 'vi,en;q=0.9',
          },
          signal: AbortSignal.timeout(3500),
        });

        if (nRes.ok) {
          const nData = await nRes.json();
          if (Array.isArray(nData) && nData.length > 0) {
            const item = nData[0];
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            const addr = item.address || {};

            const rawProv = addr.city || addr.state || provinceParam;
            let rawDist = addr.city_district || addr.county || districtParam;
            let rawWard = wardParam;

            // Xử lý suburb/quarter trong OpenStreetMap Việt Nam (loại bỏ hoàn toàn Khu phố)
            if (addr.suburb && /^(phường|xã|thị trấn)\s+/i.test(addr.suburb)) {
              rawWard = addr.suburb;
            } else if (addr.quarter && /^(phường|xã|thị trấn)\s+/i.test(addr.quarter)) {
              rawWard = addr.quarter;
            } else if (addr.suburb && !isKhuPho(addr.suburb)) {
              if (rawDist && rawDist !== addr.suburb) {
                rawWard = addr.suburb;
              } else {
                rawDist = addr.suburb;
                const candidate = addr.village || wardParam;
                rawWard = isKhuPho(candidate) ? wardParam : candidate;
              }
            } else {
              const candidate = addr.village || wardParam;
              rawWard = isKhuPho(candidate) ? wardParam : candidate;
            }
            if (isKhuPho(rawWard)) rawWard = '';

            const rawStreet = [addr.house_number, addr.road].filter(Boolean).join(' ');

            const matched = matchStandardAdministrative(rawProv, rawDist, rawWard, address);

            return NextResponse.json({
              success: true,
              lat,
              lng,
              formattedAddress: removeKhuPho(item.display_name),
              components: {
                ...matched,
                ward: matched.ward && !isKhuPho(matched.ward) ? removeKhuPho(matched.ward) : undefined,
                street: removeKhuPho(rawStreet || extractStreetFromAddress(address) || address),
              },
              source: 'nominatim',
            });
          }
        }
      } catch (e) {
        // Tiếp tục fallback sang local coordinates
      }
    }

    // 4. Fallback Local Vietnam Administrative & Streets Dataset
    const matched = matchStandardAdministrative(
      provinceParam,
      districtParam,
      wardParam,
      address
    );

    // 4.1. Ưu tiên phân giải tọa độ chính xác theo tuyến đường
    if (address) {
      const streetMatch = findStreetCoordinates(
        address,
        matched.district || districtParam,
        matched.province || provinceParam
      );

      if (streetMatch) {
        const resolvedStreet = [streetMatch.houseNumber, streetMatch.matchedStreet.streetName]
          .filter(Boolean)
          .join(' ') || extractStreetFromAddress(address) || address;

        const resolvedWard = matched.ward || streetMatch.matchedStreet.wardHint;
        const resolvedDist = streetMatch.matchedStreet.district || matched.district;
        const resolvedProv = streetMatch.matchedStreet.province || matched.province;

        return NextResponse.json({
          success: true,
          lat: streetMatch.lat,
          lng: streetMatch.lng,
          formattedAddress: [resolvedStreet, resolvedWard, resolvedDist, resolvedProv]
            .filter(Boolean)
            .join(', '),
          components: {
            province: resolvedProv,
            district: resolvedDist,
            ward: resolvedWard,
            street: resolvedStreet,
          },
          source: 'local',
        });
      }
    }

    const localCoords = findPreciseCoordinates(
      matched.province,
      matched.district,
      matched.ward
    );

    if (localCoords) {
      return NextResponse.json({
        success: true,
        lat: localCoords.lat,
        lng: localCoords.lng,
        formattedAddress: [extractStreetFromAddress(address) || address, matched.ward, matched.district, matched.province]
          .filter(Boolean)
          .join(', '),
        components: {
          ...matched,
          street: extractStreetFromAddress(address) || address,
        },
        source: 'local',
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to determine coordinates for this location',
      },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Error in geo geocode:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
