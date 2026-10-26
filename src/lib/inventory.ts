import { PoolClient } from 'pg';
import { pool, query } from '@/lib/db';
import { INVENTORY_CONFIG } from '@/config/inventory';
import { isSheetInventoryMode } from '@/config/inventorySheet';

/**
 * Khi tồn kho lấy từ Google Sheet: đọc lại sheet nếu đã quá chu kỳ (không bao giờ ném lỗi, chờ tối đa vài giây).
 * Bỏ qua khi đang ở trong một transaction của nơi gọi để không giữ khóa chờ lẫn nhau.
 */
async function refreshSheetInventoryIfNeeded(client?: PoolClient): Promise<void> {
  if (client || !isSheetInventoryMode()) return;
  try {
    const mod = await import('@/lib/inventorySheet');
    await mod.ensureFreshSheetInventory();
  } catch (err) {
    console.error('[Inventory] Không làm mới được tồn kho từ sheet (bỏ qua):', err);
  }
}

// Định nghĩa lỗi thiếu tồn kho khả dụng
export class InsufficientStockError extends Error {
  public insufficientItems: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }>;

  constructor(
    message: string,
    insufficientItems: Array<{
      productId: string;
      productName: string;
      requested: number;
      available: number;
    }>
  ) {
    super(message);
    this.name = 'InsufficientStockError';
    this.insufficientItems = insufficientItems;
  }
}

// Định nghĩa lỗi thiếu tồn kho khi xác nhận đơn (confirmStock)
export class InsufficientStockConfirmError extends Error {
  public insufficientItems: Array<{
    productId: string;
    productName?: string;
    requested: number;
    available: number;
  }>;

  constructor(
    message: string,
    insufficientItems: Array<{
      productId: string;
      productName?: string;
      requested: number;
      available: number;
    }>
  ) {
    super(message);
    this.name = 'InsufficientStockConfirmError';
    this.insufficientItems = insufficientItems;
  }
}

export interface ConfirmStockOptions {
  allowOversellClamped?: boolean;
}

export interface ComboBottleBreakdown {
  productId: string;
  productName: string;
  normQuantity: number;
  unit: string;
  stockQuantity: number;
  reserved: number;
  safetyStock: number;
  available: number;
  combosPossible: number;
  isBottleneck: boolean;
  bottlesNeededForNextLevel: number;
  updatedAt?: string;
}

export interface UnifiedComboStock {
  comboId: string;
  comboSlug: string;
  comboName: string;
  storeCode: string;
  status: 'in_stock' | 'low' | 'out';
  maxCombos: number;
  isAvailable: boolean;
  lowCount: number | null;
  bottlenecks: ComboBottleBreakdown[];
  bottlesNeededToIncrease: number;
  bottles: ComboBottleBreakdown[];
  updatedAt: string;
}

export interface ExpandedBottleItem {
  productId: string; // Canonical DB product ID: 'prod-sb-01', etc.
  productName: string;
  bottleQuantity: number;
  originalItemIndex: number;
}

export interface ComboSnapshotItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
}

export interface AvailabilityResult {
  isAvailable: boolean;
  insufficientItems: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }>;
  itemsDetail: Array<{
    productId: string;
    productName: string;
    stockQuantity: number;
    reserved: number;
    available: number;
    requested: number;
  }>;
}

// Bảng ánh xạ slug/id phổ biến sang canonical product ID
const PRODUCT_ALIAS_MAP: Record<string, string> = {
  'sua-bap-nep': 'prod-sb-01',
  'sua-bap-nep-thai-son': 'prod-sb-01',
  'prod-sb-01': 'prod-sb-01',
  'prod-sbn-01': 'prod-sb-01',
  'sbn-01': 'prod-sb-01',
  'sb-01': 'prod-sb-01',

  'sua-hat-sen-mekong': 'prod-shs-01',
  'sua-hat-sen-mekong-xanh': 'prod-shs-01',
  'prod-shs-01': 'prod-shs-01',
  'shs-01': 'prod-shs-01',

  'sua-gao-lut-mekong': 'prod-sgl-01',
  'sua-gao-lut-mekong-xanh': 'prod-sgl-01',
  'prod-sgl-01': 'prod-sgl-01',
  'sgl-01': 'prod-sgl-01',

  'sam-la-han-hoa-cuc': 'prod-lh-01',
  'sam-la-han-hoa-cuc-thai-son': 'prod-lh-01',
  'prod-lh-01': 'prod-lh-01',
  'lh-01': 'prod-lh-01',

  'tao-do-hat-chia': 'prod-td-01',
  'tao-do-hat-chia-thai-son': 'prod-td-01',
  'prod-td-01': 'prod-td-01',
  'td-01': 'prod-td-01',

  'nha-dam-mu-trom': 'prod-md-01',
  'nha-dam-mu-trom-thai-son': 'prod-md-01',
  'prod-md-01': 'prod-md-01',
  'md-01': 'prod-md-01',

  'tra-sua-go': 'prod-tsg-01',
  'prod-tsg-01': 'prod-tsg-01',
  'tsg-01': 'prod-tsg-01',

  'tra-xanh-go': 'prod-txg-01',
  'prod-txg-01': 'prod-txg-01',
  'txg-01': 'prod-txg-01',

  'tra-sua-ciao': 'prod-tsa-01',
  'prod-tsa-01': 'prod-tsa-01',
  'tsa-01': 'prod-tsa-01',

  'matcha-tra-sua-ciao': 'prod-mac-01',
  'prod-mac-01': 'prod-mac-01',
  'mac-01': 'prod-mac-01',

  'sua-hat-sen-lotus': 'prod-ss-01',
  'sua-hat-sen-lotus-yoo': 'prod-ss-01',
  'prod-ss-01': 'prod-ss-01',
  'ss-01': 'prod-ss-01',

  'sua-gao-lut-ohsawa': 'prod-sl-01',
  'sua-gao-lut-ohsawa-yoo': 'prod-sl-01',
  'prod-sl-01': 'prod-sl-01',
  'sl-01': 'prod-sl-01',
};

/**
 * Tra cứu thông tin sản phẩm chuẩn từ DB dựa vào id/slug/sku/alias/variant id.
 * CHỈ khớp theo mã (không khớp mờ theo tên): tên do trình duyệt gửi không được quyết định sản phẩm/giá/tồn kho.
 * Nếu mã trỏ tới một quy cách (product_variants) thì trả kèm `variant` lấy từ DB.
 */
export async function resolveProductCanonical(
  rawId: string | null | undefined,
  nameHint?: string,
  client?: PoolClient
): Promise<{
  id: string;
  name: string;
  price: number;
  unit?: string;
  variant?: { id: string; name: string; unit: string | null; price: number; quantity: number | null; bottleMultiplier: number | null };
} | null> {
  if (!rawId && !nameHint) return null;

  const rawClean = (rawId || '').toLowerCase().trim();
  if (!rawClean) return null;

  // 1. Kiểm tra alias tĩnh
  if (PRODUCT_ALIAS_MAP[rawClean]) {
    const canonicalId = PRODUCT_ALIAS_MAP[rawClean];
    const sql = `SELECT id, name, price, unit FROM products WHERE id = $1 LIMIT 1;`;
    const res = client ? await client.query(sql, [canonicalId]) : await query(sql, [canonicalId]);
    if (res.rows.length > 0) return res.rows[0];
  }

  // 2. Tra bảng product_variants: variant ID nhúng trong chuỗi (format: slug-var_prodId_suffix) hoặc exact ID
  const pvSql = `
    SELECT pv.product_id AS id, p.name, p.price, pv.unit,
           pv.id AS variant_id, pv.name AS variant_name, pv.price AS variant_price,
           pv.quantity AS variant_quantity, pv.bottle_multiplier AS variant_bottle_multiplier
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE pv.id = $1
    LIMIT 1;
  `;
  const embeddedVarMatch = rawClean.match(/var_[a-z0-9_-]+/i);
  const variantCandidates = embeddedVarMatch && embeddedVarMatch[0] !== rawClean ? [embeddedVarMatch[0], rawClean] : [rawClean];
  for (const variantId of variantCandidates) {
    const pvRes = client ? await client.query(pvSql, [variantId]) : await query(pvSql, [variantId]);
    if (pvRes.rows.length > 0) {
      const r = pvRes.rows[0];
      return {
        id: r.id,
        name: r.name,
        price: r.price,
        unit: r.unit,
        variant: {
          id: r.variant_id,
          name: r.variant_name,
          unit: r.unit,
          price: Number(r.variant_price),
          quantity: r.variant_quantity === null ? null : Number(r.variant_quantity),
          bottleMultiplier: r.variant_bottle_multiplier === null ? null : Number(r.variant_bottle_multiplier),
        },
      };
    }
  }

  // 3. Tìm trực tiếp trong bảng products theo id / slug / sku (so khớp chính xác, không dùng ILIKE theo tên)
  const sqlDirect = `
    SELECT id, name, price, unit FROM products
    WHERE id = $1 OR slug = $1 OR LOWER(sku) = $1
    LIMIT 1;
  `;
  const resDirect = client
    ? await client.query(sqlDirect, [rawClean])
    : await query(sqlDirect, [rawClean]);

  if (resDirect.rows.length > 0) return resDirect.rows[0];

  // 4. Tách variant suffix nếu có (ví dụ 'sua-bap-nep-sb-7chai' -> 'sua-bap-nep')
  const baseSuffixClean = rawClean.split('-standard')[0].replace(/-[a-z0-9]+chai.*$/i, '');
  if (PRODUCT_ALIAS_MAP[baseSuffixClean]) {
    const canonicalId = PRODUCT_ALIAS_MAP[baseSuffixClean];
    const sql = `SELECT id, name, price, unit FROM products WHERE id = $1 LIMIT 1;`;
    const res = client ? await client.query(sql, [canonicalId]) : await query(sql, [canonicalId]);
    if (res.rows.length > 0) return res.rows[0];
  }

  // 5. Tách suffix liên tiếp để tìm base slug (slug-XX-Ychai → slug-XX → slug)
  let candidate = rawClean;
  while (candidate.includes('-')) {
    candidate = candidate.replace(/-[^-]+$/, '');
    if (PRODUCT_ALIAS_MAP[candidate]) {
      const canonicalId = PRODUCT_ALIAS_MAP[candidate];
      const sql = `SELECT id, name, price, unit FROM products WHERE id = $1 LIMIT 1;`;
      const res = client ? await client.query(sql, [canonicalId]) : await query(sql, [canonicalId]);
      if (res.rows.length > 0) return res.rows[0];
    }
  }

  return null;
}

