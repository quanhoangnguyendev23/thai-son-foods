import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const ADMIN_COOKIE_NAME = 'tsf_admin_token';
import { getJwtSecretBytes } from '@/lib/jwtSecret';
import { getClientIp, getAllowedOrigins, getTrustedProxyCount, UNKNOWN_CLIENT_IP } from '@/lib/runtimeConfig';

// Cảnh báo khi không xác định được IP đáng tin (tối đa 1 dòng log/phút để không làm đầy log)
let lastUnknownIpWarnAt = 0;
function warnUnknownIp(pathname: string) {
  const now = Date.now();
  if (now - lastUnknownIpWarnAt < 60 * 1000) return;
  lastUnknownIpWarnAt = now;
  console.warn(
    `[Middleware] Không xác định được IP khách đáng tin (TRUSTED_PROXY_COUNT=${getTrustedProxyCount()}, đường dẫn ${pathname}). ` +
      'Các request này dùng chung nhóm rate limit "unknown". Kiểm tra cấu hình reverse proxy / TRUSTED_PROXY_COUNT.'
  );
}

// Allowlist các route ngoại lệ có chủ đích (webhook cổng thanh toán, cronjob có Bearer token)
const CSRF_EXEMPT_ROUTES: readonly string[] = [
  '/api/cron/',
  '/api/payment/webhook',
  '/api/webhooks/',
  '/api/inventory/check',
  '/api/stores/recommend',
];

// ─── WAF & Bot Armor: Chống Hacker Quét Lỗ Hổng & Botnet Reconnaissance ───
const tempJailMap = new Map<string, number>();
const SCANNER_PATH_REGEX = /\.(env|git|svn|hg|ds_store|bak|old|sql|tar|gz|zip|yml|yaml|ini|conf|config)$/i;
const BOT_PROBE_PATH_REGEX = /(?:wp-admin|wp-login|xmlrpc\.php|phpmyadmin|\bpma\b|\badminer\b|actuator|boaform|cgi-bin|\.aws|\.vscode|web\.config)/i;

// ─── In-Memory Rate Limiting cho middleware (global public API) ───────────
interface RateBucket {
  count: number;
  resetAt: number;
}
// Lưu ý: bộ đếm nằm trong RAM của từng máy chủ. Trên Vercel mỗi instance đếm riêng, không chia sẻ với nhau,
// nên đây chỉ là lớp chặn thô; các giới hạn quan trọng (đặt hàng, đăng nhập...) còn có kiểm tra riêng trong route.
const globalRateLimitStore = new Map<string, RateBucket>();
const GLOBAL_MAX_REQUESTS = 300; // 300 requests (60 cũ chặn nhầm khách lướt nhanh / dùng chung IP mạng di động)
const GLOBAL_WINDOW_MS = 60 * 1000; // per minute

// API chỉ đọc mà trang nào cũng gọi: không tính vào giới hạn chung (chỉ áp dụng cho GET)
const READ_ONLY_EXEMPT_API_REGEX =
  /^\/api\/(products|combos|stores|banners|brand-slides|categories|auth\/me|reviews|reviews\/summary)\/?$/;

// API ghi / dễ bị lạm dụng: giới hạn chặt hơn theo nhóm (bucket riêng, đếm theo IP)
const STRICT_API_LIMITS: ReadonlyArray<{ key: string; methods: readonly string[]; regex: RegExp; max: number }> = [
  { key: 'orders-post', methods: ['POST'], regex: /^\/api\/orders\/?$/, max: 10 },
  { key: 'orders-track', methods: ['GET'], regex: /^\/api\/orders\/?$/, max: 20 },
  { key: 'auth', methods: ['POST'], regex: /^\/api\/auth\/(login|register)\/?$/, max: 10 },
  { key: 'otp', methods: ['POST'], regex: /^\/api\/(membership\/auth|partner)\/otp\//, max: 5 },
  { key: 'geo', methods: ['GET', 'POST'], regex: /^\/api\/geo\//, max: 60 },
];

// Tự động dọn dẹp mỗi 5 phút (edge runtime an toàn)
if (typeof setInterval !== 'undefined') {
  const t = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of globalRateLimitStore.entries()) {
      if (bucket.resetAt <= now) globalRateLimitStore.delete(key);
    }
    for (const [ip, unjailAt] of tempJailMap.entries()) {
      if (now >= unjailAt) tempJailMap.delete(ip);
    }
  }, 5 * 60 * 1000);
  if (t.unref) t.unref();
}

