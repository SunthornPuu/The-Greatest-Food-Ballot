export type BallotRow = {
  id: string;
  created_at: string;
  image_path: string;
  thumb_path: string;
  processed_path: string | null;
  prediction: number;
  confidence: number | null;
  scores: Record<string, number> | null;
  model_version: string | null;
  latency_ms: number | null;
  /** Pipeline details: { verdict, reason, marks[], boxes_detected, warnings } */
  analysis: { verdict?: string; reason?: string; marks?: unknown[]; warnings?: string[] } | null;
  nickname: string | null;
  feedback: -1 | 1 | null;
};

/** POST /api/ballots response: the row, or (dev without Supabase) an unsaved dry-run result. */
export type CastResult = BallotRow & { saved?: false; processed_data_url?: string | null };

export type RankingRow = { candidate: number; votes: number };
export type BallotStats = { total: number; abstained: number; spoiled: number; avg_latency_ms: number | null };

export const BUCKET = "ballots";

/** Public URL for a file in the ballots bucket. Safe on client and server. */
export function storageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}
