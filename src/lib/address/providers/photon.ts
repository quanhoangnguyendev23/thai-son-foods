/**
 * Adapter Photon (OSM). Câu hỏi CHÍNH gửi nguyên chuỗi khách gõ; câu BỔ SUNG chỉ gửi khi câu chính chưa có kết quả đúng
 * đường + đúng khu khách gõ (đo trên Photon công cộng: nhiều ca chỉ cần 1 lượt). Có đệm và cầu dao (photonClient.ts).
 * Tọa độ đã nằm trong gợi ý nên không cần `details`.
 */
import {
  fetchPhotonFeatures,
  isPhotonPaused,
  photonPauseReason,
  PhotonHttpError,
  recordPhotonOutcome,
} from '../photonClient';
import { buildPhotonRequests, hasGoodResult, mapPhotonFeature, type PhotonRequest } from '../suggest';
import type { AddressSuggestion } from '../types';
import type { AddressProvider, ProviderStatus, SuggestRequest, SuggestResult } from './types';

function classify(error: unknown): ProviderStatus {
  if (error instanceof PhotonHttpError && error.status === 429) return 'limited';
  if ((error as { name?: string } | null)?.name === 'TimeoutError') return 'timeout';
  return 'error';
}

export const photonProvider: AddressProvider = {
  id: 'photon',

  async suggest({ parsed, bias, zone }: SuggestRequest): Promise<SuggestResult> {
    if (process.env.DISABLE_PHOTON_GEOCODER === 'true') return { suggestions: [], status: 'off' };
    // Cầu dao đang mở (vừa quá hạn / lỗi nhiều lần liên tiếp / bị 429): trả ngay, không bắt khách chờ
    if (isPhotonPaused()) return { suggestions: [], status: photonPauseReason() };

    const plan = buildPhotonRequests(parsed, bias);
    const suggestions: AddressSuggestion[] = [];
    let okCount = 0;
    let failCount = 0;
    let lastError: unknown = null;
    let retryAfterMs: number | undefined;

    const run = async (req: PhotonRequest): Promise<boolean> => {
      try {
        const features = await fetchPhotonFeatures(req, zone);
        okCount++;
        for (const feature of features) {
          const mapped = mapPhotonFeature(feature, parsed, zone);
          if (mapped) suggestions.push(mapped);
        }
        return true;
      } catch (e) {
        failCount++;
        lastError = e;
        if (e instanceof PhotonHttpError && e.status === 429) retryAfterMs = e.retryAfterMs ?? 0;
        return false;
      }
    };

    const mainOk = await run(plan[0]);
    if (mainOk && plan[1] && !hasGoodResult(suggestions, parsed)) await run(plan[1]);

    recordPhotonOutcome(okCount > 0, Date.now(), retryAfterMs);
    if (okCount === 0) {
      console.warn('[Geo] Photon không dùng được:', (lastError as Error | null)?.message || lastError);
      return { suggestions, status: classify(lastError) };
    }
    return { suggestions, status: failCount === 0 ? 'ok' : 'partial' };
  },
};
