/**
 * DANH MỤC ĐƠN VỊ HÀNH CHÍNH CẤP XÃ CỦA TP. HỒ CHÍ MINH SAU SẮP XẾP (từ 01/07/2025)
 * File này được TẠO TỰ ĐỘNG bởi scripts/build_hcm_admin_units.mjs từ văn bản gốc, KHÔNG sửa tay.
 *
 * Nguồn: Nghị quyết 1685/NQ-UBTVQH15 của Ủy ban Thường vụ Quốc hội, Điều 1 (hiệu lực 16/06/2025; đơn vị mới hoạt động
 *        từ 01/07/2025). Bản chữ lấy từ: https://luatvietnam.vn/hanh-chinh/nghi-quyet-1685-nq-ubtvqh15-2025-sap-xep-don-vi-hanh-chinh-cap-xa-tp-ho-chi-minh-403012-d1.html
 * Ngày lấy dữ liệu: 2026-11-05
 * Số khoản trong Điều 1 đọc được: 163. Cùng 5 đơn vị giữ nguyên (không sắp xếp) nêu trong Đề án 356/ĐA-CP:
 * phường Thới Hòa, xã Long Sơn, xã Hòa Hiệp, xã Bình Châu, xã Thạnh An => tổng 168 đơn vị (xem tests/address_admin_data_test.mjs).
 * Đơn vị cũ ghi đúng như văn bản; "district" chỉ có khi văn bản ghi rõ (quận/huyện/thành phố/thị xã trong ngoặc).
 * Danh mục và mã số 34 tỉnh, 3.321 xã theo QĐ 19/2025/QĐ-TTg: chưa nạp (xem báo cáo).
 */
export interface OfficialSourceUnit {
  type: 'phuong' | 'xa' | 'thi-tran' | 'dac-khu';
  name: string;
  /** Quận/huyện/thành phố/thị xã cũ, chỉ khi văn bản ghi rõ trong ngoặc */
  district: string | null;
}

export interface OfficialAdminUnit {
  /** Số khoản trong Điều 1 */
  no: number;
  type: 'phuong' | 'xa' | 'thi-tran' | 'dac-khu';
  name: string;
  sources: OfficialSourceUnit[];
}

export const HCM_OFFICIAL_SOURCE = {
  document: 'Nghị quyết 1685/NQ-UBTVQH15',
  effective: '2025-06-16',
  operatesFrom: '2025-07-01',
  fetchedAt: '2026-11-05',
  url: "https://luatvietnam.vn/hanh-chinh/nghi-quyet-1685-nq-ubtvqh15-2025-sap-xep-don-vi-hanh-chinh-cap-xa-tp-ho-chi-minh-403012-d1.html",
} as const;

/** 5 đơn vị giữ nguyên, không sắp xếp (Đề án 356/ĐA-CP) */
export const HCM_UNCHANGED_UNITS: ReadonlyArray<{ type: OfficialAdminUnit['type']; name: string }> = [
  { type: 'phuong', name: 'Thới Hòa' },
  { type: 'xa', name: 'Long Sơn' },
  { type: 'xa', name: 'Hòa Hiệp' },
  { type: 'xa', name: 'Bình Châu' },
  { type: 'xa', name: 'Thạnh An' },
];

