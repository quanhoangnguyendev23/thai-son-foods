'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  RefreshCw,
  Star,
  Truck,
  X,
  Phone,
  Calendar,
  Send,
  Lock,
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { useUserAuth } from '@/context/UserAuthContext';
import { MEMBERSHIP_CONFIG } from '@/config/membership';

// Ảnh chuẩn fallback
const UNIFIED_PRODUCT_IMAGE = '/images/products/1200x900-sb1.jpg';

interface SubscribeItem {
  id: string;
  nameVi: string;
  nameEn: string;
  unitVi: string;
  unitEn: string;
  retailPrice: number;
  discountRate: number; // 15%
  rating: number;
  reviewCount: number;
  badgeText: string;
  image?: string;
}

// ── HÀNG 1: 12 SẢN PHẨM NẤU MỚI NGUYÊN BẢN ──────────────────────────
export const SUBSCRIBE_PRODUCTS: SubscribeItem[] = [
  {
    id: 'sub-sb-01',
    nameVi: 'Sữa Bắp Nếp Tươi Thái Sơn (Lốc 7 chai 330ml)',
    nameEn: 'Thai Son Fresh Sticky Corn Milk (Pack of 7)',
    unitVi: 'Lốc 7 chai',
    unitEn: 'Pack of 7',
    retailPrice: 126000,
    discountRate: 15,
    rating: 5.0,
    reviewCount: 932,
    badgeText: '5% | 15%',
    image: '/images/products/1200x900-sb1.jpg',
  },
  {
    id: 'sub-shs-01',
    nameVi: 'Sữa Hạt Sen Mekong Xanh (Lốc 7 chai 330ml)',
    nameEn: 'Mekong Green Lotus Seed Milk (Pack of 7)',
    unitVi: 'Lốc 7 chai',
    unitEn: 'Pack of 7',
    retailPrice: 126000,
    discountRate: 15,
    rating: 4.9,
    reviewCount: 680,
    badgeText: '5% | 15%',
    image: '/images/products/1200x900-shs1.jpg',
  },
  {
    id: 'sub-sgl-01',
    nameVi: 'Sữa Gạo Lứt Huyết Rồng (Lốc 7 chai 330ml)',
    nameEn: 'Mekong Nutritious Brown Rice Milk (Pack of 7)',
    unitVi: 'Lốc 7 chai',
    unitEn: 'Pack of 7',
    retailPrice: 126000,
    discountRate: 15,
    rating: 4.9,
    reviewCount: 524,
    badgeText: '5% | 15%',
    image: '/images/products/1200x900-sgl1.jpg',
  },
  {
    id: 'sub-ss-01',
    nameVi: 'Sữa Hạt Sen Lotus Yoo (Lốc 5 chai 568ml)',
    nameEn: 'Lotus Yoo Fresh Lotus Seed Milk (Pack of 5)',
    unitVi: 'Lốc 5 chai',
    unitEn: 'Pack of 5',
    retailPrice: 125000,
    discountRate: 15,
    rating: 4.9,
    reviewCount: 418,
    badgeText: '5% | 15%',
    image: '/images/products/1200x900-ss1.jpg',
  },
  {
    id: 'sub-sl-01',
    nameVi: 'Sữa Gạo Lứt Ohsawa Yoo (Lốc 5 chai 568ml)',
    nameEn: 'Ohsawa Yoo Whole Brown Rice Milk (Pack of 5)',
    unitVi: 'Lốc 5 chai',
    unitEn: 'Pack of 5',
    retailPrice: 125000,
    discountRate: 15,
    rating: 4.8,
    reviewCount: 395,
    badgeText: '5% | 15%',
    image: '/images/products/1200x900-sl1.jpg',
  },
  {
    id: 'sub-md-01',
    nameVi: 'Nha Đam Mủ Trôm Tự Nhiên (Lốc 7 chai 330ml)',
    nameEn: 'Aloe Vera & Karaya Gum Drink (Pack of 7)',
    unitVi: 'Lốc 7 chai',
    unitEn: 'Pack of 7',
    retailPrice: 126000,
    discountRate: 15,
    rating: 5.0,
    reviewCount: 612,
    badgeText: '5% | 15%',
    image: '/images/products/1200x900-md1.jpg',
  },
  {
    id: 'sub-td-01',
    nameVi: 'Nước Táo Đỏ Hạt Chia (Lốc 7 chai 330ml)',
    nameEn: 'Red Apple & Chia Seed Drink (Pack of 7)',
    unitVi: 'Lốc 7 chai',
    unitEn: 'Pack of 7',
    retailPrice: 126000,
    discountRate: 15,
    rating: 4.9,
    reviewCount: 476,
    badgeText: '5% | 15%',
    image: '/images/products/1200x900-td1.jpg',
  },
  {
    id: 'sub-lh-01',
    nameVi: 'Sâm La Hán Quả Hoa Cúc (Lốc 7 chai 330ml)',
    nameEn: 'Monk Fruit & Chrysanthemum Herbal (Pack of 7)',
    unitVi: 'Lốc 7 chai',
    unitEn: 'Pack of 7',
    retailPrice: 126000,
    discountRate: 15,
    rating: 4.8,
    reviewCount: 382,
    badgeText: '5% | 15%',
    image: '/images/products/1200x900-lh1.jpg',
  },
  {
    id: 'sub-tsa-01',
    nameVi: 'Trà Sữa Ciao Trân Châu (Lốc 7 chai 330ml)',
    nameEn: 'Ciao Milk Tea with Topping (Pack of 7)',
    unitVi: 'Lốc 7 chai',
    unitEn: 'Pack of 7',
    retailPrice: 140000,
    discountRate: 15,
    rating: 4.9,
    reviewCount: 520,
    badgeText: '-15%',
    image: '/images/products/1200x900-tsa1.jpg',
  },
  {
    id: 'sub-mac-01',
    nameVi: 'Matcha Trà Sữa Ciao (Lốc 7 chai 330ml)',
    nameEn: 'Ciao Japanese Matcha Milk Tea (Pack of 7)',
    unitVi: 'Lốc 7 chai',
    unitEn: 'Pack of 7',
    retailPrice: 140000,
    discountRate: 15,
    rating: 4.9,
    reviewCount: 430,
    badgeText: '-15%',
    image: '/images/products/1200x900-mac1.jpg',
  },
  {
    id: 'sub-tsg-01',
    nameVi: 'Trà Sữa GO Vị Đậm Đà (Lốc 7 chai 330ml)',
    nameEn: 'GO Milk Tea Authentic Flavor (Pack of 7)',
    unitVi: 'Lốc 7 chai',
    unitEn: 'Pack of 7',
    retailPrice: 126000,
    discountRate: 15,
    rating: 4.8,
    reviewCount: 345,
    badgeText: '5% | 15%',
    image: '/images/products/1200x900-tsg1.jpg',
  },
  {
    id: 'sub-txg-01',
    nameVi: 'Trà Xanh GO Thạch Giòn (Lốc 7 chai 330ml)',
    nameEn: 'GO Refreshing Green Tea (Pack of 7)',
    unitVi: 'Lốc 7 chai',
    unitEn: 'Pack of 7',
    retailPrice: 126000,
    discountRate: 15,
    rating: 4.8,
    reviewCount: 310,
    badgeText: '5% | 15%',
    image: '/images/products/1200x900-txg1.jpg',
  },
];

