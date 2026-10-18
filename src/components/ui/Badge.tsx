import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'hot' | 'new' | 'bestseller' | 'sale';
  className?: string;
}

export default function Badge({ children, variant = 'hot', className }: BadgeProps) {
  const variants = {
    hot: 'bg-sale text-white',
    new: 'bg-corn text-text-dark',
    bestseller: 'bg-green-primary text-white',
    sale: 'bg-sale text-white',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 text-sm tracking-wide rounded-lg uppercase',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
