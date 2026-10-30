import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { query } from '@/lib/db';

import { ROLE_PERMISSIONS, Role } from '@/lib/rbac';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check if there are any admins in the system
    const countRes = await query('SELECT COUNT(*) AS total FROM admin_users;');
    const totalAdmins = parseInt(countRes.rows[0]?.total || '0', 10);
    const hasAdmins = totalAdmins > 0;

    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({
        success: false,
        authenticated: false,
        hasAdmins,
        user: null,
      });
    }

    // Fetch fresh user data from DB to ensure still active and get updated name/role
    const userRes = await query(
      `SELECT id, username, email, full_name, role, store_code, must_change_password, is_active, created_at
       FROM admin_users
       WHERE id = $1
       LIMIT 1;`,
      [session.id]
    );

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      return NextResponse.json({
        success: false,
        authenticated: false,
        hasAdmins,
        user: null,
      });
    }

    const userData = userRes.rows[0];
    const role = userData.role as Role;
    const permissions = ROLE_PERMISSIONS[role] || [];

    return NextResponse.json({
      success: true,
      authenticated: true,
      hasAdmins,
      user: {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        fullName: userData.full_name,
        role: userData.role,
        storeCode: userData.store_code || null,
        mustChangePassword: Boolean(userData.must_change_password),
        permissions,
        createdAt: userData.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/admin/auth/me:', error);
    return NextResponse.json(
      { success: false, authenticated: false, error: publicErrorMessage(error) },
      { status: 500 }
    );
  }
}
