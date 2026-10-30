/**
 * THÔNG TIN PHÁP LÝ HIỂN THỊ Ở FOOTER (bắt buộc với website thương mại điện tử bán hàng).
 * Điền đúng theo giấy tờ của doanh nghiệp rồi build/deploy lại. Ô nào để trống ('') thì footer KHÔNG hiển thị ô đó.
 *
 * Link:
 *  - Trang trong website: bắt đầu bằng '/' (ví dụ '/chinh-sach-doi-tra') → mở cùng tab.
 *  - Trang ở website khác: đầy đủ 'https://...' (ví dụ trang chính sách trên thaisonfoods.vn) → mở tab mới.
 */
export const LEGAL_INFO = {
  /** Tên công ty đúng như trên Giấy chứng nhận đăng ký doanh nghiệp, ví dụ 'CÔNG TY TNHH ...' */
  companyName: '',
  /** Mã số thuế / số GCN đăng ký doanh nghiệp */
  taxId: '',
  /** Ngày cấp GCN đăng ký doanh nghiệp (lần đầu), ví dụ '01/01/2015' */
  taxIdIssuedDate: '',
  /** Nơi cấp, ví dụ 'Sở Kế hoạch và Đầu tư TP. Hồ Chí Minh' */
  taxIdIssuedPlace: '',
  /** Địa chỉ trụ sở chính theo giấy phép */
  address: '',
  /** Hotline hiển thị cùng thông tin pháp lý (để trống nếu dùng hotline đang có ở cột "Công ty") */
  hotline: '',
  /** Email liên hệ chính thức (để trống nếu dùng email đang có ở cột "Công ty") */
  email: '',
  links: {
    /** Chính sách đổi trả / hoàn tiền */
    returnPolicy: '',
    /** Chính sách bảo mật thông tin cá nhân */
    privacyPolicy: '',
    /** Điều khoản mua bán / sử dụng */
    terms: '',
    /** Chính sách giao hàng / vận chuyển */
    shippingPolicy: '',
    /** Chính sách thanh toán */
    paymentPolicy: '',
    /** Cơ chế giải quyết khiếu nại */
    complaints: '',
    /** Trang liên hệ */
    contact: '',
    /** Link xác nhận "Đã thông báo Bộ Công Thương" trên online.gov.vn (để trống → không hiện logo) */
    boCongThuong: '',
  },
};

export type LegalLinkKey = keyof typeof LEGAL_INFO.links;

/** Thứ tự và nhãn các link chính sách ở cột "Hỗ trợ" của footer */
export const LEGAL_LINK_LABELS: Array<{ key: Exclude<LegalLinkKey, 'boCongThuong'>; vi: string; en: string }> = [
  { key: 'shippingPolicy', vi: 'Chính sách giao hàng', en: 'Shipping Policy' },
  { key: 'paymentPolicy', vi: 'Chính sách thanh toán', en: 'Payment Policy' },
  { key: 'returnPolicy', vi: 'Chính sách đổi trả', en: 'Return Policy' },
  { key: 'privacyPolicy', vi: 'Chính sách bảo mật', en: 'Privacy Policy' },
  { key: 'terms', vi: 'Điều khoản mua bán', en: 'Terms of Sale' },
  { key: 'complaints', vi: 'Giải quyết khiếu nại', en: 'Complaints' },
  { key: 'contact', vi: 'Liên hệ', en: 'Contact' },
];
