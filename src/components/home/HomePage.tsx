import { Banner, Product, Combo } from '@/types';
import { categories as catalogCategories } from '@/data/products';
import { MEMBERSHIP_CONFIG } from '@/config/membership';
import {
  HERO_MIN_SLIDES,
  HERO_PLACEHOLDER_SLIDES,
  RECOMMENDED_FOR_YOU_IDS,
} from '@/data/homepage-placeholders';
import AmazonHeroCarousel from '@/components/home/AmazonHeroCarousel';
import AmazonCategoryCards, { HomeCategoryGroup } from '@/components/home/AmazonCategoryCards';
import AmazonProductRow from '@/components/home/AmazonProductRow';
import AmazonDealsRow from '@/components/home/AmazonDealsRow';
import AmazonRecentlyViewed from '@/components/home/AmazonRecentlyViewed';
import ComboShowcase from '@/components/home/ComboShowcase';
import WarehouseSection from '@/components/home/WarehouseSection';
import SubscribeSaveSection from '@/components/home/SubscribeSaveSection';
import { PlaceholderBadge } from '@/components/product/ProductPlaceholderBlocks';
import { SHOW_PLACEHOLDER_BLOCKS } from '@/data/product-detail-placeholders';
import { MISSING_PRODUCT_IMAGE } from '@/lib/product-detail';

interface HomePageProps {
  heroBanners: Banner[];
  liveProducts: Product[];
  liveCombos: Combo[];
  /** Tên danh mục do admin cấu hình (ưu tiên hơn tên mặc định trong mã nguồn) */
  liveCategories?: Array<{ id: string; name: string; nameEn?: string }>;
}

// Thứ tự danh mục giống CategorySidebar của trang chủ cũ
const CATEGORY_ORDER = ['sua-hat', 'nuoc-giai-khat', 'tra-sua'];

function normalizeCategoryId(id: string | undefined): string {
  return (id || '').replace(/^cat-/, '');
}

/** Banner hero thật trước. Khi admin đã bật ít nhất 1 banner thì hiển thị đúng những banner đó; chỉ bù slide mẫu khi chưa cấu hình gì */
function buildHeroSlides(heroBanners: Banner[]): Banner[] {
  const real = heroBanners.filter((b) => Boolean(b.image));
  if (real.some((b) => b.source === 'db')) return real;
  if (real.length >= HERO_MIN_SLIDES) return real;
  const used = new Set(real.map((b) => b.image));
  const fill = HERO_PLACEHOLDER_SLIDES.filter((b) => !used.has(b.image));
  return [...real, ...fill].slice(0, Math.max(HERO_MIN_SLIDES, real.length));
}

function buildCategoryGroups(
  products: Product[],
  liveCategories: Array<{ id: string; name: string; nameEn?: string }> = []
): HomeCategoryGroup[] {
  const ids = Array.from(new Set(products.map((p) => normalizeCategoryId(p.categoryId)).filter(Boolean)));
  ids.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return ids.map((id) => {
    const live = liveCategories.find((c) => normalizeCategoryId(c.id) === id);
    const meta = catalogCategories.find((c) => c.id === id || c.slug === id);
    const sample = products.find((p) => normalizeCategoryId(p.categoryId) === id);
    return {
      id,
      name: live?.name || meta?.name || sample?.category_name || id,
      nameEn: live?.nameEn || meta?.nameEn,
      products: products.filter((p) => normalizeCategoryId(p.categoryId) === id),
    };
  });
}

/** Bán chạy → mới → còn lại, giữ thứ tự gốc trong từng nhóm */
function sortBestSellersFirst(products: Product[]): Product[] {
  const rank = (p: Product) => (p.isBestSeller ? 0 : p.isNew ? 1 : 2);
  return products
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
    .map(({ p }) => p);
}

