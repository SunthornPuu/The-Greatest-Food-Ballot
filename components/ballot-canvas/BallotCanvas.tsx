"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { BALLOT, type Box } from "@/lib/ballot-geometry";
import { newStrokeId, strokeHit, strokePath, type Stroke } from "@/lib/ink";
import {
  clampView,
  fitScale,
  fitView,
  focusBoxView,
  lerpView,
  pinchView,
  screenToBallot,
  zoomAt,
  type Size,
  type View,
} from "@/lib/viewport";

export type Tool = { kind: "pen"; color: string; size: number } | { kind: "eraser" } | { kind: "pan" };

export type BallotCanvasHandle = {
  fit: (ms?: number) => void;
  focusBox: (box: Box, ms?: number) => void;
};

type Props = {
  strokes: Stroke[];
  tool: Tool;
  /** Drawing/erasing disabled (pan & zoom still work). */
  readOnly?: boolean;
  onAddStroke: (s: Stroke) => void;
  onEraseIds: (ids: Set<string>) => void;
  onInteract?: () => void;
  /** Extra SVG drawn in ballot coordinates, above the ink (e.g. the reveal ring). */
  overlay?: ReactNode;
  reducedMotion?: boolean;
  className?: string;
  /** Base image, drawn at 2400×2880 (default: the blank ballot). Used by the Log viewer. */
  src?: string;
  /** Accessible name of the base image when it carries meaning (e.g. a submitted ballot). */
  imageAlt?: string;
};

type Gesture =
  | { mode: "none" }
  | { mode: "draw"; stroke: Stroke; t0: number; sx: number; sy: number; moved: number }
  | { mode: "erase"; ids: Set<string> }
  | { mode: "pan"; start: View; sx: number; sy: number; t0: number; moved: number }
  | { mode: "pinch"; start: View; mid: [number, number]; dist: number }
  | { mode: "wait" }; // a pinch ended with one finger still down: ignore it

