"use client";
import { supabaseBrowser } from "./supabase/client";
import type { BallotRow } from "./types";

export const PAGE_SIZE = 24;

export const FILTERS = [
  { id: "all", label: "All" },
  { id: "voted", label: "Voted" },
  { id: "abstained", label: "Abstained" },
  { id: "spoiled", label: "Spoiled" },
  { id: "wrong", label: "👎 Model wrong" },
] as const;
export type FilterId = (typeof FILTERS)[number]["id"];

export type LogFilter = { kind: FilterId; dish: number | null };

export const COLUMNS =
  "id,created_at,image_path,thumb_path,processed_path,prediction,confidence,scores,model_version,latency_ms,nickname,feedback,analysis";

export function parseFilter(params: URLSearchParams): LogFilter {
  const f = params.get("f");
  const kind = (FILTERS.some((x) => x.id === f) ? f : "all") as FilterId;
  const d = Number(params.get("dish"));
  return { kind, dish: Number.isInteger(d) && d >= 1 && d <= 26 ? d : null };
}

/** Does a row belong in the current view? (Used for realtime inserts/updates.) */
export function matches(row: BallotRow, f: LogFilter): boolean {
  if (f.dish != null && row.prediction !== f.dish) return false;
  switch (f.kind) {
    case "voted":
      return row.prediction >= 1;
    case "abstained":
      return row.prediction === 0;
    case "spoiled":
      return row.prediction === -1;
    case "wrong":
      return row.feedback === -1;
    default:
      return true;
  }
}

/** The filter as PostgREST conditions. */
function conditions(f: LogFilter): ["eq" | "gte", string, number][] {
  const c: ["eq" | "gte", string, number][] = [];
  if (f.dish != null) c.push(["eq", "prediction", f.dish]);
  if (f.kind === "voted") c.push(["gte", "prediction", 1]);
  if (f.kind === "abstained") c.push(["eq", "prediction", 0]);
  if (f.kind === "spoiled") c.push(["eq", "prediction", -1]);
  if (f.kind === "wrong") c.push(["eq", "feedback", -1]);
  return c;
}

/** One page, newest first. `before` is the created_at of the last row already shown (cursor). */
export async function fetchPage(f: LogFilter, before: string | null): Promise<BallotRow[]> {
  const db = supabaseBrowser();
  if (!db) throw new Error("Supabase isn't configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).");
  let q = db.from("ballots").select(COLUMNS);
  for (const [op, col, v] of conditions(f)) q = op === "eq" ? q.eq(col, v) : q.gte(col, v);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(PAGE_SIZE);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BallotRow[];
}

export async function fetchCount(f: LogFilter): Promise<number | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  let q = db.from("ballots").select("id", { count: "exact", head: true });
  for (const [op, col, v] of conditions(f)) q = op === "eq" ? q.eq(col, v) : q.gte(col, v);
  const { count, error } = await q;
  return error ? null : count;
}

export async function fetchOne(id: string): Promise<BallotRow | null> {
  const db = supabaseBrowser();
  if (!db) return null;
  const { data } = await db.from("ballots").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as unknown as BallotRow | null) ?? null;
}
