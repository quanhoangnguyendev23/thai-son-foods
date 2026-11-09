/**
 * Kiểu dữ liệu dùng chung cho ô nhập địa chỉ giao hàng (server gợi ý + hook phía trình duyệt).
 *
 * Quy ước đơn vị hành chính (sau sáp nhập 01/07/2025, dữ liệu nội bộ vẫn giữ quận cũ):
 * - `ward`     = Phường/Xã MỚI, ví dụ "Phường Hạnh Thông".
 * - `district` = Quận/Huyện CŨ (chỉ để hiển thị "(Gò Vấp cũ)" và để khớp ô chọn Quận ở trang thanh toán).
 * - `province` = "TP. Hồ Chí Minh" (đã gồm Bình Dương, Bà Rịa - Vũng Tàu cũ).
 */

export type AddressPrecision = 'house' | 'street' | 'area';

export type SuggestionSource = 'google' | 'nominatim' | 'photon' | 'local' | 'area';

export interface AddressSuggestion {
  /** Ổn định giữa các lần gọi (không dùng Math.random) để làm key và so sánh. */
  place_id: string;
  /** Dòng đầy đủ: "101 Lê Lợi, Phường Hạnh Thông, Quận Gò Vấp, TP. Hồ Chí Minh" */
  description: string;
  /** Dòng chính: số nhà + tên đường, ví dụ "101 Lê Lợi" */
  main_text: string;
  /** Dòng phụ: "P. Hạnh Thông (Gò Vấp cũ), TP.HCM" */
  secondary_text: string;
  source: SuggestionSource;
  lat?: number;
  lng?: number;
  ward?: string;
  district?: string;
  province?: string;
  /** Số nhà đã giữ lại (của khách hoặc của nhà cung cấp), ví dụ "101", "12/34/5" */
  houseNumber?: string;
  /** Tên đường không kèm số nhà, ví dụ "Lê Lợi" */
  street?: string;
  precision?: AddressPrecision;
  /** Tên địa điểm kèm theo (trường, siêu thị...) nếu nhà cung cấp có */
  label?: string;
  /** true nếu quận cũ suy ra từ tên phường khớp chính xác trong dữ liệu nội bộ */
  adminExact?: boolean;
  /** 'similar': tên đường chỉ gần giống chữ khách gõ ("Nguyễn Duy" khi gõ "Nguyễn Du"), giao diện ghi "tên gần giống" */
  nameMatch?: 'exact' | 'similar';
  /** Điểm xếp hạng phía server/client (chỉ để debug và kiểm thử) */
  score?: number;
}

/** Tên cũ, giữ để các nơi đang import từ route không bị gãy. */
export type AutocompleteSuggestion = AddressSuggestion;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface WardRef {
  /** Phường/Xã mới, ví dụ "Phường Hạnh Thông" */
  ward: string;
  /** Quận cũ chứa phường này, ví dụ "Quận Gò Vấp" */
  district: string;
  lat?: number;
  lng?: number;
}

export interface AdminHints {
  /** Phường đã gõ rõ ràng (chỉ khớp tên phường, không trùng tên quận) */
  wards: WardRef[];
  /** Quận cũ đã gõ rõ ràng (chỉ khớp tên quận, không trùng tên phường) */
  districts: string[];
  /**
   * Cụm từ vừa là tên quận cũ vừa là tên phường mới (Gò Vấp, Thủ Đức, Tân Bình...).
   * Không được tự suy là phường; xếp hạng chấp nhận cả hai cách hiểu.
   */
  ambiguous: Array<{ token: string; wards: WardRef[]; districts: string[] }>;
  /** Khách có gõ tên thành phố (TP.HCM, Sài Gòn, Hồ Chí Minh...) */
  province: boolean;
  /** Các đoạn chữ đã nhận ra là địa danh hành chính (nguyên văn khách gõ) */
  recognized: string[];
  /**
   * Khóa (không dấu, bỏ tiền tố) của các đoạn sau dấu phẩy mà dữ liệu nội bộ không biết ("Chợ Quán", "Thủ Dầu Một"...).
   * Dùng để cộng điểm khi phường của kết quả trùng đúng chữ đó; không bao giờ dùng để trừ điểm.
   */
  unknown: string[];
  /**
   * true nếu gợi ý hành chính chỉ suy ra từ vài từ cuối câu khi khách không dùng dấu phẩy hoặc "P./Q."
   * ("101 le loi go vap"). Chỉ dùng để cộng điểm, không dùng để trừ điểm hay loại kết quả.
   */
  soft: boolean;
}

export interface ParsedAddressInput {
  raw: string;
  /** Số nhà đúng như khách gõ, bỏ chữ "Số/Nhà số": "101", "101A", "12/34/5" ("" nếu không có) */
  houseNumber: string;
  /** Nhãn hiển thị của số nhà, giữ chữ Hẻm/Ngõ khách gõ: "Hẻm 76", "101" */
  houseLabel: string;
  /** true nếu số đứng sau chữ Hẻm/Ngõ/Ngách/Kiệt (số hẻm, không phải số nhà) */
  isAlley: boolean;
  /** Tên đường khách gõ, giữ dấu, không kèm số nhà và không kèm phần phường/quận */
  street: string;
  /** Khóa so khớp của tên đường (không dấu, bỏ chữ "Đường/Phố") */
  streetKey: string;
  hints: AdminHints;
}
