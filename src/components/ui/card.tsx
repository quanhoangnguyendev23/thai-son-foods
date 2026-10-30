import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Card kiểu shadcn/ui, đã đổi sang tông tối của trang admin (bo góc + viền như các card Tổng quan).
 * Chỉ dùng class token màu của dự án (brand-tokens.css).
 */

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card" className={cn('flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 text-slate-100', className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('px-5 pt-5 sm:px-6 sm:pt-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-title" className={cn('text-base font-semibold leading-tight text-white sm:text-lg', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-description" className={cn('text-xs text-slate-300', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-5 pb-5 pt-4 sm:px-6 sm:pb-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex px-5 pb-5 sm:px-6 sm:pb-6', className)} {...props} />;
}
