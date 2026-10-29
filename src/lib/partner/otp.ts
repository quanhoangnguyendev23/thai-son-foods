import crypto from 'node:crypto';
import { PARTNER_CONFIG } from '@/config/partner';

interface OtpEntry {
  phone: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

// In-memory OTP cache (có thể mở rộng sang Redis khi cần)
const otpStore = new Map<string, OtpEntry>();

/**
 * Sinh mã OTP ngẫu nhiên 6 chữ số và lưu vào bộ nhớ tạm
 */
export function generateOtp(phone: string): string {
  const cleanPhone = phone.replace(/[\s\-\.]/g, '');
  // Sinh mã 6 chữ số ngẫu nhiên
  const code = process.env.NODE_ENV === 'test' ? '123456' : crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + PARTNER_CONFIG.SECURITY.OTP_EXPIRY_SECONDS * 1000;

  otpStore.set(cleanPhone, {
    phone: cleanPhone,
    code,
    expiresAt,
    attempts: 0,
  });

  // Giả lập gửi tin nhắn SMS / ZNS (ghi log trên console phục vụ dev/staging)
  console.log(`[OtpService] Mã xác thực OTP gửi tới ${cleanPhone.slice(0, 3)}****${cleanPhone.slice(-3)}` + (process.env.NODE_ENV === 'production' ? '' : `: [${code}]`) + ' (Hết hạn sau 5 phút)');

  return code;
}

/**
 * Xác minh mã OTP do người dùng nhập
 */
export function verifyOtp(phone: string, inputCode: string): { success: boolean; error?: string } {
  const cleanPhone = phone.replace(/[\s\-\.]/g, '');
  const entry = otpStore.get(cleanPhone);

  if (!entry) {
    // Để tiện lợi kiểm thử ở môi trường staging/dev: chấp nhận mã master 123456
    if (process.env.NODE_ENV !== 'production' && inputCode === '123456') {
      return { success: true };
    }
    return { success: false, error: 'Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng yêu cầu mã mới.' };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(cleanPhone);
    return { success: false, error: 'Mã OTP đã hết hạn. Vui lòng lấy lại mã mới.' };
  }

  if (entry.attempts >= PARTNER_CONFIG.SECURITY.OTP_MAX_ATTEMPTS) {
    otpStore.delete(cleanPhone);
    return { success: false, error: 'Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã mới.' };
  }

  if (entry.code !== inputCode.trim() && !(process.env.NODE_ENV !== 'production' && inputCode === '123456')) {
    entry.attempts += 1;
    return { success: false, error: `Mã OTP không chính xác. Còn lại ${PARTNER_CONFIG.SECURITY.OTP_MAX_ATTEMPTS - entry.attempts} lần thử.` };
  }

  // Xác minh thành công -> Xóa OTP
  otpStore.delete(cleanPhone);
  return { success: true };
}
