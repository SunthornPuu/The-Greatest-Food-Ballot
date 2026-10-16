import { describe, expect, it } from "vitest";
import { BALLOT, markBox } from "@/lib/ballot-geometry";
import { strokeHit, type Stroke } from "@/lib/ink";
import {
  ballotToScreen,
  fitView,
  focusBoxView,
  pinchView,
  screenToBallot,
  zoomAt,
  type View,
} from "@/lib/viewport";

const phone = { w: 390, h: 640 };
const desktop = { w: 1100, h: 860 };

function inside(b: { x: number; y: number; w: number; h: number }, [x, y]: [number, number]) {
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

/** Simulate a user drawing an X over where box `n` appears on screen, at view `v`. */
function drawXOnScreen(v: View, n: number): [number, number][] {
  const b = markBox(n)!;
  const [l, t] = ballotToScreen(v, b.x + b.w * 0.2, b.y + b.h * 0.2);
  const [r, bot] = ballotToScreen(v, b.x + b.w * 0.8, b.y + b.h * 0.8);
  const screen: [number, number][] = [];
  for (let i = 0; i <= 10; i++) screen.push([l + ((r - l) * i) / 10, t + ((bot - t) * i) / 10]);
  for (let i = 0; i <= 10; i++) screen.push([r - ((r - l) * i) / 10, t + ((bot - t) * i) / 10]);
  // what the canvas stores: screen → ballot coordinates
  return screen.map(([sx, sy]) => screenToBallot(v, sx, sy));
}

describe("viewport", () => {
  it("fit shows the whole ballot centered", () => {
    for (const c of [phone, desktop]) {
      const v = fitView(c);
      const [x0, y0] = ballotToScreen(v, 0, 0);
      const [x1, y1] = ballotToScreen(v, BALLOT.width, BALLOT.height);
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(y0).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(c.w + 0.001);
      expect(y1).toBeLessThanOrEqual(c.h + 0.001);
    }
  });

  it("screen↔ballot round-trips at any zoom/pan", () => {
    let v = fitView(phone);
    for (const [k, px, py] of [[2, 100, 300], [1.7, 300, 50], [0.6, 200, 200], [3, 10, 600]] as const) {
      v = zoomAt(v, k, px, py, phone);
      const [bx, by] = screenToBallot(v, 123, 456);
      const [sx, sy] = ballotToScreen(v, bx, by);
      expect(sx).toBeCloseTo(123, 6);
      expect(sy).toBeCloseTo(456, 6);
    }
  });

  it("zoomAt keeps the point under the cursor fixed", () => {
    const v0 = fitView(desktop);
    const before = screenToBallot(v0, 400, 300);
    const v1 = zoomAt(v0, 2, 400, 300, desktop);
    const after = screenToBallot(v1, 400, 300);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });

  it("zoom is clamped to 0.5×–4× of fit", () => {
    const f = fitView(phone).scale;
    expect(zoomAt(fitView(phone), 100, 0, 0, phone).scale).toBeCloseTo(f * 4, 9);
    expect(zoomAt(fitView(phone), 0.001, 0, 0, phone).scale).toBeCloseTo(f * 0.5, 9);
  });
});

describe("strokes land at the same native coordinates regardless of zoom", () => {
  const views: Record<string, View> = {
    "phone fit": fitView(phone),
    "phone 4× zoomed on box 20": zoomAt(focusBoxView(markBox(20)!, phone), 1.3, 195, 320, phone),
    "desktop fit": fitView(desktop),
    "desktop zoomed + panned": zoomAt(fitView(desktop), 3, 700, 200, desktop),
    "pinched": pinchView(fitView(phone), [195, 320], 100, [150, 300], 260, phone),
  };
  for (const [name, v] of Object.entries(views)) {
    it(`${name}: an X over box 5, 20 and abstain lands inside that box`, () => {
      for (const n of [5, 20, 0]) {
        for (const p of drawXOnScreen(v, n)) expect(inside(markBox(n)!, p)).toBe(true);
      }
    });
  }

  it("same X gives the same native points at different zooms", () => {
    const a = drawXOnScreen(fitView(phone), 13);
    const b = drawXOnScreen(zoomAt(fitView(phone), 3.5, 50, 600, phone), 13);
    a.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(b[i]![0], 6);
      expect(p[1]).toBeCloseTo(b[i]![1], 6);
    });
  });
});

describe("eraser", () => {
  const s: Stroke = { id: "a", color: "#000", size: 10, hasPressure: false, points: [[100, 100, 0.5], [200, 100, 0.5]] };
  it("hits on and near the stroke, misses far away", () => {
    expect(strokeHit(s, 150, 100, 5)).toBe(true);
    expect(strokeHit(s, 150, 108, 5)).toBe(true); // within radius + half width
    expect(strokeHit(s, 150, 130, 5)).toBe(false);
    expect(strokeHit(s, 260, 100, 5)).toBe(false);
  });
});
