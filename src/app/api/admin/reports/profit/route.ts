import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { isOrderStatus } from '@/lib/order-status';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Biên lợi nhuận chỉ tính trên phần doanh thu CÓ giá vốn (cùng cách tính với tổng quan) — dòng thiếu giá vốn không bị kéo lệch */
function marginOnCosted(r: { revenue: unknown; profit: unknown; revenue_without_cost?: unknown }): number {
  const costedRevenue = Number(r.revenue) - Number(r.revenue_without_cost || 0);
  return costedRevenue > 0 ? Math.round((Number(r.profit) / costedRevenue) * 1000) / 10 : 0;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'profit.view')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem báo cáo lợi nhuận.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const groupBy = (searchParams.get('groupBy') || 'day').toLowerCase(); // 'day' | 'month' | 'product' | 'store'
    const storeCode = searchParams.get('storeCode');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Điều kiện lọc chung cho orders: mặc định chỉ tính các đơn hàng đã hoàn tất (COMPLETED), loại bỏ hoàn toàn đơn hủy
    const statusParam = searchParams.get('status');
    const statusFilter = statusParam ? statusParam.toUpperCase() : 'COMPLETED';

    // Kiểm tra tham số đầu vào (tránh lỗi 500 do ép kiểu ngày / trạng thái lạ)
    if (statusFilter !== 'ALL' && !isOrderStatus(statusFilter)) {
      return NextResponse.json({ success: false, error: `Trạng thái không hợp lệ: ${statusFilter}` }, { status: 400 });
    }
    if ((startDate && !DATE_ONLY.test(startDate)) || (endDate && !DATE_ONLY.test(endDate))) {
      return NextResponse.json({ success: false, error: 'Ngày phải có dạng YYYY-MM-DD.' }, { status: 400 });
    }
    if (!['day', 'month', 'product', 'store'].includes(groupBy)) {
      return NextResponse.json({ success: false, error: 'groupBy chỉ nhận day | month | product | store.' }, { status: 400 });
    }
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (statusFilter !== 'ALL') {
      params.push(statusFilter);
      whereClauses.push(`o.status = $${params.length}`);
    } else {
      whereClauses.push(`o.status != 'CANCELLED'`);
    }

    if (storeCode && storeCode !== 'ALL') {
      params.push(storeCode);
      whereClauses.push(`o.store_code = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      whereClauses.push(`o.created_at >= $${params.length}::timestamp`);
    }

    if (endDate) {
      params.push(`${endDate} 23:59:59`);
      whereClauses.push(`o.created_at <= $${params.length}::timestamp`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 1. Thống kê tổng quan (Overall Summary)
    const summarySql = `
      SELECT
        COUNT(DISTINCT o.id) AS total_orders,
        COALESCE(SUM(oi.price * oi.quantity), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) > 0 THEN (oi.cost_price * oi.quantity) ELSE 0 END), 0) AS total_cost,
        COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) > 0 THEN ((oi.price - oi.cost_price) * oi.quantity) ELSE 0 END), 0) AS gross_profit,
        COUNT(CASE WHEN COALESCE(oi.cost_price, 0) > 0 THEN 1 END) AS items_with_cost,
        COUNT(CASE WHEN COALESCE(oi.cost_price, 0) <= 0 THEN 1 END) AS items_without_cost,
        COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) <= 0 THEN (oi.price * oi.quantity) ELSE 0 END), 0) AS revenue_without_cost
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      ${whereSql};
    `;

    const summaryRes = await query(summarySql, params);
    const rawSummary = summaryRes.rows[0] || {};

    const totalRevenue = Number(rawSummary.total_revenue) || 0;
    const totalCost = Number(rawSummary.total_cost) || 0;
    const grossProfit = Number(rawSummary.gross_profit) || 0;
    const itemsWithCost = Number(rawSummary.items_with_cost) || 0;
    const itemsWithoutCost = Number(rawSummary.items_without_cost) || 0;
    const revenueWithoutCost = Number(rawSummary.revenue_without_cost) || 0;
    const totalOrders = Number(rawSummary.total_orders) || 0;

    // Doanh thu chỉ tính cho các items đã có giá vốn để tính tỷ suất chính xác
    const revenueOfCostedItems = totalRevenue - revenueWithoutCost;
    const marginPercent = revenueOfCostedItems > 0
      ? Math.round((grossProfit / revenueOfCostedItems) * 1000) / 10
      : 0;

    // 2. Chi tiết theo tiêu chí phân nhóm (Breakdown)
    let breakdownRows: any[] = [];

    if (groupBy === 'month') {
      const monthSql = `
        SELECT
          to_char(o.created_at, 'YYYY-MM') AS period,
          to_char(o.created_at, 'MM/YYYY') AS label,
          COUNT(DISTINCT o.id) AS orders_count,
          COALESCE(SUM(oi.price * oi.quantity), 0) AS revenue,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) > 0 THEN (oi.cost_price * oi.quantity) ELSE 0 END), 0) AS cost,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) > 0 THEN ((oi.price - oi.cost_price) * oi.quantity) ELSE 0 END), 0) AS profit,
          COUNT(CASE WHEN COALESCE(oi.cost_price, 0) <= 0 THEN 1 END) AS missing_cost_items,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) <= 0 THEN (oi.price * oi.quantity) ELSE 0 END), 0) AS revenue_without_cost
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        ${whereSql}
        GROUP BY period, label
        ORDER BY period DESC;
      `;
      const res = await query(monthSql, params);
      breakdownRows = res.rows.map(r => ({
        ...r,
        revenue: Number(r.revenue),
        cost: Number(r.cost),
        profit: Number(r.profit),
        orders_count: Number(r.orders_count),
        missing_cost_items: Number(r.missing_cost_items),
        margin: marginOnCosted(r),
      }));
    } else if (groupBy === 'product') {
      const productSql = `
        SELECT
          COALESCE(oi.canonical_product_id, oi.product_id, 'unassigned') AS product_id,
          oi.name,
          COALESCE(SUM(oi.quantity), 0) AS quantity_sold,
          COALESCE(SUM(oi.price * oi.quantity), 0) AS revenue,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) > 0 THEN (oi.cost_price * oi.quantity) ELSE 0 END), 0) AS cost,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) > 0 THEN ((oi.price - oi.cost_price) * oi.quantity) ELSE 0 END), 0) AS profit,
          COUNT(CASE WHEN COALESCE(oi.cost_price, 0) <= 0 THEN 1 END) AS missing_cost_items,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) <= 0 THEN (oi.price * oi.quantity) ELSE 0 END), 0) AS revenue_without_cost
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        ${whereSql}
        GROUP BY COALESCE(oi.canonical_product_id, oi.product_id, 'unassigned'), oi.name
        ORDER BY revenue DESC;
      `;
      const res = await query(productSql, params);
      breakdownRows = res.rows.map(r => ({
        ...r,
        quantity_sold: Number(r.quantity_sold),
        revenue: Number(r.revenue),
        cost: Number(r.cost),
        profit: Number(r.profit),
        missing_cost_items: Number(r.missing_cost_items),
        margin: marginOnCosted(r),
      }));
    } else if (groupBy === 'store') {
      const storeSql = `
        SELECT
          COALESCE(o.store_code, 'CHƯA_GÁN') AS store_code,
          COALESCE(s.name, 'Chưa xác định') AS store_name,
          COUNT(DISTINCT o.id) AS orders_count,
          COALESCE(SUM(oi.price * oi.quantity), 0) AS revenue,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) > 0 THEN (oi.cost_price * oi.quantity) ELSE 0 END), 0) AS cost,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) > 0 THEN ((oi.price - oi.cost_price) * oi.quantity) ELSE 0 END), 0) AS profit,
          COUNT(CASE WHEN COALESCE(oi.cost_price, 0) <= 0 THEN 1 END) AS missing_cost_items,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) <= 0 THEN (oi.price * oi.quantity) ELSE 0 END), 0) AS revenue_without_cost
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN stores s ON s.code = o.store_code
        ${whereSql}
        GROUP BY o.store_code, s.name
        ORDER BY revenue DESC;
      `;
      const res = await query(storeSql, params);
      breakdownRows = res.rows.map(r => ({
        ...r,
        orders_count: Number(r.orders_count),
        revenue: Number(r.revenue),
        cost: Number(r.cost),
        profit: Number(r.profit),
        missing_cost_items: Number(r.missing_cost_items),
        margin: marginOnCosted(r),
      }));
    } else {
      // Default: 'day'
      const daySql = `
        SELECT
          to_char(o.created_at, 'YYYY-MM-DD') AS period,
          to_char(o.created_at, 'DD/MM/YYYY') AS label,
          COUNT(DISTINCT o.id) AS orders_count,
          COALESCE(SUM(oi.price * oi.quantity), 0) AS revenue,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) > 0 THEN (oi.cost_price * oi.quantity) ELSE 0 END), 0) AS cost,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) > 0 THEN ((oi.price - oi.cost_price) * oi.quantity) ELSE 0 END), 0) AS profit,
          COUNT(CASE WHEN COALESCE(oi.cost_price, 0) <= 0 THEN 1 END) AS missing_cost_items,
          COALESCE(SUM(CASE WHEN COALESCE(oi.cost_price, 0) <= 0 THEN (oi.price * oi.quantity) ELSE 0 END), 0) AS revenue_without_cost
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        ${whereSql}
        GROUP BY period, label
        ORDER BY period DESC
        LIMIT 60;
      `;
      const res = await query(daySql, params);
      breakdownRows = res.rows.map(r => ({
        ...r,
        revenue: Number(r.revenue),
        cost: Number(r.cost),
        profit: Number(r.profit),
        orders_count: Number(r.orders_count),
        missing_cost_items: Number(r.missing_cost_items),
        margin: marginOnCosted(r),
      }));
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalRevenue,
        totalCost,
        grossProfit,
        marginPercent,
        totalOrders,
        itemsWithCost,
        itemsWithoutCost,
        revenueWithoutCost,
        hasMissingCostData: itemsWithoutCost > 0,
        note: itemsWithoutCost > 0 
          ? `Có ${itemsWithoutCost} mục đơn hàng cũ chưa có snapshot giá vốn (tạo trước khi cấu hình giá vốn). Các mục này không bị tính sai lệch.`
          : 'Toàn bộ mục đơn hàng đã có đầy đủ snapshot giá vốn.',
      },
      groupBy,
      breakdown: breakdownRows,
    });
  } catch (error: any) {
    console.error('Profit report error:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
