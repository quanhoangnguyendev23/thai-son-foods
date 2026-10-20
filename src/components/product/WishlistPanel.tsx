'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Trash2 } from 'lucide-react';
import { products } from '@/data/products';
import { combos } from '@/data/combos';
import { formatPrice } from '@/lib/utils';
import { getProductImage, MISSING_PRODUCT_IMAGE } from '@/lib/product-detail';
import { useLanguage } from '@/context/LanguageContext';

interface WishItem {
  itemType: 'product' | 'combo';
  itemId: string;
}

interface Resolved {
  key: string;
  itemType: 'product' | 'combo';
  itemId: string;
  href: string;
  name: string;
  image: string;
  price: number;
}

function resolve(item: WishItem): Resolved | null {
  if (item.itemType === 'product') {
    const p = products.find((x) => x.id === item.itemId || x.slug === item.itemId);
    if (!p || p.isActive === false) return null;
    const v = p.variants?.[0];
    return {
      key: `product:${item.itemId}`,
      itemType: 'product',
      itemId: item.itemId,
      href: `/san-pham/${p.slug}`,
      name: p.name.split(' - ')[0].split(',')[0].trim(),
      image: getProductImage(p) || MISSING_PRODUCT_IMAGE,
      price: v ? v.price : p.price,
    };
  }
  const c = combos.find((x) => x.id === item.itemId || x.slug === item.itemId);
  if (!c || c.isActive === false) return null;
  return {
    key: `combo:${item.itemId}`,
    itemType: 'combo',
    itemId: item.itemId,
    href: `/combo/${c.slug}`,
    name: c.name.split(',')[0].trim(),
    image: c.image || MISSING_PRODUCT_IMAGE,
    price: c.salePrice,
  };
}

/** Tab "Yêu thích" trong trang tài khoản — danh sách lưu theo tài khoản */
export default function WishlistPanel() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [items, setItems] = useState<Resolved[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/user/wishlist')
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (!data.success) {
          setError(data.error || (isEn ? 'Could not load your wishlist' : 'Không thể tải danh sách yêu thích'));
          setItems([]);
          return;
        }
        const resolved = (data.items as WishItem[])
          .map(resolve)
          .filter((x): x is Resolved => Boolean(x));
        setItems(resolved);
      })
      .catch(() => {
        if (active) {
          setError(isEn ? 'Connection error' : 'Lỗi kết nối, vui lòng thử lại');
          setItems([]);
        }
      });
    return () => {
      active = false;
    };
  }, [isEn]);

  const remove = async (it: Resolved) => {
    const before = items;
    setItems((cur) => (cur ? cur.filter((x) => x.key !== it.key) : cur));
    try {
      const res = await fetch(`/api/user/wishlist?itemType=${it.itemType}&itemId=${encodeURIComponent(it.itemId)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error('failed');
    } catch {
      setItems(before);
      setError(isEn ? 'Could not remove this item' : 'Không thể bỏ mục này khỏi yêu thích');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xs">
      <div className="flex items-center gap-2 mb-1">
        <Heart className="w-5 h-5 text-sale" aria-hidden />
        <h2 className="text-xl md:text-2xl text-gray-900 font-heading">{isEn ? 'My wishlist' : 'Danh sách yêu thích'}</h2>
      </div>
      <p className="text-xs text-gray-500 mb-5">
        {isEn ? 'Products and combos you saved.' : 'Các sản phẩm và combo bạn đã lưu.'}
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {items === null ? (
        <p className="text-sm text-gray-500">{isEn ? 'Loading…' : 'Đang tải…'}</p>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-600">
          {isEn ? 'Nothing saved yet. ' : 'Bạn chưa lưu mục nào. '}
          <Link href="/#san-pham" className="text-forest-700 hover:underline">
            {isEn ? 'Browse products' : 'Xem sản phẩm'}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((it) => (
            <li key={it.key} className="flex items-center gap-3 py-3">
              <Link href={it.href} className="relative w-16 h-16 rounded-lg overflow-hidden bg-ivory border border-gray-100 shrink-0">
                <Image src={it.image} alt={it.name} fill sizes="64px" className="object-contain p-1" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={it.href} className="text-sm text-ink-950 hover:text-forest-700 line-clamp-2">
                  {it.name}
                </Link>
                <p className="text-sm text-forest-700 mt-0.5">{formatPrice(it.price)}đ</p>
              </div>
              <button
                type="button"
                onClick={() => remove(it)}
                aria-label={isEn ? `Remove ${it.name}` : `Bỏ ${it.name} khỏi yêu thích`}
                className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
