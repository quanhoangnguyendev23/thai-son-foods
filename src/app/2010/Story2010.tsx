'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Scene1Game, { type FlameState } from './Scene1Game';

/* ═══════════════════════════════════════════════════════════════════════════
   CẤU HÌNH NỘI DUNG — sửa ở đây (tên, lời, nhạc). Không cần đụng phần bên dưới.
   Trong lời văn: {TEN_NGUOI_NHAN} sẽ được thay bằng tên người nhận.
   ═══════════════════════════════════════════════════════════════════════════ */
const TEN_NGUOI_NHAN = 'T';
const TEN_NGUOI_GUI = 'một người bạn';
/** Hiện dòng ký tên "— {TEN_NGUOI_GUI}" ở cảnh cuối (hiện đang ẩn). Đổi true để hiện lại. */
const HIEN_DONG_KY_TEN = false;
const NAM = '2010';
/** Đường dẫn file nhạc (ví dụ '/music/2010.mp3'). Để trống = không có nhạc, không hiện nút nhạc. */
const MUSIC_URL = '';

const NIGHT = '#0d0509';
const PINK_NIGHT = '#3a0f22';
const DAWN_PINK = '#ff8fa3';
const DAWN_GOLD = '#ffd27a';
const SUN_CREAM = '#fff4dc';

type SunState = 'hidden' | 'rise' | 'high';

interface HeartCfg {
  /** Hệ số kích thước trái tim (1 = cỡ chuẩn) */
  scale: number;
  /** Độ sáng tổng (0 = ẩn) */
  alpha: number;
  /** Vị trí tâm theo chiều dọc, tỉ lệ chiều cao màn hình */
  y: number;
  /** Chu kỳ một nhịp "thình-thịch" (giây) */
  period: number;
  /** Biên độ nở mỗi nhịp (0.13 = 13%) */
  amp: number;
  /** Mức tàn lửa bắn lên mỗi nhịp */
  embers: number;
  /** Tốc độ chuyển trạng thái */
  rate: number;
}

interface Scene {
  bg: string;
  ink: string;
  /** Lớp ánh sáng nền (gradient), chuyển mờ giữa các cảnh */
  glow: string;
  lines: string[];
  small?: boolean;
  big?: boolean;
  textPos: 'bottom' | 'top' | 'high';
  heart: HeartCfg;
  spark?: boolean;
  veil: number;
  sun: SunState;
  smile?: boolean;
  twinkle?: number;
  vibrate?: boolean;
}

const SCENES: Scene[] = [
  // 1 — Tia lửa nhỏ như bật lửa vừa quẹt
  {
    bg: NIGHT,
    ink: SUN_CREAM,
    glow: 'none',
    lines: ['Chạm để thắp lửa'],
    small: true,
    textPos: 'high',
    heart: { scale: 0.05, alpha: 0, y: 0.34, period: 1.15, amp: 0.13, embers: 0, rate: 3 },
    spark: true,
    veil: 0,
    sun: 'hidden',
  },
  // 2 — Tia lửa bùng lên thành trái tim đập
  {
    bg: NIGHT,
    ink: SUN_CREAM,
    glow: 'radial-gradient(ellipse 80% 45% at 50% 34%, rgba(255,59,98,0.16), transparent 70%)',
    lines: ['Có một đốm lửa nhỏ,', 'nằm yên trong lồng ngực.', 'Không ai thấy. Nó vẫn thở.'],
    textPos: 'bottom',
    heart: { scale: 1, alpha: 1, y: 0.34, period: 1.15, amp: 0.13, embers: 1, rate: 3.2 },
    veil: 0,
    sun: 'hidden',
    vibrate: true,
  },
  // 3 — Đập mạnh hơn, tàn lửa nhiều
  {
    bg: NIGHT,
    ink: SUN_CREAM,
    glow: 'radial-gradient(ellipse 85% 48% at 50% 34%, rgba(255,179,71,0.18), transparent 70%)',
    lines: ['{TEN_NGUOI_NHAN} ơi,', 'có hôm gió lớn lắm,', 'lửa chao đi, chực tắt.', 'Nhưng nó chưa bao giờ tắt.'],
    textPos: 'bottom',
    heart: { scale: 1.06, alpha: 1, y: 0.34, period: 0.95, amp: 0.16, embers: 2.6, rate: 2 },
    veil: 0,
    sun: 'hidden',
    vibrate: true,
  },
  // 4 — Tàn lửa hóa cánh voan hồng như tà váy công chúa
  {
    bg: PINK_NIGHT,
    ink: SUN_CREAM,
    glow: 'radial-gradient(ellipse 90% 55% at 50% 40%, rgba(255,143,163,0.2), transparent 72%)',
    lines: ['Mỗi lần chao đảo,', 'tàn lửa hóa thành lụa hồng,', 'khoác lên như áo công chúa.', 'Gió chỉ làm nó đẹp hơn.'],
    textPos: 'bottom',
    heart: { scale: 0.6, alpha: 0.7, y: 0.27, period: 1.3, amp: 0.08, embers: 0.5, rate: 1.6 },
    veil: 1,
    sun: 'hidden',
  },
  // 5 — Trái tim chậm lại, dịu hơn
  {
    bg: PINK_NIGHT,
    ink: SUN_CREAM,
    glow: 'radial-gradient(ellipse 80% 45% at 50% 34%, rgba(255,143,163,0.14), transparent 70%)',
    lines: ['Nếu hôm nay mệt,', 'cứ thở chậm lại thôi.', 'Lửa vẫn ấm. Mình ở đây.'],
    textPos: 'bottom',
    heart: { scale: 0.88, alpha: 0.88, y: 0.33, period: 2, amp: 0.055, embers: 0.2, rate: 1.4 },
    veil: 0.3,
    sun: 'hidden',
  },
  // 6 — Bình minh: mặt trời nhô lên, trái tim hòa vào mặt trời
  {
    bg: DAWN_PINK,
    ink: PINK_NIGHT,
    glow: `linear-gradient(to top, rgba(255,210,122,0.9) 0%, rgba(255,210,122,0.35) 38%, rgba(255,210,122,0) 70%)`,
    lines: ['Đêm nào rồi cũng qua.', 'Mặt trời đang lên.'],
    textPos: 'top',
    big: true,
    heart: { scale: 0.13, alpha: 0, y: 0.76, period: 1.15, amp: 0.1, embers: 0, rate: 0.9 },
    veil: 0,
    sun: 'rise',
  },
  // 7 — Nụ cười và lời chúc
  {
    bg: SUN_CREAM,
    ink: PINK_NIGHT,
    glow: `radial-gradient(ellipse 90% 40% at 50% 22%, rgba(255,210,122,0.55), transparent 72%)`,
    lines: ['Mong bạn luôn nở nụ cười.'],
    big: true,
    textPos: 'bottom',
    heart: { scale: 0.1, alpha: 0, y: 0.22, period: 1.15, amp: 0.1, embers: 0, rate: 1 },
    veil: 0,
    sun: 'high',
    smile: true,
    twinkle: 1,
  },
];

