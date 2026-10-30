import crypto from 'node:crypto';

interface CustomerOtpEntry {
  phone: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

const customerOtpStore = new Map<string, CustomerOtpEntry>();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 phút
const OTP_MAX_ATTEMPTS = 5;

/**
 * Sinh mã OTP 6 chữ số xác thực SĐT khách hàng đăng ký hội viên
 */
export function generateCustomerOtp(phone: string): { success: boolean; code?: string; error?: string } {
  const cleanPhone = phone.replace(/[\s\-\.]/g, '');
  const vnPhoneRegex = /^(03|05|07|08|09)\d{8}$/;

  if (!vnPhoneRegex.test(cleanPhone)) {
    return { success: false, error: 'Số điện thoại không đúng định dạng di động Việt Nam (VD: 0901234567).' };
  }

  // Môi trường test / staging hỗ trợ mã cố định 123456
  const code = process.env.NODE_ENV === 'test' ? '123456' : crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;

  customerOtpStore.set(cleanPhone, {
    phone: cleanPhone,
    code,
    expiresAt,
    attempts: 0,
  });

  const maskedPhone = cleanPhone.slice(0, 3) + '****' + cleanPhone.slice(-3);
  // Không ghi mã OTP ra log ở production (log máy chủ không được chứa mã đăng nhập)
  console.log(
    `[CustomerOtp] Đã gửi mã xác thực tới ${maskedPhone}` +
      (process.env.NODE_ENV === 'production' ? '' : `: [${code}]`) +
      ' (Hết hạn sau 5 phút)'
  );

  return { success: true, code };
}

/**
 * Xác minh mã OTP số điện thoại của khách hàng
 */
export function verifyCustomerOtp(phone: string, inputCode: string): { success: boolean; error?: string } {
  const cleanPhone = phone.replace(/[\s\-\.]/g, '');
  const entry = customerOtpStore.get(cleanPhone);

  if (!entry) {
    if (process.env.NODE_ENV !== 'production' && inputCode === '123456') {
      return { success: true };
    }
    return { success: false, error: 'Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng nhận mã mới.' };
  }

  if (Date.now() > entry.expiresAt) {
    customerOtpStore.delete(cleanPhone);
    return { success: false, error: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.' };
  }

  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    customerOtpStore.delete(cleanPhone);
    return { success: false, error: 'Bạn đã nhập sai quá 5 lần. Vui lòng gửi lại mã mới.' };
  }

  // Mã thử 123456 CHỈ dùng ngoài production (giống OTP đối tác); production luôn so đúng mã đã sinh
  const isDevMasterCode = process.env.NODE_ENV !== 'production' && inputCode.trim() === '123456';
  if (entry.code !== inputCode.trim() && !isDevMasterCode) {
    entry.attempts += 1;
    return { success: false, error: `Mã OTP không chính xác (còn ${OTP_MAX_ATTEMPTS - entry.attempts} lần thử).` };
  }

  // Xác minh thành công, xóa khỏi cache chống dùng lại (Replay attack)
  customerOtpStore.delete(cleanPhone);
  return { success: true };
}
