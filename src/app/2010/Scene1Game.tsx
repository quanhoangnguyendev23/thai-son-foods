'use client';

import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   MINI-GAME CẢNH 1 — cô bé đi tới đốm lửa để thắp nó.
   - Component này chỉ lo nhân vật + logic chơi; đốm lửa được VẼ bởi canvas chính của Story2010
     (qua flameRef) để giữ đúng hình ảnh tia lửa cũ.
   - Chạm lửa → gọi onReach(): Story2010 chuyển sang Cảnh 2 bằng cơ chế chuyển cảnh sẵn có.
   ═══════════════════════════════════════════════════════════════════════════ */

const GIRL_SRC = '/2010/girl.webp';
const GIRL_ASPECT = 480 / 714; // rộng / cao của ảnh sau khi cắt

/** Trạng thái đốm lửa chia sẻ với canvas chính */
export interface FlameState {
  active: boolean;
  x: number;
  y: number;
  /** 1 = bình thường, >1 = nhấp nháy mạnh (gợi ý) */
  flicker: number;
  /** 0..1: bùng sáng khi sắp được thắp */
  boost: number;
}

interface Props {
  flameRef: MutableRefObject<FlameState>;
  /** Cảnh 1 đang hiển thị (false = đang mờ dần khi đã sang cảnh khác) */
  active: boolean;
  reduced: boolean;
  onFirstInteract: () => void;
  onBurst: (x: number, y: number) => void;
  onReach: () => void;
  onImageError: () => void;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const smoothstep = (e0: number, e1: number, v: number) => {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

// Thời gian hint (giây không chạm)
const HINT1_S = 5;
const HINT2_S = 12;

interface Control {
  target: { x: number; y: number } | null;
  down: boolean;
  keys: { l: boolean; r: boolean; u: boolean; d: boolean };
  lastInput: number;
  interacted: boolean;
}

export default function Scene1Game({ flameRef, active, reduced, onFirstInteract, onBurst, onReach, onImageError }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const girlRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);

  const ctl = useRef<Control>({ target: null, down: false, keys: { l: false, r: false, u: false, d: false }, lastInput: 0, interacted: false });
  const activeRef = useRef(active);
  const reducedRef = useRef(reduced);
  const readyRef = useRef(false);
  const cbRef = useRef({ onFirstInteract, onBurst, onReach });

  useEffect(() => {
    activeRef.current = active;
    reducedRef.current = reduced;
    readyRef.current = ready;
    cbRef.current = { onFirstInteract, onBurst, onReach };
  });

  /* ── Ảnh có thể đã tải xong trước khi React gắn onLoad (hiển thị phía máy chủ) → kiểm tra ngay khi gắn ── */
  useEffect(() => {
    const im = imgRef.current;
    if (!im || !im.complete) return;
    if (im.naturalWidth > 0) {
      setReady(true);
    } else {
      onImageError();
    }
  }, [onImageError]);

  /* ── Bàn phím: mũi tên và WASD ── */
  useEffect(() => {
    const map = (code: string): 'l' | 'r' | 'u' | 'd' | null => {
      if (code === 'ArrowLeft' || code === 'KeyA') return 'l';
      if (code === 'ArrowRight' || code === 'KeyD') return 'r';
      if (code === 'ArrowUp' || code === 'KeyW') return 'u';
      if (code === 'ArrowDown' || code === 'KeyS') return 'd';
      return null;
    };
    const down = (e: KeyboardEvent) => {
      if (!activeRef.current) return;
      const k = map(e.code);
      if (!k) return;
      e.preventDefault();
      const c = ctl.current;
      c.keys[k] = true;
      c.target = null; // phím ưu tiên hơn đích chạm
      c.lastInput = performance.now();
      if (!c.interacted) {
        c.interacted = true;
        cbRef.current.onFirstInteract();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = map(e.code);
      if (!k) return;
      ctl.current.keys[k] = false;
    };
    const reset = () => {
      ctl.current.keys = { l: false, r: false, u: false, d: false };
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
    };
  }, []);

  /* ── Vòng lặp mô phỏng + hoạt họa ── */
  useEffect(() => {
    const flame = flameRef.current;
    const root = rootRef.current;
    const girl = girlRef.current;
    if (!root || !girl) return;

    let W = 1;
    let H = 1;
    let safeTop = 0;
    const measure = () => {
      const r = root.getBoundingClientRect();
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      safeTop = probeRef.current ? probeRef.current.offsetHeight : 0;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);

    const sim = {
      fx: 0.5, // chân, toạ độ chuẩn hóa theo W/H
      fy: 0.78,
      vx: 0,
      walk: 0,
      reach: 0,
      face: 1,
      faceTarget: 1,
      phase: 0,
      t: 0,
      baseX: -1, // tâm quỹ đạo đốm lửa (px)
      baseY: -1,
      fxPx: 0,
      fyPx: 0,
      hint: 0,
      drift: 0, // 0..1: đang trôi lại gần cô bé (giảm dao động để không tự chạm)
      igniting: false,
      igniteT: 0,
      reached: false,
    };

    let raf = 0;
    let running = true;
    let last = performance.now();
    ctl.current.lastInput = last;

    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      sim.t += dt;
      const t = sim.t;
      const reduce = reducedRef.current;
      const c = ctl.current;

      // ── Kích thước / giới hạn vùng chơi ──
      const gh = clamp(H * 0.33, 180, 320);
      const gw = gh * GIRL_ASPECT;
      const maxFeetY = H * 0.93;
      let minFeetY = Math.max(H * 0.4, safeTop + 22 + gh * 0.82);
      if (minFeetY > maxFeetY - 20) minFeetY = maxFeetY - 20;
      const persp = (y: number) => 0.8 + 0.2 * clamp01((y - minFeetY) / (maxFeetY - minFeetY));
      const halfW = gw * 0.5 + 2; // nửa chiều rộng thân váy: không bao giờ bị cắt ở mép màn hình

      let px = sim.fx * W;
      let py = sim.fy * H;
      const R = clamp(H * 0.1, 44, 92); // bán kính chạm

      // ── Đốm lửa: lơ lửng trong nửa trên ──
      if (sim.baseX < 0) {
        sim.baseX = W * 0.56;
        sim.baseY = H * 0.3;
      }
      const idle = (now - c.lastInput) / 1000;
      const reachY0 = py - 0.92 * gh * persp(py);
      const rpx = px;
      const rpy = reachY0;
      // Sau 12 giây không chạm: đốm lửa nhẹ nhàng trôi lại gần cô bé (không bao giờ bị kẹt)
      if (idle > HINT2_S && !sim.igniting) {
        const dxB = rpx - sim.baseX;
        const dyB = rpy - sim.baseY;
        const dB = Math.hypot(dxB, dyB);
        if (dB > R * 1.9) {
          const k = ease(0.45, dt);
          sim.baseX += dxB * k;
          sim.baseY += dyB * k;
        }
      } else if (idle < HINT2_S && !sim.igniting) {
        // trở về quỹ đạo mặc định từ từ nếu người chơi đã chạm
        const k = ease(0.08, dt);
        sim.baseX += (W * 0.56 - sim.baseX) * k;
        sim.baseY += (H * 0.3 - sim.baseY) * k;
      }
      sim.drift = lerp(sim.drift, idle > HINT2_S && !sim.igniting ? 1 : 0, ease(1.5, dt));
      // Khi trôi lại gần: giảm dao động và dừng cách xa hơn bán kính chạm — người chơi vẫn phải bước thêm một chút
      const wob = (reduce ? 0.35 : 1) * (1 - 0.7 * sim.drift);
      let flameX = sim.baseX + (Math.sin(t * 0.45 + 0.7) * 0.17 * W + Math.sin(t * 0.9 + 2) * 0.03 * W) * wob;
      let flameY = sim.baseY + (Math.sin(t * 0.62) * 0.07 * H + Math.sin(t * 1.3 + 1) * 0.015 * H) * wob;
      flameX = clamp(flameX, W * 0.1, W * 0.9);
      flameY = clamp(flameY, Math.max(H * 0.2, safeTop + 60), H * 0.82);
      if (sim.igniting) {
        // giữ yên lúc đang thắp
        flameX = sim.fxPx;
        flameY = sim.fyPx;
      } else {
        sim.fxPx = flameX;
        sim.fyPx = flameY;
      }

      // ── Điều khiển nhân vật ──
      if (activeRef.current && readyRef.current && !sim.igniting) {
        const k = c.keys;
        const dx = (k.r ? 1 : 0) - (k.l ? 1 : 0);
        const dy = (k.d ? 1 : 0) - (k.u ? 1 : 0);
        if (dx || dy) {
          const n = Math.hypot(dx, dy);
          const spd = 0.62 * Math.min(W, H) * 1.15;
          const vx = (dx / n) * spd;
          const vy = (dy / n) * spd * 0.8;
          px += vx * dt;
          py += vy * dt;
          sim.vx = vx;
        } else if (c.target) {
          const ptr = c.target;
          // Chạm vùng trên: tay với tới điểm chạm; chạm vùng dưới: chân tới điểm chạm
          const kReach = smoothstep(0.7 * H, 0.45 * H, ptr.y);
          const tx = ptr.x;
          const ty = ptr.y + kReach * 0.92 * gh * 0.88;
          const cx = clamp(tx, halfW, W - halfW);
          const cy = clamp(ty, minFeetY, maxFeetY);
          const ddx = cx - px;
          const ddy = cy - py;
          const dist = Math.hypot(ddx, ddy);
          if (dist > 0.5) {
            const e = ease(5.5, dt);
            let step = dist * e;
            const maxStep = 0.95 * Math.max(W * 0.6, H * 0.4) * dt; // giới hạn tốc độ đi
            if (step > maxStep) step = maxStep;
            px += (ddx / dist) * step;
            py += (ddy / dist) * step;
            sim.vx = ((ddx / dist) * step) / Math.max(dt, 0.001);
          } else {
            sim.vx = 0;
          }
        } else {
          sim.vx *= Math.exp(-10 * dt);
        }
        px = clamp(px, halfW, W - halfW);
        py = clamp(py, minFeetY, maxFeetY);
      } else {
        sim.vx *= Math.exp(-10 * dt);
      }
      const speed = Math.abs(sim.vx);
      sim.fx = px / W;
      sim.fy = py / H;

      const sc = persp(py);
      const reachX = px;
      const reachYp = py - 0.92 * gh * sc;
      const dFlame = Math.hypot(flameX - reachX, flameY - reachYp);

      // ── Thắp lửa ──
      if (activeRef.current && readyRef.current && !sim.igniting && dFlame < R) {
        sim.igniting = true;
        sim.igniteT = 0;
        sim.fxPx = flameX;
        sim.fyPx = flameY;
      }
      if (sim.igniting) sim.igniteT += dt;
      const it = sim.igniteT;

      // ── Tư thế ──
      const near = sim.igniting ? 1 : clamp01((2.4 * R - dFlame) / (1.3 * R));
      sim.reach = lerp(sim.reach, near, ease(6, dt));
      sim.walk = lerp(sim.walk, clamp01(speed / 120), ease(8, dt));
      sim.phase += dt * (8 + 5 * sim.walk);
      if (speed > 25) sim.faceTarget = sim.vx >= 0 ? 1 : -1;
      else if (near > 0.2) sim.faceTarget = flameX >= px ? 1 : -1;
      sim.face = lerp(sim.face, sim.faceTarget, ease(14, dt));

      const motion = reduce ? 0.12 : 1;
      const idleBob = Math.sin(t * 2.4) * 3 * (1 - sim.walk);
      const walkBob = Math.abs(Math.sin(sim.phase)) * 7 * sim.walk;
      const bob = (idleBob + walkBob) * motion;
      const lift = sim.reach * 12 * (reduce ? 0.5 : 1);
      const dirToFlame = flameX >= px ? 1 : -1;
      const rot =
        (Math.sin(t * 1.4) * 2 * (1 - sim.walk) + clamp(sim.vx / (0.9 * W), -1, 1) * 6 * sim.walk) * motion +
        sim.reach * dirToFlame * 6 * (reduce ? 0.5 : 1);
      const skew = (Math.sin(t * 1.9) * 1.2 + Math.sin(sim.phase) * 1.6 * sim.walk) * motion;
      const squash = 1 + sim.reach * 0.035 + Math.sin(sim.phase * 2) * 0.012 * sim.walk * motion;

      const gx = px - gw / 2;
      const gy = py - gh - bob - lift;
      girl.style.width = `${gw}px`;
      girl.style.height = `${gh}px`;
      girl.style.transform =
        `translate3d(${gx.toFixed(1)}px, ${gy.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg) skewX(${skew.toFixed(2)}deg) ` +
        `scale(${(sim.face * sc).toFixed(3)}, ${(sc * squash).toFixed(3)})`;

      // Bóng dưới chân
      const sh = shadowRef.current;
      if (sh) {
        const bobN = clamp01((bob + 3) / 10);
        sh.style.width = `${gw * sc * 0.6}px`;
        sh.style.transform = `translate3d(${(px - (gw * sc * 0.6) / 2).toFixed(1)}px, ${(py - 7 * sc).toFixed(1)}px, 0) scaleX(${(1 - 0.1 * bobN).toFixed(3)})`;
        sh.style.opacity = String(0.42 - 0.12 * bobN);
      }

      // Ánh sáng ấm từ đốm lửa hắt lên váy (cường độ tăng khi lại gần)
      const glow = glowRef.current;
      if (glow) {
        const wPx = gw * sc;
        const lx = ((flameX - (px - wPx / 2)) / wPx) * 100;
        const ly = ((flameY - (py - gh * sc)) / (gh * sc)) * 100;
        const mirrored = sim.face < 0 ? 100 - lx : lx;
        const prox = clamp01(1 - dFlame / (4.8 * R));
        glow.style.setProperty('--gx', `${clamp(mirrored, -40, 140).toFixed(1)}%`);
        glow.style.setProperty('--gy', `${clamp(ly, -40, 140).toFixed(1)}%`);
        glow.style.opacity = String((0.18 + 0.82 * prox) * (reduce ? 0.8 : 0.85 + 0.15 * Math.sin(t * 9)));
      }

      // ── Gợi ý: sau 5 giây không chạm → lửa nháy mạnh + vệt sáng chỉ hướng ──
      const wantHint = !sim.igniting && activeRef.current && idle > HINT1_S ? 1 : 0;
      sim.hint = lerp(sim.hint, wantHint, ease(2.2, dt));
      const tr = trailRef.current;
      if (tr) {
        if (sim.hint > 0.02) {
          const ang = Math.atan2(flameY - reachYp, flameX - reachX);
          const len = Math.max(0, dFlame * 0.55 - 10);
          const sx = reachX + Math.cos(ang) * dFlame * 0.28;
          const sy = reachYp + Math.sin(ang) * dFlame * 0.28;
          tr.style.width = `${len.toFixed(1)}px`;
          tr.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) rotate(${ang.toFixed(3)}rad)`;
          tr.style.opacity = String(sim.hint * (reduce ? 0.55 : 0.4 + 0.3 * Math.sin(t * 3.2)));
        } else {
          tr.style.opacity = '0';
        }
      }

      // ── Chia sẻ đốm lửa với canvas chính ──
      const fl = flame;
      fl.active = true;
      fl.x = flameX;
      fl.y = flameY;
      fl.flicker = 1 + sim.hint * (reduce ? 0.4 : 1.1);
      fl.boost = sim.igniting ? clamp01(it / 0.7) : sim.reach * 0.3;

      // ── Chuỗi thắp lửa: với tay → bừng sáng → nháy sáng → sang Cảnh 2 ──
      const flash = flashRef.current;
      if (flash) {
        if (sim.igniting) {
          let o = 0;
          if (it < 0.3) o = 0;
          else if (it < 0.75) o = smoothstep(0.3, 0.75, it);
          else if (it < 0.9) o = 1;
          else o = 1 - smoothstep(0.9, 1.7, it);
          flash.style.opacity = String(o);
          flash.style.setProperty('--fx', `${((flameX / W) * 100).toFixed(1)}%`);
          flash.style.setProperty('--fy', `${((flameY / H) * 100).toFixed(1)}%`);
        } else {
          flash.style.opacity = '0';
        }
      }
      if (sim.igniting && it > 0.85 && !sim.reached) {
        sim.reached = true;
        cbRef.current.onReach();
      }
      if (sim.igniting && it > 0.95) {
        root.style.opacity = '0'; // nhân vật mờ dần khi đã sang Cảnh 2
      }
    };
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      flame.active = false;
      flame.boost = 0;
      flame.flicker = 1;
    };
  }, [flameRef]);

  /* ── Chạm / kéo (cảm ứng, chuột, bút) ── */
  const local = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active || !ready) return;
    const p = local(e);
    const c = ctl.current;
    c.down = true;
    c.target = p;
    c.keys = { l: false, r: false, u: false, d: false };
    c.lastInput = performance.now();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* bỏ qua */
    }
    if (!c.interacted) {
      c.interacted = true;
      cbRef.current.onFirstInteract();
    }
    cbRef.current.onBurst(p.x, p.y);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const c = ctl.current;
    if (!c.down) return;
    c.target = local(e);
    c.lastInput = performance.now();
  };
  const endPointer = () => {
    ctl.current.down = false;
  };

  return (
    <>
      <style>{CSS}</style>
      {/* Hình: nằm dưới lớp chữ để chữ gợi ý luôn đọc được */}
      <div ref={rootRef} className="s10g-visual" style={{ opacity: ready ? 1 : 0 }} aria-hidden>
        <div ref={probeRef} className="s10g-probe" />
        <div ref={shadowRef} className="s10g-shadow" />
        <div ref={girlRef} className="s10g-girl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={GIRL_SRC}
            alt=""
            draggable={false}
            decoding="async"
            className="s10g-img"
            onLoad={() => setReady(true)}
            onError={onImageError}
          />
          <div ref={glowRef} className="s10g-glow" />
        </div>
        <div ref={trailRef} className="s10g-trail" />
      </div>

      {/* Lớp nháy sáng khi thắp lửa — phủ trên cùng của cảnh */}
      <div ref={flashRef} className="s10g-flash" aria-hidden />

      {/* Lớp nhận điều khiển — chiếm chạm/vuốt của Cảnh 1 (không dùng để chuyển cảnh) */}
      <div
        className="s10g-input"
        style={{ pointerEvents: active && ready ? 'auto' : 'none' }}
        role="group"
        aria-label="Kéo ngón tay hoặc dùng phím mũi tên để đưa cô bé tới đốm lửa"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      />
    </>
  );
}

const CSS = `
.s10g-visual{ position:absolute; inset:0; pointer-events:none; transition:opacity .8s ease; }
.s10g-probe{ position:absolute; left:0; top:0; width:1px; height:env(safe-area-inset-top, 0px); visibility:hidden; }
.s10g-girl{
  position:absolute; left:0; top:0; transform-origin:50% 100%; will-change:transform; isolation:isolate;
  filter:drop-shadow(0 6px 18px rgba(255,120,110,.18));
}
.s10g-img{ display:block; width:100%; height:100%; user-select:none; -webkit-user-drag:none; pointer-events:none; }
.s10g-glow{
  position:absolute; inset:0; mix-blend-mode:screen; opacity:0; pointer-events:none;
  --gx:50%; --gy:30%;
  background:radial-gradient(circle at var(--gx) var(--gy), rgba(255,170,90,.95) 0%, rgba(255,110,130,.55) 28%, rgba(255,90,120,0) 62%);
  -webkit-mask-image:url(${GIRL_SRC}); mask-image:url(${GIRL_SRC});
  -webkit-mask-size:100% 100%; mask-size:100% 100%; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat;
}
.s10g-shadow{
  position:absolute; left:0; top:0; height:14px; border-radius:50%;
  background:radial-gradient(ellipse at center, rgba(0,0,0,.65) 0%, rgba(0,0,0,0) 70%); will-change:transform,opacity;
}
.s10g-trail{
  position:absolute; left:0; top:0; height:3px; border-radius:3px; transform-origin:0 50%; opacity:0; will-change:transform,opacity;
  background:linear-gradient(90deg, rgba(255,190,110,0), rgba(255,200,120,.75));
}
.s10g-trail::after{
  content:''; position:absolute; right:-2px; top:50%; width:9px; height:9px;
  border-top:3px solid rgba(255,205,130,.9); border-right:3px solid rgba(255,205,130,.9);
  transform:translateY(-50%) rotate(45deg); border-radius:1px;
}
.s10g-flash{
  position:absolute; inset:0; z-index:7; pointer-events:none; opacity:0; --fx:50%; --fy:30%;
  background:radial-gradient(circle at var(--fx) var(--fy), rgba(255,244,214,1) 0%, rgba(255,190,110,.9) 26%, rgba(255,90,110,.45) 58%, rgba(255,59,98,0) 90%);
}
.s10g-input{ position:absolute; inset:0; z-index:6; touch-action:none; cursor:grab; }
.s10g-input:active{ cursor:grabbing; }
`;