// ── HÀNG 2: 12 GÓI COMBO TIẾT KIỆM ĐA VỊ ────────────────────────────
export const SUBSCRIBE_COMBOS: SubscribeItem[] = [
  {
    id: 'sub-combo-01',
    nameVi: 'Combo Khám Phá Đa Vị (10 chai)',
    nameEn: 'Diverse Discovery Combo (10 bottles)',
    unitVi: 'Combo 10 chai',
    unitEn: 'Combo of 10',
    retailPrice: 180000,
    discountRate: 15,
    rating: 5.0,
    reviewCount: 840,
    badgeText: '10% | 15%',
    image: '/images/combos/combo-1.jpg',
  },
  {
    id: 'sub-combo-02',
    nameVi: 'Combo Siêu Hời Gia Đình (17 chai)',
    nameEn: 'Smart Family Stockup Combo (17 bottles)',
    unitVi: 'Thùng 17 chai',
    unitEn: 'Box of 17',
    retailPrice: 306000,
    discountRate: 15,
    rating: 5.0,
    reviewCount: 1120,
    badgeText: '10% | 15%',
    image: '/images/combos/combo-2.jpg',
  },
  {
    id: 'sub-combo-03',
    nameVi: 'Combo Tiết Kiệm Bậc Thang (20 chai)',
    nameEn: 'Tier Pricing Savings Combo (20 bottles)',
    unitVi: 'Thùng 20 chai',
    unitEn: 'Carton of 20',
    retailPrice: 360000,
    discountRate: 15,
    rating: 4.9,
    reviewCount: 670,
    badgeText: '10% | 15%',
    image: '/images/combos/combo-3.jpg',
  },
  {
    id: 'sub-combo-04',
    nameVi: 'Combo Dáng Xinh Sức Khỏe (10 chai)',
    nameEn: 'Slim & Golden Health Combo (10 bottles)',
    unitVi: 'Combo 10 chai',
    unitEn: 'Combo of 10',
    retailPrice: 180000,
    discountRate: 15,
    rating: 4.9,
    reviewCount: 520,
    badgeText: '5% | 15%',
    image: '/images/combos/combo-4.jpg',
  },
  {
    id: 'sub-combo-05',
    nameVi: 'Combo Bữa Sáng Năng Lượng Hạt (10 chai)',
    nameEn: 'Energy Nut Breakfast Combo (10 bottles)',
    unitVi: 'Combo 10 chai',
    unitEn: 'Combo of 10',
    retailPrice: 180000,
    discountRate: 15,
    rating: 5.0,
    reviewCount: 910,
    badgeText: '5% | 15%',
    image: '/images/combos/combo-5.jpg',
  },
  {
    id: 'sub-combo-06',
    nameVi: 'Combo Giải Nhiệt Mát Lành (10 chai)',
    nameEn: 'Instant Refreshment Combo (10 bottles)',
    unitVi: 'Combo 10 chai',
    unitEn: 'Combo of 10',
    retailPrice: 180000,
    discountRate: 15,
    rating: 4.9,
    reviewCount: 785,
    badgeText: '5% | 15%',
    image: '/images/combos/combo-6.jpg',
  },
  {
    id: 'sub-combo-07',
    nameVi: 'Combo Trọn Vị Gia Đình (12 chai)',
    nameEn: 'Family Full Flavor Combo (12 bottles)',
    unitVi: 'Thùng 12 chai',
    unitEn: 'Box of 12',
    retailPrice: 216000,
    discountRate: 15,
    rating: 5.0,
    reviewCount: 1045,
    badgeText: '10% | 15%',
    image: '/images/combos/combo-7.jpg',
  },
  {
    id: 'sub-combo-08',
    nameVi: 'Combo Thả Ga Giảm Căng Thẳng (10 chai)',
    nameEn: 'Worry-Free Enjoyment Combo (10 bottles)',
    unitVi: 'Combo 10 chai',
    unitEn: 'Combo of 10',
    retailPrice: 208000,
    discountRate: 15,
    rating: 4.8,
    reviewCount: 460,
    badgeText: '5% | 15%',
    image: '/images/combos/combo-8.jpg',
  },
  {
    id: 'sub-combo-09',
    nameVi: 'Combo Văn Phòng Tỉnh Táo (12 chai)',
    nameEn: 'Alert Office Energy Combo (12 bottles)',
    unitVi: 'Thùng 12 chai',
    unitEn: 'Carton of 12',
    retailPrice: 224000,
    discountRate: 15,
    rating: 4.9,
    reviewCount: 630,
    badgeText: '10% | 15%',
    image: '/images/combos/combo-9.jpg',
  },
  {
    id: 'sub-combo-10',
    nameVi: 'Combo Quốc Dân Bán Chạy (10 chai)',
    nameEn: 'National Best-Seller Combo (10 bottles)',
    unitVi: 'Combo 10 chai',
    unitEn: 'Combo of 10',
    retailPrice: 180000,
    discountRate: 15,
    rating: 5.0,
    reviewCount: 1250,
    badgeText: '5% | 15%',
    image: '/images/combos/combo-10.jpg',
  },
  {
    id: 'sub-combo-11',
    nameVi: 'Combo Giải Nhiệt Xu Hướng (10 chai)',
    nameEn: 'Modern Trendy Cooling Combo (10 bottles)',
    unitVi: 'Combo 10 chai',
    unitEn: 'Combo of 10',
    retailPrice: 184000,
    discountRate: 15,
    rating: 4.9,
    reviewCount: 540,
    badgeText: '10% | 15%',
    image: '/images/combos/combo-11.jpg',
  },
  {
    id: 'sub-combo-12',
    nameVi: 'Combo Trải Nghiệm Toàn Diện (12 chai)',
    nameEn: 'Comprehensive Experience Combo (12 bottles)',
    unitVi: 'Thùng 12 chai',
    unitEn: 'Box of 12',
    retailPrice: 216000,
    discountRate: 15,
    rating: 5.0,
    reviewCount: 890,
    badgeText: '10% | 15%',
    image: '/images/combos/combo-12.jpg',
  },
];

