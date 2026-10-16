import { BALLOT } from "@/lib/ballot-geometry";
import { strokePath, type Stroke } from "@/lib/ink";

export const THUMB_WIDTH = 600;
const THUMB_HEIGHT = Math.round((THUMB_WIDTH * BALLOT.height) / BALLOT.width); // 720

let ballotImage: Promise<HTMLImageElement> | null = null;

function loadBallot(): Promise<HTMLImageElement> {
  ballotImage ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      ballotImage = null;
      reject(new Error("Couldn't load ballot.jpg"));
    };
    img.src = "/ballot.jpg";
  });
  return ballotImage;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))), "image/jpeg", quality),
  );
}

/**
 * The submitted image: ballot.jpg at native 2400×2880 with the strokes replayed on top,
 * and nothing else (no UI, zoom or padding). Plus a 600 px wide thumbnail.
 */
export async function exportBallot(strokes: Stroke[]): Promise<{ image: Blob; thumb: Blob }> {
  const img = await loadBallot();
  const full = document.createElement("canvas");
  full.width = BALLOT.width;
  full.height = BALLOT.height;
  const ctx = full.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, BALLOT.width, BALLOT.height);
  for (const s of strokes) {
    ctx.fillStyle = s.color;
    ctx.fill(new Path2D(strokePath(s)));
  }

  const small = document.createElement("canvas");
  small.width = THUMB_WIDTH;
  small.height = THUMB_HEIGHT;
  const sctx = small.getContext("2d");
  if (!sctx) throw new Error("Canvas not supported");
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(full, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);

  const [image, thumb] = await Promise.all([toJpeg(full, 0.9), toJpeg(small, 0.8)]);
  return { image, thumb };
}
