/**
 * Bộ điều khiển ô nhập địa chỉ (không phụ thuộc React, test được bằng timer giả và nhà cung cấp giả).
 *
 * Nguyên tắc vàng: KHÔNG BAO GIỜ thay chữ khách đã gõ hoặc đã chọn khi khách không thao tác rõ ràng.
 * Vì vậy bộ điều khiển chỉ đổi `inputText` trong 3 trường hợp: khách gõ (`setText`), khách chọn một gợi ý
 * (`select`), hoặc trang chủ động ghi (`commitText`, dùng khi khách bấm Lấy GPS hoặc xác nhận ghim).
 * Rời ô (blur) chỉ đóng danh sách, không bao giờ chọn gì. Enter chỉ chọn khi khách đã dùng phím mũi tên.
 *
 * Chống giật: mỗi câu hỏi có AbortController + số thứ tự; phản hồi cũ hoặc không khớp chữ hiện tại bị bỏ;
 * danh sách cũ được giữ trong lúc tải; không có effect nào tự gọi lại khi ô chọn hay tọa độ thay đổi.
 */

import { hasSearchableText, MAX_SUGGESTIONS, parseAddressInput, rankSuggestions } from './suggest';
import { splitHouseAndStreet, streetKeyOf } from './normalize';
import type { AddressSuggestion, LatLng } from './types';

export type SearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

/** Quan hệ giữa chữ đang có trong ô và địa chỉ đã chốt (chọn gợi ý / ghim / GPS). */
export type AnchorRelation = 'none' | 'matched' | 'stale';

export interface SelectedPlace {
  suggestion: AddressSuggestion;
  /** Dòng đã điền vào ô khi chọn (giữ số nhà khách gõ) */
  text: string;
  /** Thứ hạng (từ 0) của gợi ý trong danh sách lúc chọn và tổng số gợi ý, để đo chất lượng xếp hạng (log ẩn danh) */
  rank?: number;
  total?: number;
  /** Chuỗi khách đã gõ ngay trước khi chọn (cho log ẩn danh; chỉ gửi đi sau khi bỏ hết chữ số) */
  query?: string;
}

export interface AddressSearchState {
  inputText: string;
  suggestions: AddressSuggestion[];
  /** -1 = chưa có mục nào được tô sáng (không tự tô sáng mục đầu) */
  activeIndex: number;
  /** Khung gợi ý có đang mở không (chỉ mở khi ô đang có focus) */
  open: boolean;
  status: SearchStatus;
  /** Nhà cung cấp đang chậm/lỗi một phần nên gợi ý có thể thiếu */
  degraded: boolean;
  /** Khu khách gõ nằm ngoài vùng giao (server báo): hiện thông báo thay vì gợi ý ở khu khác */
  outOfZone: boolean;
  composing: boolean;
  focused: boolean;
  selected: SelectedPlace | null;
  /** Chữ đã chốt gần nhất (chọn gợi ý, ghim, GPS, địa chỉ đã lưu); chữ trùng đúng chữ này thì không gợi ý nữa */
  anchorText: string | null;
  anchor: AnchorRelation;
}

export interface FetchRequest {
  text: string;
  signal: AbortSignal;
  bias: LatLng | null;
  context?: { ward?: string; district?: string };
}

export interface FetchResult {
  suggestions: AddressSuggestion[];
  degraded?: boolean;
  outOfZone?: boolean;
}

export interface Timers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
}

export interface AddressSearchOptions {
  fetchSuggestions: (req: FetchRequest) => Promise<FetchResult>;
  /** Mặc định 280 ms */
  debounceMs?: number;
  /** Số ký tự tối thiểu (sau khi bỏ khoảng trắng đầu/cuối). Mặc định 2 */
  minChars?: number;
  maxSuggestions?: number;
  /** Vị trí gần khách nếu thực sự biết (GPS đã cho phép, địa chỉ đã lưu). Không có thì trả null, không đoán. */
  getBias?: () => LatLng | null;
  getContext?: () => { ward?: string; district?: string } | undefined;
  onSelect?: (selected: SelectedPlace) => void;
  timers?: Timers;
}