const LAST = SCENES.length - 1;
const LINE_DELAY_MS = 600;
const FIRST_LINE_DELAY_MS = 500;
const HINT_DELAY_MS = 3000;

const fill = (s: string) => s.replace('{TEN_NGUOI_NHAN}', TEN_NGUOI_NHAN);

/* ═══════════════════════════════════════════════════════════════════════════
   PHẦN KỸ THUẬT — canvas trái tim lửa
   ═══════════════════════════════════════════════════════════════════════════ */

interface Particle {
  hx: number; // toạ độ trong không gian trái tim (đơn vị gốc, ~[-16,16])
  hy: number;
  ox: number; // độ lệch do chạm
  oy: number;
  vx: number;
  vy: number;
  ph: number;
  amp: number;
  sz: number;
}
interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  warm: boolean;
}
interface Veil {
  x: number;
  y: number;
  len: number;
  w: number;
  sway: number;
  freq: number;
  ph: number;
  vy: number;
}
interface Twinkle {
  x: number;
  y: number;
  s: number;
  ph: number;
  sp: number;
  warm: boolean;
}

const COLOR_BUCKETS = 16;
const CORE = [255, 179, 71]; // #ffb347 lõi
const EDGE = [255, 59, 98]; // #ff3b62 viền

function makeGlowSprite(rgb: number[], size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`);
    grad.addColorStop(0.35, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.45)`);
    grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return c;
}

/** Đường viền trái tim theo công thức x=16sin³t, y=-(13cos t − 5cos 2t − 2cos 3t − cos 4t), lấy 360 điểm */
const HEART_POLY: Array<[number, number]> = (() => {
  const pts: Array<[number, number]> = [];
  const n = 360;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push([
      16 * Math.pow(Math.sin(t), 3),
      -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
    ]);
  }
  return pts;
})();
const HEART_CY = 2.5; // tâm hộp bao theo chiều dọc
// Độ dài tích lũy theo chu vi để chọn điểm viền đều nhau
const HEART_PERIM: number[] = (() => {
  const acc: number[] = [0];
  for (let i = 1; i <= HEART_POLY.length; i++) {
    const [x0, y0] = HEART_POLY[i - 1];
    const [x1, y1] = HEART_POLY[i % HEART_POLY.length];
    acc.push(acc[i - 1] + Math.hypot(x1 - x0, y1 - y0));
  }
  return acc;
})();

