'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  ArrowLeft,
  X,
  CreditCard,
  Send,
  Building2,
  Check
} from 'lucide-react';

interface PayoutRow {
  id: string;
  payoutCode: string;
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  partnerPhone: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  bankBranch?: string;
  bankReference?: string;
  rejectionReason?: string;
  createdAt: string;
}

export default function AdminPayoutsPage() {
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Selected payout for processing
  const [selectedPayout, setSelectedPayout] = useState<PayoutRow | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'MARK_AS_PAID' | null>(null);
  const [bankReference, setBankReference] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payouts');
      const data = await res.json();
      if (data.success && data.payouts) {
        setPayouts(data.payouts);
      }
    } catch (e) {
      console.error('Error fetching admin payouts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  const handleProcessPayout = async () => {
    if (!selectedPayout || !actionType) return;
    setActionLoading(true);

    try {
      const body: any = { action: actionType };
      if (actionType === 'MARK_AS_PAID') {
        if (!bankReference.trim()) {
          alert('Vui lòng nhập Mã tham chiếu ngân hàng');
          setActionLoading(false);
          return;
        }
        body.bankReference = bankReference.trim();
      } else if (actionType === 'REJECT') {
        if (!rejectReason.trim()) {
          alert('Vui lòng nhập lý do từ chối để đối tác nắm thông tin');
          setActionLoading(false);
          return;
        }
        body.rejectionReason = rejectReason.trim();
      }

      const res = await fetch(`/api/admin/payouts/${selectedPayout.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Thao tác không thành công');
      }

      alert('Đã xử lý lệnh rút tiền thành công!');
      setSelectedPayout(null);
      setActionType(null);
      setBankReference('');
      setRejectReason('');
      fetchPayouts();
    } catch (e: any) {
      alert(e.message || 'Lỗi xử lý rút tiền');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPayouts = payouts.filter((p) => {
    if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin" className="text-xs text-slate-500 hover:text-emerald-700 flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Bảng điều khiển Admin
              </Link>
            </div>
            <h1 className="text-2xl sm:text-2xl text-slate-900 flex items-center gap-2.5">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Wallet className="w-5 h-5" />
              </span>
              Duyệt Chi Trả Hoa Hồng (Payouts)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kế toán đối soát và giải ngân tiền hoa hồng cho đối tác CTV & Đại lý
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/partners"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm transition-all"
            >
              Xem Danh Sách Đối Tác →
            </Link>
            <button
              onClick={fetchPayouts}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
              title="Tải lại"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap gap-3 items-center justify-between">
          <span className="text-sm text-slate-700">Lọc theo trạng thái thanh toán:</span>
          <div className="flex flex-wrap gap-2 text-xs">
            {['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  filterStatus === st
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'ALL'
                  ? 'Tất cả'
                  : st === 'PENDING'
                  ? 'Chờ duyệt'
                  : st === 'APPROVED'
                  ? 'Đã duyệt (Chờ CK)'
                  : st === 'PAID'
                  ? 'Đã chuyển khoản'
                  : 'Đã từ chối'}
              </button>
            ))}
          </div>
        </div>

        {/* Payouts Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">Đang tải danh sách yêu cầu rút tiền...</div>
          ) : filteredPayouts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">Không có yêu cầu rút tiền nào trong danh sách.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/70 text-[1.125em]">
                    <th className="py-3 px-4">Mã Yêu Cầu</th>
                    <th className="py-3 px-4">Ngày Tạo</th>
                    <th className="py-3 px-4">Đối Tác</th>
                    <th className="py-3 px-4 text-right">Số Tiền Rút</th>
                    <th className="py-3 px-4">Tài Khoản Thụ Hưởng</th>
                    <th className="py-3 px-4">Trạng Thái</th>
                    <th className="py-3 px-4">Mã Ngân Hàng</th>
                    <th className="py-3 px-4 text-right">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayouts.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-emerald-800 text-[1.125em]">{po.payoutCode || po.id.slice(0, 8)}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(po.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-900 block text-[1.125em]">{po.partnerName}</span>
                        <span className="font-mono text-slate-500 text-[11px]">{po.partnerCode} • {po.partnerPhone}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-900 text-base">
                        {Number(po.amount).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div><strong className="text-slate-900 text-[1.125em]">{po.bankName}</strong>: <span className="font-mono">{po.bankAccountNumber}</span></div>
                        <div className="text-[11px] uppercase text-slate-500">{po.bankAccountName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[12px] ${
                            po.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : po.status === 'APPROVED'
                              ? 'bg-blue-100 text-blue-800'
                              : po.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800 animate-pulse'
                          }`}
                        >
                          {po.status === 'PENDING'
                            ? 'Chờ duyệt'
                            : po.status === 'APPROVED'
                            ? 'Đã duyệt'
                            : po.status === 'PAID'
                            ? 'Đã thanh toán'
                            : 'Từ chối'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{po.bankReference || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        {po.status === 'PENDING' && (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedPayout(po);
                                setActionType('APPROVE');
                              }}
                              className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-sm hover:bg-blue-100"
                            >
                              Duyệt
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPayout(po);
                                setActionType('REJECT');
                              }}
                              className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 text-sm hover:bg-rose-100"
                            >
                              Từ chối
                            </button>
                          </div>
                        )}
                        {po.status === 'APPROVED' && (
                          <button
                            onClick={() => {
                              setSelectedPayout(po);
                              setActionType('MARK_AS_PAID');
                            }}
                            className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                          >
                            Xác Nhận Đã CK
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL XỬ LÝ LỆNH RÚT TIỀN */}
        {selectedPayout && actionType && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <h3 className="text-lg text-slate-900">
                  {actionType === 'APPROVE'
                    ? 'Phê Duyệt Lệnh Rút Tiền'
                    : actionType === 'MARK_AS_PAID'
                    ? 'Xác Nhận Đã Chuyển Khoản'
                    : 'Từ Chối Lệnh Rút Tiền'}
                </h3>
                <button
                  onClick={() => {
                    setSelectedPayout(null);
                    setActionType(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                <div>Đối tác: <strong className="text-[1.125em]">{selectedPayout.partnerName}</strong> ({selectedPayout.partnerCode})</div>
                <div>Số tiền: <strong className="text-emerald-800 text-base">{Number(selectedPayout.amount).toLocaleString('vi-VN')} đ</strong></div>
                <div>Ngân hàng: <strong className="text-[1.125em]">{selectedPayout.bankName}</strong> - {selectedPayout.bankAccountNumber}</div>
                <div>Chủ tài khoản: <strong className="uppercase text-[1.125em]">{selectedPayout.bankAccountName}</strong></div>
              </div>

              {actionType === 'MARK_AS_PAID' && (
                <div>
                  <label className="block text-sm text-slate-700 mb-1">
                    Mã giao dịch / Mã tham chiếu ngân hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: FT24098712398"
                    value={bankReference}
                    onChange={(e) => setBankReference(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Dùng để đối soát với sao kê ngân hàng doanh nghiệp</p>
                </div>
              )}

              {actionType === 'REJECT' && (
                <div>
                  <label className="block text-sm text-slate-700 mb-1">
                    Lý do từ chối (Tiền sẽ tự động hoàn về ví đối tác) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="VD: Sai thông tin số tài khoản hoặc tên chủ tài khoản không khớp..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-rose-600"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPayout(null);
                    setActionType(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleProcessPayout}
                  className={`px-5 py-2 rounded-xl text-white text-sm shadow-md transition-all ${
                    actionType === 'REJECT'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {actionLoading ? 'Đang xử lý...' : 'Xác Nhận Thực Hiện'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