/**
 * TRANG CHỦ MỚI — bố cục trang chủ Amazon, bản sắc Thái Sơn Foods.
 * Hiển thị khi HOMEPAGE_CONFIG.USE_AMAZON_HOMEPAGE = true (xem ROLLBACK.md).
 *
 *  1. Hero carousel lớn (nút trái/phải, tự chuyển)
 *  2. Lưới thẻ danh mục chồng lên chân hero (8 thẻ, 2 hàng)
 *  3. Carousel "Sản phẩm Thái Sơn" (#san-pham) — toàn bộ sản phẩm, bán chạy trước
 *  4. Deal trong ngày (combo thật + đồng hồ placeholder)
 *  5. Gợi ý cho bạn (placeholder danh sách)
 *  6. Carousel theo danh mục (#danh-muc-*)
 *  7. Combo tiết kiệm (#combo) — tái dùng ComboShowcase (thêm giỏ, combo tuỳ chọn)
 *  8. Đã xem gần đây (localStorage thật)
 *  9. Khối thương hiệu "Vì sao Thái Sơn Foods được tin chọn?" (#kho-si) — tái dùng WarehouseSection
 * 10. Giao định kỳ (theo cờ MEMBERSHIP_CONFIG, như trang cũ)
 * "Về đầu trang" + footer nhiều cột nằm trong FooterAmazon.
 */
export default function HomePage({ heroBanners, liveProducts, liveCombos, liveCategories = [] }: HomePageProps) {
  const products = liveProducts.filter((p) => p.isActive !== false);
  // Combo thiếu ảnh → ảnh dự phòng (tránh src rỗng trong ComboShowcase / hiệu ứng bay vào giỏ)
  const combos = liveCombos
    .filter((c) => c.isActive !== false)
    .map((c) => ((c.image || '').trim() ? c : { ...c, image: MISSING_PRODUCT_IMAGE }));
  const heroSlides = buildHeroSlides(heroBanners);
  const categoryGroups = buildCategoryGroups(products, liveCategories);
  const recommended = RECOMMENDED_FOR_YOU_IDS
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));

  return (
    <div data-homepage="amazon" className="bg-ivory-dark pb-8">
      <h1 className="sr-only">Thái Sơn Foods — Thức uống tự nhiên từ nguyên liệu chọn lọc</h1>

      <div className="max-w-[1500px] mx-auto px-3 sm:px-4 lg:px-5 pt-3 lg:pt-4 space-y-4 lg:space-y-5">
        {/* 1. HERO — cùng bề rộng với lưới thẻ, bo góc, sát phía trên */}
        <AmazonHeroCarousel banners={heroSlides} />

        {/* 2. LƯỚI THẺ DANH MỤC — nằm ngay dưới hero, không che banner */}
        <AmazonCategoryCards categories={categoryGroups} combos={combos} />

        {/* 3. SẢN PHẨM THÁI SƠN (giữ anchor #san-pham cho Header/Footer/tìm kiếm/breadcrumb) */}
        <AmazonProductRow
          id="san-pham"
          titleVi="Sản phẩm Thái Sơn"
          titleEn="Thai Son Products"
          subtitleVi="Sản phẩm bán chạy và mới được xếp trước"
          subtitleEn="Best sellers and new arrivals first"
          products={sortBestSellersFirst(products)}
        />

        {/* 4. DEAL TRONG NGÀY */}
        <AmazonDealsRow combos={combos} />

        {/* 5. GỢI Ý CHO BẠN (PLACEHOLDER — chờ thuật toán gợi ý) */}
        {SHOW_PLACEHOLDER_BLOCKS && (
          <AmazonProductRow
            titleVi="Gợi ý cho bạn"
            titleEn="Recommended for you"
            products={recommended}
            action={<PlaceholderBadge />}
          />
        )}

        {/* 6. MUA THEO DANH MỤC */}
        {categoryGroups.map((g) => (
          <AmazonProductRow
            key={g.id}
            id={`danh-muc-${g.id}`}
            titleVi={g.name}
            titleEn={g.nameEn || g.name}
            products={g.products}
          />
        ))}

        {/* 7. COMBO TIẾT KIỆM (#combo) */}
        <div className="bg-white rounded-2xl border border-border shadow-xs [&_#combo]:py-7 [&_#combo]:scroll-mt-[130px]">
          <ComboShowcase combos={combos} />
        </div>

        {/* 8. ĐÃ XEM GẦN ĐÂY */}
        <AmazonRecentlyViewed products={products} />
      </div>

      {/* 9. GIAO ĐỊNH KỲ — Tạm tắt khi chưa chốt với doanh nghiệp (giữ nguyên cờ như trang cũ) */}
      {MEMBERSHIP_CONFIG.ENABLE_SUBSCRIBE_SAVE && <SubscribeSaveSection />}

      {/* 10. KHỐI THƯƠNG HIỆU / KHO-SỈ (#kho-si) */}
      <div className="[&_#kho-si]:scroll-mt-[130px]">
        <WarehouseSection />
      </div>
    </div>
  );
}
