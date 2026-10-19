import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { pool, query } from '@/lib/db';

import { MEMBERSHIP_CONFIG } from '@/config/membership';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Fail-closed: không có CRON_SECRET thì từ chối; không nhận secret qua query string (lộ trong log)
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ success: false, error: 'CRON_SECRET chưa được cấu hình' }, { status: 500 });
    }
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const provided = req.headers.get('x-cron-secret') || bearer;
    const digest = (v: string) => crypto.createHash('sha256').update(v).digest();
    if (!crypto.timingSafeEqual(digest(provided), digest(cronSecret))) {
      return NextResponse.json({ success: false, error: 'Unauthorized CRON execution' }, { status: 401 });
    }

    // Quét các lịch giao trong vòng 5 ngày tới (T-5) theo múi giờ chuẩn Asia/Ho_Chi_Minh chưa được gửi nhắc nhở
    const sql = `
      SELECT 
        ss.id AS schedule_id, ss.scheduled_date, ss.subscription_id,
        s.subscription_code, s.recipient_name, s.recipient_phone, 
        s.shipping_address, s.delivery_frequency, s.user_id,
        u.email
      FROM subscription_schedules ss
      JOIN subscriptions s ON ss.subscription_id = s.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE ss.status = 'SCHEDULED'
        AND ss.reminder_sent_at IS NULL
        AND ss.scheduled_date::date BETWEEN 
          (CURRENT_TIMESTAMP AT TIME ZONE '${MEMBERSHIP_CONFIG.TIMEZONE}')::date 
          AND ((CURRENT_TIMESTAMP AT TIME ZONE '${MEMBERSHIP_CONFIG.TIMEZONE}') + INTERVAL '${MEMBERSHIP_CONFIG.REMINDER_LEAD_DAYS} days')::date
      ORDER BY ss.scheduled_date ASC
      LIMIT 100;
    `;

    const res = await query(sql);
    const schedules = res.rows;
    let remindersSentCount = 0;

    for (const item of schedules) {
      const deliveryDateStr = new Date(item.scheduled_date).toLocaleDateString('vi-VN');
      
      // Giả lập thông báo Zalo ZNS / Email (Zero PII logging: masked phone)
      const maskedPhone = item.recipient_phone ? item.recipient_phone.slice(0, 3) + '****' + item.recipient_phone.slice(-3) : '***';
      console.log(`[CronReminders] Gửi thông báo ZNS nhắc lịch #${item.subscription_code} tới ${maskedPhone} cho ngày giao ${deliveryDateStr}. Khách có thể bấm [Skip/Bỏ qua] nếu chưa có nhu cầu.`);

      // Đánh dấu đã gửi nhắc
      await query(
        `UPDATE subscription_schedules 
         SET status = 'REMINDER_SENT', reminder_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1;`,
        [item.schedule_id]
      );
      remindersSentCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Đã quét và gửi nhắc nhở thành công cho ${remindersSentCount} kỳ giao hàng.`,
      remindersSentCount,
    });
  } catch (error: any) {
    console.error('Error in cron reminders:', error);
    return NextResponse.json({ success: false, error: 'Lỗi thực thi cron nhắc lịch.' }, { status: 500 });
  }
}
