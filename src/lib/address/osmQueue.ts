/**
 * Mọi lời gọi Nominatim của app đi qua đây: một hàng đợi chung, cách nhau tối thiểu 1 giây (điều khoản dùng Nominatim
 * công cộng: tối đa 1 lượt/giây), có đệm kết quả và tự nghỉ khi bị 429. Không dùng Nominatim cho gợi ý khi gõ.
 * Trạng thái nằm trong bộ nhớ tiến trình (mỗi instance serverless riêng); nhiều instance cùng chạy thì tổng lượt có thể
 * vượt 1/giây, nên khi lưu lượng lớn cần nhà cung cấp riêng hoặc Nominatim tự host (xem docs/DIA-CHI-NHA-CUNG-CAP.md).
 */
import { geoHeaders } from './httpIdentity';

const MIN_GAP_MS = 1100;
const MAX_QUEUE = 5;
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 300;
const PAUSE_ON_429_MS = 60_000;

const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
let chain: Promise<unknown> = Promise.resolve();
let queued = 0;
let lastCallAt = 0;
let blockedUntil = 0;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class OsmQueueError extends Error {
  constructor(message: string, readonly reason: 'queue_full' | 'blocked' | 'http') {
    super(message);
    this.name = 'OsmQueueError';
  }
}

/** GET JSON từ Nominatim qua hàng đợi chung. Ném OsmQueueError khi hàng đợi đầy / đang nghỉ vì 429 / lỗi HTTP. */
export function nominatimJson<T = unknown>(url: string, opts: { timeoutMs?: number; ttlMs?: number } = {}): Promise<T> {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data as T);
  const pending = inflight.get(url);
  if (pending) return pending as Promise<T>;
  if (Date.now() < blockedUntil) return Promise.reject(new OsmQueueError('Nominatim đang nghỉ vì bị giới hạn lượt gọi', 'blocked'));
  if (queued >= MAX_QUEUE) return Promise.reject(new OsmQueueError('Hàng đợi Nominatim đầy', 'queue_full'));

  queued++;
  const run = async (): Promise<T> => {
    try {
      const wait = lastCallAt + MIN_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      if (Date.now() < blockedUntil) throw new OsmQueueError('Nominatim đang nghỉ vì bị giới hạn lượt gọi', 'blocked');
      lastCallAt = Date.now();
      const res = await fetch(url, {
        headers: geoHeaders({ 'Accept-Language': 'vi,en;q=0.9' }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 3500),
        cache: 'no-store',
      });
      if (res.status === 429) {
        blockedUntil = Date.now() + PAUSE_ON_429_MS;
        throw new OsmQueueError('Nominatim trả 429', 'http');
      }
      if (!res.ok) throw new OsmQueueError(`Nominatim HTTP ${res.status}`, 'http');
      const data = (await res.json()) as T;
      cache.set(url, { at: Date.now(), data });
      while (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
      return data;
    } finally {
      queued--;
    }
  };
  const result = chain.then(run, run) as Promise<T>;
  chain = result.catch(() => undefined);
  inflight.set(url, result);
  const done = () => {
    inflight.delete(url);
  };
  result.then(done, done);
  return result;
}

/** Xóa đệm và trạng thái (dùng trong kiểm thử). */
export function resetOsmQueue(): void {
  cache.clear();
  inflight.clear();
  chain = Promise.resolve();
  queued = 0;
  lastCallAt = 0;
  blockedUntil = 0;
}
