import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission, getStoreScope } from '@/lib/rbac';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

/** Khoảng ngày (giờ Việt Nam) cho biểu đồ: mặc định 7 ngày gần nhất, tối đa 366 ngày. */
function parseRange(url: URL): { from: string | null; to: string | null } {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) return { from: null, to: null };
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(to + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b) || b < a || (b - a) / 86400000 + 1 > MAX_RANGE_DAYS) return { from: null, to: null };
  return { from, to };
}

/** Doanh thu theo ngày + top sản phẩm theo doanh thu trong khoảng [from, to] (null = 7 ngày gần nhất). */
async function getRangeStats(storeScope: string | null, from: string | null, to: string | null) {
  const params: unknown[] = [from, to];
  let storeFilter = '';
  if (storeScope) {
    params.push(storeScope);
    storeFilter = ' AND o.store_code = $3';
  }
  const bounds = `
    WITH vn_today AS (SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d),
    rng AS (
      SELECT COALESCE($1::date, (SELECT d FROM vn_today) - 6) AS d_from,
             COALESCE($2::date, (SELECT d FROM vn_today)) AS d_to
    )`;
  const trendRes = await query(
    `${bounds},
    dates AS (SELECT generate_series((SELECT d_from FROM rng), (SELECT d_to FROM rng), '1 day'::interval)::date AS day)
    SELECT
      to_char(d.day, 'DD/MM') AS date_label,
      to_char(d.day, 'YYYY-MM-DD') AS date_iso,
      COUNT(o.id) FILTER (WHERE o.status = 'COMPLETED') AS order_count,
      COALESCE(SUM(o.total) FILTER (WHERE o.status = 'COMPLETED'), 0) AS daily_revenue,
      COUNT(o.id) FILTER (WHERE COALESCE(o.status, '') <> 'CANCELLED') AS placed_count,
      COALESCE(SUM(o.total) FILTER (WHERE COALESCE(o.status, '') <> 'CANCELLED'), 0) AS placed_revenue
    FROM dates d
    LEFT JOIN orders o ON (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d.day${storeFilter}
    GROUP BY d.day
    ORDER BY d.day ASC;`,
    params
  );
  const topRes = await query(
    `${bounds}
    SELECT p.id, p.name, p.sku, p.thumbnail, p.price, p.unit,
      COALESCE(SUM(oi.quantity), 0) AS total_sold,
      COALESCE(SUM(oi.quantity * oi.price), 0) AS total_earned
    FROM products p
    INNER JOIN order_items oi ON COALESCE(oi.canonical_product_id, oi.product_id) = p.id
    INNER JOIN orders o ON o.id = oi.order_id AND o.status = 'COMPLETED'
    WHERE (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN (SELECT d_from FROM rng) AND (SELECT d_to FROM rng)${storeFilter}
    GROUP BY p.id, p.name, p.sku, p.thumbnail, p.price, p.unit
    ORDER BY total_earned DESC, total_sold DESC
    LIMIT 6;`,
    params
  );
  const rows = trendRes.rows || [];
  return {
    revenueTrend: rows,
    topProducts: topRes.rows || [],
    range: { from: rows[0]?.date_iso || from, to: rows[rows.length - 1]?.date_iso || to },
  };
}

