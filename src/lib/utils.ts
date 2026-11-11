/** "31 kcal", "10,8 kcal" (kiểu số Việt Nam) */
export function formatKcal(kcal: number | null | undefined): string | null {
  if (kcal === null || kcal === undefined || !Number.isFinite(Number(kcal))) return null;
  return `${Number(kcal).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kcal`;
}

/**
 * Format a number as Vietnamese currency
 * Example: 18000 → "18.000"
 */
export function formatPrice(price: number): string {
  if (typeof price !== 'number' || isNaN(price)) return '0';
  return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * cn - simple class name merger (replaces clsx/twMerge for simplicity)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Parse an toàn một Response object sang JSON nếu header Content-Type hợp lệ.
 * Tránh triệt để SyntaxError khi response là HTML (404, 500, redirect, HMR).
 */
export async function safeParseJson<T = any>(res: Response): Promise<T | null> {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch an toàn: Kiểm tra trạng thái HTTP và Content-Type trước khi parse JSON.
 * Ngăn chặn triệt để lỗi "Unexpected token '<', '<!DOCTYPE '... is not valid JSON"
 * khi server trả về trang HTML (404, 500, redirect, hoặc HMR recompiling).
 */
export async function safeFetchJson<T = any>(
  url: string,
  init?: RequestInit
): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return await safeParseJson<T>(res);
  } catch {
    return null;
  }
}

