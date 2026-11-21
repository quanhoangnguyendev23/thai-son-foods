import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Hàng sao dưới tên sản phẩm trên thẻ (21/11/2026). Chưa có đánh giá: 5 sao xám. Không hiện số lượt đánh giá "(n)" (21/11/2026).
 * Điểm làm tròn tới nửa sao; sao nửa vẽ bằng lớp phủ cắt 50%.
 */
export default function RatingStars({ average, count, className }: { average: number; count: number; className?: string }) {
  const rounded = Math.round(average * 2) / 2;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-text-muted', className)}>
      <span className="flex items-center gap-px" aria-hidden>
        {[1, 2, 3, 4, 5].map((s) => {
          const full = s <= rounded;
          const half = !full && s - 0.5 === rounded;
          return (
            <span key={s} className="relative inline-flex w-3.5 h-3.5">
              <Star className="absolute inset-0 w-3.5 h-3.5 fill-gray-200 text-gray-200" />
              {(full || half) && (
                <span className={cn('absolute inset-y-0 left-0 overflow-hidden', half ? 'w-1/2' : 'w-full')}>
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                </span>
              )}
            </span>
          );
        })}
      </span>
      {count > 0 && <span className="text-text-dark">{average.toFixed(1)}</span>}
      <span className="sr-only">{count > 0 ? `${average.toFixed(1)} trên 5 sao, ${count} đánh giá` : 'Chưa có đánh giá'}</span>
    </span>
  );
}
