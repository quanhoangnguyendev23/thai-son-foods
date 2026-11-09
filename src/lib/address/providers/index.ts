/**
 * Chọn nhà cung cấp địa chỉ bằng biến môi trường GEO_PROVIDER (mặc định "photon"):
 *   photon  Photon (OSM). PHOTON_BASE_URL trỏ tới bản tự host; để trống = bản công cộng, chỉ dùng khi phát triển
 *   google  Google Places (cần GOOGLE_MAPS_API_KEY)
 *   goong, vietmap  chưa tích hợp: viết adapter theo AddressProvider rồi thêm vào bảng dưới (xem docs/DIA-CHI-NHA-CUNG-CAP.md)
 */
import { googleConfigured, googleProvider } from './google';
import { photonProvider } from './photon';
import type { AddressProvider } from './types';

export type { AddressProvider, PlaceDetails, ProviderStatus, SuggestRequest, SuggestResult } from './types';

const warned = new Set<string>();
const warnOnce = (key: string, message: string) => {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
};

export function getAddressProvider(): AddressProvider {
  const id = (process.env.GEO_PROVIDER || 'photon').trim().toLowerCase();
  if (id === 'photon' || id === '') return photonProvider;
  if (id === 'google') {
    if (googleConfigured()) return googleProvider;
    warnOnce('google', '[Geo] GEO_PROVIDER=google nhưng chưa có GOOGLE_MAPS_API_KEY: dùng Photon.');
    return photonProvider;
  }
  warnOnce(id, `[Geo] GEO_PROVIDER="${id}" chưa được tích hợp: dùng Photon.`);
  return photonProvider;
}
