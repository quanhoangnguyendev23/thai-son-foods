import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { resolveInsideUploadRoot } from '@/lib/uploadStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Phục vụ file admin đã tải lên (URL công khai /uploads/... được rewrite về đây, xem next.config.ts).
 * Chỉ đọc file trong thư mục upload (src/lib/uploadStorage.ts), chỉ các đuôi được phép tải lên.
 * Hỗ trợ Range cho video .mp4 (trình duyệt cần để tua / Safari mới phát được).
 */
const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
};

function notFound() {
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function serve(req: Request, segments: string[], headOnly: boolean) {
  const ext = path.extname(segments[segments.length - 1] || '').toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return notFound();

  const abs = resolveInsideUploadRoot(segments.join('/'));
  if (!abs) return notFound();

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(abs);
  } catch {
    return notFound();
  }
  if (!stat.isFile()) return notFound();

  const baseHeaders: Record<string, string> = {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    // Tên file do máy chủ sinh ngẫu nhiên, không bao giờ ghi đè → cache lâu được
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    'Last-Modified': stat.mtime.toUTCString(),
  };

  const range = req.headers.get('range');
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (m && (m[1] !== '' || m[2] !== '')) {
    let start: number;
    let end: number;
    if (m[1] === '') {
      const suffix = parseInt(m[2], 10);
      start = Math.max(0, stat.size - suffix);
      end = stat.size - 1;
    } else {
      start = parseInt(m[1], 10);
      end = m[2] === '' ? stat.size - 1 : Math.min(parseInt(m[2], 10), stat.size - 1);
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stat.size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
    }
    const headers = { ...baseHeaders, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': String(end - start + 1) };
    if (headOnly) return new Response(null, { status: 206, headers });
    const body = Readable.toWeb(fs.createReadStream(abs, { start, end })) as ReadableStream;
    return new Response(body, { status: 206, headers });
  }

  const headers = { ...baseHeaders, 'Content-Length': String(stat.size) };
  if (headOnly) return new Response(null, { status: 200, headers });
  const body = Readable.toWeb(fs.createReadStream(abs)) as ReadableStream;
  return new Response(body, { status: 200, headers });
}

export async function GET(req: Request, props: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await props.params;
  return serve(req, segments || [], false);
}

export async function HEAD(req: Request, props: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await props.params;
  return serve(req, segments || [], true);
}
