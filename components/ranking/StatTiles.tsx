import type { BallotStats } from "@/lib/types";

export function StatTiles({ stats }: { stats: BallotStats }) {
  const tiles = [
    { label: "Ballots cast", value: String(stats.total) },
    { label: "Abstained", value: String(stats.abstained) },
    { label: "Spoiled", value: String(stats.spoiled) },
    {
      label: "Avg model time",
      value: stats.avg_latency_ms == null ? "–" : `${(stats.avg_latency_ms / 1000).toFixed(1)}s`,
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="cell bg-surface-strong p-3">
          <dt className="text-xs font-bold uppercase tracking-wide">{t.label}</dt>
          <dd className="mt-1 font-mono text-3xl font-bold tabular-nums">{t.value}</dd>
        </div>
      ))}
    </dl>
  );
}
