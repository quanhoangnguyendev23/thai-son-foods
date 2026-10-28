import { formatPrice } from '@/lib/utils';

/** Escape mọi giá trị động trước khi chèn vào HTML email (chống chèn thẻ/script từ dữ liệu khách nhập). */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface OrderEmailItem {
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  thumbnail?: string | null;
}

export interface OrderEmailData {
  id?: string;
  orderCode: string;
  fullName: string;
  phone: string;
  email?: string | null;
  address: string;
  province?: string;
  district?: string;
  ward?: string;
  paymentMethod?: string;
  shippingFee: number;
  subtotal: number;
  total: number;
  note?: string | null;
  storeCode?: string | null;
  storeAddress?: string | null;
  items: OrderEmailItem[];
  createdAt?: Date | string;
}

export interface ShippingExtraInfo {
  shipperName?: string;
  shipperPhone?: string;
  storePhone?: string;
  storeAddress?: string;
  estimatedDeliveryTime?: string;
}

interface WrapEmailOptions {
  title: string;
  preheader: string;
  content: string;
  logoSrc?: string;
}

// ─── BASE LAYOUT HELPER ───
function wrapEmailLayout({
  title,
  preheader,
  content,
  logoSrc = '/images/logo-clean-1000.png',
}: WrapEmailOptions): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #FAF7F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: auto !important; }
      .fluid { max-width: 100% !important; height: auto !important; margin-left: auto !important; margin-right: auto !important; }
      .stack-column, .stack-column-center { display: block !important; width: 100% !important; max-width: 100% !important; direction: ltr !important; }
      .mobile-padding { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF7F0; color: #315B56;">
  <!-- Preheader text (invisible preview text in email client inbox) -->
  <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ${preheader}
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAF7F0;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <!-- Container 620px -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #DEE7E6; box-shadow: 0 4px 20px rgba(34,84,76,0.04);" class="email-container">
          
          <!-- ─── HEADER THƯƠNG HIỆU (LOGO CHÍNH THỨC THÁI SƠN FOODS) ─── -->
          <tr>
            <td style="background: linear-gradient(135deg, #1F5048 0%, #22544C 100%); padding: 26px 20px; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <!-- Khung Logo Trắng Nổi Bật Thái Sơn Foods -->
                    <div style="display: inline-block; background-color: #ffffff; padding: 12px 28px 10px 28px; border-radius: 18px; margin-bottom: 12px; box-shadow: 0 4px 16px rgba(34,84,76,0.12);">
                      <img src="${escapeHtml(logoSrc)}" alt="Thái Sơn Foods - Món ngon quê Việt" width="220" style="display: block; width: 220px; max-width: 100%; height: auto; margin: 0 auto; border: 0;" />
                    </div>
                    <div style="color: #F0F5F2; font-size: 13px; font-weight: 400; letter-spacing: 1.5px; text-transform: uppercase;">
                      Món Ngon Quê Việt • Đồ Uống Tươi Dinh Dưỡng
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ─── NỘI DUNG CHÍNH ─── -->
          <tr>
            <td style="padding: 28px 24px;" class="mobile-padding">
              ${content}
            </td>
          </tr>

          <!-- ─── FOOTER LIÊN HỆ & BẢO QUẢN ─── -->
          <tr>
            <td style="background-color: #F0F5F2; padding: 24px; border-top: 1px solid #EEF3F3; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="font-size: 13px; color: #40645F; line-height: 1.6;">
                    <strong style="font-weight: 400; font-size: 1.125em; color: #27534D;">CÔNG TY TNHH THỰC PHẨM THÁI SƠN (THÁI SƠN FOODS)</strong><br>
                    Hotline CSKH / Giao nhanh: <strong style="font-weight: 400; font-size: 1.125em; color: #1F5048;">028 6291 5024</strong> • Email: <a href="mailto:cskh@thaisonfoods.vn" style="color: #1F5048; text-decoration: none;">cskh@thaisonfoods.vn</a><br>
                    Website: <a href="https://thaisonfoods.vn" style="color: #1F5048; text-decoration: none; font-weight: 400; font-size: 1.125em;">thaisonfoods.vn</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 14px; font-size: 11px; color: #98AEAB; line-height: 1.4;">
                    Email này được gửi tự động từ hệ thống quản lý đơn hàng Thái Sơn Foods.<br>
                    Nếu quý khách có bất kỳ câu hỏi nào, vui lòng liên hệ hotline hỗ trợ của chúng tôi (07:00–21:30 hằng ngày).
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── HELPER FORMAT ITEMS TABLE ───
function renderItemsTable(items: OrderEmailItem[]): string {
  const rows = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #EEF3F3; font-size: 13px; color: #315B56;">
        <strong style="font-weight: 400; color: #27534D; display: block; font-size: 15.5px;">${escapeHtml(item.name)}</strong>
        <span style="font-size: 11.5px; color: #6F908C;">Quy cách: ${escapeHtml(item.unit || '1 chai')}</span>
      </td>
      <td align="center" style="padding: 12px 8px; border-bottom: 1px solid #EEF3F3; font-size: 15px; color: #40645F; font-weight: 400;">
        x${escapeHtml(item.quantity)}
      </td>
      <td align="right" style="padding: 12px 0; border-bottom: 1px solid #EEF3F3; font-size: 15px; color: #22544C; font-weight: 400;">
        ${formatPrice(item.price * item.quantity)}đ
      </td>
    </tr>
  `
    )
    .join('');

  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 12px; margin-bottom: 16px;">
      <thead>
        <tr style="border-bottom: 2px solid #DEE7E6;">
          <th align="left" style="padding-bottom: 8px; font-size: 12px; font-weight: 400; text-transform: uppercase; color: #6F908C; letter-spacing: 0.5px;">Sản phẩm</th>
          <th align="center" style="padding-bottom: 8px; font-size: 12px; font-weight: 400; text-transform: uppercase; color: #6F908C; letter-spacing: 0.5px; width: 60px;">SL</th>
          <th align="right" style="padding-bottom: 8px; font-size: 12px; font-weight: 400; text-transform: uppercase; color: #6F908C; letter-spacing: 0.5px; width: 100px;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// ════════════════════════════════════════════════════════════════════════
// 1. GỬI MAIL KHÁCH: "XÁC NHẬN ĐÃ NHẬN ĐƠN #DH..."
// ════════════════════════════════════════════════════════════════════════
export function renderOrderConfirmationEmail(
  order: OrderEmailData,
  options?: { logoSrc?: string }
): {
  subject: string;
  html: string;
} {
  const subject = `[Thái Sơn Foods] Xác nhận đã nhận đơn hàng #${order.orderCode}`;
  const preheader = `Cảm ơn bạn! Đơn hàng #${escapeHtml(order.orderCode)} trị giá ${formatPrice(order.total)}đ đã được tiếp nhận và đang chuẩn bị giao.`;

  const fullAddress = [order.address, order.ward, order.district, order.province]
    .filter(Boolean)
    .join(', ');

  const paymentMethodLabel =
    order.paymentMethod === 'bank_transfer'
      ? 'Chuyển khoản QR ngân hàng'
      : 'Thanh toán tiền mặt khi nhận hàng (COD)';

  const content = `
    <!-- Lời chào & Trạng thái đơn -->
    <div style="margin-bottom: 20px;">
      <div style="display: inline-block; background-color: #F0F5F2; border: 1px solid #C1D6CB; color: #22544C; font-size: 12.5px; font-weight: 400; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; margin-bottom: 12px;">
        ✓ Đơn hàng đã tiếp nhận
      </div>
      <h1 style="font-size: 22px; font-weight: 400; color: #27534D; margin: 0 0 8px 0; line-height: 1.3;">
        Cảm ơn quý khách, ${escapeHtml(order.fullName)}!
      </h1>
      <p style="font-size: 13.5px; color: #40645F; line-height: 1.6; margin: 0;">
        Đơn hàng <strong style="font-weight: 400; font-size: 1.125em; color: #1F5048;">#${escapeHtml(order.orderCode)}</strong> của bạn đã được ghi nhận trên hệ thống. Đội ngũ cửa hàng Thái Sơn Foods đang tiến hành kiểm tra kho và đóng gói đồ uống tươi mát để giao đến bạn sớm nhất.
      </p>
    </div>

    <!-- Hộp thông tin giao hàng & người nhận -->
    <div style="background-color: #F0F5F2; border: 1px solid #DEE7E6; border-radius: 14px; padding: 16px; margin-bottom: 20px;">
      <div style="font-size: 13px; font-weight: 400; color: #1F5048; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
        Thông tin nhận hàng
      </div>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 1.6; color: #315B56;">
        <tr>
          <td style="width: 110px; color: #6F908C; vertical-align: top;">Người nhận:</td>
          <td><strong style="font-weight: 400; font-size: 1.125em;">${escapeHtml(order.fullName)}</strong> - ${escapeHtml(order.phone)}</td>
        </tr>
        <tr>
          <td style="color: #6F908C; vertical-align: top;">Địa chỉ giao:</td>
          <td>${escapeHtml(fullAddress)}</td>
        </tr>
        <tr>
          <td style="color: #6F908C; vertical-align: top;">Thanh toán:</td>
          <td><strong style="font-weight: 400; font-size: 1.125em;">${paymentMethodLabel}</strong></td>
        </tr>
        ${
          order.note
            ? `<tr>
                <td style="color: #6F908C; vertical-align: top;">Ghi chú:</td>
                <td style="color: #C3183C; font-style: italic;">${escapeHtml(order.note)}</td>
              </tr>`
            : ''
        }
      </table>
    </div>

    <!-- Danh sách sản phẩm -->
    <div style="margin-bottom: 20px;">
      <div style="font-size: 15px; font-weight: 400; color: #27534D; text-transform: uppercase; letter-spacing: 0.5px;">
        Chi tiết sản phẩm đã chọn
      </div>
      ${renderItemsTable(order.items)}

      <!-- Tóm tắt chi phí -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 1.7; border-top: 1px dashed #C5D3D1; padding-top: 10px;">
        <tr>
          <td style="color: #6F908C;">Tạm tính tiền hàng:</td>
          <td align="right" style="font-weight: 400; color: #315B56; font-size: 1.125em;">${formatPrice(order.subtotal)}đ</td>
        </tr>
        <tr>
          <td style="color: #6F908C;">Phí vận chuyển:</td>
          <td align="right" style="font-weight: 400; font-size: 1.125em;">
            ${
              order.shippingFee === 0
                ? '<span style="color: #22544C; font-weight: 400; background-color: #F0F5F2; padding: 2px 6px; border-radius: 4px; font-size: 12px;">FREESHIP</span>'
                : `${formatPrice(order.shippingFee)}đ`
            }
          </td>
        </tr>
        <tr>
          <td style="font-size: 17px; font-weight: 400; color: #27534D; padding-top: 6px;">Tổng thanh toán:</td>
          <td align="right" style="font-size: 20px; font-weight: 400; color: #1F5048; padding-top: 6px;">${formatPrice(order.total)}đ</td>
        </tr>
      </table>
    </div>

    <!-- Lưu ý nhận hàng quan trọng -->
    <div style="background-color: #FAF7F0; border-left: 4px solid #A86523; padding: 14px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <div style="font-size: 14.5px; font-weight: 400; color: #82422D; margin-bottom: 4px;">
        Lưu ý quan trọng khi nhận hàng:
      </div>
      <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #7E4330; line-height: 1.6;">
        <li>Đơn hàng được giao nhanh trong vòng <strong style="font-weight: 400; font-size: 1.125em;">2 - 4 giờ</strong> khu vực nội thành TP.HCM.</li>
        <li>Tài xế/Shipper sẽ gọi điện trước khi đến, quý khách vui lòng <strong style="font-weight: 400; font-size: 1.125em;">để ý điện thoại</strong>.</li>
        <li>Đồ uống được ướp lạnh tự nhiên. Quý khách vui lòng <strong style="font-weight: 400; font-size: 1.125em;">bảo quản vào tủ mát (2°C - 5°C)</strong> ngay khi nhận để giữ hương vị tươi ngon nhất.</li>
      </ul>
    </div>
  `;

  return { subject, html: wrapEmailLayout({ title: subject, preheader, content, logoSrc: options?.logoSrc }) };
}

// ════════════════════════════════════════════════════════════════════════
// 2. GỬI MAIL KHÁCH: "ĐƠN HÀNG ĐANG TRÊN ĐƯỜNG GIAO ĐẾN BẠN"
// ════════════════════════════════════════════════════════════════════════
export function renderOrderShippingEmail(
  order: OrderEmailData,
  shippingInfo?: ShippingExtraInfo,
  options?: { logoSrc?: string }
): {
  subject: string;
  html: string;
} {
  const subject = `[Thái Sơn Foods] Đơn hàng #${order.orderCode} đang trên đường giao đến bạn!`;
  const preheader = `Shipper đang mang đồ uống ướp lạnh đến địa chỉ của bạn. Dự kiến giao trong 30-60 phút.`;

  const shipperPhone = shippingInfo?.shipperPhone || '0961 888 888';
  const shipperName = shippingInfo?.shipperName || 'Đội ngũ giao hàng Thái Sơn Foods';
  const storeAddress = shippingInfo?.storeAddress || order.storeAddress || 'Chi nhánh Thái Sơn Foods TP.HCM';

  const fullAddress = [order.address, order.ward, order.district, order.province]
    .filter(Boolean)
    .join(', ');

  const content = `
    <!-- Lời chào & Trạng thái đang giao -->
    <div style="margin-bottom: 20px;">
      <div style="display: inline-block; background-color: #F0F5F2; border: 1px solid #C1CFCD; color: #357A54; font-size: 12.5px; font-weight: 400; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; margin-bottom: 12px;">
        Đang trên đường giao hàng
      </div>
      <h1 style="font-size: 22px; font-weight: 400; color: #27534D; margin: 0 0 8px 0; line-height: 1.3;">
        Đồ uống tươi mát đang trên đường đến bạn!
      </h1>
      <p style="font-size: 13.5px; color: #40645F; line-height: 1.6; margin: 0;">
        Chào <strong style="font-weight: 400; font-size: 1.125em;">${escapeHtml(order.fullName)}</strong>, đơn hàng <strong style="font-weight: 400; font-size: 1.125em; color: #1F5048;">#${escapeHtml(order.orderCode)}</strong> đã được xuất kho và giao cho nhân viên vận chuyển. Bạn hãy chuẩn bị nghe điện thoại nhận hàng nhé!
      </p>
    </div>

    <!-- Hộp thông tin Shipper & Tài xế -->
    <div style="background: linear-gradient(135deg, #F0F5F2 0%, #F0F5F2 100%); border: 1px solid #E0EBE5; border-radius: 14px; padding: 18px; margin-bottom: 20px;">
      <div style="font-size: 13px; font-weight: 400; color: #22544C; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
        Thông tin vận chuyển
      </div>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 1.7; color: #1F5048;">
        <tr>
          <td style="width: 120px; color: #34625A;">Người giao hàng:</td>
          <td><strong style="font-weight: 400; font-size: 1.125em;">${escapeHtml(shipperName)}</strong></td>
        </tr>
        <tr>
          <td style="color: #34625A;">Số điện thoại:</td>
          <td>
            <a href="tel:${escapeHtml(shipperPhone)}" style="color: #1F5048; font-weight: 400; text-decoration: none; background-color: #ffffff; padding: 2px 8px; border-radius: 6px; border: 1px solid #9CBEAB; font-size: 1.125em;">
              ${escapeHtml(shipperPhone)}
            </a>
          </td>
        </tr>
        <tr>
          <td style="color: #34625A;">Cửa hàng xuất:</td>
          <td>${escapeHtml(storeAddress)}</td>
        </tr>
        <tr>
          <td style="color: #34625A;">Giao đến:</td>
          <td><strong style="font-weight: 400; font-size: 1.125em;">${escapeHtml(fullAddress)}</strong></td>
        </tr>
      </table>
    </div>

    <!-- Tóm tắt số tiền thu hộ -->
    <div style="background-color: #F0F5F2; border: 1px solid #DEE7E6; border-radius: 14px; padding: 16px; margin-bottom: 20px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13.5px;">
        <tr>
          <td style="color: #40645F;">Hình thức thanh toán:</td>
          <td align="right" style="font-weight: 400; color: #27534D; font-size: 1.125em;">
            ${order.paymentMethod === 'bank_transfer' ? 'Đã chuyển khoản QR' : 'Tiền mặt khi nhận (COD)'}
          </td>
        </tr>
        <tr>
          <td style="font-size: 17px; font-weight: 400; color: #27534D; padding-top: 6px;">
            ${order.paymentMethod === 'bank_transfer' ? 'Số tiền đã thanh toán:' : 'Số tiền shipper thu:'}
          </td>
          <td align="right" style="font-size: 20px; font-weight: 400; color: #1F5048; padding-top: 6px;">
            ${formatPrice(order.total)}đ
          </td>
        </tr>
      </table>
    </div>

    <!-- Danh sách món tóm tắt -->
    <div style="margin-bottom: 20px;">
      <div style="font-size: 14.5px; font-weight: 400; color: #6F908C; margin-bottom: 8px;">
        Danh sách ${order.items.length} món trong đơn:
      </div>
      <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; color: #40645F; line-height: 1.6;">
        ${order.items.map((i) => `<li><strong style="font-weight: 400; font-size: 1.125em;">${escapeHtml(i.name)}</strong> (x${escapeHtml(i.quantity)}) - ${formatPrice(i.price * i.quantity)}đ</li>`).join('')}
      </ul>
    </div>

    <!-- Nhắc nhở bảo quản thùng giữ nhiệt -->
    <div style="background-color: #F0F5F2; border: 1px solid #E0EBE5; border-radius: 12px; padding: 14px; margin-bottom: 20px; font-size: 12.5px; color: #4B8866; line-height: 1.5;">
      <em>Sản phẩm được bảo quản trong túi giữ nhiệt chuyên dụng để đảm bảo độ lạnh sâu. Sau khi nhận, quý khách hãy cho vào tủ lạnh ngay nhé!</em>
    </div>
  `;

  return { subject, html: wrapEmailLayout({ title: subject, preheader, content, logoSrc: options?.logoSrc }) };
}

// ════════════════════════════════════════════════════════════════════════
// 3. GỬI MAIL KHÁCH: "CẢM ƠN & HƯỚNG DẪN BẢO QUẢN ĐỒ UỐNG TƯƠI"
// ════════════════════════════════════════════════════════════════════════
export function renderOrderCompletedEmail(
  order: OrderEmailData,
  options?: { logoSrc?: string }
): {
  subject: string;
  html: string;
} {
  const subject = `[Thái Sơn Foods] Cảm ơn bạn & Hướng dẫn bảo quản đồ uống tươi ngon #${order.orderCode}`;
  const preheader = `Cảm ơn bạn đã nhận hàng! Hãy xem ngay 4 mẹo bảo quản đồ uống tươi mát chuẩn vị quê Việt.`;

  const content = `
    <!-- Lời cảm ơn & Hoàn tất -->
    <div style="margin-bottom: 22px; text-align: center;">
      <div style="display: inline-block; background-color: #F0F5F2; border: 1px solid #C1D6CB; color: #22544C; font-size: 12.5px; font-weight: 400; padding: 4px 14px; border-radius: 20px; text-transform: uppercase; margin-bottom: 12px;">
        ✓ Giao hàng thành công
      </div>
      <h1 style="font-size: 24px; font-weight: 400; color: #1F5048; margin: 0 0 10px 0; line-height: 1.3;">
        Cảm ơn bạn đã tin chọn Thái Sơn Foods!
      </h1>
      <p style="font-size: 13.5px; color: #40645F; line-height: 1.6; margin: 0 auto; max-width: 480px;">
        Đơn hàng <strong style="font-weight: 400; font-size: 1.125em;">#${escapeHtml(order.orderCode)}</strong> đã được giao thành công đến bạn. Đội ngũ Thái Sơn Foods hy vọng bạn sẽ có những phút giây thưởng thức đồ uống mát lành, tràn đầy năng lượng cùng gia đình!
      </p>
    </div>

    <!-- ─── CẨM NANG BẢO QUẢN ĐỒ UỐNG TƯƠI (HÀNG DATE NGẮN) ─── -->
    <div style="background-color: #FFFFFF; border: 2px solid #1F5048; border-radius: 16px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0, 90, 52, 0.06);">
      <div style="text-align: center; margin-bottom: 14px;">
        <span style="font-size: 18px; font-weight: 400; color: #1F5048; text-transform: uppercase; letter-spacing: 0.5px;">
          HƯỚNG DẪN BẢO QUẢN ĐỒ UỐNG TƯƠI
        </span>
        <div style="font-size: 11.5px; color: #6F908C; margin-top: 3px;">
          (Do đồ uống Thái Sơn 100% nguyên liệu tự nhiên - không chất bảo quản)
        </div>
      </div>

      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 1.6; color: #315B56;">
        <tr>
          <td style="padding-bottom: 14px;">
            <strong style="font-weight: 400; font-size: 1.125em; color: #27534D;">1. Bảo quản lạnh ngay (2°C - 5°C):</strong><br>
            <span style="color: #40645F;">Hãy xếp chai vào <strong style="font-weight: 400; font-size: 1.125em;">ngăn mát tủ lạnh ngay sau khi nhận</strong>. Không để sản phẩm ở nhiệt độ phòng hoặc nơi có ánh nắng trực tiếp.</span>
          </td>
        </tr>

        <tr>
          <td style="padding-bottom: 14px;">
            <strong style="font-weight: 400; font-size: 1.125em; color: #27534D;">2. Thời hạn dùng ngon nhất:</strong><br>
            <span style="color: #40645F;">Khuyên dùng ngon nhất trong vòng <strong style="font-weight: 400; font-size: 1.125em;">24 - 48 giờ</strong> sau khi mở nắp để cảm nhận trọn vẹn hương vị thanh ngọt tự nhiên của bắp tươi, hạt sen, gạo lứt.</span>
          </td>
        </tr>

        <tr>
          <td style="padding-bottom: 14px;">
            <strong style="font-weight: 400; font-size: 1.125em; color: #27534D;">3. Lắc đều trước khi uống:</strong><br>
            <span style="color: #40645F;">Hiện tượng lắng đọng nhẹ tinh bột bắp hoặc dưỡng chất hạt tự nhiên dưới đáy chai là hoàn toàn bình thường. Lắc đều trước khi thưởng thức!</span>
          </td>
        </tr>

        <tr>
          <td>
            <strong style="font-weight: 400; font-size: 1.125em; color: #27534D;">4. Đổi trả 1-1 miễn phí trong 24h:</strong><br>
            <span style="color: #40645F;">Nếu sản phẩm có bất kỳ vấn đề gì về móp méo, độ lạnh hoặc chất lượng do vận chuyển, hãy gọi ngay hotline <strong style="font-weight: 400; font-size: 1.125em;">028 6291 5024</strong> để được đổi mới 100% miễn phí.</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Voucher ưu đãi lần sau -->
    <div style="background: linear-gradient(135deg, #F6E0CB 0%, #F1CEAB 100%); border: 1px dashed #B56322; border-radius: 14px; padding: 16px; text-align: center; margin-bottom: 22px;">
      <div style="font-size: 13px; font-weight: 400; color: #82422D; text-transform: uppercase;">
        Quà tặng tri ân khách hàng thân thiết
      </div>
      <div style="font-size: 20px; font-weight: 400; color: #935321; letter-spacing: 2px; margin: 6px 0;">
        TSFHEALTHY
      </div>
      <p style="font-size: 12px; color: #7E4330; margin: 0;">
        Giảm <strong style="font-weight: 400; font-size: 1.125em;">10%</strong> cho lần đặt hàng tiếp theo tại website <a href="https://thaisonfoods.vn" style="color: #935321; font-weight: 400; font-size: 1.125em;">thaisonfoods.vn</a>
      </p>
    </div>
  `;

  return { subject, html: wrapEmailLayout({ title: subject, preheader, content, logoSrc: options?.logoSrc }) };
}
