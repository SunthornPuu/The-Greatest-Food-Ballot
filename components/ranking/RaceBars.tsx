"use client";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { candidate, dishArt } from "@/lib/candidates";
import type { RaceEntry } from "@/lib/count-data";

export function RaceBars({ race, totalVotes, flash }: { race: RaceEntry[]; totalVotes: number; flash: number | null }) {
  const reduce = useReducedMotion();
  const [all, setAll] = useState(false);
  const max = Math.max(1, ...race.map((r) => r.votes));
  const shown = all ? race : race.slice(0, 10);

  return (
    <section aria-labelledby="race-h">
      <div className="flex items-end justify-between gap-3">
        <h2 id="race-h" className="font-display text-2xl font-extrabold">
          The race
        </h2>
        <span className="font-mono text-xs text-muted">{totalVotes} counted votes</span>
      </div>
      <ol className="mt-3 grid gap-1.5">
        {shown.map((r, i) => {
          const c = candidate(r.candidate);
          const share = totalVotes ? (r.votes / totalVotes) * 100 : 0;
          const flashing = flash === r.candidate;
          return (
            <motion.li
              key={r.candidate}
              layout={reduce ? false : "position"}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="grid grid-cols-[2rem_1fr] items-center gap-2"
            >
              <span className="text-right font-mono text-sm font-bold">{i + 1}</span>
              <div
                className={`relative h-10 overflow-hidden border-3 border-line bg-surface-strong ${
                  flashing ? "ring-4 ring-hot ring-offset-1 ring-offset-bg" : ""
                }`}
              >
                <motion.div
                  className={`absolute inset-y-0 left-0 ${flashing ? "bg-ink" : i === 0 && r.votes ? "bg-hot" : "bg-paper-deep"}`}
                  initial={false}
                  animate={{ width: `${(r.votes / max) * 100}%` }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 22 }}
                />
                <div className="relative flex h-full items-center justify-between gap-2 px-2">
                  <span className={`flex min-w-0 items-center gap-2 text-sm font-semibold ${flashing ? "text-cell" : ""}`}>
                    <span aria-hidden>{dishArt(r.candidate)}</span>
                    <span className="truncate">{c?.name}</span>
                  </span>
                  <span className={`shrink-0 font-mono text-xs ${flashing ? "text-cell" : ""}`}>
                    {r.votes} · {share.toFixed(0)}%
                  </span>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>
      <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className="press mt-3 bg-surface-strong px-3 py-1.5 text-sm font-bold">
        {all ? "Show top 10" : "Show all 26"}
      </button>
    </section>
  );
}