const ERASER_RADIUS_PX = 14; // screen px
const TAP_MS = 250;
const TAP_MOVE_PX = 8;
const DOUBLE_TAP_MS = 320;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const BallotCanvas = forwardRef<BallotCanvasHandle, Props>(function BallotCanvas(
  { strokes, tool, readOnly, onAddStroke, onEraseIds, onInteract, overlay, reducedMotion, className, src, imageAlt },
  ref,
) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [view, setViewState] = useState<View>({ scale: 0.1, x: 0, y: 0 });
  const viewRef = useRef(view);
  const sizeRef = useRef(size);
  const userMoved = useRef(false);
  const anim = useRef<number | null>(null);
  const pointers = useRef(new Map<number, [number, number]>());
  const gesture = useRef<Gesture>({ mode: "none" });
  const rect = useRef<DOMRect | null>(null);
  const space = useRef(false);
  const pendingTap = useRef<{ t: number; x: number; y: number; stroke: Stroke | null; timer: number } | null>(null);
  const [live, setLive] = useState<Stroke | null>(null);
  const [erasing, setErasing] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<[number, number] | null>(null);

  const setView = useCallback((v: View) => {
    viewRef.current = v;
    setViewState(v);
  }, []);

  const stopAnim = () => {
    if (anim.current != null) cancelAnimationFrame(anim.current);
    anim.current = null;
  };

  const animateTo = useCallback(
    (target: View, ms: number) => {
      stopAnim();
      if (ms <= 0 || reducedMotion) return setView(target);
      const from = viewRef.current;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        setView(lerpView(from, target, ease(t)));
        anim.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      anim.current = requestAnimationFrame(step);
    },
    [reducedMotion, setView],
  );

  useImperativeHandle(
    ref,
    () => ({
      fit: (ms = 300) => {
        userMoved.current = false;
        animateTo(fitView(sizeRef.current), ms);
      },
      focusBox: (b, ms = 900) => {
        userMoved.current = true;
        animateTo(focusBoxView(b, sizeRef.current), ms);
      },
    }),
    [animateTo],
  );

  // Track container size; refit until the user zooms or pans.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const s = { w: entry.contentRect.width, h: entry.contentRect.height };
      sizeRef.current = s;
      setSize(s);
      setView(userMoved.current ? clampView(viewRef.current, s) : fitView(s));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setView]);

  // Wheel / trackpad zoom (needs a non-passive listener to stop page zoom/scroll).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopAnim();
      const r = el.getBoundingClientRect();
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      userMoved.current = true;
      setView(zoomAt(viewRef.current, k, e.clientX - r.left, e.clientY - r.top, sizeRef.current));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setView]);

  // Hold space to pan with the mouse.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON");
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !typing(e)) {
        space.current = true;
        if (e.target === box.current) e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") space.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = rect.current ?? box.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const toggleZoom = (x: number, y: number) => {
    const v = viewRef.current;
    const f = fitScale(sizeRef.current);
    if (v.scale < f * 1.8) {
      userMoved.current = true;
      animateTo(zoomAt(v, (f * 2.6) / v.scale, x, y, sizeRef.current), 250);
    } else {
      userMoved.current = false;
      animateTo(fitView(sizeRef.current), 250);
    }
  };

  const flushPendingTap = () => {
    const p = pendingTap.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingTap.current = null;
    if (p.stroke) onAddStroke(p.stroke);
  };

  /** A quick tap: wait briefly to see if it's a double tap before committing its dot. */
  const handleTap = (x: number, y: number, stroke: Stroke | null) => {
    const p = pendingTap.current;
    const now = performance.now();
    if (p && now - p.t < DOUBLE_TAP_MS && Math.hypot(p.x - x, p.y - y) < 30) {
      clearTimeout(p.timer);
      pendingTap.current = null; // drop both dots
      toggleZoom(x, y);
      return;
    }
    flushPendingTap();
    const timer = window.setTimeout(flushPendingTap, DOUBLE_TAP_MS);
    pendingTap.current = { t: now, x, y, stroke, timer };
  };

  const erasePoint = (sx: number, sy: number, ids: Set<string>) => {
    const v = viewRef.current;
    const [bx, by] = screenToBallot(v, sx, sy);
    const r = ERASER_RADIUS_PX / v.scale;
    let changed = false;
    for (const s of strokes) {
      if (!ids.has(s.id) && strokeHit(s, bx, by, r)) {
        ids.add(s.id);
        changed = true;
      }
    }
    if (changed) setErasing(new Set(ids));
  };

  const addPoints = (g: Extract<Gesture, { mode: "draw" }>, e: React.PointerEvent) => {
    const evs = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    const list = evs.length ? evs : [e.nativeEvent];
    const v = viewRef.current;
    for (const ev of list) {
      const [sx, sy] = local(ev);
      const [bx, by] = screenToBallot(v, sx, sy);
      const pressure = g.stroke.hasPressure ? ev.pressure || 0.5 : 0.5;
      g.stroke.points.push([bx, by, pressure]);
      g.moved = Math.max(g.moved, Math.hypot(sx - g.sx, sy - g.sy));
    }
    setLive({ ...g.stroke, points: [...g.stroke.points] });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return;
    stopAnim();
    onInteract?.();
    box.current?.focus({ preventScroll: true });
    rect.current = box.current!.getBoundingClientRect();
    box.current!.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size === 2) {
      // Second finger: cancel any stroke in progress and pinch instead.
      setLive(null);
      setErasing(new Set());
      const [a, b] = [...pointers.current.values()] as [[number, number], [number, number]];
      gesture.current = {
        mode: "pinch",
        start: viewRef.current,
        mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        dist: Math.hypot(a[0] - b[0], a[1] - b[1]),
      };
      userMoved.current = true;
      return;
    }
    if (pointers.current.size > 2) return;

    const panning = tool.kind === "pan" || e.button === 1 || space.current || readOnly;
    if (panning) {
      gesture.current = { mode: "pan", start: viewRef.current, sx: p[0], sy: p[1], t0: performance.now(), moved: 0 };
    } else if (tool.kind === "eraser") {
      const ids = new Set<string>();
      gesture.current = { mode: "erase", ids };
      erasePoint(p[0], p[1], ids);
    } else if (tool.kind === "pen") {
      const hasPressure = e.pointerType === "pen";
      const [bx, by] = screenToBallot(viewRef.current, p[0], p[1]);
      const stroke: Stroke = {
        id: newStrokeId(),
        color: tool.color,
        size: tool.size,
        hasPressure,
        points: [[bx, by, hasPressure ? e.pressure : 0.5]],
      };
      gesture.current = { mode: "draw", stroke, t0: performance.now(), sx: p[0], sy: p[1], moved: 0 };
      setLive(stroke);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) {
      if (e.pointerType === "mouse" && tool.kind === "eraser") setHover(local(e));
      return;
    }
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (g.mode === "draw") addPoints(g, e);
    else if (g.mode === "erase") {
      erasePoint(p[0], p[1], g.ids);
      if (e.pointerType === "mouse") setHover(p);
    } else if (g.mode === "pan") {
      g.moved = Math.max(g.moved, Math.hypot(p[0] - g.sx, p[1] - g.sy));
      if (g.moved > TAP_MOVE_PX) userMoved.current = true;
      setView(clampView({ ...g.start, x: g.start.x + p[0] - g.sx, y: g.start.y + p[1] - g.sy }, sizeRef.current));
    } else if (g.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [[number, number], [number, number]];
      setView(
        pinchView(g.start, g.mid, g.dist, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], Math.hypot(a[0] - b[0], a[1] - b[1]), sizeRef.current),
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    const quick = (t0: number, moved: number) => performance.now() - t0 < TAP_MS && moved < TAP_MOVE_PX;
    const p = local(e);

    if (g.mode === "draw") {
      setLive(null);
      if (e.type === "pointercancel") {
        // dropped (e.g. the OS took the gesture)
      } else if (quick(g.t0, g.moved)) handleTap(p[0], p[1], g.stroke);
      else {
        flushPendingTap();
        onAddStroke(g.stroke);
      }
    } else if (g.mode === "erase") {
      onEraseIds(g.ids);
      setErasing(new Set());
    } else if (g.mode === "pan" && quick(g.t0, g.moved)) {
      handleTap(p[0], p[1], null);
    }

    gesture.current = pointers.current.size ? { mode: "wait" } : { mode: "none" };
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = sizeRef.current;
    const v = viewRef.current;
    const step = 60;
    const keys: Record<string, () => void> = {
      "+": () => setView(zoomAt(v, 1.25, s.w / 2, s.h / 2, s)),
      "=": () => setView(zoomAt(v, 1.25, s.w / 2, s.h / 2, s)),
      "-": () => setView(zoomAt(v, 0.8, s.w / 2, s.h / 2, s)),
      "0": () => animateTo(fitView(s), 200),
      ArrowLeft: () => setView(clampView({ ...v, x: v.x + step }, s)),
      ArrowRight: () => setView(clampView({ ...v, x: v.x - step }, s)),
      ArrowUp: () => setView(clampView({ ...v, y: v.y + step }, s)),
      ArrowDown: () => setView(clampView({ ...v, y: v.y - step }, s)),
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      userMoved.current = e.key !== "0";
      fn();
    }
  };

  const cursor =
    readOnly || tool.kind === "pan" ? "grab" : tool.kind === "eraser" ? (hover ? "none" : "cell") : "crosshair";

  return (
    <div
      ref={box}
      tabIndex={0}
      role="application"
      aria-roledescription={readOnly && !strokes.length ? "zoomable image" : "drawing canvas"}
      aria-label={
        readOnly && !strokes.length
          ? "Ballot image. Pinch or scroll to zoom, drag to pan. Keys: plus and minus zoom, arrows pan, 0 fits."
          : "Ballot. Draw with one finger, mouse or pen. Pinch or scroll to zoom. Keys: plus and minus zoom, arrows pan, 0 fits."
      }
      className={`relative touch-none select-none overflow-hidden outline-offset-[-3px] ${className ?? ""}`}
      style={{ touchAction: "none", cursor, WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {size.w > 0 && (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: BALLOT.width,
            height: BALLOT.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            boxShadow: `${6 / view.scale}px ${6 / view.scale}px 0 var(--shadow)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- must stay the native 2400×2880 file */}
          <img
            src={src ?? "/ballot.jpg"}
            width={BALLOT.width}
            height={BALLOT.height}
            alt={imageAlt ?? ""}
            draggable={false}
            className="pointer-events-none block h-full w-full"
          />
          <svg
            viewBox={`0 0 ${BALLOT.width} ${BALLOT.height}`}
            width={BALLOT.width}
            height={BALLOT.height}
            className="pointer-events-none absolute inset-0"
            aria-hidden
          >
            {strokes.map((s) => (
              <path key={s.id} d={strokePath(s)} fill={s.color} opacity={erasing.has(s.id) ? 0.25 : 1} />
            ))}
            {live && <path d={strokePath(live, false)} fill={live.color} />}
            {overlay}
          </svg>
        </div>
      )}
      {hover && tool.kind === "eraser" && (
        <div
          className="pointer-events-none absolute rounded-full border-2 border-ink bg-white/40"
          style={{
            width: ERASER_RADIUS_PX * 2,
            height: ERASER_RADIUS_PX * 2,
            left: hover[0] - ERASER_RADIUS_PX,
            top: hover[1] - ERASER_RADIUS_PX,
          }}
        />
      )}
    </div>
  );
});