export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // MARKETING không có quyền xem thống kê doanh thu / dashboard
    const canViewCompany = hasPermission(session, 'dashboard.view_company');
    const canViewStore = hasPermission(session, 'dashboard.view_store');

    if (!canViewCompany && !canViewStore) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền truy cập dữ liệu thống kê.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const storeScope = getStoreScope(session);

    // Chỉ lấy biểu đồ doanh thu + top sản phẩm theo khoảng ngày (bộ chọn thời gian ở trang Tổng quan)
    const url = new URL(request.url);
    if (url.searchParams.get('section') === 'range') {
      const { from, to } = parseRange(url);
      const data = await getRangeStats(storeScope, from, to);
      return NextResponse.json({ success: true, storeScope: storeScope || 'ALL', ...data });
    }

    // 1. Overall summary (toàn công ty hoặc theo cửa hàng của chính mình)
    const summaryRes = storeScope
      ? await query(
          `SELECT 
            COUNT(*) AS total_orders,
            COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total ELSE 0 END), 0) AS total_revenue,
            COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN subtotal ELSE 0 END), 0) AS completed_subtotal,
            COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END), 0) AS gross_revenue,
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_orders,
            COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_orders,
            COUNT(CASE WHEN status = 'PROCESSING' THEN 1 END) AS processing_orders,
            COUNT(CASE WHEN status = 'SHIPPING' THEN 1 END) AS shipping_orders,
            COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) AS cancelled_orders
          FROM orders
          WHERE store_code = $1;`,
          [storeScope]
        )
      : await query(`
          SELECT 
            COUNT(*) AS total_orders,
            COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total ELSE 0 END), 0) AS total_revenue,
            COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN subtotal ELSE 0 END), 0) AS completed_subtotal,
            COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END), 0) AS gross_revenue,
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_orders,
            COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_orders,
            COUNT(CASE WHEN status = 'PROCESSING' THEN 1 END) AS processing_orders,
            COUNT(CASE WHEN status = 'SHIPPING' THEN 1 END) AS shipping_orders,
            COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) AS cancelled_orders
          FROM orders;
        `);

    // 2. Product count
    const prodCountRes = await query(`
      SELECT 
        COUNT(*) AS total_products,
        COUNT(CASE WHEN is_active = true THEN 1 END) AS active_products,
        COUNT(CASE WHEN is_featured = true THEN 1 END) AS featured_products,
        COUNT(CASE WHEN is_best_seller = true THEN 1 END) AS best_seller_products
      FROM products;
    `);

    // 2b. Combo count
    const comboCountRes = await query(`
      SELECT 
        COUNT(*) AS total_combos,
        COUNT(CASE WHEN is_active = true THEN 1 END) AS active_combos,
        COUNT(CASE WHEN is_featured = true THEN 1 END) AS featured_combos
      FROM combos;
    `);

    // 3. Category count
    const catCountRes = await query(`SELECT COUNT(*) AS total_categories FROM categories;`);

    // 3b. Member users count
    const memberCountRes = await query(`
      SELECT 
        COUNT(*) AS total_members,
        COUNT(CASE WHEN provider = 'google' THEN 1 END) AS google_members,
        COUNT(CASE WHEN is_active = true THEN 1 END) AS active_members
      FROM users;
    `);

    // 4. Status breakdown
    const statusBreakdownRes = storeScope
      ? await query(
          `SELECT status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total_amount
           FROM orders
           WHERE store_code = $1
           GROUP BY status;`,
          [storeScope]
        )
      : await query(`
          SELECT status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total_amount
          FROM orders
          GROUP BY status;
        `);

    // 5. Recent 8 orders
    const recentOrdersRes = storeScope
      ? await query(
          `SELECT id, order_code, full_name, phone, province, total, status, created_at, store_code
           FROM orders
           WHERE store_code = $1
           ORDER BY created_at DESC
           LIMIT 8;`,
          [storeScope]
        )
      : await query(`
          SELECT id, order_code, full_name, phone, province, total, status, created_at, store_code
          FROM orders
          ORDER BY created_at DESC
          LIMIT 8;
        `);

    // 6. Top selling products (chỉ tính đơn COMPLETED)
    const topProductsRes = storeScope
      ? await query(
          `SELECT 
            p.id, 
            p.name, 
            p.thumbnail, 
            p.price, 
            p.unit,
            c.name AS category_name,
            COALESCE(SUM(oi.quantity), 0) AS total_sold,
            COALESCE(SUM(oi.quantity * oi.price), 0) AS total_earned
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          INNER JOIN order_items oi ON COALESCE(oi.canonical_product_id, oi.product_id) = p.id
          INNER JOIN orders o ON o.id = oi.order_id AND o.status = 'COMPLETED'
          WHERE o.store_code = $1
          GROUP BY p.id, p.name, p.thumbnail, p.price, p.unit, c.name
          ORDER BY total_earned DESC, total_sold DESC
          LIMIT 6;`,
          [storeScope]
        )
      : await query(`
          SELECT 
            p.id, 
            p.name, 
            p.thumbnail, 
            p.price, 
            p.unit,
            c.name AS category_name,
            COALESCE(SUM(oi.quantity), 0) AS total_sold,
            COALESCE(SUM(oi.quantity * oi.price), 0) AS total_earned
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          INNER JOIN order_items oi ON COALESCE(oi.canonical_product_id, oi.product_id) = p.id
          INNER JOIN orders o ON o.id = oi.order_id AND o.status = 'COMPLETED'
          GROUP BY p.id, p.name, p.thumbnail, p.price, p.unit, c.name
          ORDER BY total_earned DESC, total_sold DESC
          LIMIT 6;
        `);

    // 7. Last 7 days trend theo ngày GIỜ VIỆT NAM (không phụ thuộc múi giờ máy chủ CSDL, cloud thường là UTC):
    //    - placed_count / placed_revenue: "Doanh số đặt hàng" = mọi đơn không bị huỷ (gồm đơn chờ xác nhận, đang giao)
    //    - order_count / daily_revenue: "Doanh thu hoàn thành" = đơn COMPLETED (giữ tên cũ)
    const last7DaysSql = (storeFilter: string) => `
          WITH vn_today AS (SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d),
          dates AS (
            SELECT generate_series((SELECT d FROM vn_today) - 6, (SELECT d FROM vn_today), '1 day'::interval)::date AS day
          )
          SELECT
            to_char(d.day, 'DD/MM') AS date_label,
            COUNT(o.id) FILTER (WHERE o.status = 'COMPLETED') AS order_count,
            COALESCE(SUM(o.total) FILTER (WHERE o.status = 'COMPLETED'), 0) AS daily_revenue,
            COUNT(o.id) FILTER (WHERE COALESCE(o.status, '') <> 'CANCELLED') AS placed_count,
            COALESCE(SUM(o.total) FILTER (WHERE COALESCE(o.status, '') <> 'CANCELLED'), 0) AS placed_revenue
          FROM dates d
          LEFT JOIN orders o ON (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d.day${storeFilter}
          GROUP BY d.day
          ORDER BY d.day ASC;`;
    const last7DaysRes = storeScope
      ? await query(last7DaysSql(' AND o.store_code = $1'), [storeScope])
      : await query(last7DaysSql(''));

    // 8. Profit overview (CHỈ dành riêng cho SUPER_ADMIN với profit.view, tính trên đơn COMPLETED)
    const canViewProfit = hasPermission(session, 'profit.view');
    let profitOverview: any = null;
    if (canViewProfit) {
      const profitRes = await query(`
        SELECT
          COALESCE(SUM(oi.price * oi.quantity), 0) AS total_revenue,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) > 0 THEN (oi.cost_price * oi.quantity) ELSE 0 END), 0) AS total_cost,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) > 0 THEN ((oi.price - oi.cost_price) * oi.quantity) ELSE 0 END), 0) AS gross_profit,
          COUNT(CASE WHEN COALESCE(oi.cost_price, 0) <= 0 THEN 1 END) AS missing_cost_items
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.status = 'COMPLETED';
      `);
      if (profitRes.rows.length > 0) {
        profitOverview = profitRes.rows[0];
      }
    }

    return NextResponse.json({
      success: true,
      storeScope: storeScope || 'ALL',
      summary: summaryRes.rows[0] || {},
      products: prodCountRes.rows[0] || {},
      combos: comboCountRes.rows[0] || {},
      categories: catCountRes.rows[0] || {},
      // Số liệu khách hàng chỉ dành cho người có quyền xem thành viên (nhân viên chi nhánh không thấy tổng khách toàn công ty)
      members: hasPermission(session, 'members.view_full') || hasPermission(session, 'members.view_masked') ? (memberCountRes.rows[0] || {}) : {},
      statusBreakdown: statusBreakdownRes.rows || [],
      recentOrders: recentOrdersRes.rows || [],
      topProducts: topProductsRes.rows || [],
      revenueTrend: last7DaysRes.rows || [],
      ...(canViewProfit && profitOverview ? { profitOverview } : {}),
      dbStatus: {
        connected: true,
        database: 'WebTSF',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        dbStatus: { connected: false, error: publicErrorMessage(error) },
      },
      { status: 500 }
    );
  }
}
