import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { isOrderStatus } from '@/lib/order-status';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Ngày/tháng của đơn tính theo giờ Việt Nam (không phụ thuộc múi giờ của máy chủ DB) */
const LOCAL_TS = `(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')`;

/** Dòng hàng có snapshot giá vốn lúc đặt đơn */
const HAS_COST = `COALESCE(oi.cost_price, 0) > 0`;

/**
 * Các chỉ số dùng chung cho tổng quan và mọi cách nhóm.
 * Lợi nhuận gộp CHỈ tính trên phần doanh thu có giá vốn: profit = revenue_with_cost - cost.
 * Phần doanh thu chưa có giá vốn được tách riêng (revenue_without_cost), không cộng vào lợi nhuận.
 */
const MEASURES = `
  COUNT(DISTINCT o.id) AS orders_count,
  COALESCE(SUM(oi.price * oi.quantity), 0) AS revenue,
  COALESCE(SUM(CASE WHEN ${HAS_COST} THEN oi.price * oi.quantity ELSE 0 END), 0) AS revenue_with_cost,
  COALESCE(SUM(CASE WHEN ${HAS_COST} THEN oi.cost_price * oi.quantity ELSE 0 END), 0) AS cost,
  COALESCE(SUM(CASE WHEN ${HAS_COST} THEN 0 ELSE oi.price * oi.quantity END), 0) AS revenue_without_cost,
  COUNT(*) FILTER (WHERE ${HAS_COST}) AS items_with_cost,
  COUNT(*) FILTER (WHERE NOT (${HAS_COST})) AS missing_cost_items
`;

type MeasureRow = {
  orders_count?: unknown;
  revenue: unknown;
  revenue_with_cost: unknown;
  cost: unknown;
  revenue_without_cost: unknown;
  items_with_cost?: unknown;
  missing_cost_items?: unknown;
};

function roundPct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

