import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ENABLE_COMBOS } from '@/config/features';
import { combos, getComboBySlug } from '@/data/combos';
import { products, categories } from '@/data/products';
import ComboDetailView from '@/components/product/ComboDetailView';
import ComboCarousel from '@/components/product/ComboCarousel';
import RecentlyViewedProducts from '@/components/product/RecentlyViewedProducts';
import { PersonalizedSignInPrompt, BackToTopBar } from '@/components/product/ProductPageEndBlocks';
import ProductCarousel from '@/components/product/ProductCarousel';
import ProductReviewsSection from '@/components/product/ProductReviewsSection';
import ProductSponsoredBanner from '@/components/product/ProductSponsoredBanner';
import { ReviewProductAd, ReviewComboAd } from '@/components/product/ProductReviewAds';
import { brands } from '@/data/brands';
import { getShortProductName } from '@/lib/product-detail';
import { getProductReviewSummary } from '@/lib/reviews/repository';
import ProductComboStrip from '@/components/product/ProductComboStrip';
import { getTotalSold, getBestSellerRanking, getBoughtTogetherIds, getAlsoViewedIds } from '@/lib/product-stats';
import BrandCardsSection from '@/components/product/BrandCardsSection';
import { Product } from '@/types';

import { query } from '@/lib/db';
import { Combo } from '@/types';
import { splitComboRows } from '@/lib/recommendation-rows';

export const dynamic = 'force-dynamic';

interface ComboPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return combos.map((combo) => ({
    slug: combo.slug,
  }));
}

/**
 * Lấy dữ liệu combo mới nhất từ PostgreSQL database
 */
async function getLiveCombo(slug: string): Promise<Combo | undefined> {
  const baseCombo = getComboBySlug(slug);

  try {
    const dbRes = await query(
      `SELECT 
         c.*,
         COALESCE((
           SELECT json_agg(
             json_build_object('product_id', ci.product_id, 'quantity', ci.quantity)
           )
           FROM combo_items ci WHERE ci.combo_id = c.id
         ), '[]') AS items,
         COALESCE((
           SELECT json_agg(
             json_build_object('id', cimg.id, 'url', cimg.url, 'alt', cimg.alt, 'sortOrder', cimg.sort_order, 'isPrimary', (cimg.image_type = 'primary' OR cimg.image_type = 'thumbnail'))
             ORDER BY cimg.sort_order ASC
           )
           FROM combo_images cimg WHERE cimg.combo_id = c.id AND cimg.is_active = true
         ), '[]') AS images
       FROM combos c
       WHERE c.slug = $1 OR c.id = $1
       LIMIT 1;`,
      [slug]
    );

    if (dbRes.rows.length > 0) {
      const dbCombo = dbRes.rows[0];
      const fallback = baseCombo || combos.find((c) => c.id === dbCombo.id || c.slug === dbCombo.slug) || {
        id: dbCombo.id,
        name: dbCombo.name,
        slug: dbCombo.slug,
        originalPrice: Number(dbCombo.original_price) || 0,
        salePrice: Number(dbCombo.sale_price) || 0,
        totalItems: Number(dbCombo.total_items) || 10,
        discount: Number(dbCombo.discount) || 0,
        image: dbCombo.thumbnail || '/images/combos/combo-1.jpg',
        description: dbCombo.description || '',
        products: [],
        isActive: true,
      };

      const activeImages = Array.isArray(dbCombo.images) && dbCombo.images.length > 0 ? dbCombo.images : [];
      const primaryFromImages = activeImages.find((img: any) => img.isPrimary)?.url || activeImages[0]?.url;
      const finalImage = dbCombo.thumbnail || primaryFromImages || fallback.image;

      return {
        ...fallback,
        name: dbCombo.name || fallback.name,
        originalPrice: dbCombo.original_price !== null && dbCombo.original_price !== undefined ? Number(dbCombo.original_price) : fallback.originalPrice,
        salePrice: dbCombo.sale_price !== null && dbCombo.sale_price !== undefined ? Number(dbCombo.sale_price) : fallback.salePrice,
        totalItems: dbCombo.total_items !== null && dbCombo.total_items !== undefined ? Number(dbCombo.total_items) : fallback.totalItems,
        discount: dbCombo.discount !== null && dbCombo.discount !== undefined ? Number(dbCombo.discount) : fallback.discount,
        image: finalImage,
        images: activeImages.map((img: any) => ({
          id: img.id,
          url: img.url,
          alt: img.alt || dbCombo.name,
          sortOrder: Number(img.sortOrder) || 1,
          isPrimary: Boolean(img.isPrimary),
        })),
        description: dbCombo.description || fallback.description,
        isActive: dbCombo.is_active !== null && dbCombo.is_active !== undefined ? Boolean(dbCombo.is_active) : fallback.isActive,
        isBestSeller: Boolean(dbCombo.is_best_seller),
        products: (Array.isArray(dbCombo.items) && dbCombo.items.length > 0)
          ? dbCombo.items.map((it: any) => ({
              productId: it.product_id,
              quantity: Number(it.quantity) || 1,
            }))
          : fallback.products,
      };
    }

    // CSDL đã có combo mà không có dòng này (combo đã xoá) → không hiện lại từ dữ liệu mẫu combos.ts, trả 404
    const countRes = await query(`SELECT COUNT(*) AS total FROM combos;`);
    if (Number(countRes.rows[0]?.total || 0) > 0) return undefined;
  } catch (err) {
    console.error('Error fetching live combo from DB:', err);
  }

  return baseCombo;
}

