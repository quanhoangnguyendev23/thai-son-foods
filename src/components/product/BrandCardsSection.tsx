import Image from 'next/image';
import Link from 'next/link';
import { Brand } from '@/data/brands';
import { cn } from '@/lib/utils';

interface BrandCardsSectionProps {
  brands: Brand[];
  title?: string;
  className?: string;
}

/**
 * Khối "Thương hiệu" (kiểu "Brands in this category" của Amazon):
 * mỗi thẻ gồm ảnh lớn sản phẩm trong bối cảnh sử dụng + logo + một dòng giới thiệu.
 * Bấm thẻ mở trang thương hiệu /thuong-hieu/[slug]. Điện thoại: vuốt ngang.
 */
export default function BrandCardsSection({
  brands,
  title = 'Thương hiệu của Thái Sơn Foods',
  className,
}: BrandCardsSectionProps) {
  if (brands.length === 0) return null;

  return (
    <section className={cn('max-w-[1800px] mx-auto px-4 sm:px-6 py-6 md:py-8', className)}>
      <h2 className="text-xl md:text-2xl text-ink-950 mb-3">{title}</h2>
      <ul className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible">
        {brands.map((brand) => (
          <li key={brand.slug} className="snap-start shrink-0 w-[82%] sm:w-[60%] md:w-auto">
            <Link
              href={`/thuong-hieu/${brand.slug}`}
              title={`Xem sản phẩm thương hiệu ${brand.name}`}
              className="group block h-full overflow-hidden rounded-md border border-gray-200 bg-white hover:shadow-md transition-shadow"
            >
              <span className="relative block aspect-[2/1] overflow-hidden bg-ivory">
                <Image
                  src={brand.coverImage}
                  alt={`Sản phẩm ${brand.name}`}
                  fill
                  sizes="(max-width: 768px) 82vw, 33vw"
                  className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                />
              </span>
              <span className="flex flex-col items-center justify-center gap-1.5 px-4 py-4 text-center">
                <span className="relative block h-14 w-36">
                  <Image src={brand.logo} alt={`Logo ${brand.name}`} fill sizes="144px" className="object-contain" />
                </span>
                <span className="text-sm text-gray-700">{brand.tagline}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
