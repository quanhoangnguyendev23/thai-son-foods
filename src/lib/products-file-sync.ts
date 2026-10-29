import fs from 'fs';
import path from 'path';

export interface ProductSyncPayload {
  id?: string;
  sku?: string;
  slug?: string;
  name?: string;
  price?: number;
  unit?: string;
  short_description?: string;
  description?: string;
  thumbnail?: string;
  category_id?: string;
  is_active?: boolean;
  is_featured?: boolean;
  is_best_seller?: boolean;
  is_new?: boolean;
}

/**
 * Cập nhật trực tiếp thông tin sản phẩm vào file static src/data/products.ts
 * để đảm bảo toàn bộ website (Header, Trang chủ, Giỏ hàng, Chi tiết sản phẩm)
 * đều đồng bộ ngay lập tức với các chỉnh sửa từ Admin.
 */
export function syncProductToStaticFile(data: ProductSyncPayload): boolean {
  // Ổ đĩa serverless (Vercel) chỉ đọc: bỏ qua, CSDL vẫn là nguồn dữ liệu chính
  if (process.env.VERCEL) return false;
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'products.ts');
    if (!fs.existsSync(filePath)) {
      console.warn('File src/data/products.ts does not exist');
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Tìm kiếm vị trí sản phẩm theo sku, id hoặc slug
    const identifiers = [data.sku, data.id, data.slug].filter(Boolean) as string[];
    let targetIndex = -1;

    for (const idStr of identifiers) {
      // Tìm dòng dạng sku: 'TSG-01' hoặc id: 'tra-sua-go' hoặc slug: 'tra-sua-go'
      const pattern = new RegExp(`['"]${idStr.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}['"]`);
      const match = content.match(pattern);
      if (match && match.index !== undefined) {
        targetIndex = match.index;
        break;
      }
    }

    if (targetIndex === -1) {
      console.warn(`Product not found in src/data/products.ts for:`, identifiers);
      return false;
    }

    // Tìm ranh giới object của sản phẩm này { ... }
    const startIdx = content.lastIndexOf('{', targetIndex);
    const nextObjIdx = content.indexOf('\n  {', targetIndex);
    const endArrIdx = content.lastIndexOf('];');
    const endIdx = nextObjIdx !== -1 ? nextObjIdx : endArrIdx;

    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
      console.warn('Could not determine product object boundaries in products.ts');
      return false;
    }

    let block = content.substring(startIdx, endIdx);

    // Cập nhật các trường
    if (data.name !== undefined && data.name !== null) {
      block = replaceFieldInBlock(block, 'name', JSON.stringify(data.name));
    }
    if (data.price !== undefined && data.price !== null) {
      block = replaceFieldInBlock(block, 'price', String(parseInt(String(data.price), 10) || 0));
    }
    if (data.unit !== undefined && data.unit !== null) {
      block = replaceFieldInBlock(block, 'unit', JSON.stringify(data.unit));
    }
    if (data.short_description !== undefined && data.short_description !== null) {
      block = replaceFieldInBlock(block, 'shortDescription', JSON.stringify(data.short_description));
    }
    if (data.description !== undefined && data.description !== null) {
      block = replaceFieldInBlock(block, 'description', JSON.stringify(data.description));
    }
    if (data.thumbnail !== undefined && data.thumbnail !== null) {
      block = replaceFieldInBlock(block, 'thumbnail', JSON.stringify(data.thumbnail));
    }
    if (data.sku !== undefined && data.sku !== null) {
      block = replaceFieldInBlock(block, 'sku', JSON.stringify(data.sku));
    }
    if (data.is_active !== undefined) {
      block = replaceFieldInBlock(block, 'isActive', String(Boolean(data.is_active)));
    }
    if (data.is_featured !== undefined) {
      block = replaceFieldInBlock(block, 'isFeatured', String(Boolean(data.is_featured)));
    }
    if (data.is_new !== undefined) {
      block = replaceFieldInBlock(block, 'isNew', String(Boolean(data.is_new)));
    }
    if (data.is_best_seller !== undefined) {
      block = replaceFieldInBlock(block, 'isBestSeller', String(Boolean(data.is_best_seller)));
    }

    const newContent = content.substring(0, startIdx) + block + content.substring(endIdx);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`[syncProductToStaticFile] Successfully synced product ${data.sku || data.id} to src/data/products.ts`);
    return true;
  } catch (error) {
    console.error('Error syncing product to products.ts:', error);
    return false;
  }
}

function replaceFieldInBlock(block: string, fieldName: string, jsonValue: string): string {
  // 1. Quoted string: field: '...' or "..." or `...`
  // Chuỗi có thể chứa ký tự thoát (\" \' \\) → khớp cả cặp \x thay vì dừng ở dấu nháy đầu tiên
  // KHÔNG dùng cờ 'g': chỉ thay lần xuất hiện ĐẦU TIÊN = trường của sản phẩm. Trước đây thay toàn khối nên
  // ghi đè luôn name/price/unit của từng quy cách (variants) bên dưới, làm hỏng dữ liệu (vd. lốc 7 chai thành 18.000đ).
  const strRegex = new RegExp(
    `(\\b${fieldName}\\s*:\\s*)(?:'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*"|\`(?:[^\`\\\\]|\\\\.)*\`)`
  );
  // Dùng hàm thay thế: chuỗi thay thế dạng "$1..." sẽ hiểu sai các ký tự $&, $1... có trong tên/mô tả sản phẩm
  if (strRegex.test(block)) {
    return block.replace(strRegex, (_m, prefix: string) => prefix + jsonValue);
  }
  // 2. Primitive (numbers, booleans)
  const primitiveRegex = new RegExp(`(\\b${fieldName}\\s*:\\s*)(?:true|false|\\d+)`);
  if (primitiveRegex.test(block)) {
    return block.replace(primitiveRegex, (_m, prefix: string) => prefix + jsonValue);
  }
  return block;
}