/** Combo đang bán khác cho hàng "Các combo nổi bật" (CSDL do admin quản lý; CSDL trống thì dùng dữ liệu mẫu) */
async function getOtherActiveCombos(currentId: string): Promise<Combo[]> {
  try {
    const res = await query(
      `SELECT c.*,
         COALESCE((SELECT json_agg(json_build_object('product_id', ci.product_id, 'quantity', ci.quantity))
                   FROM combo_items ci WHERE ci.combo_id = c.id), '[]') AS items
       FROM combos c WHERE c.is_active = true ORDER BY c.created_at ASC`
    );
    if (res.rows.length > 0) {
      return res.rows
        .map((row: any) => {
          const base = combos.find((c) => c.id === row.id || c.slug === row.slug);
          return {
            ...(base || {}),
            id: row.id,
            slug: row.slug || base?.slug || row.id,
            name: row.name || base?.name || '',
            description: row.description || base?.description || '',
            image: row.thumbnail || row.image || base?.image || '/images/combos/combo-1.jpg',
            originalPrice: Number(row.original_price) || base?.originalPrice || 0,
            salePrice: Number(row.sale_price) || base?.salePrice || 0,
            totalItems: Number(row.total_items) || base?.totalItems || 0,
            discount: Number(row.discount) || 0,
            isActive: true,
            isBestSeller: Boolean(row.is_best_seller),
            products: Array.isArray(row.items) && row.items.length > 0
              ? row.items.map((it: any) => ({ productId: String(it.product_id), quantity: Number(it.quantity) || 1 }))
              : base?.products || [],
          } as Combo;
        })
        .filter((c: Combo) => c.id !== currentId && c.salePrice > 0 && c.slug);
    }
    // CSDL đã có combo nhưng đều tạm dừng → không gợi ý combo nào
    const countRes = await query(`SELECT COUNT(*) AS total FROM combos;`);
    if (Number(countRes.rows[0]?.total || 0) > 0) return [];
  } catch (err) {
    console.error('Không thể lấy combo nổi bật cho trang combo:', err);
  }
  return combos.filter((c) => c.isActive && c.id !== currentId);
}

export async function generateMetadata({
  params,
}: ComboPageProps): Promise<Metadata> {
  const { slug } = await params;
  const combo = await getLiveCombo(slug);

  if (!combo || combo.isActive === false) {
    return { title: 'Combo không tìm thấy' };
  }

  return {
    title: combo.name,
    description: combo.description,
    openGraph: {
      title: combo.name,
      description: combo.description,
      images: [{ url: combo.image }],
      type: 'website',
    },
  };
}

import { getAvailability, canonicalProductId } from '@/lib/inventory';

