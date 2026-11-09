'use client';

import React from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeForMatch } from '@/lib/address/normalize';
import type { SearchStatus } from '@/lib/address/searchController';
import type { AddressSuggestion } from '@/lib/address/types';

interface AddressSuggestionListProps {
  /** id của listbox (khớp `aria-controls` ở ô nhập) */
  id: string;
  optionId: (index: number) => string;
  suggestions: AddressSuggestion[];
  activeIndex: number;
  status: SearchStatus;
  /** Nhà cung cấp đang chậm nên danh sách có thể thiếu */
  degraded: boolean;
  /** Khu khách gõ nằm ngoài vùng giao: hiện thông báo, không hiện điểm ở khu khác */
  outOfZone?: boolean;
  /** Chữ khách đang gõ, để tô sáng phần khớp */
  query: string;
  language: 'vi' | 'en';
  onPick: (index: number) => void;
  /** Khách bấm "Chọn trên bản đồ" khi không có gợi ý phù hợp */
  onPickMap: () => void;
  /** Thông tin phụ bên phải mỗi dòng (ví dụ cửa hàng gần nhất) */
  renderMeta?: (suggestion: AddressSuggestion) => React.ReactNode;
}

function highlight(text: string, query: string): React.ReactNode {
  const tokens = new Set(
    normalizeForMatch(query)
      .split(' ')
      .filter((t) => t.length >= 2 || /\d/.test(t))
  );
  if (!tokens.size) return text;
  return text.split(/(\s+)/).map((part, i) => {
    const n = normalizeForMatch(part);
    return n && tokens.has(n) ? (
      <span key={i} className="bg-amber-100 rounded-xs">
        {part}
      </span>
    ) : (
      part
    );
  });
}

/**
 * Khung gợi ý địa chỉ: chỉ hiển thị. Chọn bằng mousedown + preventDefault để ô nhập không mất focus
 * trước khi lựa chọn được ghi nhận. Mỗi dòng 2 hàng: số nhà + đường, rồi "P. Hạnh Thông (Gò Vấp cũ), TP.HCM".
 */
export default function AddressSuggestionList({
  id,
  optionId,
  suggestions,
  activeIndex,
  status,
  degraded,
  outOfZone = false,
  query,
  language,
  onPick,
  onPickMap,
  renderMeta,
}: AddressSuggestionListProps) {
  const en = language === 'en';
  const hasList = suggestions.length > 0;

  return (
    <div
      // mousedown trong khung (kể cả thanh cuộn) không làm ô nhập mất focus: tránh khung đóng trước khi chọn xong
      onMouseDown={(e) => e.preventDefault()}
      className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden"
    >
      {(hasList || status === 'loading') && (
        <div className="px-3.5 py-2 bg-emerald-50/80 flex items-center justify-between gap-2 text-xs text-emerald-950 border-b border-emerald-100">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            {en
              ? 'Pick your address to auto-fill ward, district and map pin'
              : 'Chọn đúng địa chỉ để tự điền Phường, Quận và ghim bản đồ'}
          </span>
          {status === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />}
        </div>
      )}

      {hasList && (
        <ul id={id} role="listbox" className="max-h-64 overflow-y-auto divide-y divide-gray-50">
          {suggestions.map((s, i) => (
            <li
              key={s.place_id}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(i)}
              className={cn(
                'px-3.5 py-2.5 flex items-start gap-2.5 cursor-pointer transition-colors',
                i === activeIndex ? 'bg-emerald-50' : 'hover:bg-emerald-50/70'
              )}
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-100/90 flex items-center justify-center shrink-0 mt-0.5 text-emerald-700">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{highlight(s.main_text, query)}</p>
                <p className="text-xs text-gray-600 truncate leading-snug">{s.secondary_text}</p>
                {s.label && <p className="text-2xs text-gray-500 truncate leading-snug">{s.label}</p>}
                {s.nameMatch === 'similar' && (
                  <p className="text-2xs text-amber-800 leading-snug">{en ? 'Similar name' : 'Tên gần giống'}</p>
                )}
                {s.precision === 'area' && (
                  <p className="text-2xs text-amber-800 leading-snug">
                    {en
                      ? 'Approximate spot: please adjust the pin after choosing'
                      : 'Vị trí gần đúng: chọn xong hãy chấm lại ghim cho đúng nhà'}
                  </p>
                )}
              </div>
              {renderMeta?.(s)}
            </li>
          ))}
        </ul>
      )}

      {!hasList && status === 'empty' && outOfZone && (
        <div className="px-3.5 py-3 text-xs text-amber-900 leading-snug">
          {en
            ? 'This area is outside our delivery area. Please check the address, or pick your location on the map.'
            : 'Khu vực này nằm ngoài vùng giao hàng. Bạn kiểm tra lại địa chỉ, hoặc chọn vị trí trên bản đồ.'}
        </div>
      )}
      {!hasList && status === 'empty' && !outOfZone && (
        <div className="px-3.5 py-3 text-xs text-gray-700 leading-snug">
          {en
            ? 'No matching address found. Pick it on the map, or just type it in and add floor / alley / landmark in the note.'
            : 'Chưa thấy địa chỉ khớp. Bạn có thể chọn trên bản đồ, hoặc cứ nhập tay rồi ghi chú thêm tầng, hẻm, mốc gần nhà.'}
        </div>
      )}
      {!hasList && status === 'error' && (
        <div className="px-3.5 py-3 text-xs text-gray-700 leading-snug">
          {en
            ? 'Address suggestions are slow right now. You can still type your address or pick it on the map.'
            : 'Gợi ý địa chỉ đang chậm. Bạn vẫn có thể nhập tay hoặc chọn trên bản đồ.'}
        </div>
      )}
      {hasList && degraded && (
        <div className="px-3.5 py-2 text-2xs text-gray-500 border-t border-gray-50">
          {en
            ? 'The map service is slow, so this list may be incomplete.'
            : 'Dịch vụ bản đồ đang chậm nên danh sách có thể chưa đầy đủ.'}
        </div>
      )}

      {/* Ghi nguồn dữ liệu bản đồ (điều khoản OpenStreetMap / Photon) */}
      <p className="px-3.5 py-1.5 text-2xs text-gray-500 border-t border-gray-50">
        ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
          OpenStreetMap contributors
        </a>
      </p>

      {(status === 'empty' || status === 'error' || (hasList && degraded)) && (
        <div className="px-3.5 pb-3 pt-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onPickMap}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs rounded-lg transition-colors cursor-pointer"
          >
            <MapPin className="w-3 h-3" />
            <span>{en ? 'Pick on map' : 'Chọn trên bản đồ'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
