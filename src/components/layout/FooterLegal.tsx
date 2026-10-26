'use client';

import Link from 'next/link';
import Image from 'next/image';
import { LEGAL_INFO, LEGAL_LINK_LABELS } from '@/config/legal';

/**
 * Phần pháp lý dùng chung cho Footer và FooterAmazon. Dữ liệu ở src/config/legal.ts; ô nào trống thì không hiển thị.
 */

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

/** true nếu có ít nhất 1 link chính sách đã điền (dùng để ẩn tiêu đề "Hỗ trợ" khi chưa có link nào) */
export const HAS_LEGAL_LINKS = LEGAL_LINK_LABELS.some(({ key }) => LEGAL_INFO.links[key].trim());

/** Các link chính sách đã điền (dạng <li>), đặt trong cột "Hỗ trợ" */
export function LegalPolicyLinks({ isEn, className }: { isEn: boolean; className: string }) {
  const items = LEGAL_LINK_LABELS.filter(({ key }) => LEGAL_INFO.links[key].trim());
  return (
    <>
      {items.map(({ key, vi, en }) => {
        const href = LEGAL_INFO.links[key].trim();
        const label = isEn ? en : vi;
        return (
          <li key={key}>
            {isExternal(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                {label}
              </a>
            ) : (
              <Link href={href} className={className}>
                {label}
              </Link>
            )}
          </li>
        );
      })}
    </>
  );
}

/** Khối thông tin doanh nghiệp + logo "Đã thông báo Bộ Công Thương". Không có ô nào được điền → không render gì */
export function LegalCompanyBlock({ isEn, className = '' }: { isEn: boolean; className?: string }) {
  const { companyName, taxId, taxIdIssuedDate, taxIdIssuedPlace, address, hotline, email } = LEGAL_INFO;
  const bct = LEGAL_INFO.links.boCongThuong.trim();
  const issued = [taxIdIssuedDate && `${isEn ? 'issued on' : 'cấp ngày'} ${taxIdIssuedDate}`, taxIdIssuedPlace && `${isEn ? 'by' : 'tại'} ${taxIdIssuedPlace}`]
    .filter(Boolean)
    .join(' ');
  const lines = [
    companyName,
    taxId && `${isEn ? 'Business registration / Tax ID' : 'MST / GCN ĐKDN'}: ${taxId}${issued ? ` (${issued})` : ''}`,
    address && `${isEn ? 'Head office' : 'Trụ sở'}: ${address}`,
    [hotline && `Hotline: ${hotline}`, email && `Email: ${email}`].filter(Boolean).join(' · '),
  ].filter(Boolean);

  if (!lines.length && !bct) return null;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-4 text-[13px] text-white/80 leading-relaxed ${className}`}>
      {lines.length > 0 && (
        <div className="min-w-0 flex-1 space-y-0.5 break-words">
          {lines.map((line, i) => (
            <p key={i} className={i === 0 && companyName ? 'text-white text-[14px]' : undefined}>
              {line}
            </p>
          ))}
        </div>
      )}
      {bct && (
        <a
          href={bct}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={isEn ? 'Registered with the Ministry of Industry and Trade' : 'Đã thông báo Bộ Công Thương'}
          className="shrink-0 self-start sm:self-center"
        >
          <Image src="/images/banners/bo-cong-thuong.png" alt="Đã thông báo Bộ Công Thương" width={150} height={57} className="h-auto w-[130px] sm:w-[150px]" />
        </a>
      )}
    </div>
  );
}
