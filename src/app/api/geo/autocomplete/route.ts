import { NextRequest, NextResponse } from 'next/server';
import { searchStreetSuggestions } from '@/data/vietnam-streets';
import { streetSegmentCandidates } from '@/lib/address/streetSegments';
import { getAddressProvider } from '@/lib/address/providers';
import type { ProviderStatus } from '@/lib/address/providers';
import { loadServiceZone } from '@/lib/address/serviceZone';
import {
  finalizeSuggestions,
  hasSearchableText,
  mapLocalStreet,
  parseAddressInput,
  typedAreaOutOfZone,
} from '@/lib/address/suggest';
import type { AddressSuggestion, AutocompleteSuggestion, LatLng } from '@/lib/address/types';

export const dynamic = 'force-dynamic';

export type { AutocompleteSuggestion };

/**
 * Tình trạng nhà cung cấp để trình duyệt biết khi nào gợi ý đang bị suy giảm (chậm / lỗi / bị giới hạn lượt gọi).
 * Tên khóa `photon` giữ nguyên để tương thích; `provider` cho biết nhà cung cấp đang dùng.
 */
export interface AutocompleteMeta {
  photon: ProviderStatus;
  provider?: string;
  /** Khu khách gõ nằm ngoài vùng giao */
  outOfZone?: boolean;
}

/**
 * GET /api/geo/autocomplete?input=<nguyên chuỗi khách gõ>[&lat&lng][&province&district&ward]
 *
 * - `input` được gửi NGUYÊN VĂN cho nhà cung cấp (không cắt phần phường/quận, không nối cứng "Quận 1"/"Hồ Chí Minh").
 * - `lat`/`lng` chỉ là bias và chỉ khi trình duyệt thực sự biết vị trí khách (GPS đã cho phép, địa chỉ đã lưu).
 *   Không có thì không bias: tuyệt đối không mặc định về trung tâm Quận 1.
 * - `province/district/ward` (ô chọn ở trang thanh toán) chỉ cộng nhẹ khi chữ gõ không có địa danh nào.
 * - Vùng giao lấy từ cấu hình cửa hàng + bán kính giao (serviceZone.ts), không giữ danh sách vùng riêng ở đây.
 * - Kết quả: gộp nhà cung cấp + bảng đường nội bộ, quy đổi về phường mới + quận cũ, loại ngoài vùng giao, xếp hạng
 *   theo phường/quận khách gõ. Kết quả mâu thuẫn bị đẩy xuống cuối, không bao giờ được chọn thay khách.
 * - Nhà cung cấp chọn bằng GEO_PROVIDER (providers/index.ts).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const input = (searchParams.get('input') || '').trim().slice(0, 200);
    const meta: AutocompleteMeta = { photon: 'off' };

    if (input.length < 2 || !hasSearchableText(input)) {
      return NextResponse.json({ success: true, predictions: [], meta });
    }

    const parsed = parseAddressInput(input);
    const zone = await loadServiceZone();

    // Khu khách gõ nằm ngoài vùng giao (vd "101 Lê Lợi, Vũng Tàu"): báo ngoài vùng, KHÔNG đưa điểm gần nhất ở khu khác
    if (typedAreaOutOfZone(parsed, zone)) {
      return NextResponse.json({ success: true, predictions: [], meta: { ...meta, outOfZone: true } });
    }

    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const lat = latParam === null ? NaN : Number(latParam);
    const lng = lngParam === null ? NaN : Number(lngParam);
    const clientBias: LatLng | null =
      Number.isFinite(lat) && Number.isFinite(lng) && (zone ? zone.contains(lat, lng) : true) ? { lat, lng } : null;
    const context = {
      ward: searchParams.get('ward')?.trim() || undefined,
      district: searchParams.get('district')?.trim() || undefined,
    };

    const candidates: AddressSuggestion[] = [];

    // 1) Nhà cung cấp chính (GEO_PROVIDER). Lỗi / quá hạn / bị giới hạn thì suy giảm êm, vẫn còn bảng đường nội bộ.
    const provider = getAddressProvider();
    const result = await provider.suggest({ input, parsed, bias: clientBias, zone });
    candidates.push(...result.suggestions);
    meta.photon = result.status;
    meta.provider = provider.id;

    // 2) Bảng đường nội bộ: chỉ là ứng viên (không còn "VIP" số 1), cùng đường + phường thì ưu tiên nhà cung cấp
    try {
      for (const item of searchStreetSuggestions(input, null, null, null, 10)) {
        const mapped = mapLocalStreet(item, parsed, zone);
        if (mapped) candidates.push(mapped);
      }
    } catch (e) {
      console.warn('[Geo Autocomplete] Street dataset warning:', e);
    }

    // 3) Chưa gõ khu: thêm các đoạn đường cùng tên ở mọi quận cũ (dữ liệu OSM nội bộ) để 4 mục đầu đủ quận khác nhau
    for (const item of streetSegmentCandidates(parsed)) {
      const mapped = mapLocalStreet(item, parsed, zone);
      if (mapped) candidates.push(mapped);
    }

    const predictions = finalizeSuggestions(candidates, parsed, { bias: clientBias, context, zone });
    return NextResponse.json({ success: true, predictions, meta });
  } catch (error) {
    console.error('[Geo Autocomplete] Internal error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', predictions: [] },
      { status: 500 }
    );
  }
}
