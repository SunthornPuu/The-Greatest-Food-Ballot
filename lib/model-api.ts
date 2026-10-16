import "server-only";
import { z } from "zod";

/**
 * Raw response of POST {MODEL_API_URL}/evaluate (the team's OpenCV pipeline, server.py).
 * The pipeline promises additive changes only, so unknown fields are kept (looseObject).
 */
const Mark = z.looseObject({
  kind: z.string(), // "candidate_box" | "no_vote_box" | "stray"
  number: z.number().int().nullish(),
  label: z.string(), // "VALID" | "INVALID"
  reason: z.string().nullish(),
  confidence: z.number().nullish(),
  bbox: z.array(z.number()).nullish(),
});
const EvaluateResponse = z.object({
  output: z.number().int().min(-1).max(26),
  analysis: z.looseObject({
    verdict: z.string().nullish(),
    verdict_th: z.string().nullish(),
    reason: z.string().nullish(),
    marks: z.array(Mark).nullish(),
    boxes_detected: z.number().nullish(),
    warnings: z.array(z.string()).nullish(),
    image: z.string().nullish(), // base64 PNG, no data-URL prefix
  }),
});

/** What the rest of the app uses. `analysis` is stored as-is (minus the image) for the log. */
export type PredictResult = {
  prediction: number;
  confidence: number | null;
  scores: Record<string, number> | null;
  model_version: string | null;
  processed_image: string | null;
  analysis: Record<string, unknown> | null;
};

export class ModelError extends Error {}

const MODEL_VERSION = "clearvote-opencv";
const isMock = () => process.env.MOCK_MODEL === "true";

function headers(): Record<string, string> {
  const key = process.env.MODEL_API_KEY;
  return key ? { "X-API-Key": key } : {};
}

function baseUrl(): string {
  const url = process.env.MODEL_API_URL;
  if (!url) throw new ModelError("MODEL_API_URL is not set");
  return url.replace(/\/+$/, "");
}

/** Confidence of the mark that produced the verdict, if there is exactly one such mark. */
function verdictConfidence(output: number, marks: z.infer<typeof Mark>[]): number | null {
  if (output === -1) return null;
  const hit = marks.find((m) =>
    output === 0 ? m.kind === "no_vote_box" && m.label === "VALID" : m.kind === "candidate_box" && m.number === output,
  );
  const c = hit?.confidence;
  return typeof c === "number" && c >= 0 && c <= 1 ? c : null;
}

export function toPredictResult(body: unknown): PredictResult {
  const parsed = EvaluateResponse.safeParse(body);
  if (!parsed.success) throw new ModelError(`Bad model response: ${parsed.error.message}`);
  const { output, analysis } = parsed.data;
  const { image, ...rest } = analysis;
  return {
    prediction: output,
    confidence: verdictConfidence(output, analysis.marks ?? []),
    scores: null,
    model_version: MODEL_VERSION,
    processed_image: image ?? null,
    analysis: rest,
  };
}

export async function predict(image: Blob, signal?: AbortSignal): Promise<PredictResult> {
  if (isMock()) return mockPredict(image);

  const form = new FormData();
  form.append("image", image, "ballot.jpg");
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/evaluate?first_number=1`, { method: "POST", body: form, headers: headers(), signal });
  } catch (e) {
    throw new ModelError(`Model unreachable: ${(e as Error).message}`);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const b = body as { error?: unknown; detail?: unknown } | null;
    const msg = typeof b?.error === "string" ? b.error : typeof b?.detail === "string" ? b.detail : "";
    throw new ModelError(`Model returned ${res.status}${msg ? `: ${msg}` : ""}`);
  }
  return toPredictResult(body);
}

export async function health(): Promise<{ status: string; mock?: boolean }> {
  if (isMock()) return { status: "ok", mock: true };
  const res = await fetch(`${baseUrl()}/health`, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
  if (!res.ok || !body?.ok) throw new ModelError(`Health returned ${res.status}`);
  return { status: "ok" };
}

async function mockPredict(image: Blob): Promise<PredictResult> {
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1300));
  const roll = Math.random();
  const output = roll < 0.1 ? -1 : roll < 0.2 ? 0 : 1 + Math.floor(Math.random() * 26);
  const confidence = Math.round((0.6 + Math.random() * 0.39) * 100) / 100;
  const marks =
    output === -1
      ? [
          { kind: "candidate_box", number: 3, label: "VALID", reason: "single cross inside box", confidence: 0.9 },
          { kind: "candidate_box", number: 12, label: "VALID", reason: "single cross inside box", confidence: 0.88 },
        ]
      : output === 0
        ? [{ kind: "no_vote_box", number: null, label: "VALID", reason: "single cross inside box", confidence }]
        : [{ kind: "candidate_box", number: output, label: "VALID", reason: "single cross inside box", confidence }];
  const body = {
    output,
    analysis: {
      verdict: output === -1 ? "invalid" : output === 0 ? "no_vote" : "valid",
      reason: output === -1 ? "2 boxes marked (box #3, box #12) [mock]" : `mock verdict ${output}`,
      marks,
      boxes_detected: 27,
      warnings: [],
      image:
        process.env.MOCK_PROCESSED === "true" ? Buffer.from(await image.arrayBuffer()).toString("base64") : null,
    },
  };
  return toPredictResult(body);
}
