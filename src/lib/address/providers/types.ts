/**
 * Giao diện chung của nhà cung cấp địa chỉ, để đổi nhà cung cấp bằng biến môi trường GEO_PROVIDER mà không đụng
 * route, hook hay trang. Photon hiện tại chỉ là một adapter (providers/photon.ts).
 *
 * Luồng chuẩn (tương thích cả nhà cung cấp trả gợi ý KHÔNG kèm tọa độ như Google / Goong / VietMap):
 *   suggest()  → danh sách gợi ý (có thể chưa có lat/lng)
 *   details()  → khi khách CHỌN một gợi ý chưa có tọa độ, lấy chi tiết theo id đúng 1 lần (không geocode lại chữ)
 *   reverse()  → địa chỉ tại tọa độ (ghim / GPS); hiện đi qua /api/geo/reverse (Nominatim qua hàng đợi chung)
 */
import type { ServiceZone } from '../serviceZone';
import type { AddressSuggestion, LatLng, ParsedAddressInput } from '../types';

export type ProviderStatus = 'ok' | 'partial' | 'timeout' | 'error' | 'limited' | 'off';

export interface SuggestRequest {
  /** Nguyên văn chuỗi khách gõ */
  input: string;
  parsed: ParsedAddressInput;
  /** Vị trí khách đã biết (GPS đã cho phép, địa chỉ đã lưu); null = không bias */
  bias: LatLng | null;
  /** Vùng giao lấy từ cấu hình cửa hàng + bán kính giao; null = chưa biết, không lọc theo vị trí */
  zone: ServiceZone | null;
}

export interface SuggestResult {
  suggestions: AddressSuggestion[];
  status: ProviderStatus;
}

export interface PlaceDetails {
  lat: number;
  lng: number;
  ward?: string;
  district?: string;
  province?: string;
  formattedAddress?: string;
}

export interface AddressProvider {
  id: string;
  suggest(req: SuggestRequest): Promise<SuggestResult>;
  details?(placeId: string): Promise<PlaceDetails | null>;
  reverse?(lat: number, lng: number): Promise<PlaceDetails | null>;
}
