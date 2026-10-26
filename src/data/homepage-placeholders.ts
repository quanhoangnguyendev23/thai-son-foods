import { Banner } from '@/types';

/**
 * DỮ LIỆU MẪU cho các khối trên TRANG CHỦ (bố cục Amazon) mà TSF CHƯA có nghiệp vụ / API thật.
 *
 * Quy ước (giống src/data/product-detail-placeholders.ts):
 *  - Mọi mục trong file này đều là PLACEHOLDER. Giao diện hiển thị nhãn "Bản mẫu · chờ triển khai".
 *  - KHÔNG chứa giá, tồn kho, % khuyến mãi hay đánh giá. Giá/ưu đãi hiển thị cạnh khối placeholder
 *    luôn lấy từ dữ liệu sản phẩm/combo thật (DB → src/data/*).
 *  - Tương tác của khối placeholder chỉ đổi trạng thái giao diện, KHÔNG gọi API, KHÔNG lưu dữ liệu.
 *  - Khi triển khai thật, thay từng mục bằng API tương ứng rồi xoá khỏi file này.
 */

// PLACEHOLDER: chờ triển khai — slide hero bổ sung khi bảng `banners` (placement = 'hero') có ít hơn
// HERO_MIN_SLIDES banner đang bật. Ảnh là ảnh thương hiệu TSF có sẵn trong /public, không chứa giá/khuyến mãi.
// Triển khai thật: admin thêm banner hero tại /admin → khối này tự ngừng dùng.
export const HERO_MIN_SLIDES = 2;
export const HERO_PLACEHOLDER_SLIDES: Banner[] = [
  {
    id: 'placeholder-hero-bottles',
    image: '/images/banners/banner-1920x850-chu-a.jpg',
    alt: 'Thái Sơn Foods - Uống một bữa ăn ngon lành',
    link: '/#san-pham',
    // Ảnh đã có sẵn khẩu hiệu → không chồng thêm tiêu đề, chỉ hiện nút CTA
    title: '',
    objectPosition: '50% 58%',
  },
];

// PLACEHOLDER: chờ triển khai — 2 ô khuyến mãi cạnh banner hero (bố cục bento).
// Triển khai thật: admin thêm banner với Vị trí = "Khuyến mãi / Khác" (placement = 'promo') tại /admin → Banner.
// Khi có ít nhất 1 banner promo đang bật, khối này tự ngừng dùng (lấy tối đa 2 banner promo đầu tiên theo thứ tự).
// Ảnh nên tỉ lệ 4:3 (khuyến nghị 800×600 px) vì ảnh chiếm nửa phải của ô.
// `tag` = nhãn nhỏ phía trên tiêu đề; `ctaLabel` = chữ của liên kết. Không ghi giá/% giảm cố định ở đây:
// % giảm (nếu hiện) được tính từ combo thật.
export const HERO_PROMO_PLACEHOLDER_TILES: Banner[] = [
  {
    id: 'placeholder-promo-deal',
    tag: 'Deal Sốc',
    title: 'Deal trong ngày',
    titleEn: 'Deals of the day',
    subtitle: 'Combo đang giảm giá',
    subtitleEn: 'Combos on sale',
    ctaLabel: 'Xem deal',
    ctaLabelEn: 'See deals',
    image: '/images/combos/combo-6-chai.jpg',
    alt: 'Combo 6 chai thức uống Thái Sơn',
    link: '/#deal-trong-ngay',
    objectPosition: '60% 55%',
  },
  {
    id: 'placeholder-promo-combo',
    tag: 'Combo',
    title: 'Combo tiết kiệm',
    titleEn: 'Value combos',
    subtitle: 'Chọn sẵn cho cả nhà',
    subtitleEn: 'Ready-made for the family',
    ctaLabel: 'Xem combo',
    ctaLabelEn: 'See combos',
    image: '/images/banners/combo-01.jpg',
    alt: 'Combo sữa hạt sen Thái Sơn',
    link: '/#combo',
    objectPosition: '62% 60%',
  },
];