function checkGlobalRateLimit(
  ip: string,
  max: number = GLOBAL_MAX_REQUESTS
): { blocked: boolean; remaining: number; resetInSec: number; limit: number } {
  const now = Date.now();
  let bucket = globalRateLimitStore.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 1, resetAt: now + GLOBAL_WINDOW_MS };
    globalRateLimitStore.set(ip, bucket);
    return { blocked: false, remaining: max - 1, resetInSec: Math.ceil(GLOBAL_WINDOW_MS / 1000), limit: max };
  }
  bucket.count += 1;
  const resetInSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  if (bucket.count > max) {
    return { blocked: true, remaining: 0, resetInSec, limit: max };
  }
  return { blocked: false, remaining: max - bucket.count, resetInSec, limit: max };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiRoute = pathname.startsWith('/api/');
  // IP lấy theo số proxy tin cậy (src/lib/runtimeConfig.ts). Không xác định được → nhóm chung "unknown":
  // vẫn bị rate limit, nhưng không đưa vào jail (jail nhóm chung sẽ chặn oan mọi khách).
  const clientIp = getClientIp(req.headers);
  if (!clientIp && pathname.startsWith('/api/')) warnUnknownIp(pathname);
  const ip = clientIp ?? UNKNOWN_CLIENT_IP;
  const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip === UNKNOWN_CLIENT_IP || ip === 'localhost';

  // ═══════════════════════════════════════════════════════════════
  // -1. KIỂM TRA IP TRONG DANH SÁCH GIÁM SÁT (IP JAIL CHECK)
  // ═══════════════════════════════════════════════════════════════
  const jailedUntil = !isLoopback ? tempJailMap.get(ip) : null;
  if (jailedUntil) {
    if (Date.now() < jailedUntil) {
      return new NextResponse(
        JSON.stringify({ error: 'Yêu cầu bị từ chối do phát hiện hành vi quét lỗ hổng hoặc bất thường.', code: 'IP_TEMPORARILY_BLOCKED' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': String(Math.ceil((jailedUntil - Date.now()) / 1000)),
            'Cache-Control': 'no-store, private',
          },
        }
      );
    } else {
      tempJailMap.delete(ip);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // -0.5. WAF BOT SHIELD: CHẶN BOT QUÉT FILE NHẠY CẢM & DÒ ĐƯỜNG DẪN
  // ═══════════════════════════════════════════════════════════════
  if (SCANNER_PATH_REGEX.test(pathname) || BOT_PROBE_PATH_REGEX.test(pathname)) {
    // Đưa IP vào Jail 15 phút (trừ loopback)
    if (!isLoopback) {
      tempJailMap.set(ip, Date.now() + 15 * 60 * 1000);
    }
    return new NextResponse(
      JSON.stringify({ error: 'Truy cập bị từ chối bởi Chính sách An ninh Máy chủ Thái Sơn Foods.', code: 'WAF_PROBE_BLOCKED' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
          'Cache-Control': 'no-store, private',
        },
      }
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // GIAI ĐOẠN 2: chương trình Đối tác (CTV/Đại lý, Payouts) chưa mở — chặn trang và API tương ứng.
  // Bật lại bằng biến môi trường NEXT_PUBLIC_ENABLE_PARTNER_PROGRAM=true (xem src/config/features.ts).
  // ═══════════════════════════════════════════════════════════════
  // Trang/API thử email chỉ dùng ở môi trường phát triển
  if (process.env.NODE_ENV === 'production' && /^\/(api\/)?test-email(\/|$)/.test(pathname)) {
    return isApiRoute
      ? new NextResponse(JSON.stringify({ success: false, error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        })
      : NextResponse.redirect(new URL('/', req.url));
  }

  if (process.env.NEXT_PUBLIC_ENABLE_PARTNER_PROGRAM !== 'true') {
    // Trang public + trang admin của chương trình Đối tác → về trang chủ / admin
    if (/^\/(doi-tac|dang-ky-doi-tac|dai-ly)(\/|$)/.test(pathname)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (/^\/admin\/(partners|payouts)(\/|$)/.test(pathname)) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    // API public + API admin của chương trình Đối tác → 404
    if (/^\/api\/(partner|dealer|admin\/partners|admin\/payouts)(\/|$)/.test(pathname)) {
      return new NextResponse(JSON.stringify({ success: false, error: 'Chức năng chưa mở sử dụng.', code: 'FEATURE_DISABLED' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private' },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // -0.3. CHỐNG PAYLOAD BOMB (DoS bằng dung lượng body khổng lồ)
  // ═══════════════════════════════════════════════════════════════
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    const maxAllowed = pathname.startsWith('/api/admin/upload') ? 10 * 1024 * 1024 : 2 * 1024 * 1024;
    if (contentLength > maxAllowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Dung lượng payload vượt quá giới hạn an toàn máy chủ cho phép.', code: 'PAYLOAD_TOO_LARGE' }),
        { status: 413, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // -0.2. WAF QUERY INSPECTION: CHẶN PATH TRAVERSAL TRÊN URL
  // ═══════════════════════════════════════════════════════════════
  const search = req.nextUrl.search;
  if (search && search.length > 0) {
    const decodedSearch = decodeURIComponent(search).toLowerCase();
    const isMalicious =
      decodedSearch.includes('../') ||
      decodedSearch.includes('..\\') ||
      decodedSearch.includes('%00') ||
      decodedSearch.includes('waitfor delay') ||
      decodedSearch.includes('sleep(');
    if (isMalicious) {
      if (!isLoopback) {
        tempJailMap.set(ip, Date.now() + 5 * 60 * 1000);
      }
      return new NextResponse(
        JSON.stringify({ error: 'Tham số truy vấn chứa mẫu ký tự bị cấm bởi hệ thống an ninh.', code: 'MALICIOUS_PARAM_BLOCKED' }),
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 0. GLOBAL RATE LIMITING cho mọi public API (60 req/phút/IP)
  // ═══════════════════════════════════════════════════════════════
  if (isApiRoute && !pathname.startsWith('/api/admin/')) {
    const strict = STRICT_API_LIMITS.find((r) => r.methods.includes(req.method) && r.regex.test(pathname));
    const isReadOnlyExempt = req.method === 'GET' && READ_ONLY_EXEMPT_API_REGEX.test(pathname);
    const rl = strict
      ? checkGlobalRateLimit(`strict:${strict.key}:${ip}`, strict.max)
      : isReadOnlyExempt
      ? { blocked: false, remaining: GLOBAL_MAX_REQUESTS, resetInSec: 0, limit: GLOBAL_MAX_REQUESTS }
      : checkGlobalRateLimit(`global:${ip}`);
    if (rl.blocked) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ một lát rồi thử lại.',
          code: 'RATE_LIMITED',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rl.resetInSec),
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. Chống tấn công CSRF trên TẤT CẢ API state-changing routes
  // ═══════════════════════════════════════════════════════════════
  const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  if (isApiRoute && isStateChanging) {
    const isExempt = CSRF_EXEMPT_ROUTES.some((route) => pathname.startsWith(route));

    if (!isExempt) {
      const origin = req.headers.get('origin');
      const referer = req.headers.get('referer');
      const host = req.headers.get('host');
      // X-Forwarded-Host chỉ có nghĩa khi có proxy tin cậy đặt nó (kết nối thẳng thì do khách tự gửi)
      const forwardedHost = getTrustedProxyCount() > 0 ? req.headers.get('x-forwarded-host') : null;
      const allowedHosts = [host, forwardedHost].filter(Boolean) as string[];
      // Origin khai báo tường minh qua ALLOWED_ORIGINS (dùng khi proxy đổi Host và không gửi X-Forwarded-Host)
      const allowedOrigins = getAllowedOrigins();
      const isAllowedUrl = (u: URL) => allowedHosts.includes(u.host) || allowedOrigins.includes(u.origin);

      // Fail-closed: Nếu thiếu cả Origin và Referer -> Từ chối 403
      if (!origin && !referer) {
        return NextResponse.json(
          {
            success: false,
            error: 'Yêu cầu bị từ chối do vi phạm chính sách bảo mật CSRF: Thiếu thông tin nguồn gốc (Origin/Referer header required)',
            code: 'CSRF_BLOCKED',
          },
          { status: 403 }
        );
      }

      // Nếu có Origin -> Kiểm tra Origin
      if (origin) {
        try {
          const originUrl = new URL(origin);
          if (!isAllowedUrl(originUrl)) {
            return NextResponse.json(
              {
                success: false,
                error: 'Yêu cầu bị từ chối do vi phạm chính sách bảo mật CSRF (Origin mismatch)',
                code: 'CSRF_BLOCKED',
              },
              { status: 403 }
            );
          }
        } catch {
          return NextResponse.json(
            { success: false, error: 'Header Origin không hợp lệ', code: 'CSRF_BLOCKED' },
            { status: 403 }
          );
        }
      } else if (referer) {
        // Nếu thiếu Origin nhưng có Referer -> Kiểm tra Referer
        try {
          const refererUrl = new URL(referer);
          if (!isAllowedUrl(refererUrl)) {
            return NextResponse.json(
              {
                success: false,
                error: 'Yêu cầu bị từ chối do vi phạm chính sách bảo mật CSRF (Referer mismatch)',
                code: 'CSRF_BLOCKED',
              },
              { status: 403 }
            );
          }
        } catch {
          return NextResponse.json(
            { success: false, error: 'Header Referer không hợp lệ', code: 'CSRF_BLOCKED' },
            { status: 403 }
          );
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Whitelist auth API routes
  // ═══════════════════════════════════════════════════════════════
  if (pathname.startsWith('/api/admin/auth/')) {
    return addSecurityHeaders(NextResponse.next(), pathname);
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Check admin token from cookie
  // ═══════════════════════════════════════════════════════════════
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  let isAuthenticated = false;
  let mustChangePassword = false;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getJwtSecretBytes());
      isAuthenticated = true;
      mustChangePassword = Boolean(payload.mustChangePassword);
    } catch {
      isAuthenticated = false;
    }
  }

  // 4. Login & Register pages
  if (pathname === '/admin/login' || pathname === '/admin/register') {
    if (isAuthenticated) {
      // Already logged in, redirect to admin dashboard
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    return addSecurityHeaders(NextResponse.next(), pathname);
  }

  // 5. Protected Admin API routes
  if (pathname.startsWith('/api/admin/')) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Yêu cầu đăng nhập quản trị viên', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (mustChangePassword) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tài khoản bắt buộc phải đổi mật khẩu lần đầu trước khi tiếp tục thao tác.',
          code: 'MUST_CHANGE_PASSWORD',
        },
        { status: 403 }
      );
    }
    return addSecurityHeaders(NextResponse.next(), pathname);
  }

  // 5. Protected Admin Pages (/admin and sub-pages)
  if (pathname.startsWith('/admin')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/admin/login', req.url);
      if (pathname !== '/admin') {
        loginUrl.searchParams.set('from', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
    return addSecurityHeaders(NextResponse.next(), pathname);
  }

  // 6. Protected Partner & Dealer API routes
  if (pathname.startsWith('/api/partner/') || pathname.startsWith('/api/dealer/')) {
    const isPublicPartnerRoute =
      pathname.startsWith('/api/partner/register') ||
      pathname.startsWith('/api/partner/otp/') ||
      pathname.startsWith('/api/partner/click') ||
      pathname.startsWith('/api/partner/auth/logout');

    if (!isPublicPartnerRoute) {
      let userToken = req.cookies.get('tsf_user_session')?.value;
      if (!userToken) {
        const authHeader = req.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          userToken = authHeader.substring(7).trim();
        }
      }
      let isUserAuth = false;
      if (userToken) {
        try {
          await jwtVerify(userToken, getJwtSecretBytes());
          isUserAuth = true;
        } catch {
          isUserAuth = false;
        }
      }
      if (!isUserAuth) {
        return NextResponse.json(
          { success: false, error: 'Yêu cầu đăng nhập tài khoản đối tác / đại lý', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }
    }
    return addSecurityHeaders(NextResponse.next(), pathname);
  }

  // 7. Protected Partner Portal Pages (/doi-tac and sub-pages)
  if (pathname.startsWith('/doi-tac')) {
    const userToken = req.cookies.get('tsf_user_session')?.value;
    let isUserAuth = false;
    if (userToken) {
      try {
        await jwtVerify(userToken, getJwtSecretBytes());
        isUserAuth = true;
      } catch {
        isUserAuth = false;
      }
    }
    if (!isUserAuth) {
      const loginUrl = new URL('/dang-ky-doi-tac', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return addSecurityHeaders(NextResponse.next(), pathname);
  }

  return addSecurityHeaders(NextResponse.next(), pathname);
}

/**
 * Thêm security headers cho mọi response đi qua middleware
 */
function addSecurityHeaders(response: NextResponse, pathname: string): NextResponse {
  // Admin API responses: Ngăn cache dữ liệu nhạy cảm
  if (pathname.startsWith('/api/admin/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
  }

  // Tiêu chuẩn bảo mật trình duyệt
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  return response;
}

export const config = {
  matcher: [
    /*
     * Áp dụng WAF và Security Policy cho toàn bộ site ngoại trừ static assets:
     * - _next/static (chứa bundle js, css tĩnh)
     * - _next/image (tối ưu hóa hình ảnh Next.js)
     * - images/ (thư mục ảnh public)
     * - favicon.ico (icon trình duyệt)
     */
    '/((?!_next/static|_next/image|images/|favicon.ico).*)',
  ],
};