export interface KeyInput {
  key: string;
  isComposing?: boolean;
  keyCode?: number;
}

export interface KeyResult {
  handled: boolean;
  preventDefault: boolean;
}

export interface AddressSearchController {
  getState(): AddressSearchState;
  subscribe(listener: () => void): () => void;
  setText(text: string): void;
  commitText(text: string, kind?: 'pin' | 'gps' | 'saved' | 'manual'): void;
  setComposing(composing: boolean): void;
  setFocused(focused: boolean): void;
  handleKey(input: KeyInput): KeyResult;
  moveActive(delta: number): void;
  select(target: number | AddressSuggestion): SelectedPlace | null;
  close(): void;
  reset(): void;
  /** Cập nhật các hàm gọi lại (fetch, bias, onSelect...) mà không tạo lại bộ điều khiển. */
  updateOptions(next: Partial<AddressSearchOptions>): void;
  /** Hủy hẹn giờ và câu hỏi đang bay (dùng khi rời trang). Bộ điều khiển vẫn dùng lại được. */
  cancel(): void;
  /** Hủy hẳn và bỏ mọi người nghe. Không dùng lại được. */
  dispose(): void;
}

const INITIAL: AddressSearchState = {
  inputText: '',
  suggestions: [],
  activeIndex: -1,
  open: false,
  status: 'idle',
  degraded: false,
  outOfZone: false,
  composing: false,
  focused: false,
  selected: null,
  anchorText: null,
  anchor: 'none',
};

/** Hai dòng địa chỉ cùng một con đường (khác số nhà hay phần phường/quận đuôi vẫn tính là cùng). */
export function sameStreetLine(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const first = (t: string) => t.split(',')[0] || '';
  const ka = streetKeyOf(splitHouseAndStreet(first(a)).street);
  const kb = streetKeyOf(splitHouseAndStreet(first(b)).street);
  return !!ka && ka === kb;
}