/**
 * Trích xuất hệ số số chai từ variant ID hoặc text đơn vị
 * QUY TẮC NGHIÊM NGẶT: Không tự ý fallback về 1 nếu không có chỉ báo chai đơn lẻ rõ ràng.
 */
export function extractBottleMultiplier(rawId: string, unit?: string, name?: string): number {
  const cleanId = (rawId || '').toLowerCase().trim();
  const cleanUnit = (unit || '').toLowerCase().trim();
  const cleanName = (name || '').toLowerCase().trim();
  const textDesc = `${cleanUnit} ${cleanName}`;

  // 0. Hậu tố ID biến thể do hệ thống sinh ("...-td-7chai", "...-lh-12chai") là nguồn đáng tin nhất.
  //    Tên/đơn vị hiển thị có thể bị sửa tay trong admin (vd: dán cả câu mô tả "Lốc 10 chai ...") nên chỉ dùng làm dự phòng.
  if (!cleanId.match(/^prod-[a-z0-9]+-\d+$/i) && !cleanId.match(/^prod-\d+$/i)) {
    const idSuffix = cleanId.match(/[-_](\d+)chai$/i);
    if (idSuffix) {
      const num = parseInt(idSuffix[1], 10);
      if (!isNaN(num) && num > 0 && num <= 1000) return num;
    }
  }

  // 1. Bắt mẫu số lượng từ text mô tả (unit và name): "7 chai", "12 chai", "Lốc 7", "Thùng 24", "Pack of 6", "6 lon"
  const matchChai = textDesc.match(/(\d+)\s*(chai|bottle)/i);
  if (matchChai) {
    const num = parseInt(matchChai[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // 2. Bắt các quy cách đóng gói từ text: lốc X, thùng X, pack X, X lon, X ly
  const packMatch = textDesc.match(/(?:lốc|thùng|hộp|pack|set)\s*(\d+)/i) || 
                    textDesc.match(/(\d+)\s*(?:lốc|thùng|hộp|pack|lon|ly)/i);
  if (packMatch) {
    const num = parseInt(packMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // 3. Bắt mẫu từ variant ID suffix (như "sb-7chai", "-10chai", "-loc5", "-thung24")
  // Phải có chỉ báo quy cách đóng gói rõ ràng (chai, loc, thung, pack, lon, ly) và hệ số thực tế (<= 1000)
  if (!cleanId.match(/^prod-[a-z0-9]+-\d+$/i) && !cleanId.match(/^prod-\d+$/i)) {
    const variantMatch = cleanId.match(/[-_](\d+)\s*(?:chai|loc|thung|pack|lon|ly)/i) || 
                         cleanId.match(/[-_](?:loc|thung|pack|lon)(\d+)/i);
    if (variantMatch) {
      const num = parseInt(variantMatch[1], 10);
      if (!isNaN(num) && num > 0 && num <= 1000) return num;
    }
  }

  // 4. Nếu là đơn vị chai đơn lẻ đã xác định rõ ràng (chai, 1 chai, 330ml, 568ml, 270ml...)
  if (cleanUnit === 'chai' || cleanUnit === '1 chai' || cleanUnit === 'bottle' || 
      cleanUnit.endsWith('ml') || cleanUnit.endsWith('l')) {
    return 1;
  }
  if (textDesc.includes('1 chai') || textDesc.includes('chai 330ml') || textDesc.includes('chai 568ml') || textDesc.includes('chai 270ml') || textDesc.includes('chai lẻ') || textDesc.includes('chai le')) {
    return 1;
  }

  // KHÔNG CÒN FALLBACK VỀ 1 NỮA: Ném lỗi rõ ràng khi không xác định được hệ số chai
  throw new Error(
    `[INVENTORY_UNKNOWN_MULTIPLIER] Không thể xác định hệ số chai cho biến thể/sản phẩm: ` +
    `id="${rawId}", unit="${unit || ''}", name="${name || ''}". ` +
    `Hệ thống từ chối fallback về 1 để tránh sai lệch tồn kho.`
  );
}

/**
 * Bóc tách toàn bộ giỏ hàng / danh sách đơn thành danh sách từng chai riêng lẻ
 * Đồng thời tạo snapshot thành phần combo cho mỗi dòng
 */
export async function expandComboItems(
  items: Array<{
    productId?: string | null;
    product_id?: string | null;
    id?: string | null;
    name?: string;
    quantity: number;
    unit?: string;
    price?: number;
  }>,
  client?: PoolClient
): Promise<{
  expandedBottles: ExpandedBottleItem[];
  comboSnapshots: Array<ComboSnapshotItem[] | null>;
}> {
  const expandedBottles: ExpandedBottleItem[] = [];
  const comboSnapshots: Array<ComboSnapshotItem[] | null> = [];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const rawId = ((item as any).productId || (item as any).product_id || (item as any).id || '').trim();
    if (!rawId) {
      throw new Error(
        `[INVENTORY_MISSING_PRODUCT_ID] Dòng sản phẩm thứ ${idx + 1} thiếu productId: ` +
        `${JSON.stringify(item)}. Không thể kiểm tra và bóc tách tồn kho.`
      );
    }
    const itemQty = Math.max(1, Math.round(Number(item.quantity) || 1));

    let isCombo = false;
    const currentComboSnapshot: ComboSnapshotItem[] = [];

    // TRƯỜNG HỢP 1: Combo 4 chai tự chọn dạng combo-4-chai-[id:qty_id:qty]
    if (rawId.startsWith('combo-4-chai-')) {
      isCombo = true;
      const fingerprint = rawId.replace('combo-4-chai-', '');
      const parts = fingerprint.split('_');

      for (const part of parts) {
        const [pId, pQtyStr] = part.split(':');
        const pQty = parseInt(pQtyStr, 10) || 1;
        const prod = await resolveProductCanonical(pId, undefined, client);

        if (prod) {
          const totalBottles = pQty * itemQty;
          expandedBottles.push({
            productId: prod.id,
            productName: prod.name,
            bottleQuantity: totalBottles,
            originalItemIndex: idx,
          });
          currentComboSnapshot.push({
            productId: prod.id,
            productName: prod.name,
            quantity: pQty,
            unit: 'chai',
          });
        }
      }
    }
    // TRƯỜNG HỢP 2: Combo văn phòng tự chọn dạng combo-van-phong-[step1]_[step2]_[step3]
    else if (rawId.startsWith('combo-van-phong-') && rawId.includes('_')) {
      isCombo = true;
      const parts = rawId.replace('combo-van-phong-', '').split('_');
      // Quy ước combo văn phòng: 5 chai step1, 3 chai step2, 2 chai step3
      const steps = [
        { id: parts[0], qty: 5 },
        { id: parts[1], qty: 3 },
        { id: parts[2], qty: 2 },
      ];

      for (const step of steps) {
        if (!step.id) continue;
        const prod = await resolveProductCanonical(step.id, undefined, client);
        if (prod) {
          const totalBottles = step.qty * itemQty;
          expandedBottles.push({
            productId: prod.id,
            productName: prod.name,
            bottleQuantity: totalBottles,
            originalItemIndex: idx,
          });
          currentComboSnapshot.push({
            productId: prod.id,
            productName: prod.name,
            quantity: step.qty,
            unit: 'chai',
          });
        }
      }
    }
    // TRƯỜNG HỢP 3: Combo siêu hời dạng combo-5-[prodA]_10-[prodB]_5_plus2
    else if (rawId.startsWith('combo-5-') && rawId.includes('_plus2')) {
      isCombo = true;
      // Trích xuất prodA (10 chai) và prodB (7 chai: 5 + 2 tặng)
      const cleaned = rawId.replace('combo-5-', '').replace('_plus2', '');
      const parts = cleaned.split('_');
      const prodAId = (parts[0] || '').replace(/_10$/, '');
      const prodBId = (parts[1] || '').replace(/_5$/, '');

      const prodA = await resolveProductCanonical(prodAId, undefined, client);
      if (prodA) {
        expandedBottles.push({
          productId: prodA.id,
          productName: prodA.name,
          bottleQuantity: 10 * itemQty,
          originalItemIndex: idx,
        });
        currentComboSnapshot.push({
          productId: prodA.id,
          productName: prodA.name,
          quantity: 10,
          unit: 'chai',
        });
      }

      const prodB = await resolveProductCanonical(prodBId, undefined, client);
      if (prodB) {
        expandedBottles.push({
          productId: prodB.id,
          productName: prodB.name,
          bottleQuantity: 7 * itemQty,
          originalItemIndex: idx,
        });
        currentComboSnapshot.push({
          productId: prodB.id,
          productName: prodB.name,
          quantity: 7,
          unit: 'chai',
        });
      }
    }
    // TRƯỜNG HỢP 4: Combo bậc thang dạng combo-6-[slot1]_[slot2]_[slot3]_[size]
    else if (rawId.startsWith('combo-6-') && rawId.includes('_')) {
      isCombo = true;
      const parts = rawId.replace('combo-6-', '').split('_');
      const packageSize = parseInt(parts[parts.length - 1], 10) || 20;

      if (packageSize === 20) {
        const slot1 = parts[0];
        const slot2 = parts[1];
        if (slot1 === slot2) {
          const prod = await resolveProductCanonical(slot1, undefined, client);
          if (prod) {
            expandedBottles.push({
              productId: prod.id,
              productName: prod.name,
              bottleQuantity: 20 * itemQty,
              originalItemIndex: idx,
            });
            currentComboSnapshot.push({
              productId: prod.id,
              productName: prod.name,
              quantity: 20,
              unit: 'chai',
            });
          }
        } else {
          const prod1 = await resolveProductCanonical(slot1, undefined, client);
          const prod2 = await resolveProductCanonical(slot2, undefined, client);
          if (prod1) {
            expandedBottles.push({
              productId: prod1.id,
              productName: prod1.name,
              bottleQuantity: 10 * itemQty,
              originalItemIndex: idx,
            });
            currentComboSnapshot.push({
              productId: prod1.id,
              productName: prod1.name,
              quantity: 10,
              unit: 'chai',
            });
          }
          if (prod2) {
            expandedBottles.push({
              productId: prod2.id,
              productName: prod2.name,
              bottleQuantity: 10 * itemQty,
              originalItemIndex: idx,
            });
            currentComboSnapshot.push({
              productId: prod2.id,
              productName: prod2.name,
              quantity: 10,
              unit: 'chai',
            });
          }
        }
      } else if (packageSize === 30) {
        const slot1 = parts[0];
        const slot2 = parts[1];
        const slot3 = parts[2];
        const slots = [slot1, slot2, slot3];
        for (const s of slots) {
          if (!s || s === 'none') continue;
          const prod = await resolveProductCanonical(s, undefined, client);
          if (prod) {
            expandedBottles.push({
              productId: prod.id,
              productName: prod.name,
              bottleQuantity: 10 * itemQty,
              originalItemIndex: idx,
            });
            currentComboSnapshot.push({
              productId: prod.id,
              productName: prod.name,
              quantity: 10,
              unit: 'chai',
            });
          }
        }
      }
    }
    // TRƯỜNG HỢP 5: Combo cố định từ DB (combo-van-phong, combo-uu-dai, combo-4,...)
    else {
      const comboSql = `SELECT * FROM combos WHERE id = $1 OR slug = $1 LIMIT 1;`;
      const comboRes = client ? await client.query(comboSql, [rawId]) : await query(comboSql, [rawId]);

      if (comboRes.rows.length > 0) {
        isCombo = true;
        const combo = comboRes.rows[0];
        const itemsSql = `SELECT product_id, quantity, unit FROM combo_items WHERE combo_id = $1;`;
        const itemsRes = client ? await client.query(itemsSql, [combo.id]) : await query(itemsSql, [combo.id]);

        for (const cItem of itemsRes.rows) {
          const prod = await resolveProductCanonical(cItem.product_id, undefined, client);
          if (prod) {
            const totalBottles = cItem.quantity * itemQty;
            expandedBottles.push({
              productId: prod.id,
              productName: prod.name,
              bottleQuantity: totalBottles,
              originalItemIndex: idx,
            });
            currentComboSnapshot.push({
              productId: prod.id,
              productName: prod.name,
              quantity: cItem.quantity,
              unit: cItem.unit || 'chai',
            });
          }
        }
      }
    }

    // TRƯỜNG HỢP 6: Sản phẩm đơn lẻ hoặc Variant bình thường
    if (!isCombo) {
      const prod = await resolveProductCanonical(rawId, item.name, client);
      if (prod) {
        // Thử lấy bottle_multiplier từ bảng product_variants nếu có
        let dbMultiplier: number | null = null;
        try {
          // product_variants.id có dạng "var_<productId>_<variantId>"; rawId của giỏ hàng là "<productId>-<variantId>"
          const variantKey = rawId.startsWith(`${prod.id}-`) ? `var_${prod.id}_${rawId.slice(prod.id.length + 1)}` : rawId;
          const pvSql = `SELECT bottle_multiplier, quantity FROM product_variants WHERE id = $1 OR id = $2 OR id = $3 LIMIT 1;`;
          const resolvedVariantId = prod.variant?.id || variantKey;
          const pvRes = client ? await client.query(pvSql, [rawId, variantKey, resolvedVariantId]) : await query(pvSql, [rawId, variantKey, resolvedVariantId]);
          if (pvRes.rows.length > 0 && pvRes.rows[0].bottle_multiplier > 0) {
            dbMultiplier = Number(pvRes.rows[0].bottle_multiplier);
          }
        } catch {
          // Bỏ qua nếu query lỗi hoặc DB chưa có cột
        }

        const effectiveUnit = item.unit || prod.unit;
        const multiplier = dbMultiplier || extractBottleMultiplier(rawId, effectiveUnit, item.name || prod.name);
        if (!multiplier || isNaN(multiplier) || multiplier <= 0) {
          throw new Error(
            `[INVENTORY_UNKNOWN_MULTIPLIER] Thiếu hệ số chai hợp lệ cho sản phẩm/biến thể: ` +
            `id="${rawId}", name="${item.name || prod.name}", unit="${item.unit || ''}". ` +
            `Vui lòng kiểm tra cấu hình bottle_multiplier.`
          );
        }
        const totalBottles = multiplier * itemQty;
        expandedBottles.push({
          productId: prod.id,
          productName: prod.name,
          bottleQuantity: totalBottles,
          originalItemIndex: idx,
        });
      } else if (rawId) {
        // FAIL-FAST: Không cho phép bỏ sót sản phẩm không nhận dạng được
        throw new Error(
          `[INVENTORY_RESOLVE_FAILED] Không thể nhận dạng sản phẩm: ` +
          `product_id="${rawId}", name="${item.name || ''}". ` +
          `Không tìm thấy trong products, product_variants, hay PRODUCT_ALIAS_MAP. ` +
          `Đơn hàng bị từ chối để tránh lọt kho.`
        );
      }
      comboSnapshots.push(null);
    } else {
      comboSnapshots.push(currentComboSnapshot.length > 0 ? currentComboSnapshot : null);
    }
  }

  return { expandedBottles, comboSnapshots };
}

export interface SellableItemInput {
  productId?: string | null;
  product_id?: string | null;
  id?: string | null;
  name?: string;
  unit?: string;
  quantity?: number;
}

/**
 * Công thức tính tồn bán được duy nhất:
 * sellable = max(0, stock - reserved - safety_stock)
 */
export function calculateSellable(
  stock: number | string | null | undefined,
  reserved: number | string | null | undefined,
  safetyStock: number | string | null | undefined
): number {
  const s = Math.max(0, Number(stock) || 0);
  const r = Math.max(0, Number(reserved) || 0);
  const safe = Math.max(0, Number(safetyStock) || 0);
  return Math.max(0, s - r - safe);
}

/**
 * HÀM DUY NHẤT TÍNH TỒN BÁN ĐƯỢC (getSellableQuantity)
 * Công thức: max(0, stock - reserved - safety_stock)
 * Tự động bóc tách combo và quy đổi lốc/thùng theo bottle_multiplier.
 * 
 * Hỗ trợ 2 kiểu gọi:
 * 1. Dạng tính toán trực tiếp: getSellableQuantity(stock, reserved, safetyStock) => number
 * 2. Dạng tra cứu kho chi nhánh: getSellableQuantity(storeCode, target, client?) => Promise<number>
 *    trong đó target có thể là productId (chai lẻ, lốc, combo), hoặc object item, hoặc mảng items (giỏ hàng).
 */
export function getSellableQuantity(stock: number, reserved: number, safetyStock: number): number;
export function getSellableQuantity(
  storeCode: string,
  target: string | SellableItemInput | SellableItemInput[],
  client?: PoolClient
): Promise<number>;
export function getSellableQuantity(
  storeCodeOrStock: string | number,
  targetOrReserved?: any,
  clientOrSafety?: any
): number | Promise<number> {
  // 1. Quá tải dạng số trực tiếp: getSellableQuantity(stock, reserved, safetyStock)
  if (typeof storeCodeOrStock === 'number') {
    return calculateSellable(storeCodeOrStock, targetOrReserved, clientOrSafety);
  }

  const storeCode = storeCodeOrStock;
  const target = targetOrReserved;
  const client: PoolClient | undefined = clientOrSafety;

  return (async () => {
    if (!target) return 0;

    // Chuẩn hóa input thành danh sách item
    let inputItems: Array<{ productId: string; name?: string; unit?: string; quantity: number }> = [];

    if (typeof target === 'string') {
      const raw = target.trim();
      if (!raw) return 0;
      inputItems = [{ productId: raw, quantity: 1 }];
    } else if (Array.isArray(target)) {
      if (target.length === 0) return 0;
      inputItems = target
        .map((t) => ({
          productId: (t.productId || t.product_id || t.id || '').trim(),
          name: t.name,
          unit: t.unit,
          quantity: Math.max(1, Number(t.quantity) || 1),
        }))
        .filter((t) => Boolean(t.productId));
      if (inputItems.length === 0) return 0;
    } else {
      const pId = (target.productId || target.product_id || target.id || '').trim();
      if (!pId) return 0;
      inputItems = [
        {
          productId: pId,
          name: target.name,
          unit: target.unit,
          quantity: 1,
        },
      ];
    }

    // 1. Quét dọn reservation hết hạn có throttle 60s
    await cleanupExpiredReservationsThrottled(client);

    // 2. Bóc tách sản phẩm thành từng chai vật lý với bottle_multiplier và combo breakdown
    let expandedBottles: ExpandedBottleItem[] = [];
    try {
      const res = await expandComboItems(inputItems, client);
      expandedBottles = res.expandedBottles;
    } catch (err: any) {
      console.warn(`[getSellableQuantity] Lỗi expandComboItems cho target ${JSON.stringify(target)}:`, err?.message || err);
      return 0;
    }
    if (expandedBottles.length === 0) return 0;

    // 3. Gom nhóm tổng số chai vật lý yêu cầu cho mỗi canonical productId
    const requiredMap = new Map<string, number>();
    for (const b of expandedBottles) {
      const cur = requiredMap.get(b.productId) || 0;
      requiredMap.set(b.productId, cur + b.bottleQuantity);
    }

    const productIds = Array.from(requiredMap.keys());
    if (productIds.length === 0) return 0;

    // 4. Lấy tồn kho vật lý, đang giữ và tồn an toàn của các chai tại storeCode
    const sql = `
      SELECT product_id, stock_quantity, reserved, safety_stock
      FROM store_inventory
      WHERE store_code = $1 AND product_id = ANY($2);
    `;
    const res = client
      ? await client.query(sql, [storeCode, productIds])
      : await query(sql, [storeCode, productIds]);

    const invMap = new Map<string, { stock: number; reserved: number; safety: number }>();
    for (const row of res.rows) {
      invMap.set(row.product_id, {
        stock: Number(row.stock_quantity) || 0,
        reserved: Number(row.reserved) || 0,
        safety: Number(row.safety_stock) || 0,
      });
    }

    // 5. Tính số đơn vị bán được tối đa:
    //    Với mỗi chai canonical: sellable = calculateSellable(stock, reserved, safety)
    //    Số đơn vị có thể đáp ứng = floor(sellable / requiredPerUnit)
    //    Kết quả cuối cùng = min của tất cả các chai thành phần
    const limits: number[] = [];
    for (const [pId, requiredQty] of requiredMap.entries()) {
      const inv = invMap.get(pId) || { stock: 0, reserved: 0, safety: 0 };
      const sellableBottles = calculateSellable(inv.stock, inv.reserved, inv.safety);
      if (requiredQty > 0) {
        limits.push(Math.floor(sellableBottles / requiredQty));
      }
    }

    if (limits.length === 0) return 0;
    return Math.max(0, Math.min(...limits));
  })();
}

/**
 * Kiểm tra tồn kho khả dụng tại một chi nhánh cho toàn bộ danh sách sản phẩm (đã bóc combo)
 */
export async function getAvailability(
  storeCode: string,
  items: Array<{ productId?: string | null; product_id?: string | null; name?: string; quantity: number; unit?: string }>,
  client?: PoolClient
): Promise<AvailabilityResult> {
  await refreshSheetInventoryIfNeeded(client);

  // Bóc tách toàn bộ sản phẩm thành từng chai
  const { expandedBottles } = await expandComboItems(items, client);

  // Tổng hợp số chai cần cho mỗi productId
  const requiredMap = new Map<string, { name: string; quantity: number }>();
  for (const bottle of expandedBottles) {
    const existing = requiredMap.get(bottle.productId);
    if (existing) {
      existing.quantity += bottle.bottleQuantity;
    } else {
      requiredMap.set(bottle.productId, {
        name: bottle.productName,
        quantity: bottle.bottleQuantity,
      });
    }
  }

  const productIds = Array.from(requiredMap.keys());
  if (productIds.length === 0) {
    return { isAvailable: true, insufficientItems: [], itemsDetail: [] };
  }

  // Truy vấn tồn kho của chi nhánh
  const sql = `
    SELECT product_id, stock_quantity, reserved, safety_stock
    FROM store_inventory
    WHERE store_code = $1 AND product_id = ANY($2);
  `;
  const invRes = client ? await client.query(sql, [storeCode, productIds]) : await query(sql, [storeCode, productIds]);

  const invMap = new Map<string, { stock_quantity: number; reserved: number; safety_stock: number }>();
  for (const row of invRes.rows) {
    invMap.set(row.product_id, {
      stock_quantity: Number(row.stock_quantity) || 0,
      reserved: Number(row.reserved) || 0,
      safety_stock: Number(row.safety_stock) || 0,
    });
  }

  const insufficientItems: AvailabilityResult['insufficientItems'] = [];
  const itemsDetail: AvailabilityResult['itemsDetail'] = [];

  for (const [pId, req] of requiredMap.entries()) {
    const inv = invMap.get(pId) || { stock_quantity: 0, reserved: 0, safety_stock: 0 };
    const available = calculateSellable(inv.stock_quantity, inv.reserved, inv.safety_stock);

    itemsDetail.push({
      productId: pId,
      productName: req.name,
      stockQuantity: inv.stock_quantity,
      reserved: inv.reserved,
      available,
      requested: req.quantity,
    });

    if (available < req.quantity) {
      insufficientItems.push({
        productId: pId,
        productName: req.name,
        requested: req.quantity,
        available,
      });
    }
  }

  return {
    isAvailable: insufficientItems.length === 0,
    insufficientItems,
    itemsDetail,
  };
}

// Module-level timestamp để throttle việc quét dọn reservation hết hạn
let lastCleanupTimestamp = 0;
const CLEANUP_THROTTLE_MS = 60_000; // 60 giây

/**
 * Quét dọn reservation hết hạn có throttle 60s để tránh spam query khi có nhiều traffic
 */
export async function cleanupExpiredReservationsThrottled(
  client?: PoolClient
): Promise<{ cleaned: boolean; releasedReservationsCount?: number; cancelledOrdersCount?: number }> {
  await refreshSheetInventoryIfNeeded(client);

  const now = Date.now();
  if (now - lastCleanupTimestamp < CLEANUP_THROTTLE_MS) {
    return { cleaned: false };
  }
  lastCleanupTimestamp = now;
  try {
    const res = await cleanupExpiredReservations(client);
    return {
      cleaned: true,
      releasedReservationsCount: res.releasedReservationsCount,
      cancelledOrdersCount: res.cancelledOrdersCount,
    };
  } catch (err) {
    console.error('[cleanupExpiredReservationsThrottled] Error:', err);
    return { cleaned: false };
  }
}

/**
 * HÀM TÍNH TỒN COMBO CHUẨN DUY NHẤT (dùng chung cho cả hiển thị công khai, admin và chặn đặt hàng)
 * Công thức:
 * Mỗi chai thành phần:
 *   khả dụng = max(0, stock_quantity - reserved - safety_stock)
 *   combosPossible = floor(khả dụng / định mức riêng của chai đó trong combo_items)
 * Kết quả combo = min(combosPossible của tất cả các chai)
 */
export async function getComboStockDetails(
  storeCode: string,
  comboIdOrSlug: string,
  client?: PoolClient
): Promise<UnifiedComboStock> {
  // 1. Tự động dọn dẹp reservation hết hạn nếu đã qua 60s
  await cleanupExpiredReservationsThrottled(client);

  // 2. Bóc tách sản phẩm theo định mức riêng của 1 combo (quantity = 1)
  const { expandedBottles } = await expandComboItems(
    [{ productId: comboIdOrSlug, quantity: 1 }],
    client
  );

  // 3. Gom nhóm theo productId để có định mức chính xác cho từng chai
  const normMap = new Map<string, { name: string; normQuantity: number }>();
  for (const b of expandedBottles) {
    const cur = normMap.get(b.productId);
    if (cur) {
      cur.normQuantity += b.bottleQuantity;
    } else {
      normMap.set(b.productId, { name: b.productName, normQuantity: b.bottleQuantity });
    }
  }

  const productIds = Array.from(normMap.keys());
  if (productIds.length === 0) {
    return {
      comboId: comboIdOrSlug,
      comboSlug: comboIdOrSlug,
      comboName: comboIdOrSlug,
      storeCode,
      status: 'out',
      maxCombos: 0,
      isAvailable: false,
      lowCount: null,
      bottlenecks: [],
      bottlesNeededToIncrease: 0,
      bottles: [],
      updatedAt: new Date().toISOString(),
    };
  }

  // 4. Lấy tồn kho thực tế của các chai thành phần tại chi nhánh
  const sql = `
    SELECT product_id, stock_quantity, reserved, safety_stock, updated_at
    FROM store_inventory
    WHERE store_code = $1 AND product_id = ANY($2);
  `;
  const invRes = client ? await client.query(sql, [storeCode, productIds]) : await query(sql, [storeCode, productIds]);
  const invMap = new Map<string, { stock_quantity: number; reserved: number; safety_stock: number; updated_at?: string }>();
  for (const row of invRes.rows) {
    invMap.set(row.product_id, {
      stock_quantity: Number(row.stock_quantity) || 0,
      reserved: Number(row.reserved) || 0,
      safety_stock: Number(row.safety_stock) || 0,
      updated_at: row.updated_at,
    });
  }

  // 5. Tính từng chai theo định mức riêng và tồn khả dụng:
  //    khả dụng = max(0, stock - reserved - safety_stock)
  //    combosPossible = floor(khả dụng / normQuantity)
  const bottles: ComboBottleBreakdown[] = [];
  for (const [pId, req] of normMap.entries()) {
    const inv = invMap.get(pId) || { stock_quantity: 0, reserved: 0, safety_stock: 0 };
    const stockQuantity = inv.stock_quantity;
    const reserved = inv.reserved;
    const safetyStock = inv.safety_stock;
    const available = calculateSellable(stockQuantity, reserved, safetyStock);
    const normQuantity = req.normQuantity;
    const combosPossible = normQuantity > 0 ? Math.floor(available / normQuantity) : 0;

    bottles.push({
      productId: pId,
      productName: req.name,
      normQuantity,
      unit: 'chai',
      stockQuantity,
      reserved,
      safetyStock,
      available,
      combosPossible,
      isBottleneck: false,
      bottlesNeededForNextLevel: 0,
      updatedAt: inv.updated_at,
    });
  }

  // 6. Tồn combo tối đa = min(combosPossible) của tất cả các chai
  const maxCombos = bottles.length > 0 ? Math.min(...bottles.map((b) => b.combosPossible)) : 0;

  // 7. Xác định các chai nút thắt (chai có combosPossible == maxCombos)
  //    và tính số chai cần nhập thêm để lên mức (maxCombos + 1)
  for (const b of bottles) {
    b.isBottleneck = b.combosPossible === maxCombos;
    b.bottlesNeededForNextLevel = Math.max(0, (maxCombos + 1) * b.normQuantity - b.available);
  }

  const bottlenecks = bottles.filter((b) => b.isBottleneck);
  const bottlesNeededToIncrease =
    bottlenecks.length > 0 ? Math.max(...bottlenecks.map((b) => b.bottlesNeededForNextLevel)) : 0;

  const status: 'in_stock' | 'low' | 'out' =
    maxCombos === 0 ? 'out' : maxCombos <= 10 ? 'low' : 'in_stock';

  return {
    comboId: comboIdOrSlug,
    comboSlug: comboIdOrSlug,
    comboName: comboIdOrSlug,
    storeCode,
    status,
    maxCombos,
    isAvailable: maxCombos > 0,
    lowCount: maxCombos <= 10 ? maxCombos : null,
    bottlenecks,
    bottlesNeededToIncrease,
    bottles,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Giữ chỗ tồn kho trong Transaction với SELECT ... FOR UPDATE (sắp xếp product_id để chống deadlock)
 */
export async function reserveStock(
  storeCode: string,
  orderId: string,
  expandedBottles: ExpandedBottleItem[],
  client: PoolClient,
  expiryHours: number = INVENTORY_CONFIG.RESERVATION_EXPIRY_HOURS
): Promise<void> {
  // 1. Gom nhóm số chai theo product_id
  const bottleSummary = new Map<string, { name: string; quantity: number }>();
  for (const b of expandedBottles) {
    const cur = bottleSummary.get(b.productId);
    if (cur) {
      cur.quantity += b.bottleQuantity;
    } else {
      bottleSummary.set(b.productId, { name: b.productName, quantity: b.bottleQuantity });
    }
  }

  const sortedProductIds = Array.from(bottleSummary.keys()).sort();
  if (sortedProductIds.length === 0) return;

  // 2. SELECT ... FOR UPDATE theo thứ tự product_id tăng dần để tránh deadlock tuyệt đối
  const lockSql = `
    SELECT product_id, stock_quantity, reserved, safety_stock
    FROM store_inventory
    WHERE store_code = $1 AND product_id = ANY($2)
    ORDER BY product_id ASC
    FOR UPDATE;
  `;
  const lockRes = await client.query(lockSql, [storeCode, sortedProductIds]);

  const lockedMap = new Map<string, { stock_quantity: number; reserved: number; safety_stock: number }>();
  for (const row of lockRes.rows) {
    lockedMap.set(row.product_id, {
      stock_quantity: Number(row.stock_quantity) || 0,
      reserved: Number(row.reserved) || 0,
      safety_stock: Number(row.safety_stock) || 0,
    });
  }

  // 3. Kiểm tra lại tồn khả dụng dưới khóa độc quyền
  const insufficientItems: AvailabilityResult['insufficientItems'] = [];
  for (const pId of sortedProductIds) {
    const req = bottleSummary.get(pId)!;
    const inv = lockedMap.get(pId) || { stock_quantity: 0, reserved: 0, safety_stock: 0 };
    const available = calculateSellable(inv.stock_quantity, inv.reserved, inv.safety_stock);

    if (available < req.quantity) {
      insufficientItems.push({
        productId: pId,
        productName: req.name,
        requested: req.quantity,
        available,
      });
    }
  }

  if (insufficientItems.length > 0) {
    throw new InsufficientStockError(
      'Tồn kho khả dụng không đủ tại chi nhánh để hoàn tất giữ chỗ',
      insufficientItems
    );
  }

  // 4. Tạo reservations và cập nhật reserved trong store_inventory
  for (const b of expandedBottles) {
    const resId = `res_${orderId}_${b.productId}_${Math.floor(1000 + Math.random() * 9000)}`;
    await client.query(
      `INSERT INTO stock_reservations (id, order_id, store_code, product_id, quantity, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP + ($6 || ' hours')::INTERVAL);`,
      [resId, orderId, storeCode, b.productId, b.bottleQuantity, expiryHours.toString()]
    );
  }

  for (const [pId, req] of bottleSummary.entries()) {
    const inv = lockedMap.get(pId) || { stock_quantity: 0, reserved: 0, safety_stock: 0 };
    await client.query(
      `UPDATE store_inventory
       SET reserved = reserved + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE store_code = $2 AND product_id = $3;`,
      [req.quantity, storeCode, pId]
    );

    await logInventoryChange(client, {
      storeCode,
      productId: pId,
      oldStock: inv.stock_quantity,
      newStock: inv.stock_quantity,
      oldReserved: inv.reserved,
      newReserved: inv.reserved + req.quantity,
      changeType: 'order_reserved',
      orderId,
      actor: 'system',
      note: `Đặt đơn ${orderId} - Giữ chỗ ${req.quantity} chai`,
    });
  }
}

/**
 * Xác nhận đơn hàng (CONFIRMED): Trừ stock_quantity và nhả reserved trong transaction
 * Hoàn toàn Idempotent: gọi nhiều lần không trừ kho nhiều lần
 */
export async function confirmStock(
  orderId: string,
  targetStoreCode: string,
  client: PoolClient,
  adminUsername: string = 'admin',
  options?: ConfirmStockOptions
): Promise<{ success: boolean; alreadyConfirmed: boolean; oversellClamped?: boolean }> {
  // 1. Kiểm tra trạng thái đơn hiện tại
  const orderRes = await client.query(
    `SELECT id, status, store_code, inventory_deducted FROM orders WHERE id = $1 FOR UPDATE;`,
    [orderId]
  );
  if (orderRes.rows.length === 0) {
    throw new Error(`Không tìm thấy đơn hàng: ${orderId}`);
  }

  const order = orderRes.rows[0];
  if (order.inventory_deducted) {
    // Đã trừ kho trước đó -> Không làm gì thêm (Idempotent)
    return { success: true, alreadyConfirmed: true };
  }

  const storeCode = order.store_code || targetStoreCode;
  let hadOversellClamped = false;
  // Tồn kho lấy từ Google Sheet: kế toán tự trừ trong sheet, web chỉ nhả giữ chỗ (không trừ stock_quantity lần hai)
  const sheetMode = isSheetInventoryMode();

  // 2. Lấy các reservation đang active của đơn hàng này
  const resSql = `
    SELECT id, store_code, product_id, quantity
    FROM stock_reservations
    WHERE order_id = $1 AND status = 'active'
    ORDER BY product_id ASC
    FOR UPDATE;
  `;
  const resQuery = await client.query(resSql, [orderId]);

  if (resQuery.rows.length > 0) {
    // Có reservation: Trừ stock_quantity và giảm reserved tương ứng
    for (const r of resQuery.rows) {
      const invOld = await client.query(
        `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
        [r.store_code, r.product_id]
      );
      const oldStock = Number(invOld.rows[0]?.stock_quantity) || 0;
      const oldReserved = Number(invOld.rows[0]?.reserved) || 0;

      const isOversell = !sheetMode && oldStock < r.quantity;
      if (isOversell) {
        if (!options?.allowOversellClamped) {
          throw new InsufficientStockConfirmError(
            `Không thể xuất kho đơn ${orderId}: Sản phẩm ${r.product_id} tại kho ${r.store_code} tồn kho thực tế (${oldStock} chai) không đủ để xuất (${r.quantity} chai).`,
            [{ productId: r.product_id, requested: r.quantity, available: oldStock }]
          );
        }
        hadOversellClamped = true;
      }

      await client.query(
        `UPDATE store_inventory
         SET stock_quantity = CASE WHEN $5::boolean THEN stock_quantity ELSE GREATEST(0, stock_quantity - $1) END,
             reserved = GREATEST(0, reserved - $1),
             updated_at = CURRENT_TIMESTAMP,
             updated_by = $2
         WHERE store_code = $3 AND product_id = $4;`,
        [r.quantity, adminUsername, r.store_code, r.product_id, sheetMode]
      );

      await logInventoryChange(client, {
        storeCode: r.store_code,
        productId: r.product_id,
        oldStock,
        newStock: sheetMode ? oldStock : Math.max(0, oldStock - r.quantity),
        oldReserved,
        newReserved: Math.max(0, oldReserved - r.quantity),
        changeType: isOversell ? 'oversell_clamped' : 'order_confirmed',
        orderId,
        actor: adminUsername,
        note: isOversell
          ? `[CẢNH BÁO THIẾU HÀNG - OVERSELL] Đơn ${orderId}: Tồn kho thực tế (${oldStock}) < Số lượng xuất (${r.quantity}). Đã kẹp về 0 theo lệnh admin.`
          : sheetMode
            ? `Xác nhận đơn ${orderId} - Nhả giữ chỗ ${r.quantity} chai (tồn lấy từ Google Sheet, kế toán trừ trực tiếp trong sheet)`
            : `Xác nhận đơn ${orderId} - Trừ kho ${r.quantity} chai`,
      });

      await client.query(
        `UPDATE stock_reservations
         SET status = 'confirmed',
             released_at = CURRENT_TIMESTAMP
         WHERE id = $1;`,
        [r.id]
      );

      // Đồng bộ tổng tồn kho trên bảng products
      await client.query(
        `UPDATE products
         SET stock_quantity = (
           SELECT COALESCE(SUM(stock_quantity), 0)
           FROM store_inventory
           WHERE product_id = $1
         )
         WHERE id = $1;`,
        [r.product_id]
      );
    }
  } else {
    // Đơn cũ chưa có reservation (backward compatibility): Bóc tách items và trừ thẳng stock_quantity
    const itemsRes = await client.query(
      `SELECT product_id AS "productId", name, quantity, unit FROM order_items WHERE order_id = $1;`,
      [orderId]
    );
    const { expandedBottles } = await expandComboItems(itemsRes.rows, client);

    for (const b of sheetMode ? [] : expandedBottles) {
      await client.query(
        `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock, updated_by)
         VALUES ($1, $2, $3, 100, 0, 0, $4)
         ON CONFLICT (store_code, product_id) DO NOTHING;`,
        [`inv_${storeCode}_${b.productId}`, storeCode, b.productId, adminUsername]
      );

      // Lấy số lượng cũ để ghi log
      const invOldBc = await client.query(
        `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
        [storeCode, b.productId]
      );
      const oldStockBc = Number(invOldBc.rows[0]?.stock_quantity) || 0;
      const oldReservedBc = Number(invOldBc.rows[0]?.reserved) || 0;

      const isOversell = oldStockBc < b.bottleQuantity;
      if (isOversell) {
        if (!options?.allowOversellClamped) {
          throw new InsufficientStockConfirmError(
            `Không thể xuất kho đơn ${orderId}: Sản phẩm ${b.productId} tại kho ${storeCode} tồn kho thực tế (${oldStockBc} chai) không đủ để xuất (${b.bottleQuantity} chai).`,
            [{ productId: b.productId, requested: b.bottleQuantity, available: oldStockBc }]
          );
        }
        hadOversellClamped = true;
      }

      await client.query(
        `UPDATE store_inventory
         SET stock_quantity = GREATEST(0, stock_quantity - $1),
             updated_at = CURRENT_TIMESTAMP,
             updated_by = $2
         WHERE store_code = $3 AND product_id = $4;`,
        [b.bottleQuantity, adminUsername, storeCode, b.productId]
      );

      await logInventoryChange(client, {
        storeCode,
        productId: b.productId,
        oldStock: oldStockBc,
        newStock: Math.max(0, oldStockBc - b.bottleQuantity),
        oldReserved: oldReservedBc,
        newReserved: oldReservedBc,
        changeType: isOversell ? 'oversell_clamped' : 'order_confirmed',
        orderId,
        actor: adminUsername,
        note: isOversell
          ? `[CẢNH BÁO THIẾU HÀNG - OVERSELL] Đơn ${orderId}: Tồn kho thực tế (${oldStockBc}) < Số lượng xuất (${b.bottleQuantity}). Đã kẹp về 0 theo lệnh admin.`
          : `Xác nhận đơn ${orderId} (backward-compat) - Trừ kho ${b.bottleQuantity} chai`,
      });

      await client.query(
        `UPDATE products
         SET stock_quantity = (
           SELECT COALESCE(SUM(stock_quantity), 0)
           FROM store_inventory
           WHERE product_id = $1
         )
         WHERE id = $1;`,
        [b.productId]
      );
    }
  }

  // 3. Đánh dấu đơn đã trừ kho
  await client.query(
    `UPDATE orders
     SET inventory_deducted = true,
         status = CASE WHEN status = 'PENDING' THEN 'CONFIRMED' ELSE status END
     WHERE id = $1;`,
    [orderId]
  );

  return { success: true, alreadyConfirmed: false, oversellClamped: hadOversellClamped };
}

/**
 * Hủy đơn hàng (CANCELLED): Nhả reserved (nếu chưa trừ) hoặc hoàn lại stock_quantity (nếu đã trừ)
 * Hoàn toàn Idempotent: gọi nhiều lần không nhả/hoàn nhiều lần
 */
export async function releaseStock(
  orderId: string,
  client: PoolClient,
  reason: string = 'Hủy đơn hàng',
  adminUsername: string = 'admin',
  updateOrderStatus: boolean = true
): Promise<{ success: boolean; action: 'released_reserved' | 'restored_stock' | 'already_cancelled' }> {
  const orderRes = await client.query(
    `SELECT id, status, store_code, inventory_deducted FROM orders WHERE id = $1 FOR UPDATE;`,
    [orderId]
  );
  if (orderRes.rows.length === 0) {
    throw new Error(`Không tìm thấy đơn hàng: ${orderId}`);
  }

  const order = orderRes.rows[0];
  // Tồn kho lấy từ Google Sheet: web không tự cộng lại tồn vật lý (kế toán chỉnh trong sheet)
  const sheetMode = isSheetInventoryMode();

  // Nếu đã trừ kho thật -> Hoàn lại stock_quantity
  if (order.inventory_deducted) {
    const resSql = `
      SELECT id, store_code, product_id, quantity
      FROM stock_reservations
      WHERE order_id = $1 AND status = 'confirmed'
      ORDER BY product_id ASC
      FOR UPDATE;
    `;
    const resQuery = await client.query(resSql, [orderId]);

    if (resQuery.rows.length > 0) {
      for (const r of resQuery.rows) {
        await client.query(
          `UPDATE store_inventory
           SET stock_quantity = CASE WHEN $5::boolean THEN stock_quantity ELSE stock_quantity + $1 END,
               updated_at = CURRENT_TIMESTAMP,
               updated_by = $2
           WHERE store_code = $3 AND product_id = $4;`,
          [r.quantity, adminUsername, r.store_code, r.product_id, sheetMode]
        );

        await client.query(
          `UPDATE stock_reservations
           SET status = 'released',
               released_at = CURRENT_TIMESTAMP
           WHERE id = $1;`,
          [r.id]
        );

        await client.query(
          `UPDATE products
           SET stock_quantity = (
             SELECT COALESCE(SUM(stock_quantity), 0)
             FROM store_inventory
             WHERE product_id = $1
           )
           WHERE id = $1;`,
          [r.product_id]
        );
      }
    } else {
      // Fallback cho đơn cũ chưa có reservations
      const itemsRes = await client.query(
        `SELECT product_id AS "productId", name, quantity, unit FROM order_items WHERE order_id = $1;`,
        [orderId]
      );
      const { expandedBottles } = await expandComboItems(itemsRes.rows, client);

      for (const b of sheetMode ? [] : expandedBottles) {
        await client.query(
          `UPDATE store_inventory
           SET stock_quantity = stock_quantity + $1,
               updated_at = CURRENT_TIMESTAMP,
               updated_by = $2
           WHERE store_code = $3 AND product_id = $4;`,
          [b.bottleQuantity, adminUsername, order.store_code, b.productId]
        );

        await client.query(
          `UPDATE products
           SET stock_quantity = (
             SELECT COALESCE(SUM(stock_quantity), 0)
             FROM store_inventory
             WHERE product_id = $1
           )
           WHERE id = $1;`,
          [b.productId]
        );
      }
    }

    if (updateOrderStatus) {
      await client.query(
        `UPDATE orders
         SET inventory_deducted = false,
             status = 'CANCELLED'
         WHERE id = $1;`,
        [orderId]
      );

      try {
        const { processPartnerOrderEvent } = await import('@/lib/partner/orderEvent');
        await processPartnerOrderEvent(orderId, 'ORDER_CANCELLED', { client, note: reason, actor: adminUsername });
      } catch (err) {
        console.error('[Inventory] Error syncing partner order event on cancel:', err);
      }
    }

    return { success: true, action: 'restored_stock' };
  }

  // Nếu chưa trừ kho thật -> Nhả reserved đang active
  const activeRes = await client.query(
    `SELECT id, store_code, product_id, quantity
     FROM stock_reservations
     WHERE order_id = $1 AND status = 'active'
     ORDER BY product_id ASC
     FOR UPDATE;`,
    [orderId]
  );

  if (activeRes.rows.length > 0) {
    for (const r of activeRes.rows) {
      // Lấy giá trị cũ để ghi log
      const invOldRel = await client.query(
        `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
        [r.store_code, r.product_id]
      );
      const oldStockRel = Number(invOldRel.rows[0]?.stock_quantity) || 0;
      const oldReservedRel = Number(invOldRel.rows[0]?.reserved) || 0;

      await client.query(
        `UPDATE store_inventory
         SET reserved = GREATEST(0, reserved - $1),
             updated_at = CURRENT_TIMESTAMP
         WHERE store_code = $2 AND product_id = $3;`,
        [r.quantity, r.store_code, r.product_id]
      );

      await logInventoryChange(client, {
        storeCode: r.store_code,
        productId: r.product_id,
        oldStock: oldStockRel,
        newStock: oldStockRel,
        oldReserved: oldReservedRel,
        newReserved: Math.max(0, oldReservedRel - r.quantity),
        changeType: 'order_cancelled',
        orderId,
        actor: adminUsername,
        note: `${reason} - Nhả giữ chỗ ${r.quantity} chai`,
      });

      await client.query(
        `UPDATE stock_reservations
         SET status = 'released',
             released_at = CURRENT_TIMESTAMP
         WHERE id = $1;`,
        [r.id]
      );
    }

    if (updateOrderStatus) {
      await client.query(
        `UPDATE orders
         SET status = 'CANCELLED'
         WHERE id = $1;`,
        [orderId]
      );

      try {
        const { processPartnerOrderEvent } = await import('@/lib/partner/orderEvent');
        await processPartnerOrderEvent(orderId, 'ORDER_CANCELLED', { client, note: reason, actor: adminUsername });
      } catch (err) {
        console.error('[Inventory] Error syncing partner order event on cancel:', err);
      }
    }

    return { success: true, action: 'released_reserved' };
  }

  // Đã ở trạng thái CANCELLED hoặc không còn reservation nào active
  if (updateOrderStatus) {
    await client.query(`UPDATE orders SET status = 'CANCELLED' WHERE id = $1;`, [orderId]);
    try {
      const { processPartnerOrderEvent } = await import('@/lib/partner/orderEvent');
      await processPartnerOrderEvent(orderId, 'ORDER_CANCELLED', { client, note: reason, actor: adminUsername });
    } catch (err) {
      console.error('[Inventory] Error syncing partner order event on cancel:', err);
    }
  }
  return { success: true, action: 'already_cancelled' };
}

/**
 * Quét và nhả toàn bộ các reservation đã hết hạn (quá 24h)
 * Tự động chuyển các đơn PENDING tương ứng sang CANCELLED và ghi chú lý do
 */
export async function cleanupExpiredReservations(externalClient?: PoolClient): Promise<{
  releasedReservationsCount: number;
  cancelledOrdersCount: number;
}> {
  const runWithClient = async (client: PoolClient) => {
    // Lấy khóa tư vấn theo chi nhánh (cùng khóa với giao dịch đặt hàng /api/orders) TRƯỚC khi khóa các dòng:
    // tránh deadlock vì đặt hàng khóa tồn kho trước còn dọn dẹp khóa giữ chỗ trước (thứ tự ngược nhau)
    const storesWithExpired = await client.query(`
      SELECT DISTINCT store_code FROM stock_reservations
      WHERE status = 'active' AND expires_at < CURRENT_TIMESTAMP
      ORDER BY store_code ASC;
    `);
    for (const row of storesWithExpired.rows) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1));', ['tsf-order-store-' + row.store_code]);
    }

    // 1. Tìm các reservation đang active mà đã quá hạn (khóa FOR UPDATE trực tiếp trên từng dòng)
    const expiredRes = await client.query(`
      SELECT id, order_id, store_code, product_id, quantity
      FROM stock_reservations
      WHERE status = 'active'
        AND expires_at < CURRENT_TIMESTAMP
      ORDER BY store_code ASC, product_id ASC, id ASC
      FOR UPDATE;
    `);

    if (expiredRes.rows.length === 0) {
      return { releasedReservationsCount: 0, cancelledOrdersCount: 0 };
    }

    let releasedCount = 0;
    const ordersToCancel = new Set<string>();

    for (const item of expiredRes.rows) {
      // Lấy giá trị cũ để ghi log
      const invOldExp = await client.query(
        `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
        [item.store_code, item.product_id]
      );
      const oldStockExp = Number(invOldExp.rows[0]?.stock_quantity) || 0;
      const oldReservedExp = Number(invOldExp.rows[0]?.reserved) || 0;

      await client.query(
        `UPDATE store_inventory
         SET reserved = GREATEST(0, reserved - $1),
             updated_at = CURRENT_TIMESTAMP
         WHERE store_code = $2 AND product_id = $3;`,
        [item.quantity, item.store_code, item.product_id]
      );

      await logInventoryChange(client, {
        storeCode: item.store_code,
        productId: item.product_id,
        oldStock: oldStockExp,
        newStock: oldStockExp,
        oldReserved: oldReservedExp,
        newReserved: Math.max(0, oldReservedExp - item.quantity),
        changeType: 'reservation_expired',
        orderId: item.order_id,
        actor: 'system',
        note: `Reservation hết hạn - Nhả giữ chỗ ${item.quantity} chai`,
      });

      await client.query(
        `UPDATE stock_reservations
         SET status = 'expired',
             released_at = CURRENT_TIMESTAMP
         WHERE id = $1;`,
        [item.id]
      );
      releasedCount++;
      ordersToCancel.add(item.order_id);
    }

    // Chuyển các đơn PENDING tương ứng sang CANCELLED
    let cancelledOrders = 0;
    for (const orderId of ordersToCancel) {
      const cancelNote = ` [Tự động hủy: Đơn hàng quá hạn giữ chỗ ${INVENTORY_CONFIG.RESERVATION_EXPIRY_HOURS}h]`;
      const cancelRes = await client.query(
        `UPDATE orders
         SET status = 'CANCELLED',
             note = CONCAT(COALESCE(note, ''), $2::TEXT)
         WHERE id = $1 AND status = 'PENDING';`,
        [orderId, cancelNote]
      );
      if (cancelRes.rowCount && cancelRes.rowCount > 0) {
        cancelledOrders++;
      }
    }

    return {
      releasedReservationsCount: releasedCount,
      cancelledOrdersCount: cancelledOrders,
    };
  };

  if (externalClient) {
    return runWithClient(externalClient);
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');
      const result = await runWithClient(client);
      await client.query('COMMIT;');
      return result;
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  }
}

/**
 * Ghi log biến động tồn kho vào bảng inventory_logs
 */
export async function logInventoryChange(
  client: PoolClient,
  params: {
    storeCode: string;
    productId: string;
    oldStock: number;
    newStock: number;
    oldReserved?: number;
    newReserved?: number;
    changeType:
      | 'manual_update'
      | 'order_reserved'
      | 'order_confirmed'
      | 'order_cancelled'
      | 'reservation_expired'
      | 'store_transfer'
      | 'order_transferred_out'
      | 'order_transferred_in'
      | 'return_restocked'
      | 'return_damaged'
      | 'oversell_clamped';
    orderId?: string | null;
    actor: string;
    note?: string | null;
  }
) {
  try {
    const logId = `invlog_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    await client.query(
      `INSERT INTO inventory_logs (
        id, store_code, product_id, old_stock, new_stock, old_reserved, new_reserved, change_type, order_id, actor, note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
      [
        logId,
        params.storeCode,
        params.productId,
        params.oldStock,
        params.newStock,
        params.oldReserved ?? 0,
        params.newReserved ?? 0,
        params.changeType,
        params.orderId || null,
        params.actor,
        params.note || null,
      ]
    );
  } catch (err) {
    console.error('[InventoryLog] Error logging change:', err);
  }
}

/**
 * Xử lý hoàn trả / bom hàng (Customer Return / Delivery Failed)
 * - disposition = 'restocked': hàng nguyên vẹn -> nhập lại kho bán được
 * - disposition = 'damaged_spoilage': hàng hỏng/hết hạn -> ghi nhận hủy hàng, không cộng tồn kho
 */
export async function processOrderReturn(
  orderId: string,
  client: PoolClient,
  params: {
    disposition: 'restocked' | 'damaged_spoilage';
    reason: string;
    actor: string;
  }
): Promise<{ success: boolean; disposition: string; restoredBottles: number }> {
  const orderRes = await client.query(
    `SELECT id, status, store_code, inventory_deducted FROM orders WHERE id = $1 FOR UPDATE;`,
    [orderId]
  );
  if (orderRes.rows.length === 0) {
    throw new Error(`Không tìm thấy đơn hàng: ${orderId}`);
  }
  const order = orderRes.rows[0];
  let restoredBottles = 0;
  // Tồn kho lấy từ Google Sheet: hàng hoàn nhập lại do kế toán cập nhật trong sheet, web không tự cộng tồn
  const sheetMode = isSheetInventoryMode();

  if (order.inventory_deducted) {
    const itemsRes = await client.query(
      `SELECT product_id AS "productId", name, quantity, unit, total_bottles FROM order_items WHERE order_id = $1;`,
      [orderId]
    );
    const { expandedBottles } = await expandComboItems(itemsRes.rows, client);

    for (const b of expandedBottles) {
      restoredBottles += b.bottleQuantity;
      if (params.disposition === 'restocked') {
        const invOld = await client.query(
          `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
          [order.store_code, b.productId]
        );
        const oldStock = Number(invOld.rows[0]?.stock_quantity) || 0;
        await client.query(
          `UPDATE store_inventory
           SET stock_quantity = CASE WHEN $5::boolean THEN stock_quantity ELSE stock_quantity + $1 END,
               updated_at = CURRENT_TIMESTAMP,
               updated_by = $2
           WHERE store_code = $3 AND product_id = $4;`,
          [b.bottleQuantity, params.actor, order.store_code, b.productId, sheetMode]
        );
        await client.query(
          `UPDATE products
           SET stock_quantity = (SELECT COALESCE(SUM(stock_quantity), 0) FROM store_inventory WHERE product_id = $1)
           WHERE id = $1;`,
          [b.productId]
        );
        await logInventoryChange(client, {
          storeCode: order.store_code,
          productId: b.productId,
          oldStock,
          newStock: sheetMode ? oldStock : oldStock + b.bottleQuantity,
          changeType: 'return_restocked',
          orderId,
          actor: params.actor,
          note: `Hoàn hàng nhập lại kho (${params.reason}) - ${b.bottleQuantity} chai`,
        });
      } else {
        const invOld = await client.query(
          `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
          [order.store_code, b.productId]
        );
        const oldStock = Number(invOld.rows[0]?.stock_quantity) || 0;
        await logInventoryChange(client, {
          storeCode: order.store_code,
          productId: b.productId,
          oldStock,
          newStock: oldStock,
          changeType: 'return_damaged',
          orderId,
          actor: params.actor,
          note: `Hàng hoàn hư hỏng/hủy bỏ (${params.reason}) - ${b.bottleQuantity} chai`,
        });
      }
    }
  } else {
    await releaseStock(orderId, client, params.reason, params.actor, false);
  }

  await client.query(
    `UPDATE orders
     SET status = 'CANCELLED',
         inventory_deducted = false,
         return_reason = $1,
         return_disposition = $2,
         return_at = CURRENT_TIMESTAMP
     WHERE id = $3;`,
    [params.reason, params.disposition, orderId]
  );

  return { success: true, disposition: params.disposition, restoredBottles };
}

/**
 * Xác nhận đối soát tiền thu COD
 */
export async function reconcileCodPayment(
  orderId: string,
  client: PoolClient,
  params: {
    collectedAmount: number;
    actor: string;
    note?: string;
  }
): Promise<{ success: boolean; collectedAmount: number }> {
  const orderRes = await client.query(
    `SELECT id, status, total, payment_method, cod_reconciled FROM orders WHERE id = $1 FOR UPDATE;`,
    [orderId]
  );
  if (orderRes.rows.length === 0) {
    throw new Error(`Không tìm thấy đơn hàng: ${orderId}`);
  }

  await client.query(
    `UPDATE orders
     SET cod_reconciled = true,
         cod_collected_amount = $1,
         cod_reconciled_at = CURRENT_TIMESTAMP,
         cod_reconciled_by = $2,
         note = CASE WHEN $3::text IS NOT NULL THEN COALESCE(note, '') || ' [Đối soát COD: ' || $3 || ']' ELSE note END
     WHERE id = $4;`,
    [params.collectedAmount, params.actor, params.note || null, orderId]
  );

  return { success: true, collectedAmount: params.collectedAmount };
}


