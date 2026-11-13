import { Product, ProductVariant } from '@/types';
import { getProductDetailContent } from '@/data/product-detail-content';

/**
 * Logic tính toán thuần (không phụ thuộc React) cho trang chi tiết sản phẩm.
 * Giá luôn lấy từ bảng giá của từng quy cách (variant.price) — không suy ra theo công thức.
 */

export function sortVariants(variants?: ProductVariant[]): ProductVariant[] {
  return [...(variants || [])].sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
}

/** Tên quy cách hiển thị: "Lốc 7 chai", "Thùng 12 chai" */
export function getVariantLabel(variant: ProductVariant, language: string = 'vi'): string {
  const qty = variant.quantity || 1;
  const unit = (variant.unit || '').toLowerCase();
  if (language === 'en') {
    return unit === 'thùng' ? `Carton of ${qty}` : `Pack of ${qty}`;
  }
  const unitLabel = unit === 'thùng' ? 'Thùng' : unit === 'lốc' ? 'Lốc' : '';
  return unitLabel ? `${unitLabel} ${variant.name}` : variant.name;
}

/** Dung tích một chai, ưu tiên quy cách ("7 x 270ml") vì một số sản phẩm có volume chung chưa đồng bộ */
export function getBottleVolume(product: Product, variant?: ProductVariant): string {
  const fromVariant = variant?.volume?.includes('x') ? variant.volume.split('x').pop()?.trim() : undefined;
  return fromVariant || product.volume || '';
}

export function getUnitPrice(variant: ProductVariant): number {
  return Math.round(variant.price / Math.max(1, variant.quantity || 1));
}

/**
 * Giá gốc của quy cách: CHỈ khi sản phẩm có originalPrice (giá gốc / chai) hợp lệ.
 * Không tự tạo phần trăm giảm giá.
 */
export function getVariantOriginalPrice(product: Product, variant: ProductVariant): number | null {
  if (!product.originalPrice || product.originalPrice <= product.price) return null;
  const original = product.originalPrice * Math.max(1, variant.quantity || 1);
  return original > variant.price ? original : null;
}

export function getShortProductName(product: Product, language: string = 'vi'): string {
  if (language === 'en' && product.nameEn) {
    return product.nameEn.split(',')[0].trim();
  }
  const mapped = getProductDetailContent(product).shortName;
  if (mapped) return mapped;
  const firstPart = product.name.split(/\s[-–]\s|[,.]/)[0].trim();
  return firstPart.length > 42 ? `${firstPart.slice(0, 40)}…` : firstPart;
}

/** Sản phẩm cùng danh mục (để chọn hương vị khác) — giữ thứ tự danh mục gốc */
export function getSiblingProducts(product: Product, allProducts: Product[]): Product[] {
  const catId = (product.categoryId || '').replace(/^cat-/, '');
  return allProducts.filter((p) => p.isActive && p.categoryId === catId);
}

/** Sản phẩm tương tự: cùng danh mục trước, sau đó các danh mục khác. Loại trừ sản phẩm hiện tại */
export function getSimilarProducts(product: Product, allProducts: Product[], limit = 12): Product[] {
  const catId = (product.categoryId || '').replace(/^cat-/, '');
  const others = allProducts.filter(
    (p) => p.isActive && p.id !== product.id && p.slug !== product.slug
  );
  const sameCategory = others.filter((p) => p.categoryId === catId);
  const rest = others.filter((p) => p.categoryId !== catId);
  return [...sameCategory, ...rest].slice(0, limit);
}

/** Ảnh đại diện có dự phòng (logo TSF) khi sản phẩm chưa có ảnh */
export const MISSING_PRODUCT_IMAGE = '/images/logo-clean-1000.png';
export function getProductImage(product: Pick<Product, 'thumbnail'>): string {
  const url = (product.thumbnail || '').trim();
  return url || MISSING_PRODUCT_IMAGE;
}

export function isSameProduct(a: Pick<Product, 'id' | 'slug'>, b: Pick<Product, 'id' | 'slug'>): boolean {
  return a.id === b.id || a.slug === b.slug;
}

/** Một dòng bảng products (CSDL) kèm quy cách và ảnh — dữ liệu đầu vào của buildLiveCatalog */
export interface ProductCatalogRow {
  id: string;
  slug: string | null;
  sku: string | null;
  name: string | null;
  price: number | string | null;
  unit: string | null;
  thumbnail: string | null;
  category_id: string | null;
  short_description: string | null;
  description: string | null;
  is_featured: boolean | null;
  is_best_seller: boolean | null;
  is_new: boolean | null;
  is_active: boolean | null;
  volume?: string | null;
  energy_kcal?: number | string | null;
  variants?: { id: string; name: string; quantity: number | string; price: number | string; unit: string | null }[] | null;
  images?: { url: string; isThumbnail?: boolean }[] | null;
}

