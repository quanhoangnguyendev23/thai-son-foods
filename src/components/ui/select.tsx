'use client';

/**
 * Select kiểu shadcn/ui (Radix Select), tông tối của trang admin.
 * Nội dung xổ xuống render qua portal ra <body>, nên đặt z-index cao hơn khung admin (z-[999]).
 */

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        'flex h-9 items-center justify-between gap-2 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-950/40 px-3 text-xs text-slate-100 cursor-pointer',
        'hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 data-[placeholder]:text-slate-300',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 text-slate-300" aria-hidden />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({ className, children, position = 'popper', ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={6}
        className={cn(
          'z-[1000] min-w-[8rem] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-1 text-slate-100 shadow-xl shadow-forest-950/40',
          position === 'popper' && 'w-[var(--radix-select-trigger-width)]',
          className
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-lg py-1.5 pl-2.5 pr-8 text-xs outline-none',
        'data-[highlighted]:bg-slate-800 data-[state=checked]:text-amber-200 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-3.5 w-3.5" aria-hidden />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}
