import crypto from 'node:crypto';
import { query } from '@/lib/db';
import {
  ReviewItem,
  ProductReviewSummary,
  CreateReviewInput,
  ReviewFilterOptions,
} from '@/types/reviews';
import { containsBannedWords } from '@/config/bannedWords';

/**
 * Chuẩn hóa số điện thoại Việt Nam (loại bỏ ký tự lạ, chuyển +84 hoặc 84 về 0)
 */
export function normalizePhoneNumber(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  let clean = rawPhone.replace(/\D/g, '');
  if (clean.startsWith('84') && clean.length >= 11) {
    clean = '0' + clean.slice(2);
  }
  return clean;
}

// Danh sách đánh giá mẫu chất lượng cao cho toàn bộ dòng sản phẩm Thái Sơn Foods
export const SAMPLE_REVIEWS_SEED: Array<{
  id: string;
  productId: string;
  customerName: string;
  customerPhone: string;
  variantInfo: string;
  rating: number;
  title: string;
  comment: string;
  images?: string[];
  isVerifiedBuyer: boolean;
  helpfulCount: number;
  adminReply?: string;
  adminRepliedAt?: string;
  createdAt: string;
}> = [
  // ─── 1. SỮA BẮP NẾP TƯƠI (sua-bap-nep-thai-son) ───
  {
    id: 'rev_sb_01',
    productId: 'sua-bap-nep-thai-son',
    customerName: 'Nguyễn Thu Hà',
    customerPhone: '0903123456',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Vị bắp nếp béo thơm tự nhiên, cả nhà mình ai cũng mê',
    comment: 'Sữa bắp rất thơm, độ ngọt dịu vừa phải không bị gắt như các loại khác ngoài thị trường. Giao hàng đến nơi chai vẫn còn lạnh buốt, con nhỏ nhà mình sáng nào trước khi đi học cũng uống hết một chai. Sẽ tiếp tục ủng hộ Thái Sơn Foods lâu dài!',
    isVerifiedBuyer: true,
    helpfulCount: 25,
    adminReply: 'Dạ Thái Sơn Foods xin cảm ơn chị Thu Hà và gia đình đã tin dùng Sữa Bắp Nếp Tươi ạ! Chúc bé luôn khỏe mạnh và học giỏi!',
    createdAt: '2026-10-07T06:20:05.710Z',
    adminRepliedAt: '2026-10-08T06:20:05.716Z',
  },
  {
    id: 'rev_sb_02',
    productId: 'sua-bap-nep-thai-son',
    customerName: 'Trần Hoàng Minh',
    customerPhone: '0934677279',
    variantInfo: 'Thùng 24 chai (330ml)',
    rating: 5,
    title: 'Mua cho cả văn phòng công ty uống giờ giải lao',
    comment: 'Đặt nguyên thùng cho anh em công ty bồi dưỡng buổi xế. Uống mát lạnh, vị bắp nếp tự nhiên rất thật, thuần chay nên mấy bạn ăn chay trong team cũng uống được luôn. Đóng gói thùng carton chắc chắn, shipper giao hỏa tốc 1 tiếng là tới.',
    isVerifiedBuyer: true,
    helpfulCount: 19,
    createdAt: '2026-10-02T06:20:05.716Z',
  },
  {
    id: 'rev_sb_03',
    productId: 'sua-bap-nep-thai-son',
    customerName: 'Lê Thị Thanh Mai',
    customerPhone: '0918556677',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Giao hàng nhanh, chai sữa đọng đá mát lịm',
    comment: 'Chai sữa bắp béo ngậy, bắp tươi xay sánh mịn chứ không loãng. Uống lạnh cảm giác giải nhiệt đã khát vô cùng. Rất hài lòng với dịch vụ giao hàng chu đáo của shop.',
    isVerifiedBuyer: true,
    helpfulCount: 15,
    createdAt: '2026-09-25T06:20:05.716Z',
  },
  {
    id: 'rev_sb_04',
    productId: 'sua-bap-nep-thai-son',
    customerName: 'Phạm Đức Trọng',
    customerPhone: '0977889900',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Shipper giao xe thùng lạnh cực kỳ chuyên nghiệp',
    comment: 'Ấn tượng nhất là khâu bảo quản, giao tới chai sữa vẫn đọng hơi lạnh buốt tay. Date mới nấu trong ngày, hạn 7 ngày nên rất yên tâm về độ sạch và không hóa chất bảo quản.',
    isVerifiedBuyer: true,
    helpfulCount: 13,
    createdAt: '2026-09-18T06:20:05.716Z',
  },
  {
    id: 'rev_sb_05',
    productId: 'sua-bap-nep-thai-son',
    customerName: 'Hoàng Yến Nhi',
    customerPhone: '0988112233',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 4,
    title: 'Vị ngon xuất sắc, hy vọng có thêm dung tích lớn hơn',
    comment: 'Sữa bắp nếp rất hợp khẩu vị của mình, vị béo tự nhiên không bị gắt cổ. Giá hợp lý so với chất lượng. Mong hãng ra thêm dung tích lớn hơn để tiện để tủ lạnh dùng cho cả tuần.',
    isVerifiedBuyer: true,
    helpfulCount: 10,
    createdAt: '2026-09-09T06:20:05.716Z',
  },
  {
    id: 'rev_sb_06',
    productId: 'sua-bap-nep-thai-son',
    customerName: 'Võ Minh Quân',
    customerPhone: '0909445566',
    variantInfo: 'Lốc 10 chai (330ml)',
    rating: 5,
    title: 'Sữa dinh dưỡng thuần chay chuẩn vị miền Tây',
    comment: 'Mình tìm kiếm dòng sữa hạt thuần chay không pha bột sữa động vật bấy lâu nay. Thái Sơn Foods làm chuẩn vị bắp tươi thơm lừng, uống xong thấy nhẹ bụng tiêu hóa tốt.',
    isVerifiedBuyer: true,
    helpfulCount: 8,
    createdAt: '2026-09-04T06:20:05.716Z',
  },

  // ─── 2. NƯỚC TÁO ĐỎ HẠT CHIA (tao-do-hat-chia-thai-son) ───
  {
    id: 'rev_td_01',
    productId: 'tao-do-hat-chia-thai-son',
    customerName: 'Nguyễn Thảo Vy',
    customerPhone: '0912445566',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Vị thanh mát bổ dưỡng, hạt chia nở đều uống thích mê',
    comment: 'Nước táo đỏ kỷ tử hạt chia vị ngọt thanh tự nhiên rất dễ chịu, không hề bị khé cổ như nước ngọt đóng lon. Mình để ngăn mát uống sau giờ tập yoga thấy cơ thể nhẹ nhõm và tỉnh táo hẳn. Hạt chia nở mềm giòn li ti, táo đỏ thơm dịu. Đã đặt mua tiếp lốc thứ hai!',
    isVerifiedBuyer: true,
    helpfulCount: 28,
    adminReply: 'Dạ Thái Sơn Foods xin cảm ơn bạn Thảo Vy đã yêu thích dòng sản phẩm Nước Táo Đỏ Hạt Chia thanh mát ạ! Chúc bạn luôn rạng rỡ và tràn đầy năng lượng!',
    createdAt: '2026-10-08T09:15:00.000Z',
    adminRepliedAt: '2026-10-08T14:30:00.000Z',
  },
  {
    id: 'rev_td_02',
    productId: 'tao-do-hat-chia-thai-son',
    customerName: 'Trần Minh Đức',
    customerPhone: '0938112244',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Món quà sức khỏe tuyệt vời cho bố mẹ',
    comment: 'Mua biếu bố mẹ dùng thử, ông bà khen nức nở vì vừa thơm táo đỏ vừa thanh nhiệt mát gan. Thành phần tự nhiên chuẩn HACCP lại không chất bảo quản nên rất an tâm cho người lớn tuổi. Giao hàng hỏa tốc trong thùng xốp giữ lạnh rất chu đáo.',
    isVerifiedBuyer: true,
    helpfulCount: 22,
    createdAt: '2026-10-05T08:30:00.000Z',
  },
  {
    id: 'rev_td_03',
    productId: 'tao-do-hat-chia-thai-son',
    customerName: 'Lê Hoàng Oanh',
    customerPhone: '0909334455',
    variantInfo: 'Lốc 10 chai (330ml)',
    rating: 5,
    title: 'Uống mỗi sáng giúp tiêu hóa tốt và đẹp da',
    comment: 'Mình uống đều đặn mỗi sáng trước bữa điểm tâm, thấy tiêu hóa nhẹ nhàng hơn hẳn nhờ hàm lượng chất xơ dồi dào từ hạt chia. Vị ngọt vừa vặn, thơm ngát mùi táo đỏ thảo mộc. Chai cầm chắc tay, mang đi làm rất tiện lợi.',
    isVerifiedBuyer: true,
    helpfulCount: 16,
    createdAt: '2026-09-28T10:00:00.000Z',
  },
  {
    id: 'rev_td_04',
    productId: 'tao-do-hat-chia-thai-son',
    customerName: 'Vũ Bích Hạnh',
    customerPhone: '0978556677',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 4,
    title: 'Nước uống rất ngon, mong shop ra thêm size lớn',
    comment: 'Chất lượng nước táo đỏ hạt chia không có điểm gì chê, thơm lành và tươi mới. Chỉ mong hãng sớm ra thêm chai dung tích 500ml hoặc bình lớn để gia đình uống được thoải mái hơn.',
    isVerifiedBuyer: true,
    helpfulCount: 12,
    createdAt: '2026-09-20T11:20:00.000Z',
  },
  {
    id: 'rev_td_05',
    productId: 'tao-do-hat-chia-thai-son',
    customerName: 'Phạm Quốc Tuấn',
    customerPhone: '0983223344',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Giải nhiệt ngày nóng siêu hiệu quả, shipper thân thiện',
    comment: 'Giữa trưa nắng nhận được lốc nước mát lạnh sảng khoái không gì bằng. Shipper giao tận cửa phòng chung cư, bảo quản chu đáo chai còn đọng sương mát lịm. Đánh giá 5 sao cho chất lượng dịch vụ của Thái Sơn Foods!',
    isVerifiedBuyer: true,
    helpfulCount: 9,
    createdAt: '2026-09-12T15:45:00.000Z',
  },

  // ─── 3. SỮA HẠT SEN MEKONG XANH (sua-hat-sen-mekong-xanh) ───
  {
    id: 'rev_shs_01',
    productId: 'sua-hat-sen-mekong-xanh',
    customerName: 'Đặng Ngọc Lan',
    customerPhone: '0912334455',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Sữa hạt sen ngọt thanh mát lành, thơm bùi dễ ngủ',
    comment: 'Hạt sen tươi nấu sánh mịn, vị thanh không ngọt gắt. Buổi tối uống 1 chai hâm ấm ngủ rất ngon. Cả nhà mình đều chuyển sang dùng sữa hạt Thái Sơn thay cho đồ uống có ga.',
    isVerifiedBuyer: true,
    helpfulCount: 21,
    createdAt: '2026-10-06T06:20:05.716Z',
  },
  {
    id: 'rev_shs_02',
    productId: 'sua-hat-sen-mekong-xanh',
    customerName: 'Bùi Anh Tuấn',
    customerPhone: '0938778899',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Vị sen thơm ngậy đậm đà, đóng gói cẩn thận',
    comment: 'Giao hàng đúng hẹn, chai sạch sẽ tem nhãn rõ ràng. Uống cảm nhận rõ vị hạt sen Đồng Tháp bùi bùi chứ không phải hương liệu tổng hợp.',
    isVerifiedBuyer: true,
    helpfulCount: 14,
    createdAt: '2026-09-29T06:20:05.716Z',
  },
  {
    id: 'rev_shs_03',
    productId: 'sua-hat-sen-mekong-xanh',
    customerName: 'Nguyễn Thị Mai Hương',
    customerPhone: '0904556677',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Hạt sen tươi Đồng Tháp sánh mịn, bùi ngậy tự nhiên',
    comment: 'Sữa sánh bùi, đậm vị hạt sen nguyên chất kết hợp đậu xanh đậu trắng béo thanh. Uống vào buổi tối giúp ngủ sâu giấc hơn rất nhiều. Cả nhà mình từ bé 4 tuổi đến bà ngoại đều rất thích.',
    isVerifiedBuyer: true,
    helpfulCount: 18,
    createdAt: '2026-09-21T07:15:00.000Z',
  },
  {
    id: 'rev_shs_04',
    productId: 'sua-hat-sen-mekong-xanh',
    customerName: 'Hoàng Đăng Khoa',
    customerPhone: '0971223344',
    variantInfo: 'Lốc 10 chai (330ml)',
    rating: 5,
    title: 'Giải pháp bữa sáng dinh dưỡng nhanh gọn cho dân văn phòng',
    comment: 'Sáng dậy vội đi làm chỉ cần cầm theo 1 chai sữa hạt sen mát lạnh là đủ năng lượng đến trưa, không lo cồn cào ruột. Cực kỳ tiện lợi và tốt cho dạ dày.',
    isVerifiedBuyer: true,
    helpfulCount: 11,
    createdAt: '2026-09-14T08:00:00.000Z',
  },

  // ─── 4. SỮA GẠO LỨT MEKONG XANH (sua-gao-lut-mekong-xanh) ───
  {
    id: 'rev_sgl_01',
    productId: 'sua-gao-lut-mekong-xanh',
    customerName: 'Trương Mỹ Linh',
    customerPhone: '0945667788',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Sữa gạo lứt mè đen thơm bùi rất tốt cho vóc dáng',
    comment: 'Mình uống thay thế bữa sáng kết hợp ăn kiêng healthy, vừa no lâu vừa đầy đủ dinh dưỡng. Rất khuyến khích cho các bạn eat clean!',
    isVerifiedBuyer: true,
    helpfulCount: 16,
    createdAt: '2026-10-05T06:20:05.716Z',
  },
  {
    id: 'rev_sgl_02',
    productId: 'sua-gao-lut-mekong-xanh',
    customerName: 'Phan Nhật Minh',
    customerPhone: '0933112233',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Thức uống thực dưỡng thanh đạm, hương gạo rang thơm nức',
    comment: 'Mở nắp ra là thơm lừng mùi gạo lứt huyết rồng rang củi. Vị thanh đạm, ít ngọt chuẩn gu người theo lối sống healthy thực dưỡng. Rất khuyến khích mọi người dùng.',
    isVerifiedBuyer: true,
    helpfulCount: 20,
    createdAt: '2026-09-27T09:30:00.000Z',
  },
  {
    id: 'rev_sgl_03',
    productId: 'sua-gao-lut-mekong-xanh',
    customerName: 'Lê Kim Ngân',
    customerPhone: '0982334455',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Hỗ trợ giữ dáng hiệu quả, no lâu nhẹ bụng',
    comment: 'Uống vào bữa phụ chiều giúp dứt hẳn cơn thèm trà sữa hay đồ ngọt linh tinh. Giàu chất xơ nên tiêu hóa rất êm. Đã đăng ký gói giao định kỳ hàng tuần.',
    isVerifiedBuyer: true,
    helpfulCount: 14,
    createdAt: '2026-09-17T14:10:00.000Z',
  },

  // ─── 5. NHA ĐAM MỦ TRÔM THÁI SƠN (nha-dam-mu-trom-thai-son) ───
  {
    id: 'rev_md_01',
    productId: 'nha-dam-mu-trom-thai-son',
    customerName: 'Ngô Quốc Bảo',
    customerPhone: '0966332211',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Nha đam giòn sần sật, mủ trôm mát gan giải nhiệt đỉnh cao',
    comment: 'Thạch nha đam nhiều, giòn tươi không bị nhớt, vị đường phèn lá dứa thanh mát. Mùa nóng uống chai này tỉnh cả người.',
    isVerifiedBuyer: true,
    helpfulCount: 19,
    createdAt: '2026-10-06T06:20:05.716Z',
  },
  {
    id: 'rev_md_02',
    productId: 'nha-dam-mu-trom-thai-son',
    customerName: 'Trần Thị Thu Thủy',
    customerPhone: '0908778899',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Nha đam giòn tươi nhiều thạch, lá dứa thơm nức mũi',
    comment: 'Thạch nha đam được sơ chế rất khéo, giòn tan không hề bị đắng hay tanh nhớt. Nước đường phèn lá dứa ngọt thanh dịu. Trời Sài Gòn oi bức làm một chai này là đã khát ngay tức khắc.',
    isVerifiedBuyer: true,
    helpfulCount: 25,
    createdAt: '2026-09-30T10:45:00.000Z',
  },
  {
    id: 'rev_md_03',
    productId: 'nha-dam-mu-trom-thai-son',
    customerName: 'Đỗ Minh Khang',
    customerPhone: '0919223344',
    variantInfo: 'Lốc 10 chai (330ml)',
    rating: 5,
    title: 'Mát gan giải độc, da dẻ mịn màng hơn',
    comment: 'Mủ trôm kết hợp nha đam uống vào mát người từ trong ra ngoài. Mình hay bị nhiệt miệng uống liên tục 3 ngày thấy đỡ hẳn. Chai đóng nắp kín vệ sinh, ship lạnh tận nơi.',
    isVerifiedBuyer: true,
    helpfulCount: 17,
    createdAt: '2026-09-19T16:20:00.000Z',
  },

  // ─── 6. NƯỚC SÂM LA HÁN HOA CÚC (sam-la-han-hoa-cuc-thai-son) ───
  {
    id: 'rev_slh_01',
    productId: 'sam-la-han-hoa-cuc-thai-son',
    customerName: 'Lý Gia Hân',
    customerPhone: '0937665544',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Sâm thảo mộc chuẩn vị cổ truyền, thanh giọng mát họng',
    comment: 'Vị la hán quả ngọt hậu tự nhiên kết hợp hoa cúc và atiso thanh nhẹ, uống vào mát tận cuống họng. Mình làm nghề giáo viên nói nhiều, ngày nào cũng để sẵn 1 chai uống giữ giọng rất tốt.',
    isVerifiedBuyer: true,
    helpfulCount: 24,
    createdAt: '2026-10-04T08:20:00.000Z',
  },
  {
    id: 'rev_slh_02',
    productId: 'sam-la-han-hoa-cuc-thai-son',
    customerName: 'Dương Thanh Tùng',
    customerPhone: '0981443322',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Thức uống giải nhiệt mùa hè không đối thủ',
    comment: 'Nước sâm nấu từ thảo mộc thật chứ không phải phẩm màu hương liệu hóa học. Uống xong cảm giác sảng khoái thanh mát không bị đọng vị chua ở miệng.',
    isVerifiedBuyer: true,
    helpfulCount: 15,
    createdAt: '2026-09-22T13:40:00.000Z',
  },

  // ─── 7. TRÀ SỮA CIAO (tra-sua-ciao) ───
  {
    id: 'rev_ciao_01',
    productId: 'tra-sua-ciao',
    customerName: 'Nguyễn Thùy Dương',
    customerPhone: '0905112233',
    variantInfo: 'Lốc 7 chai (270ml)',
    rating: 5,
    title: 'Đậm vị trà, béo ngậy sữa mà kèm trân châu giòn sần sật',
    comment: 'Trân châu đóng chai sẵn mà vẫn giữ được độ dai giòn, không bị sượng hay bở nát. Vị trà đậm đà, thơm béo nhưng không bị ngọt ngấy. Cực kỳ ngon và tiện lợi khi mang đến trường học!',
    isVerifiedBuyer: true,
    helpfulCount: 21,
    createdAt: '2026-10-03T11:10:00.000Z',
  },
  {
    id: 'rev_ciao_02',
    productId: 'tra-sua-ciao',
    customerName: 'Vũ Đức Nam',
    customerPhone: '0932445566',
    variantInfo: 'Lốc 7 chai (270ml)',
    rating: 5,
    title: 'Ngon hơn mong đợi, trân châu dai ngon',
    comment: 'Mới đầu mua thử vì tò mò trà sữa trân châu đóng chai, uống xong bất ngờ vì độ ngon. Trà thơm rõ vị, vị sữa ngọt béo cân đối. Sẽ tiếp tục mua lại.',
    isVerifiedBuyer: true,
    helpfulCount: 13,
    createdAt: '2026-09-24T14:50:00.000Z',
  },

  // ─── 8. MATCHA TRÀ SỮA CIAO (matcha-tra-sua-ciao) ───
  {
    id: 'rev_mciao_01',
    productId: 'matcha-tra-sua-ciao',
    customerName: 'Phan Bảo Trâm',
    customerPhone: '0973889900',
    variantInfo: 'Lốc 7 chai (270ml)',
    rating: 5,
    title: 'Matcha thơm đậm, hậu vị chát nhẹ ngọt thanh rất mê',
    comment: 'Hương matcha tự nhiên không nồng mùi hương liệu. Màu xanh ngọc bắt mắt, trân châu sần sật vui miệng. Team nghiện matcha nhất định phải thử chai này!',
    isVerifiedBuyer: true,
    helpfulCount: 18,
    createdAt: '2026-10-01T15:20:00.000Z',
  },

  // ─── 9. TRÀ XANH GO (tra-xanh-go) ───
  {
    id: 'rev_txg_01',
    productId: 'tra-xanh-go',
    customerName: 'Trịnh Khánh Linh',
    customerPhone: '0915667788',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Trà xanh thanh khiết, thạch trân châu giòn đã khát',
    comment: 'Vị trà xanh thơm dịu mát, không bị chát gắt. Uống vào giữa giờ làm việc giúp tỉnh táo và giảm căng thẳng tức thì. Rất thích hợp uống lạnh.',
    isVerifiedBuyer: true,
    helpfulCount: 16,
    createdAt: '2026-09-26T16:00:00.000Z',
  },

  // ─── 10. TRÀ SỮA GO (tra-sua-go) ───
  {
    id: 'rev_tsg_01',
    productId: 'tra-sua-go',
    customerName: 'Lâm Tuấn Kiệt',
    customerPhone: '0987112233',
    variantInfo: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Trà sữa đóng chai chuẩn vị truyền thống, giá mềm',
    comment: 'Vị trà đậm, ngậy béo vừa phải, để tủ lạnh uống rất sướng. Giá 18k một chai chất lượng như quán trà sữa thương hiệu lớn.',
    isVerifiedBuyer: true,
    helpfulCount: 12,
    createdAt: '2026-09-20T17:30:00.000Z',
  },

  // ─── 11. SỮA HẠT SEN LOTUS YOO (sua-hat-sen-lotus-yoo) ───
  {
    id: 'rev_lotus_01',
    productId: 'sua-hat-sen-lotus-yoo',
    customerName: 'Huỳnh Minh Tâm',
    customerPhone: '0902334455',
    variantInfo: 'Lốc 5 chai (568ml)',
    rating: 5,
    title: 'Chai lớn 568ml uống thả ga, sữa hạt sen thơm bùi đậm vị',
    comment: 'Dung tích 568ml cực kỳ kinh tế cho gia đình. Vị sữa sen Lotus Yoo thơm bùi nguyên chất, sánh mịn. Nhà mình mua 2 lốc để tủ lạnh dùng cho cả tuần ai cũng ưng ý.',
    isVerifiedBuyer: true,
    helpfulCount: 22,
    createdAt: '2026-10-04T12:00:00.000Z',
  },

  // ─── 12. SỮA GẠO LỨT OHSAWA YOO (sua-gao-lut-ohsawa-yoo) ───
  {
    id: 'rev_ohsawa_01',
    productId: 'sua-gao-lut-ohsawa-yoo',
    customerName: 'Cao Nhật Hà',
    customerPhone: '0943556677',
    variantInfo: 'Lốc 5 chai (568ml)',
    rating: 5,
    title: 'Thực dưỡng chuẩn Ohsawa, thơm ngát mùi gạo lứt rang',
    comment: 'Mình theo chế độ thực dưỡng Ohsawa nhiều năm, tìm được chai sữa gạo lứt chuẩn vị này mừng rơi nước mắt. Không đường hóa học, thơm đậm mùi gạo rang, uống nhẹ bụng no lâu.',
    isVerifiedBuyer: true,
    helpfulCount: 20,
    createdAt: '2026-10-02T13:30:00.000Z',
  },
];