export function createAddressSearchController(initialOptions: AddressSearchOptions): AddressSearchController {
  // Các hàm gọi lại (fetch, bias, onSelect...) có thể được trang cập nhật sau mỗi lần render qua updateOptions
  let options: AddressSearchOptions = { ...initialOptions };
  const debounceMs = options.debounceMs ?? 280;
  const minChars = options.minChars ?? 2;
  const maxSuggestions = options.maxSuggestions ?? MAX_SUGGESTIONS;
  const timers: Timers = options.timers ?? {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  };

  let state: AddressSearchState = { ...INITIAL };
  const listeners = new Set<() => void>();
  let timer: unknown = null;
  let abort: AbortController | null = null;
  let seq = 0;
  let disposed = false;

  const emit = () => listeners.forEach((l) => l());
  const set = (patch: Partial<AddressSearchState>) => {
    state = { ...state, ...patch };
    emit();
  };

  const relationFor = (text: string, anchorText: string | null): AnchorRelation => {
    if (anchorText === null) return 'none';
    return text === anchorText || sameStreetLine(text, anchorText) ? 'matched' : 'stale';
  };

  /** Hủy hẹn giờ và câu hỏi đang bay; phản hồi của chúng (nếu về muộn) sẽ bị bỏ vì seq đã đổi. */
  const cancelPending = () => {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
    if (abort) {
      abort.abort();
      abort = null;
    }
    seq++;
  };

  const panelShouldOpen = (focused: boolean) => focused;

  async function run(text: string) {
    if (disposed) return;
    if (abort) abort.abort();
    const mine = new AbortController();
    abort = mine;
    const mySeq = ++seq;
    set({ status: 'loading' });
    const bias = options.getBias?.() ?? null;
    const context = options.getContext?.();
    try {
      const result = await options.fetchSuggestions({ text, signal: mine.signal, bias, context });
      // Phản hồi cũ, hoặc chữ trong ô đã khác, hoặc khách đã chọn xong: bỏ
      if (disposed || mySeq !== seq || state.inputText !== text || mine.signal.aborted) return;
      if (state.anchorText !== null && state.inputText === state.anchorText) return;
      const parsed = parseAddressInput(text);
      const ranked = rankSuggestions(result.suggestions || [], parsed, { bias, context }).slice(0, maxSuggestions);
      set({
        suggestions: ranked,
        status: ranked.length ? 'ready' : 'empty',
        degraded: !!result.degraded,
        outOfZone: !!result.outOfZone && !ranked.length,
        activeIndex: -1,
        open: panelShouldOpen(state.focused),
      });
    } catch (err) {
      if (mine.signal.aborted || (err as { name?: string } | null)?.name === 'AbortError') return;
      if (disposed || mySeq !== seq || state.inputText !== text) return;
      set({ status: 'error', degraded: true, suggestions: [], activeIndex: -1, open: panelShouldOpen(state.focused) });
    } finally {
      if (abort === mine) abort = null;
    }
  }

  const controller: AddressSearchController = {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setText(text) {
      if (disposed || text === state.inputText) return;
      const anchor = relationFor(text, state.anchorText);
      // Chữ trùng đúng chữ đã chốt: không gợi ý nữa
      if (state.anchorText !== null && text === state.anchorText) {
        cancelPending();
        set({ inputText: text, anchor, suggestions: [], open: false, status: 'idle', degraded: false, activeIndex: -1 });
        return;
      }
      if (!hasSearchableText(text) || text.trim().length < minChars) {
        cancelPending();
        set({ inputText: text, anchor, suggestions: [], open: false, status: 'idle', degraded: false, activeIndex: -1 });
        return;
      }
      // Giữ danh sách cũ trong lúc chờ để không nháy; chỉ hẹn lại giờ
      if (timer !== null) timers.clearTimeout(timer);
      if (abort) {
        abort.abort();
        abort = null;
        seq++;
      }
      state = { ...state, inputText: text, anchor, activeIndex: -1 };
      emit();
      timer = timers.setTimeout(() => {
        timer = null;
        void run(text);
      }, debounceMs);
    },

    commitText(text, kind) {
      if (disposed) return;
      cancelPending();
      void kind;
      set({
        inputText: text,
        anchorText: text,
        anchor: 'matched',
        suggestions: [],
        activeIndex: -1,
        open: false,
        status: 'idle',
        degraded: false,
      });
    },

    setComposing(composing) {
      if (state.composing !== composing) set({ composing });
    },

    setFocused(focused) {
      if (state.focused === focused) return;
      // Rời ô chỉ đóng khung, tuyệt đối không chọn gợi ý nào
      if (!focused) set({ focused, open: false, activeIndex: -1 });
      else set({ focused, open: state.suggestions.length > 0 || state.status === 'empty' || state.status === 'error' });
    },

    moveActive(delta) {
      const n = state.suggestions.length;
      if (!n) return;
      let next = state.activeIndex + delta;
      if (state.activeIndex === -1) next = delta > 0 ? 0 : n - 1;
      else if (next < 0) next = n - 1;
      else if (next >= n) next = 0;
      set({ activeIndex: next, open: true });
    },

    handleKey({ key, isComposing, keyCode }) {
      // Bộ gõ tiếng Việt dùng Enter/mũi tên để chốt chữ: không được hiểu là thao tác với gợi ý
      if (isComposing || state.composing || keyCode === 229) return { handled: false, preventDefault: false };
      switch (key) {
        case 'ArrowDown':
          if (!state.suggestions.length) return { handled: false, preventDefault: false };
          controller.moveActive(1);
          return { handled: true, preventDefault: true };
        case 'ArrowUp':
          if (!state.suggestions.length) return { handled: false, preventDefault: false };
          controller.moveActive(-1);
          return { handled: true, preventDefault: true };
        case 'Enter':
          // Chỉ chọn khi khách đã dùng phím mũi tên. Luôn chặn gửi form từ ô địa chỉ (tránh đặt hàng nhầm).
          if (state.open && state.activeIndex >= 0) {
            controller.select(state.activeIndex);
          } else if (state.open) {
            set({ open: false });
          }
          return { handled: true, preventDefault: true };
        case 'Escape':
          if (state.open) {
            set({ open: false, activeIndex: -1 });
            return { handled: true, preventDefault: true };
          }
          return { handled: false, preventDefault: false };
        case 'Tab':
          if (state.open) set({ open: false, activeIndex: -1 });
          return { handled: false, preventDefault: false };
        default:
          return { handled: false, preventDefault: false };
      }
    },

    select(target) {
      if (disposed || state.composing) return null;
      const s = typeof target === 'number' ? state.suggestions[target] : target;
      if (!s) return null;
      cancelPending();
      const text = s.main_text;
      const rank = typeof target === 'number' ? target : state.suggestions.findIndex((x) => x.place_id === s.place_id);
      const selected: SelectedPlace = {
        suggestion: s,
        text,
        rank: rank >= 0 ? rank : undefined,
        total: state.suggestions.length,
        query: state.inputText,
      };
      state = {
        ...state,
        inputText: text,
        anchorText: text,
        anchor: 'matched',
        suggestions: [],
        activeIndex: -1,
        open: false,
        status: 'idle',
        degraded: false,
        selected,
      };
      emit();
      options.onSelect?.(selected);
      return selected;
    },

    close() {
      if (state.open) set({ open: false, activeIndex: -1 });
    },

    reset() {
      cancelPending();
      state = { ...INITIAL, focused: state.focused };
      emit();
    },

    updateOptions(next) {
      options = { ...options, ...next };
    },

    cancel() {
      cancelPending();
      if (state.status === 'loading') state = { ...state, status: state.suggestions.length ? 'ready' : 'idle' };
    },

    dispose() {
      disposed = true;
      cancelPending();
      listeners.clear();
    },
  };

  return controller;
}

