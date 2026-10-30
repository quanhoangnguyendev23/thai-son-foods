export type Role = 'SUPER_ADMIN' | 'MARKETING' | 'STORE_STAFF';

export type Permission =
  | 'dashboard.view_company'
  | 'dashboard.view_store'
  | 'cost_price.view'
  | 'cost_price.edit'
  | 'profit.view'
  | 'products.view'
  | 'products.manage_price'
  | 'products.manage'
  | 'combos.view'
  | 'combos.manage'
  | 'categories.view'
  | 'categories.manage'
  | 'content.manage'
  | 'users.manage'
  | 'orders.view_own_store'
  | 'orders.view_all'
  | 'orders.update_status_own_store'
  | 'orders.update_status_all'
  | 'orders.transfer'
  | 'cod.reconcile'
  | 'cod.process_return'
  | 'inventory.view_own_store'
  | 'inventory.update_own_store'
  | 'inventory.view_all'
  | 'inventory.view_total'
  | 'members.view_full'
  | 'members.view_masked'
  | 'members.manage'
  | 'stores.edit_own'
  | 'stores.edit_all'
  | 'system.sync'
  | 'system.seed'
  | 'upload.use'
  | 'audit.view'
  | 'partners.view'
  | 'partners.review'
  | 'partners.suspend'
  | 'partners.policy_manage'
  | 'payouts.view'
  | 'payouts.approve'
  | 'dealer.manage'
  | 'reviews.view'
  | 'reviews.reply'
  | 'reviews.moderate';

export const ALL_PERMISSIONS: readonly Permission[] = [
  'dashboard.view_company',
  'dashboard.view_store',
  'cost_price.view',
  'cost_price.edit',
  'profit.view',
  'products.view',
  'products.manage_price',
  'products.manage',
  'combos.view',
  'combos.manage',
  'categories.view',
  'categories.manage',
  'content.manage',
  'users.manage',
  'orders.view_own_store',
  'orders.view_all',
  'orders.update_status_own_store',
  'orders.update_status_all',
  'orders.transfer',
  'cod.reconcile',
  'cod.process_return',
  'inventory.view_own_store',
  'inventory.update_own_store',
  'inventory.view_all',
  'inventory.view_total',
  'members.view_full',
  'members.view_masked',
  'members.manage',
  'stores.edit_own',
  'stores.edit_all',
  'system.sync',
  'system.seed',
  'upload.use',
  'audit.view',
  'partners.view',
  'partners.review',
  'partners.suspend',
  'partners.policy_manage',
  'payouts.view',
  'payouts.approve',
  'dealer.manage',
  'reviews.view',
  'reviews.reply',
  'reviews.moderate',
] as const;

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,

  MARKETING: [
    'products.view',
    'products.manage_price',
    'products.manage',
    'combos.view',
    'combos.manage',
    'categories.view',
    'categories.manage',
    'content.manage',
    'upload.use',
    'inventory.view_total',
    'members.view_masked',
    'reviews.view',
    'reviews.reply',
    'reviews.moderate',
  ],

  STORE_STAFF: [
    'dashboard.view_store',
    'products.view',
    'combos.view',
    'categories.view',
    'orders.view_own_store',
    'orders.update_status_own_store',
    'inventory.view_own_store',
    'inventory.update_own_store',
    'stores.edit_own',
  ],
};

export interface UserSessionPayload {
  id?: string;
  username?: string;
  role?: string | null;
  storeCode?: string | null;
  [key: string]: unknown;
}

/**
 * Kiểm tra xem session của người dùng có quyền cụ thể hay không.
 * Hoàn toàn isomorphic, an toàn sử dụng cả ở Client lẫn Server.
 */
export function hasPermission(
  session: { role?: string | null; mustChangePassword?: boolean } | null | undefined,
  perm: Permission
): boolean {
  if (!session || !session.role) {
    return false;
  }
  // Tài khoản đang bị bắt buộc đổi mật khẩu (theo CSDL, qua getAdminSession) chưa được dùng quyền quản trị nào
  if (session.mustChangePassword === true) {
    return false;
  }
  const role = session.role as Role;
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) {
    return false;
  }
  return permissions.includes(perm);
}

export type AuthCheckResult =
  | { authorized: true; session: UserSessionPayload; response?: never }
  | { authorized: false; response: Response; session?: never };

/**
 * Kiểm tra quyền bắt buộc trên session, trả 401 hoặc 403 chuẩn JSON
 */
export function requirePermission(
  session: UserSessionPayload | null | undefined,
  perm: Permission
): AuthCheckResult {
  if (!session) {
    return {
      authorized: false,
      response: Response.json(
        {
          success: false,
          error: 'Chưa đăng nhập hoặc phiên đã hết hạn. Vui lòng đăng nhập lại.',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      ),
    };
  }

  // Bắt buộc đổi mật khẩu lần đầu trước khi thực hiện bất kỳ quyền quản trị nào
  if (session.mustChangePassword) {
    return {
      authorized: false,
      response: Response.json(
        {
          success: false,
          error: 'Tài khoản bắt buộc phải đổi mật khẩu lần đầu trước khi tiếp tục thao tác trên hệ thống.',
          code: 'MUST_CHANGE_PASSWORD',
        },
        { status: 403 }
      ),
    };
  }

  if (!hasPermission(session, perm)) {
    return {
      authorized: false,
      response: Response.json(
        {
          success: false,
          error: 'Bạn không có quyền thực hiện thao tác này.',
          code: 'FORBIDDEN',
          requiredPermission: perm,
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    session,
  };
}

/**
 * Helper lấy phạm vi store_code:
 * - STORE_STAFF: trả về store_code bắt buộc (không được xem/sửa ngoài store này)
 * - SUPER_ADMIN / MARKETING: trả về null (toàn công ty hoặc không giới hạn theo 1 store)
 */
/** Mã phạm vi "không khớp cửa hàng nào": dùng cho nhân viên cửa hàng chưa được gán chi nhánh (fail-closed) */
export const NO_STORE_SCOPE = '__NO_STORE_ASSIGNED__';

export function getStoreScope(session: { role?: string | null; storeCode?: string | null } | null | undefined): string | null {
  if (!session) return null;
  if (session.role === 'STORE_STAFF') {
    // Fail-closed: STORE_STAFF thiếu chi nhánh KHÔNG được hiểu là "toàn công ty"
    return session.storeCode || NO_STORE_SCOPE;
  }
  return null;
}
