// ===== PRODUCT TYPES =====
export interface Product {
  id: string;
  name: string;
  nameEn?: string;
  slug: string;
  sku: string;
  shortDescription: string;
  shortDescriptionEn?: string;
  description: string;
  descriptionEn?: string;
  price: number;
  originalPrice?: number;
  costPrice?: number;
  cost_price?: number;
  category_name?: string;
  unit: string;
  unitEn?: string;
  categoryId: string;
  thumbnail: string;
  images: ProductImage[];
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  isVegan?: boolean;
  volume?: string;
  imageFit?: 'cover' | 'contain';
  variants?: ProductVariant[];
  featureBanners?: ProductFeatureBanner;
}

export interface ProductFeatureBanner {
  banner1: string;
  /** Banner 2 (infographic) — không bắt buộc; thiếu thì chỉ hiện banner 1 */
  banner2?: string;
  alt1?: string;
  alt2?: string;
  title?: string;
  subtitle?: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  nameEn?: string;
  quantity: number;
  price: number;
  unit: string;
  unitEn?: string;
  volume?: string;
  bottle_multiplier?: number;
  bottleMultiplier?: number;
}

export interface Category {
  id: string;
  name: string;
  nameEn?: string;
  slug: string;
}

// ===== COMBO TYPES =====
export interface Combo {
  id: string;
  name: string;
  nameEn?: string;
  slug: string;
  description: string;
  descriptionEn?: string;
  image: string;
  images?: { id: string; url: string; alt?: string; sortOrder?: number; isPrimary?: boolean }[];
  products: ComboItem[];
  originalPrice: number;
  salePrice: number;
  costPrice?: number;
  cost_price?: number;
  original_price?: number;
  sale_price?: number;
  totalItems: number;
  discount: number;
  isActive: boolean;
}

export interface ComboItem {
  productId: string;
  quantity: number;
}

// ===== CART TYPES =====
export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  price: number;
  unit: string;
  thumbnail: string;
  quantity: number;
  variantId?: string;
  variantName?: string;
  storeCode?: string;
  storeAddress?: string;
}

export interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (product: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (productId: string, variantId?: string) => void;
  increaseQuantity: (productId: string) => void;
  decreaseQuantity: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  getTotalQuantity: () => number;
  getSubtotal: () => number;
  getTotalPrice: () => number;
}

// ===== BANNER TYPES =====
export interface Banner {
  id: string;
  image: string;
  mobileImage?: string;
  alt: string;
  link?: string;
  /** Nội dung chữ (dùng cho Banner Cuộn) */
  tag?: string;
  title?: string;
  subtitle?: string;
  /** 'db' = banner do admin cấu hình; không có = banner mặc định/mẫu trong mã nguồn */
  source?: 'db';
  /** Bản tiếng Anh của tiêu đề / dòng phụ (cột title_en / subtitle_en nếu có) */
  titleEn?: string;
  subtitleEn?: string;
  /** Chữ trên nút CTA của banner (mặc định lấy từ HOMEPAGE_HERO trong src/config/homepage.ts) */
  ctaLabel?: string;
  ctaLabelEn?: string;
  /** Vị trí lấy nét khi ảnh bị cắt (CSS object-position), ví dụ 'center', '30% 50%' */
  objectPosition?: string;
}

// ===== BRAND SHOWCASE TYPES =====
export interface BrandSlide {
  id: string;
  tag: string;
  title: string;
  description: string;
  image: string;
  ctaText: string;
  ctaLink: string;
}

// ===== CHECKOUT TYPES =====
export interface CheckoutForm {
  fullName: string;
  phone: string;
  email: string;
  province: string;
  district: string;
  ward: string;
  address: string;
  note: string;
}

// ===== ORDER TYPES =====
export interface Order {
  id: string;
  items: CartItem[];
  customer: CheckoutForm;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  status: 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled';
  createdAt: string;
}
