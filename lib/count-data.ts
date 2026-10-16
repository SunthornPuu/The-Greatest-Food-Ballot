import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CANDIDATES } from "./candidates";
import type { BallotStats, RankingRow } from "./types";

export type RaceEntry = { candidate: number; votes: number };
export type TickerEvent = { id: string; created_at: string; prediction: number };
export type CountData = {
  race: RaceEntry[]; // all 26, ranked
  stats: BallotStats;
  recent: TickerEvent[];
  configured: boolean;
};

export const EMPTY_STATS: BallotStats = { total: 0, abstained: 0, spoiled: 0, avg_latency_ms: null };

/** Merge the rankings view with every candidate (0-vote dishes still race), ranked. */
export function rankRace(rows: RankingRow[]): RaceEntry[] {
  const votes = new Map(rows.map((r) => [r.candidate, r.votes]));
  return sortRace(CANDIDATES.map((c) => ({ candidate: c.id, votes: votes.get(c.id) ?? 0 })));
}

export function sortRace(race: RaceEntry[]): RaceEntry[] {
  return [...race].sort((a, b) => b.votes - a.votes || a.candidate - b.candidate);
}

/** Apply one new ballot locally (realtime), without refetching. */
export function applyBallot(data: Omit<CountData, "configured">, b: TickerEvent): Omit<CountData, "configured"> {
  const race =
    b.prediction >= 1
      ? sortRace(data.race.map((r) => (r.candidate === b.prediction ? { ...r, votes: r.votes + 1 } : r)))
      : data.race;
  const s = data.stats;
  return {
    race,
    stats: {
      ...s,
      total: s.total + 1,
      abstained: s.abstained + (b.prediction === 0 ? 1 : 0),
      spoiled: s.spoiled + (b.prediction === -1 ? 1 : 0),
    },
    recent: [b, ...data.recent.filter((r) => r.id !== b.id)].slice(0, 12),
  };
}

export async function fetchCountData(db: SupabaseClient): Promise<Omit<CountData, "configured">> {
  const [rank, stats, recent] = await Promise.all([
    db.from("rankings").select("candidate,votes"),
    db.from("ballot_stats").select("total,abstained,spoiled,avg_latency_ms").maybeSingle(),
    db.from("ballots").select("id,created_at,prediction").order("created_at", { ascending: false }).limit(12),
  ]);
  if (rank.error) throw new Error(rank.error.message);
  return {
    race: rankRace((rank.data ?? []) as RankingRow[]),
    stats: (stats.data as BallotStats | null) ?? EMPTY_STATS,
    recent: (recent.data ?? []) as TickerEvent[],
  };
}

/** Server-side first paint with the public (anon) key. Never throws: the page still renders. */
export async function loadCountData(): Promise<CountData> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const empty = { race: rankRace([]), stats: EMPTY_STATS, recent: [] };
  if (!url || !key) return { ...empty, configured: false };
  try {
    const db = createClient(url, key, { auth: { persistSession: false } });
    return { ...(await fetchCountData(db)), configured: true };
  } catch (e) {
    console.error("[count] initial load failed:", (e as Error).message);
    return { ...empty, configured: true };
  }
}