/**
 * Danh mục sản phẩm "sống" cho các khối gợi ý: bảng products (CSDL) là nguồn chính, src/data/products.ts bổ sung
 * ảnh gallery, tên tiếng Anh, banner... Cùng quy tắc ghép với /api/products:
 *  - Khớp theo id, slug hoặc sku; sản phẩm khớp giữ mã + slug + thứ tự của danh mục tĩnh (liên kết, thống kê cũ không đổi).
 *  - Sản phẩm mới chỉ có trong CSDL được thêm vào sau, theo thứ tự trong CSDL.
 *  - Sản phẩm không còn trong CSDL (đã xoá) bị bỏ; tạm ẩn giữ lại với isActive=false (nơi hiển thị tự lọc).
 *  - CSDL trống → trả nguyên danh mục tĩnh. Không sửa mảng gốc.
 */
export function buildLiveCatalog(staticProducts: Product[], rows: ProductCatalogRow[]): Product[] {
  if (rows.length === 0) return staticProducts;
  const toVariants = (row: ProductCatalogRow) =>
    Array.isArray(row.variants) && row.variants.length > 0
      ? row.variants
          .map((v) => ({ id: v.id, name: v.name, quantity: Number(v.quantity) || 1, price: Number(v.price) || 0, unit: v.unit || 'lốc' }))
          .sort((a, b) => a.quantity - b.quantity)
      : null;
  const thumbOf = (row: ProductCatalogRow) => {
    const imgs = Array.isArray(row.images) ? row.images : [];
    return row.thumbnail || imgs.find((i) => i.isThumbnail)?.url || imgs[0]?.url || '';
  };
  const flag = (v: boolean | null, fallback: boolean) => (v !== null && v !== undefined ? Boolean(v) : fallback);
  const categoryOf = (row: ProductCatalogRow) => (row.category_id ? row.category_id.replace(/^cat-/, '') : '');

  const used = new Set<ProductCatalogRow>();
  const merged: Product[] = [];
  for (const base of staticProducts) {
    const row = rows.find((r) => !used.has(r) && (r.id === base.id || (r.slug && r.slug === base.slug) || (r.sku && r.sku === base.sku)));
    if (!row) continue;
    used.add(row);
    merged.push({
      ...base,
      name: row.name || base.name,
      sku: row.sku || base.sku,
      price: Number(row.price) || base.price,
      unit: row.unit || base.unit,
      shortDescription: row.short_description || base.shortDescription,
      description: row.description || base.description,
      volume: row.volume || base.volume,
      energyKcal: row.energy_kcal !== null && row.energy_kcal !== undefined ? Number(row.energy_kcal) : base.energyKcal ?? null,
      thumbnail: thumbOf(row) || base.thumbnail,
      categoryId: categoryOf(row) || base.categoryId,
      isFeatured: flag(row.is_featured, base.isFeatured),
      isNew: flag(row.is_new, base.isNew),
      isBestSeller: flag(row.is_best_seller, base.isBestSeller),
      isActive: flag(row.is_active, base.isActive),
      variants: toVariants(row) || base.variants,
    });
  }
  for (const row of rows) {
    if (used.has(row) || !row.slug) continue;
    const thumbnail = thumbOf(row) || MISSING_PRODUCT_IMAGE;
    merged.push({
      id: row.id,
      slug: row.slug,
      sku: row.sku || row.id,
      name: row.name || row.slug,
      price: Number(row.price) || 0,
      unit: row.unit || 'chai',
      categoryId: categoryOf(row),
      thumbnail,
      images: [{ id: 'img-1', url: thumbnail, alt: row.name || '', sortOrder: 1 }],
      shortDescription: row.short_description || '',
      description: row.description || '',
      volume: row.volume || undefined,
      energyKcal: row.energy_kcal !== null && row.energy_kcal !== undefined ? Number(row.energy_kcal) : null,
      isFeatured: Boolean(row.is_featured),
      isNew: Boolean(row.is_new),
      isBestSeller: Boolean(row.is_best_seller),
      isActive: row.is_active !== false,
      variants: toVariants(row) || [],
    });
  }
  return merged;
}
