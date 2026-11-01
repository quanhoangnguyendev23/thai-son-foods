import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { products, getProductBySlug, categories, getProductsByCategory } from '@/data/products';
import { query } from '@/lib/db';
import { Product } from '@/types';
import ProductGallery from '@/components/product/ProductGallery';
import ProductInfo, { ProductBreadcrumb } from '@/components/product/ProductInfo';
import ProductDescription from '@/components/product/ProductDescription';
import ProductFeatureShowcase from '@/components/product/ProductFeatureShowcase';
import ProductCombosSidebar from '@/components/product/ProductCombosSidebar';
import ProductSection from '@/components/home/ProductSection';
import SubscribeSaveSection from '@/components/home/SubscribeSaveSection';
import { MEMBERSHIP_CONFIG } from '@/config/membership';
import { PRODUCT_DETAIL_CONFIG } from '@/config/product-detail';
import { ENABLE_COMBOS } from '@/config/features';
import ProductReviewsSection from '@/components/product/ProductReviewsSection';
import ProductSponsoredBanner from '@/components/product/ProductSponsoredBanner';
import ProductSidebarSponsoredCard from '@/components/product/ProductSidebarSponsoredCard';
import FrequentlyBoughtTogether from '@/components/product/FrequentlyBoughtTogether';
import ProductSponsoredMiniCard from '@/components/product/ProductSponsoredMiniCard';
// Giao diện mới (bật bằng PRODUCT_DETAIL_CONFIG.ENABLE_NEW_LAYOUT)
import ProductMainSection, { AmazonProductBreadcrumb } from '@/components/product/ProductMainSection';
import ProductBundleSuggestions from '@/components/product/ProductBundleSuggestions';
import ProductDetailTabs from '@/components/product/ProductDetailTabs';
import ProductCarousel from '@/components/product/ProductCarousel';
import RecentlyViewedProducts from '@/components/product/RecentlyViewedProducts';
import ProductCompareTable from '@/components/product/ProductCompareTable';
import { PlaceholderBadge } from '@/components/product/ProductPlaceholderBlocks';
import { getSiblingProducts, getSimilarProducts } from '@/lib/product-detail';
import { getProductDetailContent } from '@/data/product-detail-content';
import { getAlsoViewedIds, getBestSellerRanking, getBoughtTogetherIds, getTotalSold } from '@/lib/product-stats';
import ProductComboStrip from '@/components/product/ProductComboStrip';
import BrandCardsSection from '@/components/product/BrandCardsSection';
import { brands } from '@/data/brands';
import { ReviewProductAd, ReviewComboAd } from '@/components/product/ProductReviewAds';
import { combos as staticCombos } from '@/data/combos';
import { Combo } from '@/types';
import { ProductViewTracker } from '@/components/product/ProductRealBlocks';
import { getProductReviewSummary, getProductReviews } from '@/lib/reviews/repository';

export const dynamic = 'force-dynamic';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateStaticParams() {
  return products.map((product) => ({
    slug: product.slug,
  }));
}

/**
 * Lấy dữ liệu sản phẩm mới nhất từ cơ sở dữ liệu PostgreSQL (nếu có cập nhật từ Admin)
 * kết hợp với các tài nguyên mở rộng từ products.ts (hình ảnh gallery, highlights, video)
 */