function insideHeart(x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = HEART_POLY.length - 1; i < HEART_POLY.length; j = i++) {
    const [xi, yi] = HEART_POLY[i];
    const [xj, yj] = HEART_POLY[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Điểm ngẫu nhiên: 28% sát viền (đều theo chu vi), còn lại lấp đầy đều bên trong. s = 0 ở lõi → 1 ở viền (để chọn màu) */
function heartPoint(): { x: number; y: number; s: number } {
  if (Math.random() < 0.28) {
    const target = Math.random() * HEART_PERIM[HEART_POLY.length];
    let lo = 0;
    let hi = HEART_POLY.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (HEART_PERIM[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const [px, py] = HEART_POLY[lo % HEART_POLY.length];
    const k = 1 - Math.random() * 0.07; // lùi vào trong một chút
    return { x: px * k, y: (py - HEART_CY) * k, s: 0.9 + Math.random() * 0.1 };
  }
  for (let tries = 0; tries < 60; tries++) {
    const x = (Math.random() * 2 - 1) * 16;
    const y = -12.3 + Math.random() * 29.4;
    if (insideHeart(x, y)) {
      const s = Math.min(1, Math.hypot(x / 16, (y - HEART_CY) / 14.5));
      return { x, y: y - HEART_CY, s };
    }
  }
  return { x: 0, y: 0, s: 0 };
}

export default function Story2010() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [scene, setScene] = useState(0);
  const [shown, setShown] = useState(0);
  const [hint, setHint] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [musicOn, setMusicOn] = useState(false);

  const sceneRef = useRef(0);
  const reducedRef = useRef(false);
  const interactedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const hintTimerRef = useRef<number | null>(null);
  const eventsRef = useRef<Array<{ type: 'bloom' | 'burst'; x?: number; y?: number }>>([]);
  const pointerRef = useRef({ x: 0, y: 0, down: false, until: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Mini-game Cảnh 1: đốm lửa chia sẻ với canvas, quản lý mount/unmount
  const flameRef = useRef<FlameState>({ active: false, x: 0, y: 0, flicker: 1, boost: 0 });
  const [gameMounted, setGameMounted] = useState(true);
  const [gameKey, setGameKey] = useState(0);
  const [gameFailed, setGameFailed] = useState(false);
  const gameFailedRef = useRef(false);
  const prevSceneRef = useRef(0);

  const cfg = SCENES[scene];
  const lines = cfg.lines.map(fill);
  const allShown = shown >= lines.length;

  /* ── Font Google (Playfair Display + Be Vietnam Pro), có font dự phòng trong CSS ── */
  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    const add = (rel: string, href: string, cross?: boolean) => {
      const l = document.createElement('link');
      l.rel = rel;
      l.href = href;
      if (cross) l.crossOrigin = 'anonymous';
      document.head.appendChild(l);
      links.push(l);
    };
    add('preconnect', 'https://fonts.googleapis.com');
    add('preconnect', 'https://fonts.gstatic.com', true);
    add(
      'stylesheet',
      'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500&family=Playfair+Display:ital,wght@1,400;1,500&display=swap&subset=vietnamese'
    );
    return () => links.forEach((l) => l.remove());
  }, []);

  /* ── Khóa cuộn trang, giữ nền tối trong lúc xem ── */
  useEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevOverscroll = html.style.overscrollBehavior;
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    return () => {
      html.style.overflow = prevOverflow;
      html.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  /* ── Giảm chuyển động theo cài đặt hệ thống ── */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      reducedRef.current = mq.matches;
      setReduced(mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  /* ── Hiện từng dòng chữ, mờ dần vào, cách nhau ~0,6 giây ── */
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    sceneRef.current = scene;
    clearTimers();
    // Đổi cảnh: đặt lại phần chữ đang hiện (chủ ý) — rồi hiện từng dòng theo hẹn giờ bên dưới
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(0);
    setHint(false);
    const n = SCENES[scene].lines.length;
    if (reducedRef.current) {
      timersRef.current.push(window.setTimeout(() => setShown(n), 250));
    } else {
      for (let i = 0; i < n; i++) {
        timersRef.current.push(window.setTimeout(() => setShown(i + 1), FIRST_LINE_DELAY_MS + i * LINE_DELAY_MS));
      }
    }
    if (scene === 1) eventsRef.current.push({ type: 'bloom' });
    return clearTimers;
  }, [scene, clearTimers]);

  /* ── Gợi ý "chạm để tiếp tục" sau 3 giây nếu chưa chạm ── */
  const armHint = useCallback(() => {
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    setHint(false);
    hintTimerRef.current = window.setTimeout(() => setHint(true), HINT_DELAY_MS);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    armHint();
    return () => {
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    };
  }, [scene, armHint]);

  /* ── Mini-game Cảnh 1: khởi tạo lại sạch khi quay về Cảnh 1; gỡ sau khi mờ dần khi sang cảnh khác ── */
  useEffect(() => {
    gameFailedRef.current = gameFailed;
  }, [gameFailed]);
  useEffect(() => {
    const prev = prevSceneRef.current;
    prevSceneRef.current = scene;
    if (scene === 0) {
      if (prev !== 0) {
        setGameKey((k) => k + 1);
        setGameMounted(true);
      }
      return;
    }
    const id = window.setTimeout(() => setGameMounted(false), 1100);
    return () => window.clearTimeout(id);
  }, [scene]);

  /* ── Điều hướng ── */
  const shownRef = useRef(0);
  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  /** Chạm sang cảnh kế: nếu chữ đang hiện dở thì hiện đủ ngay, lần chạm sau mới sang cảnh */
  const advance = useCallback(() => {
    const s = sceneRef.current;
    const n = SCENES[s].lines.length;
    if (shownRef.current < n) {
      clearTimers();
      setShown(n);
      return;
    }
    if (s < LAST) setScene(s + 1);
  }, [clearTimers]);

  const goPrev = useCallback(() => {
    const s = sceneRef.current;
    if (s > 0) setScene(s - 1);
  }, []);

  const restart = useCallback(() => setScene(0), []);

  /* ── Bàn phím (máy tính) ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Cảnh 1 là mini-game: phím mũi tên/WASD dùng để di chuyển nhân vật, không chuyển cảnh
      if (sceneRef.current === 0 && !gameFailedRef.current) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        if ((e.target as HTMLElement)?.tagName === 'BUTTON' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        interactedRef.current = true;
        armHint();
        advance();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        armHint();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armHint, goPrev, advance]);

  /* ── Nhạc (tùy chọn): chỉ phát sau cái chạm đầu tiên ── */
  const startMusic = useCallback(() => {
    if (!MUSIC_URL) return;
    if (!audioRef.current) {
      const a = new Audio(MUSIC_URL);
      a.loop = true;
      a.volume = 0.6;
      audioRef.current = a;
    }
    audioRef.current
      .play()
      .then(() => setMusicOn(true))
      .catch(() => setMusicOn(false));
  }, []);
  const toggleMusic = useCallback(() => {
    const a = audioRef.current;
    if (!a) {
      startMusic();
      return;
    }
    if (a.paused) {
      a.play().then(() => setMusicOn(true)).catch(() => {});
    } else {
      a.pause();
      setMusicOn(false);
    }
  }, [startMusic]);
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  /* ── Mini-game Cảnh 1: các callback ── */
  const handleGameFirst = useCallback(() => {
    if (!interactedRef.current) {
      interactedRef.current = true;
      startMusic();
    }
  }, [startMusic]);
  const handleGameBurst = useCallback((x: number, y: number) => {
    eventsRef.current.push({ type: 'burst', x, y });
  }, []);
  // Chạm lửa → sang Cảnh 2 bằng đúng cơ chế chuyển cảnh sẵn có (setScene → bloom trái tim)
  const handleGameReach = useCallback(() => {
    if (sceneRef.current === 0) setScene(1);
  }, []);
  const handleGameError = useCallback(() => setGameFailed(true), []);

  /* ── Chạm / vuốt ── */
  const downRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    downRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    pointerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, down: true, until: performance.now() + 700 };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* bỏ qua */
    }
    if (!interactedRef.current) {
      interactedRef.current = true;
      startMusic();
    }
    armHint();
    eventsRef.current.push({ type: 'burst', x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerRef.current.down) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pointerRef.current.x = e.clientX - rect.left;
    pointerRef.current.y = e.clientY - rect.top;
    pointerRef.current.until = performance.now() + 500;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = downRef.current;
    pointerRef.current.down = false;
    pointerRef.current.until = performance.now() + 450;
    downRef.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const rect = e.currentTarget.getBoundingClientRect();
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) advance();
      else goPrev();
      return;
    }
    if (Math.abs(dx) > 14 || Math.abs(dy) > 14) return;
    // Chạm 1/3 bên trái: quay lại; 2/3 bên phải: sang cảnh kế
    if (e.clientX - rect.left < rect.width / 3) goPrev();
    else advance();
  };
  const onPointerCancel = () => {
    pointerRef.current.down = false;
    downRef.current = null;
  };

  /* ═══ Vòng lặp canvas ═══ */
  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowEnd = (nav.hardwareConcurrency || 4) <= 4 || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2);
    const baseCount = reducedRef.current ? 450 : lowEnd ? 900 : 1500;

    // Hạt trái tim
    const particles: Particle[] = [];
    const buckets: number[][] = Array.from({ length: COLOR_BUCKETS }, () => []);
    for (let i = 0; i < baseCount; i++) {
      const p = heartPoint();
      const t = Math.min(1, Math.pow(p.s, 1.3));
      buckets[Math.min(COLOR_BUCKETS - 1, Math.floor(t * COLOR_BUCKETS))].push(i);
      particles.push({
        hx: p.x,
        hy: p.y,
        ox: 0,
        oy: 0,
        vx: 0,
        vy: 0,
        ph: Math.random() * Math.PI * 2,
        amp: 0.25 + Math.random() * 0.7,
        sz: 1.8 + Math.random() * 2.2,
      });
    }
    const bucketColor = Array.from({ length: COLOR_BUCKETS }, (_, b) => {
      const k = b / (COLOR_BUCKETS - 1);
      return [0, 1, 2].map((i) => Math.round(CORE[i] + (EDGE[i] - CORE[i]) * k));
    });

    const warmSprite = makeGlowSprite([255, 196, 96], 64);
    const pinkSprite = makeGlowSprite([255, 96, 128], 64);
    const haloSprite = makeGlowSprite([255, 59, 98], 256);

    const embers: Ember[] = [];
    const veils: Veil[] = Array.from({ length: 11 }, () => ({
      x: Math.random(),
      y: Math.random() * 1.2 - 0.2,
      len: 0.32 + Math.random() * 0.26,
      w: 6 + Math.random() * 11,
      sway: 20 + Math.random() * 34,
      freq: 0.5 + Math.random() * 0.7,
      ph: Math.random() * Math.PI * 2,
      vy: 16 + Math.random() * 26,
    }));
    const twinkles: Twinkle[] = Array.from({ length: 30 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: 3 + Math.random() * 6,
      ph: Math.random() * Math.PI * 2,
      sp: 1.2 + Math.random() * 2,
      warm: Math.random() < 0.6,
    }));

    let W = 0;
    let H = 0;
    let dpr = 1;
    const resize = () => {
      const rect = root.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);

    // Trạng thái hiện tại (chuyển mượt về mục tiêu của cảnh)
    const cur = { scale: 0.05, alpha: 0, y: 0.34, period: 1.15, amp: 0.13, embers: 0, veil: 0, spark: 1, twinkle: 0 };
    let phaseAcc = 0;
    let last = performance.now();
    let raf = 0;
    let running = true;
    let drawFrac = 1;
    let slowFrames = 0;
    let frameCount = 0;

    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
    const beat = (ph: number, c: number, w: number) => Math.exp(-(((ph - c) / w) ** 2));

    const heartCenter = () => ({ x: W / 2, y: cur.y * H });
    const heartUnit = (scaleMul: number) => (Math.min(W * 0.76, H * 0.4, 340) / 32) * scaleMul;

    const spawnEmbers = (n: number, x: number, y: number, spread: number, up: number) => {
      const room = 260 - embers.length;
      const count = Math.min(n, Math.max(0, room));
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * spread;
        embers.push({
          x: x + Math.cos(a) * r,
          y: y + Math.sin(a) * r * 0.7,
          vx: (Math.random() - 0.5) * 40,
          vy: -(up * (0.5 + Math.random() * 0.9)),
          life: 0,
          max: 0.9 + Math.random() * 1.3,
          size: 6 + Math.random() * 10,
          warm: Math.random() < 0.65,
        });
      }
    };
    const spawnBurst = (x: number, y: number) => {
      const n = reducedRef.current ? 8 : 30;
      for (let i = 0; i < n && embers.length < 300; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 70 + Math.random() * 220;
        embers.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 30,
          life: 0,
          max: 0.5 + Math.random() * 0.7,
          size: 5 + Math.random() * 9,
          warm: Math.random() < 0.7,
        });
      }
    };

    const onBeat = () => {
      const s = SCENES[sceneRef.current];
      if (cur.alpha > 0.35 && !reducedRef.current) {
        const hc = heartCenter();
        const half = heartUnit(cur.scale) * 14;
        spawnEmbers(Math.round(5 * cur.embers), hc.x, hc.y - half * 0.4, half * 0.8, 70 + cur.embers * 25);
      }
      if (s.vibrate && interactedRef.current && !reducedRef.current && typeof navigator.vibrate === 'function') {
        navigator.vibrate([30, 60, 30]);
      }
    };

    const drawVeils = (t: number, alpha: number) => {
      if (alpha < 0.01) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const v of veils) {
        const x0 = v.x * W;
        const y0 = v.y * H;
        const len = v.len * H;
        const steps = 18;
        const left: Array<[number, number]> = [];
        const right: Array<[number, number]> = [];
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          const y = y0 + u * len;
          const cx = x0 + Math.sin(u * 3.2 + v.ph + t * v.freq) * v.sway;
          const wv = Math.sin(Math.PI * u) * v.w * (0.5 + 0.5 * u);
          left.push([cx - wv, y]);
          right.push([cx + wv, y]);
        }
        ctx.beginPath();
        ctx.moveTo(left[0][0], left[0][1]);
        for (let i = 1; i <= steps; i++) ctx.lineTo(left[i][0], left[i][1]);
        for (let i = steps; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
        ctx.closePath();
        const fade = Math.sin(Math.PI * Math.min(1, Math.max(0, (v.y * H + len * 0.5) / (H + len))));
        ctx.fillStyle = `rgba(255,143,163,${0.2 * alpha * (0.4 + 0.6 * fade)})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255,205,220,${0.2 * alpha * (0.4 + 0.6 * fade)})`;
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
      }
    };

    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;
      const t = now / 1000;

      // Tự giảm tải nếu máy yếu (khung hình chậm liên tục)
      frameCount++;
      if (dt > 0.034) slowFrames++;
      if (frameCount === 90) {
        if (slowFrames > 40 && drawFrac > 0.5) drawFrac = 0.6;
        frameCount = 0;
        slowFrames = 0;
      }

      const s = SCENES[sceneRef.current];
      const reduceMotion = reducedRef.current;
      const k = ease(s.heart.rate, dt);
      cur.scale = lerp(cur.scale, s.heart.scale, k);
      cur.alpha = lerp(cur.alpha, s.heart.alpha, k);
      cur.y = lerp(cur.y, s.heart.y, ease(1.2, dt));
      cur.period = lerp(cur.period, s.heart.period, ease(1.5, dt));
      cur.amp = lerp(cur.amp, reduceMotion ? 0.025 : s.heart.amp, ease(2, dt));
      cur.embers = lerp(cur.embers, s.heart.embers, ease(1.5, dt));
      cur.veil = lerp(cur.veil, s.veil, ease(1.2, dt));
      cur.spark = lerp(cur.spark, s.spark ? 1 : 0, ease(5, dt));
      cur.twinkle = lerp(cur.twinkle, s.twinkle || 0, ease(1.1, dt));

      // Sự kiện từ giao diện
      const evs = eventsRef.current;
      while (evs.length) {
        const ev = evs.shift();
        if (!ev) break;
        if (ev.type === 'burst' && ev.x !== undefined && ev.y !== undefined) spawnBurst(ev.x, ev.y);
        if (ev.type === 'bloom') {
          const hc = heartCenter();
          if (!reduceMotion) spawnEmbers(70, hc.x, hc.y, 30, 140);
        }
      }

      // Nhịp tim "thình-thịch"
      phaseAcc += dt / Math.max(0.4, cur.period);
      if (phaseAcc >= 1) {
        phaseAcc -= 1;
        onBeat();
      }
      const ph = phaseAcc;
      const pulse = Math.min(1, beat(ph, 0.06, 0.05) + beat(ph, 0.27, 0.06) * 0.7);
      const pulseScale = 1 + cur.amp * pulse;
      const bright = 0.7 + 0.3 * pulse;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Voan hồng (cảnh 4)
      if (cur.veil > 0.01) {
        const moving = reduceMotion ? 0 : dt;
        for (const v of veils) {
          v.y += (v.vy * moving) / H;
          if (v.y * H > H + v.len * H * 0.2) {
            v.y = -v.len - Math.random() * 0.2;
            v.x = Math.random();
          }
        }
        drawVeils(reduceMotion ? 0 : t, cur.veil);
      }

      // Trái tim
      const hc = heartCenter();
      const u = heartUnit(cur.scale * pulseScale);
      if (cur.alpha > 0.01 && cur.scale > 0.02) {
        ctx.globalCompositeOperation = 'lighter';
        // Quầng sáng
        const halo = u * 46;
        ctx.globalAlpha = Math.min(1, 0.34 * cur.alpha * bright);
        ctx.drawImage(haloSprite, hc.x - halo, hc.y - halo, halo * 2, halo * 2);
        // Lõi ấm cam vàng đập theo nhịp
        const inner = u * 17 * (0.9 + 0.2 * pulse);
        ctx.globalAlpha = Math.min(1, 0.3 * cur.alpha * bright);
        ctx.drawImage(warmSprite, hc.x - inner, hc.y - inner * 0.95, inner * 2, inner * 2);

        // Lực đẩy từ ngón tay
        const pt = pointerRef.current;
        const pushing = !reduceMotion && (pt.down || now < pt.until);
        const R = 110;
        const R2 = R * R;
        const count = Math.floor(particles.length * drawFrac);
        const damp = Math.exp(-5 * dt);

        for (let b = 0; b < COLOR_BUCKETS; b++) {
          const col = bucketColor[b];
          ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
          ctx.globalAlpha = Math.min(1, cur.alpha * bright * 0.8);
          const list = buckets[b];
          for (let n = 0; n < list.length; n++) {
            const i = list[n];
            if (i >= count) continue;
            const p = particles[i];
            let jx = 0;
            let jy = 0;
            if (!reduceMotion) {
              jx = Math.sin(t * 0.9 + p.ph) * p.amp;
              jy = Math.cos(t * 1.1 + p.ph * 1.3) * p.amp;
            }
            let x = hc.x + p.hx * u + p.ox + jx;
            let y = hc.y + p.hy * u + p.oy + jy;
            if (pushing) {
              const dx = x - pt.x;
              const dy = y - pt.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < R2 && d2 > 0.01) {
                const d = Math.sqrt(d2);
                const f = ((R - d) / R) * 900 * dt;
                p.vx += (dx / d) * f;
                p.vy += (dy / d) * f;
              }
            }
            // Lò xo kéo hạt về vị trí cũ
            p.vx += -p.ox * 14 * dt;
            p.vy += -p.oy * 14 * dt;
            p.vx *= damp;
            p.vy *= damp;
            p.ox += p.vx * dt;
            p.oy += p.vy * dt;
            x = hc.x + p.hx * u + p.ox + jx;
            y = hc.y + p.hy * u + p.oy + jy;
            const sz = p.sz * (dpr > 1.5 ? 1.15 : 1);
            ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
          }
        }
        ctx.globalAlpha = 1;
      }

      // Tia lửa nhỏ như bật lửa vừa quẹt (cảnh 1) — vị trí do mini-game điều khiển (flameRef), mặc định giữa màn hình
      if (cur.spark > 0.02) {
        const fs = flameRef.current;
        const sx = fs.active ? fs.x : hc.x;
        const sy = fs.active ? fs.y : hc.y;
        const fk = fs.active ? fs.flicker : 1;
        const bst = fs.active ? fs.boost : 0;
        ctx.globalCompositeOperation = 'lighter';
        const fl = reduceMotion ? 0.8 : 1 - Math.random() * 0.35 * fk;
        const base = (26 + (reduceMotion ? 0 : Math.sin(t * 9) * 3 * fk)) * (1 + bst * 1.6);
        ctx.globalAlpha = Math.min(1, cur.spark * fl);
        ctx.drawImage(warmSprite, sx - base * 1.6, sy - base * 1.6 - 4, base * 3.2, base * 3.2);
        ctx.globalAlpha = Math.min(1, cur.spark * Math.min(1, fl + 0.2));
        const core = (9 + (reduceMotion ? 0 : Math.random() * 4)) * (1 + bst * 1.2);
        ctx.drawImage(warmSprite, sx - core, sy - core - 6, core * 2, core * 2);
        // ngọn lửa nhỏ
        const fz = 1 + bst * 0.9;
        ctx.beginPath();
        const flick = (reduceMotion ? 0 : Math.sin(t * 17) * 2) * fk;
        ctx.moveTo(sx - 5 * fz, sy);
        ctx.quadraticCurveTo(sx - 6 * fz + flick, sy - 16 * fz, sx + flick * 0.5, sy - (26 + flick) * fz);
        ctx.quadraticCurveTo(sx + 7 * fz + flick, sy - 14 * fz, sx + 5 * fz, sy);
        ctx.closePath();
        ctx.fillStyle = 'rgb(255,205,110)';
        ctx.globalAlpha = Math.min(1, cur.spark * 0.85);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Tàn lửa
      if (embers.length) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = embers.length - 1; i >= 0; i--) {
          const e = embers[i];
          e.life += dt;
          if (e.life >= e.max) {
            embers.splice(i, 1);
            continue;
          }
          e.vx *= Math.exp(-0.8 * dt);
          e.vy *= Math.exp(-0.5 * dt);
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          const lf = e.life / e.max;
          const a = (1 - lf) * (1 - lf);
          const size = e.size * (1 - lf * 0.5);
          ctx.globalAlpha = Math.min(1, a * 0.95);
          ctx.drawImage(e.warm ? warmSprite : pinkSprite, e.x - size, e.y - size, size * 2, size * 2);
        }
        ctx.globalAlpha = 1;
      }

      // Lấp lánh quanh nụ cười (cảnh 7) — vẽ thường vì nền sáng
      if (cur.twinkle > 0.02) {
        ctx.globalCompositeOperation = 'source-over';
        for (const tw of twinkles) {
          const a = (0.5 + 0.5 * Math.sin(t * tw.sp + tw.ph)) * cur.twinkle;
          if (a < 0.05) continue;
          const x = tw.x * W;
          const y = (0.08 + tw.y * 0.52) * H;
          const s2 = tw.s * (reduceMotion ? 0.8 : 0.6 + 0.4 * Math.sin(t * tw.sp + tw.ph));
          ctx.strokeStyle = tw.warm ? `rgba(255,170,60,${a * 0.9})` : `rgba(255,99,140,${a * 0.8})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(x - s2, y);
          ctx.lineTo(x + s2, y);
          ctx.moveTo(x, y - s2);
          ctx.lineTo(x, y + s2);
          ctx.stroke();
          ctx.fillStyle = tw.warm ? `rgba(255,190,90,${a})` : `rgba(255,120,150,${a})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  /* ═══ Giao diện ═══ */
  const lightScene = cfg.ink === PINK_NIGHT;
  const sunStyle = {
    hidden: { top: '118%', transform: 'translate(-50%,-50%) scale(0.8)', opacity: 0 },
    rise: { top: '76%', transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
    high: { top: '22%', transform: 'translate(-50%,-50%) scale(0.78)', opacity: 1 },
  }[cfg.sun];

  return (
    <div
      ref={rootRef}
      className={`s10-root${reduced ? ' s10-reduced' : ''}`}
      style={{ backgroundColor: cfg.bg, color: cfg.ink }}
      role="region"
      aria-roledescription="câu chuyện tương tác"
      aria-label="Một món quà nhỏ"
    >
      <style>{CSS}</style>

      {/* Lớp ánh sáng nền: chuyển mờ giữa các cảnh */}
      {SCENES.map((s, i) => (
        <div key={i} className="s10-glow" style={{ background: s.glow, opacity: i === scene ? 1 : 0 }} aria-hidden />
      ))}

      {/* Mặt trời (cảnh 6–7) */}
      <div className="s10-sun" style={sunStyle} aria-hidden>
        <div className="s10-rays" />
        <div className="s10-disc" />
      </div>

      <canvas ref={canvasRef} className="s10-canvas" aria-hidden />

      {/* Nụ cười vẽ bằng SVG (cảnh 7) */}
      <svg className="s10-smile" viewBox="0 0 200 90" aria-hidden style={{ opacity: cfg.smile ? 1 : 0 }}>
        <defs>
          <linearGradient id="s10-smile-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff8fa3" />
            <stop offset="50%" stopColor="#ff3b62" />
            <stop offset="100%" stopColor="#ffb347" />
          </linearGradient>
        </defs>
        <path
          d="M 22 26 Q 100 104 178 26"
          pathLength={1}
          className={`s10-smile-path${cfg.smile ? ' on' : ''}`}
          fill="none"
          stroke="url(#s10-smile-grad)"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </svg>

      {/* Mini-game Cảnh 1 (nhân vật + lớp điều khiển); đặt trước lớp chữ để chữ luôn nằm trên */}
      {gameMounted && !gameFailed && (
        <Scene1Game
          key={gameKey}
          flameRef={flameRef}
          active={scene === 0}
          reduced={reduced}
          onFirstInteract={handleGameFirst}
          onBurst={handleGameBurst}
          onReach={handleGameReach}
          onImageError={handleGameError}
        />
      )}

      {/* Chữ: mỗi cảnh một khối, mờ chéo khi đổi cảnh */}
      {SCENES.map((s, i) => {
        const active = i === scene;
        const ls = s.lines.map(fill);
        return (
          <div
            key={i}
            className={`s10-text ${s.textPos === 'top' ? 's10-top' : s.textPos === 'high' ? 's10-high' : 's10-bottom'}`}
            style={{ opacity: active ? 1 : 0, color: s.ink }}
            aria-hidden={!active}
          >
            {ls.map((line, li) => (
              <p
                key={li}
                className={`s10-line${s.small ? ' s10-small' : ''}${s.big ? ' s10-big' : ''}`}
                style={{ opacity: active && li < shown ? 1 : 0, transform: active && li < shown ? 'none' : 'translateY(10px)' }}
              >
                {line}
              </p>
            ))}
            {i === LAST && (
              <div
                className="s10-sign"
                style={{ opacity: active && shown >= ls.length ? 1 : 0, pointerEvents: active && shown >= ls.length ? 'auto' : 'none' }}
              >
                {HIEN_DONG_KY_TEN && <p className="s10-from">— {TEN_NGUOI_GUI}</p>}
                <button
                  type="button"
                  className="s10-restart"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={restart}
                >
                  Xem lại từ đầu
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Vùng chạm toàn màn hình */}
      <div
        className="s10-tap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />

      {/* Thanh tiến trình kiểu story */}
      <div className="s10-bar" aria-hidden>
        {SCENES.map((_, i) => (
          <span key={i} className="s10-seg" style={{ background: lightScene ? 'rgba(58,15,34,0.22)' : 'rgba(255,244,220,0.25)' }}>
            <i style={{ transform: `scaleX(${i <= scene ? 1 : 0})`, background: lightScene ? PINK_NIGHT : SUN_CREAM }} />
          </span>
        ))}
      </div>

      {/* Nút nhạc (chỉ hiện khi có MUSIC_URL) */}
      {MUSIC_URL && (
        <button
          type="button"
          className="s10-music"
          aria-label={musicOn ? 'Tắt nhạc' : 'Bật nhạc'}
          aria-pressed={musicOn}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={toggleMusic}
          style={{ color: cfg.ink }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18V6l10-2v12" />
            <circle cx="6.5" cy="18" r="2.5" />
            <circle cx="16.5" cy="16" r="2.5" />
            {!musicOn && <path d="M3 3l18 18" />}
          </svg>
        </button>
      )}

      {/* Gợi ý chạm */}
      <p className="s10-hint" style={{ opacity: hint && allShown && scene > 0 && scene < LAST ? 0.55 : 0, color: cfg.ink }} aria-hidden>
        chạm để tiếp tục
      </p>

      {/* Năm (cảnh cuối) */}
      <span className="s10-year" style={{ opacity: scene === LAST ? 0.5 : 0, color: cfg.ink }} aria-hidden>
        {NAM}
      </span>

      {/* Trình đọc màn hình: đọc đủ nội dung cảnh hiện tại */}
      <div className="s10-sr" aria-live="polite">
        {`Cảnh ${scene + 1} trên ${SCENES.length}. ${lines.join(' ')}`}
      </div>
    </div>
  );
}

/* ═══ CSS (tự chứa trong file) ═══ */
const CSS = `
.s10-root{
  position:fixed; inset:0; z-index:2147483000;
  width:100vw; height:100dvh; overflow:hidden;
  font-family:'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-tap-highlight-color:transparent; -webkit-user-select:none; user-select:none;
  touch-action:none; overscroll-behavior:none;
  transition:background-color 1.2s ease, color 1.2s ease;
}
.s10-glow{ position:absolute; inset:0; transition:opacity 1.2s ease; pointer-events:none; }
.s10-canvas{ position:absolute; left:0; top:0; pointer-events:none; }

.s10-sun{
  position:absolute; left:50%; width:min(78vw,360px); aspect-ratio:1; pointer-events:none;
  transition:top 1.8s cubic-bezier(.22,1,.36,1), transform 1.8s cubic-bezier(.22,1,.36,1), opacity 1s ease;
}
.s10-disc{
  position:absolute; inset:0; border-radius:50%;
  background:radial-gradient(circle at 50% 50%, #fff9e8 0%, ${SUN_CREAM} 30%, ${DAWN_GOLD} 62%, rgba(255,179,71,0.55) 78%, rgba(255,179,71,0) 100%);
  box-shadow:0 0 90px 30px rgba(255,210,122,0.55);
}
.s10-rays{
  position:absolute; left:-55%; top:-55%; width:210%; height:210%; border-radius:50%;
  background:repeating-conic-gradient(from 0deg, rgba(255,210,122,0.5) 0deg 3deg, rgba(255,210,122,0) 3deg 15deg);
  -webkit-mask-image:radial-gradient(circle, #000 0%, #000 22%, transparent 62%);
  mask-image:radial-gradient(circle, #000 0%, #000 22%, transparent 62%);
  animation:s10-spin 60s linear infinite;
}
@keyframes s10-spin{ to{ transform:rotate(360deg); } }

.s10-smile{
  position:absolute; left:50%; top:40%; width:min(46vw,210px); transform:translateX(-50%);
  pointer-events:none; transition:opacity .6s ease .3s; overflow:visible;
}
.s10-smile-path{ stroke-dasharray:1; stroke-dashoffset:1; transition:stroke-dashoffset 1.7s cubic-bezier(.4,0,.2,1) .4s; }
.s10-smile-path.on{ stroke-dashoffset:0; }

.s10-text{
  position:absolute; left:0; right:0; padding:0 28px; text-align:center;
  display:flex; flex-direction:column; align-items:center; gap:.9em;
  transition:opacity .6s ease, color 1.2s ease; pointer-events:none;
}
.s10-bottom{ bottom:calc(env(safe-area-inset-bottom, 0px) + 9dvh); }
.s10-top{ top:calc(env(safe-area-inset-top, 0px) + 17dvh); }
.s10-high{ top:calc(env(safe-area-inset-top, 0px) + 8dvh); }
.s10-line{
  margin:0; max-width:min(28ch, 100%); text-wrap:balance;
  font-family:'Playfair Display', var(--font-playfair), Georgia, serif; font-style:italic; font-weight:400;
  font-size:clamp(22px, 6.3vw, 29px); line-height:1.5; letter-spacing:.005em;
  transition:opacity 1.1s ease, transform 1.1s ease;
  text-shadow:0 1px 14px rgba(0,0,0,.25);
}
.s10-big{ font-size:clamp(24px, 6.8vw, 32px); line-height:1.45; }
.s10-small{
  font-family:'Be Vietnam Pro', system-ui, sans-serif; font-style:normal; font-weight:300;
  font-size:14px; letter-spacing:.22em; text-transform:uppercase; opacity:.8; text-shadow:none;
}
.s10-sign{ position:relative; z-index:8; display:flex; flex-direction:column; align-items:center; gap:14px; margin-top:6px; transition:opacity 1.1s ease .6s; }
.s10-from{ margin:0; font-family:'Be Vietnam Pro', system-ui, sans-serif; font-weight:300; font-size:15px; letter-spacing:.04em; opacity:.8; }
.s10-restart{
  min-height:44px; min-width:44px; padding:0 22px; border-radius:999px; cursor:pointer;
  font:inherit; font-size:14px; color:inherit; background:rgba(255,255,255,.45);
  border:1px solid currentColor; touch-action:manipulation; pointer-events:auto;
}
.s10-restart:focus-visible, .s10-music:focus-visible{ outline:2px solid currentColor; outline-offset:3px; }

.s10-tap{ position:absolute; inset:0; z-index:5; touch-action:none; }

.s10-bar{
  position:absolute; z-index:10; left:12px; right:12px; top:calc(env(safe-area-inset-top, 0px) + 10px);
  display:flex; gap:4px; pointer-events:none;
}
.s10-seg{ position:relative; flex:1; height:3px; border-radius:2px; overflow:hidden; transition:background .9s ease; }
.s10-seg i{ position:absolute; inset:0; transform-origin:left; transition:transform .5s ease, background .9s ease; }

.s10-music{
  position:absolute; z-index:11; right:6px; top:calc(env(safe-area-inset-top, 0px) + 22px);
  width:44px; height:44px; display:flex; align-items:center; justify-content:center;
  background:transparent; border:0; cursor:pointer; opacity:.7; touch-action:manipulation;
}
.s10-hint{
  position:absolute; z-index:6; left:0; right:0; text-align:center; margin:0; pointer-events:none;
  bottom:calc(env(safe-area-inset-bottom, 0px) + 22px); font-size:12px; letter-spacing:.18em; text-transform:uppercase; font-weight:300;
  transition:opacity 1s ease, color 1.2s ease;
}
.s10-year{
  position:absolute; z-index:6; right:18px; bottom:calc(env(safe-area-inset-bottom, 0px) + 14px);
  font-size:11px; letter-spacing:.2em; font-weight:300; transition:opacity 1s ease .8s, color 1.2s ease; pointer-events:none;
}
.s10-sr{ position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }

.s10-reduced .s10-rays{ animation:none; }
.s10-reduced .s10-line{ transform:none !important; transition:opacity .6s ease; }
.s10-reduced .s10-smile-path{ transition:stroke-dashoffset .6s ease; }
@media (prefers-reduced-motion: reduce){
  .s10-rays{ animation:none; }
  .s10-line{ transform:none !important; }
}
`;
