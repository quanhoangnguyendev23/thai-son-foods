/**
 * Adapter Google Places (chưa bật: cần GOOGLE_MAPS_API_KEY và GEO_PROVIDER=google). Giữ nguyên cách làm cũ của route:
 * gợi ý chưa có tọa độ → khi khách chọn thì gọi `details` theo place_id đúng 1 lần.
 * Đây cũng là mẫu cho Goong / VietMap (cùng luồng gợi ý → chi tiết theo id → tọa độ); xem docs/DIA-CHI-NHA-CUNG-CAP.md.
 */
import type { AddressSuggestion } from '../types';
import type { AddressProvider, PlaceDetails, SuggestRequest, SuggestResult } from './types';

const apiKey = () => process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export const googleConfigured = () => !!apiKey();

export const googleProvider: AddressProvider = {
  id: 'google',

  async suggest({ input, bias }: SuggestRequest): Promise<SuggestResult> {
    const key = apiKey();
    if (!key) return { suggestions: [], status: 'off' };
    try {
      const location = bias ? `&location=${bias.lat},${bias.lng}&radius=35000` : '';
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&components=country:vn&language=vi&types=address${location}&key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(2000), cache: 'no-store' });
      if (res.status === 429) return { suggestions: [], status: 'limited' };
      if (!res.ok) return { suggestions: [], status: 'error' };
      const data = await res.json();
      if (data.status !== 'OK' || !Array.isArray(data.predictions)) return { suggestions: [], status: 'ok' };
      const suggestions: AddressSuggestion[] = data.predictions.slice(0, 8).map(
        (p: { place_id: string; description: string; structured_formatting?: { main_text?: string; secondary_text?: string } }) => ({
          place_id: p.place_id,
          description: p.description,
          main_text: p.structured_formatting?.main_text || p.description,
          secondary_text: p.structured_formatting?.secondary_text || '',
          source: 'google' as const,
          precision: 'street' as const,
        })
      );
      return { suggestions, status: 'ok' };
    } catch (e) {
      return { suggestions: [], status: (e as { name?: string })?.name === 'TimeoutError' ? 'timeout' : 'error' };
    }
  },

  async details(placeId: string): Promise<PlaceDetails | null> {
    const key = apiKey();
    if (!key) return null;
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId
    )}&fields=geometry,formatted_address&language=vi&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000), cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data?.result?.geometry?.location;
    if (data?.status !== 'OK' || typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') return null;
    return { lat: loc.lat, lng: loc.lng, formattedAddress: data.result.formatted_address };
  },
};