async function getLiveProduct(slug: string): Promise<Product | undefined> {
  const baseProduct = getProductBySlug(slug);

  try {
    const dbRes = await query(
      `SELECT 
         p.*,
         c.name AS category_name,
         c.slug AS category_slug,
         COALESCE((
           SELECT json_agg(
             json_build_object('id', pv.id, 'name', pv.name, 'quantity', pv.quantity, 'price', pv.price, 'unit', pv.unit)
             ORDER BY pv.quantity ASC
           )
           FROM product_variants pv WHERE pv.product_id = p.id
         ), '[]') AS variants,
         COALESCE((
           SELECT json_agg(
             json_build_object('id', pi.id, 'url', pi.url, 'alt', pi.alt, 'sortOrder', pi.sort_order, 'isThumbnail', (pi.image_type = 'thumbnail'))
             ORDER BY pi.sort_order ASC
           )
           FROM product_images pi WHERE pi.product_id = p.id AND pi.is_active = true
         ), '[]') AS images
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = $1 OR p.id = $1 OR p.sku = $1 OR p.slug LIKE $1 || '%' OR $1 LIKE p.slug || '%'
       LIMIT 1;`,
      [slug]
    );

    if (dbRes.rows.length > 0) {
      const dbProd = dbRes.rows[0];
      const fallback = baseProduct || products.find((p) => p.sku === dbProd.sku || p.id === dbProd.id) || {
        id: dbProd.id,
        name: dbProd.name,
        slug: dbProd.slug,
        sku: dbProd.sku,
        price: Number(dbProd.price) || 0,
        unit: dbProd.unit || 'lốc',
        categoryId: dbProd.category_id || 'sua-hat',
        thumbnail: dbProd.thumbnail || '/images/products/sua-bap-nep.png',
        images: [{ id: 'img-1', url: dbProd.thumbnail, alt: dbProd.name, sortOrder: 1 }],
        shortDescription: dbProd.short_description || '',
        description: dbProd.description || '',
        isActive: dbProd.is_active ?? true,
        isFeatured: dbProd.is_featured ?? false,
        isBestSeller: dbProd.is_best_seller ?? false,
        isNew: dbProd.is_new ?? false,
        variants: [],
      };

      const activeImages = Array.isArray(dbProd.images) && dbProd.images.length > 0 ? dbProd.images : [];
      const thumbFromImages = activeImages.find((img: any) => img.isThumbnail)?.url || activeImages[0]?.url;
      // Ảnh do admin quản lý trong CSDL là nguồn chính (ảnh đại diện, thứ tự, thêm/xoá); products.ts chỉ là dự phòng
      const finalThumbnail = dbProd.thumbnail || thumbFromImages || fallback.thumbnail;

      return {
        ...fallback,
        name: dbProd.name || fallback.name,
        sku: dbProd.sku || fallback.sku,
        price: Number(dbProd.price) || fallback.price,
        unit: dbProd.unit || fallback.unit,
        shortDescription: dbProd.short_description || fallback.shortDescription,
        description: dbProd.description || fallback.description,
        // Dung tích chai do admin chỉnh (products.volume); trống thì dùng giá trị trong products.ts
        volume: dbProd.volume || (fallback as { volume?: string }).volume,
        energyKcal: dbProd.energy_kcal !== null && dbProd.energy_kcal !== undefined ? Number(dbProd.energy_kcal) : (fallback as { energyKcal?: number }).energyKcal ?? null,
        thumbnail: finalThumbnail,
        images: activeImages.length > 0
          ? activeImages.map((img: any) => ({
            id: img.id,
            url: img.url,
            alt: img.alt || dbProd.name,
            sortOrder: Number(img.sortOrder) || 1,
          }))
          : (fallback.images && fallback.images.length > 0 ? fallback.images : [{ id: 'img-1', url: finalThumbnail, alt: dbProd.name, sortOrder: 1 }]),
        categoryId: (dbProd.category_id ? dbProd.category_id.replace(/^cat-/, '') : fallback.categoryId),
        isFeatured: dbProd.is_featured !== null ? Boolean(dbProd.is_featured) : fallback.isFeatured,
        isNew: dbProd.is_new !== null ? Boolean(dbProd.is_new) : fallback.isNew,
        isBestSeller: dbProd.is_best_seller !== null ? Boolean(dbProd.is_best_seller) : fallback.isBestSeller,
        isActive: dbProd.is_active !== null ? Boolean(dbProd.is_active) : fallback.isActive,
        variants: (Array.isArray(dbProd.variants) && dbProd.variants.length > 0)
          ? dbProd.variants.map((v: any) => ({
            id: v.id || `var-${v.quantity}`,
            name: v.name || `${v.quantity} chai`,
            quantity: Number(v.quantity) || 1,
            price: Number(v.price) || 0,
            unit: v.unit || 'lốc',
            volume: v.volume || `${v.quantity} x ${dbProd.volume || '330ml'}`
          }))
            .sort((a: any, b: any) => a.quantity - b.quantity)
          : [...(fallback.variants || [])].sort((a: any, b: any) => a.quantity - b.quantity),
      };
    }
  } catch (err) {
    console.error('Error fetching live product from DB:', err);
  }

  return baseProduct;
}

