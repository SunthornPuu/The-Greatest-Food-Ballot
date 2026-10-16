import { describe, expect, it } from "vitest";
import { applyBallot, EMPTY_STATS, rankRace, type CountData } from "@/lib/count-data";

describe("the count", () => {
  it("includes all 26 dishes, zero-vote ones too, ranked by votes then number", () => {
    const race = rankRace([{ candidate: 6, votes: 3 }, { candidate: 26, votes: 5 }]);
    expect(race).toHaveLength(26);
    expect(race.slice(0, 3).map((r) => r.candidate)).toEqual([26, 6, 1]);
    expect(race.find((r) => r.candidate == 13)?.votes).toBe(0);
  });

  it("a realtime ballot updates votes, re-ranks, and counts abstain/spoiled in stats only", () => {
    let d: Omit<CountData, "configured"> = { race: rankRace([{ candidate: 2, votes: 1 }]), stats: EMPTY_STATS, recent: [] };
    d = applyBallot(d, { id: "a", created_at: "", prediction: 9 });
    d = applyBallot(d, { id: "b", created_at: "", prediction: 9 });
    expect(d.race[0]).toEqual({ candidate: 9, votes: 2 });
    d = applyBallot(d, { id: "c", created_at: "", prediction: 0 });
    d = applyBallot(d, { id: "d", created_at: "", prediction: -1 });
    expect(d.race.reduce((s, r) => s + r.votes, 0)).toBe(3);
    expect(d.stats).toMatchObject({ total: 4, abstained: 1, spoiled: 1 });
    expect(d.recent.map((r) => r.id)).toEqual(["d", "c", "b", "a"]);
  });
});
