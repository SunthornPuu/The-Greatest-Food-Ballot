export const BALLOT = { width: 2400, height: 2880 };
const ROW_TOP_0 = 679, ROW_PITCH = 142, ROW_H = 124;
const COL_LEFT = { x: 841, w: 241 };   // candidates 1–13
const COL_RIGHT = { x: 1979, w: 240 }; // candidates 14–26

export type Box = { x: number; y: number; w: number; h: number };

/** UI effects only (highlights, zoom, overlays). Never use to guess or override the model. */
export function markBox(candidate: number): Box | null {
  if (candidate === 0) return { x: 1693, y: 2698, w: 240, h: 123 }; // abstain box
  if (candidate < 1 || candidate > 26) return null;
  const col = candidate <= 13 ? COL_LEFT : COL_RIGHT;
  const row = (candidate - 1) % 13;
  return { x: col.x, y: ROW_TOP_0 + row * ROW_PITCH, w: col.w, h: ROW_H };
}
// Dish-name cells sit to the left of each mark box: left x≈437–822, right x≈1574–1960.
