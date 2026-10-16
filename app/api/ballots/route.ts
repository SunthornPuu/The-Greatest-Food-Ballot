import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { BALLOT } from "@/lib/ballot-geometry";
import { jpegSize } from "@/lib/jpeg";
import { ModelError, predict } from "@/lib/model-api";
import { decodeProcessedImage } from "@/lib/processed-image";
import { rateLimited } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BUCKET, type BallotRow, type CastResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // stay under Vercel's 4.5 MB body limit
const Nickname = z.string().trim().max(24).optional();

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/**
 * Dev only, when Supabase isn't configured: ask the model, return a row-shaped result, save nothing.
 * Lets the Booth be tried end to end before the database exists.
 */
async function dryRun(imageBytes: Uint8Array<ArrayBuffer>, nickname: string | null) {
  const t0 = performance.now();
  let result;
  try {
    result = await predict(new Blob([imageBytes], { type: "image/jpeg" }));
  } catch (e) {
    console.error("[ballots] dry run predict failed:", (e as Error).message);
    return fail(502, "The counting machine jammed. Your ballot wasn't counted, try again.");
  }
  const processed = decodeProcessedImage(result.processed_image);
  const row: CastResult = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    image_path: "",
    thumb_path: "",
    processed_path: null,
    prediction: result.prediction,
    confidence: result.confidence ?? null,
    scores: result.scores ?? null,
    model_version: result.model_version ?? null,
    latency_ms: Math.round(performance.now() - t0),
    nickname,
    feedback: null,
    analysis: result.analysis as CastResult["analysis"],
    saved: false,
    processed_data_url: processed
      ? `data:${processed.mime};base64,${Buffer.from(processed.bytes).toString("base64")}`
      : null,
  };
  return NextResponse.json(row, { status: 200 });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return fail(429, "Easy there! Max 10 ballots a minute.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "Expected multipart/form-data.");
  }
  const image = form.get("image");
  const thumb = form.get("thumb");
  if (!(image instanceof Blob) || !(thumb instanceof Blob)) return fail(400, "Fields 'image' and 'thumb' are required.");
  if (image.size + thumb.size > MAX_TOTAL_BYTES) return fail(413, "Ballot images are too large.");

  const imageBytes = new Uint8Array(await image.arrayBuffer());
  const thumbBytes = new Uint8Array(await thumb.arrayBuffer());
  const size = jpegSize(imageBytes);
  if (!size || size.width !== BALLOT.width || size.height !== BALLOT.height) {
    return fail(400, `'image' must be a ${BALLOT.width}×${BALLOT.height} JPEG.`);
  }
  if (!jpegSize(thumbBytes)) return fail(400, "'thumb' must be a JPEG.");

  const nick = Nickname.safeParse(form.get("nickname") ?? undefined);
  if (!nick.success) return fail(400, "Nickname must be 24 characters or fewer.");
  const nickname = nick.data || null;

  let db: ReturnType<typeof supabaseAdmin>;
  try {
    db = supabaseAdmin();
  } catch (e) {
    if (process.env.NODE_ENV !== "production") return dryRun(imageBytes, nickname);
    console.error("[ballots]", (e as Error).message);
    return fail(500, "The ballot box isn't set up yet (server config).");
  }
  const storage = db.storage.from(BUCKET);
  const id = crypto.randomUUID();
  const image_path = `full/${id}.jpg`;
  const thumb_path = `thumb/${id}.jpg`;
  const jpeg = { contentType: "image/jpeg", upsert: false } as const;

  const t0 = performance.now();
  const timedPredict = predict(new Blob([imageBytes], { type: "image/jpeg" })).then((r) => ({
    result: r,
    latency_ms: Math.round(performance.now() - t0),
  }));
  const [pred, upFull, upThumb] = await Promise.allSettled([
    timedPredict,
    storage.upload(image_path, imageBytes, jpeg),
    storage.upload(thumb_path, thumbBytes, jpeg),
  ]);

  const uploaded = (r: typeof upFull) => r.status === "fulfilled" && !r.value.error;
  const cleanup = async (extra: string[] = []) => {
    const paths = [uploaded(upFull) && image_path, uploaded(upThumb) && thumb_path, ...extra].filter(
      (p): p is string => typeof p === "string",
    );
    if (paths.length) await storage.remove(paths).catch(() => {});
  };

  if (pred.status === "rejected") {
    await cleanup();
    const msg = pred.reason instanceof ModelError ? pred.reason.message : String(pred.reason);
    console.error("[ballots] predict failed:", msg);
    return fail(502, "The counting machine jammed. Your ballot wasn't counted, try again.");
  }
  if (!uploaded(upFull) || !uploaded(upThumb)) {
    await cleanup();
    console.error("[ballots] upload failed", upFull, upThumb);
    return fail(500, "Couldn't store the ballot. Try again.");
  }

  const { result, latency_ms } = pred.value;

  // The model's own image is a bonus: if it's missing or broken, we still keep the ballot.
  let processed_path: string | null = null;
  const processed = decodeProcessedImage(result.processed_image);
  if (result.processed_image && !processed) console.warn("[ballots] processed_image could not be decoded");
  if (processed) {
    const path = `processed/${id}.${processed.ext}`;
    const { error } = await storage.upload(path, processed.bytes, { contentType: processed.mime, upsert: false });
    if (error) console.warn("[ballots] processed upload failed:", error.message);
    else processed_path = path;
  }

  const row = {
    id,
    image_path,
    thumb_path,
    processed_path,
    prediction: result.prediction,
    confidence: result.confidence ?? null,
    scores: result.scores ?? null,
    model_version: result.model_version ?? null,
    latency_ms,
    nickname,
    analysis: result.analysis,
  };
  const { data, error } = await db.from("ballots").insert(row).select().single<BallotRow>();
  if (error) {
    await cleanup(processed_path ? [processed_path] : []);
    console.error("[ballots] insert failed:", error.message);
    return fail(500, "Couldn't record the ballot. Try again.");
  }
  return NextResponse.json(data, { status: 201 });
}
