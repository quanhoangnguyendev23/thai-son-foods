import { NextResponse } from 'next/server';
import { getPartnerSession } from '@/lib/partner/auth';
import { savePartnerDocument } from '@/lib/partner/storage';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getPartnerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập đối tác', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = (formData.get('documentType') as string) || 'ID_CARD_FRONT';

    if (!file || file.size === 0) {
      return NextResponse.json({ success: false, error: 'Vui lòng chọn tệp tài liệu để tải lên' }, { status: 400 });
    }

    const validTypes = ['ID_CARD_FRONT', 'ID_CARD_BACK', 'BUSINESS_LICENSE', 'TAX_DOC'];
    if (!validTypes.includes(documentType)) {
      return NextResponse.json({ success: false, error: 'Loại tài liệu không hợp lệ' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const doc = await savePartnerDocument({
      partnerId: session.partner.id,
      documentType: documentType as any,
      buffer,
      originalFilename: file.name,
      mimeType: file.type || 'image/jpeg',
    });

    return NextResponse.json({
      success: true,
      message: 'Tải tài liệu thành công!',
      documentId: doc.id,
    });
  } catch (error: any) {
    console.error('Error uploading partner document:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi khi tải tài liệu') }, { status: 500 });
  }
}