/**
 * Phiên ẩn danh cho giới hạn lượt /api/geo/* (middleware): một số ngẫu nhiên, không gắn với tài khoản, hết hạn sau 1 ngày.
 * Mạng di động dùng chung IP nên giới hạn theo phiên công bằng hơn theo IP.
 */
export function ensureGeoSessionCookie(): void {
  if (typeof document === 'undefined') return;
  try {
    if (/(?:^|; )tsf_geo_sid=/.test(document.cookie)) return;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    document.cookie = `tsf_geo_sid=${id.replace(/[^a-zA-Z0-9_-]/g, '')}; Max-Age=86400; Path=/; SameSite=Lax`;
  } catch {
    // cookie bị chặn: middleware vẫn còn trần theo IP
  }
}

/**
 * Hàm gọi API gợi ý của app. `fetchImpl` có thể thay bằng bản giả trong test.
 * Gửi NGUYÊN chuỗi khách gõ; lat/lng chỉ gửi khi thực sự biết vị trí khách.
 */
export function createAutocompleteFetcher(
  endpoint = '/api/geo/autocomplete',
  fetchImpl: typeof fetch = (...args) => fetch(...args)
): (req: FetchRequest) => Promise<FetchResult> {
  return async ({ text, signal, bias, context }) => {
    ensureGeoSessionCookie();
    const params = new URLSearchParams({ input: text });
    if (bias) {
      params.set('lat', bias.lat.toFixed(5));
      params.set('lng', bias.lng.toFixed(5));
    }
    if (context?.ward) params.set('ward', context.ward);
    if (context?.district) params.set('district', context.district);
    const res = await fetchImpl(`${endpoint}?${params.toString()}`, { signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`Autocomplete HTTP ${res.status}`);
    const data = (await res.json()) as {
      success?: boolean;
      predictions?: AddressSuggestion[];
      meta?: { photon?: string; outOfZone?: boolean };
    };
    if (!data || data.success === false) throw new Error('Autocomplete failed');
    const photon = data.meta?.photon;
    return {
      suggestions: Array.isArray(data.predictions) ? data.predictions : [],
      degraded: photon === 'timeout' || photon === 'error' || photon === 'partial' || photon === 'limited',
      outOfZone: data.meta?.outOfZone === true,
    };
  };
}
