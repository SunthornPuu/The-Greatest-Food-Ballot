import { getStroke } from "perfect-freehand";

/** One stroke, in native ballot coordinates (2400×2880). Point = [x, y, pressure]. */
export type Stroke = {
  id: string;
  color: string;
  size: number;
  hasPressure: boolean;
  points: [number, number, number][];
};

export const PEN_COLORS = [
  { id: "ballpoint", label: "Ballpoint blue", value: "#1F3FBF" },
  { id: "ink", label: "Ink black", value: "#140710" },
  { id: "hot", label: "Hot pink", value: "#FF65C3" },
] as const;

/** Native px. Thin is sized for an X inside a 240×124 mark box. */
export const PEN_SIZES = [
  { id: "thin", label: "Thin", value: 10 },
  { id: "medium", label: "Medium", value: 18 },
  { id: "thick", label: "Thick", value: 32 },
] as const;

export function strokeOutline(s: Stroke, complete = true): number[][] {
  return getStroke(s.points, {
    size: s.size,
    thinning: s.hasPressure ? 0.6 : 0.45,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: !s.hasPressure,
    last: complete,
  });
}

const avg = (a: number, b: number) => (a + b) / 2;

/** perfect-freehand outline → SVG path data (quadratic smoothing). */
export function outlineToPath(pts: number[][]): string {
  const n = pts.length;
  if (n < 4) {
    if (!n) return "";
    const [x, y] = pts[0]!;
    return `M${x},${y}Z`;
  }
  const p = (i: number) => pts[i]!;
  let d = `M${p(0)[0]!.toFixed(1)},${p(0)[1]!.toFixed(1)} Q${p(1)[0]!.toFixed(1)},${p(1)[1]!.toFixed(1)} ${avg(p(1)[0]!, p(2)[0]!).toFixed(1)},${avg(p(1)[1]!, p(2)[1]!).toFixed(1)} T`;
  for (let i = 2; i < n - 1; i++) {
    d += `${avg(p(i)[0]!, p(i + 1)[0]!).toFixed(1)},${avg(p(i)[1]!, p(i + 1)[1]!).toFixed(1)} `;
  }
  return d + "Z";
}

export function strokePath(s: Stroke, complete = true): string {
  return outlineToPath(strokeOutline(s, complete));
}

/** Does a circle at (x, y) with radius r (ballot px) touch this stroke? */
export function strokeHit(s: Stroke, x: number, y: number, r: number): boolean {
  const rr = (r + s.size / 2) ** 2;
  const pts = s.points;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1] ?? a;
    // distance from point to segment a-b
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len)) : 0;
    const px = a[0] + t * dx - x;
    const py = a[1] + t * dy - y;
    if (px * px + py * py <= rr) return true;
  }
  return false;
}

export function newStrokeId(): string {
  return Math.random().toString(36).slice(2, 10);
}
