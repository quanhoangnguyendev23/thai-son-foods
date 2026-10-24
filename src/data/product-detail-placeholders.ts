/**
 * DỮ LIỆU MẪU cho các khối trên trang chi tiết sản phẩm (bố cục mới) mà TSF CHƯA có nghiệp vụ / API thật.
 *
 * Quy ước:
 *  - Mọi mục trong file này đều là PLACEHOLDER. Giao diện hiển thị nhãn "Bản mẫu" cạnh khối tương ứng.
 *  - Tương tác của khối placeholder chỉ thay đổi trạng thái giao diện, KHÔNG gọi API,
 *    KHÔNG lưu dữ liệu, KHÔNG báo đặt hàng / gửi câu hỏi thành công.
 *  - Khi triển khai thật (Giai đoạn 2/3), thay từng mục bằng API tương ứng và xoá khỏi file này.
 */

/**
 * CÔNG TẮC GO-LIVE: các khối "Bản mẫu" (đồng hồ deal, mã giảm giá, đã mua trong tháng, hỏi đáp, yêu thích, mua lại...)
 * mặc định ẨN với khách hàng. Chỉ bật khi xem demo nội bộ: NEXT_PUBLIC_SHOW_PLACEHOLDERS=true.
 */
export const SHOW_PLACEHOLDER_BLOCKS = process.env.NEXT_PUBLIC_SHOW_PLACEHOLDERS === 'true';

export const PLACEHOLDER_LABEL = 'Bản mẫu · chờ triển khai';

// PLACEHOLDER: chờ triển khai — số lượt mua tháng trước (cần thống kê đơn hàng thật theo sản phẩm)
export const MONTHLY_SALES_PLACEHOLDER = {
  text: 'Hơn 200 sản phẩm đã được mua trong tháng trước',
};

// PLACEHOLDER: chờ triển khai — mã giảm giá (website chưa có nghiệp vụ coupon ở giỏ hàng / thanh toán)
export const COUPON_PLACEHOLDER = {
  badge: 'Mã giảm giá',
  title: 'Tiết kiệm 5%',
  description: 'Mã giảm giá chỉ áp dụng cho tùy chọn mua hàng trực tiếp website.',
  termsLabel: 'Điều khoản',
  termsText: 'Điều kiện áp dụng mã giảm giá sẽ được cập nhật khi chương trình chính thức triển khai.',
};

// PLACEHOLDER: chờ triển khai — sổ địa chỉ giao hàng (cần API địa chỉ của tài khoản khách)
export const DELIVERY_ADDRESS_PLACEHOLDERS = [
  { id: 'addr-1', label: 'Nhà riêng', line: 'Phường Phú Thọ Hòa, Quận Tân Phú, TP. Hồ Chí Minh' },
  { id: 'addr-2', label: 'Văn phòng', line: 'Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh' },
  { id: 'addr-3', label: 'Nhà người thân', line: 'Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh' },
];

// PLACEHOLDER: chờ triển khai — chính sách đổi trả (doanh nghiệp chưa công bố trên website)
export const RETURN_POLICY_PLACEHOLDER = {
  title: 'Chính sách đổi trả',
  text: 'Nội dung chính sách đổi trả đang chờ doanh nghiệp xác nhận.',
};

// PLACEHOLDER: chờ triển khai — "Khách hàng cũng xem" (cần dữ liệu hành vi xem sản phẩm thật)
export const CUSTOMERS_ALSO_VIEWED_IDS = [
  'tra-sua-ciao',
  'nha-dam-mu-trom',
  'sua-hat-sen-lotus',
  'tao-do-hat-chia',
  'matcha-tra-sua-ciao',
  'sam-la-han-hoa-cuc',
  'tra-xanh-go',
  'sua-gao-lut-ohsawa',
];

// PLACEHOLDER: chờ triển khai — Hỏi & đáp sản phẩm (cần API câu hỏi/trả lời + kiểm duyệt)
export const PRODUCT_QA_PLACEHOLDERS = [
  {
    id: 'qa-1',
    question: 'Sản phẩm có cần bảo quản lạnh sau khi mua không?',
    answer: 'Câu trả lời mẫu: nội dung sẽ được bộ phận chăm sóc khách hàng cập nhật.',
    answeredBy: 'Thái Sơn Foods',
    dateLabel: 'Ngày mẫu',
  },
  {
    id: 'qa-2',
    question: 'Một lốc có thể giao trong ngày tại TP. Hồ Chí Minh không?',
    answer: 'Câu trả lời mẫu: nội dung sẽ được bộ phận chăm sóc khách hàng cập nhật.',
    answeredBy: 'Thái Sơn Foods',
    dateLabel: 'Ngày mẫu',
  },
  {
    id: 'qa-3',
    question: 'Trẻ nhỏ có dùng được sản phẩm này không?',
    answer: 'Câu trả lời mẫu: nội dung sẽ được bộ phận chăm sóc khách hàng cập nhật.',
    answeredBy: 'Thái Sơn Foods',
    dateLabel: 'Ngày mẫu',
  },
];

// PLACEHOLDER: chờ triển khai — ảnh khách hàng đính kèm đánh giá (hệ thống đánh giá chưa hỗ trợ upload ảnh)
export const REVIEW_IMAGE_PLACEHOLDER_COUNT = 6;

// PLACEHOLDER: chờ triển khai — đặt trước, chọn ngày giao trong 1-3 ngày tới.
// Cần: hạn mức nhận đơn theo ngày/chi nhánh, cột ngày giao trên đơn, giờ chốt đơn, màn hình kế hoạch sản xuất.
// Số suất bên dưới chỉ để minh họa các trạng thái (còn nhiều / còn ít / đã đủ suất).
export const PREORDER_PLACEHOLDER = {
  title: 'Chọn cách nhận hàng',
  nowLabel: 'Giao hôm nay',
  nowHint: 'Từ hàng sẵn tại chi nhánh',
  preorderLabel: 'Đặt trước',
  preorderHint: 'Chọn ngày giao trong 3 ngày tới',
  cutOffText: 'Đặt trước 15:00 để kịp sản xuất cho ngày giao.',
  quotaNote: 'Số lượng mua sẽ giới hạn theo số suất còn lại của ngày giao đã chọn.',
  footnote: 'Giao diện minh họa: chưa kết nối hạn mức, không ảnh hưởng giỏ hàng và đơn hàng.',
  lowThreshold: 20,
  days: [
    { offset: 1, remaining: 120 },
    { offset: 2, remaining: 12 },
    { offset: 3, remaining: 0 },
  ],
};