export default async function ComboDetailPage({ params }: ComboPageProps) {
  // Doanh nghiệp chưa chốt combo → tạm ẩn trang chi tiết combo
  if (!ENABLE_COMBOS) redirect('/');
  const { slug } = await params;
  const combo = await getLiveCombo(slug);

  if (!combo || combo.isActive === false) {
    notFound();
  }

  // Pre-fetch tồn kho khởi tạo cho chi nhánh mặc định trên Server Component
  let initialStock: number | null = null;
  let initialStockDetails: any[] = [];
  try {
    const invRes = await getAvailability('TTH', [{ productId: combo.id, quantity: 1 }]);
    if (invRes.itemsDetail.length > 0) {
      const enriched = invRes.itemsDetail.map((detail) => {
        const bottlesPerUnit = detail.requested > 0 ? detail.requested : 1;
        const maxCombos = bottlesPerUnit > 0 ? Math.floor(detail.available / bottlesPerUnit) : 0;
        return {
          ...detail,
          bottlesPerUnit,
          maxCombos,
        };
      });
      initialStock = Math.max(0, Math.min(...enriched.map((d) => d.maxCombos)));
      initialStockDetails = enriched;
    }
  } catch (err) {
    console.error('Error fetching initial combo stock on server:', err);
  }

  // Lấy chi tiết từng chai trong combo từ danh sách products chính
  const comboProductsWithDetail = combo.products.map((item) => {
    // Món combo trong CSDL có thể lưu mã kho ("prod-sb-01") thay vì mã danh mục ("sua-bap-nep") → quy đổi về mã chuẩn để khớp
    const itemKey = canonicalProductId(item.productId);
    const matchedProduct = products.find(
      (p) => p.id === item.productId || p.slug === item.productId || canonicalProductId(p.id) === itemKey
    );
    return {
      quantity: item.quantity,
      productId: item.productId,
      product: matchedProduct || null,
    };
  });

  const otherCombos = await getOtherActiveCombos(combo.id);
  const bannerProduct = comboProductsWithDetail.find((it) => it.product)?.product || products.find((p) => p.isActive !== false);

  // ── 2 box "Được tài trợ" trong mục Đánh giá (giống trang sản phẩm; chọn cố định, không ngẫu nhiên) ──
  const brandOfItem = (pid: string) => {
    const key = canonicalProductId(pid);
    return brands.find((b) => b.productIds.some((id) => canonicalProductId(id) === key));
  };
  // Box sản phẩm: món có nhiều chai nhất trong combo (bằng nhau → món đầu) để khách mua lẻ
  const reviewAdItem = comboProductsWithDetail
    .filter((it) => it.product && it.product.isActive !== false)
    .reduce<(typeof comboProductsWithDetail)[number] | undefined>((best, it) => (!best || it.quantity > best.quantity ? it : best), undefined);
  const reviewAdProduct = reviewAdItem?.product || undefined;
  const reviewAdRating = reviewAdProduct
    ? await getProductReviewSummary(reviewAdProduct.slug || reviewAdProduct.id).catch(() => null)
    : null;
  // Box combo: combo khác có chung sản phẩm, nhiều chai chung nhất đứng trước; không có → ẩn box
  const comboKeys = new Set(combo.products.map((it) => canonicalProductId(it.productId)));
  const sharedQty = (c: Combo) =>
    c.products.filter((it) => comboKeys.has(canonicalProductId(it.productId))).reduce((sum, it) => sum + it.quantity, 0);
  // Xếp hạng combo liên quan (nhiều chai chung trước; bằng nhau giữ thứ tự bảng tính). Dải trên đầu trang lấy hạng 1,
  // box trong mục Đánh giá lấy hạng 2 (không lặp combo giống trang sản phẩm); thiếu thì ẩn
  const relatedCombos = otherCombos
    .filter((c) => c.id !== combo.id && sharedQty(c) > 0)
    .map((c, i) => ({ c, i, q: sharedQty(c) }))
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map((x) => x.c);
  const stripCombo = relatedCombos[0];
  const reviewCombo = relatedCombos[1];
  const [stripSummary, stripSold] = stripCombo
    ? await Promise.all([
        getProductReviewSummary(`combo:${stripCombo.slug}`).catch(() => null),
        getTotalSold(stripCombo.id, 'combo', stripCombo.slug).catch(() => 0),
      ])
    : [null, 0];
  const stripRating = stripSummary ? { averageRating: stripSummary.averageRating, totalReviews: stripSummary.totalReviews } : null;

  // ── CÁC HÀNG GỢI Ý (tương đương trang sản phẩm, theo nghiệp vụ combo; chọn cố định, hàng ít hơn 4 món thì ẩn) ──
  const activeCatalog = products.filter((p) => p.isActive !== false);
  const isInCombo = (p: Product) => comboKeys.has(canonicalProductId(p.id));
  const notInCombo = (list: Product[]) => list.filter((p) => !isInCombo(p));
  const byIds = (ids: string[]) =>
    ids.map((id) => activeCatalog.find((p) => p.id === id)).filter((p): p is Product => Boolean(p));
  const uniq = (list: Product[]) => list.filter((p, i) => list.findIndex((x) => x.id === p.id) === i);
  const MIN_ROW = 4;
  // Mua lẻ sản phẩm trong combo (thay "Gợi ý mua kèm" của trang SP): luôn hiện khi có món
  const comboItemProducts = uniq(
    comboProductsWithDetail.map((it) => it.product).filter((p): p is Product => Boolean(p) && p!.isActive !== false)
  );
  // Bán chạy nhất / Khách mua combo này cũng mua / Khách cũng xem: dữ liệu thật như trang SP;
  // combo chưa có dữ liệu riêng thì gộp theo từng sản phẩm trong combo
  let bestSellerProducts: Product[] = [];
  let bestSellerRanks: number[] = [];
  let boughtTogetherProducts: Product[] = [];
  let alsoViewedProducts: Product[] = [];
  try {
    const ranking = await getBestSellerRanking(activeCatalog);
    const ranked = ranking
      .map((r, i) => ({ product: activeCatalog.find((p) => p.id === r.productId), rank: i + 1 }))
      .filter((r): r is { product: Product; rank: number } => Boolean(r.product))
      .slice(0, 10);
    bestSellerProducts = ranked.map((r) => r.product);
    bestSellerRanks = ranked.map((r) => r.rank);

    let togetherIds = await getBoughtTogetherIds(combo.id, activeCatalog, 12);
    if (togetherIds.length < MIN_ROW) {
      for (const p of comboItemProducts) togetherIds = togetherIds.concat(await getBoughtTogetherIds(p.id, activeCatalog, 12));
    }
    boughtTogetherProducts = notInCombo(uniq(byIds(togetherIds))).slice(0, 12);

    let viewedIds = await getAlsoViewedIds(combo.id, 12);
    if (viewedIds.length < MIN_ROW) {
      for (const p of comboItemProducts) viewedIds = viewedIds.concat(await getAlsoViewedIds(p.id, 12));
    }
    alsoViewedProducts = notInCombo(uniq(byIds(viewedIds))).slice(0, 12);
  } catch (err) {
    console.error('Không thể lấy gợi ý bán chạy / mua cùng / cùng xem cho combo:', err);
  }
  // Có thể thích: sản phẩm ngoài combo, cùng danh mục với các món trong combo đứng trước
  const comboCategoryIds = new Set(comboItemProducts.map((p) => p.categoryId));
  const youMayLike = notInCombo(activeCatalog).sort(
    (a, b) => Number(comboCategoryIds.has(b.categoryId)) - Number(comboCategoryIds.has(a.categoryId))
  );
  // 2 hàng combo xen giữa các hàng sản phẩm, không lặp combo giữa 2 hàng (giống trang sản phẩm):
  // hàng 1 = combo có cùng sản phẩm (nhiều chai chung trước); hàng 2 = các combo còn lại, gần tầm giá combo này trước
  const priceGap = (c: Combo) => Math.abs(c.salePrice - combo.salePrice);
  const otherCombosByPrice = otherCombos
    .map((c, i) => ({ c, i }))
    .sort((a, b) => priceGap(a.c) - priceGap(b.c) || a.i - b.i)
    .map((x) => x.c);
  const { related: relatedComboRow, others: moreComboRow } = splitComboRows(relatedCombos, otherCombosByPrice);
  // Khám phá dòng …: mỗi danh mục một hàng, bỏ sản phẩm đã có trong combo
  const exploreRows = categories
    .map((cat) => ({ category: cat, items: notInCombo(activeCatalog.filter((p) => p.categoryId === cat.id)) }))
    .filter((row) => row.items.length >= MIN_ROW);
  // Logo chỉ khi mọi chai của combo gợi ý cùng một hãng
  const reviewComboBrand = (() => {
    if (!reviewCombo || reviewCombo.products.length === 0) return undefined;
    const itemBrands = reviewCombo.products.map((it) => brandOfItem(it.productId));
    const first = itemBrands[0];
    return first && itemBrands.every((b) => b?.slug === first.slug) ? first : undefined;
  })();
  // Tiêu đề: sản phẩm chung có nhiều chai nhất trong combo gợi ý
  const sharedTop = reviewCombo?.products
    .filter((it) => comboKeys.has(canonicalProductId(it.productId)))
    .sort((a, b) => b.quantity - a.quantity)[0];
  const sharedProduct = sharedTop
    ? products.find((p) => canonicalProductId(p.id) === canonicalProductId(sharedTop.productId))
    : undefined;
  const reviewComboHeadline = sharedProduct ? `Combo khác có ${getShortProductName(sharedProduct)}` : undefined;
  const reviewAdBrand = reviewAdProduct ? brandOfItem(reviewAdProduct.id) : undefined;

  return (
    <div className="bg-white min-h-screen">
      {/* Lề 2 bên 80px từ lg (giống trang sản phẩm): 56px ở đây + 24px (sm:px-6) sẵn có trong từng khối */}
      <div className="w-full lg:px-14">
        {/* Dải combo gợi ý phía trên breadcrumb (giống trang sản phẩm) */}
        {stripCombo && (
          <ProductComboStrip combo={stripCombo} catalog={products} rating={stripRating} sold={stripSold} />
        )}

        {/* Cột nội dung chính */}
        <ComboDetailView
          combo={combo}
          productsDetail={comboProductsWithDetail}
          initialStock={initialStock}
          initialStockDetails={initialStockDetails}
        />

        {/* ── CÁC HÀNG GỢI Ý: XEN KẼ HÀNG SẢN PHẨM VÀ HÀNG COMBO (cùng thứ tự với trang sản phẩm) ──
            SP: Mua lẻ → Bán chạy → COMBO: cùng sản phẩm → SP: Có thể thích → COMBO: khác đáng cân nhắc → SP: Khách cũng mua */}

        {/* SP · MUA LẺ SẢN PHẨM TRONG COMBO (vị trí "Gợi ý mua kèm" của trang SP) */}
        {comboItemProducts.length > 0 && (
          <div className="border-t border-gray-200 bg-white">
            <ProductCarousel plain title="Mua lẻ sản phẩm trong combo" subtitle="Các sản phẩm có trong combo, mua riêng từng loại" products={comboItemProducts} mobileGrid wide />
          </div>
        )}

        {/* SP · BÁN CHẠY NHẤT (cùng dữ liệu trang SP) */}
        {bestSellerProducts.length >= MIN_ROW && (
          <div className="border-t border-gray-200 bg-white">
            <ProductCarousel plain title="Bán chạy nhất tại Thái Sơn Foods" subtitle="Xếp hạng theo số lượng đã bán" products={bestSellerProducts} mobileGrid wide ranks={bestSellerRanks} />
          </div>
        )}

        {/* COMBO · CÓ CÙNG SẢN PHẨM (nhiều chai chung trước); không có thì hàng combo khác lên vị trí này */}
        {relatedComboRow.length > 0 ? (
          <div className="border-t border-gray-200 bg-white">
            <ComboCarousel plain title="Combo khác có cùng sản phẩm" subtitle="Cùng các món trong combo này, phối thêm vị khác" combos={relatedComboRow} />
          </div>
        ) : moreComboRow.length > 0 ? (
          <div className="border-t border-gray-200 bg-white">
            <ComboCarousel plain title="Các combo nổi bật đáng cân nhắc" subtitle="Gần tầm giá combo này đứng trước" combos={moreComboRow} />
          </div>
        ) : null}

        {/* SP · CÓ THỂ THÍCH: sản phẩm ngoài combo, cùng danh mục trước */}
        {youMayLike.length >= MIN_ROW && (
          <div className="border-t border-gray-200 bg-white">
            <ProductCarousel plain title="Các sản phẩm bạn có thể thích" subtitle="Các dòng thức uống khác của Thái Sơn Foods" products={youMayLike} mobileGrid wide />
          </div>
        )}

        {/* COMBO · KHÁC ĐÁNG CÂN NHẮC: combo chưa có ở hàng trên, gần tầm giá trước (gộp "Combo cùng tầm giá" + "Combo nổi bật") */}
        {relatedComboRow.length > 0 && moreComboRow.length > 0 && (
          <div className="border-t border-gray-200 bg-white">
            <ComboCarousel plain title="Các combo nổi bật đáng cân nhắc" subtitle="Gần tầm giá combo này đứng trước" combos={moreComboRow} />
          </div>
        )}

        {/* SP · KHÁCH MUA COMBO NÀY CŨNG MUA (dữ liệu đơn hàng thật) */}
        {boughtTogetherProducts.length >= MIN_ROW && (
          <div className="border-t border-gray-200 bg-white">
            <ProductCarousel plain title="Khách mua combo này cũng mua" products={boughtTogetherProducts} mobileGrid wide />
          </div>
        )}

        {/* ── BANNER SHOWCASE THƯƠNG HIỆU (cần sản phẩm gốc để chọn ngẫu nhiên, không thì khối ẩn để lại khoảng trắng) ── */}
        {bannerProduct && (
          <div className="border-t border-gray-200 bg-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <ProductSponsoredBanner product={bannerProduct} hideUnverifiedStats randomize />
            </div>
          </div>
        )}

        {/* ── THƯƠNG HIỆU (thương hiệu có sản phẩm trong combo đứng đầu) ── */}
        <div className="border-t border-gray-200 bg-white">
          <BrandCardsSection
            brands={[...brands].sort(
              (x, y) =>
                Number(y.productIds.some((id) => comboKeys.has(canonicalProductId(id)))) -
                Number(x.productIds.some((id) => comboKeys.has(canonicalProductId(id))))
            )}
            products={products}
          />
        </div>

        {/* ── KHÁM PHÁ DÒNG …: mỗi danh mục một hàng, không lặp sản phẩm đã có trong combo ── */}
        {exploreRows.map(({ category, items }) => (
          <div key={category.id} className="border-t border-gray-200 bg-white">
            <ProductCarousel plain title={`Khám phá dòng ${category.name}`} products={items} mobileGrid wide />
          </div>
        ))}

        {/* ĐÁNH GIÁ TỪ KHÁCH HÀNG */}
        <div className="border-t border-gray-200 bg-white" id="danh-gia-khach-hang">
          <ProductReviewsSection
            productId={`combo:${combo.slug || combo.id}`}
            productName={combo.name}
            showCustomerImages
            sidebarSlot={
              reviewAdProduct ? (
                <ReviewProductAd
                  product={reviewAdProduct}
                  brand={reviewAdBrand}
                  rating={reviewAdRating ? { averageRating: reviewAdRating.averageRating, totalReviews: reviewAdRating.totalReviews } : null}
                />
              ) : undefined
            }
            bottomSlot={reviewCombo ? <ReviewComboAd combo={reviewCombo} brand={reviewComboBrand} headline={reviewComboHeadline} /> : undefined}
          />
        </div>

        {/* ── KHÁCH CŨNG XEM (dữ liệu lượt xem thật) ── */}
        {alsoViewedProducts.length >= MIN_ROW && (
          <div className="border-t border-gray-200 bg-white">
            <ProductCarousel plain title="Khách xem combo này cũng xem" products={alsoViewedProducts} mobileGrid wide />
          </div>
        )}

        {/* ── SẢN PHẨM ĐÃ XEM GẦN ĐÂY (chỉ đọc lịch sử, không ghi combo vào) ── */}
        <RecentlyViewedProducts currentSlug={combo.slug || combo.id} readOnly />

        {/* ── CUỐI TRANG: mời đăng nhập + thanh Lên đầu trang (như trang sản phẩm) ── */}
        <PersonalizedSignInPrompt />
        {/* Dải "Lên đầu trang" tràn hết bề ngang (bù lại lề lg:px-14 của khung) */}
        <div className="lg:-mx-14">
          <BackToTopBar />
        </div>
      </div>
    </div>
  );
}
