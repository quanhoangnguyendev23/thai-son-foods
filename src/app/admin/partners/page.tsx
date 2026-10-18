'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Building2,
  RefreshCw,
  Eye,
  ArrowLeft,
  ChevronRight,
  MoreVertical,
  Check,
  X,
  CreditCard,
  Phone,
  Mail,
  UserCheck
} from 'lucide-react';

interface PartnerRow {
  id: string;
  partnerCode: string;
  partnerType: 'CTV' | 'DEALER';
  lifecycleStatus: string;
  fullName: string;
  phone: string;
  email?: string;
  idCardNumber?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  tierId?: string;
  tierName?: string;
  discountRate?: number;
  totalOrders?: number;
  totalRevenue?: number;
  createdAt: string;
}

export default function AdminPartnersPage() {
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected partner modal
  const [selectedPartner, setSelectedPartner] = useState<PartnerRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/partners');
      const data = await res.json();
      if (data.success && data.partners) {
        setPartners(data.partners);
      }
    } catch (e) {
      console.error('Error fetching admin partners:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handlePartnerAction = async (partnerId: string, action: string, extraData: any = {}) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extraData }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Thao tác thất bại');
        return;
      }

      alert('Cập nhật trạng thái đối tác thành công!');
      setSelectedPartner(null);
      fetchPartners();
    } catch (e: any) {
      alert(e.message || 'Lỗi xử lý');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPartners = partners.filter((p) => {
    if (filterStatus !== 'ALL' && p.lifecycleStatus !== filterStatus) return false;
    if (filterType !== 'ALL' && p.partnerType !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.fullName || '').toLowerCase().includes(q);
      const matchPhone = (p.phone || '').includes(q);
      const matchCode = (p.partnerCode || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchCode) return false;
    }
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
                <Users className="w-5 h-5" />
              </span>
              Quản Lý Đối Tác (CTV & Đại Lý)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Phê duyệt hồ sơ đối tác, nâng cấp đại lý và quản lý mạng lưới phân phối TSF
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/payouts"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm transition-all"
            >
              Xem Duyệt Rút Tiền →
            </Link>
            <button
              onClick={fetchPartners}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
              title="Tải lại"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap gap-3 items-center justify-between">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Tìm theo Tên, SĐT hoặc Mã CTV..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="ALL">Tất cả loại đối tác</option>
              <option value="CTV">Cộng tác viên (CTV)</option>
              <option value="DEALER">Đại lý chính thức</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="LITE">LITE (Đăng ký nhanh)</option>
              <option value="SUBMITTED">SUBMITTED (Đã nộp KYC)</option>
              <option value="APPROVED">APPROVED (Đã duyệt)</option>
              <option value="ACTIVE">ACTIVE (Đang hoạt động)</option>
              <option value="SUSPENDED">SUSPENDED (Tạm khóa)</option>
            </select>
          </div>
        </div>

        {/* Partners Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">Đang tải danh sách đối tác...</div>
          ) : filteredPartners.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">Không tìm thấy đối tác nào phù hợp.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/70 text-[1.125em]">
                    <th className="py-3 px-4">Mã Đối Tác</th>
                    <th className="py-3 px-4">Họ và Tên</th>
                    <th className="py-3 px-4">Số Điện Thoại</th>
                    <th className="py-3 px-4">Loại & Cấp Bậc</th>
                    <th className="py-3 px-4">Trạng Thái</th>
                    <th className="py-3 px-4">Thông Tin Ngân Hàng</th>
                    <th className="py-3 px-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPartners.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-emerald-800 text-[1.125em]">{p.partnerCode}</td>
                      <td className="py-3 px-4 text-slate-900 text-[1.125em]">{p.fullName}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{p.phone}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[12px] ${
                            p.partnerType === 'DEALER'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {p.partnerType === 'DEALER' ? `ĐẠI LÝ (${p.tierName || 'TIER 1'})` : 'CTV'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[12px] ${
                            p.lifecycleStatus === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : p.lifecycleStatus === 'SUBMITTED'
                              ? 'bg-blue-50 text-blue-700 animate-pulse'
                              : p.lifecycleStatus === 'SUSPENDED'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.lifecycleStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {p.bankAccountNumber ? (
                          <div>
                            <span className="text-slate-800 text-[1.125em]">{p.bankName}:</span>{' '}
                            <span className="font-mono">{p.bankAccountNumber}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa liên kết</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedPartner(p)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-sm transition-all"
                        >
                          Chi Tiết & Duyệt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL CHI TIẾT & DUYỆT ĐỐI TÁC */}
        {selectedPartner && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg text-slate-900">Chi Tiết Hồ Sơ Đối Tác</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {selectedPartner.id}</p>
                </div>
                <button
                  onClick={() => setSelectedPartner(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                  <div>
                    <span className="text-slate-500 block">Họ và tên:</span>
                    <strong className="text-slate-900 text-base">{selectedPartner.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Mã đối tác:</span>
                    <strong className="text-emerald-800 text-base font-mono">{selectedPartner.partnerCode}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Số điện thoại:</span>
                    <strong className="text-slate-800 font-mono text-[1.125em]">{selectedPartner.phone}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Trạng thái:</span>
                    <strong className="text-slate-800 text-[1.125em]">{selectedPartner.lifecycleStatus}</strong>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                  <span className="text-slate-800 block text-[1.125em]">Hồ Sơ Định Danh & Ngân Hàng:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>Số CCCD: <strong className="font-mono text-[1.125em]">{selectedPartner.idCardNumber || 'Chưa có'}</strong></div>
                    <div>Ngân hàng: <strong className="text-[1.125em]">{selectedPartner.bankName || 'Chưa có'}</strong></div>
                    <div>Số tài khoản: <strong className="font-mono text-[1.125em]">{selectedPartner.bankAccountNumber || 'Chưa có'}</strong></div>
                    <div>Chủ tài khoản: <strong className="uppercase text-[1.125em]">{selectedPartner.bankAccountName || 'Chưa có'}</strong></div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <span className="text-sm text-slate-700 block">Thao Tác Quản Trị:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedPartner.lifecycleStatus !== 'ACTIVE' && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handlePartnerAction(selectedPartner.id, 'APPROVE')}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                    >
                      Duyệt & Kích Hoạt
                    </button>
                  )}

                  {selectedPartner.partnerType === 'CTV' && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handlePartnerAction(selectedPartner.id, 'UPGRADE_DEALER', { tierId: 'tier_dealer_1' })}
                      className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm"
                    >
                      Nâng Cấp Đại Lý
                    </button>
                  )}

                  {selectedPartner.lifecycleStatus !== 'SUSPENDED' && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handlePartnerAction(selectedPartner.id, 'SUSPEND', { reason: 'Tạm khóa theo quy định' })}
                      className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm"
                    >
                      Tạm Khóa (Suspend)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
