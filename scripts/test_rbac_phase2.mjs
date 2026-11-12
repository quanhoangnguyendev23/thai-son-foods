import pg from 'pg';
import { SignJWT } from 'jose';
import dotenv from 'dotenv';
dotenv.config();

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'tsf_super_secret_jwt_key_2026_thai_son_foods'
);
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ADMIN_COOKIE_NAME = 'tsf_admin_token';

async function createToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

async function apiRequest(endpoint, method = 'GET', token = null, body = null) {
  // Middleware CSRF yêu cầu Origin khớp với máy chủ cho mọi yêu cầu ghi (POST/PUT/PATCH/DELETE)
  const headers = { Origin: BASE_URL };
  if (token) {
    headers['Cookie'] = `${ADMIN_COOKIE_NAME}=${token}`;
  }
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // Non-json response
  }

  return { status: res.status, data };
}

async function runTests() {
  console.log('===============================================================');
  console.log('           RBAC & DATA SCOPE PHASE 2 TEST SUITE                ');
  console.log('===============================================================');

  const client = await pool.connect();
  const testResults = [];

  try {
    // 1. Setup Test Users in Database
    console.log('\n[1/4] Preparing test accounts in database...');

    // 1.1 Super Admin
    let superAdmin = (await client.query("SELECT * FROM admin_users WHERE role = 'SUPER_ADMIN' AND is_active = true LIMIT 1;")).rows[0];
    if (!superAdmin) {
      throw new Error('No active SUPER_ADMIN found in DB');
    }

    // 1.2 Store Staff A (NH)
    let staffNH = (await client.query("SELECT * FROM admin_users WHERE role = 'STORE_STAFF' AND store_code = 'NH' AND is_active = true AND must_change_password = false LIMIT 1;")).rows[0];
    if (!staffNH) {
      staffNH = (await client.query("SELECT * FROM admin_users WHERE role = 'STORE_STAFF' AND is_active = true AND must_change_password = false LIMIT 1;")).rows[0];
    }
    const storeCodeA = staffNH.store_code || 'NH';

    // 1.3 Store Staff B (Different Store)
    let staffOther = (await client.query("SELECT * FROM admin_users WHERE role = 'STORE_STAFF' AND store_code != $1 AND is_active = true AND must_change_password = false LIMIT 1;", [storeCodeA])).rows[0];
    const storeCodeB = staffOther?.store_code || 'LHP';

    // 1.4 Marketing User (create or update a temporary one)
    const mktUsername = 'test_mkt_rbac';
    await client.query(`
      INSERT INTO admin_users (id, username, email, password_hash, full_name, role, store_code, is_active)
      VALUES ('admin_test_mkt', $1, 'test_mkt@thaisonfoods.vn', 'hash_test', 'Marketing Tester', 'MARKETING', NULL, true)
      ON CONFLICT (username) DO UPDATE SET role = 'MARKETING', store_code = NULL, is_active = true;
    `, [mktUsername]);
    const marketingUser = (await client.query("SELECT * FROM admin_users WHERE username = $1;", [mktUsername])).rows[0];

    // 1.5 Prepare Test Orders for IDOR Testing
    const orderA_id = 'test_ord_store_A';
    const orderB_id = 'test_ord_store_B';

    await client.query(`
      INSERT INTO orders (id, order_code, full_name, phone, province, district, ward, address, status, subtotal, total, store_code, created_at)
      VALUES 
        ($1, 'TSF_TEST_A', 'Khách Store A', '0901111111', 'Hồ Chí Minh', 'Quận 1', 'Bến Nghé', '123 Đường A', 'PENDING', 100000, 100000, $3, NOW()),
        ($2, 'TSF_TEST_B', 'Khách Store B', '0902222222', 'Hồ Chí Minh', 'Quận 5', 'Phường 1', '456 Đường B', 'PENDING', 200000, 200000, $4, NOW())
      ON CONFLICT (id) DO UPDATE SET store_code = EXCLUDED.store_code, status = 'PENDING';
    `, [orderA_id, orderB_id, storeCodeA, storeCodeB]);

    // Generate JWT Tokens
    const tokenSuper = await createToken({ id: superAdmin.id, username: superAdmin.username, role: 'SUPER_ADMIN', storeCode: null });
    const tokenStaffA = await createToken({ id: staffNH.id, username: staffNH.username, role: 'STORE_STAFF', storeCode: storeCodeA });
    const tokenStaffB = await createToken({ id: staffOther?.id || 'staff_b', username: staffOther?.username || 'staff_b', role: 'STORE_STAFF', storeCode: storeCodeB });
    const tokenMarketing = await createToken({ id: marketingUser.id, username: marketingUser.username, role: 'MARKETING', storeCode: null });
    const tokenAnonymous = null;

    console.log(`Test Principals Ready:`);
    console.log(`  - SUPER_ADMIN: ${superAdmin.username}`);
    console.log(`  - STORE_STAFF (A): ${staffNH.username} (store: ${storeCodeA})`);
    console.log(`  - STORE_STAFF (B): ${staffOther?.username} (store: ${storeCodeB})`);
    console.log(`  - MARKETING: ${marketingUser.username}`);

    function record(name, expected, actualStatus, passCondition, details = '') {
      const passed = actualStatus === expected && (typeof passCondition === 'function' ? passCondition() : passCondition);
      testResults.push({ name, expected, actual: actualStatus, passed, details });
      const symbol = passed ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${symbol} [${actualStatus === expected ? actualStatus : `${actualStatus} vs exp ${expected}`}] ${name} ${details ? `(${details})` : ''}`);
    }

    // 2. RUN MATRIX TESTS
    console.log('\n[2/4] Testing Role × Endpoint Matrix...');

    // --- /api/admin/stats ---
    let res = await apiRequest('/api/admin/stats', 'GET', tokenSuper);
    record('Stats - SUPER_ADMIN', 200, res.status, () => res.data?.success === true && res.data?.summary?.total_revenue !== undefined, 'Company-wide stats');

    res = await apiRequest('/api/admin/stats', 'GET', tokenStaffA);
    record('Stats - STORE_STAFF', 200, res.status, () => res.data?.success === true && res.data?.storeScope === storeCodeA, `Scoped to ${storeCodeA}`);

    res = await apiRequest('/api/admin/stats', 'GET', tokenMarketing);
    record('Stats - MARKETING (Blocked)', 403, res.status, true, 'Revenue hidden from marketing');

    res = await apiRequest('/api/admin/stats', 'GET', tokenAnonymous);
    record('Stats - Anonymous (Blocked)', 401, res.status, true);

    // --- /api/admin/orders ---
    res = await apiRequest('/api/admin/orders', 'GET', tokenSuper);
    const superOrders = res.data?.data || [];
    record('Orders List - SUPER_ADMIN', 200, res.status, () => superOrders.length >= 2, 'All stores');

    res = await apiRequest('/api/admin/orders', 'GET', tokenStaffA);
    const staffOrders = res.data?.data || [];
    const onlyStoreA = staffOrders.every(o => o.store_code === storeCodeA);
    record('Orders List - STORE_STAFF Scope', 200, res.status, () => onlyStoreA, `Strictly WHERE store_code = ${storeCodeA}`);

    res = await apiRequest('/api/admin/orders', 'GET', tokenMarketing);
    record('Orders List - MARKETING (Blocked)', 403, res.status, true, 'Marketing cannot view orders');

    // --- IDOR PROTECTION ON ORDERS ---
    console.log('\n[3/4] Testing IDOR Protections (Crucial Security Check)...');

    // Staff A tries to view Order B of Store B directly
    res = await apiRequest(`/api/admin/orders?id=${orderB_id}`, 'GET', tokenStaffA);
    record('IDOR Prevention: Staff A reads Order of Store B', 403, res.status, true, 'IDOR blocked on GET');

    // Staff A tries to view their own Store A order
    res = await apiRequest(`/api/admin/orders?id=${orderA_id}`, 'GET', tokenStaffA);
    record('Staff A reads own Store A order', 200, res.status, () => res.data?.order?.id === orderA_id, 'Allowed for own store');

    // Staff A tries to update status of Order B belonging to Store B
    res = await apiRequest('/api/admin/orders', 'PUT', tokenStaffA, {
      id: orderB_id,
      status: 'CONFIRMED'
    });
    record('IDOR Prevention: Staff A updates Order of Store B', 403, res.status, true, 'IDOR blocked on PUT');

    // Staff A updates status of their own Store A order
    res = await apiRequest('/api/admin/orders', 'PUT', tokenStaffA, {
      id: orderA_id,
      status: 'CONFIRMED'
    });
    record('Staff A updates own Store A order status', 200, res.status, () => res.data?.success === true, 'Allowed for own store');

    // --- /api/admin/orders/reconcile & transfer ---
    res = await apiRequest('/api/admin/orders/reconcile', 'POST', tokenSuper, { action: 'reconcile_cod', orderId: orderA_id, note: 'Đối soát test' });
    record('COD Reconcile - SUPER_ADMIN', 200, res.status, true);

    res = await apiRequest('/api/admin/orders/reconcile', 'POST', tokenStaffA, { action: 'reconcile_cod', orderId: orderA_id, note: 'Đối soát test' });
    record('COD Reconcile - STORE_STAFF (Blocked)', 403, res.status, true, 'Staff cannot reconcile COD');

    res = await apiRequest('/api/admin/orders/transfer', 'POST', tokenStaffA, { orderId: orderA_id, targetStoreCode: storeCodeB });
    record('Order Transfer - STORE_STAFF (Blocked)', 403, res.status, true, 'Staff cannot transfer store');

    // --- /api/admin/members (DATA MASKING) ---
    console.log('\n[4/4] Testing Data Masking & Admin Routes...');

    res = await apiRequest('/api/admin/members', 'GET', tokenSuper);
    const superMembers = res.data?.members || [];
    const superHasUnmasked = superMembers.some(m => m.phone && !m.phone.includes('****'));
    record('Members - SUPER_ADMIN (Unmasked)', 200, res.status, () => superHasUnmasked, 'Full phone & address');

    res = await apiRequest('/api/admin/members', 'GET', tokenMarketing);
    const mktMembers = res.data?.members || [];
    const mktAllMasked = mktMembers.every(m => !m.phone || m.phone.includes('****'));
    const mktAddressNull = mktMembers.every(m => m.address === null);
    record('Members - MARKETING (Masked)', 200, res.status, () => mktAllMasked && mktAddressNull, 'Phone masked (****) & address NULL');

    res = await apiRequest('/api/admin/members', 'GET', tokenStaffA);
    record('Members - STORE_STAFF (Blocked)', 403, res.status, true, 'Staff cannot access customer list');

    // --- /api/admin/users ---
    res = await apiRequest('/api/admin/users', 'GET', tokenSuper);
    record('Users Manage - SUPER_ADMIN', 200, res.status, () => res.data?.success === true);

    res = await apiRequest('/api/admin/users', 'GET', tokenMarketing);
    record('Users Manage - MARKETING (Blocked)', 403, res.status, true);

    res = await apiRequest('/api/admin/users', 'GET', tokenStaffA);
    record('Users Manage - STORE_STAFF (Blocked)', 403, res.status, true);

    // --- /api/admin/banners & upload ---
    res = await apiRequest('/api/admin/banners', 'GET', tokenMarketing);
    record('Banners - MARKETING (Allowed)', 200, res.status, true, 'Marketing can manage content');

    res = await apiRequest('/api/admin/banners', 'GET', tokenStaffA);
    record('Banners - STORE_STAFF (Blocked)', 403, res.status, true, 'Staff cannot manage banners');

    // --- /api/admin/sync & seed ---
    res = await apiRequest('/api/admin/sync', 'GET', tokenSuper);
    record('System Sync - SUPER_ADMIN', 200, res.status, true);

    res = await apiRequest('/api/admin/sync', 'GET', tokenMarketing);
    record('System Sync - MARKETING (Blocked)', 403, res.status, true);

    res = await apiRequest('/api/admin/sync', 'GET', tokenStaffA);
    record('System Sync - STORE_STAFF (Blocked)', 403, res.status, true);

    // --- /api/admin/inventory ---
    res = await apiRequest('/api/admin/inventory', 'GET', tokenMarketing);
    record('Inventory - MARKETING (Total View Only)', 200, res.status, () => res.data?.isTotalOnly === true, 'No store-specific breakdown');

    res = await apiRequest('/api/admin/inventory', 'GET', tokenStaffA);
    record('Inventory - STORE_STAFF (Own Store)', 200, res.status, () => res.data?.currentStore === storeCodeA, `Scoped to ${storeCodeA}`);

    // Clean up test records
    await client.query("DELETE FROM orders WHERE id IN ($1, $2);", [orderA_id, orderB_id]);
    await client.query("DELETE FROM admin_users WHERE username = $1;", [mktUsername]);

    console.log('\n===============================================================');
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;
    console.log(`TOTAL: ${totalTests} tests | PASSED: ${passedTests} | FAILED: ${failedTests}`);
    if (failedTests === 0) {
      console.log('🎉 ALL RBAC PHASE 2 AND IDOR PREVENTIONS PASSED WITH 100% SUCCESS!');
    } else {
      console.log(`⚠️ ${failedTests} tests failed.`);
    }
    console.log('===============================================================\n');

    process.exit(failedTests === 0 ? 0 : 1);
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runTests();
