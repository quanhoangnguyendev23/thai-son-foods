/**
 * Gọi Photon có đệm ngắn và "cầu dao".
 *
 * Photon công cộng (photon.komoot.io) giới hạn lượt gọi theo địa chỉ IP, mà mỗi lần khách ngừng gõ là 1–2 lượt.
 * Khi bị giới hạn nó không trả lời (đo thực tế: im lặng sau khoảng 25 lượt dồn dập), mỗi gợi ý sẽ phải chờ hết thời hạn.
 * - Đệm 60 giây theo URL: gõ, xóa rồi gõ lại cùng chuỗi, hoặc nhiều khách gõ cùng địa chỉ, không tốn thêm lượt.
 *   Các lượt đang bay trùng URL được gộp thành một.
 * - Cầu dao: 3 lần liên tiếp không dùng được (quá hạn / lỗi) thì nghỉ 30 giây; gặp HTTP 429 thì nghỉ ngay (theo
 *   Retry-After, tối thiểu 60 giây). Trong lúc nghỉ trả ngay kết quả nội bộ thay vì bắt khách chờ.
 * Trạng thái nằm trong bộ nhớ tiến trình (mỗi instance serverless có bản riêng): chỉ để giảm tải, không phải dữ liệu.
 * Biến môi trường (đặt 0 để tắt đệm / cầu dao):
 *   PHOTON_BASE_URL (mặc định bản công cộng, chỉ nên dùng khi phát triển), GEO_TIMEOUT_MS (mặc định 2000),
 *   PHOTON_CACHE_TTL_MS, PHOTON_BREAKER_FAILURES, PHOTON_BREAKER_PAUSE_MS.
 */
import { geoHeaders } from './httpIdentity';
import type { ServiceZone } from './serviceZone';
import { photonUrl, PHOTON_PUBLIC_BASE_URL, type PhotonFeature, type PhotonRequest } from './suggest';

const CACHE_MAX_ENTRIES = 200;

const envNumber = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export class PhotonHttpError extends Error {
  constructor(readonly status: number, readonly retryAfterMs?: number) {
    super(`Photon HTTP ${status}`);
    this.name = 'PhotonHttpError';
  }
}

let warnedPublic = false;
export function photonBaseUrl(): string {
  const configured = (process.env.PHOTON_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!configured && process.env.NODE_ENV === 'production' && !warnedPublic) {
    warnedPublic = true;
    console.warn('[Geo] PHOTON_BASE_URL chưa đặt: đang dùng Photon công cộng, chỉ phù hợp khi phát triển. Hãy tự host Photon hoặc đổi nhà cung cấp.');
  }
  return configured || PHOTON_PUBLIC_BASE_URL;
}

const cache = new Map<string, { at: number; features: PhotonFeature[] }>();
const inflight = new Map<string, Promise<PhotonFeature[]>>();
let failures = 0;
let pausedUntil = 0;
let pausedByRateLimit = false;

async function requestPhoton(url: string): Promise<PhotonFeature[]> {
  const res = await fetch(url, {
    headers: geoHeaders({ 'Accept-Language': 'vi' }),
    signal: AbortSignal.timeout(envNumber('GEO_TIMEOUT_MS', 2000)),
    cache: 'no-store',
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers?.get?.('retry-after'));
    throw new PhotonHttpError(429, Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 300) * 1000 : undefined);
  }
  if (!res.ok) throw new PhotonHttpError(res.status);
  const data = (await res.json()) as { features?: PhotonFeature[] };
  return Array.isArray(data?.features) ? data.features : [];
}

/** Một lượt hỏi Photon (qua đệm). Lỗi / quá hạn thì ném lỗi để nơi gọi tính vào cầu dao. */
export function fetchPhotonFeatures(req: PhotonRequest, zone: ServiceZone | null): Promise<PhotonFeature[]> {
  const url = photonUrl(req, zone, photonBaseUrl());
  const ttl = envNumber('PHOTON_CACHE_TTL_MS', 60_000);
  if (ttl <= 0) return requestPhoton(url);

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.features);
  const pending = inflight.get(url);
  if (pending) return pending;

  const promise = requestPhoton(url).then((features) => {
    cache.set(url, { at: Date.now(), features });
    while (cache.size > CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
    return features;
  });
  inflight.set(url, promise);
  const done = () => {
    inflight.delete(url);
  };
  promise.then(done, done);
  return promise;
}

/** Cầu dao đang mở: bỏ qua Photon một lúc, dùng kết quả nội bộ. */
export function isPhotonPaused(now: number = Date.now()): boolean {
  return now < pausedUntil;
}

/** Lý do cầu dao mở: bị giới hạn lượt gọi (429) hay lỗi / quá hạn nhiều lần. */
export function photonPauseReason(): 'limited' | 'error' {
  return pausedByRateLimit ? 'limited' : 'error';
}

/**
 * Ghi lại kết quả một lần gọi (ít nhất một câu hỏi thành công = tốt).
 * `rateLimitedForMs` có giá trị khi gặp HTTP 429: nghỉ ngay, không chờ đủ 3 lần.
 */
export function recordPhotonOutcome(ok: boolean, now: number = Date.now(), rateLimitedForMs?: number): void {
  if (ok) {
    failures = 0;
    pausedUntil = 0;
    pausedByRateLimit = false;
    return;
  }
  if (rateLimitedForMs !== undefined) {
    pausedUntil = now + Math.max(rateLimitedForMs, 60_000);
    pausedByRateLimit = true;
    return;
  }
  failures += 1;
  const threshold = envNumber('PHOTON_BREAKER_FAILURES', 3);
  if (threshold > 0 && failures >= threshold) {
    pausedUntil = now + envNumber('PHOTON_BREAKER_PAUSE_MS', 30_000);
    pausedByRateLimit = false;
  }
}

/** Xóa đệm và đóng cầu dao (dùng trong kiểm thử). */
export function resetPhotonClient(): void {
  cache.clear();
  inflight.clear();
  failures = 0;
  pausedUntil = 0;
  pausedByRateLimit = false;
}
