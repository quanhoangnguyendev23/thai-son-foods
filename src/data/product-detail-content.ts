import { Product } from '@/types';

/**
 * Nội dung hiển thị trên trang chi tiết sản phẩm (tách khỏi JSX).
 *
 * NGUỒN DỮ LIỆU:
 * - DEFAULT_*: các câu chữ đã có sẵn trong ProductInfo/ProductDescription trước khi tái thiết kế.
 * - Dữ liệu dinh dưỡng / thành phần của Sữa Bắp Nếp: chép nguyên văn từ ảnh nhãn
 *   `/images/products/sua-bap-nep-4.jpg`. Các sản phẩm khác CHƯA có nhãn số hóa
 *   nên để trống — giao diện sẽ hiển thị trạng thái "đang cập nhật" thay vì số liệu ước tính.
 *
 * GIAI ĐOẠN 2/3: các trường này sẽ được thay bằng dữ liệu từ API / Database
 * (xem báo cáo bàn giao). Không tự thêm số liệu dinh dưỡng khi chưa có nhãn thật.
 */

export interface ProductHighlightItem {
  labelVi: string;
  contentVi: string;
  labelEn: string;
  contentEn: string;
}

export interface NutritionRow {
  label: string;
  value: string;
}

export interface ProductDetailContent {
  /** Tên ngắn dùng cho breadcrumb, thẻ gợi ý, thanh mua hàng mobile */
  shortName?: string;
  highlights?: ProductHighlightItem[];
  ingredients?: string;
  usage?: string;
  storage?: string;
  /** Cách đọc NSX/HSD — chỉ hiển thị đúng thông tin in trên bao bì, không suy luận ngày */
  expiry?: string;
  manufacturer?: string;
  origin?: string;
  certification?: string;
  packagingMaterial?: string;
  nutrition?: {
    basis: string;
    rows: NutritionRow[];
    source: string;
  };
  /** Ảnh nhãn thông tin sản phẩm (nếu có) */
  labelImage?: string;
}

const DEFAULT_HIGHLIGHTS: ProductHighlightItem[] = [
  {
    labelVi: 'Chứng nhận HACCP',
    contentVi: 'Quy trình sản xuất thanh trùng khép kín, kiểm soát an toàn vệ sinh thực phẩm.',
    labelEn: 'HACCP certified',
    contentEn: 'Closed pasteurization process with strict food safety control.',
  },
  {
    labelVi: 'Nguyên liệu tuyển chọn',
    contentVi: 'Chế biến từ nguồn nguyên liệu tự nhiên tươi ngon, giữ hương vị thanh thuần.',
    labelEn: 'Selected ingredients',
    contentEn: 'Made from fresh natural ingredients, retaining an authentic flavor.',
  },
  {
    labelVi: 'Tiện lợi uống liền',
    contentVi: 'Đóng chai sẵn, lấy từ ngăn mát là dùng ngay cho bữa phụ hoặc giải khát.',
    labelEn: 'Ready to drink',
    contentEn: 'Bottled and ready to enjoy straight from the fridge.',
  },
];

export const DEFAULT_PRODUCT_DETAIL: Required<
  Pick<ProductDetailContent, 'usage' | 'storage' | 'expiry' | 'origin' | 'certification' | 'packagingMaterial'>
> & { highlights: ProductHighlightItem[] } = {
  highlights: DEFAULT_HIGHLIGHTS,
  usage: 'Lắc đều trước khi uống. Sử dụng trong 24 giờ sau khi mở nắp, giữ lạnh sản phẩm trong quá trình sử dụng.',
  storage: 'Bảo quản ở nhiệt độ 5 - 10°C trong ngăn mát tủ lạnh.',
  expiry: 'Ngày sản xuất và hạn sử dụng được in trên bao bì/nắp chai của từng sản phẩm.',
  origin: 'Việt Nam',
  certification: 'HACCP',
  packagingMaterial: 'Chai nhựa nguyên sinh an toàn thực phẩm, có thể tái chế',
};

/**
 * Thông tin người bán hiển thị trong Buy Box.
 * Phương thức thanh toán lấy theo trang /thanh-toan hiện tại (paymentMethod = 'cod').
 */
export const STORE_SALES_INFO = {
  seller: 'Thái Sơn Foods',
  paymentVi: 'Tiền mặt khi nhận hàng (COD)',
  paymentEn: 'Cash on Delivery (COD)',
};

