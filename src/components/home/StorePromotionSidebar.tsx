'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  Flame, 
  Zap, 
  Heart, 
  Snowflake, 
  Gift 
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function StorePromotionSidebar() {
  const { language } = useLanguage();

  const promoBadges = [
    {
      id: 'combo-uu-dai',
      tagVi: 'SIÊU HỜI',
      tagEn: 'SUPER DEAL',
      titleVi: 'Combo Siêu Hời',
      titleEn: 'Super Deal Combo',
      subVi: 'Tích trữ thông minh, 17 chai',
      subEn: 'Smart family stockup, 17 btls',
      icon: Sparkles,
      iconColor: 'text-amber-200',
      tagColor: 'text-amber-100',
      bgGradient: 'from-amber-500 to-amber-600',
      borderColor: 'border-amber-300/40',
      href: '/combo/combo-uu-dai',
      animClass: 'animate-tsf-float-1',
      animDelay: '0s',
    },
    {
      id: 'combo-sieu-hoi',
      tagVi: 'BẬC THANG',
      tagEn: 'TIER SALE',
      titleVi: 'Combo Bậc Thang',
      titleEn: 'Tier Pricing Combo',
      subVi: 'Mua nhiều giảm sâu từ 12.000đ',
      subEn: 'Deep discount from 12,000đ',
      icon: Flame,
      iconColor: 'text-amber-300',
      tagColor: 'text-red-200',
      bgGradient: 'from-red-600 to-rose-700',
      borderColor: 'border-red-300/40',
      href: '/combo/combo-sieu-hoi',
      animClass: 'animate-tsf-float-2',
      animDelay: '0.4s',
    },
    {
      id: 'combo-5',
      tagVi: 'NĂNG LƯỢNG',
      tagEn: 'ENERGY',
      titleVi: 'Bữa Sáng Năng Lượng',
      titleEn: 'Nut Energy Breakfast',
      subVi: '10 chai sữa hạt nguyên chất',
      subEn: '10 pure nut milk bottles',
      icon: Zap,
      iconColor: 'text-yellow-200',
      tagColor: 'text-yellow-100',
      bgGradient: 'from-yellow-600 to-amber-700',
      borderColor: 'border-yellow-300/40',
      href: '/combo/combo-5',
      animClass: 'animate-tsf-float-1',
      animDelay: '0.8s',
    },
    {
      id: 'combo-4',
      tagVi: 'DÁNG XINH',
      tagEn: 'HEALTHY',
      titleVi: 'Dáng Xinh Sức Khỏe',
      titleEn: 'Slim & Golden Health',
      subVi: 'Thức uống 10 ngày giữ dáng',
      subEn: '10-day shape-keeping drink',
      icon: Heart,
      iconColor: 'text-emerald-200',
      tagColor: 'text-emerald-100',
      bgGradient: 'from-emerald-600 to-teal-700',
      borderColor: 'border-emerald-300/40',
      href: '/combo/combo-4',
      animClass: 'animate-tsf-float-2',
      animDelay: '1.2s',
    },
    {
      id: 'combo-6',
      tagVi: 'THANH NHIỆT',
      tagEn: 'COOLING',
      titleVi: 'Giải Nhiệt Ngày Nóng',
      titleEn: 'Hot Day Cooling',
      subVi: 'Thanh mát tức thì, 10 chai',
      subEn: 'Instant cooling, 10 bottles',
      icon: Snowflake,
      iconColor: 'text-cyan-200',
      tagColor: 'text-cyan-100',
      bgGradient: 'from-cyan-600 to-blue-700',
      borderColor: 'border-cyan-300/40',
      href: '/combo/combo-6',
      animClass: 'animate-tsf-float-1',
      animDelay: '1.6s',
    },
    {
      id: 'combo-7',
      tagVi: 'TRỌN VỊ',
      tagEn: 'FAMILY BOX',
      titleVi: 'Combo Trọn Vị Gia Đình',
      titleEn: 'Family Bonding Combo',
      subVi: 'Đa dạng 12 chai hỗn hợp',
      subEn: 'Diverse 12 mixed bottles',
      icon: Gift,
      iconColor: 'text-leaf-200',
      tagColor: 'text-leaf-100',
      bgGradient: 'from-leaf-600 to-leaf-700',
      borderColor: 'border-leaf-300/40',
      href: '/combo/combo-7',
      animClass: 'animate-tsf-float-2',
      animDelay: '2.0s',
    },
  ];

  return (
    <aside
      aria-label={language === 'en' ? 'Store Promotions & Deals' : 'Khuyến mãi & Deal Sốc Cửa Hàng'}
      className="w-full select-none"
    >
      {/* SCOPED ANIMATIONS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes tsfFloat1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(1deg); }
        }
        @keyframes tsfFloat2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(5px) rotate(-1deg); }
        }
        .animate-tsf-float-1 {
          animation: tsfFloat1 4.5s ease-in-out infinite;
        }
        .animate-tsf-float-2 {
          animation: tsfFloat2 5.2s ease-in-out infinite;
        }
      `}} />

      {/* 6 HUY HIỆU COMBO BAY BAY (FLOATING PROMO BADGES) */}
      <div className="grid grid-cols-2 gap-2 pt-1 pb-2 px-0.5">
        {promoBadges.map((badge) => {
          const Icon = badge.icon;
          return (
            <Link
              key={badge.id}
              href={badge.href}
              style={{ animationDelay: badge.animDelay }}
              className={`${badge.animClass} group relative overflow-hidden rounded-xl bg-gradient-to-br ${badge.bgGradient} p-2 text-white shadow-md border ${badge.borderColor} transition-transform`}
            >
              <div className="flex items-center gap-1">
                <Icon className={`w-3 h-3 ${badge.iconColor} shrink-0`} />
                <span className={`text-[12px] lg:text-[11px] uppercase tracking-wider ${badge.tagColor}`}>
                  {language === 'en' ? badge.tagEn : badge.tagVi}
                </span>
              </div>
              <p className="text-[13px] leading-tight mt-0.5 text-white">
                {language === 'en' ? badge.titleEn : badge.titleVi}
              </p>
              <p className="text-[11px] lg:text-[9.5px] text-white/85 mt-0.5 font-medium leading-tight">
                {language === 'en' ? badge.subEn : badge.subVi}
              </p>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
