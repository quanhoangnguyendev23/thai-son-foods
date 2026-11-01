import Image from 'next/image';
import Link from 'next/link';
import { Brand } from '@/data/brands';
import { Product } from '@/types';
import { cn } from '@/lib/utils';

interface BrandCardsSectionProps {
  brands: Brand[];
  /** Danh mục sản phẩm, để chọn ngẫu nhiên ảnh của một sản phẩm thuộc thương hiệu */
  products: Product[];
  title?: string;
  className?: string;
}

interface BrandCover {
  image: string;
  alt: string;
  href: string;
}

/**
 * Chọn ngẫu nhiên một ảnh của một sản phẩm thuộc thương hiệu (mỗi lần tải trang một ảnh khác).
 * Lấy ảnh sản phẩm, ảnh sử dụng, ảnh lợi ích (4 ảnh đầu gallery, cùng tỉ lệ 4:3 nên khớp khung, không bị cắt);
 * bỏ ảnh kế hoạch sử dụng và ảnh nhãn thành phần. Không có ảnh nào thì dùng ảnh bìa khai báo sẵn.
 */
function pickBrandCover(brand: Brand, products: Product[]): BrandCover {
  const candidates: BrandCover[] = [];
  for (const id of brand.productIds) {
    const product = products.find((p) => p.id === id && p.isActive !== false);
    if (!product) continue;
    const href = `/san-pham/${product.slug}`;
    for (const img of product.images || []) {
      if ((img.sortOrder || 0) <= 4 && img.url) candidates.push({ image: img.url, alt: img.alt || product.name, href });
    }
  }
  if (candidates.length === 0) {
    return { image: brand.coverImage, alt: `Sản phẩm ${brand.name}`, href: `/thuong-hieu/${brand.slug}` };
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Khối "Thương hiệu" (kiểu "Brands in this category" của Amazon):
 * mỗi thẻ gồm ảnh lớn ngẫu nhiên của một sản phẩm thuộc thương hiệu + logo + một dòng giới thiệu.
 * Bấm ảnh mở trang chi tiết đúng sản phẩm trong ảnh; bấm logo mở trang thương hiệu. Điện thoại: vuốt ngang.
 */
export default function BrandCardsSection({
  brands,
  products,
  title = 'Thương hiệu của Thái Sơn Foods',
  className,
}: BrandCardsSectionProps) {
  if (brands.length === 0) return null;
  const cards = brands.map((brand) => ({ brand, cover: pickBrandCover(brand, products) }));

  return (
    <section className={cn('max-w-[1800px] mx-auto px-4 sm:px-6 py-6 md:py-8', className)}>
      <h2 className="text-xl md:text-2xl text-ink-950 mb-3">{title}</h2>
      <ul className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible">
        {cards.map(({ brand, cover }) => (
          <li
            key={brand.slug}
            className="snap-start shrink-0 w-[82%] sm:w-[60%] md:w-auto overflow-hidden rounded-md border border-gray-200 bg-white hover:shadow-md transition-shadow"
          >
            <Link href={cover.href} title={cover.alt} className="group relative block aspect-[4/3] overflow-hidden bg-ivory">
              <Image
                src={cover.image}
                alt={cover.alt}
                fill
                sizes="(max-width: 768px) 82vw, 33vw"
                className="object-cover group-hover:opacity-90 transition-opacity"
              />
            </Link>
            <Link
              href={`/thuong-hieu/${brand.slug}`}
              title={`Xem sản phẩm thương hiệu ${brand.name}`}
              className="flex flex-col items-center justify-center gap-1.5 px-4 py-4 text-center hover:bg-gray-50"
            >
              <span className="relative block h-14 w-36">
                <Image src={brand.logo} alt={`Logo ${brand.name}`} fill sizes="144px" className="object-contain" />
              </span>
              <span className="text-sm text-gray-700">{brand.tagline}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