type StripCombo = Combo & { isBestSeller?: boolean };

/** Combo đang bán (CSDL do admin quản lý; CSDL trống thì dùng dữ liệu mẫu trong combos.ts) */
async function getActiveCombos(): Promise<StripCombo[]> {
  try {
    const res = await query(
      `SELECT c.*,
         COALESCE((SELECT json_agg(json_build_object('product_id', ci.product_id, 'quantity', ci.quantity))
                   FROM combo_items ci WHERE ci.combo_id = c.id), '[]') AS items
       FROM combos c WHERE c.is_active = true ORDER BY c.created_at ASC`
    );
    if (res.rows.length > 0) {
      return res.rows.map((row: any) => {
        const base = staticCombos.find((c) => c.id === row.id || c.slug === row.slug);
        return {
          ...(base || {}),
          id: row.id,
          slug: row.slug || base?.slug || row.id,
          name: row.name || base?.name || '',
          description: row.description || base?.description || '',
          image: row.image || base?.image || '/images/combos/combo-1.jpg',
          originalPrice: Number(row.original_price) || base?.originalPrice || 0,
          salePrice: Number(row.sale_price) || base?.salePrice || 0,
          totalItems: Number(row.total_items) || base?.totalItems || 0,
          discount: Number(row.discount) || 0,
          isActive: true,
          isBestSeller: Boolean(row.is_best_seller),
          products: Array.isArray(row.items) && row.items.length > 0
            ? row.items.map((it: any) => ({ productId: String(it.product_id), quantity: Number(it.quantity) || 1 }))
            : base?.products || [],
        } as StripCombo;
      });
    }
  } catch (err) {
    console.error('Không thể lấy combo cho dải gợi ý:', err);
  }
  return staticCombos.filter((c) => c.isActive);
}