// PLACEHOLDER: 2 ô cạnh hero khi TẮT combo (ENABLE_COMBOS = false trong src/config/features.ts) — không dẫn tới combo.
// Banner admin placement = 'promo' vẫn được ưu tiên hơn khối này.
export const HERO_PROMO_PLACEHOLDER_TILES_NO_COMBO: Banner[] = [
  {
    id: 'placeholder-promo-best-sellers',
    tag: 'Bán chạy',
    title: 'Sản phẩm bán chạy',
    titleEn: 'Best sellers',
    subtitle: 'Được khách chọn nhiều nhất',
    subtitleEn: 'Most loved by our customers',
    ctaLabel: 'Xem ngay',
    ctaLabelEn: 'Shop now',
    image: '/images/products/1200x900-sb.jpg',
    alt: 'Sữa bắp nếp Thái Sơn',
    link: '/#san-pham',
  },
  {
    id: 'placeholder-promo-nut-milk',
    tag: 'Sữa hạt',
    title: 'Sữa hạt Thái Sơn',
    titleEn: 'Thai Son nut milks',
    subtitle: 'Từ nguyên liệu chọn lọc',
    subtitleEn: 'Made from selected ingredients',
    ctaLabel: 'Xem sữa hạt',
    ctaLabelEn: 'See nut milks',
    image: '/images/products/1200x900-shs.jpg',
    alt: 'Sữa hạt sen Thái Sơn',
    link: '/#danh-muc-sua-hat',
  },
];

// PLACEHOLDER: chờ triển khai — "Gợi ý cho bạn" (cần lịch sử xem/mua của khách + thuật toán gợi ý).
// Hiện chỉ là danh sách id sản phẩm cố định; giá/ảnh vẫn lấy từ sản phẩm thật.
export const RECOMMENDED_FOR_YOU_IDS = [
  'tao-do-hat-chia',
  'sua-hat-sen-mekong',
  'matcha-tra-sua-ciao',
  'sam-la-han-hoa-cuc',
  'sua-gao-lut-ohsawa',
  'tra-xanh-go',
  'nha-dam-mu-trom',
  'sua-bap-nep',
];

// PLACEHOLDER: chờ triển khai — "Mua lại" (cần API lịch sử đơn hàng của khách đã đăng nhập,
// ví dụ GET /api/user/orders → gom sản phẩm đã mua). Hiện chỉ là ô trống minh hoạ.
export const BUY_AGAIN_PLACEHOLDER = {
  title: 'Mua lại',
  description: 'Sản phẩm bạn đã mua sẽ hiện ở đây để đặt lại nhanh.',
  slotCount: 4,
  ctaLabel: 'Xem đơn hàng của tôi',
};

// PLACEHOLDER: chờ triển khai — "Deal trong ngày" có đếm ngược (website chưa có nghiệp vụ flash sale
// có thời hạn). Đồng hồ chỉ minh hoạ giao diện, KHÔNG phải thời hạn ưu đãi thật.
// Combo hiển thị trong khối là combo thật với giá/% giảm thật từ DB.
export const DEAL_COUNTDOWN_PLACEHOLDER = {
  title: 'Deal trong ngày',
  note: 'Đồng hồ đếm ngược minh hoạ — chưa áp dụng thời hạn ưu đãi.',
  /** Mốc minh hoạ: đếm tới 23:59:59 hôm nay theo giờ trình duyệt */
  endHour: 23,
  endMinute: 59,
  endSecond: 59,
  comboCount: 6,
};

// PLACEHOLDER: chờ triển khai — sổ địa chỉ giao hàng của khách (Amazon "Deliver to").
// Header mới dùng chi nhánh đang chọn (dữ liệu thật). Dòng phụ dưới đây chỉ là gợi ý giao diện.
export const DELIVER_TO_PLACEHOLDER = {
  guestHint: 'Chọn chi nhánh gần bạn',
};