const PRODUCT_DETAIL_CONTENT: Record<string, ProductDetailContent> = {
  'sua-bap-nep': {
    shortName: 'Sữa Bắp Nếp Thái Sơn',
    highlights: [
      {
        labelVi: 'Chứng nhận HACCP',
        contentVi: 'Quy trình sản xuất thanh trùng khép kín, kiểm soát an toàn vệ sinh thực phẩm.',
        labelEn: 'HACCP certified',
        contentEn: 'Closed pasteurization process with strict food safety control.',
      },
      {
        labelVi: 'Thành phần tự nhiên',
        contentVi: 'Thành phần chính là sữa bắp từ bắp tươi, bắp ngọt và bắp nếp.',
        labelEn: 'Natural ingredients',
        contentEn: 'Made mainly from corn milk from fresh, sweet and glutinous corn.',
      },
      {
        labelVi: '31 kcal / 100ml',
        contentVi: 'Thức uống nhẹ, phù hợp làm bữa phụ hoặc giải khát hằng ngày.',
        labelEn: '31 kcal / 100ml',
        contentEn: 'A light drink for snacks or daily refreshment.',
      },
    ],
    ingredients:
      'Dịch trích từ bắp tươi (98%), nước, bắp ngọt (140 g/l), bắp nếp (20 g/l), bột kem không sữa (30 g/l), đường, chất ổn định (466, 1422), chất tạo ngọt tổng hợp (950, 951), chất bảo quản (200, 211), hương liệu bắp tổng hợp, màu thực phẩm tổng hợp (102, 110).',
    usage: 'Lắc đều trước khi uống. Sử dụng trong 24 giờ sau khi mở nắp, giữ lạnh sản phẩm trong quá trình sử dụng.',
    storage: 'Bảo quản ở nhiệt độ 5 - 10°C.',
    expiry: 'NSX - HSD: xem trên bao bì sản phẩm.',
    manufacturer: 'Sản xuất tại chi nhánh Công ty TNHH Thực Phẩm Thái Sơn',
    nutrition: {
      basis: 'Giá trị dinh dưỡng trung bình trong 100ml',
      rows: [
        { label: 'Năng lượng', value: '31 kcal' },
        { label: 'Carbohydrat', value: '5,5 g' },
        { label: 'Chất béo', value: '0,92 g' },
        { label: 'Natri', value: '12 mg' },
        { label: 'Đường tổng', value: '3,42 g' },
      ],
      source: 'Theo nhãn sản phẩm. Thể tích thực ở 20°C: 330ml.',
    },
    labelImage: '/images/products/sua-bap-nep-4.jpg',
  },
  'sua-hat-sen-mekong': { shortName: 'Sữa Hạt Sen Mekong Xanh' },
  'sua-gao-lut-mekong': { shortName: 'Sữa Gạo Lứt Mekong Xanh' },
  'sua-hat-sen-lotus': { shortName: 'Bình Sữa Hạt Sen Yoo 568ml' },
  'sua-gao-lut-ohsawa': { shortName: 'Bình Sữa Gạo Lứt Yoo 568ml' },
  // Tên sản phẩm (dữ liệu doanh nghiệp) ghi "Bảo quản lạnh 2 - 5°C" — cần doanh nghiệp xác nhận lại
  'nha-dam-mu-trom': { shortName: 'Nha Đam Mủ Trôm Thái Sơn', storage: 'Bảo quản lạnh 2 - 5°C.' },
  'tao-do-hat-chia': { shortName: 'Táo Đỏ Hạt Chia Thái Sơn' },
  'sam-la-han-hoa-cuc': { shortName: 'Sâm La Hán Hoa Cúc Thái Sơn' },
  'tra-sua-ciao': { shortName: 'Trà Sữa Ciao' },
  'matcha-tra-sua-ciao': { shortName: 'Matcha Trà Sữa Ciao' },
  'tra-sua-go': { shortName: 'Trà Sữa Go' },
  'tra-xanh-go': { shortName: 'Trà Xanh Go' },
};

/** Ánh xạ slug → id để dữ liệu DB (đôi khi chỉ khớp slug) vẫn tìm được nội dung */
const SLUG_TO_ID: Record<string, string> = {
  'sua-bap-nep-thai-son': 'sua-bap-nep',
  'sua-hat-sen-mekong-xanh': 'sua-hat-sen-mekong',
  'sua-gao-lut-mekong-xanh': 'sua-gao-lut-mekong',
  'sua-hat-sen-lotus-yoo': 'sua-hat-sen-lotus',
  'sua-gao-lut-ohsawa-yoo': 'sua-gao-lut-ohsawa',
  'nha-dam-mu-trom-thai-son': 'nha-dam-mu-trom',
  'tao-do-hat-chia-thai-son': 'tao-do-hat-chia',
  'sam-la-han-hoa-cuc-thai-son': 'sam-la-han-hoa-cuc',
};

/** Các trường chữ admin chỉnh được (cột products.detail_content) */
export const DETAIL_TEXT_FIELDS = [
  'ingredients',
  'usage',
  'storage',
  'expiry',
  'manufacturer',
  'origin',
  'certification',
  'packagingMaterial',
  'labelImage',
] as const;

/**
 * Gộp nội dung admin nhập (CSDL) lên nội dung trong code: trường có giá trị trong CSDL được dùng, trường trống giữ
 * nội dung code (rồi tới DEFAULT_PRODUCT_DETAIL ở nơi hiển thị). Điểm nổi bật / dinh dưỡng thay nguyên khối khi có dữ liệu.
 */
export function mergeProductDetailContent(
  base: ProductDetailContent,
  override: ProductDetailContent | null | undefined
): ProductDetailContent {
  if (!override) return base;
  const out: ProductDetailContent = { ...base };
  for (const key of DETAIL_TEXT_FIELDS) {
    const v = override[key];
    if (typeof v === 'string' && v.trim()) out[key] = v;
  }
  if (Array.isArray(override.highlights) && override.highlights.length > 0) out.highlights = override.highlights;
  if (override.nutrition && Array.isArray(override.nutrition.rows) && override.nutrition.rows.length > 0) {
    out.nutrition = override.nutrition;
  }
  return out;
}

export function getProductDetailContent(product: Pick<Product, 'id' | 'slug'>): ProductDetailContent {
  return (
    PRODUCT_DETAIL_CONTENT[product.id] ||
    PRODUCT_DETAIL_CONTENT[SLUG_TO_ID[product.slug] || ''] ||
    PRODUCT_DETAIL_CONTENT[product.slug] ||
    {}
  );
}
