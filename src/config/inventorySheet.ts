/**
 * Cấu hình nguồn tồn kho từ Google Sheet (tab INPUT DATA).
 * Web CHỈ ĐỌC sheet (quyền xem), không bao giờ ghi ngược vào sheet.
 *
 * Biến môi trường (đều không bắt buộc):
 *   INVENTORY_SOURCE            'sheet' (mặc định) | 'manual' (quay về nhập tay trên web)
 *   INVENTORY_SHEET_ID          ID file Google Sheet
 *   INVENTORY_SHEET_TAB         Tên tab nguồn (mặc định 'INPUT DATA')
 *   INVENTORY_SHEET_CSV_URL     Link CSV tự chọn (ví dụ link "Xuất bản lên web"), ưu tiên hơn ID + tab
 *   INVENTORY_SHEET_REFRESH_MINUTES  Chu kỳ tự đọc lại sheet, 5-120 phút (mặc định 15)
 */

function readRefreshMinutes(): number {
  const n = Number(process.env.INVENTORY_SHEET_REFRESH_MINUTES);
  if (!Number.isFinite(n)) return 15;
  return Math.min(120, Math.max(5, Math.round(n)));
}

export const INVENTORY_SHEET_CONFIG = {
  SPREADSHEET_ID:
    process.env.INVENTORY_SHEET_ID?.trim() || '1jZx1hFqgCcSKBAZ5XEUcaZxh0mdVyxDg1yLvPCIWAb0',
  TAB_NAME: process.env.INVENTORY_SHEET_TAB?.trim() || 'INPUT DATA',
  CSV_URL_OVERRIDE: process.env.INVENTORY_SHEET_CSV_URL?.trim() || '',

  // Hạn dùng = ngày sản xuất + 15 ngày (ví dụ NSX 17/10 -> HSD 01/11)
  SHELF_LIFE_DAYS: 15,

  // Chu kỳ tự đọc lại sheet khi có người dùng truy cập (ms)
  REFRESH_INTERVAL_MS: readRefreshMinutes() * 60 * 1000,

  // Sau một lần đọc lỗi, chờ bấy lâu mới thử lại tự động (ms)
  FAILURE_RETRY_MS: 2 * 60 * 1000,

  // Nút "Cập nhật ngay": tối thiểu bấy lâu giữa hai lần đọc (ms) để không vượt hạn mức của Google
  MANUAL_REFRESH_MIN_GAP_MS: 60 * 1000,

  // Quá bấy lâu chưa đọc thành công thì admin thấy cảnh báo "dữ liệu cũ" (ms)
  STALE_WARNING_MS: 60 * 60 * 1000,

  FETCH_TIMEOUT_MS: 15_000,

  // Số dòng đọc được tối thiểu so với lần trước (chống đọc nhầm file rỗng/sai tab)
  MIN_ROW_RATIO_VS_PREVIOUS: 0.5,

  TIME_ZONE: 'Asia/Ho_Chi_Minh',

  // Mã SP trên sheet -> mã sản phẩm trong CSDL (cùng quy ước prod-<sp>-01 với inventory.ts)
  SP_TO_PRODUCT_ID: {
    SB: 'prod-sb-01',
    SHS: 'prod-shs-01',
    SGL: 'prod-sgl-01',
    SS: 'prod-ss-01',
    SL: 'prod-sl-01',
    MD: 'prod-md-01',
    LH: 'prod-lh-01',
    TD: 'prod-td-01',
    TSG: 'prod-tsg-01',
    TXG: 'prod-txg-01',
    TSA: 'prod-tsa-01',
    MAC: 'prod-mac-01',
  } as Record<string, string>,
} as const;

/** Tiền tố mã lô do đồng bộ sheet tạo ra (để phân biệt với lô nhập tay) */
export const SHEET_LOT_PREFIX = 'SHEET-';

/** Tên người thực hiện ghi vào nhật ký khi hệ thống tự đồng bộ */
export const SHEET_SYNC_ACTOR = 'sheet-sync';

/** true = tồn kho lấy từ Google Sheet; false = admin nhập tay như trước */
export function isSheetInventoryMode(): boolean {
  return (process.env.INVENTORY_SOURCE || 'sheet').trim().toLowerCase() !== 'manual';
}