let hasSeededSampleReviews = false;

// ── In-Memory Resilient Store for 100% Uptime on Cloud / Vercel ──
// Đảm bảo hệ thống đánh giá hoạt động trơn tru ngay cả khi DB chưa cấu hình hoặc rớt kết nối
// 2026-11-03: không còn nạp đánh giá mẫu vào bộ nhớ dự phòng — chỉ hiện đánh giá thật của khách.
const memoryReviews: ReviewItem[] = ([] as typeof SAMPLE_REVIEWS_SEED).map((item) => ({
  id: item.id,
  productId: item.productId,
  userId: null,
  orderId: null,
  customerName: item.customerName,
  variantInfo: item.variantInfo,
  rating: item.rating,
  title: item.title,
  comment: item.comment,
  images: item.images || [],
  isVerifiedBuyer: item.isVerifiedBuyer,
  status: 'APPROVED',
  helpfulCount: item.helpfulCount,
  adminReply: item.adminReply || null,
  adminRepliedAt: item.adminRepliedAt || null,
  createdAt: item.createdAt,
}));

const memoryVotes = new Set<string>();

/**
 * Lọc và phân trang đánh giá từ bộ nhớ dự phòng (Resilient fallback)
 */
function queryMemoryReviews(
  productKeys: string[],
  options: ReviewFilterOptions = {}
): { reviews: ReviewItem[]; total: number } {
  const { rating, verifiedOnly, hasImagesOnly, sort = 'helpful', page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  let filtered = memoryReviews.filter(
    (item) => productKeys.includes(item.productId) && item.status === 'APPROVED'
  );

  if (rating && rating >= 1 && rating <= 5) {
    filtered = filtered.filter((item) => item.rating === rating);
  }

  if (verifiedOnly) {
    filtered = filtered.filter((item) => item.isVerifiedBuyer);
  }

  if (hasImagesOnly) {
    filtered = filtered.filter((item) => item.images && item.images.length > 0);
  }

  if (sort === 'helpful') {
    filtered.sort(
      (a, b) =>
        b.helpfulCount - a.helpfulCount ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } else {
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const total = filtered.length;
  const reviews = filtered.slice(offset, offset + limit);
  return { reviews, total };
}

/**
 * Tính toán tóm tắt điểm số và breakdown từ bộ nhớ dự phòng
 */
function computeMemoryReviewSummary(productKeys: string[]): ProductReviewSummary {
  const matching = memoryReviews.filter(
    (item) => productKeys.includes(item.productId) && item.status === 'APPROVED'
  );

  let count5 = 0;
  let count4 = 0;
  let count3 = 0;
  let count2 = 0;
  let count1 = 0;
  let verifiedCount = 0;

  for (const r of matching) {
    if (r.rating === 5) count5++;
    else if (r.rating === 4) count4++;
    else if (r.rating === 3) count3++;
    else if (r.rating === 2) count2++;
    else if (r.rating === 1) count1++;
    if (r.isVerifiedBuyer) verifiedCount++;
  }

  const totalReviews = count5 + count4 + count3 + count2 + count1;
  const weightedSum = count5 * 5 + count4 * 4 + count3 * 3 + count2 * 2 + count1 * 1;
  const averageRating = totalReviews > 0 ? Number((weightedSum / totalReviews).toFixed(1)) : 0;

  const breakdown = [
    { stars: 5, count: count5, percentage: totalReviews > 0 ? Math.round((count5 / totalReviews) * 100) : 0 },
    { stars: 4, count: count4, percentage: totalReviews > 0 ? Math.round((count4 / totalReviews) * 100) : 0 },
    { stars: 3, count: count3, percentage: totalReviews > 0 ? Math.round((count3 / totalReviews) * 100) : 0 },
    { stars: 2, count: count2, percentage: totalReviews > 0 ? Math.round((count2 / totalReviews) * 100) : 0 },
    { stars: 1, count: count1, percentage: totalReviews > 0 ? Math.round((count1 / totalReviews) * 100) : 0 },
  ];

  return {
    averageRating,
    totalReviews,
    verifiedReviewsCount: verifiedCount,
    breakdown,
  };
}

/**
 * Lấy danh sách đánh giá cho admin từ bộ nhớ dự phòng
 */
export function getAdminMemoryReviews(options: {
  status?: string | null;
  productId?: string | null;
  page?: number;
  limit?: number;
}): { reviews: ReviewItem[]; total: number } {
  let filtered = [...memoryReviews];
  if (options.status && options.status !== 'ALL') {
    filtered = filtered.filter((r) => r.status === options.status);
  }
  if (options.productId) {
    const q = options.productId.toLowerCase();
    filtered = filtered.filter((r) => r.productId.toLowerCase().includes(q));
  }
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const page = options.page || 1;
  const limit = options.limit || 50;
  const offset = (page - 1) * limit;
  return {
    reviews: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

/**
 * Tự động chèn đánh giá mẫu nếu cơ sở dữ liệu chưa có
 */
export async function seedSampleReviewsIfEmpty(): Promise<void> {
  // 2026-11-03: tắt chèn đánh giá mẫu (gây hiểu lầm cho khách). Bỏ dòng return này nếu cần bật lại.
  hasSeededSampleReviews = true;
  if (hasSeededSampleReviews) return;
  try {
    for (const item of SAMPLE_REVIEWS_SEED) {
      await query(
        `INSERT INTO product_reviews (
          id, product_id, customer_name, customer_phone, variant_info, rating,
          title, comment, images, is_verified_buyer, status, helpful_count,
          admin_reply, admin_replied_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[]'::jsonb, $9, 'APPROVED', $10, $11, $12, $13, $13)
        ON CONFLICT (id) DO NOTHING;`,
        [
          item.id,
          item.productId,
          item.customerName,
          item.customerPhone,
          item.variantInfo,
          item.rating,
          item.title,
          item.comment,
          item.isVerifiedBuyer,
          item.helpfulCount,
          item.adminReply || null,
          item.adminRepliedAt || null,
          item.createdAt,
        ]
      );
    }
    hasSeededSampleReviews = true;
  } catch (err) {
    console.warn('Notice in seedSampleReviewsIfEmpty:', err);
  }
}

/**
 * Tự động đảm bảo schema bảng đánh giá luôn tồn tại trên mọi môi trường (kể cả Vercel)
 */
export async function ensureReviewsSchema(): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS product_reviews (
      id VARCHAR(64) PRIMARY KEY,
      product_id VARCHAR(100) NOT NULL,
      user_id VARCHAR(64),
      order_id VARCHAR(64),
      customer_name VARCHAR(150) NOT NULL,
      customer_phone VARCHAR(30),
      variant_info VARCHAR(100) DEFAULT 'Lốc 7 chai (330ml)',
      rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      title VARCHAR(255) NOT NULL,
      comment TEXT NOT NULL,
      images JSONB DEFAULT '[]'::jsonb,
      is_verified_buyer BOOLEAN NOT NULL DEFAULT false,
      status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
      helpful_count INT NOT NULL DEFAULT 0,
      admin_reply TEXT,
      admin_replied_at TIMESTAMPTZ,
      admin_replied_by VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_product_status ON product_reviews (product_id, status);
    CREATE INDEX IF NOT EXISTS idx_reviews_rating ON product_reviews (product_id, rating);
    CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON product_reviews (created_at DESC);

    CREATE TABLE IF NOT EXISTS review_helpful_votes (
      id VARCHAR(64) PRIMARY KEY,
      review_id VARCHAR(64) NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
      user_id VARCHAR(64),
      fingerprint VARCHAR(128) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(review_id, fingerprint)
    );

    CREATE TABLE IF NOT EXISTS review_rate_limits (
      id VARCHAR(64) PRIMARY KEY,
      ip_address VARCHAR(64) NOT NULL,
      phone VARCHAR(30),
      user_id VARCHAR(64),
      product_id VARCHAR(100) NOT NULL,
      comment_hash VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_created ON review_rate_limits(ip_address, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_rate_limits_phone_prod ON review_rate_limits(phone, product_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_rate_limits_hash ON review_rate_limits(comment_hash, created_at DESC);
  `;
  try {
    await query(ddl);
    await seedSampleReviewsIfEmpty();
  } catch (err: any) {
    console.warn('Notice in ensureReviewsSchema (DB offline):', err?.message);
  }
}

/**
 * Chuẩn hóa các định danh sản phẩm tương đương (slug và ID)
 */
function normalizeProductIdVariants(productId: string): string[] {
  const clean = productId.trim().toLowerCase();
  const variants = new Set<string>([clean]);

  // Hỗ trợ định danh combo tách bạch ("combo:<slug>", "combo-<slug>", "<slug>")
  if (clean.startsWith('combo:')) {
    const raw = clean.slice(6);
    variants.add(raw);
    variants.add(`combo-${raw}`);
  } else if (clean.startsWith('combo-')) {
    const raw = clean.slice(6);
    variants.add(raw);
    variants.add(`combo:${raw}`);
  }

  if (clean.includes('sua-bap-nep') || clean.includes('sb-01')) {
    variants.add('sua-bap-nep-thai-son');
    variants.add('prod-sb-01');
    variants.add('sua-bap-nep');
  } else if (clean.includes('lotus-yoo') || clean.includes('lotus')) {
    variants.add('sua-hat-sen-lotus-yoo');
    variants.add('sua-hat-sen-lotus');
  } else if (clean.includes('sua-hat-sen') || clean.includes('shs-01')) {
    variants.add('sua-hat-sen-mekong-xanh');
    variants.add('sua-hat-sen-mekong');
    variants.add('prod-shs-01');
    variants.add('sua-hat-sen');
  } else if (clean.includes('ohsawa-yoo') || clean.includes('ohsawa')) {
    variants.add('sua-gao-lut-ohsawa-yoo');
    variants.add('sua-gao-lut-ohsawa');
  } else if (clean.includes('gao-lut') || clean.includes('sgl-01')) {
    variants.add('sua-gao-lut-mekong-xanh');
    variants.add('sua-gao-lut-mekong');
    variants.add('prod-sgl-01');
    variants.add('sua-gao-lut');
  } else if (clean.includes('nha-dam') || clean.includes('md-01')) {
    variants.add('nha-dam-mu-trom-thai-son');
    variants.add('nha-dam-mu-trom');
    variants.add('prod-md-01');
  } else if (clean.includes('tao-do') || clean.includes('td-01')) {
    variants.add('tao-do-hat-chia-thai-son');
    variants.add('tao-do-hat-chia');
    variants.add('prod-td-01');
  } else if (clean.includes('sam-la-han') || clean.includes('slh-01')) {
    variants.add('sam-la-han-hoa-cuc-thai-son');
    variants.add('sam-la-han-hoa-cuc');
    variants.add('prod-slh-01');
  } else if (clean.includes('matcha') || clean.includes('m-ciao')) {
    variants.add('matcha-tra-sua-ciao');
  } else if (clean.includes('tra-sua-ciao') || clean.includes('ciao')) {
    variants.add('tra-sua-ciao');
  } else if (clean.includes('tra-xanh-go') || clean.includes('tx-go')) {
    variants.add('tra-xanh-go');
  } else if (clean.includes('tra-sua-go') || clean.includes('ts-go')) {
    variants.add('tra-sua-go');
  }

  return Array.from(variants);
}

/**
 * Lấy danh sách đánh giá của sản phẩm kèm bộ lọc
 */
export async function getProductReviews(
  productId: string,
  options: ReviewFilterOptions = {}
): Promise<{ reviews: ReviewItem[]; total: number }> {
  const productKeys = normalizeProductIdVariants(productId);

  try {
    await ensureReviewsSchema();

    const { rating, verifiedOnly, hasImagesOnly, sort = 'helpful', page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const whereClauses = [`product_id = ANY($1)`, `status = 'APPROVED'`];
    const queryParams: any[] = [productKeys];
    let paramIndex = 2;

    if (rating && rating >= 1 && rating <= 5) {
      whereClauses.push(`rating = $${paramIndex}`);
      queryParams.push(rating);
      paramIndex++;
    }

    if (verifiedOnly) {
      whereClauses.push(`is_verified_buyer = true`);
    }

    if (hasImagesOnly) {
      whereClauses.push(`jsonb_array_length(images) > 0`);
    }

    const whereSql = whereClauses.join(' AND ');
    const sortSql = sort === 'helpful' ? `helpful_count DESC, created_at DESC` : `created_at DESC`;

    const countRes = await query(
      `SELECT count(*)::int as count FROM product_reviews WHERE ${whereSql};`,
      queryParams
    );
    const total = countRes.rows[0]?.count || 0;

    const dataSql = `
      SELECT 
        id, product_id AS "productId", user_id AS "userId", order_id AS "orderId",
        customer_name AS "customerName", variant_info AS "variantInfo", rating,
        title, comment, images, is_verified_buyer AS "isVerifiedBuyer",
        status, helpful_count AS "helpfulCount", admin_reply AS "adminReply",
        admin_replied_at AS "adminRepliedAt", created_at AS "createdAt"
      FROM product_reviews
      WHERE ${whereSql}
      ORDER BY ${sortSql}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;
    queryParams.push(limit, offset);

    const res = await query(dataSql, queryParams);
    const reviews: ReviewItem[] = res.rows.map((row) => ({
      ...row,
      images: Array.isArray(row.images) ? row.images : [],
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      adminRepliedAt: row.adminRepliedAt ? new Date(row.adminRepliedAt).toISOString() : null,
    }));

    // Fallback an toàn bảo đảm không bao giờ bị trống đánh giá
    if (reviews.length === 0) {
      return queryMemoryReviews(productKeys, options);
    }

    return { reviews, total };
  } catch (err: any) {
    console.warn('[getProductReviews] Database query unavailable, serving from resilient memory store:', err?.message);
    return queryMemoryReviews(productKeys, options);
  }
}

/**
 * Lấy tóm tắt đánh giá (Điểm trung bình, tổng lượt, biểu đồ % từng sao)
 */
export async function getProductReviewSummary(productId: string): Promise<ProductReviewSummary> {
  const productKeys = normalizeProductIdVariants(productId);

  try {
    await ensureReviewsSchema();

    const res = await query(
      `SELECT 
         rating, 
         count(*)::int as count,
         sum(CASE WHEN is_verified_buyer THEN 1 ELSE 0 END)::int as verified_count
       FROM product_reviews
       WHERE product_id = ANY($1) AND status = 'APPROVED'
       GROUP BY rating;`,
      [productKeys]
    );

    // Thống kê chính xác từ dữ liệu đánh giá thực tế trong cơ sở dữ liệu
    let count5 = 0;
    let count4 = 0;
    let count3 = 0;
    let count2 = 0;
    let count1 = 0;
    let verifiedCount = 0;

    // Cộng dồn các đánh giá đã được duyệt (APPROVED)
    for (const r of res.rows) {
      const star = Number(r.rating);
      const cnt = Number(r.count);
      const ver = Number(r.verified_count);
      if (star === 5) count5 += cnt;
      else if (star === 4) count4 += cnt;
      else if (star === 3) count3 += cnt;
      else if (star === 2) count2 += cnt;
      else if (star === 1) count1 += cnt;
      verifiedCount += ver;
    }

    const totalReviews = count5 + count4 + count3 + count2 + count1;
    const weightedSum = count5 * 5 + count4 * 4 + count3 * 3 + count2 * 2 + count1 * 1;
    const averageRating = totalReviews > 0 ? Number((weightedSum / totalReviews).toFixed(1)) : 0;

    const breakdown = [
      { stars: 5, count: count5, percentage: totalReviews > 0 ? Math.round((count5 / totalReviews) * 100) : 0 },
      { stars: 4, count: count4, percentage: totalReviews > 0 ? Math.round((count4 / totalReviews) * 100) : 0 },
      { stars: 3, count: count3, percentage: totalReviews > 0 ? Math.round((count3 / totalReviews) * 100) : 0 },
      { stars: 2, count: count2, percentage: totalReviews > 0 ? Math.round((count2 / totalReviews) * 100) : 0 },
      { stars: 1, count: count1, percentage: totalReviews > 0 ? Math.round((count1 / totalReviews) * 100) : 0 },
    ];

    return {
      averageRating,
      totalReviews,
      verifiedReviewsCount: verifiedCount,
      breakdown,
    };
  } catch (err: any) {
    console.warn('[getProductReviewSummary] Database unavailable, computing from resilient memory store:', err?.message);
    return computeMemoryReviewSummary(productKeys);
  }
}

/**
 * Tạo mới đánh giá (Tự động xác thực đơn hàng Đã mua hàng)
 */
export async function createProductReview(
  input: CreateReviewInput,
  userId?: string | null
): Promise<{ review: ReviewItem; isVerified: boolean }> {
  const id = `rev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const cleanPhone = normalizePhoneNumber(input.customerPhone);
  const cleanName = (input.customerName || 'Khách hàng Thái Sơn').trim();
  const cleanTitle = (input.title || '').trim();
  const cleanComment = (input.comment || '').trim();
  const rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 5)));
  const variant = input.variantInfo || 'Lốc 7 chai (330ml)';
  const images = Array.isArray(input.images) ? input.images : [];

  const productKeys = normalizeProductIdVariants(input.productId);

  // Tự động kiểm tra xem khách có đơn hàng COMPLETED cho ĐÚNG sản phẩm này không
  let isVerifiedBuyer = false;
  let matchedOrderId: string | null = null;

  try {
    await ensureReviewsSchema();

    if (cleanPhone || userId) {
      const phoneVariants = cleanPhone
        ? [cleanPhone, '84' + (cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone)]
        : [];

      let orderCheckSql = `
        SELECT o.id
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status = 'COMPLETED'
          AND (
            oi.product_id = ANY($1)
            OR oi.product_id ILIKE ANY($1)
            OR lower(oi.name) = ANY($1)
          )
      `;
      const params: any[] = [productKeys];
      const pIdx = 2;

      if (phoneVariants.length > 0 && userId) {
        orderCheckSql += ` AND (regexp_replace(o.phone, '\\D', '', 'g') = ANY($${pIdx}) OR o.user_id = $${pIdx + 1})`;
        params.push(phoneVariants, userId);
      } else if (phoneVariants.length > 0) {
        orderCheckSql += ` AND regexp_replace(o.phone, '\\D', '', 'g') = ANY($${pIdx})`;
        params.push(phoneVariants);
      } else if (userId) {
        orderCheckSql += ` AND o.user_id = $${pIdx}`;
        params.push(userId);
      }
      orderCheckSql += ` LIMIT 1;`;

      const orderRes = await query(orderCheckSql, params);
      if (orderRes.rows.length > 0) {
        isVerifiedBuyer = true;
        matchedOrderId = orderRes.rows[0].id;
      }
    }
  } catch (err: any) {
    console.warn('Notice in order verification (DB offline):', err?.message);
  }

  // Quyết định số 1: Verified Buyer mua đúng sản phẩm và không dính từ khóa cấm -> APPROVED ngay. Mọi trường hợp khác -> PENDING.
  const hasBadWords = containsBannedWords(cleanTitle) || containsBannedWords(cleanComment);
  const reviewStatus: 'APPROVED' | 'PENDING' = (isVerifiedBuyer && !hasBadWords) ? 'APPROVED' : 'PENDING';

  const newReview: ReviewItem = {
    id,
    productId: input.productId,
    userId: userId || null,
    orderId: matchedOrderId || input.orderId || null,
    customerName: cleanName,
    variantInfo: variant,
    rating,
    title: cleanTitle,
    comment: cleanComment,
    images,
    isVerifiedBuyer,
    status: reviewStatus,
    helpfulCount: 0,
    adminReply: null,
    adminRepliedAt: null,
    createdAt: new Date().toISOString(),
  };

  try {
    const insertSql = `
      INSERT INTO product_reviews (
        id, product_id, user_id, order_id, customer_name, customer_phone,
        variant_info, rating, title, comment, images, is_verified_buyer,
        status, helpful_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING 
        id, product_id AS "productId", user_id AS "userId", order_id AS "orderId",
        customer_name AS "customerName", variant_info AS "variantInfo", rating,
        title, comment, images, is_verified_buyer AS "isVerifiedBuyer",
        status, helpful_count AS "helpfulCount", created_at AS "createdAt";
    `;

    const res = await query(insertSql, [
      id,
      input.productId,
      userId || null,
      matchedOrderId || input.orderId || null,
      cleanName,
      cleanPhone || null,
      variant,
      rating,
      cleanTitle,
      cleanComment,
      JSON.stringify(images),
      isVerifiedBuyer,
      reviewStatus,
    ]);

    if (res.rows?.[0]) {
      const row = res.rows[0];
      newReview.id = row.id;
      newReview.createdAt = new Date(row.createdAt).toISOString();
      newReview.isVerifiedBuyer = row.isVerifiedBuyer;
      newReview.status = row.status;
    }
  } catch (dbErr: any) {
    console.warn('[createProductReview] Database write failed, saved in resilient memory store:', dbErr?.message);
  }

  // Luôn cập nhật memory store để người dùng và khách xem trang thấy ngay đánh giá mới
  memoryReviews.unshift(newReview);

  return { review: newReview, isVerified: isVerifiedBuyer };
}

/**
 * Bấm thích / Hữu ích cho bài đánh giá (Chống vote trùng)
 */
export async function voteHelpfulReview(
  reviewId: string,
  fingerprint: string,
  userId?: string | null
): Promise<{ success: boolean; helpfulCount: number; alreadyVoted?: boolean }> {
  try {
    await ensureReviewsSchema();

    const voteId = `vote_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await query(
      `INSERT INTO review_helpful_votes (id, review_id, user_id, fingerprint)
       VALUES ($1, $2, $3, $4);`,
      [voteId, reviewId, userId || null, fingerprint]
    );

    // Tăng số lượng vote
    const updateRes = await query(
      `UPDATE product_reviews 
       SET helpful_count = helpful_count + 1 
       WHERE id = $1
       RETURNING helpful_count;`,
      [reviewId]
    );

    const count = Number(updateRes.rows[0]?.helpful_count || 1);
    const item = memoryReviews.find((r) => r.id === reviewId);
    if (item) item.helpfulCount = count;

    return {
      success: true,
      helpfulCount: count,
    };
  } catch (err: any) {
    if (err?.code === '23505') {
      // Đã vote trước đó trong DB
      try {
        const currentRes = await query(
          `SELECT helpful_count FROM product_reviews WHERE id = $1;`,
          [reviewId]
        );
        return {
          success: false,
          alreadyVoted: true,
          helpfulCount: Number(currentRes.rows[0]?.helpful_count || 0),
        };
      } catch {
        const item = memoryReviews.find((r) => r.id === reviewId);
        return {
          success: false,
          alreadyVoted: true,
          helpfulCount: item?.helpfulCount || 0,
        };
      }
    }

    // Fallback in-memory vote tracking
    const voteKey = `${reviewId}_${fingerprint}`;
    if (memoryVotes.has(voteKey)) {
      const item = memoryReviews.find((r) => r.id === reviewId);
      return {
        success: false,
        alreadyVoted: true,
        helpfulCount: item?.helpfulCount || 0,
      };
    }

    memoryVotes.add(voteKey);
    const item = memoryReviews.find((r) => r.id === reviewId);
    const newCount = (item ? item.helpfulCount : 0) + 1;
    if (item) item.helpfulCount = newCount;

    return {
      success: true,
      helpfulCount: newCount,
    };
  }
}

/**
 * Quản trị Admin: Duyệt, ẩn hoặc phản hồi đánh giá
 */
export async function adminUpdateReview(
  reviewId: string,
  payload: {
    status?: 'APPROVED' | 'PENDING' | 'HIDDEN';
    adminReply?: string;
    adminUsername?: string;
  }
): Promise<boolean> {
  let dbSuccess = false;

  try {
    await ensureReviewsSchema();

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [reviewId];
    let pIdx = 2;

    if (payload.status) {
      updates.push(`status = $${pIdx}`);
      params.push(payload.status);
      pIdx++;
    }

    if (typeof payload.adminReply === 'string') {
      updates.push(`admin_reply = $${pIdx}`);
      params.push(payload.adminReply);
      pIdx++;
      updates.push(`admin_replied_at = CURRENT_TIMESTAMP`);
      if (payload.adminUsername) {
        updates.push(`admin_replied_by = $${pIdx}`);
        params.push(payload.adminUsername);
        pIdx++;
      }
    }

    const sql = `UPDATE product_reviews SET ${updates.join(', ')} WHERE id = $1;`;
    const res = await query(sql, params);
    dbSuccess = (res.rowCount ?? 0) > 0;
  } catch (err: any) {
    console.warn('[adminUpdateReview] Database update failed, syncing with memory store:', err?.message);
  }

  const target = memoryReviews.find((r) => r.id === reviewId);
  if (target) {
    if (payload.status) target.status = payload.status;
    if (typeof payload.adminReply === 'string') {
      target.adminReply = payload.adminReply;
      target.adminRepliedAt = new Date().toISOString();
    }
    return true;
  }

  return dbSuccess;
}

/**
 * Quản trị Admin: Xóa đánh giá (xóa cascade vote liên quan)
 */
export async function adminDeleteReview(reviewId: string): Promise<boolean> {
  let dbSuccess = false;
  try {
    await ensureReviewsSchema();
    await query(`DELETE FROM review_helpful_votes WHERE review_id = $1;`, [reviewId]);
    const res = await query(`DELETE FROM product_reviews WHERE id = $1;`, [reviewId]);
    dbSuccess = (res.rowCount ?? 0) > 0;
  } catch (err: any) {
    console.warn('[adminDeleteReview] DB delete failed:', err?.message);
  }

  const memIdx = memoryReviews.findIndex((r) => r.id === reviewId);
  if (memIdx !== -1) {
    memoryReviews.splice(memIdx, 1);
    return true;
  }
  return dbSuccess;
}

interface RateLimitCheckInput {
  ip: string;
  phone?: string;
  userId?: string;
  productId: string;
  comment: string;
}

interface RateLimitResult {
  allowed: boolean;
  error?: string;
}

interface MemoryRateLimitEntry {
  id: string;
  ip: string;
  phone?: string;
  userId?: string;
  productId: string;
  commentHash: string;
  createdAt: number;
}

const memoryRateLimitStore: MemoryRateLimitEntry[] = [];

/**
 * Kiểm tra và ghi nhận tần suất gửi đánh giá (Rate limit & Chống spam)
 * - Tối đa 3 lượt gửi / IP / 1 giờ
 * - Chặn trùng lặp SĐT hoặc user_id cùng sản phẩm trong 24 giờ
 * - Chặn trùng lặp nội dung đánh giá trong 24 giờ
 */
export async function checkAndRecordReviewRateLimit(
  input: RateLimitCheckInput
): Promise<RateLimitResult> {
  const normPhone = normalizePhoneNumber(input.phone);
  const commentHash = crypto
    .createHash('sha256')
    .update(input.comment.trim().toLowerCase())
    .digest('hex');
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

  try {
    await ensureReviewsSchema();

    // 1. Kiểm tra giới hạn IP: tối đa 3 lượt / IP / 1 giờ
    const ipCountRes = await query(
      `SELECT count(*)::int as count FROM review_rate_limits WHERE ip_address = $1 AND created_at >= $2;`,
      [input.ip, oneHourAgo]
    );
    const ipCount = Number(ipCountRes.rows[0]?.count || 0);
    if (ipCount >= 3) {
      return {
        allowed: false,
        error: 'Bạn đã gửi đánh giá quá 3 lần trong 1 giờ qua. Vui lòng quay lại sau.',
      };
    }

    // 2. Chặn trùng lặp theo SĐT hoặc user_id cùng sản phẩm trong 24h
    if (normPhone) {
      const phoneCountRes = await query(
        `SELECT count(*)::int as count FROM review_rate_limits WHERE phone = $1 AND product_id = $2 AND created_at >= $3;`,
        [normPhone, input.productId, twentyFourHoursAgo]
      );
      if (Number(phoneCountRes.rows[0]?.count || 0) > 0) {
        return {
          allowed: false,
          error: 'Số điện thoại này đã gửi đánh giá cho sản phẩm trong vòng 24 giờ qua. Vui lòng không gửi trùng lặp.',
        };
      }
    }

    if (input.userId) {
      const userCountRes = await query(
        `SELECT count(*)::int as count FROM review_rate_limits WHERE user_id = $1 AND product_id = $2 AND created_at >= $3;`,
        [input.userId, input.productId, twentyFourHoursAgo]
      );
      if (Number(userCountRes.rows[0]?.count || 0) > 0) {
        return {
          allowed: false,
          error: 'Tài khoản này đã gửi đánh giá cho sản phẩm trong vòng 24 giờ qua. Vui lòng không gửi trùng lặp.',
        };
      }
    }

    // 3. Chặn trùng lặp nội dung giống hệt trong 24h
    const hashCountRes = await query(
      `SELECT count(*)::int as count FROM review_rate_limits WHERE comment_hash = $1 AND created_at >= $2;`,
      [commentHash, twentyFourHoursAgo]
    );
    if (Number(hashCountRes.rows[0]?.count || 0) > 0) {
      return {
        allowed: false,
        error: 'Nội dung đánh giá tương tự đã được gửi gần đây. Vui lòng không gửi trùng lặp.',
      };
    }

    // Ghi nhận bản ghi rate limit
    const newId = `rl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await query(
      `INSERT INTO review_rate_limits (id, ip_address, phone, user_id, product_id, comment_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP);`,
      [newId, input.ip, normPhone || null, input.userId || null, input.productId, commentHash]
    );

    return { allowed: true };
  } catch (err: any) {
    console.warn('[checkAndRecordReviewRateLimit] DB check failed, using memory store fallback:', err?.message);

    const cutoff1h = now - 60 * 60 * 1000;
    const cutoff24h = now - 24 * 60 * 60 * 1000;

    while (memoryRateLimitStore.length > 0 && memoryRateLimitStore[0].createdAt < cutoff24h) {
      memoryRateLimitStore.shift();
    }

    const ipCount = memoryRateLimitStore.filter(
      (entry) => entry.ip === input.ip && entry.createdAt >= cutoff1h
    ).length;
    if (ipCount >= 3) {
      return {
        allowed: false,
        error: 'Bạn đã gửi đánh giá quá 3 lần trong 1 giờ qua. Vui lòng quay lại sau.',
      };
    }

    if (normPhone) {
      const hasPhoneDuplicate = memoryRateLimitStore.some(
        (entry) => entry.phone === normPhone && entry.productId === input.productId && entry.createdAt >= cutoff24h
      );
      if (hasPhoneDuplicate) {
        return {
          allowed: false,
          error: 'Số điện thoại này đã gửi đánh giá cho sản phẩm trong vòng 24 giờ qua. Vui lòng không gửi trùng lặp.',
        };
      }
    }

    if (input.userId) {
      const hasUserDuplicate = memoryRateLimitStore.some(
        (entry) => entry.userId === input.userId && entry.productId === input.productId && entry.createdAt >= cutoff24h
      );
      if (hasUserDuplicate) {
        return {
          allowed: false,
          error: 'Tài khoản này đã gửi đánh giá cho sản phẩm trong vòng 24 giờ qua. Vui lòng không gửi trùng lặp.',
        };
      }
    }

    const hasHashDuplicate = memoryRateLimitStore.some(
      (entry) => entry.commentHash === commentHash && entry.createdAt >= cutoff24h
    );
    if (hasHashDuplicate) {
      return {
        allowed: false,
        error: 'Nội dung đánh giá tương tự đã được gửi gần đây. Vui lòng không gửi trùng lặp.',
      };
    }

    memoryRateLimitStore.push({
      id: `rl_${now}_${Math.random().toString(36).substring(2, 7)}`,
      ip: input.ip,
      phone: normPhone || undefined,
      userId: input.userId,
      productId: input.productId,
      commentHash,
      createdAt: now,
    });

    return { allowed: true };
  }
}