export const HCM_OFFICIAL_UNITS: ReadonlyArray<OfficialAdminUnit> = [
 {
  "no": 1,
  "type": "phuong",
  "name": "Sài Gòn",
  "sources": [
   {
    "type": "phuong",
    "name": "Bến Nghé",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Đa Kao",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Nguyễn Thái Bình",
    "district": null
   }
  ]
 },
 {
  "no": 2,
  "type": "phuong",
  "name": "Tân Định",
  "sources": [
   {
    "type": "phuong",
    "name": "Tân Định",
    "district": "Quận 1"
   },
   {
    "type": "phuong",
    "name": "Đa Kao",
    "district": null
   }
  ]
 },
 {
  "no": 3,
  "type": "phuong",
  "name": "Bến Thành",
  "sources": [
   {
    "type": "phuong",
    "name": "Bến Thành",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Phạm Ngũ Lão",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Cầu Ông Lãnh",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Nguyễn Thái Bình",
    "district": null
   }
  ]
 },
 {
  "no": 4,
  "type": "phuong",
  "name": "Cầu Ông Lãnh",
  "sources": [
   {
    "type": "phuong",
    "name": "Nguyễn Cư Trinh",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Cầu Kho",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Cô Giang",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Cầu Ông Lãnh",
    "district": null
   }
  ]
 },
 {
  "no": 5,
  "type": "phuong",
  "name": "Bàn Cờ",
  "sources": [
   {
    "type": "phuong",
    "name": "1",
    "district": "Quận 3"
   },
   {
    "type": "phuong",
    "name": "2",
    "district": "Quận 3"
   },
   {
    "type": "phuong",
    "name": "3",
    "district": "Quận 3"
   },
   {
    "type": "phuong",
    "name": "5",
    "district": "Quận 3"
   },
   {
    "type": "phuong",
    "name": "4",
    "district": "Quận 3"
   }
  ]
 },
 {
  "no": 6,
  "type": "phuong",
  "name": "Xuân Hòa",
  "sources": [
   {
    "type": "phuong",
    "name": "Võ Thị Sáu",
    "district": "Quận 3"
   },
   {
    "type": "phuong",
    "name": "4",
    "district": "Quận 3"
   }
  ]
 },
 {
  "no": 7,
  "type": "phuong",
  "name": "Nhiêu Lộc",
  "sources": [
   {
    "type": "phuong",
    "name": "9",
    "district": "Quận 3"
   },
   {
    "type": "phuong",
    "name": "11",
    "district": "Quận 3"
   },
   {
    "type": "phuong",
    "name": "12",
    "district": "Quận 3"
   },
   {
    "type": "phuong",
    "name": "14",
    "district": "Quận 3"
   }
  ]
 },
 {
  "no": 8,
  "type": "phuong",
  "name": "Xóm Chiếu",
  "sources": [
   {
    "type": "phuong",
    "name": "13",
    "district": "Quận 4"
   },
   {
    "type": "phuong",
    "name": "16",
    "district": "Quận 4"
   },
   {
    "type": "phuong",
    "name": "18",
    "district": "Quận 4"
   },
   {
    "type": "phuong",
    "name": "15",
    "district": "Quận 4"
   }
  ]
 },
 {
  "no": 9,
  "type": "phuong",
  "name": "Khánh Hội",
  "sources": [
   {
    "type": "phuong",
    "name": "8",
    "district": "Quận 4"
   },
   {
    "type": "phuong",
    "name": "9",
    "district": "Quận 4"
   },
   {
    "type": "phuong",
    "name": "2",
    "district": "Quận 4"
   },
   {
    "type": "phuong",
    "name": "4",
    "district": "Quận 4"
   },
   {
    "type": "phuong",
    "name": "15",
    "district": "Quận 4"
   }
  ]
 },
 {
  "no": 10,
  "type": "phuong",
  "name": "Vĩnh Hội",
  "sources": [
   {
    "type": "phuong",
    "name": "1",
    "district": "Quận 4"
   },
   {
    "type": "phuong",
    "name": "3",
    "district": "Quận 4"
   },
   {
    "type": "phuong",
    "name": "2",
    "district": "Quận 4"
   },
   {
    "type": "phuong",
    "name": "4",
    "district": "Quận 4"
   }
  ]
 },
 {
  "no": 11,
  "type": "phuong",
  "name": "Chợ Quán",
  "sources": [
   {
    "type": "phuong",
    "name": "1",
    "district": "Quận 5"
   },
   {
    "type": "phuong",
    "name": "2",
    "district": "Quận 5"
   },
   {
    "type": "phuong",
    "name": "4",
    "district": "Quận 5"
   }
  ]
 },
 {
  "no": 12,
  "type": "phuong",
  "name": "An Đông",
  "sources": [
   {
    "type": "phuong",
    "name": "5",
    "district": "Quận 5"
   },
   {
    "type": "phuong",
    "name": "7",
    "district": "Quận 5"
   },
   {
    "type": "phuong",
    "name": "9",
    "district": "Quận 5"
   }
  ]
 },
 {
  "no": 13,
  "type": "phuong",
  "name": "Chợ Lớn",
  "sources": [
   {
    "type": "phuong",
    "name": "11",
    "district": "Quận 5"
   },
   {
    "type": "phuong",
    "name": "12",
    "district": "Quận 5"
   },
   {
    "type": "phuong",
    "name": "13",
    "district": "Quận 5"
   },
   {
    "type": "phuong",
    "name": "14",
    "district": "Quận 5"
   }
  ]
 },
 {
  "no": 14,
  "type": "phuong",
  "name": "Bình Tây",
  "sources": [
   {
    "type": "phuong",
    "name": "2",
    "district": "Quận 6"
   },
   {
    "type": "phuong",
    "name": "9",
    "district": "Quận 6"
   }
  ]
 },
 {
  "no": 15,
  "type": "phuong",
  "name": "Bình Tiên",
  "sources": [
   {
    "type": "phuong",
    "name": "1",
    "district": "Quận 6"
   },
   {
    "type": "phuong",
    "name": "7",
    "district": "Quận 6"
   },
   {
    "type": "phuong",
    "name": "8",
    "district": "Quận 6"
   }
  ]
 },
 {
  "no": 16,
  "type": "phuong",
  "name": "Bình Phú",
  "sources": [
   {
    "type": "phuong",
    "name": "10",
    "district": "Quận 6"
   },
   {
    "type": "phuong",
    "name": "11",
    "district": "Quận 6"
   },
   {
    "type": "phuong",
    "name": "16",
    "district": "Quận 8"
   }
  ]
 },
 {
  "no": 17,
  "type": "phuong",
  "name": "Phú Lâm",
  "sources": [
   {
    "type": "phuong",
    "name": "12",
    "district": "Quận 6"
   },
   {
    "type": "phuong",
    "name": "13",
    "district": "Quận 6"
   },
   {
    "type": "phuong",
    "name": "14",
    "district": "Quận 6"
   }
  ]
 },
 {
  "no": 18,
  "type": "phuong",
  "name": "Tân Thuận",
  "sources": [
   {
    "type": "phuong",
    "name": "Bình Thuận",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Thuận Đông",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Thuận Tây",
    "district": null
   }
  ]
 },
 {
  "no": 19,
  "type": "phuong",
  "name": "Phú Thuận",
  "sources": [
   {
    "type": "phuong",
    "name": "Phú Thuận",
    "district": "Quận 7"
   },
   {
    "type": "phuong",
    "name": "Phú Mỹ",
    "district": "Quận 7"
   }
  ]
 },
 {
  "no": 20,
  "type": "phuong",
  "name": "Tân Mỹ",
  "sources": [
   {
    "type": "phuong",
    "name": "Tân Phú",
    "district": "Quận 7"
   },
   {
    "type": "phuong",
    "name": "Phú Mỹ",
    "district": "Quận 7"
   }
  ]
 },
 {
  "no": 21,
  "type": "phuong",
  "name": "Tân Hưng",
  "sources": [
   {
    "type": "phuong",
    "name": "Tân Phong",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Quy",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Kiểng",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Hưng",
    "district": null
   }
  ]
 },
 {
  "no": 22,
  "type": "phuong",
  "name": "Chánh Hưng",
  "sources": [
   {
    "type": "phuong",
    "name": "Phường 4",
    "district": "Quận 8"
   },
   {
    "type": "phuong",
    "name": "Rạch Ông",
    "district": "Quận 8"
   },
   {
    "type": "phuong",
    "name": "Hưng Phú",
    "district": "Quận 8"
   },
   {
    "type": "phuong",
    "name": "5",
    "district": "Quận 8"
   }
  ]
 },
 {
  "no": 23,
  "type": "phuong",
  "name": "Phú Định",
  "sources": [
   {
    "type": "phuong",
    "name": "14",
    "district": "Quận 8"
   },
   {
    "type": "phuong",
    "name": "15",
    "district": "Quận 8"
   },
   {
    "type": "phuong",
    "name": "Xóm Củi",
    "district": "Quận 8"
   },
   {
    "type": "phuong",
    "name": "16",
    "district": "Quận 8"
   }
  ]
 },
 {
  "no": 24,
  "type": "phuong",
  "name": "Bình Đông",
  "sources": [
   {
    "type": "phuong",
    "name": "6",
    "district": "Quận 8"
   },
   {
    "type": "phuong",
    "name": "7",
    "district": "Quận 8"
   },
   {
    "type": "xa",
    "name": "An Phú Tây",
    "district": "Quận 8"
   },
   {
    "type": "phuong",
    "name": "5",
    "district": "Quận 8"
   }
  ]
 },
 {
  "no": 25,
  "type": "phuong",
  "name": "Diên Hồng",
  "sources": [
   {
    "type": "phuong",
    "name": "6",
    "district": "Quận 10"
   },
   {
    "type": "phuong",
    "name": "8",
    "district": "Quận 10"
   },
   {
    "type": "phuong",
    "name": "14",
    "district": "Quận 10"
   }
  ]
 },
 {
  "no": 26,
  "type": "phuong",
  "name": "Vườn Lài",
  "sources": [
   {
    "type": "phuong",
    "name": "1",
    "district": "Quận 10"
   },
   {
    "type": "phuong",
    "name": "2",
    "district": "Quận 10"
   },
   {
    "type": "phuong",
    "name": "4",
    "district": "Quận 10"
   },
   {
    "type": "phuong",
    "name": "9",
    "district": "Quận 10"
   },
   {
    "type": "phuong",
    "name": "10",
    "district": "Quận 10"
   }
  ]
 },
 {
  "no": 27,
  "type": "phuong",
  "name": "Hòa Hưng",
  "sources": [
   {
    "type": "phuong",
    "name": "12",
    "district": "Quận 10"
   },
   {
    "type": "phuong",
    "name": "13",
    "district": "Quận 10"
   },
   {
    "type": "phuong",
    "name": "15",
    "district": "Quận 10"
   },
   {
    "type": "phuong",
    "name": "14",
    "district": "Quận 10"
   }
  ]
 },
 {
  "no": 28,
  "type": "phuong",
  "name": "Minh Phụng",
  "sources": [
   {
    "type": "phuong",
    "name": "1",
    "district": "Quận 11"
   },
   {
    "type": "phuong",
    "name": "7",
    "district": "Quận 11"
   },
   {
    "type": "phuong",
    "name": "16",
    "district": "Quận 11"
   }
  ]
 },
 {
  "no": 29,
  "type": "phuong",
  "name": "Bình Thới",
  "sources": [
   {
    "type": "phuong",
    "name": "3",
    "district": "Quận 11"
   },
   {
    "type": "phuong",
    "name": "10",
    "district": "Quận 11"
   },
   {
    "type": "phuong",
    "name": "8",
    "district": "Quận 11"
   }
  ]
 },
 {
  "no": 30,
  "type": "phuong",
  "name": "Hòa Bình",
  "sources": [
   {
    "type": "phuong",
    "name": "5",
    "district": "Quận 11"
   },
   {
    "type": "phuong",
    "name": "14",
    "district": "Quận 11"
   }
  ]
 },
 {
  "no": 31,
  "type": "phuong",
  "name": "Phú Thọ",
  "sources": [
   {
    "type": "phuong",
    "name": "11",
    "district": "Quận 11"
   },
   {
    "type": "phuong",
    "name": "15",
    "district": "Quận 11"
   },
   {
    "type": "phuong",
    "name": "8",
    "district": "Quận 11"
   }
  ]
 },
 {
  "no": 32,
  "type": "phuong",
  "name": "Đông Hưng Thuận",
  "sources": [
   {
    "type": "phuong",
    "name": "Tân Thới Nhất",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Hưng Thuận",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Đông Hưng Thuận",
    "district": null
   }
  ]
 },
 {
  "no": 33,
  "type": "phuong",
  "name": "Trung Mỹ Tây",
  "sources": [
   {
    "type": "phuong",
    "name": "Tân Chánh Hiệp",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Trung Mỹ Tây",
    "district": null
   }
  ]
 },
 {
  "no": 34,
  "type": "phuong",
  "name": "Tân Thới Hiệp",
  "sources": [
   {
    "type": "phuong",
    "name": "Hiệp Thành",
    "district": "Quận 12"
   },
   {
    "type": "phuong",
    "name": "Tân Thới Hiệp",
    "district": null
   }
  ]
 },
 {
  "no": 35,
  "type": "phuong",
  "name": "Thới An",
  "sources": [
   {
    "type": "phuong",
    "name": "Thạnh Xuân",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Thới An",
    "district": null
   }
  ]
 },
 {
  "no": 36,
  "type": "phuong",
  "name": "An Phú Đông",
  "sources": [
   {
    "type": "phuong",
    "name": "Thạnh Lộc",
    "district": null
   },
   {
    "type": "phuong",
    "name": "An Phú Đông",
    "district": null
   }
  ]
 },
 {
  "no": 37,
  "type": "phuong",
  "name": "An Lạc",
  "sources": [
   {
    "type": "phuong",
    "name": "Bình Trị Đông B",
    "district": null
   },
   {
    "type": "phuong",
    "name": "An Lạc A",
    "district": null
   },
   {
    "type": "phuong",
    "name": "An Lạc",
    "district": null
   }
  ]
 },
 {
  "no": 38,
  "type": "phuong",
  "name": "Bình Tân",
  "sources": [
   {
    "type": "phuong",
    "name": "Bình Hưng Hòa B",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Bình Trị Đông A",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Tạo",
    "district": null
   }
  ]
 },
 {
  "no": 39,
  "type": "phuong",
  "name": "Tân Tạo",
  "sources": [
   {
    "type": "phuong",
    "name": "Tân Tạo A",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Tạo",
    "district": null
   },
   {
    "type": "xa",
    "name": "Tân Kiên",
    "district": null
   }
  ]
 },
 {
  "no": 40,
  "type": "phuong",
  "name": "Bình Trị Đông",
  "sources": [
   {
    "type": "phuong",
    "name": "Bình Trị Đông",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Bình Hưng Hòa A",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Bình Trị Đông A",
    "district": null
   }
  ]
 },
 {
  "no": 41,
  "type": "phuong",
  "name": "Bình Hưng Hòa",
  "sources": [
   {
    "type": "phuong",
    "name": "Bình Hưng Hòa",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Sơn Kỳ",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Bình Hưng Hòa A",
    "district": null
   }
  ]
 },
 {
  "no": 42,
  "type": "phuong",
  "name": "Gia Định",
  "sources": [
   {
    "type": "phuong",
    "name": "1",
    "district": "Quận Bình Thạnh"
   },
   {
    "type": "phuong",
    "name": "2",
    "district": "Quận Bình Thạnh"
   },
   {
    "type": "phuong",
    "name": "7",
    "district": "Quận Bình Thạnh"
   },
   {
    "type": "phuong",
    "name": "17",
    "district": "Quận Bình Thạnh"
   }
  ]
 },
 {
  "no": 43,
  "type": "phuong",
  "name": "Bình Thạnh",
  "sources": [
   {
    "type": "phuong",
    "name": "12",
    "district": "Quận Bình Thạnh"
   },
   {
    "type": "phuong",
    "name": "14",
    "district": "Quận Bình Thạnh"
   },
   {
    "type": "phuong",
    "name": "26",
    "district": null
   }
  ]
 },
 {
  "no": 44,
  "type": "phuong",
  "name": "Bình Lợi Trung",
  "sources": [
   {
    "type": "phuong",
    "name": "5",
    "district": "Quận Bình Thạnh"
   },
   {
    "type": "phuong",
    "name": "11",
    "district": "Quận Bình Thạnh"
   },
   {
    "type": "phuong",
    "name": "13",
    "district": "Quận Bình Thạnh"
   }
  ]
 },
 {
  "no": 45,
  "type": "phuong",
  "name": "Thạnh Mỹ Tây",
  "sources": [
   {
    "type": "phuong",
    "name": "19",
    "district": null
   },
   {
    "type": "phuong",
    "name": "22",
    "district": null
   },
   {
    "type": "phuong",
    "name": "25",
    "district": null
   }
  ]
 },
 {
  "no": 46,
  "type": "phuong",
  "name": "Bình Quới",
  "sources": [
   {
    "type": "phuong",
    "name": "27",
    "district": null
   },
   {
    "type": "phuong",
    "name": "28",
    "district": null
   }
  ]
 },
 {
  "no": 47,
  "type": "phuong",
  "name": "Hạnh Thông",
  "sources": [
   {
    "type": "phuong",
    "name": "1",
    "district": "Quận Gò Vấp"
   },
   {
    "type": "phuong",
    "name": "3",
    "district": "Quận Gò Vấp"
   }
  ]
 },
 {
  "no": 48,
  "type": "phuong",
  "name": "An Nhơn",
  "sources": [
   {
    "type": "phuong",
    "name": "5",
    "district": "Quận Gò Vấp"
   },
   {
    "type": "phuong",
    "name": "6",
    "district": "Quận Gò Vấp"
   }
  ]
 },
 {
  "no": 49,
  "type": "phuong",
  "name": "Gò Vấp",
  "sources": [
   {
    "type": "phuong",
    "name": "10",
    "district": "Quận Gò Vấp"
   },
   {
    "type": "phuong",
    "name": "17",
    "district": "Quận Gò Vấp"
   }
  ]
 },
 {
  "no": 50,
  "type": "phuong",
  "name": "An Hội Đông",
  "sources": [
   {
    "type": "phuong",
    "name": "15",
    "district": "Quận Gò Vấp"
   },
   {
    "type": "phuong",
    "name": "16",
    "district": "Quận Gò Vấp"
   }
  ]
 },
 {
  "no": 51,
  "type": "phuong",
  "name": "Thông Tây Hội",
  "sources": [
   {
    "type": "phuong",
    "name": "8",
    "district": "Quận Gò Vấp"
   },
   {
    "type": "phuong",
    "name": "11",
    "district": "Quận Gò Vấp"
   }
  ]
 },
 {
  "no": 52,
  "type": "phuong",
  "name": "An Hội Tây",
  "sources": [
   {
    "type": "phuong",
    "name": "12",
    "district": "Quận Gò Vấp"
   },
   {
    "type": "phuong",
    "name": "14",
    "district": "Quận Gò Vấp"
   }
  ]
 },
 {
  "no": 53,
  "type": "phuong",
  "name": "Đức Nhuận",
  "sources": [
   {
    "type": "phuong",
    "name": "4",
    "district": "Quận Phú Nhuận"
   },
   {
    "type": "phuong",
    "name": "5",
    "district": "Quận Phú Nhuận"
   },
   {
    "type": "phuong",
    "name": "9",
    "district": "Quận Phú Nhuận"
   }
  ]
 },
 {
  "no": 54,
  "type": "phuong",
  "name": "Cầu Kiệu",
  "sources": [
   {
    "type": "phuong",
    "name": "1",
    "district": "Quận Phú Nhuận"
   },
   {
    "type": "phuong",
    "name": "2",
    "district": "Quận Phú Nhuận"
   },
   {
    "type": "phuong",
    "name": "7",
    "district": "Quận Phú Nhuận"
   },
   {
    "type": "phuong",
    "name": "15",
    "district": "Quận Phú Nhuận"
   }
  ]
 },
 {
  "no": 55,
  "type": "phuong",
  "name": "Phú Nhuận",
  "sources": [
   {
    "type": "phuong",
    "name": "8",
    "district": "Quận Phú Nhuận"
   },
   {
    "type": "phuong",
    "name": "10",
    "district": "Quận Phú Nhuận"
   },
   {
    "type": "phuong",
    "name": "11",
    "district": "Quận Phú Nhuận"
   },
   {
    "type": "phuong",
    "name": "13",
    "district": "Quận Phú Nhuận"
   },
   {
    "type": "phuong",
    "name": "15",
    "district": "Quận Phú Nhuận"
   }
  ]
 },
 {
  "no": 56,
  "type": "phuong",
  "name": "Tân Sơn Hòa",
  "sources": [
   {
    "type": "phuong",
    "name": "1",
    "district": "Quận Tân Bình"
   },
   {
    "type": "phuong",
    "name": "2",
    "district": "Quận Tân Bình"
   },
   {
    "type": "phuong",
    "name": "3",
    "district": "Quận Tân Bình"
   }
  ]
 },
 {
  "no": 57,
  "type": "phuong",
  "name": "Tân Sơn Nhất",
  "sources": [
   {
    "type": "phuong",
    "name": "4",
    "district": "Quận Tân Bình"
   },
   {
    "type": "phuong",
    "name": "5",
    "district": "Quận Tân Bình"
   },
   {
    "type": "phuong",
    "name": "7",
    "district": "Quận Tân Bình"
   }
  ]
 },
 {
  "no": 58,
  "type": "phuong",
  "name": "Tân Hòa",
  "sources": [
   {
    "type": "phuong",
    "name": "6",
    "district": "Quận Tân Bình"
   },
   {
    "type": "phuong",
    "name": "8",
    "district": "Quận Tân Bình"
   },
   {
    "type": "phuong",
    "name": "9",
    "district": "Quận Tân Bình"
   }
  ]
 },
 {
  "no": 59,
  "type": "phuong",
  "name": "Bảy Hiền",
  "sources": [
   {
    "type": "phuong",
    "name": "10",
    "district": "Quận Tân Bình"
   },
   {
    "type": "phuong",
    "name": "11",
    "district": "Quận Tân Bình"
   },
   {
    "type": "phuong",
    "name": "12",
    "district": "Quận Tân Bình"
   }
  ]
 },
 {
  "no": 60,
  "type": "phuong",
  "name": "Tân Bình",
  "sources": [
   {
    "type": "phuong",
    "name": "13",
    "district": "Quận Tân Bình"
   },
   {
    "type": "phuong",
    "name": "14",
    "district": "Quận Tân Bình"
   },
   {
    "type": "phuong",
    "name": "15",
    "district": "Quận Tân Bình"
   }
  ]
 },
 {
  "no": 61,
  "type": "phuong",
  "name": "Tân Sơn",
  "sources": [
   {
    "type": "phuong",
    "name": "15",
    "district": "Quận Tân Bình"
   }
  ]
 },
 {
  "no": 62,
  "type": "phuong",
  "name": "Tây Thạnh",
  "sources": [
   {
    "type": "phuong",
    "name": "Tây Thạnh",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Sơn Kỳ",
    "district": null
   }
  ]
 },
 {
  "no": 63,
  "type": "phuong",
  "name": "Tân Sơn Nhì",
  "sources": [
   {
    "type": "phuong",
    "name": "Tân Sơn Nhì",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Sơn Kỳ sau khi sắp xếp theo quy định tại khoản 41",
    "district": null
   },
   {
    "type": "phuong",
    "name": "khoản 62 Điều này",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Quý",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Thành",
    "district": null
   }
  ]
 },
 {
  "no": 64,
  "type": "phuong",
  "name": "Phú Thọ Hòa",
  "sources": [
   {
    "type": "phuong",
    "name": "Phú Thọ Hòa",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Thành",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Quý",
    "district": null
   }
  ]
 },
 {
  "no": 65,
  "type": "phuong",
  "name": "Tân Phú",
  "sources": [
   {
    "type": "phuong",
    "name": "Phú Trung",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Hòa Thạnh",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Thới Hòa",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Thành sau khi sắp xếp theo quy định tại khoản 63",
    "district": null
   },
   {
    "type": "phuong",
    "name": "khoản 64 Điều này",
    "district": null
   }
  ]
 },
 {
  "no": 66,
  "type": "phuong",
  "name": "Phú Thạnh",
  "sources": [
   {
    "type": "phuong",
    "name": "Hiệp Tân",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Phú Thạnh",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Thới Hòa",
    "district": null
   }
  ]
 },
 {
  "no": 67,
  "type": "phuong",
  "name": "Hiệp Bình",
  "sources": [
   {
    "type": "phuong",
    "name": "Hiệp Bình Chánh",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Hiệp Bình Phước",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Linh Đông",
    "district": null
   }
  ]
 },
 {
  "no": 68,
  "type": "phuong",
  "name": "Thủ Đức",
  "sources": [
   {
    "type": "phuong",
    "name": "Bình Thọ",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Linh Chiểu",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Trường Thọ",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Linh Tây",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Linh Đông",
    "district": null
   }
  ]
 },
 {
  "no": 69,
  "type": "phuong",
  "name": "Tam Bình",
  "sources": [
   {
    "type": "phuong",
    "name": "Bình Chiểu",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tam Phú",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tam Bình",
    "district": null
   }
  ]
 },
 {
  "no": 70,
  "type": "phuong",
  "name": "Linh Xuân",
  "sources": [
   {
    "type": "phuong",
    "name": "Linh Trung",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Linh Xuân",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Linh Tây",
    "district": null
   }
  ]
 },
 {
  "no": 71,
  "type": "phuong",
  "name": "Tăng Nhơn Phú",
  "sources": [
   {
    "type": "phuong",
    "name": "Tân Phú",
    "district": "Thành phố Thủ Đức"
   },
   {
    "type": "phuong",
    "name": "Hiệp Phú",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tăng Nhơn Phú A",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tăng Nhơn Phú B",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Long Thạnh Mỹ",
    "district": null
   }
  ]
 },
 {
  "no": 72,
  "type": "phuong",
  "name": "Long Bình",
  "sources": [
   {
    "type": "phuong",
    "name": "Long Bình",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Long Thạnh Mỹ",
    "district": null
   }
  ]
 },
 {
  "no": 73,
  "type": "phuong",
  "name": "Long Phước",
  "sources": [
   {
    "type": "phuong",
    "name": "Trường Thạnh",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Long Phước",
    "district": null
   }
  ]
 },
 {
  "no": 74,
  "type": "phuong",
  "name": "Long Trường",
  "sources": [
   {
    "type": "phuong",
    "name": "Phú Hữu",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Long Trường",
    "district": null
   }
  ]
 },
 {
  "no": 75,
  "type": "phuong",
  "name": "Cát Lái",
  "sources": [
   {
    "type": "phuong",
    "name": "Thạnh Mỹ Lợi",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Cát Lái",
    "district": null
   }
  ]
 },
 {
  "no": 76,
  "type": "phuong",
  "name": "Bình Trưng",
  "sources": [
   {
    "type": "phuong",
    "name": "Bình Trưng Đông",
    "district": "Thành phố Thủ Đức"
   },
   {
    "type": "phuong",
    "name": "Bình Trưng Tây",
    "district": "Thành phố Thủ Đức"
   },
   {
    "type": "phuong",
    "name": "An Phú",
    "district": "Thành phố Thủ Đức"
   }
  ]
 },
 {
  "no": 77,
  "type": "phuong",
  "name": "Phước Long",
  "sources": [
   {
    "type": "phuong",
    "name": "Phước Bình",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Phước Long A",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Phước Long B",
    "district": null
   }
  ]
 },
 {
  "no": 78,
  "type": "phuong",
  "name": "An Khánh",
  "sources": [
   {
    "type": "phuong",
    "name": "Thủ Thiêm",
    "district": "Thành phố Thủ Đức"
   },
   {
    "type": "phuong",
    "name": "An Lợi Đông",
    "district": "Thành phố Thủ Đức"
   },
   {
    "type": "phuong",
    "name": "Thảo Điền",
    "district": "Thành phố Thủ Đức"
   },
   {
    "type": "phuong",
    "name": "An Khánh",
    "district": "Thành phố Thủ Đức"
   },
   {
    "type": "phuong",
    "name": "An Phú",
    "district": "Thành phố Thủ Đức"
   }
  ]
 },
 {
  "no": 79,
  "type": "phuong",
  "name": "Đông Hòa",
  "sources": [
   {
    "type": "phuong",
    "name": "Bình An",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Bình Thắng",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Đông Hòa",
    "district": null
   }
  ]
 },
 {
  "no": 80,
  "type": "phuong",
  "name": "Dĩ An",
  "sources": [
   {
    "type": "phuong",
    "name": "An Bình",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Dĩ An",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Đông Hiệp",
    "district": null
   }
  ]
 },
 {
  "no": 81,
  "type": "phuong",
  "name": "Tân Đông Hiệp",
  "sources": [
   {
    "type": "phuong",
    "name": "Tân Bình",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Thái Hòa",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Đông Hiệp",
    "district": null
   }
  ]
 },
 {
  "no": 82,
  "type": "phuong",
  "name": "An Phú",
  "sources": [
   {
    "type": "phuong",
    "name": "An Phú",
    "district": "Thành phố Thuận An"
   },
   {
    "type": "phuong",
    "name": "Bình Chuẩn",
    "district": null
   }
  ]
 },
 {
  "no": 83,
  "type": "phuong",
  "name": "Bình Hòa",
  "sources": [
   {
    "type": "phuong",
    "name": "Bình Hòa",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Vĩnh Phú",
    "district": null
   }
  ]
 },
 {
  "no": 84,
  "type": "phuong",
  "name": "Lái Thiêu",
  "sources": [
   {
    "type": "phuong",
    "name": "Bình Nhâm",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Lái Thiêu",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Vĩnh Phú",
    "district": null
   }
  ]
 },
 {
  "no": 85,
  "type": "phuong",
  "name": "Thuận An",
  "sources": [
   {
    "type": "phuong",
    "name": "Hưng Định",
    "district": null
   },
   {
    "type": "phuong",
    "name": "An Thạnh",
    "district": null
   },
   {
    "type": "xa",
    "name": "An Sơn",
    "district": null
   }
  ]
 },
 {
  "no": 86,
  "type": "phuong",
  "name": "Thuận Giao",
  "sources": [
   {
    "type": "phuong",
    "name": "Thuận Giao",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Bình Chuẩn",
    "district": null
   }
  ]
 },
 {
  "no": 87,
  "type": "phuong",
  "name": "Thủ Dầu Một",
  "sources": [
   {
    "type": "phuong",
    "name": "Phú Cường",
    "district": "Thành phố Thủ Dầu Một"
   },
   {
    "type": "phuong",
    "name": "Phú Thọ",
    "district": "Thành phố Thủ Dầu Một"
   },
   {
    "type": "phuong",
    "name": "Chánh Nghĩa",
    "district": "Thành phố Thủ Dầu Một"
   },
   {
    "type": "phuong",
    "name": "Hiệp Thành",
    "district": "Thành phố Thủ Dầu Một"
   },
   {
    "type": "phuong",
    "name": "Chánh Mỹ",
    "district": null
   }
  ]
 },
 {
  "no": 88,
  "type": "phuong",
  "name": "Phú Lợi",
  "sources": [
   {
    "type": "phuong",
    "name": "Phú Hòa",
    "district": "Thành phố Thủ Dầu Một"
   },
   {
    "type": "phuong",
    "name": "Phú Lợi",
    "district": "Thành phố Thủ Dầu Một"
   },
   {
    "type": "phuong",
    "name": "Hiệp Thành",
    "district": "Thành phố Thủ Dầu Một"
   }
  ]
 },
 {
  "no": 89,
  "type": "phuong",
  "name": "Chánh Hiệp",
  "sources": [
   {
    "type": "phuong",
    "name": "Định Hòa",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tương Bình Hiệp",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Hiệp An",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Chánh Mỹ",
    "district": null
   }
  ]
 },
 {
  "no": 90,
  "type": "phuong",
  "name": "Bình Dương",
  "sources": [
   {
    "type": "phuong",
    "name": "Phú Mỹ",
    "district": "Thành phố Thủ Dầu Một"
   },
   {
    "type": "phuong",
    "name": "Hòa Phú",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Phú Tân",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Phú Chánh",
    "district": null
   }
  ]
 },
 {
  "no": 91,
  "type": "phuong",
  "name": "Hòa Lợi",
  "sources": [
   {
    "type": "phuong",
    "name": "Tân Định",
    "district": "Thành phố Bến Cát"
   },
   {
    "type": "phuong",
    "name": "Hòa Lợi",
    "district": null
   }
  ]
 },
 {
  "no": 92,
  "type": "phuong",
  "name": "Phú An",
  "sources": [
   {
    "type": "phuong",
    "name": "Tân An",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phú An",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Hiệp An",
    "district": null
   }
  ]
 },
 {
  "no": 93,
  "type": "phuong",
  "name": "Tây Nam",
  "sources": [
   {
    "type": "phuong",
    "name": "An Tây",
    "district": null
   },
   {
    "type": "xa",
    "name": "Thanh Tuyền",
    "district": null
   },
   {
    "type": "xa",
    "name": "An Lập",
    "district": null
   }
  ]
 },
 {
  "no": 94,
  "type": "phuong",
  "name": "Long Nguyên",
  "sources": [
   {
    "type": "phuong",
    "name": "An Điền",
    "district": null
   },
   {
    "type": "xa",
    "name": "Long Nguyên",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Mỹ Phước",
    "district": null
   }
  ]
 },
 {
  "no": 95,
  "type": "phuong",
  "name": "Bến Cát",
  "sources": [
   {
    "type": "xa",
    "name": "Tân Hưng",
    "district": "Huyện Bàu Bàng"
   },
   {
    "type": "xa",
    "name": "Lai Hưng",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Mỹ Phước",
    "district": null
   }
  ]
 },
 {
  "no": 96,
  "type": "phuong",
  "name": "Chánh Phú Hòa",
  "sources": [
   {
    "type": "phuong",
    "name": "Chánh Phú Hòa",
    "district": null
   },
   {
    "type": "xa",
    "name": "Hưng Hòa",
    "district": null
   }
  ]
 },
 {
  "no": 97,
  "type": "phuong",
  "name": "Vĩnh Tân",
  "sources": [
   {
    "type": "phuong",
    "name": "Vĩnh Tân",
    "district": null
   },
   {
    "type": "thi-tran",
    "name": "Tân Bình",
    "district": null
   }
  ]
 },
 {
  "no": 98,
  "type": "phuong",
  "name": "Bình Cơ",
  "sources": [
   {
    "type": "xa",
    "name": "Bình Mỹ",
    "district": "Huyện Bắc Tân Uyên"
   },
   {
    "type": "phuong",
    "name": "Hội Nghĩa",
    "district": null
   }
  ]
 },
 {
  "no": 99,
  "type": "phuong",
  "name": "Tân Uyên",
  "sources": [
   {
    "type": "phuong",
    "name": "Uyên Hưng",
    "district": null
   },
   {
    "type": "xa",
    "name": "Bạch Đằng",
    "district": null
   },
   {
    "type": "xa",
    "name": "Tân Lập",
    "district": null
   },
   {
    "type": "xa",
    "name": "Tân Mỹ",
    "district": null
   }
  ]
 },
 {
  "no": 100,
  "type": "phuong",
  "name": "Tân Hiệp",
  "sources": [
   {
    "type": "phuong",
    "name": "Khánh Bình",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Hiệp",
    "district": null
   }
  ]
 },
 {
  "no": 101,
  "type": "phuong",
  "name": "Tân Khánh",
  "sources": [
   {
    "type": "phuong",
    "name": "Thạnh Phước",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Phước Khánh",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Vĩnh Hiệp",
    "district": null
   },
   {
    "type": "xa",
    "name": "Thạnh Hội",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Thái Hòa",
    "district": null
   }
  ]
 },
 {
  "no": 102,
  "type": "phuong",
  "name": "Vũng Tàu",
  "sources": [
   {
    "type": "phuong",
    "name": "1",
    "district": "Thành phố Vũng Tàu"
   },
   {
    "type": "phuong",
    "name": "2",
    "district": "Thành phố Vũng Tàu"
   },
   {
    "type": "phuong",
    "name": "3",
    "district": "Thành phố Vũng Tàu"
   },
   {
    "type": "phuong",
    "name": "4",
    "district": "Thành phố Vũng Tàu"
   },
   {
    "type": "phuong",
    "name": "5",
    "district": "Thành phố Vũng Tàu"
   },
   {
    "type": "phuong",
    "name": "Thắng Nhì",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Thắng Tam",
    "district": null
   }
  ]
 },
 {
  "no": 103,
  "type": "phuong",
  "name": "Tam Thắng",
  "sources": [
   {
    "type": "phuong",
    "name": "7",
    "district": "Thành phố Vũng Tàu"
   },
   {
    "type": "phuong",
    "name": "8",
    "district": "Thành phố Vũng Tàu"
   },
   {
    "type": "phuong",
    "name": "9",
    "district": "Thành phố Vũng Tàu"
   },
   {
    "type": "phuong",
    "name": "Nguyễn An Ninh",
    "district": null
   }
  ]
 },
 {
  "no": 104,
  "type": "phuong",
  "name": "Rạch Dừa",
  "sources": [
   {
    "type": "phuong",
    "name": "10",
    "district": "Thành phố Vũng Tàu"
   },
   {
    "type": "phuong",
    "name": "Thắng Nhất",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Rạch Dừa",
    "district": null
   }
  ]
 },
 {
  "no": 105,
  "type": "phuong",
  "name": "Phước Thắng",
  "sources": [
   {
    "type": "phuong",
    "name": "11",
    "district": "Thành phố Vũng Tàu"
   },
   {
    "type": "phuong",
    "name": "12",
    "district": "Thành phố Vũng Tàu"
   }
  ]
 },
 {
  "no": 106,
  "type": "phuong",
  "name": "Long Hương",
  "sources": [
   {
    "type": "xa",
    "name": "Tân Hưng",
    "district": "Thành phố Bà Rịa"
   },
   {
    "type": "phuong",
    "name": "Kim Dinh",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Long Hương",
    "district": null
   }
  ]
 },
 {
  "no": 107,
  "type": "phuong",
  "name": "Bà Rịa",
  "sources": [
   {
    "type": "phuong",
    "name": "Phước Trung",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Phước Nguyên",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Long Toàn",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Phước Hưng",
    "district": null
   }
  ]
 },
 {
  "no": 108,
  "type": "phuong",
  "name": "Tam Long",
  "sources": [
   {
    "type": "phuong",
    "name": "Long Tâm",
    "district": null
   },
   {
    "type": "xa",
    "name": "Hòa Long",
    "district": null
   },
   {
    "type": "xa",
    "name": "Long Phước",
    "district": null
   }
  ]
 },
 {
  "no": 109,
  "type": "phuong",
  "name": "Tân Hải",
  "sources": [
   {
    "type": "phuong",
    "name": "Tân Hòa",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Hải",
    "district": null
   }
  ]
 },
 {
  "no": 110,
  "type": "phuong",
  "name": "Tân Phước",
  "sources": [
   {
    "type": "phuong",
    "name": "Phước Hòa",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Phước",
    "district": null
   }
  ]
 },
 {
  "no": 111,
  "type": "phuong",
  "name": "Phú Mỹ",
  "sources": [
   {
    "type": "phuong",
    "name": "Phú Mỹ",
    "district": "Thành phố Phú Mỹ"
   },
   {
    "type": "phuong",
    "name": "Mỹ Xuân",
    "district": null
   }
  ]
 },
 {
  "no": 112,
  "type": "phuong",
  "name": "Tân Thành",
  "sources": [
   {
    "type": "phuong",
    "name": "Hắc Dịch",
    "district": null
   },
   {
    "type": "xa",
    "name": "Sông Xoài",
    "district": null
   }
  ]
 },
 {
  "no": 113,
  "type": "xa",
  "name": "Vĩnh Lộc",
  "sources": [
   {
    "type": "xa",
    "name": "Vĩnh Lộc A",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phạm Văn Hai",
    "district": null
   }
  ]
 },
 {
  "no": 114,
  "type": "xa",
  "name": "Tân Vĩnh Lộc",
  "sources": [
   {
    "type": "xa",
    "name": "Vĩnh Lộc B",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phạm Văn Hai",
    "district": null
   },
   {
    "type": "phuong",
    "name": "Tân Tạo sau khi sắp xếp theo quy định tại khoản 38",
    "district": null
   },
   {
    "type": "phuong",
    "name": "khoản 39 Điều này",
    "district": null
   }
  ]
 },
 {
  "no": 115,
  "type": "xa",
  "name": "Bình Lợi",
  "sources": [
   {
    "type": "xa",
    "name": "Lê Minh Xuân",
    "district": null
   },
   {
    "type": "xa",
    "name": "Bình Lợi",
    "district": null
   }
  ]
 },
 {
  "no": 116,
  "type": "xa",
  "name": "Tân Nhựt",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Tân Túc",
    "district": "Quận 8"
   },
   {
    "type": "xa",
    "name": "Tân Nhựt",
    "district": "Quận 8"
   },
   {
    "type": "phuong",
    "name": "Tân Tạo A",
    "district": "Quận 8"
   },
   {
    "type": "xa",
    "name": "Tân Kiên",
    "district": "Quận 8"
   },
   {
    "type": "phuong",
    "name": "16   sau khi sắp xếp theo quy định tại khoản 16",
    "district": "Quận 8"
   },
   {
    "type": "phuong",
    "name": "khoản 23 Điều này",
    "district": null
   }
  ]
 },
 {
  "no": 117,
  "type": "xa",
  "name": "Bình Chánh",
  "sources": [
   {
    "type": "xa",
    "name": "Tân Quý Tây",
    "district": null
   },
   {
    "type": "xa",
    "name": "Bình Chánh",
    "district": null
   },
   {
    "type": "xa",
    "name": "An Phú Tây",
    "district": null
   }
  ]
 },
 {
  "no": 118,
  "type": "xa",
  "name": "Hưng Long",
  "sources": [
   {
    "type": "xa",
    "name": "Đa Phước",
    "district": null
   },
   {
    "type": "xa",
    "name": "Qui Đức",
    "district": null
   },
   {
    "type": "xa",
    "name": "Hưng Long",
    "district": null
   }
  ]
 },
 {
  "no": 119,
  "type": "xa",
  "name": "Bình Hưng",
  "sources": [
   {
    "type": "xa",
    "name": "Phong Phú",
    "district": "Quận 8"
   },
   {
    "type": "xa",
    "name": "Bình Hưng",
    "district": "Quận 8"
   },
   {
    "type": "phuong",
    "name": "7",
    "district": "Quận 8"
   }
  ]
 },
 {
  "no": 120,
  "type": "xa",
  "name": "Bình Khánh",
  "sources": [
   {
    "type": "xa",
    "name": "Tam Thôn Hiệp",
    "district": null
   },
   {
    "type": "xa",
    "name": "Bình Khánh",
    "district": null
   },
   {
    "type": "xa",
    "name": "An Thới Đông",
    "district": null
   }
  ]
 },
 {
  "no": 121,
  "type": "xa",
  "name": "An Thới Đông",
  "sources": [
   {
    "type": "xa",
    "name": "Lý Nhơn",
    "district": null
   },
   {
    "type": "xa",
    "name": "An Thới Đông",
    "district": null
   }
  ]
 },
 {
  "no": 122,
  "type": "xa",
  "name": "Cần Giờ",
  "sources": [
   {
    "type": "xa",
    "name": "Long Hòa",
    "district": "Huyện Cần Giờ"
   },
   {
    "type": "thi-tran",
    "name": "Cần Thạnh",
    "district": null
   }
  ]
 },
 {
  "no": 123,
  "type": "xa",
  "name": "Củ Chi",
  "sources": [
   {
    "type": "xa",
    "name": "Tân Phú Trung",
    "district": null
   },
   {
    "type": "xa",
    "name": "Tân Thông Hội",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phước Vĩnh An",
    "district": null
   }
  ]
 },
 {
  "no": 124,
  "type": "xa",
  "name": "Tân An Hội",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Củ Chi",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phước Hiệp",
    "district": null
   },
   {
    "type": "xa",
    "name": "Tân An Hội",
    "district": null
   }
  ]
 },
 {
  "no": 125,
  "type": "xa",
  "name": "Thái Mỹ",
  "sources": [
   {
    "type": "xa",
    "name": "Trung Lập Thượng",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phước Thạnh",
    "district": null
   },
   {
    "type": "xa",
    "name": "Thái Mỹ",
    "district": null
   }
  ]
 },
 {
  "no": 126,
  "type": "xa",
  "name": "An Nhơn Tây",
  "sources": [
   {
    "type": "xa",
    "name": "Phú Mỹ Hưng",
    "district": null
   },
   {
    "type": "xa",
    "name": "An Phú",
    "district": null
   },
   {
    "type": "xa",
    "name": "An Nhơn Tây",
    "district": null
   }
  ]
 },
 {
  "no": 127,
  "type": "xa",
  "name": "Nhuận Đức",
  "sources": [
   {
    "type": "xa",
    "name": "Phạm Văn Cội",
    "district": null
   },
   {
    "type": "xa",
    "name": "Trung Lập Hạ",
    "district": null
   },
   {
    "type": "xa",
    "name": "Nhuận Đức",
    "district": null
   }
  ]
 },
 {
  "no": 128,
  "type": "xa",
  "name": "Phú Hòa Đông",
  "sources": [
   {
    "type": "xa",
    "name": "Tân Thạnh Tây",
    "district": null
   },
   {
    "type": "xa",
    "name": "Tân Thạnh Đông",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phú Hòa Đông",
    "district": null
   }
  ]
 },
 {
  "no": 129,
  "type": "xa",
  "name": "Bình Mỹ",
  "sources": [
   {
    "type": "xa",
    "name": "Bình Mỹ",
    "district": "Huyện Củ Chi"
   },
   {
    "type": "xa",
    "name": "Hòa Phú",
    "district": null
   },
   {
    "type": "xa",
    "name": "Trung An",
    "district": null
   }
  ]
 },
 {
  "no": 130,
  "type": "xa",
  "name": "Đông Thạnh",
  "sources": [
   {
    "type": "xa",
    "name": "Thới Tam Thôn",
    "district": null
   },
   {
    "type": "xa",
    "name": "Nhị Bình",
    "district": null
   },
   {
    "type": "xa",
    "name": "Đông Thạnh",
    "district": null
   }
  ]
 },
 {
  "no": 131,
  "type": "xa",
  "name": "Hóc Môn",
  "sources": [
   {
    "type": "xa",
    "name": "Tân Hiệp",
    "district": "Huyện Hóc Môn"
   },
   {
    "type": "xa",
    "name": "Tân Xuân",
    "district": null
   },
   {
    "type": "thi-tran",
    "name": "Hóc Môn",
    "district": null
   }
  ]
 },
 {
  "no": 132,
  "type": "xa",
  "name": "Xuân Thới Sơn",
  "sources": [
   {
    "type": "xa",
    "name": "Tân Thới Nhì",
    "district": null
   },
   {
    "type": "xa",
    "name": "Xuân Thới Đông",
    "district": null
   },
   {
    "type": "xa",
    "name": "Xuân Thới Sơn",
    "district": null
   }
  ]
 },
 {
  "no": 133,
  "type": "xa",
  "name": "Bà Điểm",
  "sources": [
   {
    "type": "xa",
    "name": "Xuân Thới Thượng",
    "district": null
   },
   {
    "type": "xa",
    "name": "Trung Chánh",
    "district": null
   },
   {
    "type": "xa",
    "name": "Bà Điểm",
    "district": null
   }
  ]
 },
 {
  "no": 134,
  "type": "xa",
  "name": "Nhà Bè",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Nhà Bè",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phú Xuân",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phước Kiển",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phước Lộc",
    "district": null
   }
  ]
 },
 {
  "no": 135,
  "type": "xa",
  "name": "Hiệp Phước",
  "sources": [
   {
    "type": "xa",
    "name": "Nhơn Đức",
    "district": null
   },
   {
    "type": "xa",
    "name": "Long Thới",
    "district": null
   },
   {
    "type": "xa",
    "name": "Hiệp Phước",
    "district": null
   }
  ]
 },
 {
  "no": 136,
  "type": "xa",
  "name": "Thường Tân",
  "sources": [
   {
    "type": "xa",
    "name": "Lạc An",
    "district": null
   },
   {
    "type": "xa",
    "name": "Hiếu Liêm",
    "district": null
   },
   {
    "type": "xa",
    "name": "Thường Tân",
    "district": null
   },
   {
    "type": "xa",
    "name": "Tân Mỹ",
    "district": null
   }
  ]
 },
 {
  "no": 137,
  "type": "xa",
  "name": "Bắc Tân Uyên",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Tân Thành",
    "district": null
   },
   {
    "type": "xa",
    "name": "Đất Cuốc",
    "district": null
   },
   {
    "type": "xa",
    "name": "Tân Định",
    "district": null
   }
  ]
 },
 {
  "no": 138,
  "type": "xa",
  "name": "Phú Giáo",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Phước Vĩnh",
    "district": null
   },
   {
    "type": "xa",
    "name": "An Bình",
    "district": null
   },
   {
    "type": "xa",
    "name": "Tam Lập",
    "district": null
   }
  ]
 },
 {
  "no": 139,
  "type": "xa",
  "name": "Phước Hòa",
  "sources": [
   {
    "type": "xa",
    "name": "Vĩnh Hòa",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phước Hòa",
    "district": null
   },
   {
    "type": "xa",
    "name": "Tam Lập",
    "district": null
   }
  ]
 },
 {
  "no": 140,
  "type": "xa",
  "name": "Phước Thành",
  "sources": [
   {
    "type": "xa",
    "name": "Tân Hiệp",
    "district": "Huyện Phú Giáo"
   },
   {
    "type": "xa",
    "name": "An Thái",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phước Sang",
    "district": null
   }
  ]
 },
 {
  "no": 141,
  "type": "xa",
  "name": "An Long",
  "sources": [
   {
    "type": "xa",
    "name": "An Linh",
    "district": null
   },
   {
    "type": "xa",
    "name": "Tân Long",
    "district": null
   },
   {
    "type": "xa",
    "name": "An Long",
    "district": null
   }
  ]
 },
 {
  "no": 142,
  "type": "xa",
  "name": "Trừ Văn Thố",
  "sources": [
   {
    "type": "xa",
    "name": "Trừ Văn Thố",
    "district": null
   },
   {
    "type": "xa",
    "name": "Cây Trường II",
    "district": null
   },
   {
    "type": "thi-tran",
    "name": "Lai Uyên",
    "district": null
   }
  ]
 },
 {
  "no": 143,
  "type": "xa",
  "name": "Bàu Bàng",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Lai Uyên",
    "district": null
   }
  ]
 },
 {
  "no": 144,
  "type": "xa",
  "name": "Long Hòa",
  "sources": [
   {
    "type": "xa",
    "name": "Long Tân",
    "district": "Huyện Dầu Tiếng"
   },
   {
    "type": "xa",
    "name": "Long Hòa",
    "district": "Huyện Dầu Tiếng"
   },
   {
    "type": "xa",
    "name": "Minh Tân",
    "district": null
   },
   {
    "type": "xa",
    "name": "Minh Thạnh",
    "district": null
   }
  ]
 },
 {
  "no": 145,
  "type": "xa",
  "name": "Thanh An",
  "sources": [
   {
    "type": "xa",
    "name": "Thanh An",
    "district": null
   },
   {
    "type": "xa",
    "name": "Định Hiệp",
    "district": null
   },
   {
    "type": "xa",
    "name": "Thanh Tuyền",
    "district": null
   },
   {
    "type": "xa",
    "name": "An Lập",
    "district": null
   }
  ]
 },
 {
  "no": 146,
  "type": "xa",
  "name": "Dầu Tiếng",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Dầu Tiếng",
    "district": null
   },
   {
    "type": "xa",
    "name": "Định An",
    "district": null
   },
   {
    "type": "xa",
    "name": "Định Thành",
    "district": null
   },
   {
    "type": "xa",
    "name": "Định Hiệp",
    "district": null
   }
  ]
 },
 {
  "no": 147,
  "type": "xa",
  "name": "Minh Thạnh",
  "sources": [
   {
    "type": "xa",
    "name": "Minh Hòa",
    "district": null
   },
   {
    "type": "xa",
    "name": "Minh Tân",
    "district": null
   },
   {
    "type": "xa",
    "name": "Minh Thạnh",
    "district": null
   }
  ]
 },
 {
  "no": 148,
  "type": "xa",
  "name": "Châu Pha",
  "sources": [
   {
    "type": "xa",
    "name": "Tóc Tiên",
    "district": null
   },
   {
    "type": "xa",
    "name": "Châu Pha",
    "district": null
   }
  ]
 },
 {
  "no": 149,
  "type": "xa",
  "name": "Long Hải",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Long Hải",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phước Tỉnh",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phước Hưng",
    "district": null
   }
  ]
 },
 {
  "no": 150,
  "type": "xa",
  "name": "Long Điền",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Long Điền",
    "district": null
   },
   {
    "type": "xa",
    "name": "Tam An",
    "district": null
   }
  ]
 },
 {
  "no": 151,
  "type": "xa",
  "name": "Phước Hải",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Phước Hải",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phước Hội",
    "district": null
   }
  ]
 },
 {
  "no": 152,
  "type": "xa",
  "name": "Đất Đỏ",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Đất Đỏ",
    "district": "Huyện Long Đất"
   },
   {
    "type": "xa",
    "name": "Long Tân",
    "district": "Huyện Long Đất"
   },
   {
    "type": "xa",
    "name": "Láng Dài",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phước Long Thọ",
    "district": null
   }
  ]
 },
 {
  "no": 153,
  "type": "xa",
  "name": "Nghĩa Thành",
  "sources": [
   {
    "type": "xa",
    "name": "Đá Bạc",
    "district": null
   },
   {
    "type": "xa",
    "name": "Nghĩa Thành",
    "district": null
   }
  ]
 },
 {
  "no": 154,
  "type": "xa",
  "name": "Ngãi Giao",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Ngãi Giao",
    "district": null
   },
   {
    "type": "xa",
    "name": "Bình Ba",
    "district": null
   },
   {
    "type": "xa",
    "name": "Suối Nghệ",
    "district": null
   }
  ]
 },
 {
  "no": 155,
  "type": "xa",
  "name": "Kim Long",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Kim Long",
    "district": null
   },
   {
    "type": "xa",
    "name": "Bàu Chinh",
    "district": null
   },
   {
    "type": "xa",
    "name": "Láng Lớn",
    "district": null
   }
  ]
 },
 {
  "no": 156,
  "type": "xa",
  "name": "Châu Đức",
  "sources": [
   {
    "type": "xa",
    "name": "Cù Bị",
    "district": null
   },
   {
    "type": "xa",
    "name": "Xà Bang",
    "district": null
   }
  ]
 },
 {
  "no": 157,
  "type": "xa",
  "name": "Bình Giã",
  "sources": [
   {
    "type": "xa",
    "name": "Bình Trung",
    "district": null
   },
   {
    "type": "xa",
    "name": "Quảng Thành",
    "district": null
   },
   {
    "type": "xa",
    "name": "Bình Giã",
    "district": null
   }
  ]
 },
 {
  "no": 158,
  "type": "xa",
  "name": "Xuân Sơn",
  "sources": [
   {
    "type": "xa",
    "name": "Suối Rao",
    "district": null
   },
   {
    "type": "xa",
    "name": "Sơn Bình",
    "district": null
   },
   {
    "type": "xa",
    "name": "Xuân Sơn",
    "district": null
   }
  ]
 },
 {
  "no": 159,
  "type": "xa",
  "name": "Hồ Tràm",
  "sources": [
   {
    "type": "thi-tran",
    "name": "Phước Bửu",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phước Tân",
    "district": null
   },
   {
    "type": "xa",
    "name": "Phước Thuận",
    "district": null
   }
  ]
 },
 {
  "no": 160,
  "type": "xa",
  "name": "Xuyên Mộc",
  "sources": [
   {
    "type": "xa",
    "name": "Bông Trang",
    "district": null
   },
   {
    "type": "xa",
    "name": "Bưng Riềng",
    "district": null
   },
   {
    "type": "xa",
    "name": "Xuyên Mộc",
    "district": null
   }
  ]
 },
 {
  "no": 161,
  "type": "xa",
  "name": "Hòa Hội",
  "sources": [
   {
    "type": "xa",
    "name": "Hòa Hưng",
    "district": null
   },
   {
    "type": "xa",
    "name": "Hòa Bình",
    "district": null
   },
   {
    "type": "xa",
    "name": "Hòa Hội",
    "district": null
   }
  ]
 },
 {
  "no": 162,
  "type": "xa",
  "name": "Bàu Lâm",
  "sources": [
   {
    "type": "xa",
    "name": "Tân Lâm",
    "district": null
   },
   {
    "type": "xa",
    "name": "Bàu Lâm",
    "district": null
   }
  ]
 },
 {
  "no": 163,
  "type": "dac-khu",
  "name": "Côn Đảo",
  "sources": [
   {
    "type": "dac-khu",
    "name": "huyện Côn Đảo thành đặc khu có tên gọi là đặc khu Côn Đảo.",
    "district": null
   }
  ]
 }
];
