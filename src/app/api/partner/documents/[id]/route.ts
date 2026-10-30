import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { getPartnerDocumentById } from '@/lib/partner/storage';
import { getPartnerSession } from '@/lib/partner/auth';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const doc = await getPartnerDocumentById(id);
    if (!doc) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy tài liệu' }, { status: 404 });
    }

    // 1. Kiểm tra quyền truy cập: phải là chính Partner đó HOẶC là Admin có quyền partners.view
    let isAuthorized = false;

    const partnerSession = await getPartnerSession();
    if (partnerSession && partnerSession.partner.id === doc.partnerId) {
      isAuthorized = true;
    } else {
      const adminSession = await getAdminSession();
      if (adminSession && hasPermission(adminSession, 'partners.view')) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Bạn không có quyền truy cập tài liệu này', code: 'FORBIDDEN' }, { status: 403 });
    }

    if (!fs.existsSync(doc.filePath)) {
      return NextResponse.json({ success: false, error: 'Tệp tin không tồn tại trên hệ thống lưu trữ' }, { status: 404 });
    }

    const fileBuffer = await fs.promises.readFile(doc.filePath);
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(doc.originalFilename)}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error fetching partner document file:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi đọc tệp tài liệu') }, { status: 500 });
  }
}
