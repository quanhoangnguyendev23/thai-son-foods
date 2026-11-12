/**
 * Thương hiệu sản phẩm của Thái Sơn Foods — dùng cho khối "Thương hiệu" (thẻ ảnh lớn + logo)
 * trên trang chi tiết sản phẩm và trang riêng /thuong-hieu/[slug].
 * Thêm thương hiệu mới: thêm logo vào public/images/brands/ rồi thêm một mục ở đây.
 */
export interface Brand {
  slug: string;
  name: string;
  logo: string;
  /** Ảnh lớn phía trên thẻ (ảnh sản phẩm trong bối cảnh sử dụng) */
  coverImage: string;
  /** Một dòng ngắn dưới logo */
  tagline: string;
  /** id sản phẩm (trong src/data/products.ts) thuộc thương hiệu */
  productIds: string[];
}

export const brands: Brand[] = [
  {
    slug: 'yoo',
    name: 'Yoo',
    logo: '/images/brands/yoo.png',
    coverImage: '/images/products/gallery/sl-2.jpg',
    tagline: 'Bình sữa hạt 568ml: Hạt Sen và Gạo Lứt',
    productIds: ['sua-hat-sen-lotus', 'sua-gao-lut-ohsawa'],
  },
  {
    slug: 'ciao',
    name: 'Ciao',
    logo: '/images/brands/ciao.png',
    coverImage: '/images/products/gallery/tsa-2.jpg',
    tagline: 'Trà sữa trân châu uống liền: Truyền thống và Matcha',
    productIds: ['tra-sua-ciao', 'matcha-tra-sua-ciao'],
  },
  {
    slug: 'go',
    name: 'Go',
    logo: '/images/brands/go.png',
    coverImage: '/images/banners/banner-feature-tra-sua-go-01.jpg',
    tagline: 'Trà sữa và Trà xanh Go uống liền, chai 330ml',
    productIds: ['tra-sua-go', 'tra-xanh-go'],
  },
];

export function getBrandBySlug(slug: string): Brand | undefined {
  return brands.find((b) => b.slug === slug);
}
