import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { combos, getComboBySlug } from '@/data/combos';
import { products } from '@/data/products';
import ComboDetailView from '@/components/product/ComboDetailView';
import ProductCombosSidebar from '@/components/product/ProductCombosSidebar';
import ProductCarousel from '@/components/product/ProductCarousel';
import ProductReviewsSection from '@/components/product/ProductReviewsSection';
import ProductDescription from '@/components/product/ProductDescription';
import ProductSponsoredBanner from '@/components/product/ProductSponsoredBanner';

import { query } from '@/lib/db';
import { Combo } from '@/types';

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
        products: (Array.isArray(dbCombo.items) && dbCombo.items.length > 0)
          ? dbCombo.items.map((it: any) => ({
              productId: it.product_id,
              quantity: Number(it.quantity) || 1,
            }))
          : fallback.products,
      };
    }
  } catch (err) {
    console.error('Error fetching live combo from DB:', err);
  }

  return baseCombo;
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

import { getAvailability } from '@/lib/inventory';

export default async function ComboDetailPage({ params }: ComboPageProps) {
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
    const matchedProduct = products.find(
      (p) => p.id === item.productId || p.slug === item.productId
    );
    return {
      quantity: item.quantity,
      productId: item.productId,
      product: matchedProduct || null,
    };
  });

  return (
    <div className="bg-white min-h-screen">
      <div className="w-full">
        {/* Cột nội dung chính */}
        <ComboDetailView
          combo={combo}
          productsDetail={comboProductsWithDetail}
          initialStock={initialStock}
          initialStockDetails={initialStockDetails}
        />

        {/* ── CÁC SẢN PHẨM BẠN CÓ THỂ THÍCH (cùng bố cục trang chi tiết sản phẩm) ── */}
        <div className="border-t border-gray-200 bg-white">
          <ProductCarousel
            title="Các sản phẩm bạn có thể thích"
            subtitle="Các dòng thức uống khác của Thái Sơn Foods"
            products={products.filter((p) => p.isActive !== false)}
          />
        </div>

        {/* ── COMBO NỔI BẬT ── */}
        <div className="border-t border-gray-200 bg-white">
          <div className="section-container max-sm:px-2.5 py-8 sm:py-10 max-w-7xl mx-auto px-4 sm:px-6">
            <ProductCombosSidebar layout="horizontal" title="Các combo nổi bật đáng cân nhắc" />
          </div>
        </div>

        {/* ── BANNER SHOWCASE THƯƠNG HIỆU ── */}
        <div className="border-t border-gray-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <ProductSponsoredBanner hideUnverifiedStats randomize />
          </div>
        </div>

        {/* ── MÔ TẢ & CÂU CHUYỆN CHẤT LƯỢNG ── */}
        <ProductDescription
          productName={combo.name}
          description={combo.description}
        />

        {/* ĐÁNH GIÁ TỪ KHÁCH HÀNG */}
        <div className="border-t border-gray-200 bg-white" id="danh-gia-khach-hang">
          <ProductReviewsSection
            productId={`combo:${combo.slug || combo.id}`}
            productName={combo.name}
            showCustomerImages
          />
        </div>


      </div>
    </div>
  );
}