/** Chuẩn hoá một dòng kết quả: số cho mọi chỉ số + lợi nhuận, tỷ suất, tỷ lệ doanh thu có giá vốn */
function normalize<T extends MeasureRow>(r: T) {
  const revenue = Number(r.revenue) || 0;
  const revenueWithCost = Number(r.revenue_with_cost) || 0;
  const cost = Number(r.cost) || 0;
  const profit = revenueWithCost - cost;
  return {
    ...r,
    orders_count: r.orders_count !== undefined ? Number(r.orders_count) || 0 : undefined,
    revenue,
    revenue_with_cost: revenueWithCost,
    revenue_without_cost: Number(r.revenue_without_cost) || 0,
    cost,
    profit,
    margin: roundPct(profit, revenueWithCost),
    cost_coverage: roundPct(revenueWithCost, revenue),
    items_with_cost: Number(r.items_with_cost) || 0,
    missing_cost_items: Number(r.missing_cost_items) || 0,
  };
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

    // Mặc định chỉ tính các đơn đã hoàn tất (COMPLETED), loại bỏ hoàn toàn đơn hủy
    const statusParam = searchParams.get('status');
    const statusFilter = statusParam ? statusParam.toUpperCase() : 'COMPLETED';

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

    // Lọc ngày theo giờ Việt Nam: [startDate 00:00, endDate + 1 ngày 00:00)
    if (startDate) {
      params.push(startDate);
      whereClauses.push(`${LOCAL_TS} >= $${params.length}::date`);
    }

    if (endDate) {
      params.push(endDate);
      whereClauses.push(`${LOCAL_TS} < ($${params.length}::date + 1)`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const fromSql = `FROM orders o JOIN order_items oi ON oi.order_id = o.id`;

    // 1. Tổng quan
    const summaryRes = await query(`SELECT ${MEASURES} ${fromSql} ${whereSql};`, params);
    const s = normalize(summaryRes.rows[0] || { revenue: 0, revenue_with_cost: 0, cost: 0, revenue_without_cost: 0 });

    // Sản phẩm đang thiếu giá vốn (để biết cần nhập giá vốn cho món nào)
    const missingRes = await query(
      `SELECT oi.name,
              COUNT(*) AS items,
              COALESCE(SUM(oi.price * oi.quantity), 0) AS revenue
       ${fromSql}
       ${whereSql ? `${whereSql} AND` : 'WHERE'} NOT (${HAS_COST})
       GROUP BY oi.name
       ORDER BY revenue DESC
       LIMIT 10;`,
      params
    );
    const missingCostProducts = missingRes.rows.map((r: any) => ({
      name: r.name,
      items: Number(r.items) || 0,
      revenue: Number(r.revenue) || 0,
    }));

    // 2. Chi tiết theo cách nhóm
    let breakdownSql: string;
    if (groupBy === 'month') {
      breakdownSql = `
        SELECT to_char(${LOCAL_TS}, 'YYYY-MM') AS period,
               to_char(${LOCAL_TS}, 'MM/YYYY') AS label,
               ${MEASURES}
        ${fromSql}
        ${whereSql}
        GROUP BY period, label
        ORDER BY period DESC;`;
    } else if (groupBy === 'product') {
      breakdownSql = `
        SELECT COALESCE(oi.canonical_product_id, oi.product_id, 'unassigned') AS product_id,
               oi.name,
               COALESCE(SUM(oi.quantity), 0) AS quantity_sold,
               ${MEASURES}
        ${fromSql}
        ${whereSql}
        GROUP BY COALESCE(oi.canonical_product_id, oi.product_id, 'unassigned'), oi.name
        ORDER BY revenue DESC;`;
    } else if (groupBy === 'store') {
      breakdownSql = `
        SELECT COALESCE(o.store_code, 'CHƯA_GÁN') AS store_code,
               COALESCE(s.name, 'Chưa xác định') AS store_name,
               ${MEASURES}
        ${fromSql}
        LEFT JOIN stores s ON s.code = o.store_code
        ${whereSql}
        GROUP BY o.store_code, s.name
        ORDER BY revenue DESC;`;
    } else {
      breakdownSql = `
        SELECT to_char(${LOCAL_TS}, 'YYYY-MM-DD') AS period,
               to_char(${LOCAL_TS}, 'DD/MM/YYYY') AS label,
               ${MEASURES}
        ${fromSql}
        ${whereSql}
        GROUP BY period, label
        ORDER BY period DESC
        LIMIT 60;`;
    }

    const breakdownRes = await query(breakdownSql, params);
    const breakdownRows = breakdownRes.rows.map((r: any) => {
      const row = normalize(r);
      if (groupBy === 'product') {
        // Theo sản phẩm hiển thị số lượng bán thay cho số đơn
        return { ...row, orders_count: undefined, quantity_sold: Number(r.quantity_sold) || 0 };
      }
      return row;
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalOrders: s.orders_count || 0,
        totalRevenue: s.revenue,
        revenueWithCost: s.revenue_with_cost,
        revenueWithoutCost: s.revenue_without_cost,
        totalCost: s.cost,
        grossProfit: s.profit,
        marginPercent: s.margin,
        costCoveragePercent: s.cost_coverage,
        itemsWithCost: s.items_with_cost,
        itemsWithoutCost: s.missing_cost_items,
        hasMissingCostData: s.missing_cost_items > 0,
        missingCostProducts,
        note: s.missing_cost_items > 0
          ? `Có ${s.missing_cost_items} dòng hàng chưa có giá vốn lúc đặt đơn (sản phẩm chưa được nhập giá vốn). Phần doanh thu này được tách riêng, không tính vào giá vốn và lợi nhuận gộp.`
          : 'Toàn bộ dòng hàng đã có giá vốn.',
      },
      groupBy,
      breakdown: breakdownRows,
    });
  } catch (error: any) {
    console.error('Profit report error:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
