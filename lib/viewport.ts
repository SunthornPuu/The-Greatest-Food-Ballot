import { BALLOT, type Box } from "./ballot-geometry";

/** screen = ballot * scale + (x, y), in CSS px relative to the canvas container. */
export type View = { scale: number; x: number; y: number };
export type Size = { w: number; h: number };

export const ZOOM_MIN = 0.5; // relative to fit
export const ZOOM_MAX = 4;
const PAD = 12;

export function fitScale(c: Size): number {
  return Math.max(0.01, Math.min((c.w - PAD * 2) / BALLOT.width, (c.h - PAD * 2) / BALLOT.height));
}

export function fitView(c: Size): View {
  const scale = fitScale(c);
  return { scale, x: (c.w - BALLOT.width * scale) / 2, y: (c.h - BALLOT.height * scale) / 2 };
}

export function screenToBallot(v: View, sx: number, sy: number): [number, number] {
  return [(sx - v.x) / v.scale, (sy - v.y) / v.scale];
}

export function ballotToScreen(v: View, bx: number, by: number): [number, number] {
  return [bx * v.scale + v.x, by * v.scale + v.y];
}

export function clampScale(scale: number, c: Size): number {
  const f = fitScale(c);
  return Math.min(f * ZOOM_MAX, Math.max(f * ZOOM_MIN, scale));
}

/** Keep part of the ballot on screen: it may not be dragged fully out of view. */
export function clampView(v: View, c: Size): View {
  const w = BALLOT.width * v.scale;
  const h = BALLOT.height * v.scale;
  const keep = 80;
  const x = Math.min(Math.max(v.x, keep - w), c.w - keep);
  const y = Math.min(Math.max(v.y, keep - h), c.h - keep);
  return { scale: v.scale, x, y };
}

/** Zoom by `factor` keeping the screen point (px, py) fixed. */
export function zoomAt(v: View, factor: number, px: number, py: number, c: Size): View {
  const scale = clampScale(v.scale * factor, c);
  const k = scale / v.scale;
  return clampView({ scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k }, c);
}

/** Pinch: the ballot point that was under `startMid` follows `mid`, scaled by dist ratio. */
export function pinchView(
  start: View,
  startMid: [number, number],
  startDist: number,
  mid: [number, number],
  dist: number,
  c: Size,
): View {
  const scale = clampScale(start.scale * (dist / Math.max(1, startDist)), c);
  const [bx, by] = screenToBallot(start, startMid[0], startMid[1]);
  return clampView({ scale, x: mid[0] - bx * scale, y: mid[1] - by * scale }, c);
}

/** Camera framing a mark box with some context around it (used by the reveal). */
export function focusBoxView(box: Box, c: Size): View {
  const scale = clampScale(Math.min(c.w / (box.w * 3.2), c.h / (box.h * 4.5)), c);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return { scale, x: c.w / 2 - cx * scale, y: c.h / 2 - cy * scale };
}

export function lerpView(a: View, b: View, t: number): View {
  return { scale: a.scale + (b.scale - a.scale) * t, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