export const SUBSCRIBE_ITEMS: SubscribeItem[] = [
  ...SUBSCRIBE_PRODUCTS,
  ...SUBSCRIBE_COMBOS,
];

const FREQUENCY_OPTIONS = [
  { value: 'weekly', labelVi: 'Mỗi tuần', labelEn: 'Weekly' },
  { value: 'biweekly', labelVi: '2 tuần/lần', labelEn: '2 weeks' },
  { value: 'monthly', labelVi: 'Mỗi tháng', labelEn: 'Monthly' },
];

interface SubscribeSaveSectionProps {
  title?: string;
  subtitle?: string;
  className?: string;
  badgeText?: string;
}

export default function SubscribeSaveSection({
  title,
  subtitle,
  className = '',
  badgeText,
}: SubscribeSaveSectionProps) {
  const { language } = useLanguage();

  // Lưu tần suất giao hàng theo từng item trong số 24 sản phẩm và combo
  const [selectedFreq, setSelectedFreq] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    SUBSCRIBE_ITEMS.forEach((it) => {
      initial[it.id] = 'weekly';
    });
    return initial;
  });

  const { user, refreshUser } = useUserAuth();

  // Modal demo & Checkout State
  const [activeModalItem, setActiveModalItem] = useState<{
    item: SubscribeItem;
    freqLabel: string;
    freqKey: string;
    subPrice: number;
  } | null>(null);

  // Form states cho OTP và Đăng ký
  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [fullNameInput, setFullNameInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'vietqr' | 'cod'>('vietqr');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSub, setCreatedSub] = useState<any>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Đồng bộ thông tin khi đã có user
  useEffect(() => {
    if (user) {
      if (user.fullName) setFullNameInput(user.fullName);
      if (user.phone) setPhoneInput(user.phone);
      if (user.address) setAddressInput(user.address);
    }
  }, [user]);

  // Cờ tính năng Subscribe & Save: Mặc định tắt, chỉ render khi bật flag
  if (!MEMBERSHIP_CONFIG.ENABLE_SUBSCRIBE_SAVE) {
    return null;
  }

  const handleSubscribeClick = (item: SubscribeItem) => {
    const freqKey = selectedFreq[item.id] || 'weekly';
    const opt = FREQUENCY_OPTIONS.find((o) => o.value === freqKey);
    const freqLabel = language === 'en' ? opt?.labelEn || 'Weekly' : opt?.labelVi || 'Mỗi tuần';
    const subPrice = Math.round(item.retailPrice * (1 - item.discountRate / 100));

    setCreatedSub(null);
    setFormError(null);
    setOtpSent(false);
    setOtpMessage(null);

    setActiveModalItem({
      item,
      freqLabel,
      freqKey,
      subPrice,
    });
  };

  const handleSendOtp = async () => {
    if (!phoneInput) {
      setFormError('Vui lòng nhập số điện thoại');
      return;
    }
    try {
      setIsSubmitting(true);
      setFormError(null);
      const res = await fetch('/api/membership/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput }),
      });
      const json = await res.json();
      if (json.success) {
        setOtpSent(true);
        setOtpMessage('Mã OTP (123456) đã được gửi qua Zalo ZNS / SMS!');
      } else {
        setFormError(json.error || 'Lỗi gửi mã OTP');
      }
    } catch {
      setFormError('Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpInput) {
      setFormError('Vui lòng nhập mã OTP');
      return;
    }
    try {
      setIsSubmitting(true);
      setFormError(null);
      const res = await fetch('/api/membership/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput, otpCode: otpInput, fullName: fullNameInput }),
      });
      const json = await res.json();
      if (json.success) {
        await refreshUser();
        setOtpSent(false);
        setOtpMessage(null);
      } else {
        setFormError(json.error || 'Mã OTP không hợp lệ');
      }
    } catch {
      setFormError('Lỗi xác thực');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSubscription = async () => {
    if (!activeModalItem) return;
    if (!addressInput.trim()) {
      setFormError('Vui lòng nhập địa chỉ nhận hàng (Ví dụ: 123 Nguyễn Thị Thập, P. Tân Phú, Q.7).');
      return;
    }
    try {
      setIsSubmitting(true);
      setFormError(null);
      const freqCode =
        activeModalItem.freqKey === 'biweekly'
          ? '2_WEEKS'
          : activeModalItem.freqKey === 'monthly'
          ? '4_WEEKS'
          : '1_WEEK';

      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: fullNameInput || user?.fullName || 'Khách hàng',
          recipientPhone: phoneInput || user?.phone || '0901234567',
          shippingAddress: addressInput,
          deliveryFrequency: freqCode,
          preferredDayOfWeek: 2,
          paymentMethod,
          distanceKm: 5.0,
          items: [
            {
              productId: activeModalItem.item.id,
              name: activeModalItem.item.nameVi,
              unit: activeModalItem.item.unitVi,
              retailPrice: activeModalItem.item.retailPrice,
              quantity: 1,
            },
          ],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCreatedSub(json.data);
      } else {
        setFormError(json.error || 'Lỗi tạo hợp đồng');
      }
    } catch {
      setFormError('Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Chuẩn hóa tiêu đề & phụ đề
  const displayTitle = title
    ? title.replace(/8 Sản Phẩm( & Combo)?/gi, '12 Sản Phẩm & 12 Combo')
    : language === 'en'
    ? 'Subscribe & Save — 12 Products & 12 Value Combos'
    : 'Đăng Ký Giao Định Kỳ — 12 Sản Phẩm & 12 Combo Tiết Kiệm';

  const displaySubtitle = subtitle
    ? subtitle.replace(/8 sản phẩm( & combo)?/gi, '12 sản phẩm & 12 combo')
    : language === 'en'
    ? 'Never run out of wholesome fresh beverages. Automatic scheduled delivery to your door. Free shipping on every order, cancel or skip anytime.'
    : 'Thức uống tươi ngon nấu mới mỗi ngày với 12 sản phẩm & 12 combo tuyển chọn. Miễn phí vận chuyển 100%, linh hoạt đổi vị và tạm dừng bất kỳ lúc nào.';

  const renderCard = (item: SubscribeItem) => {
    const subPrice = Math.round(item.retailPrice * (1 - item.discountRate / 100));
    const savingAmount = item.retailPrice - subPrice;
    const currentFreq = selectedFreq[item.id] || 'weekly';

    return (
      <div
        key={item.id}
        className="bg-white rounded-lg border border-gray-200/90 shadow-2xs hover:shadow-md hover:border-amber-400 transition-all duration-200 p-1.5 sm:p-2 flex flex-col justify-between group h-full"
      >
        <div>
          {/* Huy hiệu chiết khấu cố định 15% theo đặc tả nghiệp vụ */}
          <div className="flex items-center justify-between gap-0.5 mb-1">
            <span className="px-1 py-0.5 bg-orange-600 text-white text-[9px] sm:text-[10px] rounded leading-none shrink-0">
              -15%
            </span>
            <span className="text-[9px] sm:text-[10px] text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 leading-none shrink-0 truncate">
              Freeship
            </span>
          </div>

          {/* Ảnh sản phẩm / combo — Tỷ lệ chuẩn 4:3 khớp chính xác với kích thước ảnh gốc 1200x900, hiển thị toàn diện không cắt xén */}
          <div className="relative w-full aspect-[4/3] bg-ivory rounded-md overflow-hidden mb-1 flex items-center justify-center">
            <Image
              src={item.image || UNIFIED_PRODUCT_IMAGE}
              alt={language === 'en' ? item.nameEn : item.nameVi}
              fill
              sizes="(max-width: 1024px) 150px, 120px"
              className="object-contain w-full h-full transition-transform duration-300"
            />
          </div>

          {/* Tên sản phẩm / combo */}
          <h4
            title={language === 'en' ? item.nameEn : item.nameVi}
            className="text-[11px] sm:text-[12px] text-gray-900 line-clamp-2 min-h-[26px] sm:min-h-[28px] leading-tight"
          >
            {language === 'en' ? item.nameEn : item.nameVi}
          </h4>

          {/* Đánh giá sao */}
          <div className="flex items-center gap-0.5 mt-0.5 text-gray-500">
            <div className="flex items-center text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-[8px] sm:text-[9px] text-gray-400">({item.reviewCount})</span>
          </div>
        </div>

        <div>
          {/* Khung Giá bán */}
          <div className="mt-1 pt-1 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1">
              <span className="text-[12px] sm:text-sm text-crimson-600 whitespace-nowrap">
                {formatPrice(subPrice)} ₫
              </span>
              <span className="text-[8px] sm:text-[9px] text-gray-400 line-through whitespace-nowrap">
                {formatPrice(item.retailPrice)} ₫
              </span>
            </div>
            <div className="text-[9px] sm:text-[10px] text-emerald-700 truncate">
              {language === 'en'
                ? `-${item.discountRate}%`
                : `Giảm ${formatPrice(savingAmount)} ₫`}
            </div>
          </div>

          {/* Dropdown chọn tần suất giao hàng */}
          <div className="mt-1">
            <label className="block text-[9px] sm:text-[10px] text-gray-500 mb-0.5 truncate">
              {language === 'en' ? 'Deliver:' : 'Chu kỳ:'}
            </label>
            <select
              value={currentFreq}
              onChange={(e) =>
                setSelectedFreq((prev) => ({
                  ...prev,
                  [item.id]: e.target.value,
                }))
              }
              className="w-full text-[8px] sm:text-[9px] font-medium text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer transition-colors"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {language === 'en' ? opt.labelEn : opt.labelVi}
                </option>
              ))}
            </select>
          </div>

          {/* Nút màu vàng đặc trưng của Amazon: "Subscribe now" */}
          <button
            onClick={() => handleSubscribeClick(item)}
            type="button"
            className="w-full mt-1.5 py-1.5 px-1 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-gray-900 text-[10px] sm:text-[11px] rounded border border-amber-700 shadow-2xs flex items-center justify-center gap-0.5 transition-all cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-2.5 h-2.5 text-gray-800 shrink-0" />
            <span>{language === 'en' ? 'Subscribe' : 'Đăng ký ngay'}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className={`py-5 sm:py-8 bg-linear-to-b from-white via-amber-50/20 to-white relative overflow-hidden border-t border-b border-amber-100/60 w-full ${className}`}>
      {/* Container tràn viền full 2 cánh trái phải */}
      <div className="w-full px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6">
        {/* Header Section phong cách Amazon Subscribe & Save */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] sm:text-sm uppercase tracking-wider mb-1">
            <span>{badgeText || 'Subscribe & Save • Tiết kiệm 15%'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-2xl text-gray-900 tracking-tight font-heading">
            {displayTitle}
          </h2>
          <p className="text-[11px] sm:text-xs text-gray-600 mt-0.5 max-w-4xl">
            {displaySubtitle}
          </p>
        </div>

        {/* ── HÀNG 1: 12 SẢN PHẨM NẤU MỚI (Show toàn diện 12 mã trên 1 hàng) ── */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <h3 className="text-sm sm:text-base uppercase tracking-wider text-gray-800 font-heading">
              {language === 'en' ? '12 Fresh Nut Milk & Herbal Products' : '12 Sản Phẩm Sữa Hạt & Giải Khát Nấu Mới'}
            </h3>
            <span className="text-[10px] sm:text-[11px] text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full">
              {language === 'en' ? 'Save 15%' : 'Tiết kiệm 15%'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1 sm:gap-1.5 xl:gap-2">
            {SUBSCRIBE_PRODUCTS.map((item) => renderCard(item))}
          </div>
        </div>

        {/* ── HÀNG 2: 12 COMBO TIẾT KIỆM (Show toàn diện 12 mã trên 1 hàng) ── */}
        <div>
          <div className="flex items-center gap-2 mb-2 pt-2.5 border-t border-amber-100/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm sm:text-base uppercase tracking-wider text-gray-800 font-heading">
              {language === 'en' ? '12 Family & Office Value Combos' : '12 Combo Tiết Kiệm Gia Đình & Văn Phòng'}
            </h3>
            <span className="text-[10px] sm:text-[11px] text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
              {language === 'en' ? 'Freeship 100%' : 'Freeship 100%'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1 sm:gap-1.5 xl:gap-2">
            {SUBSCRIBE_COMBOS.map((item) => renderCard(item))}
          </div>
        </div>
      </div>

      {/* ── MODAL FULLSTACK ĐĂNG KÝ HỢP ĐỒNG ĐỊNH KỲ ── */}
      {activeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-amber-200 relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setActiveModalItem(null)}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* MÀN HÌNH HOÀN TẤT THÀNH CÔNG */}
            {createdSub ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl text-gray-900 font-heading">
                  Đăng Ký Thành Công!
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                  Hợp đồng định kỳ <span className="text-emerald-800 text-[1.125em]">#{createdSub.subscriptionCode}</span> đã được kích hoạt.
                </p>

                <div className="my-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-left text-xs text-emerald-950 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Kỳ giao đầu tiên:</span>
                    <span className="text-[1.125em]">
                      {new Date(createdSub.nextDeliveryDate).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Chu kỳ:</span>
                    <span className="text-[1.125em]">{activeModalItem.freqLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Địa chỉ giao:</span>
                    <span className="line-clamp-1 text-[1.125em]">{createdSub.shippingAddress}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Link
                    href="/tai-khoan/dinh-ky"
                    onClick={() => setActiveModalItem(null)}
                    className="block w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-base shadow transition"
                  >
                    Xem & Quản Lý Lịch Giao Tại Trang Cá Nhân
                  </Link>
                  <button
                    onClick={() => setActiveModalItem(null)}
                    className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 transition"
                  >
                    Đóng cửa sổ
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-2 text-amber-700">
                    <RefreshCw className="w-6 h-6 text-amber-600" />
                  </div>
                  <h3 className="text-2xl text-gray-900 font-heading">
                    Ký Hợp Đồng Giao Định Kỳ
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Tiết kiệm 15% trọn đời và miễn phí 100% phí giao hàng lạnh tận nhà
                  </p>
                </div>

                {/* Tóm tắt mặt hàng & giá */}
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2 text-xs text-gray-700 mb-5">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Sản phẩm:</span>
                    <span className="text-gray-900 text-right line-clamp-1 max-w-[220px] text-[1.125em]">
                      {activeModalItem.item.nameVi}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Chu kỳ:</span>
                    <span className="text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md text-[1.125em]">
                      {activeModalItem.freqLabel}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Giá mỗi kỳ (-15%):</span>
                    <span className="text-base text-emerald-900">
                      {formatPrice(activeModalItem.subPrice)} ₫
                    </span>
                  </div>
                </div>

                {/* Thông báo lỗi nếu có */}
                {formError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                    {formError}
                  </div>
                )}

                {/* BƯỚC XÁC THỰC SĐT NẾU CHƯA ĐĂNG NHẬP */}
                {!user ? (
                  <div className="space-y-3.5 p-4 rounded-2xl bg-gray-50 border border-gray-200 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-800">
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                      Xác thực số điện thoại để đăng ký hợp đồng
                    </div>

                    {!otpSent ? (
                      <div className="space-y-2">
                        <label className="text-xs text-gray-600 block">Số điện thoại của bạn:</label>
                        <div className="flex gap-2">
                          <input
                            type="tel"
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            placeholder="VD: 0123456789"
                            className="flex-1 p-2.5 rounded-xl border border-gray-300 text-base"
                          />
                          <button
                            disabled={isSubmitting}
                            onClick={handleSendOtp}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm shrink-0 transition"
                          >
                            {isSubmitting ? 'Đang gửi...' : 'Gửi mã OTP'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {otpMessage && (
                          <div className="text-xs text-emerald-700 bg-emerald-100 p-2 rounded-lg">
                            {otpMessage}
                          </div>
                        )}
                        <label className="text-xs text-gray-600 block">Nhập mã OTP 6 số (Mã test: 123456):</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={otpInput}
                            onChange={(e) => setOtpInput(e.target.value)}
                            placeholder="Nhập 123456"
                            className="flex-1 p-2.5 rounded-xl border border-gray-300 text-base font-mono tracking-widest text-center"
                          />
                          <button
                            disabled={isSubmitting}
                            onClick={handleVerifyOtp}
                            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm shrink-0 transition"
                          >
                            {isSubmitting ? 'Đang duyệt...' : 'Xác thực'}
                          </button>
                        </div>
                        <button
                          onClick={() => setOtpSent(false)}
                          className="text-xs text-gray-500 hover:text-emerald-700 underline"
                        >
                          Đổi số điện thoại khác
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* BƯỚC NHẬP ĐỊA CHỈ & PHƯƠNG THỨC THANH TOÁN (KHI ĐÃ ĐĂNG NHẬP) */
                  <div className="space-y-3 mb-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-sm text-gray-700 block mb-1">Họ và tên:</label>
                        <input
                          type="text"
                          value={fullNameInput}
                          onChange={(e) => setFullNameInput(e.target.value)}
                          placeholder="Họ tên người nhận"
                          className="w-full p-2.5 rounded-xl border border-gray-300 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-700 block mb-1">Số điện thoại:</label>
                        <input
                          type="tel"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          placeholder="Số điện thoại nhận sữa"
                          className="w-full p-2.5 rounded-xl border border-gray-300 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-gray-700 block mb-1">
                        Địa chỉ nhận hàng:
                      </label>
                      <input
                        type="text"
                        value={addressInput}
                        onChange={(e) => setAddressInput(e.target.value)}
                        placeholder="Số nhà, tên đường, Phường, Quận (TP.HCM)"
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-700 block mb-1">Phương thức thanh toán:</label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label
                          className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                            paymentMethod === 'vietqr' ? 'border-emerald-600 bg-emerald-50 text-emerald-950' : 'border-gray-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="pay_method"
                            checked={paymentMethod === 'vietqr'}
                            onChange={() => setPaymentMethod('vietqr')}
                            className="text-emerald-600"
                          />
                          <span>VietQR từng kỳ</span>
                        </label>

                        <label
                          className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                            paymentMethod === 'cod' ? 'border-emerald-600 bg-emerald-50 text-emerald-950' : 'border-gray-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="pay_method"
                            checked={paymentMethod === 'cod'}
                            onChange={() => setPaymentMethod('cod')}
                            className="text-emerald-600"
                          />
                          <span>Trả tiền khi nhận (COD)</span>
                        </label>
                      </div>
                    </div>

                    <button
                      disabled={isSubmitting}
                      onClick={handleCreateSubscription}
                      className="w-full mt-4 py-3 rounded-xl bg-forest-700 hover:bg-forest-800 text-white text-base shadow-md transition cursor-pointer"
                    >
                      {isSubmitting ? 'Đang tạo hợp đồng...' : 'Xác Nhận Ký Hợp Đồng Giao Định Kỳ'}
                    </button>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-gray-500">
                  <span>Bỏ qua kỳ hoặc hủy hợp đồng dễ dàng trong 1 chạm tại trang cá nhân.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
