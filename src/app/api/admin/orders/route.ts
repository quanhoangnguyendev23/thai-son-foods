import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission, getStoreScope, NO_STORE_SCOPE } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { sendOrderEmail } from '@/lib/email/service';
import { canDeleteOrder, canTransitionOrderStatus, isOrderStatus } from '@/lib/order-status';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const LEGACY_LIST_CAP = 500; // Gọi không có ?page → chỉ trả tối đa 500 đơn mới nhất (tương thích ngược)
const CSV_EXPORT_CAP = 20000;
const CSV_BOM = String.fromCharCode(0xfeff); // để Excel đọc đúng tiếng Việt UTF-8

function noStoreResponse() {
  return NextResponse.json(
    { success: false, error: 'Tài khoản nhân viên chưa được gán chi nhánh. Hãy liên hệ Quản trị viên cấp cao.', code: 'NO_STORE_ASSIGNED' },
    { status: 403 }
  );
}

/** Escape ký tự đại diện của LIKE để từ khóa "%" hay "_" không khớp tất cả */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Ô CSV an toàn: bọc ngoặc kép, nhân đôi dấu ", và chặn công thức Excel (=, +, -, @) */
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

// GET: Danh sách đơn hàng (phân trang phía server), chi tiết 1 đơn, hoặc xuất CSV (có kiểm tra quyền + chống IDOR)
export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (session.mustChangePassword) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản bắt buộc phải đổi mật khẩu lần đầu trước khi tiếp tục thao tác.', code: 'MUST_CHANGE_PASSWORD' },
        { status: 403 }
      );
    }

    const canViewAll = hasPermission(session, 'orders.view_all');
    const canViewOwnStore = hasPermission(session, 'orders.view_own_store');

    if (!canViewAll && !canViewOwnStore) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem đơn hàng.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const storeScope = getStoreScope(session);
    if (storeScope === NO_STORE_SCOPE) return noStoreResponse();

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('id');
    const status = searchParams.get('status') || 'ALL';
    const search = (searchParams.get('q') || '').trim();
    const queryStoreCode = searchParams.get('storeCode');
    const pageParam = searchParams.get('page');
    const isCsvExport = searchParams.get('export') === 'csv';

    const canViewCostPrice = hasPermission(session, 'cost_price.view');

    // 1. Nếu yêu cầu chi tiết 1 đơn hàng (chống IDOR)
    if (orderId) {
      const orderRes = await query(`SELECT * FROM orders WHERE id = $1;`, [orderId]);
      if (orderRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy đơn hàng' }, { status: 404 });
      }

      const orderData = orderRes.rows[0];

      // STORE_STAFF không được phép đọc đơn ngoài cửa hàng của mình (chống IDOR)
      if (storeScope && orderData.store_code !== storeScope) {
        return NextResponse.json(
          { success: false, error: 'Bạn không có quyền xem đơn hàng của cửa hàng khác.', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      const itemsRes = await query(
        `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC;`,
        [orderId]
      );

      const sanitizedItems = itemsRes.rows.map(item => {
        if (!canViewCostPrice) {
          const { cost_price, ...safeItem } = item;
          return safeItem;
        }
        return item;
      });

      return NextResponse.json({
        success: true,
        order: {
          ...orderData,
          items: sanitizedItems,
        },
      });
    }

    // 2. Điều kiện lọc dùng chung cho danh sách / đếm / xuất CSV
    //    (STORE_STAFF bị ép buộc dùng storeScope từ DB session)
    const baseParams: any[] = [];
    let baseWhere = 'WHERE 1=1';

    if (storeScope) {
      baseParams.push(storeScope);
      baseWhere += ` AND o.store_code = $${baseParams.length}`;
    } else if (queryStoreCode && queryStoreCode !== 'ALL') {
      baseParams.push(queryStoreCode);
      baseWhere += ` AND o.store_code = $${baseParams.length}`;
    }

    if (search) {
      baseParams.push(`%${escapeLike(search.toLowerCase())}%`);
      const p = `$${baseParams.length}`;
      baseWhere += ` AND (
        LOWER(o.order_code) LIKE ${p} ESCAPE '\\'
        OR LOWER(o.full_name) LIKE ${p} ESCAPE '\\'
        OR o.phone LIKE ${p} ESCAPE '\\'
        OR LOWER(COALESCE(o.email, '')) LIKE ${p} ESCAPE '\\'
      )`;
    }

    const filterParams = [...baseParams];
    let filterWhere = baseWhere;
    if (status !== 'ALL') {
      if (!isOrderStatus(status)) {
        return NextResponse.json({ success: false, error: `Trạng thái không hợp lệ: ${status}` }, { status: 400 });
      }
      filterParams.push(status);
      filterWhere += ` AND o.status = $${filterParams.length}`;
    }

    // 2a. Xuất CSV toàn bộ đơn theo bộ lọc hiện tại
    if (isCsvExport) {
      const res = await query(
        `SELECT o.order_code, o.full_name, o.phone, o.province, o.address, o.total, o.status, o.payment_method, o.store_code, o.created_at
         FROM orders o ${filterWhere} ORDER BY o.created_at DESC LIMIT ${CSV_EXPORT_CAP};`,
        filterParams
      );
      const header = ['Mã Đơn', 'Khách Hàng', 'Điện Thoại', 'Tỉnh/TP', 'Địa Chỉ', 'Tổng Tiền', 'Trạng Thái', 'Thanh Toán', 'Chi Nhánh', 'Ngày Đặt'];
      const lines = res.rows.map((o: any) =>
        [
          o.order_code,
          o.full_name,
          o.phone,
          o.province,
          o.address,
          o.total,
          o.status,
          o.payment_method,
          o.store_code,
          o.created_at ? new Date(o.created_at).toISOString() : '',
        ]
          .map(csvCell)
          .join(',')
      );
      await writeAuditLog({
        adminId: session.id,
        adminUsername: session.username,
        role: session.role,
        action: 'ORDER_EXPORT_CSV',
        entityType: 'ORDER',
        storeCode: storeScope || undefined,
        afterJson: { rows: res.rows.length, status, q: search },
      });
      return new NextResponse(CSV_BOM + [header.map(csvCell).join(','), ...lines].join('\r\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Don_Hang_Thai_Son_Foods_${new Date().toISOString().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 2b. Danh sách đơn: phân trang trước, rồi mới gom sản phẩm cho đúng các đơn của trang đó
    const costFieldSql = canViewCostPrice ? `'cost_price', oi.cost_price,` : '';
    const selectSql = `
      SELECT
        o.*,
        (SELECT COUNT(*) FROM order_items oc WHERE oc.order_id = o.id) AS item_count,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', oi.id,
              'name', oi.name,
              'price', oi.price,
              ${costFieldSql}
              'quantity', oi.quantity,
              'unit', oi.unit,
              'thumbnail', oi.thumbnail,
              'bottle_multiplier', oi.bottle_multiplier,
              'total_bottles', oi.total_bottles,
              'canonical_product_id', oi.canonical_product_id,
              'combo_snapshot', oi.combo_snapshot
            ) ORDER BY oi.id
          )
          FROM order_items oi WHERE oi.order_id = o.id
        ), '[]') AS items
      FROM orders o
      ${filterWhere}
      ORDER BY o.created_at DESC, o.id DESC
    `;

    // Tương thích ngược: không có ?page → trả danh sách (tối đa LEGACY_LIST_CAP đơn mới nhất)
    if (pageParam === null) {
      const res = await query(`${selectSql} LIMIT ${LEGACY_LIST_CAP};`, filterParams);
      return NextResponse.json({ success: true, data: res.rows });
    }

    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || '', 10) || DEFAULT_PAGE_SIZE));

    const [totalRes, countsRes, paymentRes] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total FROM orders o ${filterWhere};`, filterParams),
      // Số đơn theo từng trạng thái (áp dụng chi nhánh + từ khóa, KHÔNG áp dụng bộ lọc trạng thái) cho các tab lọc
      query(`SELECT o.status, COUNT(*)::int AS count FROM orders o ${baseWhere} GROUP BY o.status;`, baseParams),
      query(`SELECT LOWER(COALESCE(o.payment_method, 'cod')) AS method, COUNT(*)::int AS count FROM orders o ${baseWhere} GROUP BY 1;`, baseParams),
    ]);

    const total: number = totalRes.rows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);

    const statusCounts: Record<string, number> = { ALL: 0 };
    for (const row of countsRes.rows) {
      statusCounts[row.status] = row.count;
      statusCounts.ALL += row.count;
    }

    const listParams = [...filterParams, limit, (safePage - 1) * limit];
    const res = await query(
      `${selectSql} LIMIT $${listParams.length - 1} OFFSET $${listParams.length};`,
      listParams
    );

    return NextResponse.json({
      success: true,
      data: res.rows,
      pagination: { page: safePage, limit, total, totalPages },
      statusCounts,
      paymentCounts: Object.fromEntries(paymentRes.rows.map((r: any) => [r.method, r.count])),
    });
  } catch (error: any) {
    console.error('Error fetching admin orders:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// PUT: Cập nhật trạng thái đơn hàng hoặc ghi chú (chống IDOR + chống Mass Assignment + kiểm tra thứ tự chuyển trạng thái)
export async function PUT(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (session.mustChangePassword) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản bắt buộc phải đổi mật khẩu lần đầu trước khi tiếp tục thao tác.', code: 'MUST_CHANGE_PASSWORD' },
        { status: 403 }
      );
    }

    const canUpdateAll = hasPermission(session, 'orders.update_status_all');
    const canUpdateOwnStore = hasPermission(session, 'orders.update_status_own_store');

    if (!canUpdateAll && !canUpdateOwnStore) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền cập nhật đơn hàng.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const storeScope = getStoreScope(session);
    if (storeScope === NO_STORE_SCOPE) return noStoreResponse();

    // Chống Mass Assignment: Chỉ bóc tách các trường hợp lệ từ request body
    const body = await request.json();
    const { id, status, note, shipperName, shipperPhone } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Thiếu ID đơn hàng hợp lệ' }, { status: 400 });
    }

    if (status !== undefined && status !== null && !isOrderStatus(status)) {
      return NextResponse.json(
        { success: false, error: `Trạng thái không hợp lệ: ${status}` },
        { status: 400 }
      );
    }
    if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 2000)) {
      return NextResponse.json({ success: false, error: 'Ghi chú không hợp lệ (tối đa 2000 ký tự).' }, { status: 400 });
    }

    let deductedNow = false;
    let currentOrder: any;
    let targetStoreCode: string;
    let updatedOrder: any;

    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      // 1. Khóa dòng đơn hàng trong transaction: tránh hai admin đổi trạng thái cùng lúc (Anti-race + Anti-IDOR)
      const currentOrderRes = await client.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE;`, [id]);
      if (currentOrderRes.rows.length === 0) {
        await client.query('ROLLBACK;');
        return NextResponse.json({ success: false, error: 'Không tìm thấy đơn hàng' }, { status: 404 });
      }
      currentOrder = currentOrderRes.rows[0];

      // Chống IDOR: STORE_STAFF sửa đơn ngoài cửa hàng của mình phải bị 403
      if (storeScope && currentOrder.store_code && currentOrder.store_code !== storeScope) {
        await client.query('ROLLBACK;');
        return NextResponse.json(
          {
            success: false,
            error: `Bạn không có quyền sửa đơn hàng thuộc chi nhánh ${currentOrder.store_code}.`,
            code: 'FORBIDDEN',
          },
          { status: 403 }
        );
      }

      // 2. Kiểm tra thứ tự chuyển trạng thái hợp lệ
      if (status && !canTransitionOrderStatus(currentOrder.status, status)) {
        await client.query('ROLLBACK;');
        return NextResponse.json(
          {
            success: false,
            error: `Không thể chuyển đơn từ "${currentOrder.status}" sang "${status}". Đơn Hoàn tất / Đã hủy là trạng thái cuối và đơn không được lùi về bước trước.`,
            code: 'INVALID_STATUS_TRANSITION',
          },
          { status: 409 }
        );
      }
      const statusChanged = Boolean(status) && status !== currentOrder.status;

      // Xác định cửa hàng xử lý đơn
      targetStoreCode = currentOrder.store_code || storeScope || (session.username !== 'admin' ? session.username : 'NH');

      if (statusChanged) {
        if (status === 'CONFIRMED' || status === 'PROCESSING' || status === 'SHIPPING' || status === 'COMPLETED') {
          const { confirmStock } = await import('@/lib/inventory');
          const confirmRes = await confirmStock(id, targetStoreCode, client, session.username, {
            allowOversellClamped: Boolean(body.allowOversell || body.forceConfirm),
          });
          deductedNow = !confirmRes.alreadyConfirmed;
        } else if (status === 'CANCELLED') {
          const { releaseStock } = await import('@/lib/inventory');
          await releaseStock(id, client, note || 'Hủy bởi Admin', session.username);
        }
      }

      // Cập nhật thông tin đơn hàng
      const res = await client.query(
        `UPDATE orders SET
          status = COALESCE($2, status),
          note = COALESCE($3, note),
          store_code = COALESCE(store_code, $4)
         WHERE id = $1
         RETURNING *;`,
        [
          id,
          status || null,
          note !== undefined ? note : null,
          targetStoreCode,
        ]
      );
      updatedOrder = res.rows[0];

      // Đồng bộ trạng thái đối tác (Partner / CTV / Đại lý) — chỉ khi trạng thái thực sự thay đổi
      if (statusChanged && status === 'COMPLETED') {
        const { processPartnerOrderEvent } = await import('@/lib/partner/orderEvent');
        await processPartnerOrderEvent(id, 'ORDER_COMPLETED', { client, actor: session.username });
      } else if (statusChanged && status === 'CANCELLED') {
        const { processPartnerOrderEvent } = await import('@/lib/partner/orderEvent');
        await processPartnerOrderEvent(id, 'ORDER_CANCELLED', { client, actor: session.username, note });
      }

      await client.query('COMMIT;');
    } catch (txErr) {
      await client.query('ROLLBACK;');
      throw txErr;
    } finally {
      client.release();
    }

    const statusChanged = Boolean(status) && status !== currentOrder.status;

    // Ghi Audit Log cho hành động cập nhật trạng thái đơn hàng
    await writeAuditLog({
      adminId: session.id,
      adminUsername: session.username,
      role: session.role,
      action: status === 'CANCELLED' && statusChanged ? 'ORDER_CANCEL' : 'ORDER_STATUS_UPDATE',
      entityType: 'ORDER',
      entityId: id,
      storeCode: targetStoreCode,
      beforeJson: {
        status: currentOrder.status,
        note: currentOrder.note,
        store_code: currentOrder.store_code,
      },
      afterJson: {
        status: updatedOrder.status,
        note: updatedOrder.note,
        store_code: updatedOrder.store_code,
      },
    });

    // Gửi email trạng thái cho khách hàng (Non-blocking async) — CHỈ khi trạng thái thật sự đổi, tránh gửi lặp
    if (statusChanged && updatedOrder && updatedOrder.email && (status === 'SHIPPING' || status === 'COMPLETED')) {
      (async () => {
        try {
          const itemsRes = await query(`SELECT * FROM order_items WHERE order_id = $1;`, [id]);
          const emailItems = itemsRes.rows.map((it: any) => ({
            name: it.name,
            price: it.price,
            quantity: it.quantity,
            unit: it.unit,
            thumbnail: it.thumbnail,
          }));

          const payload = {
            id: updatedOrder.id,
            orderCode: updatedOrder.order_code,
            fullName: updatedOrder.full_name,
            phone: updatedOrder.phone,
            email: updatedOrder.email,
            address: updatedOrder.address,
            province: updatedOrder.province,
            district: updatedOrder.district,
            ward: updatedOrder.ward,
            paymentMethod: updatedOrder.payment_method,
            shippingFee: updatedOrder.shipping_fee,
            subtotal: updatedOrder.subtotal,
            total: updatedOrder.total,
            note: updatedOrder.note,
            storeCode: updatedOrder.store_code,
            storeAddress: updatedOrder.store_address,
            items: emailItems,
          };

          if (status === 'SHIPPING') {
            await sendOrderEmail('ORDER_SHIPPING', payload, {
              shipperName: shipperName || 'Đội ngũ giao nhận Thái Sơn Foods',
              shipperPhone: shipperPhone || '028 6291 5024',
              storeAddress: updatedOrder.store_address,
            });
          } else if (status === 'COMPLETED') {
            await sendOrderEmail('ORDER_COMPLETED', payload);
          }
        } catch (mailErr) {
          console.error('[AdminOrders] Error triggering status email:', mailErr);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      deducted: deductedNow,
      storeCode: targetStoreCode,
      message:
        statusChanged && status === 'SHIPPING' && updatedOrder.email
          ? `Đã chuyển sang Giao hàng và gửi email thông báo đến ${updatedOrder.email}!`
          : statusChanged && status === 'COMPLETED' && updatedOrder.email
          ? `Đã hoàn tất đơn hàng và gửi email cảm ơn + cẩm nang bảo quản đến ${updatedOrder.email}!`
          : deductedNow
          ? `Đã xác nhận đơn hàng #${updatedOrder?.order_code || id} và trừ hàng hoá từ kho ${targetStoreCode} thành công!`
          : undefined,
    });
  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// PATCH: Hỗ trợ cú pháp PATCH tương đương PUT
export const PATCH = PUT;

// DELETE: Xóa đơn hàng (chỉ cấp quản trị cao nhất). Chỉ xóa được đơn Đã hủy hoặc Chờ xử lý;
// đơn Chờ xử lý sẽ được hủy trước (nhả giữ chỗ tồn kho, hủy hoa hồng đối tác) trong CÙNG một transaction.
export async function DELETE(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (session.mustChangePassword) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản bắt buộc phải đổi mật khẩu lần đầu trước khi tiếp tục thao tác.', code: 'MUST_CHANGE_PASSWORD' },
        { status: 403 }
      );
    }

    if (!hasPermission(session, 'orders.update_status_all')) {
      return NextResponse.json(
        { success: false, error: 'Chỉ Quản trị viên cấp cao mới có quyền xóa đơn hàng.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID đơn hàng' }, { status: 400 });
    }

    let currentOrder: any;
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      const currentOrderRes = await client.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE;`, [id]);
      if (currentOrderRes.rows.length === 0) {
        await client.query('ROLLBACK;');
        return NextResponse.json({ success: false, error: 'Không tìm thấy đơn hàng' }, { status: 404 });
      }
      currentOrder = currentOrderRes.rows[0];

      if (!canDeleteOrder(currentOrder.status)) {
        await client.query('ROLLBACK;');
        return NextResponse.json(
          {
            success: false,
            error: 'Chỉ xóa được đơn "Đã hủy" hoặc "Chờ xử lý". Đơn đã xác nhận / đang giao / hoàn tất đã phát sinh xuất kho và doanh thu — hãy hủy đơn thay vì xóa.',
            code: 'ORDER_NOT_DELETABLE',
          },
          { status: 409 }
        );
      }

      if (currentOrder.status !== 'CANCELLED') {
        const { releaseStock } = await import('@/lib/inventory');
        await releaseStock(id, client, 'Xóa đơn hàng bởi Admin', session.username);
      }

      // order_items, stock_reservations... tự xóa theo ON DELETE CASCADE; sổ cái đối tác giữ lại (order_id → NULL)
      await client.query(`DELETE FROM orders WHERE id = $1;`, [id]);
      await client.query('COMMIT;');
    } catch (txErr) {
      await client.query('ROLLBACK;');
      throw txErr;
    } finally {
      client.release();
    }

    await writeAuditLog({
      adminId: session.id,
      adminUsername: session.username,
      role: session.role,
      action: 'ORDER_DELETE',
      entityType: 'ORDER',
      entityId: id,
      storeCode: currentOrder.store_code,
      beforeJson: currentOrder,
      afterJson: null,
    });

    return NextResponse.json({ success: true, message: 'Đã xóa đơn hàng thành công' });
  } catch (error: any) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
