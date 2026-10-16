import { candidate, dishArt, shortName } from "./candidates";

export type VerdictKind = "voted" | "abstained" | "spoiled";
export type Verdict = {
  kind: VerdictKind;
  /** "Voted for Green Curry" / "Abstained" / "Spoiled ballot" */
  label: string;
  /** Text printed on the rubber stamp. */
  stamp: string;
  art: string | null;
};

export function verdict(prediction: number): Verdict {
  if (prediction === 0) return { kind: "abstained", label: "Abstained", stamp: "ABSTAINED", art: null };
  if (prediction === -1) return { kind: "spoiled", label: "Spoiled ballot", stamp: "SPOILED", art: null };
  const c = candidate(prediction);
  return {
    kind: "voted",
    label: `Voted for ${c?.name ?? `#${prediction}`}`,
    stamp: `VOTED · #${prediction} ${shortName(prediction).toUpperCase()}`,
    art: dishArt(prediction),
  };
}
