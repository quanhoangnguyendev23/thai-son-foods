import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { brands, getBrandBySlug } from '@/data/brands';
import { products } from '@/data/products';
import { Product } from '@/types';
import ProductCard from '@/components/product/ProductCard';
import BrandCardsSection from '@/components/product/BrandCardsSection';

// Ảnh thẻ thương hiệu chọn ngẫu nhiên mỗi lần tải trang
export const dynamic = 'force-dynamic';

interface BrandPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return brands.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) return { title: 'Thương hiệu không tìm thấy' };
  return {
    title: `Thương hiệu ${brand.name}`,
    description: brand.tagline,
    openGraph: { title: `Thương hiệu ${brand.name}`, description: brand.tagline, images: [{ url: brand.coverImage }] },
  };
}

/** Trang thương hiệu: logo, ảnh lớn, toàn bộ sản phẩm của thương hiệu và các thương hiệu khác */
export default async function BrandPage({ params }: BrandPageProps) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();

  const brandProducts = brand.productIds
    .map((id) => products.find((p) => p.id === id && p.isActive !== false))
    .filter((p): p is Product => Boolean(p));
  const otherBrands = brands.filter((b) => b.slug !== brand.slug);

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 pt-3 pb-1 text-xs text-gray-600">
        <Link href="/" className="hover:underline">Trang chủ</Link>
        <span className="mx-1.5">›</span>
        <span className="text-ink-950">Thương hiệu {brand.name}</span>
      </div>

      {/* Đầu trang: logo + giới thiệu | ảnh lớn */}
      <section className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4">
        <div className="grid overflow-hidden rounded-md border border-gray-200 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 text-center md:items-start md:text-left">
            <span className="relative block h-20 w-48">
              <Image src={brand.logo} alt={`Logo ${brand.name}`} fill sizes="192px" className="object-contain md:object-left" priority />
            </span>
            <h1 className="text-2xl md:text-3xl text-ink-950">Thương hiệu {brand.name}</h1>
            <p className="text-sm md:text-base text-gray-700">{brand.tagline}</p>
            <p className="text-xs text-gray-500">{brandProducts.length} sản phẩm · Sản xuất bởi Thái Sơn Foods</p>
          </div>
          <div className="relative aspect-[16/9] md:aspect-auto md:min-h-[320px] bg-ivory">
            <Image src={brand.coverImage} alt={`Sản phẩm ${brand.name}`} fill sizes="(max-width: 768px) 100vw, 60vw" className="object-cover" priority />
          </div>
        </div>
      </section>

      {/* Toàn bộ sản phẩm của thương hiệu */}
      <section className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-xl md:text-2xl text-ink-950 mb-3">Sản phẩm {brand.name}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {brandProducts.map((p) => (
            <ProductCard key={p.id} product={p} layout="compact" isHomepage />
          ))}
        </div>
      </section>

      {/* Các thương hiệu khác */}
      <div className="border-t border-gray-200">
        <BrandCardsSection brands={otherBrands} products={products} title="Thương hiệu khác của Thái Sơn Foods" />
      </div>
    </div>
  );
}
