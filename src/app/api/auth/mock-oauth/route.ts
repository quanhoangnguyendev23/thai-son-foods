import { NextRequest, NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';
import { signUserToken, USER_COOKIE_NAME, TOKEN_EXPIRY_DAYS, getSafeAppOrigin } from '@/lib/auth';
import { sanitizeReturnUrl } from '@/lib/oauth';
import { isCookieSecure } from '@/lib/runtimeConfig';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Fail-closed: Chỉ cho phép chạy khi KHÔNG PHẢI production VÀ biến ENABLE_MOCK_OAUTH được bật rõ ràng là 'true'
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_MOCK_OAUTH !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Disabled' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider') || 'google';
  const returnUrl = sanitizeReturnUrl(searchParams.get('returnUrl'));

  const isGoogle = provider === 'google';
  const providerTitle = isGoogle ? 'Google' : 'Facebook';
  const defaultEmail = isGoogle ? 'demo.google@gmail.com' : 'demo.facebook@gmail.com';
  const defaultName = isGoogle ? 'Nguyễn Văn Google' : 'Trần Thị Facebook';
  const brandColor = isGoogle ? '#EA4335' : '#1877F2';

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Đăng nhập nhanh với ${providerTitle} - Thái Sơn Foods</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
          background: #FAF7F0;
          color: #315B56;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .card {
          background: #fff;
          border-radius: 24px;
          border: 1px solid #DEE7E6;
          box-shadow: 0 10px 25px -5px rgba(34,84,76,0.05);
          width: 100%;
          max-width: 480px;
          padding: 32px;
          text-align: center;
        }
        .icon-circle {
          width: 60px;
          height: 60px;
          border-radius: 16px;
          background: ${isGoogle ? '#FEF1F4' : '#F0F5F2'};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        h1 { font-size: 22px; font-weight: 400; color: #27534D; margin-bottom: 8px; }
        p.subtitle { font-size: 13px; color: #6F908C; margin-bottom: 24px; line-height: 1.5; }
        .btn-quick {
          display: block;
          width: 100%;
          background: #22544C;
          color: #fff;
          font-size: 16px;
          font-weight: 400;
          padding: 14px 20px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
          margin-bottom: 16px;
        }
        .btn-quick:hover { background: #1F5048; }
        .divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 20px 0;
          color: #98AEAB;
          font-size: 12px;
          font-weight: 400;
          text-transform: uppercase;
        }
        .divider::before, .divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid #DEE7E6;
        }
        .divider::before { margin-right: 12px; }
        .divider::after { margin-left: 12px; }
        .form-group { text-align: left; margin-bottom: 14px; }
        label { display: block; font-size: 14px; font-weight: 400; color: #40645F; margin-bottom: 6px; }
        input {
          width: 100%;
          padding: 11px 14px;
          border: 1px solid #DEE7E6;
          border-radius: 12px;
          font-size: 13px;
          outline: none;
        }
        input:focus { border-color: #22544C; }
        .btn-custom {
          display: block;
          width: 100%;
          background: #fff;
          color: #315B56;
          border: 1.5px solid #DEE7E6;
          font-size: 15px;
          font-weight: 400;
          padding: 12px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-custom:hover { background: #F0F5F2; border-color: #C5D3D1; }
        .info-box {
          margin-top: 24px;
          background: #F0F5F2;
          border: 1px dashed #C5D3D1;
          border-radius: 12px;
          padding: 12px 14px;
          text-align: left;
          font-size: 11px;
          color: #6F908C;
          line-height: 1.5;
        }
        .info-box code {
          background: #EEF3F3;
          color: #C3183C;
          padding: 2px 4px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 11px;
        }
        a.cancel { display: inline-block; margin-top: 16px; font-size: 12px; color: #6F908C; text-decoration: none; }
        a.cancel:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon-circle">
          ${
            isGoogle
              ? `<svg width="30" height="30" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>`
              : `<svg width="30" height="30" viewBox="0 0 24 24">
                  <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>`
          }
        </div>
        <h1>Đăng nhập nhanh với ${providerTitle}</h1>
        <p class="subtitle">Môi trường phát triển & kiểm thử. Bạn có thể đăng nhập ngay bằng 1 click hoặc tùy chọn tài khoản thử nghiệm.</p>

        <form method="POST" action="/api/auth/mock-oauth">
          <input type="hidden" name="provider" value="${provider}">
          <input type="hidden" name="returnUrl" value="${returnUrl}">
          <input type="hidden" name="email" value="${defaultEmail}">
          <input type="hidden" name="fullName" value="${defaultName}">
          <button type="submit" class="btn-quick">
            ✓ Đăng nhập nhanh tài khoản mẫu (${defaultName})
          </button>
        </form>

        <div class="divider">hoặc nhập thông tin test tùy ý</div>

        <form method="POST" action="/api/auth/mock-oauth">
          <input type="hidden" name="provider" value="${provider}">
          <input type="hidden" name="returnUrl" value="${returnUrl}">
          <div class="form-group">
            <label>Họ và tên</label>
            <input type="text" name="fullName" required value="${defaultName}">
          </div>
          <div class="form-group">
            <label>Email tài khoản ${providerTitle}</label>
            <input type="email" name="email" required value="${defaultEmail}">
          </div>
          <button type="submit" class="btn-custom">
            Tiếp tục đăng nhập bằng thông tin trên
          </button>
        </form>

        <div class="info-box">
          <strong style="font-size: 1.125em;">Khi triển khai thực tế (Production):</strong><br>
          Cấu hình <code>GOOGLE_CLIENT_ID</code> và <code>GOOGLE_CLIENT_SECRET</code> (hoặc <code>FACEBOOK_CLIENT_ID</code> và <code>FACEBOOK_CLIENT_SECRET</code>) trong file <code>.env</code>, hệ thống sẽ tự động chuyển hướng trực tiếp sang Google/Meta OAuth thật!
        </div>

        <a href="${returnUrl}" class="cancel">← Hủy và quay lại trang mua sắm</a>
      </div>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function POST(req: NextRequest) {
  // Fail-closed: Chỉ cho phép chạy khi KHÔNG PHẢI production VÀ biến ENABLE_MOCK_OAUTH được bật rõ ràng là 'true'
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_MOCK_OAUTH !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Disabled' },
      { status: 403 }
    );
  }

  try {
    await initDatabase();
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ success: false, error: 'Dữ liệu gửi lên phải là biểu mẫu (form).' }, { status: 400 });
    }
    const provider = formData.get('provider')?.toString() || 'google';
    const email = (formData.get('email')?.toString() || 'demo@user.com').toLowerCase().trim();
    const fullName = formData.get('fullName')?.toString() || (provider === 'google' ? 'Google User' : 'Facebook User');
    const returnUrl = formData.get('returnUrl')?.toString() || '/tai-khoan';

    const origin = getSafeAppOrigin(req);
    const mockProviderId = `mock_${provider}_${Date.now()}`;
    const avatarUrl = provider === 'google'
      ? 'https://lh3.googleusercontent.com/a/default-user=s96-c'
      : 'https://graph.facebook.com/4/picture?type=large';

    // Upsert into users table
    const existing = await query('SELECT id FROM users WHERE email = $1 LIMIT 1;', [email]);

    let userId = '';
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      await query(
        `UPDATE users
         SET full_name = COALESCE(NULLIF(full_name, ''), $1),
             avatar_url = COALESCE($2, avatar_url),
             provider = $3,
             provider_id = COALESCE(provider_id, $4),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5;`,
        [fullName, avatarUrl, provider, mockProviderId, userId]
      );
    } else {
      userId = `usr_${provider}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      await query(
        `INSERT INTO users (id, email, password_hash, full_name, avatar_url, provider, provider_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [userId, email, `oauth_${provider}_${Date.now()}`, fullName, avatarUrl, provider, mockProviderId]
      );
    }

    // Sign JWT & set cookie
    const token = await signUserToken({
      id: userId,
      email,
      fullName,
      avatarUrl,
      provider,
    });

    const redirectTarget = new URL(returnUrl.startsWith('/') ? returnUrl : `/${returnUrl}`, origin);
    const response = NextResponse.redirect(redirectTarget.toString());

    const maxAgeSeconds = TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
    response.cookies.set({
      name: USER_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
    });

    return response;
  } catch (error: any) {
    console.error('Mock OAuth error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