/** Ưu tiên combo có sản phẩm đang xem, rồi combo giảm nhiều nhất, rồi combo nhiều sản phẩm đang xem hơn */
function pickComboForProduct(list: StripCombo[], productId: string): StripCombo | undefined {
  const qtyOf = (c: StripCombo) => c.products.find((it) => it.productId === productId)?.quantity || 0;
  return [...list]
    .filter((c) => c.salePrice > 0 && c.slug)
    .sort(
      (a, b) =>
        Number(qtyOf(b) > 0) - Number(qtyOf(a) > 0) ||
        (b.discount || 0) - (a.discount || 0) ||
        qtyOf(b) - qtyOf(a)
    )[0];
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getLiveProduct(slug);

  if (!product || product.isActive === false) {
    return { title: 'Sản phẩm không tìm thấy' };
  }

  return {
    title: product.name,
    description: product.shortDescription,
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      images: [{ url: product.thumbnail }],
      type: 'website',
    },
  };
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { slug } = await params;
  // Bật giao diện mới bằng cờ cấu hình, hoặc xem trước bằng ?giao-dien=moi (không ảnh hưởng khách đang xem bản cũ)
  const pageQuery = (await searchParams) || {};
  const useNewLayout = PRODUCT_DETAIL_CONFIG.ENABLE_NEW_LAYOUT || pageQuery['giao-dien'] === 'moi';
  const product = await getLiveProduct(slug);

  if (!product || product.isActive === false) {
    notFound();
  }

  const cleanCatId = (product.categoryId || '').replace(/^cat-/, '');
  const category = categories.find(
    (c) => c.id === cleanCatId || c.id === product.categoryId || c.slug === cleanCatId
  );

  // Nạp danh sách sản phẩm cùng danh mục để hiển thị khu vực gợi ý dưới chân ảnh
  let categoryProducts = getProductsByCategory(cleanCatId);
  if (!categoryProducts || categoryProducts.length === 0) {
    categoryProducts = getProductsByCategory(product.categoryId);
  }
  // Đảm bảo luôn có danh sách gợi ý cho người dùng lựa chọn vị
  if (!categoryProducts || categoryProducts.length <= 1) {
    categoryProducts = products.filter((p) => p.isActive).slice(0, 5);
  }

  // Giao diện mới: sản phẩm cùng danh mục (chọn hương vị) và sản phẩm tương tự (carousel gợi ý)
  const siblingProducts = getSiblingProducts(product, products);
  const similarProducts = getSimilarProducts(product, products, 12);
  // "Khách hàng cũng xem": dữ liệu THẬT từ lượt xem cùng phiên (bảng product_views); chưa đủ dữ liệu thì ẩn khối
  let alsoViewedIds: string[] = [];
  try {
    alsoViewedIds = await getAlsoViewedIds(product.id, 12);
  } catch (err) {
    console.error('Không thể lấy gợi ý "khách cũng xem":', err);
  }
  const alsoViewedProducts = alsoViewedIds
    .map((id) => products.find((p) => p.id === id && p.isActive !== false))
    .filter((p): p is Product => Boolean(p) && p!.id !== product.id);

  // "Bán chạy nhất" và "Khách mua sản phẩm này cũng mua": dữ liệu THẬT từ đơn hàng; thiếu dữ liệu thì ẩn khối
  const activeCatalog = products.filter((p) => p.isActive !== false);
  const findActive = (id: string) => activeCatalog.find((p) => p.id === id && p.id !== product.id);
  let bestSellerProducts: Product[] = [];
  let bestSellerRanks: number[] = [];
  let boughtTogetherProducts: Product[] = [];
  try {
    const [ranking, togetherIds] = await Promise.all([
      getBestSellerRanking(activeCatalog),
      getBoughtTogetherIds(product.id, activeCatalog, 12),
    ]);
    // Giữ đúng thứ hạng thật (sản phẩm đang xem bị ẩn khỏi hàng nhưng vẫn giữ vị trí của nó)
    const ranked = ranking
      .map((r, i) => ({ product: findActive(r.productId), rank: i + 1 }))
      .filter((r): r is { product: Product; rank: number } => Boolean(r.product))
      .slice(0, 10);
    bestSellerProducts = ranked.map((r) => r.product);
    bestSellerRanks = ranked.map((r) => r.rank);
    boughtTogetherProducts = togetherIds.map(findActive).filter((p): p is Product => Boolean(p));
  } catch (err) {
    console.error('Không thể lấy gợi ý bán chạy / mua cùng:', err);
  }

  // Dải combo phía trên breadcrumb: combo chứa sản phẩm đang xem, kèm đánh giá và số đã bán thật
  let stripCombo: StripCombo | undefined;
  let stripRating: { averageRating: number; totalReviews: number } | null = null;
  let stripSold = 0;
  let reviewCombo: StripCombo | undefined;
  if (ENABLE_COMBOS && useNewLayout) {
    const activeCombos = await getActiveCombos();
    stripCombo = pickComboForProduct(activeCombos, product.id);
    // Combo trong mục Đánh giá: ngẫu nhiên trong các combo có sản phẩm này (khác combo ở dải trên); không có thì ngẫu nhiên
    const otherCombos = activeCombos.filter((c) => c.salePrice > 0 && c.slug && c.id !== stripCombo?.id);
    const withProduct = otherCombos.filter((c) => c.products.some((it) => it.productId === product.id));
    const comboPool = withProduct.length > 0 ? withProduct : otherCombos;
    reviewCombo = comboPool[Math.floor(Math.random() * comboPool.length)];
    if (stripCombo) {
      const picked = stripCombo;
      const [summary, sold] = await Promise.all([
        getProductReviewSummary(`combo:${picked.slug}`).catch(() => null),
        getTotalSold(picked.id, 'combo', picked.slug).catch(() => 0),
      ]);
      stripRating = summary ? { averageRating: summary.averageRating, totalReviews: summary.totalReviews } : null;
      stripSold = sold;
    }
  }

  // Sản phẩm lẻ trong mục Đánh giá: một thương hiệu ngẫu nhiên → một sản phẩm ngẫu nhiên của thương hiệu đó (khác sản phẩm đang xem)
  const brandPool = brands
    .map((b) => ({ brand: b, items: b.productIds.map((id) => findActive(id)).filter((p): p is Product => Boolean(p)) }))
    .filter((x) => x.items.length > 0);
  const pickedBrand = brandPool[Math.floor(Math.random() * brandPool.length)];
  const reviewAdProduct = pickedBrand?.items[Math.floor(Math.random() * pickedBrand.items.length)];
  const reviewAdRating = reviewAdProduct
    ? await getProductReviewSummary(reviewAdProduct.slug || reviewAdProduct.id).catch(() => null)
    : null;
  // Logo cho dải combo: thương hiệu chiếm nhiều chai nhất trong combo
  const reviewComboBrand = reviewCombo
    ? [...brands].sort(
        (a, b) =>
          reviewCombo!.products.filter((it) => b.productIds.includes(it.productId)).reduce((s, it) => s + it.quantity, 0) -
          reviewCombo!.products.filter((it) => a.productIds.includes(it.productId)).reduce((s, it) => s + it.quantity, 0)
      )[0]
    : undefined;

  // "Khám phá dòng khác": mỗi danh mục còn lại một hàng
  const otherCategoryRows = categories
    .filter((c) => c.id !== cleanCatId)
    .map((c) => ({ category: c, items: activeCatalog.filter((p) => p.categoryId === c.id) }))
    .filter((row) => row.items.length > 0);

  const reviewSummary = await getProductReviewSummary(product.slug || product.id);
  let latestReviews: any[] = [];
  if (reviewSummary.totalReviews > 0) {
    const revResult = await getProductReviews(product.slug || product.id, {
      sort: 'newest',
      limit: 5,
    });
    latestReviews = revResult.reviews;
  }

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription,
    image: product.thumbnail,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'VND',
      availability: 'https://schema.org/InStock',
    },
  };

  // CHỈ thêm aggregateRating và reviews khi reviewCount > 0 (tuyệt đối không xuất số 0 hoặc số giả)
  if (reviewSummary.totalReviews > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviewSummary.averageRating,
      reviewCount: reviewSummary.totalReviews,
      bestRating: 5,
      worstRating: 1,
    };

    if (latestReviews.length > 0) {
      jsonLd.review = latestReviews.map((rev) => ({
        '@type': 'Review',
        reviewRating: {
          '@type': 'Rating',
          ratingValue: rev.rating,
          bestRating: 5,
          worstRating: 1,
        },
        author: {
          '@type': 'Person',
          name: rev.customerName || 'Khách hàng Thái Sơn',
        },
        datePublished: new Date(rev.createdAt).toISOString().split('T')[0],
        reviewBody: rev.comment,
        name: rev.title || undefined,
      }));
    }
  }

  return (
    <div className="bg-white min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {useNewLayout ? (
      /* ═══ GIAO DIỆN MỚI (bố cục Amazon) — bật bằng PRODUCT_DETAIL_CONFIG.ENABLE_NEW_LAYOUT ═══ */
      <div className="w-full">
        {/* Dải combo gợi ý (kiểu dải Sponsored của Amazon) */}
        {stripCombo && (
          <ProductComboStrip combo={stripCombo} catalog={products} rating={stripRating} sold={stripSold} />
        )}

        {/* Breadcrumb theo danh mục thực tế */}
        <AmazonProductBreadcrumb product={product} category={category} />

        {/* ── KHU VỰC SẢN PHẨM CHÍNH: Gallery | Thông tin | Buy Box ── */}
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 pt-3 pb-8 lg:pb-10">
          <ProductMainSection
            product={product}
            siblingProducts={siblingProducts}
            gallery={
              <ProductGallery
                images={product.images}
                productName={product.name}
                imageFit={product.imageFit}
                currentProductId={product.id}
                showAllThumbnails
              />
            }
          />
        </div>

        {/* ── GỢI Ý MUA KÈM ── */}
        <div className="border-t border-gray-200 bg-white">
          <ProductBundleSuggestions currentProduct={product} />
        </div>

        {/* ── BÁN CHẠY NHẤT (xếp hạng theo số đã bán thật; ẩn khi chưa đủ 3 sản phẩm) ── */}
        {bestSellerProducts.length >= 3 && (
          <div className="border-t border-gray-200 bg-white">
            <ProductCarousel
              title="Bán chạy nhất tại Thái Sơn Foods"
              subtitle="Xếp hạng theo số lượng đã bán"
              products={bestSellerProducts}
              mobileGrid
              wide
              ranks={bestSellerRanks}
            />
          </div>
        )}

        {/* ── CÁC SẢN PHẨM BẠN CÓ THỂ THÍCH (sản phẩm liên quan) ── */}
        <div className="border-t border-gray-200 bg-white">
          <ProductCarousel
            title="Các sản phẩm bạn có thể thích"
            subtitle={category ? `Cùng danh mục ${category.name} và các dòng thức uống khác của Thái Sơn Foods` : undefined}
            products={similarProducts}
            mobileGrid
            wide
          />
        </div>

        {/* ── SO SÁNH VỚI SẢN PHẨM TƯƠNG TỰ (dữ liệu thật) ── */}
        <div className="border-t border-gray-200 bg-white">
          <ProductCompareTable current={product} others={similarProducts} />
        </div>

        {/* ── KHÁCH MUA SẢN PHẨM NÀY CŨNG MUA (từ các đơn có nhiều món; ẩn khi chưa đủ 3 sản phẩm) ── */}
        {boughtTogetherProducts.length >= 3 && (
          <div className="border-t border-gray-200 bg-white">
            <ProductCarousel
              title="Khách mua sản phẩm này cũng mua"
              products={boughtTogetherProducts}
              mobileGrid
              wide
            />
          </div>
        )}

        {/* ── COMBO ── */}
        {ENABLE_COMBOS && (
          <div className="border-t border-gray-200 bg-white">
            <div className="max-sm:px-2.5 py-8 sm:py-10 max-w-[1800px] mx-auto px-4 sm:px-6">
              <ProductCombosSidebar layout="horizontal" title="Các combo nổi bật đáng cân nhắc" />
            </div>
          </div>
        )}

        {/* ── THÔNG TIN SẢN PHẨM (TAB) ── */}
        <div className="border-t border-gray-200 bg-white scroll-mt-[168px]" id="thong-tin-san-pham">
          <ProductDetailTabs product={product} categoryName={category?.name} />
        </div>

        {/* ── NỘI DUNG THƯƠNG HIỆU (A+): 2 BANNER ĐẶC TÍNH SẢN PHẨM ── */}
        <ProductFeatureShowcase
          product={product}
          productName={product.name}
          productThumbnail={product.thumbnail}
        />

        {/* ── BANNER SHOWCASE THƯƠNG HIỆU ── */}
        <div className="border-t border-gray-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <ProductSponsoredBanner product={product} hideUnverifiedStats randomize />
          </div>
        </div>

        {/* ── THƯƠNG HIỆU (thẻ ảnh lớn + logo; thương hiệu của sản phẩm đang xem đứng đầu) ── */}
        <div className="border-t border-gray-200 bg-white">
          <BrandCardsSection
            brands={[...brands].sort(
              (a, b) => Number(b.productIds.includes(product.id)) - Number(a.productIds.includes(product.id))
            )}
            products={products}
          />
        </div>

        {/* ── KHÁM PHÁ DÒNG KHÁC: mỗi danh mục còn lại một hàng ── */}
        {otherCategoryRows.map(({ category: other, items }) => (
          <div key={other.id} className="border-t border-gray-200 bg-white">
            <ProductCarousel title={`Khám phá dòng ${other.name}`} products={items} mobileGrid wide />
          </div>
        ))}

        {/* ── MÔ TẢ & CÂU CHUYỆN CHẤT LƯỢNG ── */}
        <ProductDescription
          productName={product.name}
          description={product.description || product.shortDescription}
          hideEstimatedNutrition={Boolean(getProductDetailContent(product).nutrition)}
          energyKcal={product.energyKcal}
        />

        {/* ĐÁNH GIÁ TỪ KHÁCH HÀNG (ảnh khách hàng = placeholder, gộp trong mục; đánh giá = dữ liệu thật) */}
        <div className="border-t border-gray-200 bg-white" id="danh-gia-khach-hang">
          <ProductReviewsSection
            productId={product.slug || product.id}
            productName={product.name}
            showCustomerImages
            sidebarSlot={
              reviewAdProduct ? (
                <ReviewProductAd
                  product={reviewAdProduct}
                  brand={pickedBrand?.brand}
                  rating={reviewAdRating ? { averageRating: reviewAdRating.averageRating, totalReviews: reviewAdRating.totalReviews } : null}
                />
              ) : undefined
            }
            bottomSlot={reviewCombo ? <ReviewComboAd combo={reviewCombo} brand={reviewComboBrand} /> : undefined}
          />
        </div>

        {/* ── KHÁCH HÀNG CŨNG XEM (dữ liệu thật; ẩn khi chưa đủ 3 sản phẩm gợi ý) ── */}
        <ProductViewTracker productId={product.id} />
        {alsoViewedProducts.length >= 3 && (
          <div className="border-t border-gray-200 bg-white">
            <ProductCarousel
              title="Khách hàng đã xem sản phẩm này cũng xem"
              products={alsoViewedProducts}
              mobileGrid
              wide
            />
          </div>
        )}

        {/* ── SẢN PHẨM ĐÃ XEM GẦN ĐÂY (lưu cục bộ trên trình duyệt) ── */}
        <RecentlyViewedProducts currentSlug={product.slug} />

        {/* 1 DÒNG 8 SẢN PHẨM / 8 COMBO GIAO ĐỊNH KỲ (SUBSCRIBE & SAVE) — Tạm tắt khi chưa chốt với doanh nghiệp */}
        {MEMBERSHIP_CONFIG.ENABLE_SUBSCRIBE_SAVE && (
          <div className="border-t border-gray-200 bg-white">
            <SubscribeSaveSection
              title="Đăng Ký Giao Định Kỳ — 8 Sản Phẩm & Combo Tiết Kiệm 15%"
              subtitle="Tự động nhận nước uống tươi ngon mỗi tuần tận nhà. Miễn phí vận chuyển 100%, linh hoạt đổi vị và tạm dừng bất kỳ lúc nào."
            />
          </div>
        )}
      </div>
      ) : (
      /* ═══ GIAO DIỆN CŨ (đang hiển thị mặc định) ═══ */
      <div className="w-full">
        {/* Top Bar / Breadcrumb */}
        <ProductBreadcrumb product={product} category={category} />

        {/* Main Product Content Area (3-Column Layout: Gallery Left + Buy Box Center + Sponsored Ad Right) */}
        <div className="max-w-[1456px] mx-auto px-4 sm:px-6 py-6 lg:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Khối Trái + Giữa: Gallery + Thông tin sản phẩm + Thường được mua cùng nhau */}
            <div className="lg:col-span-9 space-y-6 lg:space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-9 gap-6 lg:gap-8 items-start">
                {/* Cột trái (Gallery): lg:col-span-5 w-full lg:sticky lg:top-[168px] space-y-4 */}
                <div className="lg:col-span-5 w-full lg:sticky lg:top-[168px] space-y-4">
                  <ProductGallery
                    images={product.images}
                    productName={product.name}
                    imageFit={product.imageFit}
                    currentProductId={product.id}
                    categoryProducts={categoryProducts}
                  />

                  {/* ── Banner Được tài trợ (Chuẩn Amazon hiển thị dưới chân Gallery) ── */}
                  <ProductSponsoredMiniCard currentProductId={product.id} />
                </div>

                {/* Cột giữa (Buy Box & Info): lg:col-span-4 xl:col-span-4 space-y-4 */}
                <div className="lg:col-span-4 xl:col-span-4 space-y-4">
                  <ProductInfo product={product} />
                </div>
              </div>

              {/* ── Khối Các sản phẩm khách hàng đã mua cùng nhau (Frequently Bought Together chuẩn Amazon) ── */}
              <FrequentlyBoughtTogether currentProduct={product} />
            </div>

            {/* Cột phải (Góc bên phải chỗ khoanh đỏ - Sponsored Best Seller / Đang Sale): lg:col-span-3 xl:col-span-3 */}
            <div className="hidden lg:block lg:col-span-3 xl:col-span-3 lg:sticky lg:top-[168px]">
              <ProductSidebarSponsoredCard currentProductId={product.id} />
            </div>
          </div>

          {/* Hiển thị dưới ProductInfo khi ở màn hình mobile (< lg) */}
          <div className="block lg:hidden mt-6">
            <ProductSidebarSponsoredCard currentProductId={product.id} />
          </div>
        </div>

        {/* ── 1. CÁC SẢN PHẨM BẠN CÓ THỂ THÍCH & CÁC COMBO NỔI BẬT (Thứ tự 1) ── */}
        <div className="border-t border-gray-200 mt-10 bg-white">
          <ProductSection
            excludeProductId={product.id}
            itemsPerRow={7}
            title="Các sản phẩm bạn có thể thích"
            showViewAll={false}
            className="py-8 sm:py-10 md:py-12"
          />
        </div>

        {ENABLE_COMBOS && (
          <div className="border-t border-gray-200 bg-white">
            <div className="section-container max-sm:px-2.5 py-8 sm:py-10 md:py-12 max-w-7xl mx-auto px-4 sm:px-6">
              <ProductCombosSidebar layout="horizontal" title="Các combo nổi bật đáng cân nhắc" />
            </div>
          </div>
        )}

        {/* ── 2. MÔ TẢ & CÂU CHUYỆN CHẤT LƯỢNG (Thứ tự 2) ── */}
        <ProductDescription
          productName={product.name}
          description={product.description || product.shortDescription}
        />

        {/* ── 3. VISUAL A+ CONTENT: 2 BANNER XẾP CHỒNG (Thứ tự 3) ── */}
        <ProductFeatureShowcase
          product={product}
          productName={product.name}
          productThumbnail={product.thumbnail}
        />

        {/* ── BANNER SHOWCASE THƯƠNG HIỆU & SẢN PHẨM (CHUẨN AMAZON BRAND SHOWCASE) ── */}
        <div className="border-t border-gray-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <ProductSponsoredBanner product={product} />
          </div>
        </div>

        {/* ĐÁNH GIÁ TỪ KHÁCH HÀNG (SOCIAL PROOF & REVIEWS) — Chuẩn Amazon & Shopee */}
        <div className="border-t border-gray-200 bg-white" id="danh-gia-khach-hang">
          <ProductReviewsSection productId={product.slug || product.id} productName={product.name} />
        </div>

        {/* 1 DÒNG 8 SẢN PHẨM / 8 COMBO GIAO ĐỊNH KỲ (SUBSCRIBE & SAVE) — Tạm tắt khi chưa chốt với doanh nghiệp */}
        {MEMBERSHIP_CONFIG.ENABLE_SUBSCRIBE_SAVE && (
          <div className="border-t border-gray-200 bg-white">
            <SubscribeSaveSection
              title="Đăng Ký Giao Định Kỳ — 8 Sản Phẩm & Combo Tiết Kiệm 15%"
              subtitle="Tự động nhận nước uống tươi ngon mỗi tuần tận nhà. Miễn phí vận chuyển 100%, linh hoạt đổi vị và tạm dừng bất kỳ lúc nào."
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
}
