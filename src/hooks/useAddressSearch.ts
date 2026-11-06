'use client';

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import type React from 'react';
import {
  createAddressSearchController,
  createAutocompleteFetcher,
  type AddressSearchController,
  type AddressSearchState,
  type FetchRequest,
  type FetchResult,
  type SelectedPlace,
} from '@/lib/address/searchController';
import type { LatLng } from '@/lib/address/types';

export interface UseAddressSearchOptions {
  /** Mặc định gọi `/api/geo/autocomplete`. Test có thể truyền bản giả. */
  fetchSuggestions?: (req: FetchRequest) => Promise<FetchResult>;
  getBias?: () => LatLng | null;
  getContext?: () => { ward?: string; district?: string } | undefined;
  /** Khách chọn một gợi ý (chỉ gọi khi khách bấm chọn hoặc Enter sau khi dùng phím mũi tên) */
  onSelect?: (selected: SelectedPlace) => void;
  /** Mỗi lần khách gõ (để trang giữ `form.address` đồng bộ) */
  onTextChange?: (text: string) => void;
  debounceMs?: number;
}

/**
 * Hook mỏng bọc `createAddressSearchController` cho ô địa chỉ: UI chỉ việc hiển thị `state`
 * và gắn `inputProps` vào ô nhập (đã có role combobox + aria cho trình đọc màn hình).
 */
export function useAddressSearch(options: UseAddressSearchOptions = {}) {
  const fallbackFetch = useMemo(() => createAutocompleteFetcher(), []);

  const [controller] = useState<AddressSearchController>(() =>
    createAddressSearchController({
      fetchSuggestions: options.fetchSuggestions ?? fallbackFetch,
      getBias: () => options.getBias?.() ?? null,
      getContext: () => options.getContext?.(),
      onSelect: (s) => options.onSelect?.(s),
      debounceMs: options.debounceMs,
    })
  );

  // Sau mỗi lần render, bộ điều khiển dùng các hàm gọi lại mới nhất của trang (không cần ref)
  useEffect(() => {
    controller.updateOptions({
      fetchSuggestions: options.fetchSuggestions ?? fallbackFetch,
      getBias: () => options.getBias?.() ?? null,
      getContext: () => options.getContext?.(),
      onSelect: (s) => options.onSelect?.(s),
    });
  });

  // Rời trang: hủy câu hỏi đang bay. Không dispose, vì StrictMode (dev) chạy cleanup rồi chạy lại effect.
  useEffect(() => () => controller.cancel(), [controller]);

  const state: AddressSearchState = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  const baseId = useId();
  const listboxId = `${baseId}-suggestions`;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const panelOpen = state.open && (state.suggestions.length > 0 || state.status === 'empty' || state.status === 'error');

  const inputProps = {
    role: 'combobox' as const,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': panelOpen,
    'aria-controls': listboxId,
    'aria-activedescendant': state.activeIndex >= 0 ? optionId(state.activeIndex) : undefined,
    autoComplete: 'off',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      options.onTextChange?.(e.target.value);
      controller.setText(e.target.value);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      const result = controller.handleKey({
        key: e.key,
        isComposing: e.nativeEvent.isComposing,
        keyCode: e.keyCode,
      });
      if (result.preventDefault) e.preventDefault();
    },
    onFocus: () => controller.setFocused(true),
    onBlur: () => controller.setFocused(false),
    onCompositionStart: () => controller.setComposing(true),
    onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement>) => {
      controller.setComposing(false);
      const value = e.currentTarget.value;
      if (value !== controller.getState().inputText) {
        options.onTextChange?.(value);
        controller.setText(value);
      }
    },
  };

  return { controller, state, panelOpen, inputProps, listboxId, optionId };
}
