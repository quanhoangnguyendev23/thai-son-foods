import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedDemoPartners() {
  const client = await pool.connect();
  try {
    console.log('🚀 SEEDING DEMO PARTNERS (CTV & ĐẠI LÝ)...');

    const salt = await bcrypt.genSalt(10);
    const pwdHash = await bcrypt.hash('Demo@123', salt);

    // 1. Tạo User & Partner Profile cho CTV Demo
    const ctvUserId = 'usr_demo_ctv_01';
    const ctvEmail = 'ctv_demo@thaisonfoods.vn';
    const ctvPhone = '0901111222';
    const ctvName = 'Nguyễn Văn An (CTV Demo)';

    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;`,
      [ctvUserId, ctvEmail, pwdHash, ctvName, ctvPhone]
    );

    const ctvPartnerId = 'ptn_demo_ctv_01';
    const ctvCode = 'TSF-CTV-DEMO';
    await client.query(
      `INSERT INTO partner_profiles (
        id, user_id, partner_code, partner_type, lifecycle_status, phone, full_name, email,
        bank_name, bank_account_number, bank_account_name, bank_branch, current_balance, total_revenue_generated
      ) VALUES (
        $1, $2, $3, 'CTV', 'ACTIVE', $4, $5, $6,
        'Vietcombank', '0071000999888', 'NGUYEN VAN AN', 'Hồ Chí Minh', 500000, 2500000
      )
      ON CONFLICT (id) DO UPDATE
      SET partner_code = EXCLUDED.partner_code,
          lifecycle_status = 'ACTIVE',
          current_balance = EXCLUDED.current_balance;`,
      [ctvPartnerId, ctvUserId, ctvCode, ctvPhone, ctvName, ctvEmail]
    );

    // Seed 1 dòng số cái AVAILABLE cho CTV demo để họ có thể test chức năng Payout ngay
    await client.query(
      `INSERT INTO partner_ledger (
        id, partner_id, entry_type, amount, direction, status, available_at, note, created_by
      ) VALUES (
        'led_demo_seed_01', $1, 'COMMISSION', 500000, 'CREDIT', 'AVAILABLE',
        CURRENT_TIMESTAMP - INTERVAL '1 day', 'Số dư hoa hồng khả dụng để test rút tiền demo', 'system'
      )
      ON CONFLICT (id) DO NOTHING;`,
      [ctvPartnerId]
    );

    // 2. Tạo User & Partner Profile cho Đại Lý Demo
    const dlUserId = 'usr_demo_dealer_01';
    const dlEmail = 'daily_demo@thaisonfoods.vn';
    const dlPhone = '0903333444';
    const dlName = 'Trần Thị Bình (Đại Lý Sỉ Demo)';

    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;`,
      [dlUserId, dlEmail, pwdHash, dlName, dlPhone]
    );

    const dlPartnerId = 'ptn_demo_dealer_01';
    const dlCode = 'TSF-DL-DEMO';
    await client.query(
      `INSERT INTO partner_profiles (
        id, user_id, partner_code, partner_type, lifecycle_status, phone, full_name, email,
        tier_id, bank_name, bank_account_number, bank_account_name, bank_branch, current_balance, total_revenue_generated
      ) VALUES (
        $1, $2, $3, 'DEALER', 'ACTIVE', $4, $5, $6,
        'tier_bronze', 'Techcombank', '1903000888777', 'TRAN THI BINH', 'Hồ Chí Minh', 0, 50000000
      )
      ON CONFLICT (id) DO UPDATE
      SET partner_code = EXCLUDED.partner_code,
          partner_type = 'DEALER',
          tier_id = 'tier_bronze',
          lifecycle_status = 'ACTIVE';`,
      [dlPartnerId, dlUserId, dlCode, dlPhone, dlName, dlEmail]
    );

    console.log('✅ ĐÃ SEED THÀNH CÔNG 2 TÀI KHOẢN DEMO:');
    console.log(`1. CỘNG TÁC VIÊN (CTV):`);
    console.log(`   - SĐT: ${ctvPhone} | Email: ${ctvEmail} | Mật khẩu: Demo@123`);
    console.log(`   - Mã Ref: ${ctvCode} (Link: /?ref=${ctvCode})`);
    console.log(`   - Số dư ví khả dụng: 500.000 VNĐ (sẵn sàng test Payout)`);
    console.log(`2. ĐẠI LÝ SỈ (DEALER):`);
    console.log(`   - SĐT: ${dlPhone} | Email: ${dlEmail} | Mật khẩu: Demo@123`);
    console.log(`   - Hạng: Đại lý Đồng (Tier Bronze - Chiết khấu 15%)`);
    console.log(`   - Mã Đại lý: ${dlCode}`);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemoPartners().catch(console.error);
